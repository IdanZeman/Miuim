import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabaseClient';
import { DailyAttendanceSnapshot, Organization } from '@/types';

export const useBattalionSnapshots = (date: string, companies: Organization[]) => {
    // Generate a stable key for the company set
    const companyIdsKey = useMemo(() =>
        (companies || []).map(c => c.id).sort().join(','),
        [companies]
    );

    const { data: snapshots = [], isLoading, error } = useQuery({
        queryKey: ['battalionSnapshots', date, companyIdsKey],
        queryFn: async () => {
            if (!date || !companies || companies.length === 0) {
                return [];
            }

            const orgIds = companies.map(c => c.id);
            const { data, error: err } = await supabase
                .from('daily_attendance_snapshots')
                .select('*')
                .eq('date', date)
                .in('organization_id', orgIds);

            if (err) throw err;
            return data as DailyAttendanceSnapshot[];
        },
        enabled: !!date && (companies?.length > 0),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return {
        snapshots,
        loading: isLoading,
        error: error ? (error as any).message : null
    };
};
