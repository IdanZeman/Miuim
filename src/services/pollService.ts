import { supabase } from '../lib/supabase';
import { Poll, PollResponse } from '../types';

/**
 * Fetch all polls for an organization
 */
export const fetchPolls = async (organizationId: string): Promise<Poll[]> => {
    const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
};

/**
 * Create a new poll
 */
export const addPoll = async (poll: Omit<Poll, 'id' | 'created_at'>): Promise<Poll> => {
    const { data, error } = await supabase
        .from('polls')
        .insert([poll])
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Update an existing poll
 */
export const updatePoll = async (id: string, updates: Partial<Poll>): Promise<Poll> => {
    const { data, error } = await supabase
        .from('polls')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Submit a response to a poll
 */
export const submitPollResponse = async (response: Omit<PollResponse, 'id' | 'created_at'>): Promise<PollResponse> => {
    const { data, error } = await supabase
        .from('poll_responses')
        .insert([response])
        .select()
        .single();

    if (error) throw error;
    return data;
};

/**
 * Fetch all responses for a specific poll with user names
 */
export const fetchPollResults = async (pollId: string): Promise<PollResponse[]> => {
    console.log('Fetching poll results for:', pollId);

    // First, get all responses
    const { data: responsesData, error: responsesError } = await supabase
        .from('poll_responses')
        .select('*')
        .eq('poll_id', pollId);

    console.log('Poll responses data:', responsesData);
    console.log('Poll responses error:', responsesError);

    if (responsesError) {
        console.error('Error fetching poll responses:', responsesError);
        throw responsesError;
    }

    if (!responsesData || responsesData.length === 0) {
        console.log('No responses found');
        return [];
    }

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
    // Priority: people table (if linked) > profiles table
    const userInfoMap = new Map<string, { name: string; email: string }>();

    // First, add profiles data
    (profilesRes.data || []).forEach(profile => {
        userInfoMap.set(profile.id, {
            name: profile.full_name || 'משתמש',
            email: profile.email || ''
        });
    });

    // Then, override with people data if exists (higher priority)
    (peopleRes.data || []).forEach(person => {
        if (person.user_id) {
            userInfoMap.set(person.user_id, {
                name: person.name || 'משתמש',
                email: person.email || userInfoMap.get(person.user_id)?.email || ''
            });
        }
    });

    // Combine responses with user info
    const transformed = responsesData.map(response => {
        const userInfo = userInfoMap.get(response.user_id);
        return {
            ...response,
            user_name: userInfo?.name || 'משתמש לא ידוע',
            user_email: userInfo?.email || ''
        };
    });

    console.log('Transformed poll results:', transformed);
    return transformed;
};

/**
 * Fetch a single poll by ID
 */
export const fetchPollById = async (pollId: string): Promise<Poll | null> => {
    const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('id', pollId)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
};
/**
 * Check if a user has already responded to a poll
 */
export const checkUserPollResponse = async (pollId: string, userId: string): Promise<boolean> => {
    const { data, error, count } = await supabase
        .from('poll_responses')
        .select('*', { count: 'exact', head: true })
        .eq('poll_id', pollId)
        .eq('user_id', userId);

    if (error) throw error;
    return (count || 0) > 0;
};
