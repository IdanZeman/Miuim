export type UserRole = 'admin' | 'editor' | 'viewer' | 'attendance_only';



export interface Organization {
  id: string;
  name: string;
  created_at: string;
  invite_token?: string;
  is_invite_link_active?: boolean;
  invite_link_role?: UserRole;
}

export interface OrganizationSettings {
  organization_id: string;
  night_shift_start: string; // "HH:MM:SS"
  night_shift_end: string;   // "HH:MM:SS"
  viewer_schedule_days?: number; // Default 2
  rotation_cycle_days?: number; // Global default cycle length (optional)
}


export interface TeamRotation {
  id: string;
  organization_id: string;
  team_id: string;
  days_on_base: number;
  days_at_home: number;
  cycle_length: number; // days_on_base + days_at_home
  start_date: string; // ISO Date "YYYY-MM-DD" - The anchor date for the cycle
  end_date?: string; // ISO Date "YYYY-MM-DD" - Optional end of cycle entitlement
  arrival_time: string; // "HH:MM" e.g "10:00"
  departure_time: string; // "HH:MM" e.g "14:00"
}    

export interface OrganizationInvite {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted: boolean;
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
  roleId: string;
  teamId?: string;
  userId?: string;
  color: string;
  maxShiftsPerWeek: number;
  dailyAvailability?: Record<string, { isAvailable: boolean; startHour?: string; endHour?: string; source?: string }>;
  personalRotation?: {
    isActive: boolean;
    daysOn: number;
    daysOff: number;
    startDate: string;
  };
  roleIds?: string[]; // For multi-role support
  email?: string;
  phone?: string; // NEW: Phone number
  isActive?: boolean; // NEW: Active status (default true)
  unavailableDates?: string[];
  preferences?: {
    preferNight: boolean;
    avoidWeekends: boolean;
  };
}

export type SchedulingType = 'continuous' | 'one-time';

export type FrequencyType = 'daily' | 'weekly' | 'specific_date';

export interface SchedulingSegment {
  id: string;
  taskId: string;
  name: string; // e.g., "Morning Shift"
  startTime: string; // "HH:MM"
  durationHours: number;
  frequency: FrequencyType;
  daysOfWeek?: string[]; // ["sunday", "monday", ...]
  specificDate?: string; // ISO "YYYY-MM-DD"
  requiredPeople: number;
  roleComposition: { roleId: string; count: number }[];
  minRestHoursAfter: number;
  isRepeat: boolean; // Continuous cycle if true
}

export interface TaskTemplate {
  id: string;
  name: string;
  segments: SchedulingSegment[]; // NEW: List of segments
  difficulty: number; // 1-5
  color: string;
  startDate?: string; // Valid from
  endDate?: string; // Valid until
  organization_id?: string;
  is247?: boolean; // Legacy flag, might be relevant for default filling
  assignedTeamId?: string; // NEW: Limit task to specific team
}

export interface Shift {
  id: string;
  taskId: string;
  segmentId?: string; // NEW: Link to the specific segment
  startTime: string; // ISO string
  endTime: string; // ISO string
  assignedPersonIds: string[];
  isLocked: boolean;
  organization_id?: string;
  isCancelled?: boolean;
  requirements?: { // SNAPSHOT of requirements at generation
    requiredPeople: number;
    roleComposition: { roleId: string; count: number }[];
    minRest: number;
  };
}

export type ViewMode = 'home' | 'dashboard' | 'personnel' | 'attendance' | 'tasks' | 'stats' | 'settings' | 'reports' | 'logs' | 'lottery' | 'contact' | 'constraints';

export type AccessLevel = 'view' | 'edit' | 'none';
export type DataScope = 'organization' | 'team' | 'personal';

export interface UserPermissions {
  dataScope: DataScope;
  allowedTeamIds?: string[]; // IDs of teams the user can access if scope is 'team'
  screens: Partial<Record<ViewMode, AccessLevel>>; // Per-screen access overrides
  canManageUsers: boolean; // Permission to add/edit/delete users overrides
  canManageSettings: boolean; // Permission to access Organization Settings
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  organization_id: string | null;
  role: UserRole;
  permissions?: UserPermissions; // JSONB storage for custom permissions
}

export type ConstraintType = 'always_assign' | 'never_assign' | 'time_block';

export interface SchedulingConstraint {
  id: string;
  personId?: string; // Optional if teamId or roleId is provided
  teamId?: string;   // NEW: Constraint applies to entire team
  roleId?: string;   // NEW: Constraint applies to entire role
  type: ConstraintType;
  taskId?: string;
  startTime?: string; // ISO string
  endTime?: string; // ISO string
  organization_id: string;
  description?: string; // Optional note
}

export interface AppState {
  people: Person[];
  roles: Role[];
  teams: Team[];
  taskTemplates: TaskTemplate[];
  shifts: Shift[];
  constraints: SchedulingConstraint[];
  teamRotations: TeamRotation[]; // NEW
}
