import { supabase } from '../lib/supabase';
import { Battalion, Profile, Organization, Person, DailyPresenceSummary } from '../types';
import { mapPersonFromDB } from './mappers';

/**
 * Creates a new battalion and marks the user's organization as HQ.
 * If the user doesn't have an organization, creates one first.
 */
export const createBattalion = async (name: string, organizationName?: string) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) throw new Error('User not authenticated');

    const userId = userData.user.id;
    const code = await generateBattalionLinkCode();

    // 1. Get user's current profile
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

    if (profileError) throw profileError;

    let organizationId = profile?.organization_id;

    // 2. If user doesn't have an organization, create one
    if (!organizationId) {
        if (!organizationName) {
            throw new Error('Organization name is required when creating a new organization');
        }

        const { data: newOrg, error: orgError } = await supabase
            .from('organizations')
            .insert([{ name: organizationName }])
            .select()
            .single();

        if (orgError) throw orgError;
        organizationId = newOrg.id;

        // Update user's profile with the new organization AND full admin permissions
        const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({
                organization_id: organizationId,
                permissions: {
                    dataScope: 'battalion',
                    screens: {
                        personnel: 'edit',
                        attendance: 'edit',
                        tasks: 'edit',
                        stats: 'edit',
                        settings: 'edit',
                        reports: 'edit',
                        logs: 'edit',
                        lottery: 'edit',
                        constraints: 'edit',
                        equipment: 'edit',
                        dashboard: 'edit',
                        rotations: 'edit',
                        absences: 'edit'
                    }
                }
            })
            .eq('id', userId);

        if (updateProfileError) throw updateProfileError;
    }

    // 3. Create the battalion
    const { data: battalion, error: createError } = await supabase
        .from('battalions')
        .insert([{ name, code }])
        .select()
        .single();

    if (createError) throw createError;

    // 4. Link the organization to the battalion and mark it as HQ
    const { error: orgError } = await supabase
        .from('organizations')
        .update({
            battalion_id: battalion.id,
            is_hq: true
        })
        .eq('id', organizationId);

    if (orgError) throw orgError;

    return battalion as Battalion;
};

/**
 * Generates a unique short code for battalion linking.
 */
export const generateBattalionLinkCode = async (): Promise<string> => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let isUnique = false;

    while (!isUnique) {
        code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const { data, error } = await supabase
            .from('battalions')
            .select('id')
            .eq('code', code)
            .maybeSingle();

        if (error) throw error;
        if (!data) isUnique = true;
    }

    return code;
};

/**
 * Joins an organization to a battalion using a link code.
 * Restricted to organization admins in the UI.
 */
export const joinBattalion = async (code: string, organizationId: string) => {
    // 1. Find the battalion
    const { data: battalion, error: findError } = await supabase
        .from('battalions')
        .select('id')
        .eq('code', code)
        .single();

    if (findError) throw new Error('Invalid battalion code');

    // 2. Link the organization
    const { error: linkError } = await supabase
        .from('organizations')
        .update({ battalion_id: battalion.id })
        .eq('id', organizationId);

    if (linkError) throw linkError;

    return battalion.id;
};

/**
 * Fetches the battalion details for a given ID.
 */
export const fetchBattalion = async (battalionId: string): Promise<Battalion> => {
    const { data, error } = await supabase
        .from('battalions')
        .select('*')
        .eq('id', battalionId)
        .single();

    if (error) throw error;
    return data as Battalion;
};

/**
 * Fetches all organizations linked to a battalion.
 */
export const fetchBattalionCompanies = async (battalionId: string): Promise<Organization[]> => {
    const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('battalion_id', battalionId);

    if (error) throw error;
    return data as Organization[];
};

/**
 * Fetches all people belonging to a battalion.
 */
export const fetchBattalionPeople = async (battalionId: string): Promise<Person[]> => {
    const { data: companies } = await supabase.from('organizations').select('id').eq('battalion_id', battalionId);
    if (!companies || companies.length === 0) return [];

    const ids = companies.map(c => c.id);
    const { data, error } = await supabase
        .from('people')
        .select('*')
        .in('organization_id', ids);

    if (error) throw error;
    return (data || []).map(p => mapPersonFromDB(p as any));
};

/**
 * Fetches today's presence summary for the entire battalion.
 */
export const fetchBattalionPresenceSummary = async (battalionId: string, date?: string): Promise<DailyPresenceSummary[]> => {
    const { data: companies } = await supabase.from('organizations').select('id').eq('battalion_id', battalionId);
    if (!companies || companies.length === 0) return [];

    const ids = companies.map(c => c.id);
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
        .from('daily_presence')
        .select(`
            id,
            status,
            person_id,
            organization_id,
            date,
            start_time,
            end_time,
            arrival_date,
            departure_date,
            people (
                name
            )
        `)
        .in('organization_id', ids)
        .eq('date', targetDate);

    if (error) throw error;
    
    // Map raw response to typed object, handling potential array/object mismatch for joined relation
    return (data || []).map((item: any) => ({
        ...item,
        people: Array.isArray(item.people) ? item.people[0] : item.people
    })) as DailyPresenceSummary[];
};

/**
 * Unlinks an organization from its battalion.
 */
export const unlinkBattalion = async (organizationId: string) => {
    const { error } = await supabase
        .from('organizations')
        .update({ battalion_id: null, is_hq: false })
        .eq('id', organizationId);

    if (error) throw error;
};

/**
 * Updates the morning report snapshot time for a battalion.
 */
export const updateBattalionMorningReportTime = async (battalionId: string, time: string) => {
    const { error } = await supabase
        .from('battalions')
        .update({ morning_report_time: time })
        .eq('id', battalionId);

    if (error) throw error;
};
