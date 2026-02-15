import NodeCache from 'node-cache';
import { supabaseAdmin } from '../supabase.js';
import { logger } from '../utils/logger.js';

interface CacheBundle {
    [key: string]: any;
}

class CacheService {
    private cache: NodeCache;
    private activeSubscriptions: Set<string> = new Set();

    constructor() {
        // Cache expires in 1 hour if not accessed, check every 10 minutes
        this.cache = new NodeCache({ stdTTL: 3600, checkperiod: 600 });
    }

    public async getOrgData(orgId: string, startDate: string, endDate: string): Promise<any> {
        const cacheKey = `bundle_${orgId}_${startDate}_${endDate}`;
        let bundle = this.cache.get<CacheBundle>(cacheKey);

        if (!bundle) {
            logger.info(`[Cache] Miss for org ${orgId}. Initializing...`);
            bundle = await this.refreshFullBundle(orgId, startDate, endDate);
            this.cache.set(cacheKey, bundle);
            this.setupRealtimeSync(orgId, startDate, endDate);
        } else {
            logger.info(`[Cache] Hit for org ${orgId}`);
        }

        return bundle;
    }

    private async refreshFullBundle(orgId: string, startDate: string, endDate: string) {
        // Default dates logic similar to controller
        const vStart = startDate;
        const vEnd = endDate;

        const startObj = new Date(vStart);
        startObj.setDate(startObj.getDate() - 30);
        const vStartAbsence = startObj.toISOString().split('T')[0];

        const [
            org, people, teams, rotations, absences, blockages,
            roles, shifts, taskTemplates, constraints, settings,
            missionReports, equipment, equipmentChecks, presence, systemMessages
        ] = await Promise.all([
            this.query('organizations', '*', { id: orgId }, true),
            this.query('people', '*', { organization_id: orgId }),
            this.query('teams', '*', { organization_id: orgId }),
            this.query('team_rotations', '*', { organization_id: orgId }),
            this.query('absences', '*', { organization_id: orgId }, false, (q) => q.gte('end_date', vStartAbsence).lte('start_date', vEnd)),
            this.query('hourly_blockages', '*', { organization_id: orgId }, false, (q) => q.gte('date', vStart).lte('date', vEnd)),
            this.query('roles', '*', { organization_id: orgId }),
            this.query('shifts', '*', { organization_id: orgId }, false, (q) => q.gte('start_time', vStart).lte('start_time', `${vEnd}T23:59:59`).order('start_time')),
            this.query('task_templates', '*', { organization_id: orgId }),
            this.query('scheduling_constraints', '*', { organization_id: orgId }),
            this.query('organization_settings', '*', { organization_id: orgId }, true),
            this.query('mission_reports', '*', { organization_id: orgId }, false, (q) => q.order('created_at', { ascending: false }).limit(50)), // Limit to recent 50 reports
            this.query('equipment', '*', { organization_id: orgId }),
            this.query('equipment_daily_checks', '*', { organization_id: orgId }, false, (q) => q.gte('check_date', vStart).lte('check_date', vEnd)),
            this.query('daily_presence', '*', { organization_id: orgId }, false, (q) => q.gte('date', vStart).lte('date', vEnd).order('date')),
            this.query('system_messages', '*', { organization_id: orgId, is_active: true, message_type: 'POPUP' }, false, (q) => q.order('created_at', { ascending: false }))
        ]);

        return {
            organization: org,
            people,
            teams,
            rotations: rotations,
            absences,
            hourly_blockages: blockages,
            roles,
            shifts,
            task_templates: taskTemplates,
            scheduling_constraints: constraints,
            settings,
            mission_reports: missionReports,
            equipment,
            equipment_daily_checks: equipmentChecks,
            presence,
            system_messages: systemMessages
        };
    }

