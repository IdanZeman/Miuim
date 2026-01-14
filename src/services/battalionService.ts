import { supabase } from '../lib/supabase';
import { Battalion, Profile, Organization, Person, TeamRotation, DailyPresence, Absence, HourlyBlockage, DailyPresenceSummary } from '../types';
import { mapPersonFromDB } from './mappers';
import { getEffectiveAvailability } from '../utils/attendanceUtils';

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
        .from('unified_presence')
        .select('*, last_editor:profiles(full_name)')
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

/**
 * Triggers the manual capture of battalion snapshots via RPC.
 */
export const captureBattalionSnapshots = async () => {
    // 1. Auth & Context
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) throw new Error('No organization found');

    const { data: org } = await supabase.from('organizations').select('battalion_id').eq('id', profile.organization_id).single();
    if (!org?.battalion_id) throw new Error('No battalion linked');

    const battalionId = org.battalion_id;

    // 2. Fetch Data Scope
    const { data: companies } = await supabase.from('organizations').select('id').eq('battalion_id', battalionId);
    if (!companies || companies.length === 0) return;
    const orgIds = companies.map(c => c.id);

    const today = new Date();
    const dateKey = today.toLocaleDateString('en-CA');

    // 3. Parallel Fetch of All Attendance Factors
    const [
        { data: rawPeople },
        { data: rotations },
        { data: unifiedPresence },
        { data: absences },
        { data: blockages }
    ] = await Promise.all([
        supabase.from('people').select('*').in('organization_id', orgIds),
        supabase.from('team_rotations').select('*').in('organization_id', orgIds),
        supabase.from('unified_presence').select('*').in('organization_id', orgIds).eq('date', dateKey),
        supabase.from('absences').select('*').in('organization_id', orgIds).lte('start_date', dateKey).gte('end_date', dateKey).neq('status', 'rejected'),
        supabase.from('hourly_blockages').select('*').in('organization_id', orgIds).eq('date', dateKey)
    ]);

    const people = (rawPeople || []).map(p => mapPersonFromDB(p));

    // 4. Calculate Snapshots
    const nowISO = today.toISOString();
    const nowTime = today.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const snapshots = people.map(person => {
        // Calculate Effective Status using the same logic as the UI
        const effective = getEffectiveAvailability(
            person,
            today,
            (rotations || []) as TeamRotation[],
            (absences || []) as Absence[],
            (blockages || []) as HourlyBlockage[],
            (unifiedPresence || []) as DailyPresence[]
        );

        return {
            organization_id: person.organization_id,
            person_id: person.id,
            date: dateKey,
            status: effective.status,
            start_time: effective.startHour,
            end_time: effective.endHour,
            captured_at: nowISO,
            snapshot_definition_time: nowTime
        };
    });

    // 5. Insert
    if (snapshots.length > 0) {
        const { error } = await supabase.from('daily_attendance_snapshots').insert(snapshots);
        if (error) throw error;
    }
};

/**
 * Deletes a batch of snapshots for a specific date and timestamp.
 */
export const deleteSnapshotBatch = async (date: string, capturedAt: string) => {
    const { error } = await supabase
        .from('daily_attendance_snapshots')
        .delete()
        .eq('date', date)
        .eq('captured_at', capturedAt);

    if (error) throw error;
};
