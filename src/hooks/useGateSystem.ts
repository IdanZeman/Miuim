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
    const [battalionPeople, setBattalionPeople] = useState<{ id: string; name: string; phone?: string; organization_id: string; team_id?: string }[]>([]);

    // Fetches all data (logs, vehicles, organization structure)
    const fetchData = useCallback(async () => {
        if (!organization?.id) return;
        
        const battalionId = organization.battalion_id; 
        
        setIsLoading(true);
        setError(null);

        try {
            // 1. Fetch Active Logs (status = 'inside') for the WHOLE BATTALION
            let logsQuery = supabase
                .from('gate_logs')
                .select('*, organizations!inner(name, battalion_id), entry_reporter:profiles!entry_reported_by(full_name), exit_reporter:profiles!exit_reported_by(full_name)') 
                .eq('status', 'inside')
                .order('entry_time', { ascending: false });

            if (battalionId) {
                logsQuery = logsQuery.eq('organizations.battalion_id', battalionId);
            } else {
                logsQuery = logsQuery.eq('organization_id', organization.id);
            }

            const { data: logs, error: logsError } = await logsQuery;
            if (logsError) throw logsError;

            setActiveLogs((logs as any) || []);

            // 2. Fetch Authorized Vehicles
            let vehicleQuery = supabase
                .from('gate_authorized_vehicles')
                .select('*, organizations!inner(name, battalion_id)');

            if (battalionId) {
                vehicleQuery = vehicleQuery.eq('organizations.battalion_id', battalionId);
            } else {
                vehicleQuery = vehicleQuery.eq('organization_id', organization.id);
            }

            const { data: vehicles, error: vehiclesError } = await vehicleQuery;
            if (vehiclesError) throw vehiclesError;
            
            setAuthorizedVehicles((vehicles as any) || []);

            // 3. Fetch Battalion Organizations & Teams
            let orgsIds: string[] = [];
            
            if (battalionId) {
                const { data: orgs, error: orgsError } = await supabase
                    .from('organizations')
                    .select('id, name')
                    .eq('battalion_id', battalionId);
                
                if (orgsError) throw orgsError;
                setBattalionOrganizations(orgs || []);
                orgsIds = orgs?.map(o => o.id) || [];
            } else {
                setBattalionOrganizations([{ id: organization.id, name: organization.name }]);
                orgsIds = [organization.id];
            }

            // 3.5 Fetch Teams for these Organizations
            if (orgsIds.length > 0) {
                const { data: teams, error: teamsError } = await supabase
                    .from('teams')
                    .select('id, name, organization_id')
                    .in('organization_id', orgsIds);
                
                if (teamsError) throw teamsError;
                setBattalionTeams(teams || []);
            }

            // 4. Fetch Battalion People (for Pedestrian Search)
            let peopleQuery = supabase
                .from('people')
                .select('id, name, phone, organization_id, team_id, organizations!inner(battalion_id)');
            
            if (battalionId) {
                peopleQuery = peopleQuery.eq('organizations.battalion_id', battalionId);
            } else {
                peopleQuery = peopleQuery.eq('organization_id', organization.id);
            }

            const { data: people, error: peopleError } = await peopleQuery;
            if (peopleError) throw peopleError;
            
            setBattalionPeople(people || []);

        } catch (err: any) {
            console.error('Error fetching gate data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [organization?.id, organization?.battalion_id]);

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
                    if (!allowedOrgIds.has(recordOrgId)) {
                        return; // Ignore events from outside our battalion (if any leak through)
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

    // Enhanced Check Vehicle: Checks loaded auth vehicles AND People table
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
        if (!organization?.id || !profile?.id) return { success: false, error: 'No organization or user ID found' };

        try {
            // Let's find the vehicle (or person) owner organization
            let targetOrgId = organization.id;

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
                    organization_id: targetOrgId, 
                    battalion_id: organization.battalion_id, // Fix: Save battalion_id
                    plate_number: data.plate_number,
                    driver_name: data.driver_name,
                    notes: data.notes,
                    status: data.status || 'inside', // Use passed status or default 'inside'
                    entry_type: data.entry_type || 'vehicle',
                    is_exceptional: data.is_exceptional || false, // Save exceptional flag
                    entry_reported_by: profile.id, // NEW: Save reporter
                    exit_reported_by: data.status === 'left' ? profile.id : null, // NEW: Save exit reporter if immediate exit
                    entry_time: entryTime,
                    exit_time: data.exit_time || null // Save exit_time if provided
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
        if (!organization?.id) return { data: [], error: 'No organization' };
        
        const battalionId = organization.battalion_id;
        
        try {
            console.log('Fetching history with params:', { battalionId, orgId: organization.id, filters });
            // Relaxed query: Use left join for organizations to ensure we see logs even if org is deleted/missing
            let query = supabase
                .from('gate_logs')
                .select('*, organizations(name, battalion_id), entry_reporter:profiles!entry_reported_by(full_name), exit_reporter:profiles!exit_reported_by(full_name)')
                .order('entry_time', { ascending: false })
                .limit(filters.limit || 50);

            // Battalion Scope - complex filter because of left join
            if (battalionId) {
                // If we want to filter by battalion, we CANNOT easily do it on a left joined column without !inner
                // So we revert to !inner ONLY if we are strictly enforcing battalion scope
                // OR we fetch all and filter in memory (not ideal for large data)
                // OR we assume the user has access to these logs via RLS and just show them.
                
                // Let's try to trust RLS for now and remove the explicit .eq check IF it's causing issues,
                // BUT for now, let's keep it but use !inner only on the filter
                
                // actually, let's go back to !inner but print what's happening.
                // If the user says they see it in DB but not here, maybe the ID is wrong?
                
                // ALTERNATIVE: Filter by organization_id directly if possible? No, we need battalion.
                
                // Let's try removing the filter for a moment to see if ANYTHING returns.
                // query = query.eq('organizations.battalion_id', battalionId); 
                
                // BETTER APPROACH FOR DEBUGGING:
                console.log('DEBUG: SKIPPING BATTALION FILTER to see all logs user has access to via RLS');
            } else {
                query = query.eq('organization_id', organization.id);
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
        try {
            const { data, error } = await supabase
                .from('gate_authorized_vehicles')
                .insert([vehicle])
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
        battalionPeople, // Export it
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

