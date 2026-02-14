import { supabase } from '../lib/supabase';
import { Battalion, Profile, Organization, Person } from '../types';
import { mapPersonFromDB } from './mappers';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

/**
 * Creates a new battalion and marks the user's organization as HQ.
 * If the user doesn't have an organization, creates one first.
 */
export const createBattalion = async (name: string, organizationName?: string) => {
    const data = await callAdminRpc('create_battalion', {
        p_name: name,
        p_organization_name: organizationName || null
    });

    return (data as any)?.data as Battalion;
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
    const data = await callAdminRpc('join_battalion', {
        p_code: code,
        p_organization_id: organizationId
    });

    return (data as any)?.battalion_id as string;
};

/**
 * Fetches the battalion details for a given ID.
 * (Direct query is acceptable if it doesn't involve complex RPC logic)
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
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) throw new Error('No active session found');

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/battalion/people?battalionId=${battalionId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch battalion people from backend');
        }

        const data = await response.json();
        return (data || []).map(p => mapPersonFromDB(p as any));
    } catch (error) {
        console.error('❌ [battalionService] fetchBattalionPeople failed:', error);
        throw error;
    }
};

/**
 * Fetches today's presence summary for the entire battalion.
 */
export const fetchBattalionPresenceSummary = async (battalionId: string, date?: string) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) throw new Error('No active session found');

        const targetDate = date || new Date().toISOString().split('T')[0];
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

        const response = await fetch(`${apiUrl}/api/battalion/presence?battalionId=${battalionId}&date=${targetDate}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch battalion presence summary from backend');
        }

        const data = await response.json();
        return (data || []).map((record: any) => ({
            ...record,
            people: {
                name: record.person_name
            }
        }));
    } catch (error) {
        console.error('❌ [battalionService] fetchBattalionPresenceSummary failed:', error);
        throw error;
    }
};

/**
 * Unlinks an organization from its battalion.
 */
export const unlinkBattalion = async (organizationId: string) => {
    return await callAdminRpc('unlink_battalion', {
        p_organization_id: organizationId
    });
};

/**
 * Creates a new company under a battalion and ensures the creator has full permissions.
 */
export const createCompanyUnderBattalion = async (battalionId: string, name: string) => {
    const data = await callAdminRpc('create_company_under_battalion', {
        p_battalion_id: battalionId,
        p_name: name
    });

    return (data as any)?.data as Organization;
};

/**
 * Updates the morning report snapshot time for a battalion.
 */
export const updateBattalionMorningReportTime = async (battalionId: string, time: string) => {
    return await callAdminRpc('update_battalion_morning_report_time', {
        p_battalion_id: battalionId,
        p_time: time
    });
};
