import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

export const getOrgDataBundle = async (req: AuthRequest, res: Response) => {
    const user = req.user;
    const authHeader = req.headers.authorization;
    const { orgId, startDate, endDate } = req.query;

    if (!user || !authHeader) {
        return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Default dates similar to RPC default: 90 days back, 30 days forward
    const vStart = (startDate as string) || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const vEnd = (endDate as string) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Extended range for absences (User Request: "Absences specifically a month back")
    const startObj = new Date(vStart);
    startObj.setDate(startObj.getDate() - 30);
    const vStartAbsence = startObj.toISOString().split('T')[0];

    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: {
                    Authorization: authHeader
                }
            }
        }
    );

    try {
        // Fetch everything in parallel

        // Helper for measuring promise duration
        const measure = async <T>(name: string, promise: any): Promise<T> => {
            const start = Date.now();
            try {
                const result = await promise;
                const duration = Date.now() - start;
                if (duration > 500) { // Log significant delays
                    logger.warn(`[Bundle] Slow query '${name}': ${duration}ms`);
                }
                return result;
            } catch (e) {
                logger.error(`[Bundle] Error in '${name}':`, e);
                // Return a dummy object with error property to handle gracefully in Promise.all
                return { error: e, data: null } as any;
            }
        };

        // Fetch everything in parallel with measurement
        const [
            org,
            people,
            teams,
            rotations,
            absences,
            blockages,
            roles,
            shifts,
            taskTemplates,
            constraints,
            settings,
            missionReports,
            equipment,
            equipmentChecks,
            presence,
            systemMessages
        ] = await Promise.all([
            measure<any>('org', userClient.from('organizations').select('*').eq('id', orgId).single()),
            measure<any>('people', userClient.from('people').select('*').eq('organization_id', orgId)),
            measure<any>('teams', userClient.from('teams').select('*').eq('organization_id', orgId)),
            measure<any>('rotations', userClient.from('team_rotations').select('*').eq('organization_id', orgId)),
            // Absences: End date must be >= window start (extended), Start date must be <= window end
            measure<any>('absences', userClient.from('absences')
                .select('*')
                .eq('organization_id', orgId)
                .gte('end_date', vStartAbsence)
                .lte('start_date', vEnd)),
            measure<any>('hourly_blockages', userClient.from('hourly_blockages')
                .select('*')
                .eq('organization_id', orgId)
                .gte('date', vStart)
                .lte('date', vEnd)),
            measure<any>('roles', userClient.from('roles').select('*').eq('organization_id', orgId)),
            measure<any>('shifts', userClient.from('shifts')
                .select('*')
                .eq('organization_id', orgId)
                .gte('start_time', vStart) // Simple check, ideally overlaps but start_time is good proxy for now
                .lte('start_time', `${vEnd}T23:59:59`)
                .order('start_time')),
            measure<any>('task_templates', userClient.from('task_templates').select('*').eq('organization_id', orgId)),
            measure<any>('scheduling_constraints', userClient.from('scheduling_constraints').select('*').eq('organization_id', orgId)),
            measure<any>('settings', userClient.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle()),
            measure<any>('mission_reports', userClient.from('mission_reports')
                .select('*')
                .eq('organization_id', orgId)
                .gte('created_at', vStart)
                .lte('created_at', `${vEnd}T23:59:59`)),
            measure<any>('equipment', userClient.from('equipment').select('*').eq('organization_id', orgId)),
            measure<any>('equipment_daily_checks', userClient.from('equipment_daily_checks')
                .select('*')
                .eq('organization_id', orgId)
                .gte('date', vStart)
                .lte('date', vEnd)),
            measure<any>('presence', userClient.from('daily_presence')
                .select('*')
                .eq('organization_id', orgId)
                .gte('date', vStart)
                .lte('date', vEnd)
                .order('date')),
            measure<any>('system_messages', userClient.from('system_messages')
                .select('*')
                .eq('organization_id', orgId)
                .eq('is_active', true)
                .eq('message_type', 'POPUP')
                .order('created_at', { ascending: false }))
        ]);

        // Error handling for critical tables
        if (org.error) throw org.error;

        res.json({
            organization: org.data,
            people: people.data || [],
            teams: teams.data || [],
            rotations: rotations.data || [],
            absences: absences.data || [],
            hourly_blockages: blockages.data || [],
            roles: roles.data || [],
            shifts: shifts.data || [],
            task_templates: taskTemplates.data || [],
            scheduling_constraints: constraints.data || [],
            settings: settings.data || null,
            mission_reports: missionReports.data || [],
            equipment: equipment.data || [],
            equipment_daily_checks: equipmentChecks.data || [],
            presence: presence.data || [],
            system_messages: systemMessages.data || []
        });

    } catch (err: any) {
        console.error('Error in getOrgDataBundle:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
