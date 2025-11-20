
export interface Role {
  id: string;
  name: string;
  color: string;
  icon?: string; // Icon name from Lucide
}

export interface Team {
  id: string;
  name: string;
  color: string; // CSS class for border/bg
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
}

export interface Shift {
  id: string;
  taskId: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  assignedPersonIds: string[];
  isLocked: boolean;
}

export interface AppState {
  people: Person[];
  roles: Role[];
  teams: Team[];
  taskTemplates: TaskTemplate[];
  shifts: Shift[];
}

export type ViewMode = 'dashboard' | 'personnel' | 'tasks' | 'schedule' | 'stats' | 'attendance';
