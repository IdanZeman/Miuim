export type UserRole = 'admin' | 'editor' | 'viewer' | 'attendance_only';

// Home status classification for soldiers marked as "home"
export type HomeStatusType = 
  | 'leave_shamp'       // חופשה בשמפ
  | 'gimel'             // ג'
  | 'absent'            // נפקד
  | 'organization_days' // ימי התארגנות
  | 'not_in_shamp';     // לא בשמ"פ

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  invite_token?: string;
  is_invite_link_active?: boolean;
  invite_link_role?: UserRole;
  invite_link_template_id?: string; // Links to permission_templates
  battalion_id?: string | null;
  is_hq?: boolean; // NEW: Marks this organization as the HQ of the battalion
  org_type?: 'company' | 'battalion'; // NEW: Specifies if this is a company or battalion organization
}

export interface Battalion {
  id: string;
  name: string;
  code: string;
  created_at: string;
  morning_report_time?: string; // e.g. "09:00"
}

export type CustomFieldType =
  | 'text'           // Short text input
  | 'textarea'       // Long text input
  | 'number'         // Number input
  | 'boolean'        // Toggle/Checkbox
  | 'select'         // Single choice dropdown
  | 'multiselect'    // Multiple choice
  | 'date'           // Date picker
  | 'phone'          // Phone number
  | 'email';         // Email input

export interface CustomFieldDefinition {
  id: string;                    // Unique identifier
  key: string;                   // Field key for data storage
  label: string;                 // Display label
  type: CustomFieldType;         // Field type
  required?: boolean;            // Is field required
  placeholder?: string;          // Placeholder text
  defaultValue?: any;            // Default value
  options?: string[];            // For select/multiselect
  validation?: {                 // Validation rules
    min?: number;                // Min value/length
    max?: number;                // Max value/length
    pattern?: string;            // Regex pattern
  };
  helpText?: string;             // Help text below field
  order?: number;                // Display order
  created_at?: string;           // Creation timestamp
  updated_at?: string;           // Last update timestamp
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
  home_forecast_days?: number; // Days ahead to show leave forecast (default: 30)
  interPersonConstraints?: InterPersonConstraint[];
  morning_report_time?: string; // e.g. "09:00"
}

export interface InterPersonConstraint {
  id: string;
  fieldA: string; // The key of the custom field for Group A
  valueA: any;    // The value of the custom field for Group A
  fieldB: string; // The key of the custom field for Group B
  valueB: any;    // The value of the custom field for Group B
  type: 'forbidden_together' | 'preferred_together';
  description?: string;
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
  icon?: string; // Icon name from Phosphor
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
  homeStatusType?: HomeStatusType; // Required when status='home'
  unavailableBlocks?: { id: string; start: string; end: string; reason?: string; type?: string; status?: string }[];
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
  dailyAvailability?: Record<string, AvailabilitySlot>;
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
  isCommander?: boolean; // NEW: Commander status for display/filtering
  organization_id?: string;

