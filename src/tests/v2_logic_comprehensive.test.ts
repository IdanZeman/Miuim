import { describe, it, expect } from 'vitest';

// ============================================================================
// COMPREHENSIVE V2 SCHEDULING ALGORITHM - PURE LOGIC INTERFACE
// ============================================================================
// Tests the complete decision-making logic for write-based scheduling
// Handles: Merge, Split, Overwrite, Sandwich, and Hard Cap scenarios

type AttendanceStatus = 'HOME' | 'BASE' | 'UNAVAILABLE';
type EventType = 'MANUAL' | 'APPROVED_ABSENCE' | 'ROTATION';

interface SchedulingRequest {
  startDate: string; // YYYY-MM-DD
  endDate?: string; // Optional: If provided, it's a range. If null, it's open-ended
  status: AttendanceStatus;
  isManual: boolean;
}

interface ExistingEvent {
  id: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  type: EventType;
  source?: string; // For debugging
}

interface SchedulingDecision {
  action: 'MERGE_FORWARD' | 'MERGE_BACKWARD' | 'MERGE_BOTH' | 'STOP_BEFORE' | 'OVERWRITE_SPLIT' | 'HARD_CAP' | 'SIMPLE_WRITE';
  calculatedEndDate: string; // YYYY-MM-DD - Final date to write until
  affectedEventIds?: string[]; // IDs of events that need to be modified/deleted
  mergeIntoEventId?: string; // ID of event to merge into (if applicable)
  reason: string; // Human-readable explanation
}

// ============================================================================
// DATE UTILITIES
// ============================================================================

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

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================================================
// CORE V2 COMPREHENSIVE LOGIC
// ============================================================================

const HARD_CAP_DAYS = 45;

/**
 * calculateV2Logic - Comprehensive Write-Based Scheduling Decision Engine
 * 
 * This function implements the complete V2 algorithm including:
 * 1. Forward Merge: Extend to a future event with same status
 * 2. Backward Merge: Check if request starts during an existing same-status event
 * 3. Sandwich Merge: Merge backward AND forward (close a gap)
 * 4. Stop Before: Halt writes before a conflicting event
 * 5. Overwrite/Split: Replace or split a long event
 * 6. Hard Cap: Limit open-ended writes to 45 days
 * 
 * Priority Rules:
 * - Manual events (Layer 1) take precedence over Rotations (Layer 2)
 * - Same-status events can merge
 * - Different-status events create boundaries
 */
