import { describe, it, expect, beforeEach } from 'vitest';
import {
  AttendanceStrategy,
  LegacyPropagationStrategy,
  WriteBasedStrategy,
  createAttendanceStrategy
} from './attendanceStrategy';
import { Person, TeamRotation, Absence, HourlyBlockage } from '@/types';

describe('AttendanceStrategy Pattern', () => {
  let mockPerson: Person;
  let mockDate: Date;
  let mockTeamRotations: TeamRotation[];
  let mockAbsences: Absence[];
  let mockHourlyBlockages: HourlyBlockage[];

  beforeEach(() => {
    mockDate = new Date('2026-02-06');
    mockTeamRotations = [];
    mockAbsences = [];
    mockHourlyBlockages = [];

    mockPerson = {
      id: 'person-1',
      name: 'Test Soldier',
      organization_id: 'org-1',
      teamId: 'team-1',
      roleId: 'role-1',
      color: '#3B82F6',
      maxShiftsPerWeek: 7,
      dailyAvailability: {},
      isActive: true,
      created_at: '2026-01-01T00:00:00Z'
    } as Person;
  });

  describe('LegacyPropagationStrategy (V1)', () => {
    let strategy: AttendanceStrategy;

    beforeEach(() => {
      strategy = new LegacyPropagationStrategy();
    });

    it('should return default availability when no data exists', () => {
      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(result.status).toBeDefined();
      expect(result.isAvailable).toBeDefined();
    });

    it('should respect manual overrides', () => {
      const dateKey = mockDate.toLocaleDateString('en-CA');
      mockPerson.dailyAvailability = {
        [dateKey]: {
          status: 'home',
          isAvailable: false,
          source: 'manual',
          startHour: '00:00',
          endHour: '23:59'
        }
      };

      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(result.status).toBe('home');
      expect(result.isAvailable).toBe(false);
      expect(result.source).toBe('manual');
    });

    it('should apply approved absences', () => {
      const dateKey = mockDate.toLocaleDateString('en-CA');
      mockAbsences = [
        {
          id: 'absence-1',
          person_id: 'person-1',
          start_date: dateKey,
          end_date: dateKey,
          status: 'approved',
          reason: 'Leave',
          organization_id: 'org-1',
          created_at: '2026-01-01T00:00:00Z'
        } as Absence
      ];

      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(result.isAvailable).toBe(false);
      expect(result.unavailableBlocks).toBeDefined();
      expect(result.unavailableBlocks!.length).toBeGreaterThan(0);
    });
  });

  describe('WriteBasedStrategy (V2)', () => {
    let strategy: AttendanceStrategy;

    beforeEach(() => {
      strategy = new WriteBasedStrategy();
    });

    it('should fetch pre-calculated records from database', () => {
      const dateKey = mockDate.toLocaleDateString('en-CA');
      mockPerson.dailyAvailability = {
        [dateKey]: {
          status: 'full',
          isAvailable: true,
          source: 'v2_write',
          startHour: '00:00',
          endHour: '23:59'
        }
      };

      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(result.status).toBe('full');
      expect(result.isAvailable).toBe(true);
    });

    it('should return default when no record exists', () => {
      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      // Should fallback to default (Layer 3)
      expect(result.status).toBe('full');
      expect(result.isAvailable).toBe(true);
      expect(result.source).toBe('default');
    });

    it('should respect absence records (Layer 1)', () => {
      const dateKey = mockDate.toLocaleDateString('en-CA');
      mockAbsences = [
        {
          id: 'absence-1',
          person_id: 'person-1',
          start_date: dateKey,
          end_date: dateKey,
          status: 'approved',
          reason: 'Leave',
          organization_id: 'org-1',
          created_at: '2026-01-01T00:00:00Z'
        } as Absence
      ];

      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(result.isAvailable).toBe(false);
      expect(result.status).toBe('home');
      expect(result.source).toBe('absence');
    });

    it('should apply rotation when no manual record exists (Layer 2)', () => {
      mockTeamRotations = [
        {
          id: 'rotation-1',
          team_id: 'team-1',
          start_date: '2026-02-01',
          days_on_base: 11,
          days_at_home: 3,
          cycle_length: 14,
          arrival_time: '10:00',
          departure_time: '14:00',
          organization_id: 'org-1',
          created_at: '2026-01-01T00:00:00Z'
        } as TeamRotation
      ];

      const result = strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(result.source).toBe('rotation');
      expect(['full', 'arrival', 'departure', 'home']).toContain(result.status);
    });
  });

  describe('createAttendanceStrategy (Factory)', () => {
    it('should return LegacyPropagationStrategy for v1_legacy', () => {
      const strategy = createAttendanceStrategy('v1_legacy');
      expect(strategy).toBeInstanceOf(LegacyPropagationStrategy);
    });

    it('should return WriteBasedStrategy for v2_write_based', () => {
      const strategy = createAttendanceStrategy('v2_write_based');
      expect(strategy).toBeInstanceOf(WriteBasedStrategy);
    });

    it('should default to LegacyPropagationStrategy for unknown version', () => {
      // @ts-ignore - Testing fallback behavior
      const strategy = createAttendanceStrategy('unknown');
      expect(strategy).toBeInstanceOf(LegacyPropagationStrategy);
    });
  });

  describe('Strategy Comparison', () => {
    it('should produce consistent results for simple cases', () => {
      const dateKey = mockDate.toLocaleDateString('en-CA');
      mockPerson.dailyAvailability = {
        [dateKey]: {
          status: 'full',
          isAvailable: true,
          source: 'manual',
          startHour: '00:00',
          endHour: '23:59'
        }
      };

      const v1Strategy = new LegacyPropagationStrategy();
      const v2Strategy = new WriteBasedStrategy();

      const v1Result = v1Strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      const v2Result = v2Strategy.getEffectiveAvailability(
        mockPerson,
        mockDate,
        mockTeamRotations,
        mockAbsences,
        mockHourlyBlockages
      );

      expect(v1Result.status).toBe(v2Result.status);
      expect(v1Result.isAvailable).toBe(v2Result.isAvailable);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing dailyAvailability gracefully', () => {
      mockPerson.dailyAvailability = undefined as any;

      const v1Strategy = new LegacyPropagationStrategy();
      const v2Strategy = new WriteBasedStrategy();

      expect(() => {
        v1Strategy.getEffectiveAvailability(
          mockPerson,
          mockDate,
          mockTeamRotations,
          mockAbsences,
          mockHourlyBlockages
        );
      }).not.toThrow();

      expect(() => {
        v2Strategy.getEffectiveAvailability(
          mockPerson,
          mockDate,
          mockTeamRotations,
          mockAbsences,
          mockHourlyBlockages
        );
      }).not.toThrow();
    });

    it('should handle empty arrays for absences and blockages', () => {
      const strategy = createAttendanceStrategy('v1_legacy');

      expect(() => {
        strategy.getEffectiveAvailability(
          mockPerson,
          mockDate,
          [],
          [],
          []
        );
      }).not.toThrow();
    });
  });
});
