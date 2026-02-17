import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Fetch all polls for an organization
 */
export const get_polls = async (supabase: SupabaseClient, params: { p_organization_id: string }) => {
    const { p_organization_id } = params;
    const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('organization_id', p_organization_id)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

/**
 * Create a new poll
 */
export const create_poll = async (supabase: SupabaseClient, params: { p_poll: any }) => {
    const { p_poll } = params;
    const { data, error } = await supabase
        .from('polls')
        .insert([p_poll])
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Update an existing poll
 */
export const update_poll = async (supabase: SupabaseClient, params: { p_id: string, p_updates: any }) => {
    const { p_id, p_updates } = params;
    const { data, error } = await supabase
        .from('polls')
        .update(p_updates)
        .eq('id', p_id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Submit a response to a poll
 */
export const submit_poll_response = async (supabase: SupabaseClient, params: { p_response: any }) => {
    const { p_response } = params;
    const { data, error } = await supabase
        .from('poll_responses')
        .insert([p_response])
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Fetch all responses for a specific poll with user names
 */
export const get_poll_results = async (supabase: SupabaseClient, params: { p_poll_id: string }) => {
    const { p_poll_id } = params;

    // First, get all responses
    const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', p_poll_id);

    if (responsesError) throw responsesError;
    if (!responsesData || responsesData.length === 0) return [];

    // Get unique user IDs
    const userIds = [...new Set(responsesData.map(r => r.user_id))];

    // Fetch from both people and profiles tables
    const [peopleRes, profilesRes] = await Promise.all([
        supabase
            .from('people')
            .select('user_id, name, email')
            .in('user_id', userIds),
        supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', userIds)
    ]);

    // Create a map of user IDs to user info
    const userInfoMap = new Map<string, { name: string; email: string }>();

    // Profiles data (lower priority)
    (profilesRes.data || []).forEach(profile => {
        userInfoMap.set(profile.id, {
            name: profile.full_name || 'משתמש',
            email: profile.email || ''
        });
    });

    // People data (higher priority)
    (peopleRes.data || []).forEach(person => {
        if (person.user_id) {
            userInfoMap.set(person.user_id, {
                name: person.name || 'משתמש',
                email: person.email || userInfoMap.get(person.user_id)?.email || ''
            });
        }
    });

    // Combine responses with user info
    return responsesData.map(response => {
        const userInfo = userInfoMap.get(response.user_id);
        return {
            ...response,
            user_name: userInfo?.name || 'משתמש לא ידוע',
            user_email: userInfo?.email || ''
        };
    });
};

/**
 * Check if a user has already responded to a poll
 */
export const check_user_response = async (supabase: SupabaseClient, params: { p_poll_id: string, p_user_id: string }) => {
    const { p_poll_id, p_user_id } = params;
    const { count, error } = await supabase
        .from('poll_responses')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', p_poll_id)
        .eq('user_id', p_user_id);

    if (error) throw error;
    return { has_responded: (count || 0) > 0 };
};
