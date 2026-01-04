import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../features/auth/AuthContext';

export interface AuthorizedVehicle {
    id: string;
    organization_id: string;
    plate_number: string;
    owner_name: string;
    vehicle_type: string;
    is_permanent: boolean;
    valid_from: string | null;     // Changed from created_at/implied now
    valid_until: string | null;    // Changed from expiry_date
    notes: string | null;
    organizations?: { name: string };
}

export interface GateLog {
    id: string;
    organization_id: string;
    plate_number: string;
    driver_name: string;
    entry_time: string;
    exit_time: string | null;
    status: 'inside' | 'left';
    notes: string | null;
    entry_type?: 'vehicle' | 'pedestrian'; // NEW
    is_exceptional?: boolean; // NEW
    entry_reported_by?: string; // NEW
    exit_reported_by?: string; // NEW
    organizations?: { name: string; battalion_id: string }; // Joined Data
    entry_reporter?: { full_name: string }; // NEW: Joined Reporter
    exit_reporter?: { full_name: string }; // NEW: Joined Reporter
}

export const useGateSystem = () => {
    const { organization, profile, checkAccess } = useAuth();
    const [authorizedVehicles, setAuthorizedVehicles] = useState<AuthorizedVehicle[]>([]);
    const [activeLogs, setActiveLogs] = useState<GateLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // State for Battalion Data (Gate Only)
    const [battalionOrganizations, setBattalionOrganizations] = useState<{ id: string; name: string }[]>([]);
    const [battalionTeams, setBattalionTeams] = useState<{ id: string; name: string; organization_id: string }[]>([]); // New State

    // Fetches all data (logs, vehicles, organization structure)
    const fetchData = useCallback(async () => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;

        if (!oid && !bid) return;

        const battalionId = bid;

        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch Battalion Organizations first to use their IDs for filtering
            let orgsData: { id: string; name: string }[] = [];
            if (battalionId) {
                const { data, error: orgsErr } = await supabase
                    .from('organizations')
                    .select('id, name')
                    .eq('battalion_id', battalionId);
                if (orgsErr) throw orgsErr;
                orgsData = data || [];
            } else {
                orgsData = [{ id: organization?.id || '', name: organization?.name || '' }];
            }
            setBattalionOrganizations(orgsData);

            const orgsIds = orgsData.map(o => o.id);
            if (orgsIds.length === 0 && !battalionId) return;

            // 2. Run Logs and Vehicles queries in parallel using the IDs
            const [logsRes, vehiclesRes] = await Promise.all([
                // Fetch Active Logs
                (() => {
                    let q = supabase
                        .from('gate_logs')
                        .select('*, organizations(name, battalion_id), entry_reporter:profiles!entry_reported_by(full_name), exit_reporter:profiles!exit_reported_by(full_name)')
                        .eq('status', 'inside')
                        .order('entry_time', { ascending: false });

                    if (battalionId && orgsIds.length > 0) {
                        q = q.in('organization_id', orgsIds);
                    } else {
                        q = q.eq('organization_id', organization?.id || '');
                    }
                    return q;
                })(),

                // Fetch Authorized Vehicles
                (() => {
                    let q = supabase
                        .from('gate_authorized_vehicles')
                        .select('*, organizations(name, battalion_id)');

                    if (battalionId && orgsIds.length > 0) {
                        q = q.in('organization_id', orgsIds);
                    } else {
                        q = q.eq('organization_id', organization?.id || '');
                    }
                    return q;
                })(),
            ]);

            if (logsRes.error) throw logsRes.error;
            if (vehiclesRes.error) throw vehiclesRes.error;

            setActiveLogs((logsRes.data as any) || []);
            setAuthorizedVehicles((vehiclesRes.data as any) || []);

            // 3. Fetch Teams for these Organizations
            if (orgsIds.length > 0) {
                const { data: teams, error: teamsError } = await supabase
                    .from('teams')
                    .select('id, name, organization_id')
                    .in('organization_id', orgsIds);

                if (teamsError) throw teamsError;
                setBattalionTeams(teams || []);
            }

        } catch (err: any) {
            console.error('Error fetching gate data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [organization?.id, organization?.battalion_id, organization?.name, profile?.battalion_id]);

    // Initial Load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Real-time Subscription logic (Battalion Wide)
    useEffect(() => {
        if (!organization?.id || battalionOrganizations.length === 0) return;

        // Create a Set of allowed Org IDs for fast lookup
        const allowedOrgIds = new Set(battalionOrganizations.map(o => o.id));

        const logsSubscription = supabase
            .channel('gate_logs_battalion_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'gate_logs',
                    // No filter string = listen to all rows (subject to RLS)
                    // We will filter client-side to be sure we only react to relevant events
                },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;

                    // Client-Side Filter: Check if the event belongs to our battalion
                    const recordOrgId = (newRecord as any)?.organization_id || (oldRecord as any)?.organization_id;
                    const recordBattalionId = (newRecord as any)?.battalion_id || (oldRecord as any)?.battalion_id;

                    const bid = profile?.battalion_id || organization?.battalion_id;
                    if (!allowedOrgIds.has(recordOrgId) && recordBattalionId !== bid) {
                        return; // Ignore events from outside our battalion
                    }

                    if (eventType === 'INSERT') {
                        const log = newRecord as GateLog;
                        if (log.status === 'inside') {
                            fetchData(); // Refetch to get joined organization data
                        }
                    } else if (eventType === 'UPDATE') {
                        const log = newRecord as GateLog;
                        if (log.status === 'left') {
                            setActiveLogs((prev) => prev.filter((l) => l.id !== log.id));
                        } else {
                            fetchData(); // Refetch updates
                        }
                    } else if (eventType === 'DELETE') {
                        setActiveLogs((prev) => prev.filter((l) => l.id !== oldRecord.id));
                    }
                }
            )
            .subscribe();

        return () => {
            logsSubscription.unsubscribe();
        };
    }, [organization?.id, battalionOrganizations, fetchData]);

    // Dynamic search for people (Used for Pedestrian Entry)
    const searchPeople = useCallback(async (query: string) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return [];
        if (query.length < 2) return [];

        try {
            let q = supabase
                .from('people')
                .select('id, name, phone, organization_id, team_id, organizations!inner(battalion_id)')
                .ilike('name', `%${query}%`)
                .limit(10);

            if (bid) {
                // If the column battalion_id exists on people, use q.eq('battalion_id', bid)
                // For now, it's linked via organizations
                q = q.eq('organizations.battalion_id', bid);
            } else {
                q = q.eq('organization_id', organization?.id || '');
            }

            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Error searching people:', err);
            return [];
        }
    }, [organization?.id, organization?.battalion_id, profile?.battalion_id]);

    // Enhanced Check Vehicle: Checks loaded auth vehicles
    const checkVehicle = useCallback(async (plateNumber: string) => {
        // 1. Check loaded authorized vehicles (Fast/Client-side)
        const now = new Date();
        const knownAuth = authorizedVehicles.find((v) => {
            if (v.plate_number !== plateNumber) return false;

            // If it's permanent, it's always authorized
            if (v.is_permanent) return true;

            // Check time limits for temporary
            const from = v.valid_from ? new Date(v.valid_from) : null;
            const until = v.valid_until ? new Date(v.valid_until) : null;

            if (from && now < from) return false;
            if (until && now > until) return false;

            return true;
        });

        if (knownAuth) return knownAuth;

        // 2. If not found, return null
        return null;

    }, [authorizedVehicles]);

    const registerEntry = async (data: {
        plate_number: string;
        driver_name: string;
        notes?: string;
        entry_type?: 'vehicle' | 'pedestrian';
        is_exceptional?: boolean; // NEW
        status?: 'inside' | 'left'; // Allow specifying status
        exit_time?: string; // Allow specifying exit time
    }) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return { success: false, error: 'No organization or battalion ID found' };
        if (!profile?.id) return { success: false, error: 'No user ID found' };

        try {
            // Let's find the vehicle (or person) owner organization
            let targetOrgId = oid;

            // Try to find in authorized vehicles (works for both cars and pedestrian IDs if we store them there)
            const knownVehicle = authorizedVehicles.find(v => v.plate_number === data.plate_number);
            if (knownVehicle) {
                targetOrgId = knownVehicle.organization_id;
            }

            // Calculate local time ISO string (Israel time +2/3)
            // Just using Date.now() + offset is simplest hack for "Local Time in DB" request 
            // OR better: construct a Date object that LOOKS like local time but is UTC
            const entryTime = new Date().toISOString();

            const { error } = await supabase.from('gate_logs').insert([
                {
                    organization_id: targetOrgId || profile?.organization_id || null,
                    battalion_id: bid || null,
                    plate_number: data.plate_number,
                    driver_name: data.driver_name,
                    notes: data.notes,
                    status: data.status || 'inside',
                    entry_type: data.entry_type || 'vehicle',
                    is_exceptional: data.is_exceptional || false,
                    entry_reported_by: profile.id,
                    exit_reported_by: data.status === 'left' ? profile.id : null,
                    entry_time: entryTime,
                    exit_time: data.exit_time || null
                },
            ]);

            if (error) throw error;
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error registering entry:', err);
            return { success: false, error: err.message };
        }
    };

    const registerExit = async (logId: string) => {
        if (!profile?.id) return { success: false, error: 'No user ID found' };
        const previousLogs = [...activeLogs];
        setActiveLogs((prev) => prev.filter((l) => l.id !== logId));

        try {
            const exitTime = new Date().toISOString();

            const { error } = await supabase
                .from('gate_logs')
                .update({
                    status: 'left',
                    exit_time: exitTime,
                    exit_reported_by: profile.id, // NEW: Save exit reporter
                })
                .eq('id', logId);

            if (error) throw error;
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error registering exit:', err);
            setActiveLogs(previousLogs);
            return { success: false, error: err.message };
        }
    };

    // Fetch History
    const fetchGateHistory = useCallback(async (filters: {
        search?: string;
        orgId?: string;
        startDate?: Date | null;
        endDate?: Date | null;
        limit?: number
    }) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return { data: [], error: 'No organization or battalion' };

        try {
            console.log('Fetching history with params:', { battalionId: bid, orgId: oid, filters });

            let query = supabase
                .from('gate_logs')
                .select('*, organizations(name, battalion_id), entry_reporter:profiles!entry_reported_by(full_name), exit_reporter:profiles!exit_reported_by(full_name)')
                .order('entry_time', { ascending: false })
                .limit(filters.limit || 50);

            // Battalion Scope
            if (bid) {
                query = query.eq('battalion_id', bid);
            } else {
                query = query.eq('organization_id', oid);
            }

            // Filters
            if (filters.orgId && filters.orgId !== 'all') {
                query = query.eq('organization_id', filters.orgId);
            }

            if (filters.search) {
                const term = filters.search;
                // Filter by plate OR driver name
                query = query.or(`plate_number.ilike.%${term}%,driver_name.ilike.%${term}%`);
            }

            if (filters.startDate) {
                query = query.gte('entry_time', filters.startDate.toISOString());
            }

            if (filters.endDate) {
                const endOfDay = new Date(filters.endDate);
                endOfDay.setHours(23, 59, 59, 999);
                query = query.lte('entry_time', endOfDay.toISOString());
            }

            const { data, error } = await query;
            if (error) throw error;

            return { data: data as GateLog[], error: null };

        } catch (err: any) {
            console.error('Error fetching history:', err);
            return { data: [], error: err.message };
        }
    }, [organization?.id, organization?.battalion_id]);

    // CRUD for Authorized Vehicles
    const addAuthorizedVehicle = async (vehicle: Omit<AuthorizedVehicle, 'id'>) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        try {
            const { data, error } = await supabase
                .from('gate_authorized_vehicles')
                .insert([{ ...vehicle, battalion_id: bid }])
                .select('*, organizations(name, battalion_id)')
                .single();

            if (error) throw error;

            // Optimistic / Real update
            setAuthorizedVehicles(prev => [...prev, data as any]);
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error adding vehicle:', err);
            return { success: false, error: err.message };
        }
    };

    const updateAuthorizedVehicle = async (vehicleId: string, vehicle: Partial<AuthorizedVehicle>) => {
        try {
            const { data, error } = await supabase
                .from('gate_authorized_vehicles')
                .update(vehicle)
                .eq('id', vehicleId)
                .select('*, organizations(name, battalion_id)')
                .single();

            if (error) throw error;

            setAuthorizedVehicles(prev => prev.map(v => v.id === vehicleId ? (data as any) : v));
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error updating vehicle:', err);
            return { success: false, error: err.message };
        }
    };

    const deleteAuthorizedVehicle = async (vehicleId: string) => {
        try {
            const { error } = await supabase
                .from('gate_authorized_vehicles')
                .delete()
                .eq('id', vehicleId);

            if (error) throw error;

            setAuthorizedVehicles(prev => prev.filter(v => v.id !== vehicleId));
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error deleting vehicle:', err);
            return { success: false, error: err.message };
        }
    };

    return {
        authorizedVehicles,
        activeLogs,
        battalionOrganizations,
        battalionTeams,
        searchPeople, // New search function
        isLoading,
        error,
        registerEntry,
        registerExit,
        checkVehicle,
        addAuthorizedVehicle,
        updateAuthorizedVehicle,
        deleteAuthorizedVehicle,
        fetchGateHistory // Exported
    };
};

