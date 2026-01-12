
import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabaseClient';
import { DailyAttendanceSnapshot, Organization } from '@/types';

export const useBattalionSnapshots = (date: string, companies: Organization[]) => {
    const [snapshots, setSnapshots] = useState<DailyAttendanceSnapshot[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!date || !companies || companies.length === 0) {
            setSnapshots([]);
            return;
        }

        const fetchSnapshots = async () => {
            setLoading(true);
            setError(null);
            try {
                const orgIds = companies.map(c => c.id);
                console.log('Fetching snapshots for:', { date, orgIds });

                const { data, error: err } = await supabase
                    .from('daily_attendance_snapshots')
                    .select('*')
                    .eq('date', date)
                    .in('organization_id', orgIds);

                if (err) throw err;

                console.log('Fetched snapshots:', data?.length);
                setSnapshots(data as DailyAttendanceSnapshot[] || []);
            } catch (err: any) {
                console.error('Error fetching snapshots:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSnapshots();
    }, [date, companies]);

    return { snapshots, loading, error };
};
