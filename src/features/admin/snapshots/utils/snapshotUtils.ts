import { 
    Clock, 
    Trash, 
    ArrowsClockwise, 
    Pulse, 
    Database,
    Shield,
    Users,
    Package,
    Calendar,
    User
} from '@phosphor-icons/react';

/**
 * Maps database table names to human-readable Hebrew labels
 */
export const getTableLabel = (name: string): string => {
    const labels: Record<string, string> = {
        'people': 'כוח אדם',
        'teams': 'צוותים',
        'roles': 'תפקידים',
        'task_templates': 'משימות',
        'shifts': 'שיבוצים',
        'absences': 'בקשות יציאה',
        'daily_presence': 'נוכחות',
        'unified_presence': 'נוכחות מאוחדת',
        'hourly_blockages': 'חסימות (אילוצים)',
        'equipment': 'ציוד ואמצעים',
        'equipment_daily_checks': 'בדיקות ציוד',
        'permission_templates': 'תבניות הרשאות',
        'organization_settings': 'הגדרות ארגון',
        'team_rotations': 'סבבי צוותים',
        'scheduling_constraints': 'אילוצי שיבוץ',
        'daily_attendance_snapshots': 'דוח נוכחות מחושב',
        'user_load_stats': 'סטטיסטיקת עומס משתמשים',
        'mission_reports': 'דוחות משימה'
    };
    return labels[name] || name;
};

/**
 * Returns the appropriate icon for a snapshot operation type
 */
export const getEventIcon = (type: string) => {
    switch (type) {
        case 'deletion': return Trash;
        case 'create': return Database;
        case 'restore': return ArrowsClockwise;
        case 'delete': return Trash;
        default: return Pulse;
    }
};

/**
 * Extracts a personal ID (M.A.) from a person object, checking multiple possible fields
 */
export const getPersonalId = (item: any): string => {
    if (item.personalId) return item.personalId;
    if (item.personal_id) return item.personal_id;

    // Search custom fields for common Hebrew keys for personal ID (M.A.)
    if (item.customFields) {
        const commonKeys = ['מ.א', 'מ.א.', 'מספר אישי', 'מספר_אישי', 'personal_id', 'personalId', 'ma'];
        for (const key of commonKeys) {
            if (item.customFields[key]) return item.customFields[key];
        }
    }
    return '';
};
// Helper to safely parse dates that might be in different formats
export const safeDate = (val: any) => {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
};

// Helper to get nested or flat properties from snapshot items
export const getProp = (item: any, ...keys: string[]) => {
    for (const key of keys) {
        if (item[key] !== undefined && item[key] !== null) return item[key];
    }
    return undefined;
};
