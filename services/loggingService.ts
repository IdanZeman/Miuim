import { supabase } from './supabaseClient';

export type LogAction = 
    | 'LOGIN' | 'LOGOUT' | 'SIGNUP'
    | 'CREATE' | 'UPDATE' | 'DELETE'
    | 'ASSIGN' | 'UNASSIGN'
    | 'AUTO_SCHEDULE' | 'CLEAR_DAY'
    | 'VIEW' | 'EXPORT';

export type EntityType = 
    | 'person' | 'shift' | 'task' | 'role' | 'team' 
    | 'organization' | 'profile' | 'attendance';

export type EventCategory = 'auth' | 'data' | 'scheduling' | 'settings' | 'system';

interface LogEntry {
    action: LogAction;
    entityType?: EntityType;
    entityId?: string;
    entityName?: string;
    oldData?: any;
    newData?: any;
    metadata?: Record<string, any>;
    category?: EventCategory;
}

class LoggingService {
    private organizationId: string | null = null;
    private userId: string | null = null;
    private userEmail: string | null = null;
    private userName: string | null = null;

    setContext(orgId: string | null, userId: string | null, email: string | null, name?: string | null) {
        this.organizationId = orgId;
        this.userId = userId;
        this.userEmail = email;
        this.userName = name;
    }

    async log(entry: LogEntry) {
        try {
            const { error } = await supabase.from('audit_logs').insert({
                organization_id: this.organizationId,
                user_id: this.userId,
                user_email: this.userEmail,
                user_name: this.userName,
                event_type: entry.action,
                event_category: entry.category || this.getCategoryFromAction(entry.action),
                action_description: this.getDescription(entry),
                entity_type: entry.entityType,
                entity_id: entry.entityId,
                entity_name: entry.entityName,
                before_data: entry.oldData || null,
                after_data: entry.newData || null,
                user_agent: navigator.userAgent,
                ip_address: null, // Will be filled by DB trigger if needed
                session_id: null, // Can be added if you track sessions
                created_at: new Date().toISOString()
            });

            if (error) {
                console.error('Failed to log action:', error);
            }
        } catch (err) {
            console.error('Logging service error:', err);
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
}

export const logger = new LoggingService();