    private async query(table: string, select: string, filters: any, single: boolean = false, customQuery?: (q: any) => any) {
        let q = supabaseAdmin.from(table).select(select);
        for (const [key, value] of Object.entries(filters)) {
            q = q.eq(key, value);
        }
        if (customQuery) q = customQuery(q);
        const { data, error } = single ? await q.single() : await q;
        if (error && error.code !== 'PGRST116') { // Ignore "no rows returned" for single
            logger.error(`[Cache] Error querying ${table}:`, error);
        }
        return data || (single ? null : []);
    }

    private setupRealtimeSync(orgId: string, startDate: string, endDate: string) {
        if (this.activeSubscriptions.has(orgId)) return;
        this.activeSubscriptions.add(orgId);

        logger.info(`[Cache] Setting up Realtime sync for org ${orgId}`);

        const channel = supabaseAdmin.channel(`cache_sync_${orgId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public'
            }, (payload) => {
                this.handleUpdate(orgId, payload);
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    logger.info(`[Cache] Realtime subscribed for org ${orgId}`);
                } else if (status === 'CHANNEL_ERROR') {
                    logger.error(`[Cache] Realtime connection error for org ${orgId}:`, err);
                    this.activeSubscriptions.delete(orgId); // Allow retry
                } else if (status === 'TIMED_OUT') {
                    logger.warn(`[Cache] Realtime timeout for org ${orgId}`);
                    this.activeSubscriptions.delete(orgId);
                }
            });
    }

    private handleUpdate(orgId: string, payload: any) {
        const { table, eventType, new: newRow, old: oldRow } = payload;

        // Log events at debug level to avoid flooding during batch operations
        logger.debug(`[Cache] Event: ${eventType} on ${table} (Org context: ${orgId})`);

        // Map table names to bundle keys
        const tableMap: { [key: string]: string } = {
            'organizations': 'organization',
            'people': 'people',
            'teams': 'teams',
            'team_rotations': 'rotations',
            'absences': 'absences',
            'hourly_blockages': 'hourly_blockages',
            'roles': 'roles',
            'shifts': 'shifts',
            'task_templates': 'task_templates',
            'scheduling_constraints': 'scheduling_constraints',
            'organization_settings': 'settings',
            'mission_reports': 'mission_reports',
            'equipment': 'equipment',
            'equipment_daily_checks': 'equipment_daily_checks',
            'daily_presence': 'presence',
            'system_messages': 'system_messages'
        };

        const key = tableMap[table];
        if (!key) {
            logger.debug(`[Cache] Ignored table: ${table}`);
            return;
        }

        // Filter by organization_id (or id for organizations table)
        const rowOrgId = (table === 'organizations') ? (newRow?.id || oldRow?.id) : (newRow?.organization_id || oldRow?.organization_id);

        if (rowOrgId && rowOrgId !== orgId) {
            // This is expected if multiple orgs are active, but since each org has its own channel, 
            // seeing rows from other orgs here would mean the channel is broadcast-global.
            return;
        }

        const cacheKey = `bundle_${orgId}`;
        const bundle = this.cache.get<CacheBundle>(cacheKey);
        if (!bundle) {
            logger.warn(`[Cache] Bundle for ${orgId} not found in cache for ${eventType}`);
            return;
        }

        logger.debug(`[Cache] Updating ${key} in bundle for org ${orgId}`);

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
            if (Array.isArray(bundle[key])) {
                const index = bundle[key].findIndex((item: any) => item.id === newRow.id);
                if (index !== -1) {
                    bundle[key][index] = newRow;
                } else {
                    bundle[key].push(newRow);
                }
            } else {
                bundle[key] = newRow;
            }
        } else if (eventType === 'DELETE') {
            if (Array.isArray(bundle[key])) {
                bundle[key] = bundle[key].filter((item: any) => item.id !== oldRow.id);
            } else {
                bundle[key] = null;
            }
        }

        this.cache.set(cacheKey, bundle);
    }
}

export const cacheService = new CacheService();
