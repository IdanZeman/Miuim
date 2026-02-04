import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../features/auth/AuthContext';
import { gateService } from '../services/gateService';
import { supabase } from '../services/supabaseClient'; // Still needed for subscription

export interface AuthorizedVehicle {
    id: string;
    organization_id: string;
    plate_number: string;
    owner_name: string;
    vehicle_type: string;
    is_permanent: boolean;
    valid_from: string | null;     
    valid_until: string | null;    
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
    entry_type?: 'vehicle' | 'pedestrian'; 
    is_exceptional?: boolean; 
    entry_reported_by?: string; 
    exit_reported_by?: string; 
    organizations?: { name: string; battalion_id: string }; 
    entry_reporter?: { full_name: string }; 
    exit_reporter?: { full_name: string }; 
}

export const useGateSystem = () => {
    const { organization, profile, checkAccess } = useAuth();
    const [authorizedVehicles, setAuthorizedVehicles] = useState<AuthorizedVehicle[]>([]);
    const [activeLogs, setActiveLogs] = useState<GateLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [battalionOrganizations, setBattalionOrganizations] = useState<{ id: string; name: string }[]>([]);
    const [battalionTeams, setBattalionTeams] = useState<{ id: string; name: string; organization_id: string }[]>([]);

    const fetchData = useCallback(async () => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return;

        setIsLoading(true);
        setError(null);

        try {
            const orgsData = await gateService.fetchOrganizations(bid);
            setBattalionOrganizations(orgsData);

            const orgsIds = orgsData.map(o => o.id);
            if (orgsIds.length === 0 && !bid) return;

            const [logs, vehicles] = await Promise.all([
                gateService.fetchActiveLogs(orgsIds, oid!, bid),
                gateService.fetchAuthorizedVehicles(orgsIds, oid!, bid)
            ]);

            setActiveLogs(logs);
            setAuthorizedVehicles(vehicles);

            if (orgsIds.length > 0) {
                const teams = await gateService.fetchTeams(orgsIds);
                setBattalionTeams(teams);
            }
        } catch (err: any) {
            console.error('Error fetching gate data:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [organization?.id, organization?.battalion_id, organization?.name, profile?.battalion_id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (!organization?.id || battalionOrganizations.length === 0) return;
        const allowedOrgIds = new Set(battalionOrganizations.map(o => o.id));

        const logsSubscription = supabase
            .channel('gate_logs_battalion_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'gate_logs',
                },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;
                    const recordOrgId = (newRecord as any)?.organization_id || (oldRecord as any)?.organization_id;
                    const recordBattalionId = (newRecord as any)?.battalion_id || (oldRecord as any)?.battalion_id;
                    const bid = profile?.battalion_id || organization?.battalion_id;

                    if (!allowedOrgIds.has(recordOrgId) && recordBattalionId !== bid) {
                        return;
                    }

                    if (eventType === 'INSERT') {
                        const log = newRecord as GateLog;
                        if (log.status === 'inside') {
                            fetchData();
                        }
                    } else if (eventType === 'UPDATE') {
                        const log = newRecord as GateLog;
                        if (log.status === 'left') {
                            setActiveLogs((prev) => prev.filter((l) => l.id !== log.id));
                        } else {
                            fetchData();
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
    }, [organization?.id, battalionOrganizations, fetchData, profile?.battalion_id, organization?.battalion_id]);

    const searchPeople = useCallback(async (query: string) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return [];
        if (query.length < 2) return [];

        try {
            return await gateService.searchPeople(query, oid!, bid);
        } catch (err) {
            console.error('Error searching people:', err);
            return [];
        }
    }, [organization?.id, organization?.battalion_id, profile?.battalion_id]);

    const checkVehicle = useCallback(async (plateNumber: string) => {
        const now = new Date();
        const knownAuth = authorizedVehicles.find((v) => {
            if (v.plate_number !== plateNumber) return false;
            if (v.is_permanent) return true;
            const from = v.valid_from ? new Date(v.valid_from) : null;
            const until = v.valid_until ? new Date(v.valid_until) : null;
            if (from && now < from) return false;
            if (until && now > until) return false;
            return true;
        });
        return knownAuth || null;
    }, [authorizedVehicles]);

    const registerEntry = async (data: {
        plate_number: string;
        driver_name: string;
        notes?: string;
        entry_type?: 'vehicle' | 'pedestrian';
        is_exceptional?: boolean;
        status?: 'inside' | 'left';
        exit_time?: string;
    }) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return { success: false, error: 'No organization or battalion ID found' };
        if (!profile?.id) return { success: false, error: 'No user ID found' };

        try {
            let targetOrgId = oid;
            const knownVehicle = authorizedVehicles.find(v => v.plate_number === data.plate_number);
            if (knownVehicle) {
                targetOrgId = knownVehicle.organization_id;
            }

            const payload = {
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
                entry_time: new Date().toISOString(),
                exit_time: data.exit_time || null
            };

            await gateService.registerEntry(payload);
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
            await gateService.registerExit(logId, profile.id, new Date().toISOString());
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error registering exit:', err);
            setActiveLogs(previousLogs);
            return { success: false, error: err.message };
        }
    };

    const fetchGateHistory = useCallback(async (filters: any) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        const oid = organization?.id;
        if (!oid && !bid) return { data: [], error: 'No organization or battalion' };

        try {
            const data = await gateService.fetchGateHistory({
                ...filters,
                battalionId: bid,
                organizationId: oid
            });
            return { data, error: null };
        } catch (err: any) {
            console.error('Error fetching history:', err);
            return { data: [], error: err.message };
        }
    }, [organization?.id, organization?.battalion_id, profile?.battalion_id]);

    const addAuthorizedVehicle = async (vehicle: Omit<AuthorizedVehicle, 'id'>) => {
        const bid = profile?.battalion_id || organization?.battalion_id;
        try {
            const data = await gateService.addAuthorizedVehicle({ ...vehicle, battalion_id: bid });
            setAuthorizedVehicles(prev => [...prev, data as any]);
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error adding vehicle:', err);
            return { success: false, error: err.message };
        }
    };

    const updateAuthorizedVehicle = async (vehicleId: string, vehicle: Partial<AuthorizedVehicle>) => {
        try {
            const data = await gateService.updateAuthorizedVehicle(vehicleId, vehicle);
            setAuthorizedVehicles(prev => prev.map(v => v.id === vehicleId ? (data as any) : v));
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error updating vehicle:', err);
            return { success: false, error: err.message };
        }
    };

    const deleteAuthorizedVehicle = async (vehicleId: string) => {
        try {
            await gateService.deleteAuthorizedVehicle(vehicleId);
            setAuthorizedVehicles(prev => prev.filter(v => v.id !== vehicleId));
            return { success: true, error: null };
        } catch (err: any) {
            console.error('Error deleting vehicle:', err);
            return { success: false, error: err.message };
        }
    };

    return {
        authorizedVehicles, activeLogs, battalionOrganizations, battalionTeams,
        searchPeople, isLoading, error, registerEntry, registerExit, checkVehicle,
        addAuthorizedVehicle, updateAuthorizedVehicle, deleteAuthorizedVehicle, fetchGateHistory
    };
};

