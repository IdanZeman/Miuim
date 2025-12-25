import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

// Log Levels (from most verbose to least)
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type LogAction = 
    | 'LOGIN' | 'LOGOUT' | 'SIGNUP'
    | 'CREATE' | 'UPDATE' | 'DELETE'
    | 'ASSIGN' | 'UNASSIGN'
    | 'AUTO_SCHEDULE' | 'CLEAR_DAY'
    | 'VIEW' | 'EXPORT' | 'CLICK' | 'ERROR' | 'SUBMIT';

export type EntityType = 
    | 'person' | 'shift' | 'task' | 'role' | 'team' 
    | 'organization' | 'profile' | 'attendance' | 'button' | 'page' | 'form';

export type EventCategory = 'auth' | 'data' | 'scheduling' | 'settings' | 'system' | 'navigation' | 'ui' | 'security';

interface LogEntry {
    level?: LogLevel;
    action: LogAction;
    entityType?: EntityType;
    entityId?: string;
    entityName?: string;
    oldData?: any;
    newData?: any;
    metadata?: Record<string, any>;
    actionDescription?: string;
    category?: EventCategory;
    component?: string;
    performanceMs?: number;
}

// Log level hierarchy (lower number = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
    'TRACE': 0,
    'DEBUG': 1,
    'INFO': 2,
    'WARN': 3,
    'ERROR': 4,
    'FATAL': 5
};

class LoggingService {
    private organizationId: string | null = null;
    private userId: string | null = null;
    private userEmail: string | null = null;
    private userName: string | null = null;
    private sessionId: string | null = null;
    private minLogLevel: LogLevel = 'INFO';
    private SESSION_STORAGE_KEY = 'miuim_session_id';

    constructor() {
        this.fetchSessionId();
        // Load production log level override if exists (e.g. from local storage for debugging)
        const storedLevel = localStorage.getItem('miuim_log_level');
        if (storedLevel && Object.keys(LOG_LEVELS).includes(storedLevel)) {
            this.minLogLevel = storedLevel as LogLevel;
        } else if (import.meta.env.PROD) {
            // In production, default can still be INFO or WARN
             this.minLogLevel = 'TRACE'; // Updated per user request in task list
        } else {
            this.minLogLevel = 'TRACE';
        }
    }

    private fetchSessionId() {
        if (typeof window === 'undefined') return;

        let sid = sessionStorage.getItem(this.SESSION_STORAGE_KEY);
        if (!sid) {
            sid = uuidv4();
            sessionStorage.setItem(this.SESSION_STORAGE_KEY, sid);
        }
        this.sessionId = sid;
    }

    public setUser(user: any, profile: any) {
        if (user) {
            this.userId = user.id;
            this.userEmail = user.email;
        }
        if (profile) {
            this.organizationId = profile.organization_id;
            this.userName = profile.full_name || profile.name;
        }
    }

