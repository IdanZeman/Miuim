import { describe, it, expect } from 'vitest';

// ============================================================================
// PURE LOGIC INTERFACE - V2 Write-Based Scheduling Algorithm
// ============================================================================
// This tests the DECISION LOGIC only - no database operations
// Based on the "Check & Merge" algorithm from scheduler-v2.agent.md

type AttendanceStatus = 'HOME' | 'BASE' | 'UNAVAILABLE';

interface NextEvent {
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  source: 'manual' | 'rotation' | 'algorithm';
}

interface WriteRangeDecision {
  action: 'MERGE' | 'STOP_BEFORE' | 'HARD_CAP';
  validUntil: string; // YYYY-MM-DD
  reason: string; // Human-readable explanation
}

// ============================================================================
// CORE V2 DECISION LOGIC
// ============================================================================
// This function encapsulates the "Lookahead & Merge" algorithm
// Rule 1: If next event has SAME status → MERGE
// Rule 2: If next event has DIFFERENT status → STOP_BEFORE
// Rule 3: If no next event → HARD_CAP (45 days)

const HARD_CAP_DAYS = 45;

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

function subtractDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

/**
 * calculateWriteRange - Core V2 Decision Logic
 * 
 * Determines how far into the future to write records based on:
 * 1. The new status being set
 * 2. The next existing manual/approved event (or null)
 * 
 * This implements the "3 Layers of Truth" priority:
 * - Layer 1 (Reality): Manual Overrides & Approved Absences
 * - Layer 2 (The Plan): Rotations
 * - Layer 3 (Fallback): System Default
 */
function calculateWriteRange(
  newStatus: AttendanceStatus,
  startDate: string,
  nextEvent: NextEvent | null
): WriteRangeDecision {
  // CASE 1: No future events → Open Loop → Apply Hard Cap
  if (!nextEvent) {
    const hardCapDate = addDays(startDate, HARD_CAP_DAYS);
    return {
      action: 'HARD_CAP',
      validUntil: hardCapDate,
      reason: `No future events found. Writing up to hard cap limit (${HARD_CAP_DAYS} days from ${startDate}).`
    };
  }

  // CASE 2: Next event has SAME status → Merge
  if (nextEvent.status === newStatus) {
    return {
      action: 'MERGE',
      validUntil: nextEvent.date,
      reason: `Next event (${nextEvent.date}) has same status '${newStatus}'. Merging records to extend the range.`
    };
  }

  // CASE 3: Next event has DIFFERENT status → Stop Before
  // Write up to the day before the next event
  const stopDate = subtractDays(nextEvent.date, 1);
  return {
    action: 'STOP_BEFORE',
    validUntil: stopDate,
    reason: `Next event (${nextEvent.date}) has different status '${nextEvent.status}'. Stopping writes at ${stopDate} to avoid conflict.`
  };
}

// ============================================================================
// TEST SUITE - V2 Scheduling Algorithm Decision Logic
// ============================================================================

