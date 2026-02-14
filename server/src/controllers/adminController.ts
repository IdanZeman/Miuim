import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import * as adminHandlers from '../services/rpcHandlers/adminHandlers.js';
import * as personnelHandlers from '../services/rpcHandlers/personnelHandlers.js';
import * as gateHandlers from '../services/rpcHandlers/gateHandlers.js';
import { fetchWithRetry } from '../utils/fetchWithRetry.js';

// Map of RPC names to local TypeScript implementations
const LOCAL_RPC_HANDLERS: Record<string, (client: any, params?: any) => Promise<any>> = {
    'admin_fetch_all_battalions': (client) => adminHandlers.admin_fetch_all_battalions(client),
    'admin_fetch_all_organizations': (client) => adminHandlers.admin_fetch_all_organizations(client),
    'admin_fetch_all_profiles': (client) => adminHandlers.admin_fetch_all_profiles(client),
    'admin_fetch_all_teams': (client) => adminHandlers.admin_fetch_all_teams(client),
    'admin_fetch_all_permission_templates': (client) => adminHandlers.admin_fetch_all_permission_templates(client),
    'admin_fetch_audit_logs': (client, params) => adminHandlers.admin_fetch_audit_logs(client, params),
    'admin_update_profile': (client, params) => adminHandlers.admin_update_profile(client, params),
    'admin_update_battalion': (client, params) => adminHandlers.admin_update_battalion(client, params),
    'create_battalion': (client, params) => adminHandlers.create_battalion(client, params),
    'create_company_under_battalion': (client, params) => adminHandlers.create_company_under_battalion(client, params),
    'admin_update_user_link': (client, params) => adminHandlers.admin_update_user_link(client, params),
    'delete_person_cascade': (client, params) => personnelHandlers.delete_person_cascade(client, params),
    'archive_person_before_delete': (client, params) => personnelHandlers.archive_person_before_delete(client, params),
    'delete_person_secure': (client, params) => personnelHandlers.delete_person_secure(client, params),
    'get_active_gate_logs': (client, params) => gateHandlers.get_active_gate_logs(client, params),
    'register_gate_entry': (client, params) => gateHandlers.register_gate_entry(client, params),
    'register_gate_exit': (client, params) => gateHandlers.register_gate_exit(client, params),
    'upsert_equipment': (client, params) => adminHandlers.upsert_equipment(client, params),
};

/**
 * Generic handler for Admin RPCs to avoid creating dozens of endpoints.
 * Validates the RPC name against an allowed list for security.
 */
export const execAdminRpc = async (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });



    const userClient = createClient(
        process.env.SUPABASE_URL || '',
        process.env.SUPABASE_ANON_KEY || '',
        {
            global: {
                headers: { Authorization: authHeader },
                fetch: fetchWithRetry
            }
        }
    );

    const ALLOWED_RPCS = [
        ...Object.keys(LOCAL_RPC_HANDLERS),
        'get_org_analytics_summary',
        'get_recent_system_activity',
        'get_system_activity_chart',
        'get_global_stats_aggregated',
        'get_top_organizations',
        'get_system_users_chart',
        'get_system_orgs_chart',
        'get_org_top_users',
        'get_org_top_pages',
        'get_org_top_actions',
        'get_org_activity_graph',
        'get_dashboard_kpis',
        'get_new_orgs_stats',
        'get_top_users',
        'check_super_admins',
        // 'admin_fetch_audit_logs', // Now in LOCAL_RPC_HANDLERS
        'get_new_orgs_list',
        'get_new_users_list',
        'get_active_users_stats',
        // 'admin_fetch_all_profiles', // Now in LOCAL_RPC_HANDLERS
        // 'admin_fetch_all_organizations', // Now in LOCAL_RPC_HANDLERS
        // 'admin_fetch_all_teams', // Now in LOCAL_RPC_HANDLERS
        // 'admin_fetch_all_permission_templates', // Now in LOCAL_RPC_HANDLERS
        'admin_update_profile',
        'admin_update_user_link',
        'get_organization_settings',
        'update_organization_settings_v3',
        'get_permission_templates',
        'delete_permission_template_v2',
        'update_permission_template_v2',
        'get_org_members',
        'get_org_invites',
        'generate_invite_token',
        'update_org_invite_config',
        'get_org_roles',
        'get_org_people',
        'get_org_teams',
        'get_organization_overview',
        'bulk_insert_attendance_snapshots',
        'join_battalion',
        'unlink_battalion_admin',
        'admin_fetch_all_battalions',
        'admin_update_battalion',
        'upsert_people',
        'deactivate_personnel',
        'claim_person_profile',
        'insert_teams',
        'delete_team_secure',
        'insert_roles',
        'delete_role_secure',
        'delete_person_cascade',
        'delete_person_secure',
        'delete_people_cascade',
        'archive_person_before_delete',
        'archive_people_before_delete',
        'preview_person_deletion',
        'upsert_task_template',
        'delete_task_template_secure',
        'update_task_segments',
        'upsert_shift',
        'upsert_shifts',
        'delete_shift_secure',
        'toggle_shift_cancellation',
        'clear_shift_assignments_in_range',
        'delete_shifts_by_task',
        'upsert_constraint',
        'delete_constraint_secure',
        'delete_constraints_by_role',
        'upsert_absence',
        'delete_absence_secure',
        'upsert_hourly_blockage',
        'delete_hourly_blockage_secure',
        'upsert_team_rotation',
        'delete_team_rotation_secure',
        'log_snapshot_operation_start',
        'create_snapshot_v2',
        'log_snapshot_operation_complete',
        'restore_snapshot',
        'delete_snapshot_v2',
        'get_snapshot_table_data_info',
        'get_snapshot_table_data_chunk',
        'get_snapshot_data_bundle',
        // Gate System
        'get_active_gate_logs',
        'search_gate_people',
        'register_gate_entry',
        'register_gate_exit',
        'get_gate_logs_v2',
        'upsert_gate_authorized_vehicle',
        'delete_gate_authorized_vehicle_secure',
        // Battalion Operations
        'create_battalion',
        'unlink_battalion',
        'create_company_under_battalion',
        'update_battalion_morning_report_time',
        // Telemetry & Profile
        'log_audit_events_batch',
        'update_my_profile',
        'upsert_person',
        // Equipment
        'upsert_equipment',
        'delete_equipment_secure',
        'upsert_equipment_daily_check'
    ];

    try {
        const { rpcName, params } = req.body;

        if (!ALLOWED_RPCS.includes(rpcName)) {
            return res.status(403).json({ error: `RPC ${rpcName} is not allowed or not an admin RPC.` });
        }

        // Check for local implementation first
        if (LOCAL_RPC_HANDLERS[rpcName]) {
            logger.info(`Executing local implementation for RPC: ${rpcName}`);
            const result = await LOCAL_RPC_HANDLERS[rpcName](userClient, params);
            return res.json(result);
        }

        // Fallback to direct Supabase RPC
        const { data, error } = await userClient.rpc(rpcName, params || {});

        if (error) throw error;
        res.json(data);
    } catch (err: any) {
        logger.error(`Error in execAdminRpc (${req.body.rpcName}):`, err);
        res.status(500).json({ error: err.message || 'Internal server error' });
    }
};
