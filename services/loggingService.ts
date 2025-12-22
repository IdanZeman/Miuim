import { supabase } from './supabaseClient';

// Log Levels (from most verbose to least)
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type LogAction = 
    | 'LOGIN' | 'LOGOUT' | 'SIGNUP'
    | 'CREATE' | 'UPDATE' | 'DELETE'
    | 'ASSIGN' | 'UNASSIGN'
    | 'AUTO_SCHEDULE' | 'CLEAR_DAY'
    | 'VIEW' | 'EXPORT' | 'CLICK' | 'ERROR';

export type EntityType = 
    | 'person' | 'shift' | 'task' | 'role' | 'team' 
    | 'organization' | 'profile' | 'attendance' | 'button' | 'page';

export type EventCategory = 'auth' | 'data' | 'scheduling' | 'settings' | 'system' | 'navigation' | 'ui' | 'security';

interface LogEntry {
    level?: LogLevel;  // NEW: Log level
    action: LogAction;
    entityType?: EntityType;
    entityId?: string;
    entityName?: string;
    oldData?: any;
    newData?: any;
    metadata?: Record<string, any>;
    actionDescription?: string; // NEW: Human readable description
    category?: EventCategory;
    component?: string;  // NEW: Component name
    performanceMs?: number;  // NEW: Performance tracking
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
    private minLevel: LogLevel = 'INFO';  // Default minimum level

    constructor() {
        // Set log level based on environment
        this.initializeLogLevel();
    }