function calculateV2Logic(
  request: SchedulingRequest,
  futureEvents: ExistingEvent[]
): SchedulingDecision {
  const { startDate, endDate, status, isManual } = request;

  // Filter to only Manual and Approved Absence events (ignore rotations for now)
  const blockingEvents = futureEvents.filter(e => 
    e.type === 'MANUAL' || e.type === 'APPROVED_ABSENCE'
  );

  // Sort events by date
  const sortedEvents = [...blockingEvents].sort((a, b) => 
    a.date.localeCompare(b.date)
  );

  // STEP 1: Check for BACKWARD merge (starts inside existing same-status event)
  const previousDayEvents = sortedEvents.filter(e => e.date < startDate);
  const lastPreviousEvent = previousDayEvents[previousDayEvents.length - 1];
  
  const canMergeBackward = lastPreviousEvent && 
    lastPreviousEvent.status === status &&
    lastPreviousEvent.type === 'MANUAL'; // Only merge with manual events

  // STEP 2: Find next event after start date
  const nextEvent = sortedEvents.find(e => e.date > startDate);
  const sameDay = sortedEvents.find(e => e.date === startDate);

  // STEP 3: Check for FORWARD merge (next event has same status)
  const canMergeForward = nextEvent && 
    nextEvent.status === status &&
    (nextEvent.type === 'MANUAL' || nextEvent.type === 'APPROVED_ABSENCE');

  // STEP 4: Determine end date for the write operation
  let calculatedEndDate: string;
  let action: SchedulingDecision['action'];
  let affectedEventIds: string[] = [];
  let mergeIntoEventId: string | undefined;
  let reason: string;

  // CASE 1: SANDWICH MERGE (Backward + Forward)
  if (canMergeBackward && canMergeForward) {
    calculatedEndDate = nextEvent.date;
    action = 'MERGE_BOTH';
    affectedEventIds = [lastPreviousEvent.id, nextEvent.id];
    mergeIntoEventId = lastPreviousEvent.id; // Extend the previous event
    reason = `Sandwich merge: Closing gap between ${lastPreviousEvent.date} and ${nextEvent.date}`;
  }
  // CASE 2: BACKWARD MERGE only
  else if (canMergeBackward && !canMergeForward) {
    // Extend the previous event forward
    if (nextEvent && nextEvent.status !== status) {
      // Stop before the conflicting event
      calculatedEndDate = subtractDays(nextEvent.date, 1);
      action = 'MERGE_BACKWARD';
      mergeIntoEventId = lastPreviousEvent.id;
      reason = `Backward merge until conflict at ${nextEvent.date}`;
    } else if (endDate) {
      // User specified end date
      calculatedEndDate = endDate;
      action = 'MERGE_BACKWARD';
      mergeIntoEventId = lastPreviousEvent.id;
      reason = `Backward merge with specified end date ${endDate}`;
    } else {
      // Open-ended: apply hard cap
      calculatedEndDate = addDays(startDate, HARD_CAP_DAYS);
      action = 'MERGE_BACKWARD';
      mergeIntoEventId = lastPreviousEvent.id;
      reason = `Backward merge with hard cap (${HARD_CAP_DAYS} days)`;
    }
  }
  // CASE 3: FORWARD MERGE only
  else if (canMergeForward) {
    calculatedEndDate = nextEvent.date;
    action = 'MERGE_FORWARD';
    mergeIntoEventId = nextEvent.id;
    affectedEventIds = [nextEvent.id];
    reason = `Forward merge into event at ${nextEvent.date}`;
  }
  // CASE 4: STOP BEFORE conflict
  else if (endDate && nextEvent && endDate < nextEvent.date) {
    calculatedEndDate = endDate;
    action = 'SIMPLE_WRITE';
    reason = `Specified end date ${endDate} is before next event at ${nextEvent.date}`;
  }
  // CASE 4: STOP BEFORE conflict
  else if (nextEvent && nextEvent.status !== status) {
    calculatedEndDate = subtractDays(nextEvent.date, 1);
    action = 'STOP_BEFORE';
    reason = `Different status detected at ${nextEvent.date}, stopping before`;
  }
  // CASE 5: OVERWRITE/SPLIT long event
  else if (sameDay && sameDay.status !== status && sameDay.type === 'MANUAL') {
    // User wants to change status on a day that already exists
    calculatedEndDate = endDate || addDays(startDate, HARD_CAP_DAYS);
    action = 'OVERWRITE_SPLIT';
    affectedEventIds = [sameDay.id];
    reason = `Overwriting existing ${sameDay.status} event on ${startDate}`;
  }
  // CASE 6: HARD CAP (no events ahead)
  else if (!nextEvent && !endDate) {
    calculatedEndDate = addDays(startDate, HARD_CAP_DAYS);
    action = 'HARD_CAP';
    reason = `No future events, applying hard cap (${HARD_CAP_DAYS} days from ${startDate})`;
  }
  // CASE 7: SIMPLE WRITE (user-specified range or clear path)
  else {
    calculatedEndDate = endDate || addDays(startDate, HARD_CAP_DAYS);
    action = 'SIMPLE_WRITE';
    reason = endDate 
      ? `Simple write for specified range ${startDate} to ${endDate}`
      : `Simple write with hard cap`;
  }

  return {
    action,
    calculatedEndDate,
    affectedEventIds: affectedEventIds.length > 0 ? affectedEventIds : undefined,
    mergeIntoEventId,
    reason
  };
}

// ============================================================================
// TEST SUITE - COMPREHENSIVE V2 SCHEDULING LOGIC
// ============================================================================

