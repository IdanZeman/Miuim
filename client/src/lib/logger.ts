import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';
import { formatIsraelDate } from '../utils/dateUtils';
import * as Sentry from "@sentry/react";

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
    before_data?: any;
    after_data?: any;
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
    private organizationName: string | null = null;
    private userId: string | null = null;
    private userEmail: string | null = null;
    private userName: string | null = null;
    private sessionId: string | null = null;
    private minLogLevel: LogLevel = 'INFO';
    private isSuperAdmin: boolean = false;
    private SESSION_STORAGE_KEY = 'miuim_session_id';
    private geoFetchPromise: Promise<void> | null = null;
    private geoData: any = null;
    private GEO_CACHE_KEY = 'miuim_geo_cache';

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

        // Add listener for page unload to flush pending logs
        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', () => {
                this.flush();
            });
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

    public setUser(user: any, profile: any, organizationName?: string) {
        if (user) {
            this.userId = user.id;
            this.userEmail = user.email;
        }
        if (profile) {
            this.organizationId = profile.organization_id;
            this.userName = profile.full_name || profile.name;
            this.isSuperAdmin = !!profile.is_super_admin;
        }
        if (organizationName) {
            this.organizationName = organizationName;
        }

        // Update Sentry Context
        if (user) {
            Sentry.setUser({
                id: user.id,
                email: user.email,
                username: profile?.full_name || profile?.name,
                organization_id: profile?.organization_id
            });
        } else {
            Sentry.setUser(null);
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

    private queue: any[] = [];
    private flushTimer: any = null;
    private FLUSH_INTERVAL = 2000; // 2 seconds
    private MAX_BATCH_SIZE = 50;

    private async persistLog(entry: LogEntry & { level: LogLevel }) {
        try {
            // Also log to console
            const category = entry.category || 'general';
            const consoleMsg = `[${category}] ${entry.action}: ${entry.actionDescription || ''}`;
            const consoleData = { ...entry, session: this.sessionId, category };

            switch (entry.level) {
                case 'TRACE': console.debug(consoleMsg, consoleData); break;
                case 'DEBUG': console.debug(consoleMsg, consoleData); break;
                case 'INFO': console.info(consoleMsg, consoleData); break;
                case 'WARN': console.warn(consoleMsg, consoleData); break;
                case 'ERROR':
                    console.error(consoleMsg, consoleData);
                    Sentry.captureMessage(consoleMsg, {
                        level: 'error',
                        extra: consoleData,
                        tags: { category: entry.category, action: entry.action }
                    });
                    break;
                case 'FATAL':
                    console.error(consoleMsg, consoleData);
                    Sentry.captureMessage(consoleMsg, {
                        level: 'fatal',
                        extra: consoleData,
                        tags: { category: entry.category, action: entry.action }
                    });
                    break;
            }

            // Skip persistence for unauthenticated users
            if (!this.userId) return;

            const metadata = { ...entry.metadata };
            if (this.geoData) {
                metadata.ip = metadata.ip || this.geoData.ip;
                metadata.city = metadata.city || this.geoData.city;
                metadata.country = metadata.country || this.geoData.country_name;
                metadata.latitude = metadata.latitude || this.geoData.latitude;
                metadata.longitude = metadata.longitude || this.geoData.longitude;
            }

            metadata.url = window.location.href;
            metadata.user_agent = navigator.userAgent;
            metadata.client_timestamp = new Date().toISOString();
            metadata.entity_name = entry.entityName;
            metadata.device_type = this.getDeviceType();
            if (this.organizationName) {
                metadata.organization_name = this.organizationName;
            }

            const eventPayload = {
                event_type: entry.action,
                event_category: entry.category || 'system',
                action_description: entry.actionDescription || entry.action || 'No description provided',
                entity_type: entry.entityType,
                entity_id: entry.entityId,
                entity_name: entry.entityName,
                before_data: entry.before_data || entry.oldData || null,
                after_data: entry.after_data || entry.newData || null,
                metadata: metadata || null,
                log_level: entry.level,
                component_name: entry.component,
                performance_ms: entry.performanceMs,
                url: window.location.href,
                user_agent: navigator.userAgent,
                session_id: this.sessionId,
                client_timestamp: new Date().toISOString(),
                device_type: this.getDeviceType(),
                city: this.geoData?.city,
                country: this.geoData?.country_name
            };

            this.queue.push(eventPayload);

            if (this.queue.length >= this.MAX_BATCH_SIZE) {
                this.flush();
            } else if (!this.flushTimer) {
                this.flushTimer = setTimeout(() => this.flush(), this.FLUSH_INTERVAL);
            }

        } catch (error) {
            console.error('❌ Failed to queue log (Exception):', error);
        }
    }

    public async flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }

        if (this.queue.length === 0) return;

        // Sanitize batch to ensure no undefined values or non-serializable data
        const batch = this.queue.map(event => {
            const sanitized: any = {};
            Object.keys(event).forEach(key => {
                if (event[key] !== undefined) {
                    sanitized[key] = event[key];
                } else {
                    sanitized[key] = null;
                }
            });
            return sanitized;
        });

        this.queue = [];

        try {
            // Log attempt to console for debugging if in dev
            if (window.location.hostname === 'localhost') {
                console.debug(`Flushing ${batch.length} logs...`);
            }

            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            if (token) {
                await fetch(`${apiUrl}/api/admin/rpc`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        rpcName: 'log_audit_events_batch',
                        params: { p_events: batch }
                    })
                });
            }
        } catch (error) {
            console.error('❌ Failed to flush logs (Exception):', error);
        }
    }

    public log(entry: LogEntry) {
        const level = entry.level || 'INFO';
        if (this.shouldLog(level)) {
            this.persistLog({ ...entry, level }).catch(err => {
                console.error('Background log failed:', err);
            });
        }
    }

    public info(action: LogAction, description: string, data?: any) {
        this.log({ level: 'INFO', action, actionDescription: description, metadata: data });
    }

    public warn(action: LogAction, description: string, data?: any) {
        this.log({ level: 'WARN', action, actionDescription: description, metadata: data });
    }

    public error(action: LogAction, description: string, error?: any, componentStack?: string) {
        const metadata = {
            error: error?.message || error,
            stack: error?.stack,
            componentStack
        };

        this.log({
            level: 'ERROR',
            action,
            actionDescription: description,
            metadata,
            category: 'system'
        });

        // Explicitly capture exceptions in Sentry
        if (error) {
            Sentry.captureException(error, {
                extra: { action, description, componentStack, ...metadata },
                tags: { category: 'system', action }
            });
        }
    }

    public trace(action: LogAction, description: string, data?: any) {
        this.log({ level: 'TRACE', action, actionDescription: description, metadata: data });
    }

    public debug(action: LogAction, description: string, data?: any) {
        this.log({ level: 'DEBUG', action, actionDescription: description, metadata: data });
    }

    // Convenience methods for specific semantic events
    public logClick(label: string, component: string, additionalMetadata?: Record<string, any>) {
        this.log({
            level: 'TRACE',
            action: 'CLICK',
            category: 'ui',
            actionDescription: `Clicked ${label}${component ? ` in ${component}` : ''}`,
            component,
            entityType: 'button',
            entityId: label,
            metadata: {
                elementName: label,
                path: window.location.pathname,
                componentName: component,
                ...additionalMetadata
            }
        });
    }

    public logPageView(pageName: string) {
        this.log({
            level: 'TRACE',
            action: 'VIEW',
            category: 'navigation',
            actionDescription: `Navigated to ${pageName}`,
            entityType: 'page',
            entityId: pageName,
            metadata: {
                pageName,
                path: window.location.pathname
            }
        });
    }

    public async ensureGeoData() {
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
                    } else throw new Error(res.statusText);
                } catch (e1) {
                    console.warn('⚠️ Geo: db-ip failed, trying ipwho.is...');
                    // Try 2: ipwho.is
                    try {
                        const res = await fetch('https://ipwho.is/');
                        if (res.ok) {
                            const data = await res.json();
                            this.geoData = {
                                ip: data.ip,
                                city: data.city,
                                country_name: data.country,
                                latitude: data.latitude,
                                longitude: data.longitude
                            };
                        } else throw new Error(res.statusText);
                    } catch (e2) {
                        console.warn('⚠️ Geo: ipwho.is failed, trying ipapi.co...');
                        // Try 3: ipapi.co
                        try {
                            const res = await fetch('https://ipapi.co/json/');
                            if (res.ok) {
                                const data = await res.json();
                                this.geoData = {
                                    ...data,
                                    latitude: data.latitude,
                                    longitude: data.longitude
                                };
                            } else throw new Error(res.statusText);
                        } catch (e3) {
                            console.warn('⚠️ Geo: ipapi.co failed, trying ipinfo.io...');
                            // Try 4: ipinfo.io
                            try {
                                const res = await fetch('https://ipinfo.io/json');
                                if (res.ok) {
                                    const data = await res.json();
                                    const [lat, lon] = (data.loc || '').split(',');
                                    this.geoData = {
                                        ip: data.ip,
                                        city: data.city,
                                        country_name: data.country,
                                        latitude: parseFloat(lat),
                                        longitude: parseFloat(lon)
                                    };
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

    public logAssign(shiftId: string, personId: string, personName: string, details?: { taskName?: string; startTime?: string; endTime?: string; taskId?: string; date?: string }) {
        this.log({
            level: 'INFO',
            action: 'ASSIGN',
            entityType: 'shift',
            entityId: shiftId,
            actionDescription: `Assigned ${personName} to shift`,
            metadata: {
                personId,
                personName,
                ...details,
                // Ensure date is present for filtering even if not in details
                date: details?.date || (details?.startTime ? formatIsraelDate(details.startTime) : undefined)
            }
        });
    }

    public logUnassign(shiftId: string, personId: string, personName: string, details?: { taskName?: string; startTime?: string; endTime?: string; taskId?: string; date?: string }) {
        this.log({
            level: 'INFO',
            action: 'UNASSIGN',
            entityType: 'shift',
            entityId: shiftId,
            actionDescription: `Unassigned ${personName} from shift`,
            metadata: {
                personId,
                personName,
                ...details,
                // Ensure date is present for filtering even if not in details
                date: details?.date || (details?.startTime ? formatIsraelDate(details.startTime) : undefined)
            }
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
