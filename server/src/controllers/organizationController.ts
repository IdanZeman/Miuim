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
    const vStart = startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const vEnd = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
            presence
        ] = await Promise.all([
            userClient.from('organizations').select('*').eq('id', orgId).single(),
            userClient.from('people').select('*').eq('organization_id', orgId),
            userClient.from('teams').select('*').eq('organization_id', orgId),
            userClient.from('team_rotations').select('*').eq('organization_id', orgId),
            userClient.from('absences').select('*').eq('organization_id', orgId),
            userClient.from('hourly_blockages').select('*').eq('organization_id', orgId),
            userClient.from('roles').select('*').eq('organization_id', orgId),
            userClient.from('shifts').select('*').eq('organization_id', orgId).order('start_time'),
            userClient.from('task_templates').select('*').eq('organization_id', orgId),
            userClient.from('scheduling_constraints').select('*').eq('organization_id', orgId),
            userClient.from('organization_settings').select('*').eq('organization_id', orgId).maybeSingle(),
            userClient.from('mission_reports').select('*').eq('organization_id', orgId),
            userClient.from('equipment').select('*').eq('organization_id', orgId),
            userClient.from('equipment_daily_checks').select('*').eq('organization_id', orgId),
            userClient.from('daily_presence')
                .select('*')
                .eq('organization_id', orgId)
                .gte('date', vStart)
                .lte('date', vEnd)
                .order('date')
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
            presence: presence.data || []
        });

    } catch (err: any) {
        console.error('Error in getOrgDataBundle:', err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
