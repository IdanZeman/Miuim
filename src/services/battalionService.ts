import { supabase } from '../lib/supabase';
import { Battalion, Profile, Organization, Person } from '../types';
import { mapPersonFromDB } from './mappers';

/**
 * Creates a new battalion and marks the user's organization as HQ.
 * If the user doesn't have an organization, creates one first.
 */
export const createBattalion = async (name: string, organizationName?: string) => {
    const { data, error } = await supabase.rpc('create_battalion', {
        p_name: name,
        p_organization_name: organizationName || null
    });

    if (error) throw error;
    return data?.data as Battalion;
};

/**
 * Generates a unique short code for battalion linking.
 * @deprecated Now handled by RPC generate_battalion_link_code()
 */
export const generateBattalionLinkCode = async (): Promise<string> => {
    throw new Error('This function is deprecated. Code generation now happens in RPC.');
};

/**
 * Joins an organization to a battalion using a link code.
 * Restricted to organization admins in the UI.
 */
export const joinBattalion = async (code: string, organizationId: string) => {
    const { data, error } = await supabase.rpc('join_battalion', {
        p_code: code,
        p_organization_id: organizationId
    });

    if (error) throw error;
    return data?.battalion_id as string;
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
export const fetchBattalionPresenceSummary = async (battalionId: string, date?: string) => {
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
    return data;
};

/**
 * Unlinks an organization from its battalion.
 */
export const unlinkBattalion = async (organizationId: string) => {
    const { data, error } = await supabase.rpc('unlink_battalion', {
        p_organization_id: organizationId
    });

    if (error) throw error;
    return data;
};

/**
 * Creates a new company under a battalion and ensures the creator has full permissions.
 */
export const createCompanyUnderBattalion = async (battalionId: string, name: string) => {
    const { data, error } = await supabase.rpc('create_company_under_battalion', {
        p_battalion_id: battalionId,
        p_name: name
    });

    if (error) throw error;
    return data?.data as Organization;
};

/**
 * Updates the morning report snapshot time for a battalion.
 */
export const updateBattalionMorningReportTime = async (battalionId: string, time: string) => {
    const { data, error } = await supabase.rpc('update_battalion_morning_report_time', {
        p_battalion_id: battalionId,
        p_time: time
    });

    if (error) throw error;
    return data;
};
