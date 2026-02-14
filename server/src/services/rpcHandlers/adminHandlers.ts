import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ported from public.admin_fetch_all_battalions()
 */
export const admin_fetch_all_battalions = async (supabase: SupabaseClient) => {
    // Security check is done at the controller level (isSuperAdmin middleware)
    const { data, error } = await supabase
        .from('battalions')
        .select('id, name, code, morning_report_time, is_company_switcher_enabled, created_at')
        .order('name');

    if (error) throw error;
    return data;
};

/**
 * Ported from public.admin_fetch_all_organizations()
 */
export const admin_fetch_all_organizations = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from('organizations')
        .select('id, name, battalion_id, is_hq, created_at')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

/**
 * Ported from public.admin_fetch_all_permission_templates()
 */
export const admin_fetch_all_permission_templates = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from('permission_templates')
        .select('id, name, organization_id, permissions, created_at, updated_at')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

/**
 * Ported from public.admin_fetch_all_profiles()
 */
export const admin_fetch_all_profiles = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, organization_id, is_super_admin, permissions, permission_template_id, created_at')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
};

/**
 * Ported from public.admin_fetch_all_teams()
 */
export const admin_fetch_all_teams = async (supabase: SupabaseClient) => {
    const { data, error } = await supabase
        .from('teams')
        .select('id, name, organization_id');

    if (error) throw error;
    return data;
};

/**
 * Ported from public.admin_fetch_audit_logs()
 */
export const admin_fetch_audit_logs = async (supabase: SupabaseClient, params: { p_start_date: string, p_limit?: number }) => {
    const { data, error } = await supabase
        .from('audit_logs')
        .select('created_at, user_id, organization_id, metadata, city, country, device_type')
        .gte('created_at', params.p_start_date)
        .order('created_at', { ascending: false })
        .limit(params.p_limit || 2000);

    if (error) throw error;
    return data;
};

/**
 * Helper to generate a unique battalion link code
 */
const generateBattalionLinkCode = async (supabase: SupabaseClient): Promise<string> => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let exists = true;

    while (exists) {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const { data } = await supabase.from('battalions').select('id').eq('code', code).maybeSingle();
        if (!data) exists = false;
    }
    return code;
};

/**
 * Ported from public.admin_update_profile(p_user_id uuid, p_updates jsonb)
 */
export const admin_update_profile = async (supabase: SupabaseClient, params: { p_user_id: string, p_updates: any }) => {
    const { p_user_id, p_updates } = params;

    // 1. Update Profile
    const profileUpdate: any = {};
    if (p_updates.full_name !== undefined) profileUpdate.full_name = p_updates.full_name;
    if (p_updates.organization_id !== undefined) profileUpdate.organization_id = p_updates.organization_id;
    if (p_updates.permissions !== undefined) profileUpdate.permissions = p_updates.permissions;
    if (p_updates.permission_template_id !== undefined) profileUpdate.permission_template_id = p_updates.permission_template_id;

    const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', p_user_id)
        .select()
        .single();

    if (profileError) throw profileError;

    // 2. Handle battalion_id update for the organization
    if (p_updates.battalion_id) {
        const { error: orgError } = await supabase
            .from('organizations')
            .update({ battalion_id: p_updates.battalion_id })
            .eq('id', profileData.organization_id);

        if (orgError) throw orgError;
    }

    return { success: true, data: profileData };
};

/**
 * Ported from public.admin_update_battalion(p_battalion_id uuid, p_updates jsonb)
 */
export const admin_update_battalion = async (supabase: SupabaseClient, params: { p_battalion_id: string, p_updates: any }) => {
    const { p_battalion_id, p_updates } = params;

    const update: any = {};
    if (p_updates.name !== undefined) update.name = p_updates.name;
    if (p_updates.code !== undefined) update.code = p_updates.code;
    if (p_updates.morning_report_time !== undefined) update.morning_report_time = p_updates.morning_report_time;
    if (p_updates.is_company_switcher_enabled !== undefined) update.is_company_switcher_enabled = p_updates.is_company_switcher_enabled;

    const { data, error } = await supabase
        .from('battalions')
        .update(update)
        .eq('id', p_battalion_id)
        .select()
        .single();

    if (error) throw error;
    return { success: true, data };
};

