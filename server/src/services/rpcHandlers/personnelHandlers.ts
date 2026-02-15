import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ported from public.delete_person_cascade(p_person_id text)
 */
export const delete_person_cascade = async (supabase: SupabaseClient, params: { p_person_id: string }) => {
    const { p_person_id } = params;

    // 1. Delete mission reports (references shifts)
    // We sub-select shifts assigned to this person first
    const { data: shifts } = await supabase
        .from('shifts')
        .select('id')
        .contains('assigned_person_ids', [p_person_id]);

    if (shifts && shifts.length > 0) {
        await supabase.from('mission_reports').delete().in('shift_id', shifts.map(s => s.id));
    }

    // 2. Delete simple dependencies
    await supabase.from('user_load_stats').delete().eq('person_id', p_person_id);
    await supabase.from('daily_attendance_snapshots').delete().eq('person_id', p_person_id);
    await supabase.from('daily_presence').delete().eq('person_id', p_person_id);
    await supabase.from('absences').delete().eq('person_id', p_person_id);
    await supabase.from('hourly_blockages').delete().eq('person_id', p_person_id);
    await supabase.from('scheduling_constraints').delete().eq('person_id', p_person_id);
    await supabase.from('unified_presence').delete().eq('person_id', p_person_id);

    // 3. Remove from shifts
    if (shifts && shifts.length > 0) {
        for (const shift of shifts) {
            const { data: fullShift } = await supabase.from('shifts').select('assigned_person_ids').eq('id', shift.id).single();
            if (fullShift) {
                const newIds = fullShift.assigned_person_ids.filter((id: string) => id !== p_person_id);
                await supabase.from('shifts').update({ assigned_person_ids: newIds }).eq('id', shift.id);
            }
        }
    }

    // 4. Unassign equipment
    await supabase.from('equipment').update({ assigned_to_id: null }).eq('assigned_to_id', p_person_id);

    // 5. Finally delete the person
    const { error } = await supabase.from('people').delete().eq('id', p_person_id);
    if (error) throw error;

    return { success: true };
};

/**
 * Ported from public.archive_person_before_delete(...)
 */
export const archive_person_before_delete = async (supabase: SupabaseClient, params: { p_person_id: string, p_deleted_by: string, p_reason?: string }) => {
    const { p_person_id, p_deleted_by, p_reason } = params;

    // 1. Get person data
    const { data: person, error: personError } = await supabase.from('people').select('*').eq('id', p_person_id).single();
    if (personError) throw personError;

    // 2. Mock preview_person_deletion (simplified)
    const previewData = {
        shifts: { count: 0 },
        absences: { count: 0 },
        equipment: { count: 0 }
    };

    // 3. Archive
    const { data: archive, error: archiveError } = await supabase.from('deleted_people_archive').insert({
        person_id: p_person_id,
        person_data: person,
        organization_id: person.organization_id,
        deleted_by: p_deleted_by,
        deletion_reason: p_reason,
        related_data_counts: previewData
    }).select().single();

    if (archiveError) throw archiveError;
    return archive.id;
};

/**
 * Ported from public.delete_person_secure(p_person_id text)
 */
/**
 * Ported from public.delete_person_secure(p_person_id text)
 * Updated to handle basic cascades because strict FKs prevent simple deletion
 */
export const delete_person_secure = async (supabase: SupabaseClient, params: { p_person_id: string }) => {
    // Re-use cascade logic because daily_attendance_snapshots and others have strict FKs
    console.log(`[DEBUG] Executing local delete_person_secure for ${params.p_person_id}`);
    return await delete_person_cascade(supabase, params);
};

// Helper to get current user's organization_id
const get_my_org_id = async (supabase: SupabaseClient) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not found');

    // Check metadata first
    if (user.user_metadata?.organization_id) return user.user_metadata.organization_id;

    // Fallback to profile
    const { data, error } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (error || !data) throw new Error('Profile/Organization not found');
    return data.organization_id;
};

export const upsert_person_handler = async (supabase: SupabaseClient, params: {
    p_id?: string | null,
    p_name: string,
    p_email?: string | null,
    p_team_id?: string | null,
    p_role_ids?: string[],
    p_phone?: string | null,
    p_is_active?: boolean,
    p_custom_fields?: any,
    p_color?: string
}) => {
    const {
        p_id, p_name, p_email, p_team_id, p_role_ids,
        p_phone, p_is_active, p_custom_fields, p_color
    } = params;

    // Fetch Org ID for new records (and robust updates)
    const organization_id = await get_my_org_id(supabase);

    // 1. Upsert Person
    const personPayload: any = {
        organization_id, // Mandatory for inserts
        name: p_name,
        email: p_email,
        team_id: p_team_id,
        phone: p_phone,
        is_active: p_is_active,
        custom_fields: p_custom_fields,
        color: p_color,
        role_ids: p_role_ids // Added: Update the array column directly
    };

    if (p_id) personPayload.id = p_id;
    // If no ID, let Supabase generate it (or use a placeholder if needed, but usually insert without ID is fine)

    // Getting the user's organization_id requires a separate query if it's a new user, 
    // BUT RLS should handle organization assignment on insert if set up correctly, 
    // OR we should query it. 
    // However, usually the client sends the org_id or it's inferred.
    // In the RPC version, it often used `auth.uid()` -> `profile` -> `org_id`.
    // Since we are running as the USER client (passed from controller), RLS applies.
    // Let's rely on RLS/Defaults for now.

    // ISSUE: We need the ID for role assignment.
    // If it's an update, we have P_ID. If insert, we need the returned ID.

    const { data: person, error: personError } = await supabase
        .from('people')
        .upsert(personPayload)
        .select()
        .single();

    if (personError) throw personError;

    // Remove legacy person_roles logic as we use role_ids array column
    // Return the person with roles to match RPC signature expected by frontend? 
    // The frontend expects the person object.
    return person;
};

export const upsert_team_handler = async (supabase: SupabaseClient, params: { p_id?: string | null, p_name: string, p_color: string }) => {
    const { p_id, p_name, p_color } = params;

    const organization_id = await get_my_org_id(supabase);

    // Check if team exists to determine insert vs update? 
    // Upsert works if we have ID.
    const payload: any = {
        organization_id,
        name: p_name,
        color: p_color
    };
    if (p_id) payload.id = p_id;

    const { data, error } = await supabase
        .from('teams')
        .upsert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const upsert_role_handler = async (supabase: SupabaseClient, params: { p_id?: string | null, p_name: string, p_color: string, p_icon?: string | null }) => {
    const { p_id, p_name, p_color, p_icon } = params;

    const organization_id = await get_my_org_id(supabase);

    const payload: any = {
        organization_id,
        name: p_name,
        color: p_color,
        icon: p_icon
    };
    if (p_id) payload.id = p_id;

    const { data, error } = await supabase
        .from('roles')
        .upsert(payload)
        .select()
        .single();

    if (error) throw error;
    return data;
};
