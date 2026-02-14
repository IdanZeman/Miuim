import { useState, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { mapMissionReportFromDB, mapMissionReportToDB } from '../services/mappers';
import { MissionReport, OngoingNote } from '../types';
import { useAuth } from '../features/auth/AuthContext';
import { useToast } from '../contexts/ToastContext';

export const useMissionReports = (shiftId?: string) => {
    const { organization, user } = useAuth();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [report, setReport] = useState<MissionReport | null>(null);

    const fetchReport = useCallback(async (sid: string) => {
        if (!sid) return null;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('mission_reports')
                .select('*')
                .eq('shift_id', sid)
                .maybeSingle();

            if (error) throw error;
            const mapped = data ? mapMissionReportFromDB(data) : null;
            setReport(mapped);
            return mapped;
        } catch (err) {
            console.error('Error fetching mission report:', err);
            return null;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const upsertReport = async (data: Partial<MissionReport>) => {
        if (!organization || !shiftId) return;
        setIsLoading(true);
        try {
            // Merge with existing report to ensure we don't lose data if partial
            // BUT for upsert (if we use mapMissionReportToDB), we need a full object structure for the mapper?
            // Actually, mapMissionReportToDB maps checks property existence.
            
            const reportToSave = {
                ...report, // Merge existing first
                ...data,   // Override with new data
                organization_id: organization.id,
                shift_id: shiftId,
                updated_at: new Date().toISOString(),
                last_editor_id: user?.id
            };

            // If it's a final submission
            if (data.submitted_at) {
                reportToSave.submitted_by = user?.id;
            }

            // Ensure ongoing_log is preserved if not in data
            if (!data.ongoing_log && report?.ongoing_log) {
                reportToSave.ongoing_log = report.ongoing_log;
            } else if (!reportToSave.ongoing_log) {
                 reportToSave.ongoing_log = [];
            }

            const { data: saved, error } = await supabase
                .from('mission_reports')
                .upsert(mapMissionReportToDB(reportToSave as MissionReport))
                .select()
                .single();

            if (error) throw error;
            const mapped = mapMissionReportFromDB(saved);
            setReport(mapped);
            
            if (data.submitted_at) {
                showToast('הדוח הוגש בהצלחה', 'success');
            } else {
                showToast('השינויים נשמרו בהצלחה', 'success');
            }
            return mapped;
        } catch (err) {
            console.error('Error saving mission report:', err);
            showToast('שגיאה בשמירת הדוח', 'error');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const addNote = async (text: string) => {
        if (!organization || !shiftId || !user) return;
        
        const newNote: OngoingNote = {
            timestamp: new Date().toISOString(),
            text,
            user_id: user.id,
            user_name: user.email // Fallback to email if name not available in hook context
        };

        try {
            // Fetch current report to get existing log
            // We use fetchReport here to ensure we have strict consistency, or use local state?
            // Using fetch mostly ensures we don't overwrite if multiple users editing.
            const current = await fetchReport(shiftId);
            const ongoing_log = current ? [...current.ongoing_log, newNote] : [newNote];

            const { data: saved, error } = await supabase
                .from('mission_reports')
                .upsert({
                    organization_id: organization.id,
                    shift_id: shiftId,
                    ongoing_log,
                    updated_at: new Date().toISOString(),
                    last_editor_id: user.id
                    // Note: We are doing a partial update here. By default Postgres/Supabase 
                    // merge properties if we don't specify all columns? 
                    // Actually, if we use mapMissionReportToDB it sends specific columns.
                    // Here we are sending a raw object. 
                    // Supabase upsert will Update ONLY these columns if row exists, 
                    // OR Create row with these columns (rest null) if not.
                    // THIS IS SAFE.
                }, { onConflict: 'shift_id' })
                .select()
                .single();

            if (error) throw error;
            const mapped = mapMissionReportFromDB(saved);
            setReport(mapped);
            return mapped;
        } catch (err) {
            console.error('Error adding ongoing note:', err);
            showToast('שגיאה בהוספת הערה', 'error');
            return null;
        }
    };

    return {
        report,
        isLoading,
        fetchReport,
        upsertReport,
        addNote
    };
};
