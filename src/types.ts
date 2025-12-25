export type UserRole = 'admin' | 'editor' | 'viewer' | 'attendance_only';



export interface Organization {
  id: string;
  name: string;
  created_at: string;
  invite_token?: string;
  is_invite_link_active?: boolean;
  invite_link_role?: UserRole;
  invite_link_template_id?: string; // Links to permission_templates
}

export interface CustomFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'date' | 'select';
  options?: string[];
}

export interface OrganizationSettings {
  organization_id: string;
  night_shift_start: string; // "HH:MM:SS"
  night_shift_end: string;   // "HH:MM:SS"
  viewer_schedule_days?: number; // Default 2
  default_days_on?: number; // Global default days on base
  default_days_off?: number; // Global default days at home
  rotation_start_date?: string; // ISO Date YYYY-MM-DD
  min_daily_staff?: number; // Minimum people required on base
  optimization_mode?: 'ratio' | 'min_staff' | 'tasks'; // NEW: Default optimization mode
  customFieldsSchema?: CustomFieldDefinition[]; // NEW: Schema for custom fields
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
//   role?: UserRole; // REMOVED
  template_id?: string; // NEW: Link to permission template
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
  source?: string;
  status?: string; // 'arrival' | 'departure' | 'base' | 'home'
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
  dailyAvailability?: Record<string, { isAvailable: boolean; startHour?: string; endHour?: string; source?: string; status?: string }>;
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
  organization_id?: string;

  preferences?: {
    preferNight: boolean;
    avoidWeekends: boolean;
  };
  customFields?: Record<string, any>; // NEW
  isCommander?: boolean; // NEW: Explicitly designates team leadership
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

export type AccessLevel = 'view' | 'edit' | 'none';
export type DataScope = 'organization' | 'team' | 'personal' | 'my_team';

export interface PermissionTemplate {
  id: string;
  name: string;
  organization_id: string;
  permissions: UserPermissions;
  is_default?: boolean; // If multiple templates exist, which one is the default for new users
}

export interface UserPermissions {
  dataScope: DataScope;
  allowedTeamIds?: string[]; // IDs of teams the user can access if scope is 'team'
  screens: Partial<Record<ViewMode, AccessLevel>>; // Per-screen access overrides
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  organization_id: string | null;
  role?: UserRole; // Deprecated but kept for backward compatibility
  permissions?: UserPermissions; // JSONB storage for custom permissions
  is_super_admin?: boolean; // Keeping for now as emergency, but practically deprecated favor of permissions
  permission_template_id?: string; // NEW: Link to assigned template
  terms_accepted_at?: string; // ISO timestamp
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
  allPeople?: Person[]; // Unscoped list for lottery
  people: Person[];
  roles: Role[];
  teams: Team[];
  taskTemplates: TaskTemplate[];
  shifts: Shift[];
  constraints: SchedulingConstraint[];
  teamRotations: TeamRotation[]; // NEW
  settings: OrganizationSettings | null; // NEW
  absences: Absence[]; // NEW
  equipment: Equipment[]; // NEW
}

export type TicketStatus = 'new' | 'in_progress' | 'resolved';

export interface ContactMessage {
  id: string;
  user_id?: string;
  name: string;
  phone?: string;
  email?: string; // New column
  message: string;
  image_url?: string;
  created_at: string;
  status: TicketStatus; // New column
  admin_notes?: string; // New column
  updated_at?: string; // New column
}

export type ViewMode = 'home' | 'dashboard' | 'personnel' | 'attendance' | 'tasks' | 'stats' | 'settings' | 'reports' | 'logs' | 'lottery' | 'contact' | 'constraints' | 'tickets' | 'system' | 'planner' | 'absences' | 'equipment' | 'org-logs' | 'faq';

export interface DailyPresence {
  id?: string; // Optional for new entries
  date: string; // ISO Date YYYY-MM-DD
  person_id: string;
  organization_id: string;
  status: 'home' | 'base' | 'unavailable' | 'leave';
  source: 'algorithm' | 'manual' | 'override';
  created_at?: string;
  updated_at?: string;
  start_time?: string; // HH:MM
  end_time?: string;   // HH:MM
}

export interface Absence {
  id: string;
  person_id: string;
  organization_id: string;
  start_date: string; // ISO Date "YYYY-MM-DD"
  end_date: string;   // ISO Date "YYYY-MM-DD"
  reason?: string;
  created_at?: string;
}

// --- Tzelem (Asset) Tracking ---

export type EquipmentStatus = 'present' | 'missing' | 'damaged' | 'lost';

export interface Equipment {
  id: string;
  organization_id: string;
  type: string; // e.g., "Weapon", "Scope", "NVG"
  serial_number: string; // The "Tz" unique ID
  assigned_to_id: string | null; // Person ID or null
  signed_at: string | null; // ISO Date
  last_verified_at: string | null; // ISO Date
  status: EquipmentStatus;
  notes?: string;
}

export interface EquipmentVerification {
  id: string;
  equipment_id: string;
  verified_by_id: string; // Profile ID
  verified_at: string; // ISO Timestamp
  status: EquipmentStatus;
  notes?: string;
}
