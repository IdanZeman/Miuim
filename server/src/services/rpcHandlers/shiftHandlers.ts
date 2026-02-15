import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ported from public.update_shift_assignments(p_shift_id uuid, p_assigned_person_ids uuid[], p_metadata jsonb)
 */
export const update_shift_assignments = async (supabase: SupabaseClient, params: { p_shift_id: string, p_assigned_person_ids: string[], p_metadata?: any }) => {
    const { p_shift_id, p_assigned_person_ids, p_metadata } = params;

    // Build update object
    const update: any = { assigned_person_ids: p_assigned_person_ids };
    if (p_metadata !== undefined && p_metadata !== null) {
        update.metadata = p_metadata;
    }

    const { data, error } = await supabase
        .from('shifts')
        .update(update)
        .eq('id', p_shift_id)
        .select()
        .single();

    if (error) throw error;
    return data;
};
