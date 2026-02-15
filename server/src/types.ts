
export type UserRole = 'admin' | 'editor' | 'viewer' | 'attendance_only';

export type HomeStatusType =
    | 'leave_shamp'       // חופשה בשמפ
    | 'gimel'             // ג'
    | 'absent'            // נפקד
    | 'organization_days' // ימי התארגנות
    | 'not_in_shamp';     // לא בשמ"פ

export type V2State = 'base' | 'home';

export type V2SubState =
    | 'full_day'
    | 'departure'
    | 'arrival'
    | 'single_day'
    | 'vacation'
    | 'gimel'
    | 'absent'
    | 'org_days'
    | 'not_in_shamp'
    | 'not_defined';

export interface AuthorizedLocation {
    id: string;
    name: string;
    lat: number;
    lng: number;
    radius: number; // in meters
}

export interface AvailabilitySlot {
    isAvailable: boolean;
    startHour?: string; // "08:00"
    endHour?: string;   // "17:00"
    source?: string;
    status?: string; // 'arrival' | 'departure' | 'base' | 'home'
    homeStatusType?: HomeStatusType; // Required when status='home'
    unavailableBlocks?: { id: string; start: string; end: string; reason?: string; type?: string; status?: string }[];
    actual_arrival_at?: string; // NEW: ISO Timestamp of real check-in
    actual_departure_at?: string; // NEW: ISO Timestamp of real check-out
    reported_location_id?: string; // NEW
    reported_location_name?: string; // NEW
    v2_state?: V2State; // V2 Simplified
    v2_sub_state?: V2SubState;      // V2 Simplified
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
