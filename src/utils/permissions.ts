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

import { UserPermissions, ViewMode } from '../types';

export const SYSTEM_ROLE_PRESETS: { 
    id: UserRole | string; 
    name: string; 
    description: string;
    permissions: (defaultPerms: UserPermissions) => UserPermissions;
    colorClass: string;
}[] = [
    {
        id: 'admin',
        name: 'מנהל מלא',
        description: 'גישה מלאה לניהול הארגון והמשתמשים',
        colorClass: 'bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-100',
        permissions: (def) => {
            const p = { 
                ...def, 
                dataScope: 'organization' as const, 
                screens: {} as Record<ViewMode, any>, 
                canApproveRequests: true,
                canManageRotaWizard: true
            };
            ['home', 'dashboard', 'personnel', 'tasks', 'attendance', 'stats', 'constraints', 'lottery', 'equipment', 'logs', 'settings'].forEach(s => p.screens[s as ViewMode] = 'edit');
            return p;
        }
    },
    {
        id: 'editor',
        name: 'עורך תוכן',
        description: 'עריכת שיבוצים ומשימות, ללא גישה להגדרות',
        colorClass: 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100',
        permissions: (def) => {
            const p = { 
                ...def, 
                dataScope: 'organization' as const, 
                screens: {} as Record<ViewMode, any>, 
                canApproveRequests: true,
                canManageRotaWizard: true
            };
            ['home', 'dashboard', 'personnel', 'tasks', 'attendance', 'stats', 'constraints', 'lottery', 'equipment'].forEach(s => p.screens[s as ViewMode] = 'edit');
            p.screens['settings'] = 'none';
            p.screens['logs'] = 'none';
            return p;
        }
    },
    {
        id: 'viewer',
        name: 'צפייה בלבד',
        description: 'צפייה בלוח השיבוצים והנתונים',
        colorClass: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200',
        permissions: (def) => {
            const p = { 
                ...def, 
                dataScope: 'organization' as const, 
                screens: {} as Record<ViewMode, any>, 
                canApproveRequests: false,
                canManageRotaWizard: false
            };
            ['home', 'dashboard', 'stats', 'attendance', 'lottery', 'equipment'].forEach(s => p.screens[s as ViewMode] = 'view');
            ['personnel', 'tasks', 'constraints', 'logs', 'settings'].forEach(s => p.screens[s as ViewMode] = 'none');
            return p;
        }
    },
    {
        id: 'attendance_only',
        name: 'מנהל נוכחות',
        description: 'ניהול נוכחות בלבד',
        colorClass: 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-100',
        permissions: (def) => {
            const p = { 
                ...def, 
                dataScope: 'organization' as const, 
                screens: {} as Record<ViewMode, any>, 
                canApproveRequests: true,
                canManageRotaWizard: false
            };
            Object.keys(def.screens).forEach(k => p.screens[k as ViewMode] = 'none');
            p.screens['attendance'] = 'edit';
            p.screens['dashboard'] = 'view';
            p.screens['home'] = 'view';
            return p;
        }
    }
];