    private initializeLogLevel() {
        // Check localStorage override first
        const storedLevel = localStorage.getItem('miuim_log_level') as LogLevel;
        if (storedLevel && LOG_LEVELS[storedLevel] !== undefined) {
            this.minLevel = storedLevel;
            console.log(`📝 Log level set to: ${storedLevel} (from localStorage)`);
            return;
        }

        // Environment-based defaults
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            this.minLevel = 'DEBUG';  // Development
            console.log('📝 Log level set to: DEBUG (development mode)');
        } else {
            this.minLevel = 'INFO';  // Production
            console.log('📝 Log level set to: INFO (production mode)');
        }
    }

    /**
     * Check if a log should be recorded based on its level
     */
    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    }

    /**
     * Set minimum log level (can be called by admin UI)
     */
    setLogLevel(level: LogLevel) {
        this.minLevel = level;
        localStorage.setItem('miuim_log_level', level);
        console.log(`📝 Log level changed to: ${level}`);
    }

    setContext(orgId: string | null, userId: string | null, email: string | null, name?: string | null) {
        this.organizationId = orgId;
        this.userId = userId;
        this.userEmail = email;
        this.userName = name;
    }

    async log(entry: LogEntry) {
        const level = entry.level || this.getDefaultLevel(entry.action);
        
        // Check if we should log this level
        if (!this.shouldLog(level)) {
            return;  // Skip logging
        }

        try {
            const { error } = await supabase.from('audit_logs').insert({
                organization_id: this.organizationId,
                user_id: this.userId,
                user_email: this.userEmail,
                user_name: this.userName,
                log_level: level,  // NEW
                event_type: entry.action,
                event_category: entry.category || this.getCategoryFromAction(entry.action),
                action_description: this.getDescription(entry),
                entity_type: entry.entityType,
                entity_id: entry.entityId,
                entity_name: entry.entityName,
                before_data: entry.oldData || null,
                after_data: entry.newData || null,
                component_name: entry.component,  // NEW
                performance_ms: entry.performanceMs,  // NEW
                user_agent: navigator.userAgent,
                ip_address: null,
                session_id: null,
                created_at: new Date().toISOString()
            });

            if (error) {
                console.error('Failed to log action:', error);
            }

            // Also log to console in development
            if (this.minLevel === 'DEBUG' || this.minLevel === 'TRACE') {
                this.consoleLog(level, entry);
            }
        } catch (err) {
            console.error('Logging service error:', err);
        }
    }

    /**
     * Log to console with color coding
     */
    private consoleLog(level: LogLevel, entry: LogEntry) {
        const colors = {
            'TRACE': 'color: gray',
            'DEBUG': 'color: blue',
            'INFO': 'color: green',
            'WARN': 'color: orange',
            'ERROR': 'color: red',
            'FATAL': 'color: darkred; font-weight: bold'
        };

        console.log(
            `%c[${level}] ${entry.action}${entry.component ? ` (${entry.component})` : ''}`,
            colors[level],
            entry
        );
    }

    /**
     * Get default log level for an action
     */
    private getDefaultLevel(action: LogAction): LogLevel {
        switch (action) {
            case 'VIEW':
            case 'CLICK':
                return 'TRACE';  // Very verbose
            case 'LOGIN':
            case 'LOGOUT':
            case 'CREATE':
            case 'UPDATE':
            case 'DELETE':
                return 'INFO';  // Important events
            case 'ERROR':
                return 'ERROR';  // Errors
            default:
                return 'DEBUG';  // Everything else
        }
    }

    private getCategoryFromAction(action: LogAction): EventCategory {
        switch (action) {
            case 'LOGIN':
            case 'LOGOUT':
            case 'SIGNUP':
                return 'auth';
            case 'AUTO_SCHEDULE':
            case 'CLEAR_DAY':
            case 'ASSIGN':
            case 'UNASSIGN':
                return 'scheduling';
            case 'CREATE':
            case 'UPDATE':
            case 'DELETE':
                return 'data';
            case 'VIEW':
                return 'navigation';
            case 'CLICK':
                return 'ui';
            default:
                return 'system';
        }
    }

    private getDescription(entry: LogEntry): string {
        const entityName = entry.entityName || entry.entityType || 'פריט';
        switch (entry.action) {
            case 'CREATE': return `נוצר ${entityName} חדש`;
            case 'UPDATE': return `עודכן ${entityName}`;
            case 'DELETE': return `נמחק ${entityName}`;
            case 'ASSIGN': return `שובץ אדם למשמרת`;
            case 'UNASSIGN': return `הוסר אדם ממשמרת`;
            case 'AUTO_SCHEDULE': return `בוצע שיבוץ אוטומטי`;
            case 'CLEAR_DAY': return `נוקה יום`;
            case 'LOGIN': return `התחבר למערכת`;
            case 'LOGOUT': return `התנתק מהמערכת`;
            case 'VIEW': return `צפה בעמוד ${entityName}`;
            case 'CLICK': return `לחץ על ${entityName}`;
            case 'ERROR': return `שגיאת מערכת: ${entry.metadata?.message || 'שגיאה לא ידועה'}`;
            default: return entry.action;
        }
    }

    // Convenience methods
    async logCreate(entityType: EntityType, entityId: string, entityName: string, data: any) {
        await this.log({
            action: 'CREATE',
            entityType,
            entityId,
            entityName,
            newData: data,
            category: 'data'
        });
    }

    async logUpdate(entityType: EntityType, entityId: string, entityName: string, oldData: any, newData: any) {
        await this.log({
            action: 'UPDATE',
            entityType,
            entityId,
            entityName,
            oldData,
            newData,
            category: 'data'
        });
    }

    async logDelete(entityType: EntityType, entityId: string, entityName: string, data: any) {
        await this.log({
            action: 'DELETE',
            entityType,
            entityId,
            entityName,
            oldData: data,
            category: 'data'
        });
    }

    async logAssign(shiftId: string, personId: string, personName: string) {
        await this.log({
            action: 'ASSIGN',
            entityType: 'shift',
            entityId: shiftId,
            entityName: personName,
            newData: { personId, personName },
            category: 'scheduling'
        });
    }

    async logAutoSchedule(daysCount: number, shiftsCount: number, mode: 'single' | 'range') {
        await this.log({
            action: 'AUTO_SCHEDULE',
            entityType: 'shift',
            newData: { daysCount, shiftsCount, mode },
            category: 'scheduling'
        });
    }

    async logLogin() {
        await this.log({
            action: 'LOGIN',
            category: 'auth'
        });
    }

    async logLogout() {
        await this.log({
            action: 'LOGOUT',
            category: 'auth'
        });
    }

    async logView(viewName: string) {
        await this.log({
            action: 'VIEW',
            entityType: 'page', // Using 'page' as a generic entity type for views
            entityName: viewName,
            category: 'navigation'
        });
    }

    async logClick(buttonName: string, location?: string) {
        await this.log({
            action: 'CLICK',
            entityType: 'button', // Using 'button' as a generic entity type
            entityName: buttonName,
            metadata: { location },
            category: 'ui'
        });
    }

    async logError(error: Error, componentStack?: string) {
        await this.log({
            action: 'ERROR',
            category: 'system',
            metadata: {
                message: error.message,
                stack: error.stack,
                componentStack,
                url: window.location.href
            }
        });
    }
}

export const logger = new LoggingService();