/**
 * Ported from public.create_battalion(p_battalion_name text, p_hq_org_name text, ...)
 */
export const create_battalion = async (supabase: SupabaseClient, params: { p_battalion_name: string, p_hq_org_name: string, p_hq_type?: string, p_battalion_code?: string }) => {
    const { p_battalion_name, p_hq_org_name, p_hq_type = 'unit', p_battalion_code } = params;

    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    // 2. Create Battalion
    const linkCode = p_battalion_code || await generateBattalionLinkCode(supabase);
    const { data: battalion, error: battError } = await supabase
        .from('battalions')
        .insert({ name: p_battalion_name, code: linkCode })
        .select()
        .single();

    if (battError) throw battError;

    // 3. Create HQ Organization
    const { data: hqOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: p_hq_org_name, org_type: p_hq_type, battalion_id: battalion.id, is_hq: true })
        .select()
        .single();

    if (orgError) throw orgError;

    // 4. Update Creator's Profile
    const { error: profError } = await supabase
        .from('profiles')
        .update({ organization_id: hqOrg.id })
        .eq('id', user.id);

    if (profError) throw profError;

    // 5. Audit Log (Simplified)
    await supabase.from('audit_logs').insert({
        organization_id: hqOrg.id,
        user_id: user.id,
        event_type: 'INSERT',
        event_category: 'battalion_management',
        action_description: 'Battalion created with HQ org',
        entity_type: 'battalions',
        entity_id: battalion.id,
        after_data: { battalion, hqOrg }
    });

    return { success: true, battalion, hq_organization: hqOrg };
};

/**
 * Ported from public.create_company_under_battalion(p_company_name text, ...)
 */
export const create_company_under_battalion = async (supabase: SupabaseClient, params: { p_company_name: string, p_company_type?: string }) => {
    const { p_company_name, p_company_type = 'company' } = params;

    // 1. Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentication required');

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

    if (profileError) throw profileError;

    // 2. Get user's org to find battalion_id
    const { data: userOrg, error: userOrgError } = await supabase
        .from('organizations')
        .select('battalion_id, is_hq')
        .eq('id', profile.organization_id)
        .single();

    if (userOrgError) throw userOrgError;
    if (!userOrg.battalion_id || !userOrg.is_hq) throw new Error('Only HQ can create companies');

    // 3. Create New Organization
    const { data: newOrg, error: newOrgError } = await supabase
        .from('organizations')
        .insert({ name: p_company_name, org_type: p_company_type, battalion_id: userOrg.battalion_id, is_hq: false })
        .select()
        .single();

    if (newOrgError) throw newOrgError;

    // 4. Update Profile (can_switch_companies)
    await supabase.from('profiles').update({ can_switch_companies: true }).eq('id', user.id);

    // 5. Audit Log
    await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        event_type: 'INSERT',
        event_category: 'battalion_management',
        action_description: 'Company created under battalion: ' + p_company_name,
        entity_type: 'organizations',
        entity_id: newOrg.id,
        after_data: newOrg
    });

    return { success: true, data: newOrg };
};

/**
 * Ported from public.admin_update_user_link(p_user_id uuid, p_person_id uuid)
 */
export const admin_update_user_link = async (supabase: SupabaseClient, params: { p_user_id: string, p_person_id?: string }) => {
    const { p_user_id, p_person_id } = params;

    // 1. Unlink everyone currently linked to this user
    await supabase.from('people').update({ user_id: null }).eq('user_id', p_user_id);

    // 2. If a person is selected, link them
    if (p_person_id) {
        const { error } = await supabase.from('people').update({ user_id: p_user_id }).eq('id', p_person_id);
        if (error) throw error;
    }

    return { success: true };
};

/**
 * Ported from public.upsert_equipment(p_equipment jsonb)
 */
export const upsert_equipment = async (supabase: SupabaseClient, params: { p_equipment: any }) => {
    const { p_equipment } = params;
    const { id, ...updateData } = p_equipment;

    let result;
    if (id) {
        const { data, error } = await supabase
            .from('equipment')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        result = data;
    } else {
        const { data, error } = await supabase
            .from('equipment')
            .insert(p_equipment)
            .select()
            .single();
        if (error) throw error;
        result = data;
    }

    return result;
};
