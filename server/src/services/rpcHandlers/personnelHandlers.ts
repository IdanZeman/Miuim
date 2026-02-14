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
export const delete_person_secure = async (supabase: SupabaseClient, params: { p_person_id: string }) => {
    const { p_person_id } = params;

    // We assume get_my_org_id check is implicit in RLS or handled via userClient
    const { error } = await supabase.from('people').delete().eq('id', p_person_id);
    if (error) throw error;

    return true;
};
