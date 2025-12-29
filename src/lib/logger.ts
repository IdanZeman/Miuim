import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

// Log Levels (from most verbose to least)
export type LogLevel = 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export type LogAction = 
    | 'LOGIN' | 'LOGOUT' | 'SIGNUP'
    | 'CREATE' | 'UPDATE' | 'DELETE'
    | 'ASSIGN' | 'UNASSIGN'
    | 'AUTO_SCHEDULE' | 'CLEAR_DAY'
    | 'VIEW' | 'EXPORT' | 'CLICK' | 'ERROR' | 'SUBMIT'
    | 'IMPORT_DATA' | 'APP_LAUNCH'
    | 'GENERATE' | 'SAVE' | 'SYNC' | 'CHECK_IN' | 'AUTH';

export type EntityType = 
    | 'person' | 'shift' | 'task' | 'role' | 'team' 
    | 'organization' | 'profile' | 'attendance' | 'button' | 'page' | 'form'
    | 'absence' | 'rotation' | 'equipment';

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
    private isSuperAdmin: boolean = false;
    private SESSION_STORAGE_KEY = 'miuim_session_id';
    private geoFetchPromise: Promise<void> | null = null;

    constructor() {
        this.fetchSessionId();
        // Load production log level override if exists (e.g. from local storage for debugging)
        const storedLevel = localStorage.getItem('miuim_log_level');
        if (storedLevel && Object.keys(LOG_LEVELS).includes(storedLevel)) {
            this.minLogLevel = storedLevel as LogLevel;
        } else {
            // Default to TRACE (Highest Level) as per user request to capture all data
            this.minLogLevel = 'TRACE'; 
        }

        // Start fetching geo data immediately
        this.ensureGeoData();
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
            this.isSuperAdmin = !!profile.is_super_admin;
        }
    }

    public clearUser() {
        this.userId = null;
        this.userEmail = null;
        this.organizationId = null;
        this.userName = null;
        this.isSuperAdmin = false;
        // Keep session ID
    }

    private shouldLog(level: LogLevel): boolean {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLogLevel];
    }

    private async persistLog(entry: LogEntry & { level: LogLevel }) {
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

            // Ensure GeoData is loaded for first logs
            if (!this.geoData && this.geoFetchPromise) {
                await this.geoFetchPromise;
            }

            // Skip persistence for Super Admins

            // Skip persistence for Super Admins
            if (this.isSuperAdmin) return;

            // Skip persistence for unauthenticated users (prevents 401 on landing page)
            if (!this.userId) return;

            const metadata = { ...entry.metadata };
            if (this.geoData) {
                metadata.ip = metadata.ip || this.geoData.ip;
                metadata.city = metadata.city || this.geoData.city;
                metadata.country = metadata.country || this.geoData.country_name;
            }

            // Ensure we strictly follow DB Schema to avoid 400 errors
            // Add extra fields to metadata instead of top-level
            metadata.url = window.location.href;
            metadata.user_agent = navigator.userAgent;
            metadata.client_timestamp = new Date().toISOString();
            metadata.entity_name = entry.entityName;

            await supabase.from('audit_logs').insert({
                organization_id: this.organizationId,
                user_id: this.userId,
                user_email: this.userEmail,
                user_name: this.userName,
                session_id: this.sessionId,
                log_level: entry.level,
                event_type: entry.action,
                entity_type: entry.entityType,
                entity_id: entry.entityId,
                // entity_name: entry.entityName, // REMOVED - not in DB
                action_description: entry.actionDescription,
                event_category: entry.category || 'system',
                component_name: entry.component,
                performance_ms: entry.performanceMs,
                before_data: entry.oldData || null,
                after_data: entry.newData || null,
                metadata: metadata || null,
                user_agent: navigator.userAgent // Verified acts as text in some schemas, keeping if sure, else move to meta
                // url and client_timestamp REMOVED from top level
            });

        } catch (error) {
            console.error('❌ Failed to persist log:', error);
            if ((error as any)?.message) console.error('Error Message:', (error as any).message);
            if ((error as any)?.details) console.error('Error Details:', (error as any).details);
            if ((error as any)?.hint) console.error('Error Hint:', (error as any).hint);
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
        
        // Auto-fetch geo once per session
        this.ensureGeoData();
    }

    private geoData: any = null;
    private GEO_CACHE_KEY = 'miuim_geo_cache';

    private async ensureGeoData() {
        if (this.geoData || typeof window === 'undefined') return;
        if (this.geoFetchPromise) return this.geoFetchPromise;

        this.geoFetchPromise = (async () => {
            // 1. Try Cache First
            const cached = localStorage.getItem(this.GEO_CACHE_KEY);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    const age = Date.now() - (parsed.timestamp || 0);
                    if (age < 1000 * 60 * 60 * 24) { // 24h cache
                        this.geoData = parsed.data;
                        this.geoFetchPromise = null;
                        return;
                    }
                } catch (e) {
                    localStorage.removeItem(this.GEO_CACHE_KEY);
                }
            }

            // 2. Fetch with Failover Strategy (Chain)
            try {
                // Try 1: db-ip.com
                try {
                    const res = await fetch('https://api.db-ip.com/v2/free/self');
                    if (res.ok) {
                        const data = await res.json();
                        this.geoData = { ip: data.ipAddress, city: data.city, country_name: data.countryName };
                        console.log('✅ Geo: Fetched from db-ip', this.geoData);
                    } else throw new Error(res.statusText);
                } catch (e1) {
                    console.warn('⚠️ Geo: db-ip failed, trying ipwho.is...', e1);
                    // Try 2: ipwho.is
                    try {
                        const res = await fetch('https://ipwho.is/');
                        if (res.ok) {
                            const data = await res.json();
                            this.geoData = { ip: data.ip, city: data.city, country_name: data.country };
                            console.log('✅ Geo: Fetched from ipwho.is', this.geoData);
                        } else throw new Error(res.statusText);
                    } catch (e2) {
                        console.warn('⚠️ Geo: ipwho.is failed, trying ipapi.co...', e2);
                        // Try 3: ipapi.co
                        try {
                            const res = await fetch('https://ipapi.co/json/');
                            if (res.ok) {
                                const data = await res.json();
                                this.geoData = data;
                                console.log('✅ Geo: Fetched from ipapi.co', this.geoData);
                            } else throw new Error(res.statusText);
                        } catch (e3) {
                            console.warn('⚠️ Geo: ipapi.co failed, trying ipinfo.io...', e3);
                             // Try 4: ipinfo.io
                            try {
                                const res = await fetch('https://ipinfo.io/json');
                                if (res.ok) {
                                    const data = await res.json();
                                    this.geoData = {
                                        ip: data.ip,
                                        city: data.city,
                                        country_name: data.country // ipinfo returns code mostly, but sometimes name
                                    };
                                    console.log('✅ Geo: Fetched from ipinfo.io', this.geoData);
                                } else throw new Error(res.statusText);
                            } catch (e4) {
                                console.error('❌ Geo: All providers failed.', e4);
                            }
                        }
                    }
                }
            } catch (fatal) {
                 console.error('❌ Geo: Fatal error in fetch chain', fatal);
            }

            if (this.geoData) {
                localStorage.setItem(this.GEO_CACHE_KEY, JSON.stringify({
                    data: this.geoData,
                    timestamp: Date.now()
                }));
                console.info('Fetched and cached Geo Data', this.geoData.ip);
            }

            this.geoFetchPromise = null;
        })();

        return this.geoFetchPromise;
    }

    private getDeviceType(): string {
        const ua = navigator.userAgent;
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return "Tablet";
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) return "Mobile";
        return "Desktop";
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

    public logUnassign(shiftId: string, personId: string, personName: string) {
        this.log({
            level: 'INFO',
            action: 'UNASSIGN',
            entityType: 'shift',
            entityId: shiftId,
            actionDescription: `Unassigned ${personName} from shift`,
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
