import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ported from public.get_active_gate_logs(...)
 */
export const get_active_gate_logs = async (supabase: SupabaseClient, params: { p_org_ids?: string[], p_organization_id: string, p_battalion_id?: string }) => {
    const { p_org_ids, p_organization_id, p_battalion_id } = params;

    let query = supabase
        .from('gate_logs')
        .select(`
            id,
            entry_time,
            plate_number,
            driver_name,
            status,
            organization_id,
            entry_type,
            is_exceptional,
            notes,
            exit_time,
            entry_reported_by,
            exit_reported_by,
            organizations!inner(name, battalion_id),
            entry_reporter:profiles!gate_logs_entry_reported_by_fkey(full_name),
            exit_reporter:profiles!gate_logs_exit_reported_by_fkey(full_name)
        `)
        .eq('status', 'inside');

    if (p_battalion_id && p_org_ids && p_org_ids.length > 0) {
        query = query.in('organization_id', p_org_ids);
    } else {
        query = query.eq('organization_id', p_organization_id);
    }

    const { data, error } = await query.order('entry_time', { ascending: false });

    if (error) throw error;

    // Map to match the SQL RETURN QUERY structure
    return data.map((gl: any) => ({
        ...gl,
        organization_name: gl.organizations.name,
        organization_battalion_id: gl.organizations.battalion_id,
        entry_reporter_name: gl.entry_reporter?.full_name,
        exit_reporter_name: gl.exit_reporter?.full_name,
        organizations: undefined,
        entry_reporter: undefined,
        exit_reporter: undefined
    }));
};

/**
 * Ported from public.register_gate_entry(...)
 */
export const register_gate_entry = async (supabase: SupabaseClient, params: { p_org_id: string, p_plate: string, p_driver: string, p_reporter: string, p_type: string, p_exceptional: boolean, p_notes?: string }) => {
    const { p_org_id, p_plate, p_driver, p_reporter, p_type, p_exceptional, p_notes } = params;

    const { data, error } = await supabase
        .from('gate_logs')
        .insert({
            organization_id: p_org_id,
            plate_number: p_plate,
            driver_name: p_driver,
            entry_time: new Date().toISOString(),
            status: 'inside',
            entry_reported_by: p_reporter,
            entry_type: p_type,
            is_exceptional: p_exceptional,
            notes: p_notes
        })
        .select()
        .single();

    if (error) throw error;
    return { success: true, data };
};

/**
 * Ported from public.register_gate_exit(...)
 */
export const register_gate_exit = async (supabase: SupabaseClient, params: { p_log_id: string, p_reporter: string }) => {
    const { p_log_id, p_reporter } = params;

    const { data, error } = await supabase
        .from('gate_logs')
        .update({
            exit_time: new Date().toISOString(),
            status: 'outside',
            exit_reported_by: p_reporter
        })
        .eq('id', p_log_id)
        .select()
        .single();

    if (error) throw error;
    return { success: true, data };
};
