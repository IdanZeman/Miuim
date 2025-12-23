import { UserRole } from '../types';

// Permission check utilities for role-based access control

export const canManageOrganization = (role: UserRole): boolean => {
    return role === 'admin';
};

export const canEditSchedule = (role: UserRole): boolean => {
    return role === 'admin' || role === 'editor';
};

export const canEditPersonnel = (role: UserRole): boolean => {
    return role === 'admin' || role === 'editor';
};

export const canEditTasks = (role: UserRole): boolean => {
    return role === 'admin' || role === 'editor';
};

export const canViewStats = (role: UserRole): boolean => {
    return role === 'admin' || role === 'editor' || role === 'viewer';
};

export const canMarkAttendance = (role: UserRole): boolean => {
    return true; // All roles can mark attendance
};

export const canViewSchedule = (role: UserRole): boolean => {
    return true; // All roles can view schedule
};

export const isReadOnly = (role: UserRole): boolean => {
    return role === 'viewer' || role === 'attendance_only';
};

export const getRoleDisplayName = (role: UserRole): string => {
    const roleNames: Record<UserRole, string> = {
        admin: 'מנהל',
        editor: 'עורך',
        viewer: 'צופה',
        attendance_only: 'נוכחות בלבד'
    };
    return roleNames[role];
};

export const getRoleDescription = (role: UserRole): string => {
    const descriptions: Record<UserRole, string> = {
        admin: 'גישה מלאה - ניהול ארגון, משתמשים והרשאות',
        editor: 'עריכת שיבוצים, משימות וכוח אדם',
        viewer: 'צפייה בלבד בכל המידע',
        attendance_only: 'סימון נוכחות וצפייה בשיבוץ אישי'
    };
    return descriptions[role];
};

export const canAccessScreen = (role: UserRole, screen: string): boolean => {
    if (role === 'admin') return true;
    if (role === 'editor') return screen !== 'settings' && screen !== 'logs' && screen !== 'system';
    if (role === 'viewer') return ['home', 'dashboard', 'stats', 'contact'].includes(screen);
    if (role === 'attendance_only') return ['home', 'attendance', 'contact'].includes(screen);
    return false;
};