describe('V2 Write-Based Scheduling Algorithm - Decision Logic', () => {
  describe('calculateWriteRange', () => {
    
    // ------------------------------------------------------------------------
    // SCENARIO 1: The "Jenny" Case (Merge)
    // ------------------------------------------------------------------------
    describe('Merge Logic - Same Status', () => {
      it('should MERGE when next event has the same status', () => {
        // GIVEN: User sets 'HOME' on Feb 6
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        // AND: There's already a 'HOME' event on Feb 8 (2 days later)
        const nextEvent: NextEvent = {
          date: '2026-02-08',
          status: 'HOME',
          source: 'manual'
        };

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: The system should MERGE these events
        // WHY: Both periods are HOME, so we extend the HOME period until Feb 8
        // This is the "Jenny Case" - early exit merging into a future planned exit
        expect(result.action).toBe('MERGE');
        expect(result.validUntil).toBe('2026-02-08');
        expect(result.reason).toContain('same status');
      });

      it('should MERGE when setting BASE and next event is also BASE', () => {
        // GIVEN: User sets 'BASE' on Feb 10
        const newStatus: AttendanceStatus = 'BASE';
        const startDate = '2026-02-10';
        
        // AND: There's already a 'BASE' event on Feb 15
        const nextEvent: NextEvent = {
          date: '2026-02-15',
          status: 'BASE',
          source: 'manual'
        };

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should merge the base periods
        expect(result.action).toBe('MERGE');
        expect(result.validUntil).toBe('2026-02-15');
      });
    });

    // ------------------------------------------------------------------------
    // SCENARIO 2: The Hard Block (Conflict)
    // ------------------------------------------------------------------------
    describe('Stop Before Logic - Different Status', () => {
      it('should STOP_BEFORE when next event has a different status', () => {
        // GIVEN: User sets 'HOME' on Feb 6
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        // AND: There's a 'BASE' (duty) event on Feb 8
        const nextEvent: NextEvent = {
          date: '2026-02-08',
          status: 'BASE',
          source: 'manual'
        };

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: The system should STOP before the conflicting event
        // WHY: We cannot overwrite the manual BASE duty on Feb 8
        // So we only write HOME for Feb 6 and Feb 7
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-02-07'); // Day before the conflict
        expect(result.reason).toContain('different status');
      });

      it('should handle immediate neighbor conflict (tomorrow is different)', () => {
        // GIVEN: User sets 'HOME' on Feb 6
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        // AND: Tomorrow (Feb 7) is already marked as 'BASE'
        const nextEvent: NextEvent = {
          date: '2026-02-07',
          status: 'BASE',
          source: 'manual'
        };

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should only write for today (Feb 6)
        // WHY: The conflict is immediate - tomorrow is already set to BASE
        // validUntil will be Feb 6 (today only)
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-02-06');
      });

      it('should respect HOME → UNAVAILABLE conflict', () => {
        // GIVEN: User sets 'HOME' on Feb 10
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-10';
        
        // AND: There's an 'UNAVAILABLE' constraint on Feb 12
        const nextEvent: NextEvent = {
          date: '2026-02-12',
          status: 'UNAVAILABLE',
          source: 'manual'
        };

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should stop before the unavailable date
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-02-11');
      });
    });

    // ------------------------------------------------------------------------
    // SCENARIO 3: The Open Horizon (Safety Cap)
    // ------------------------------------------------------------------------
    describe('Hard Cap Logic - No Future Events', () => {
      it('should apply HARD_CAP when no future events exist', () => {
        // GIVEN: User sets 'HOME' on Feb 6
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        // AND: There are NO future manual events
        const nextEvent = null;

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: The system should apply the 45-day hard cap
        // WHY: Without a stopping point, we could write infinite records
        // The 45-day cap prevents database bloat and forces periodic review
        expect(result.action).toBe('HARD_CAP');
        expect(result.validUntil).toBe('2026-03-23'); // Feb 6 + 45 days
        expect(result.reason).toContain('hard cap');
      });

      it('should calculate correct hard cap date for different start dates', () => {
        // GIVEN: User sets 'BASE' on Jan 1
        const newStatus: AttendanceStatus = 'BASE';
        const startDate = '2026-01-01';
        const nextEvent = null;

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should cap at Jan 1 + 45 days = Feb 15
        expect(result.action).toBe('HARD_CAP');
        expect(result.validUntil).toBe('2026-02-15');
      });

      it('should apply hard cap for UNAVAILABLE status', () => {
        // GIVEN: User marks unavailable from Feb 20
        const newStatus: AttendanceStatus = 'UNAVAILABLE';
        const startDate = '2026-02-20';
        const nextEvent = null;

        // WHEN: We calculate the write range
        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should still apply 45-day limit
        // WHY: Even unavailable periods need bounds
        expect(result.action).toBe('HARD_CAP');
        expect(result.validUntil).toBe('2026-04-05'); // Feb 20 + 45 days
      });
    });

    // ------------------------------------------------------------------------
    // EDGE CASES
    // ------------------------------------------------------------------------
    describe('Edge Cases', () => {
      it('should handle next event on same day (no days to write)', () => {
        // EDGE CASE: User tries to set HOME, but same day already has BASE
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        const nextEvent: NextEvent = {
          date: '2026-02-06', // Same day!
          status: 'BASE',
          source: 'manual'
        };

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should calculate stop date as day before = Feb 5
        // This indicates the write operation would fail (can't write in the past)
        // The Edge Function should handle this by either:
        // 1. Replacing the same-day event, OR
        // 2. Rejecting the operation
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-02-05'); // Day before = past
      });

      it('should handle far-future next event (beyond 45 days)', () => {
        // EDGE CASE: Next event is 100 days away
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        const nextEvent: NextEvent = {
          date: '2026-05-17', // 100 days later
          status: 'BASE',
          source: 'manual'
        };

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should STOP before the next event (not apply hard cap)
        // WHY: There IS a next event, so hard cap doesn't apply
        // We write until day before that event
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-05-16');
      });

      it('should handle rotation-sourced next events', () => {
        // EDGE CASE: Next event is from rotation (not manual)
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        // In V2, rotations are treated as "Level 0" baseline
        // Manual overrides should respect rotation boundaries
        const nextEvent: NextEvent = {
          date: '2026-02-10',
          status: 'BASE',
          source: 'rotation' // From 11/3 rotation
        };

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // THEN: Should stop before the rotation-based BASE period
        // WHY: Rotations are Layer 2 (The Plan), manual is Layer 1 (Reality)
        // But we still respect rotation boundaries to avoid chaos
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-02-09');
      });
    });

    // ------------------------------------------------------------------------
    // THE "3 LAYERS OF TRUTH" VALIDATION
    // ------------------------------------------------------------------------
    describe('3 Layers of Truth - Priority Order', () => {
      it('should prioritize manual events (Layer 1) over everything', () => {
        // SCENARIO: Manual HOME conflicts with rotation BASE
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        const nextEvent: NextEvent = {
          date: '2026-02-10',
          status: 'BASE',
          source: 'rotation' // Layer 2
        };

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // Manual override (Layer 1) stops before rotation (Layer 2)
        expect(result.action).toBe('STOP_BEFORE');
        expect(result.validUntil).toBe('2026-02-09');
      });

      it('should allow merging of same-status manual events', () => {
        // SCENARIO: Two manual HOME periods should merge
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2026-02-06';
        
        const nextEvent: NextEvent = {
          date: '2026-02-08',
          status: 'HOME',
          source: 'manual' // Same layer (Layer 1)
        };

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        // Both are Layer 1, same status → MERGE
        expect(result.action).toBe('MERGE');
        expect(result.validUntil).toBe('2026-02-08');
      });
    });

    // ------------------------------------------------------------------------
    // PERFORMANCE & BOUNDARY TESTS
    // ------------------------------------------------------------------------
    describe('Performance & Boundaries', () => {
      it('should handle leap year dates correctly', () => {
        // 2024 is a leap year - test Feb 29 handling
        const newStatus: AttendanceStatus = 'HOME';
        const startDate = '2024-02-28';
        const nextEvent = null;

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        expect(result.action).toBe('HARD_CAP');
        // Feb 28 + 45 days should correctly handle leap year
        const expectedDate = '2024-04-12';
        expect(result.validUntil).toBe(expectedDate);
      });

      it('should handle year boundary crossing', () => {
        // Test Dec → Jan transition
        const newStatus: AttendanceStatus = 'BASE';
        const startDate = '2025-12-20';
        const nextEvent = null;

        const result = calculateWriteRange(newStatus, startDate, nextEvent);

        expect(result.action).toBe('HARD_CAP');
        // Dec 20 + 45 days = Feb 3, 2026
        expect(result.validUntil).toBe('2026-02-03');
      });
    });
  });
});

// ============================================================================
// HELPER TESTS - Date Manipulation Utilities
// ============================================================================
describe('Date Manipulation Utilities', () => {
  describe('addDays', () => {
    it('should add days correctly', () => {
      expect(addDays('2026-02-06', 1)).toBe('2026-02-07');
      expect(addDays('2026-02-06', 45)).toBe('2026-03-23');
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01'); // Month boundary
    });
  });

  describe('subtractDays', () => {
    it('should subtract days correctly', () => {
      expect(subtractDays('2026-02-08', 1)).toBe('2026-02-07');
      expect(subtractDays('2026-02-01', 1)).toBe('2026-01-31'); // Month boundary
    });
  });
});
