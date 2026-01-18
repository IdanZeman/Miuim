import { describe, it, expect } from 'vitest';
import { getRotationStatusForDate, getEffectiveAvailability } from './attendanceUtils';
import { TeamRotation, Person, Absence, HourlyBlockage } from '../types';

describe('Attendance Utility (attendanceUtils)', () => {

  describe('getRotationStatusForDate', () => {
    const mockRotation: TeamRotation = {
      id: 'rot-1',
      organization_id: 'org-1',
      team_id: 'team-1',
      days_on_base: 11,
      days_at_home: 3,
      cycle_length: 14,
      start_date: '2026-01-01', // Thursday
      arrival_time: '10:00',
      departure_time: '14:00'
    };

    it('should identify arrival day (day 0)', () => {
      const date = new Date('2026-01-01');
      expect(getRotationStatusForDate(date, mockRotation)).toBe('arrival');
    });

    it('should identify full base days', () => {
      const date = new Date('2026-01-05');
      expect(getRotationStatusForDate(date, mockRotation)).toBe('full');
    });

    it('should identify departure day (day 10)', () => {
      const date = new Date('2026-01-11');
      expect(getRotationStatusForDate(date, mockRotation)).toBe('departure');
    });

    it('should identify home days (day 11-13)', () => {
      const date = new Date('2026-01-12');
      expect(getRotationStatusForDate(date, mockRotation)).toBe('home');
      const dateEnd = new Date('2026-01-14');
      expect(getRotationStatusForDate(dateEnd, mockRotation)).toBe('home');
    });

    it('should start over after cycle length', () => {
      const date = new Date('2026-01-15'); // 14 days after start
      expect(getRotationStatusForDateUnwrapped(date, mockRotation)).toBe('arrival');
    });
  });

  describe('getEffectiveAvailability', () => {
    const mockPerson: Person = {
      id: 'p1',
      name: 'יוסי',
      roleId: 'r1',
      teamId: 't1',
      color: '#000',
      maxShiftsPerWeek: 5,
      isActive: true
    };

    it('should default to full base if no rotations or absences exist', () => {
      const date = new Date('2026-01-10');
      const result = getEffectiveAvailability(mockPerson, date, []);
      expect(result.status).toBe('full');
      expect(result.isAvailable).toBe(true);
    });

    it('should apply team rotation status', () => {
      const rotation: TeamRotation = {
        id: 'rot-1',
        organization_id: 'org-1',
        team_id: 't1',
        days_on_base: 5,
        days_at_home: 2,
        cycle_length: 7,
        start_date: '2026-01-01',
        arrival_time: '10:00',
        departure_time: '14:00'
      };
      
      const homeDate = new Date('2026-01-06'); // Day 5 of cycle
      const result = getEffectiveAvailability(mockPerson, homeDate, [rotation]);
      expect(result.status).toBe('home');
      expect(result.isAvailable).toBe(false);
    });

    it('should prioritize approved absences over rotation', () => {
      const rotation: TeamRotation = {
        id: 'rot-1',
        organization_id: 'org-1',
        team_id: 't1',
        days_on_base: 10,
        days_at_home: 0,
        cycle_length: 10,
        start_date: '2026-01-01',
        arrival_time: '10:00',
        departure_time: '14:00'
      };
      
      const absence: Absence = {
        id: 'abs-1',
        person_id: 'p1',
        organization_id: 'org-1',
        start_date: '2026-01-05',
        end_date: '2026-01-05',
        status: 'approved'
      };

      const date = new Date('2026-01-05');
      const result = getEffectiveAvailability(mockPerson, date, [rotation], [absence]);
      expect(result.status).toBe('home');
      expect(result.isAvailable).toBe(false);
      expect(result.source).toBe('absence');
    });

    it('should handle hourly blockages without marking the whole day as home', () => {
      const blockage: HourlyBlockage = {
        id: 'block-1',
        person_id: 'p1',
        organization_id: 'org-1',
        date: '2026-01-05',
        start_time: '12:00',
        end_time: '14:00',
        reason: 'רופא'
      };

      const date = new Date('2026-01-05');
      const result = getEffectiveAvailability(mockPerson, date, [], [], [blockage]);
      
      expect(result.status).toBe('full');
      expect(result.isAvailable).toBe(true);
      expect(result.unavailableBlocks).toHaveLength(1);
      expect(result.unavailableBlocks[0].start).toBe('12:00');
    });

    it('should honor personal rotation over team rotation', () => {
       const teamRotation: TeamRotation = {
        id: 'rot-team',
        organization_id: 'org-1',
        team_id: 't1',
        days_on_base: 5,
        days_at_home: 2,
        cycle_length: 7,
        start_date: '2026-01-01',
        arrival_time: '10:00',
        departure_time: '14:00'
      };

      const personWithRotation: Person = {
        ...mockPerson,
        personalRotation: {
          isActive: true,
          daysOn: 2,
          daysOff: 10,
          startDate: '2026-01-01'
        }
      };

      const date = new Date('2026-01-04'); // Team says full, Personal says home (Day 3 of 2/10)
      const result = getEffectiveAvailability(personWithRotation, date, [teamRotation]);
      
      // Personal rotation logic in code: "Only apply [Team] if not already marked unavailable by absence"
      // Wait, let's check code order: 1. Absence -> 2. Personal -> 3. Team
      // If personal marked it 'home', is it prioritized? 
      // In the code: result starts as 'full'. 
      // Section 2 (Personal) updates result.
      // Section 3 (Team) updates result ONLY IF rotStatus && result.isAvailable.
      // So if Personal marked it NOT isAvailable, Team will NOT overwrite it. Correct.
      expect(result.status).toBe('home');
      expect(result.isAvailable).toBe(false);
      expect(result.source).toBe('personal_rotation');
    });
  });
});

// Helper to avoid Date desync in tests (Locale vs ISO)
function getRotationStatusForDateUnwrapped(date: Date, rotation: TeamRotation) {
    return getRotationStatusForDate(date, rotation);
}
