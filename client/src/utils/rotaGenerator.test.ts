import { describe, it, expect } from 'vitest';
import { generateRoster } from './rotaGenerator';
import { 
  createMockPerson, 
  createMockTeam, 
  createMockRole, 
  createMockOrganizationSettings,
  createMockTeamRotation
} from '../services/testUtils';
import { RosterGenerationParams } from './rotaGenerator';

describe('Rota Generator (generateRoster)', () => {

  it('should respect the fixed ratio (11/3) strategy', () => {
    const role = createMockRole('לוחם');
    const team = createMockTeam('צוות א');
    const people = Array.from({ length: 14 }, (_, i) => createMockPerson(`חייל ${i}`, role.id, team.id));
    const rotation = createMockTeamRotation(team.id, { days_on_base: 11, days_at_home: 3 });
    const settings = createMockOrganizationSettings({ optimization_mode: 'ratio' });

    const params: RosterGenerationParams = {
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-01-28'), // 4 weeks
      people,
      teams: [team],
      teamRotations: [rotation],
      settings,
      constraints: [],
      absences: [],
      hourlyBlockages: []
    };

    const result = generateRoster(params);
    
    // Check if most people follow an 11/3 pattern roughly
    const p1Status = result.roster.filter(r => r.person_id === people[0].id);
    const homeDays = p1Status.filter(r => r.status === 'home').length;
    
    // In 28 days, two cycles of 14 days. Each cycle has 3 home days. Total 6 home days.
    expect(homeDays).toBe(6);
  });

  it('should respect hard constraints (approved absences)', () => {
    const role = createMockRole('לוחם');
    const person = createMockPerson('יוסי', role.id);
    const settings = createMockOrganizationSettings({ min_daily_staff: 0 }); // Allow being home
    
    const params: RosterGenerationParams = {
      startDate: new Date('2026-01-05'), // Monday
      endDate: new Date('2026-01-09'),
      people: [person],
      teams: [],
      teamRotations: [],
      settings,
      constraints: [],
      absences: [{
        id: 'abs-1',
        person_id: person.id,
        organization_id: 'org-1',
        start_date: '2026-01-07', // Wednesday
        end_date: '2026-01-07',
        status: 'approved'
      }],
      hourlyBlockages: []
    };

    const result = generateRoster(params);
    const targetDay = result.roster.find(r => r.date === '2026-01-07' && r.person_id === person.id);
    expect(targetDay?.status).toBe('unavailable');
  });

  it('should apply military Shabbat rules (no Saturday exits)', () => {
    // We create a scenario where a naive 5/2 ratio starting on Monday would lead to a Saturday exit.
    // Monday (Jan 5) -> Friday (Jan 9) = 5 days. 
    // Saturday (Jan 10) = Exit day (Home start).
    const role = createMockRole('לוחם');
    const person = createMockPerson('יוסי', role.id);
    const settings = createMockOrganizationSettings({ optimization_mode: 'ratio' });
    
    // Custom rotation: 5 days base, 2 days home.
    const params: RosterGenerationParams = {
      startDate: new Date('2026-01-05'), // Monday
      endDate: new Date('2026-01-18'),
      people: [person],
      teams: [],
      teamRotations: [],
      settings,
      constraints: [],
      absences: [],
      hourlyBlockages: [],
      customRotation: { daysBase: 5, daysHome: 2 }
    };

    const result = generateRoster(params);
    
    // Friday = Jan 9, Saturday = Jan 10
    const fri = result.roster.find(r => r.date === '2026-01-09' && r.person_id === person.id);
    const sat = result.roster.find(r => r.date === '2026-01-10' && r.person_id === person.id);
    const sun = result.roster.find(r => r.date === '2026-01-11' && r.person_id === person.id);

    // If Shabbat rule works: He should NOT exit on Saturday. 
    // Either he exits on Friday (fri=home) or Sunday (sat=base).
    const satIsBase = sat?.status === 'base';
    const friIsHome = fri?.status === 'home';
    
    expect(satIsBase || friIsHome).toBe(true);
  });

  it('should satisfy minimum staff requirements', () => {
     const role = createMockRole('לוחם');
     // 2 people, min staff 2. If ratio mode was alone, they might alternate. 
     // But min staff should force them both to be base.
     const people = [createMockPerson('א', role.id), createMockPerson('ב', role.id)];
     const settings = createMockOrganizationSettings({ 
         optimization_mode: 'min_staff',
         min_daily_staff: 2 
     });

     const params: RosterGenerationParams = {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-05'),
        people,
        teams: [],
        teamRotations: [],
        settings,
        constraints: [],
        absences: [],
        hourlyBlockages: []
      };

      const result = generateRoster(params);
      
      // All 5 days, both should be base
      const totalBase = result.roster.filter(r => r.status === 'base').length;
      expect(totalBase).toBe(10); // 2 people * 5 days
  });
});