    public clearUser() {
        this.userId = null;
        this.userEmail = null;
        this.organizationId = null;
        this.userName = null;
        // Keep session ID
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLogLevel];
    }

    private async persistLog(entry: LogEntry & { level: LogLevel }) {
        // Fire and forget - don't await this in the main thread usually
        // But in async context we can just let it run
        try {
            // Also log to console
            const consoleMsg = `[${entry.category}] ${entry.action}: ${entry.actionDescription || ''}`;
            const consoleData = { ...entry, session: this.sessionId };

            switch (entry.level) {
                case 'TRACE': console.debug(consoleMsg, consoleData); break;
                case 'DEBUG': console.debug(consoleMsg, consoleData); break;
                case 'INFO': console.info(consoleMsg, consoleData); break;
                case 'WARN': console.warn(consoleMsg, consoleData); break;
                case 'ERROR': console.error(consoleMsg, consoleData); break;
                case 'FATAL': console.error(consoleMsg, consoleData); break;
            }

            // In local dev, maybe don't flood DB unless testing
            // if (!import.meta.env.PROD && entry.level !== 'ERROR') return;

             await supabase.from('audit_logs').insert({
                organization_id: this.organizationId,
                user_id: this.userId,
                user_email: this.userEmail,
                user_name: this.userName, // NEW: De-normalized
                session_id: this.sessionId, // NEW
                log_level: entry.level,
                event_type: entry.action, // mapping action -> event_type
                entity_type: entry.entityType,
                entity_id: entry.entityId,
                action_description: entry.actionDescription,
                event_category: entry.category || 'system',
                component_name: entry.component,
                performance_ms: entry.performanceMs,
                before_data: entry.oldData || null,
                after_data: entry.newData || null,
                metadata: entry.metadata || null,
                user_agent: navigator.userAgent
            });

        } catch (error) {
            console.error('Failed to persist log:', error);
        }
    }

    public log(entry: LogEntry) {
        const level = entry.level || 'INFO';
        if (this.shouldLog(level)) {
            this.persistLog({ ...entry, level });
        }
    }

    public info(action: LogAction, description: string, data?: any) {
        this.log({ level: 'INFO', action, actionDescription: description, metadata: data });
    }

    public warn(action: LogAction, description: string, data?: any) {
        this.log({ level: 'WARN', action, actionDescription: description, metadata: data });
    }

    public error(action: LogAction, description: string, error?: any, componentStack?: string) {
        this.log({ 
            level: 'ERROR', 
            action, 
            actionDescription: description, 
            metadata: { 
                error: error?.message || error,
                stack: error?.stack,
                componentStack 
            },
            category: 'system'
        });
    }

    public trace(action: LogAction, description: string, data?: any) {
        this.log({ level: 'TRACE', action, actionDescription: description, metadata: data });
    }

    public debug(action: LogAction, description: string, data?: any) {
        this.log({ level: 'DEBUG', action, actionDescription: description, metadata: data });
    }

    // Convenience methods for specific semantic events
    public logClick(label: string, component: string) {
        this.log({
            level: 'TRACE',
            action: 'CLICK',
            category: 'ui',
            actionDescription: `Clicked ${label}`,
            component,
            entityType: 'button',
            entityId: label
        });
    }

    public logPageView(pageName: string) {
        this.log({
            level: 'INFO',
            action: 'VIEW',
            category: 'navigation',
            actionDescription: `Navigated to ${pageName}`,
            entityType: 'page',
            entityId: pageName
        });
    }
    public setContext(orgId: string | null, userId: string | null, email: string | null, name: string | null) {
        this.organizationId = orgId;
        this.userId = userId;
        this.userEmail = email;
        this.userName = name;
    }

    public logCreate(entityType: EntityType, entityId: string, entityName: string, data?: any) {
        this.log({
            level: 'INFO',
            action: 'CREATE',
            entityType,
            entityId,
            entityName,
            newData: data,
            actionDescription: `Created ${entityType} ${entityName}`
        });
    }

    public logUpdate(entityType: EntityType, entityId: string, entityName: string | undefined, oldData: any, newData: any) {
        this.log({
            level: 'INFO',
            action: 'UPDATE',
            entityType,
            entityId,
            entityName,
            oldData,
            newData,
            actionDescription: `Updated ${entityType} ${entityName || entityId}`
        });
    }

    public logDelete(entityType: EntityType, entityId: string, entityName: string, oldData?: any) {
        this.log({
            level: 'INFO',
            action: 'DELETE',
            entityType,
            entityId,
            entityName,
            oldData,
            actionDescription: `Deleted ${entityType} ${entityName || entityId}`
        });
    }

    public logAssign(shiftId: string, personId: string, personName: string) {
        this.log({
            level: 'INFO',
            action: 'ASSIGN',
            entityType: 'shift',
            entityId: shiftId,
            actionDescription: `Assigned ${personName} to shift`,
            metadata: { personId, personName }
        });
    }

    public logLogin(userId: string) {
        this.log({
            level: 'INFO',
            action: 'LOGIN',
            category: 'auth',
            actionDescription: 'User logged in',
            entityId: userId
        });
    }

    public logLogout() {
        this.log({
            level: 'INFO',
            action: 'LOGOUT',
            category: 'auth',
            actionDescription: 'User logged out'
        });
    }

    public logView(pageName: string) {
        this.logPageView(pageName);
    }

    public logError(action: LogAction, description: string, error?: any) {
        this.error(action, description, error);
    }
}

export const logger = new LoggingService();
