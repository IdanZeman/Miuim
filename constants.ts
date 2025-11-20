
import { AppState } from './types';

// Helper to generate dates
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

export const MOCK_ROLES = [
  { id: 'r1', name: 'לוחם', color: 'bg-slate-100 text-slate-800' },
  { id: 'r2', name: 'מפקד', color: 'bg-indigo-100 text-indigo-800' },
  { id: 'r3', name: 'חובש', color: 'bg-red-100 text-red-800' },
  { id: 'r4', name: 'נהג', color: 'bg-blue-100 text-blue-800' },
  { id: 'r5', name: 'קלע', color: 'bg-green-100 text-green-800' },
  { id: 'r6', name: 'חמליסט', color: 'bg-purple-100 text-purple-800' },
];

export const MOCK_TEAMS = [
  { id: 'team1', name: 'צוות אלפא', color: 'border-blue-500' },
  { id: 'team2', name: 'צוות בראבו', color: 'border-emerald-500' },
  { id: 'team3', name: 'מפקדה', color: 'border-slate-500' },
];

export const MOCK_PEOPLE = [
  {
    id: 'p1',
    name: 'דניאל כהן',
    teamId: 'team1',
    roleIds: ['r1', 'r5'], // Fighter, Marksman
    maxHoursPerWeek: 40,
    unavailableDates: [],
    preferences: { preferNight: false, avoidWeekends: false },
    color: 'bg-emerald-500',
  },
  {
    id: 'p2',
    name: 'רון לוי',
    teamId: 'team1',
    roleIds: ['r2', 'r4'], // Commander, Driver
    maxHoursPerWeek: 50,
    unavailableDates: [],
    preferences: { preferNight: true, avoidWeekends: false },
    color: 'bg-indigo-500',
  },
  {
    id: 'p3',
    name: 'שירה אברהמי',
    teamId: 'team3',
    roleIds: ['r6', 'r2'], // Ops, Commander
    maxHoursPerWeek: 45,
    unavailableDates: [],
    preferences: { preferNight: false, avoidWeekends: true },
    color: 'bg-rose-500',
  },
  {
    id: 'p4',
    name: 'יוסי מזרחי',
    teamId: 'team2',
    roleIds: ['r4', 'r1'], // Driver, Fighter
    maxHoursPerWeek: 60,
    unavailableDates: [],
    preferences: { preferNight: true, avoidWeekends: false },
    color: 'bg-cyan-500',
  },
  {
    id: 'p5',
    name: 'עומר פרץ',
    teamId: 'team2',
    roleIds: ['r3', 'r1'], // Medic, Fighter
    maxHoursPerWeek: 40,
    unavailableDates: [],
    preferences: { preferNight: false, avoidWeekends: false },
    color: 'bg-amber-500',
  },
];

export const MOCK_TASKS = [
  {
    id: 't1',
    name: 'סיור בט"ש',
    durationHours: 8,
    requiredPeople: 2,
    requiredRoleIds: ['r4'], // Driver required
    minRestHoursBefore: 8,
    difficulty: 2,
    color: 'border-l-blue-500',
    schedulingType: 'continuous' as const // 24/7
  },
  {
    id: 't2',
    name: 'משמרת חמ"ל',
    durationHours: 4,
    requiredPeople: 1,
    requiredRoleIds: ['r6'], // Ops required
    minRestHoursBefore: 8,
    difficulty: 1,
    color: 'border-l-purple-500',
    schedulingType: 'continuous' as const // 24/7
  },
  {
    id: 't3',
    name: 'מארב לילה',
    durationHours: 6,
    requiredPeople: 3,
    requiredRoleIds: ['r3', 'r2'], // Medic and Commander
    minRestHoursBefore: 12,
    difficulty: 5,
    color: 'border-l-slate-800',
    schedulingType: 'one-time' as const, // Ad-hoc
    defaultStartTime: '22:00'
  },
];

export const INITIAL_STATE: AppState = {
  roles: MOCK_ROLES,
  teams: MOCK_TEAMS,
  people: MOCK_PEOPLE,
  taskTemplates: MOCK_TASKS,
  shifts: [],
};