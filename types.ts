export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  organization_id: string | null;
  role: string;
}

export interface Role {
  id: string;
  name: string;
  color: string;
  icon?: string; // Icon name from Lucide
  organization_id?: string;
}

export interface Team {
  id: string;
  name: string;
  color: string; // CSS class for border/bg
  organization_id?: string;
}

export interface AvailabilitySlot {
  isAvailable: boolean;
  startHour?: string; // "08:00"
  endHour?: string;   // "17:00"
}

export interface DailyAvailability {
  [dateIso: string]: AvailabilitySlot; // Key is "YYYY-MM-DD"
}

export interface Person {
  id: string;
  name: string;
  teamId: string; // Reference to Team
  roleIds: string[]; // Array of Role IDs
  maxHoursPerWeek: number;
  unavailableDates: string[]; // ISO date strings
  preferences: {
    preferNight: boolean;
    avoidWeekends: boolean;
  };
  color: string; // Avatar color
  dailyAvailability?: DailyAvailability; // New field
  organization_id?: string;
}

export type SchedulingType = 'continuous' | 'one-time';

export interface TaskTemplate {
  id: string;
  name: string;
  durationHours: number;
  requiredPeople: number;
  requiredRoleIds: string[]; // Role IDs required
  minRestHoursBefore: number;
  difficulty: number; // 1-5
  color: string;
  schedulingType: SchedulingType;
  defaultStartTime?: string; // "HH:MM"
  specificDate?: string; // "YYYY-MM-DD"
  organization_id?: string;
}

export interface Shift {
  id: string;
  taskId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  assignedPersonIds: string[];
  isLocked: boolean;
  organization_id?: string;
}

export interface AppState {
  people: Person[];
  roles: Role[];
  teams: Team[];
  taskTemplates: TaskTemplate[];
  shifts: Shift[];
}

export type ViewMode = 'dashboard' | 'personnel' | 'tasks' | 'schedule' | 'stats' | 'attendance';