  preferences?: {
    preferNight: boolean;
    avoidWeekends: boolean;
  };
  customFields?: Record<string, any>; // NEW
  lastManualStatus?: { // NEW: Remember last manually-set status
    status: 'base' | 'home' | 'unavailable';
    homeStatusType?: HomeStatusType;
    date: string; // Last date this was set
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
  icon?: string; // Icon name from Phosphor
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
  metadata?: Record<string, any>; // NEW: Flexible metadata (e.g., commanderId)
}

export type AccessLevel = 'view' | 'edit' | 'none';
export type DataScope = 'organization' | 'team' | 'personal' | 'my_team' | 'battalion';

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
  canApproveRequests?: boolean;
  canManageRotaWizard?: boolean;
  canManageGateAuthorized?: boolean;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  organization_id: string | null;
  battalion_id: string | null;
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
  hourlyBlockages: HourlyBlockage[]; // NEW
  equipment: Equipment[]; // NEW
  equipmentDailyChecks: EquipmentDailyCheck[]; // NEW - Daily check history
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

export type ViewMode = 
    | 'home' 
    | 'dashboard' 
    | 'personnel' 
    | 'stats' 
    | 'settings' 
    | 'attendance' 
    | 'absences' 
    | 'reports' 
    | 'gate' 
    | 'tasks' 
    | 'constraints' 
    | 'system' 
    | 'logs' 
    | 'tickets' 
    | 'faq' 
    | 'contact' 
    | 'org-logs' 
    | 'equipment' 
    | 'lottery' 
    | 'battalion-home' 
    | 'battalion-personnel' 
    | 'battalion-attendance' 
    | 'battalion-settings' 
    | 'admin-analytics'
    | 'admin-center'
    | 'unknown';

export type NavigationAction = 
    | { type: 'edit_person', personId: string }
    | { type: 'filter_schedule', personId: string }
    | { type: 'filter_attendance', personId: string }
    | { type: 'select_tab', tabId: string }
    | null;

export interface DailyPresence {
  id?: string; // Optional for new entries
  date: string; // ISO Date YYYY-MM-DD
  person_id: string;
  organization_id: string;
  status: 'home' | 'base' | 'unavailable' | 'leave';
  homeStatusType?: HomeStatusType; // Required when status='home'
  source: 'algorithm' | 'manual' | 'override';
  created_at?: string;
  updated_at?: string;
  start_time?: string; // HH:MM
  end_time?: string;   // HH:MM
  arrival_date?: string; // ISO string or date
  departure_date?: string; // ISO string or date
}

export interface Absence {
  id: string;
  person_id: string;
  organization_id: string;
  start_date: string; // ISO Date "YYYY-MM-DD"
  end_date: string;   // ISO Date "YYYY-MM-DD"
  start_time?: string; // "HH:MM", defaults to "00:00"
  end_time?: string;   // "HH:MM", defaults to "23:59"
  reason?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'conflict' | 'partially_approved';
  approved_by?: string; // Profile ID
  approved_at?: string; // ISO Date
  created_at?: string;
}

export interface HourlyBlockage {
  id: string;
  person_id: string;
  organization_id: string;
  date: string; // ISO Date "YYYY-MM-DD"
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
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
  created_by?: string; // Profile ID
}


// Daily equipment check record (one per equipment per day)
export interface EquipmentDailyCheck {
  id: string;
  equipment_id: string;
  organization_id: string;
  check_date: string; // ISO Date "YYYY-MM-DD"
  status: EquipmentStatus;
  checked_by: string | null; // Profile ID
  created_at: string; // ISO Timestamp
  updated_at: string; // ISO Timestamp
}

export interface SystemMessage {
  id: string;
  organization_id: string;
  title?: string;
  message: string;
  is_active: boolean;
  created_at: string;
  created_by?: string;
  target_team_ids?: string[];
  target_role_ids?: string[];
  message_type?: 'POPUP' | 'BULLETIN';
}

export interface OngoingNote {
  timestamp: string;
  text: string;
  user_id: string;
  user_name?: string;
}

export interface MissionReport {
  id: string;
  organization_id: string;
  shift_id: string;
  summary?: string;
  exceptional_events?: string;
  points_to_preserve?: string;
  points_to_improve?: string;
  cumulative_info?: string;
  ongoing_log: OngoingNote[];
  submitted_by?: string;
  last_editor_id?: string;
  submitted_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RotaGenerationHistory {
  id: string;
  organization_id: string;
  created_at: string;
  config: {
    startDate: string;
    endDate: string;
    targetTeamIds: string[];
    targetRoleIds: string[];
    selectionMode: 'teams' | 'roles';
    optimizationMode: 'ratio' | 'min_staff' | 'tasks';
    daysBase: number;
    daysHome: number;
    customMinStaff: number;
    userArrivalHour: string;
    userDepartureHour: string;
  };
  roster_data: DailyPresence[];
  manual_overrides?: Record<string, { status: string; startTime?: string; endTime?: string }>;
  created_by?: string;
  creator?: {
    full_name?: string;
    email?: string;
  };
  title?: string;
}

export interface DailyAttendanceSnapshot {
  id: string;
  organization_id: string;
  person_id: string;
  date: string; // ISO Date YYYY-MM-DD
  status: string; // 'home' | 'base' | etc.
  start_time?: string;
  end_time?: string;
  captured_at: string; // ISO Timestamp
  snapshot_definition_time: string; // e.g., "09:00"
}


export interface CarpoolRide {
  id: string;
  organization_id: string;
  creator_id: string; // The person ID driving/requesting (usually the driver)
  driver_name: string; // Denormalized for display
  driver_phone: string; // Denormalized for display/contact
  type: 'offer' | 'request'; // Mostly 'offer' for now
  direction: 'to_base' | 'to_home';
  date: string; // ISO date string YYYY-MM-DD
  time: string; // HH:MM
  location: string; // Pickup/Dropoff location
  seats: number;
  notes?: string;
  created_at: string;
  is_full?: boolean;
}