describe('V2 Comprehensive Scheduling Algorithm', () => {
  
  // --------------------------------------------------------------------------
  // SCENARIO 1: SANDWICH MERGE (Close the Gap)
  // --------------------------------------------------------------------------
  describe('Sandwich Merge - Close Gap Between Two Events', () => {
    it('should merge backward and forward to close a gap', () => {
      // GIVEN: User has HOME on Feb 1-3, wants to set HOME on Feb 5, and has HOME on Feb 8-10
      // This creates: HOME (1-3) → GAP (4-7) → NEW (5) → GAP (6-7) → HOME (8-10)
      // Should become: HOME (1-10) by closing the gap
      
      const request: SchedulingRequest = {
        startDate: '2026-02-05',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-03', status: 'HOME', type: 'MANUAL', source: 'Previous HOME period' },
        { id: 'evt-2', date: '2026-02-08', status: 'HOME', type: 'MANUAL', source: 'Future HOME period' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // THEN: Should merge both directions (sandwich)
      expect(result.action).toBe('MERGE_BOTH');
      expect(result.calculatedEndDate).toBe('2026-02-08');
      expect(result.affectedEventIds).toEqual(['evt-1', 'evt-2']);
      expect(result.mergeIntoEventId).toBe('evt-1');
      expect(result.reason).toContain('Sandwich');
    });

    it('should handle single-day gap closure', () => {
      // GIVEN: HOME on Feb 5, request HOME on Feb 6, HOME on Feb 7
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-05', status: 'HOME', type: 'MANUAL' },
        { id: 'evt-2', date: '2026-02-07', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('MERGE_BOTH');
      expect(result.calculatedEndDate).toBe('2026-02-07');
    });

    it('should NOT sandwich if statuses differ', () => {
      // GIVEN: HOME on Feb 1, request BASE on Feb 5, HOME on Feb 10
      const request: SchedulingRequest = {
        startDate: '2026-02-05',
        status: 'BASE',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-01', status: 'HOME', type: 'MANUAL' },
        { id: 'evt-2', date: '2026-02-10', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should NOT merge - different status
      expect(result.action).not.toBe('MERGE_BOTH');
      expect(result.action).toBe('STOP_BEFORE'); // Stops before Feb 10
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 2: BACKWARD MERGE (Extend Existing Event)
  // --------------------------------------------------------------------------
  describe('Backward Merge - Extend Previous Event', () => {
    it('should extend previous HOME event forward', () => {
      // GIVEN: HOME event ending on Feb 3, user sets HOME on Feb 6
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-03', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('MERGE_BACKWARD');
      expect(result.mergeIntoEventId).toBe('evt-1');
      expect(result.calculatedEndDate).toBe('2026-03-23'); // Hard cap
    });

    it('should stop backward merge before conflicting event', () => {
      // GIVEN: HOME on Feb 1, request HOME on Feb 5, BASE on Feb 10
      const request: SchedulingRequest = {
        startDate: '2026-02-05',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-01', status: 'HOME', type: 'MANUAL' },
        { id: 'evt-2', date: '2026-02-10', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('MERGE_BACKWARD');
      expect(result.calculatedEndDate).toBe('2026-02-09'); // Day before conflict
    });

    it('should respect user-specified end date when merging backward', () => {
      // GIVEN: HOME on Feb 1, request HOME on Feb 5-8
      const request: SchedulingRequest = {
        startDate: '2026-02-05',
        endDate: '2026-02-08',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-01', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('MERGE_BACKWARD');
      expect(result.calculatedEndDate).toBe('2026-02-08');
      expect(result.mergeIntoEventId).toBe('evt-1');
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 3: FORWARD MERGE (Jenny Case)
  // --------------------------------------------------------------------------
  describe('Forward Merge - Extend to Future Event', () => {
    it('should merge forward into future same-status event', () => {
      // GIVEN: Request HOME on Feb 6, future HOME on Feb 10
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-10', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('MERGE_FORWARD');
      expect(result.calculatedEndDate).toBe('2026-02-10');
      expect(result.mergeIntoEventId).toBe('evt-1');
      expect(result.affectedEventIds).toContain('evt-1');
    });

    it('should NOT merge if next event has different status', () => {
      // GIVEN: Request HOME on Feb 6, future BASE on Feb 10
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-10', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('STOP_BEFORE');
      expect(result.calculatedEndDate).toBe('2026-02-09'); // Day before conflict
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 4: STOP BEFORE (Conflict Boundary)
  // --------------------------------------------------------------------------
  describe('Stop Before - Respect Boundaries', () => {
    it('should stop before immediate next-day conflict', () => {
      // GIVEN: Request HOME on Feb 6, BASE on Feb 7 (tomorrow)
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-07', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('STOP_BEFORE');
      expect(result.calculatedEndDate).toBe('2026-02-06'); // Only today
    });

    it('should stop before approved absence', () => {
      // GIVEN: Request HOME on Feb 6, APPROVED_ABSENCE on Feb 12
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'abs-1', date: '2026-02-12', status: 'HOME', type: 'APPROVED_ABSENCE' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should merge forward (same status)
      expect(result.action).toBe('MERGE_FORWARD');
      expect(result.calculatedEndDate).toBe('2026-02-12');
    });

    it('should handle multiple future conflicts correctly', () => {
      // GIVEN: Request HOME on Feb 6, BASE on Feb 10, HOME on Feb 15, UNAVAILABLE on Feb 20
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-10', status: 'BASE', type: 'MANUAL' },
        { id: 'evt-2', date: '2026-02-15', status: 'HOME', type: 'MANUAL' },
        { id: 'evt-3', date: '2026-02-20', status: 'UNAVAILABLE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should stop before first conflict (BASE on Feb 10)
      expect(result.action).toBe('STOP_BEFORE');
      expect(result.calculatedEndDate).toBe('2026-02-09');
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 5: OVERWRITE/SPLIT (Replace Existing)
  // --------------------------------------------------------------------------
  describe('Overwrite/Split - Replace Existing Events', () => {
    it('should overwrite same-day event with different status', () => {
      // GIVEN: BASE exists on Feb 6, user wants to set HOME on Feb 6
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-06', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('OVERWRITE_SPLIT');
      expect(result.affectedEventIds).toContain('evt-1');
    });

    it('should handle overwrite with specified end date', () => {
      // GIVEN: BASE on Feb 6, request HOME from Feb 6-10
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        endDate: '2026-02-10',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-06', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('OVERWRITE_SPLIT');
      expect(result.calculatedEndDate).toBe('2026-02-10');
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 6: HARD CAP (Open-Ended Writes)
  // --------------------------------------------------------------------------
  describe('Hard Cap - Limit Open-Ended Writes', () => {
    it('should apply 45-day hard cap when no future events exist', () => {
      // GIVEN: Request HOME on Feb 6, no future events
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('HARD_CAP');
      expect(result.calculatedEndDate).toBe('2026-03-23'); // Feb 6 + 45 days
    });

    it('should NOT apply hard cap if user specifies end date', () => {
      // GIVEN: Request HOME on Feb 6-15, no future events
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        endDate: '2026-02-15',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('SIMPLE_WRITE');
      expect(result.calculatedEndDate).toBe('2026-02-15');
    });

    it('should ignore rotation events when calculating hard cap', () => {
      // GIVEN: Request HOME on Feb 6, only rotation event exists at Feb 20
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'rot-1', date: '2026-02-20', status: 'BASE', type: 'ROTATION' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Rotations are filtered out, so should apply hard cap
      expect(result.action).toBe('HARD_CAP');
    });
  });

  // --------------------------------------------------------------------------
  // SCENARIO 7: SIMPLE WRITE (Clear Path)
  // --------------------------------------------------------------------------
  describe('Simple Write - No Conflicts', () => {
    it('should write simple range when path is clear', () => {
      // GIVEN: Request HOME from Feb 6-12, future event on Feb 20
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        endDate: '2026-02-12',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-20', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('SIMPLE_WRITE');
      expect(result.calculatedEndDate).toBe('2026-02-12');
    });

    it('should handle single-day write', () => {
      // GIVEN: Request HOME on Feb 6 only
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        endDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('SIMPLE_WRITE');
      expect(result.calculatedEndDate).toBe('2026-02-06');
    });
  });

  // --------------------------------------------------------------------------
  // EDGE CASES & COMPLEX SCENARIOS
  // --------------------------------------------------------------------------
  describe('Edge Cases & Complex Scenarios', () => {
    it('should handle alternating status pattern', () => {
      // GIVEN: HOME, BASE, HOME, BASE pattern
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-08', status: 'BASE', type: 'MANUAL' },
        { id: 'evt-2', date: '2026-02-10', status: 'HOME', type: 'MANUAL' },
        { id: 'evt-3', date: '2026-02-12', status: 'BASE', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should stop before first BASE
      expect(result.action).toBe('STOP_BEFORE');
      expect(result.calculatedEndDate).toBe('2026-02-07');
    });

    it('should handle gap larger than hard cap', () => {
      // GIVEN: HOME on Feb 6, next event 100 days later
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-05-17', status: 'BASE', type: 'MANUAL' } // 100 days later
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should stop before the far event (not apply hard cap)
      expect(result.action).toBe('STOP_BEFORE');
      expect(result.calculatedEndDate).toBe('2026-05-16');
    });

    it('should handle all events on consecutive days', () => {
      // GIVEN: Events on Feb 5, 6, 7, 8 with same status
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-05', status: 'HOME', type: 'MANUAL' },
        { id: 'evt-2', date: '2026-02-07', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should merge both (sandwich)
      expect(result.action).toBe('MERGE_BOTH');
      expect(result.calculatedEndDate).toBe('2026-02-07');
    });

    it('should prioritize manual events over approved absences', () => {
      // GIVEN: Manual BASE on Feb 10, Approved Absence HOME on Feb 12
      const request: SchedulingRequest = {
        startDate: '2026-02-06',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-10', status: 'BASE', type: 'MANUAL' },
        { id: 'abs-1', date: '2026-02-12', status: 'HOME', type: 'APPROVED_ABSENCE' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      // Should stop before first manual event
      expect(result.action).toBe('STOP_BEFORE');
      expect(result.calculatedEndDate).toBe('2026-02-09');
    });
  });

  // --------------------------------------------------------------------------
  // YEAR BOUNDARY & DATE EDGE CASES
  // --------------------------------------------------------------------------
  describe('Date Boundary Tests', () => {
    it('should handle year boundary crossing', () => {
      const request: SchedulingRequest = {
        startDate: '2025-12-20',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('HARD_CAP');
      expect(result.calculatedEndDate).toBe('2026-02-03'); // Dec 20 + 45 days
    });

    it('should handle leap year dates', () => {
      const request: SchedulingRequest = {
        startDate: '2024-02-28',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('HARD_CAP');
      expect(result.calculatedEndDate).toBe('2024-04-12'); // Feb 28 + 45 days (through Feb 29)
    });

    it('should handle month boundary merges', () => {
      const request: SchedulingRequest = {
        startDate: '2026-01-28',
        status: 'HOME',
        isManual: true
      };

      const futureEvents: ExistingEvent[] = [
        { id: 'evt-1', date: '2026-02-03', status: 'HOME', type: 'MANUAL' }
      ];

      const result = calculateV2Logic(request, futureEvents);

      expect(result.action).toBe('MERGE_FORWARD');
      expect(result.calculatedEndDate).toBe('2026-02-03');
    });
  });
});

// ============================================================================
// UTILITY FUNCTION TESTS
// ============================================================================
describe('Date Utility Functions', () => {
  describe('addDays', () => {
    it('should add days correctly', () => {
      expect(addDays('2026-02-06', 1)).toBe('2026-02-07');
      expect(addDays('2026-02-06', 45)).toBe('2026-03-23');
      expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    });
  });

  describe('subtractDays', () => {
    it('should subtract days correctly', () => {
      expect(subtractDays('2026-02-08', 1)).toBe('2026-02-07');
      expect(subtractDays('2026-02-01', 1)).toBe('2026-01-31');
    });
  });

  describe('daysBetween', () => {
    it('should calculate days between dates', () => {
      expect(daysBetween('2026-02-06', '2026-02-08')).toBe(2);
      expect(daysBetween('2026-02-06', '2026-03-23')).toBe(45);
      expect(daysBetween('2026-02-06', '2026-02-06')).toBe(0);
    });
  });
});
