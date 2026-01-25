import React, { useState, useEffect } from 'react';
import { snapshotService, Snapshot, TABLES_TO_SNAPSHOT } from '../../../services/snapshotService';
import { mapPersonFromDB, mapAbsenceFromDB, mapRotationFromDB, mapHourlyBlockageFromDB, mapTeamFromDB } from '../../../services/mappers';
import { getEffectiveAvailability } from '../../../utils/attendanceUtils';
import ExcelJS from 'exceljs';
import { populateAttendanceSheet } from '../../../utils/attendanceExport';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { useConfirmation } from '../../../hooks/useConfirmation';
import {
    Clock,
    Plus,
    Trash,
    ArrowsClockwise,
    Eye,
    FileText,
    User,
    Calendar,
    Shield,
    DownloadSimple
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { SnapshotPreviewModal } from './components/SnapshotPreviewModal';
import { SnapshotListSkeleton } from './SnapshotListSkeleton';

const MAX_SNAPSHOTS = 15;
const RESTORE_VERIFICATION_TEXT = 'שחזור';

interface SnapshotManagerProps {
    organizationId: string;
}

export const SnapshotManager: React.FC<SnapshotManagerProps> = ({ organizationId }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const queryClient = useQueryClient();

    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);
    const [restoringSnapshot, setRestoringSnapshot] = useState<Snapshot | null>(null);
    const [selectedTables, setSelectedTables] = useState<string[] | undefined>(undefined);
    const [restoreVerification, setRestoreVerification] = useState('');
    const [restoreProgress, setRestoreProgress] = useState<string>('');
    const [downloadingSnapshotId, setDownloadingSnapshotId] = useState<string | null>(null);

    useEffect(() => {
        loadSnapshots();
    }, [organizationId]);

    const loadSnapshots = async () => {
        try {
            setLoading(true);
            const data = await snapshotService.fetchSnapshots(organizationId);
            setSnapshots(data);
        } catch (error) {
            console.error('Error loading snapshots:', error);
            showToast('שגיאה בטעינת הגרסאות', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSnapshot = async (forceRotate = false) => {
        if (!newName.trim()) {
            showToast('נא להזין שם לגרסה', 'error');
            return;
        }

        if (snapshots.length >= MAX_SNAPSHOTS && !forceRotate) {
            confirm({
                title: 'הגעת למכסת הגרסאות',
                message: `המכסה המקסימלית היא ${MAX_SNAPSHOTS} גרסאות. יצירת גרסה חדשה תגרום למחיקת הגרסה הישנה ביותר באופן אוטומטי. האם להמשיך?`,
                confirmText: 'כן, צור ומחק ישנה',
                type: 'warning',
                onConfirm: () => handleCreateSnapshot(true)
            });
            return;
        }

        try {
            setCreating(true);

            // 1. Prepare Attendance Snapshot (The "Excel" View)
            setRestoreProgress('📊 מחשב דוח נוכחות לגיבוי...');

            // Fetch necessary data for calculation
            const [
                { data: people },
                { data: teams },
                { data: presence },
                { data: absences },
                { data: rotations },
                { data: blockages }
            ] = await Promise.all([
                snapshotService.supabase.from('people').select('*').eq('organization_id', organizationId),
                snapshotService.supabase.from('teams').select('*').eq('organization_id', organizationId),
                snapshotService.supabase.from('daily_presence').select('*').eq('organization_id', organizationId),
                snapshotService.supabase.from('absences').select('*').eq('organization_id', organizationId),
                snapshotService.supabase.from('team_rotations').select('*').eq('organization_id', organizationId),
                snapshotService.supabase.from('hourly_blockages').select('*').eq('organization_id', organizationId)
            ]);

            if (people && people.length > 0) {
                const snapshotTime = new Date().toISOString();
                const snapshotIdLabel = `snapshot_${Date.now()}`;

                // Define range: 30 days back, 90 days forward
                const startDate = new Date();
                startDate.setDate(startDate.getDate() - 30);
                startDate.setHours(0, 0, 0, 0);

                const dayDates: Date[] = [];
                for (let i = 0; i < 120; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    dayDates.push(d);
                }

                // Map people for availability calculation
                const peopleMap = new Map();
                people.forEach(p => {
                    const person = { ...p, dailyAvailability: {} };
                    peopleMap.set(p.id, person);
                });

                presence?.forEach(record => {
                    const person = peopleMap.get(record.person_id);
                    if (person) {
                        const dateKey = record.date;
                        person.dailyAvailability[dateKey] = {
                            status: record.status,
                            isAvailable: record.status !== 'home' && record.status !== 'leave',
                            startHour: record.start_time,
                            endHour: record.end_time,
                            homeStatusType: record.home_status_type,
                            source: record.source
                        };
                    }
                });

                // Calculate and collect snapshot records
                const snapshotRecords: any[] = [];
                people.forEach(p => {
                    const person = peopleMap.get(p.id);
                    dayDates.forEach(date => {
                        const avail = getEffectiveAvailability(person, date, rotations || [], absences || [], blockages || []);
                        snapshotRecords.push({
                            organization_id: organizationId,
                            person_id: p.id,
                            date: date.toISOString().split('T')[0],
                            status: avail.status,
                            start_time: avail.startHour || '00:00',
                            end_time: avail.endHour || '23:59',
                            snapshot_definition_time: snapshotIdLabel,
                            captured_at: snapshotTime
                        });
                    });
                });

                // Batch insert (Supebase handles large arrays well, but we can chunk if needed)
                // Using 1000 records per chunk for safety
                for (let i = 0; i < snapshotRecords.length; i += 1000) {
                    const chunk = snapshotRecords.slice(i, i + 1000);
                    const { error: insertError } = await snapshotService.supabase
                        .from('daily_attendance_snapshots')
                        .insert(chunk);
                    if (insertError) throw insertError;
                }
            }

            // 2. Perform regular snapshot creation
            setRestoreProgress('💾 שומר נתוני מערכת...');

            // If rotating, delete the oldest first
            if (snapshots.length >= MAX_SNAPSHOTS) {
                const oldest = snapshots[snapshots.length - 1];
                await snapshotService.deleteSnapshot(oldest.id, organizationId, user?.id || '');
            }

            await snapshotService.createSnapshot(organizationId, newName, newDescription, user?.id || '');
            showToast('הגרסה נשמרה בהצלחה', 'success');
            setShowCreateModal(false);
            setNewName('');
            setNewDescription('');
            loadSnapshots();
        } catch (error: any) {
            console.error('Error creating snapshot:', error);
            showToast(error.message || 'שגיאה ביצירת הגרסה', 'error');
        } finally {
            setCreating(false);
            setRestoreProgress('');
        }
    };

    const handleDeleteSnapshot = (snapshotId: string) => {
        confirm({
            title: 'מחיקת גרסה',
            message: 'האם אתה בטוח שברצונך למחוק גרסה זו? פעולה זו אינה ניתנת לביטול.',
            confirmText: 'מחק',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await snapshotService.deleteSnapshot(snapshotId, organizationId, user?.id || '');
                    showToast('הגרסה נמחקה', 'success');
                    loadSnapshots();
                } catch (error) {
                    console.error('Error deleting snapshot:', error);
                    showToast('שגיאה במחיקת הגרסה', 'error');
                }
            }
        });
    };

    const handleDownload = async (snapshot: Snapshot) => {
        try {
            setDownloadingSnapshotId(snapshot.id);
            showToast('מכין קובץ להורדה...', 'info');

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Miuim System';
            workbook.created = new Date();

            const snapshotData: Record<string, any[]> = {};

            // Fetch data for all tables
            for (const tableName of TABLES_TO_SNAPSHOT) {
                try {
                    const data = await snapshotService.fetchSnapshotTableData(snapshot.id, tableName);
                    snapshotData[tableName] = data || [];
                } catch (e) {
                    console.warn(`Failed to fetch data for table ${tableName}`, e);
                    snapshotData[tableName] = [];
                }
            }

            // Fallback: If 'roles' data is missing (legacy snapshots), fetch live roles
            if (!snapshotData['roles'] || snapshotData['roles'].length === 0) {
                console.log('[SnapshotExport] Roles missing in snapshot. Fetching live roles...');
                const { data: liveRoles } = await snapshotService.supabase
                    .from('roles')
                    .select('*')
                    .eq('organization_id', organizationId);
                if (liveRoles) {
                    console.log(`[SnapshotExport] Fetched ${liveRoles.length} live roles.`);
                    snapshotData['roles'] = liveRoles;
                } else {
                    console.warn('[SnapshotExport] Failed to fetch live roles.');
                }
            } else {
                console.log(`[SnapshotExport] Using ${snapshotData['roles'].length} roles from snapshot.`);
            }

            // --- ADD READABLE ATTENDANCE REPORT SHEET ---
            const people = snapshotData['people'] || [];
            const teams = snapshotData['teams'] || [];
            const dailyPresence = snapshotData['daily_presence'] || [];
            const shifts = snapshotData['shifts'] || [];
            const absences = snapshotData['absences'] || [];
            const rotations = snapshotData['team_rotations'] || [];
            const blockages = snapshotData['hourly_blockages'] || [];

            if (people.length > 0) {
                // Identify date range from all possible sources
                const allDates = [
                    ...dailyPresence.map(p => new Date(p.date || p.start_date || p.startDate || p.day)),
                    ...shifts.map(s => new Date(s.start_time || s.startTime || s.date)),
                    ...absences.map(a => new Date(a.start_date || a.startDate)),
                    ...absences.map(a => new Date(a.end_date || a.endDate)),
                    new Date(snapshot.created_at)
                ].filter(d => !isNaN(d.getTime()));

                let startDate: Date;
                let endDate: Date;

                if (allDates.length > 0) {
                    startDate = new Date(Math.min(...allDates.map(d => d.getTime())));
                    endDate = new Date(Math.max(...allDates.map(d => d.getTime())));

                    // Ensure the range covers at least the full current month AND the next month
                    const snapshotDate = new Date(snapshot.created_at);
                    const monthStart = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth(), 1);
                    const monthEnd = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() + 2, 0);

                    if (startDate > monthStart) startDate = monthStart;
                    if (endDate < monthEnd) endDate = monthEnd;

                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                } else {
                    const snapshotDate = new Date(snapshot.created_at);
                    startDate = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth(), 1);
                    endDate = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() + 2, 0);
                }

                // Reconstruct people with availability for the utility
                const peopleMap = new Map();
                people.forEach(p => {
                    const mappedPerson = mapPersonFromDB(p);
                    mappedPerson.dailyAvailability = {};
                    peopleMap.set(mappedPerson.id, mappedPerson);
                });

                const mappedTeams = teams.map(mapTeamFromDB);
                const mappedAbsences = absences.map(mapAbsenceFromDB);
                const mappedRotations = rotations.map(mapRotationFromDB);
                const mappedBlockages = blockages.map(mapHourlyBlockageFromDB);

                dailyPresence.forEach(record => {
                    const personId = record.person_id || record.personId;
                    const dateVal = record.date || record.start_date || record.startDate || record.day;
                    const dateKey = typeof dateVal === 'string' ? dateVal.split('T')[0] : (dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : null);

                    const person = peopleMap.get(personId);
                    if (person && dateKey) {
                        person.dailyAvailability[dateKey] = {
                            status: record.status,
                            isAvailable: record.is_available ?? record.isAvailable,
                            startHour: record.start_time || record.startTime || record.startHour,
                            endHour: record.end_time || record.endTime || record.endHour,
                            homeStatusType: record.home_status_type || record.homeStatusType,
                            source: record.source
                        };
                    }
                });

                const worksheet = workbook.addWorksheet('דוח נוכחות', { views: [{ rightToLeft: true }] });

                populateAttendanceSheet({
                    worksheet,
                    people: [...peopleMap.values()],
                    teams: mappedTeams,
                    absences: mappedAbsences,
                    rotations: mappedRotations,
                    blockages: mappedBlockages,
                    startDate,
                    endDate
                });
            }


            // Human-readable sheets for other tables
            const tableConfig: Record<string, { title: string, mapper: (item: any) => any }> = {
                'teams': {
                    title: 'צוותים',
                    mapper: (t) => ({ 'שם הצוות': t.name, 'צבע': t.color })
                },
                'people': {
                    title: 'כוח אדם',
                    mapper: (p) => {
                        const team = teams.find(t => t.id === (p.team_id || p.teamId));
                        return {
                            'שם מלא': p.name,
                            'צוות': team?.name || 'ללא צוות',
                            'טלפון': p.phone || '',
                            'אימייל': p.email || '',
                            'מפקד': p.is_commander || p.isCommander ? 'כן' : 'לא',
                            'סטטוס': p.is_active || p.isActive ? 'פעיל' : 'לא פעיל'
                        };
                    }
                },
                'shifts': {
                    title: 'משמרות',
                    mapper: (s) => {
                        const taskName = snapshotData['task_templates']?.find(t => t.id === (s.task_id || s.taskId))?.name || 'משימה לא ידועה';
                        const assignedNames = (s.assigned_person_ids || s.assignedPersonIds || [])
                            .map((id: string) => people.find(p => p.id === id)?.name || id)
                            .join(', ');
                        return {
                            'משימה': taskName,
                            'זמן התחלה': s.start_time || s.startTime,
                            'זמן סיום': s.end_time || s.endTime,
                            'מאוישים': assignedNames,
                            'נעול': s.is_locked || s.isLocked ? 'כן' : 'לא'
                        };
                    }
                },
                'absences': {
                    title: 'היעדרויות',
                    mapper: (a) => {
                        const personName = people.find(p => p.id === (a.person_id || a.personId))?.name || 'לא ידוע';
                        return {
                            'חייל': personName,
                            'תאריך התחלה': a.start_date || a.startDate,
                            'תאריך סיום': a.end_date || a.endDate,
                            'סיבה': a.reason || '',
                            'סטטוס': a.status === 'approved' ? 'מאושר' : 'ממתין'
                        };
                    }
                },
                'equipment': {
                    title: 'ציוד',
                    mapper: (e) => {
                        const personName = people.find(p => p.id === (e.assigned_to_id || e.assignedToId))?.name || 'לא חתום';
                        return {
                            'סוג': e.type,
                            'מספר סידורי': e.serial_number || e.serialNumber,
                            'חתום ע"י': personName,
                            'סטטוס': e.status || '',
                            'הערות': e.notes || ''
                        };
                    }
                },
                'team_rotations': {
                    title: 'סבבים',
                    mapper: (r) => {
                        const teamName = teams.find(t => t.id === (r.team_id || r.teamId))?.name || 'לא ידוע';
                        return {
                            'צוות': teamName,
                            'ימי בסיס': r.days_on_base || r.daysOnBase,
                            'ימי בית': r.days_at_home || r.daysAtHome,
                            'תאריך התחלה': r.start_date || r.startDate,
                            'תאריך סיום': r.end_date || r.endDate
                        };
                    }
                },
                'task_templates': {
                    title: 'משימות',
                    mapper: (t) => {
                        const roles = snapshotData['roles'] || [];
                        const segmentsStr = (t.segments || []).map((s: any) => {
                            const freqMap: Record<string, string> = { 'daily': 'יומי', 'weekly': 'שבועי', 'specific_date': 'תאריך' };
                            const days = s.daysOfWeek ? s.daysOfWeek.map((d: string) => d.slice(0, 3)).join(',') : '';
                            const freqStr = s.frequency === 'weekly' ? `שבועי (${days})` : freqMap[s.frequency] || s.frequency;

                            const reqs = s.roleComposition?.map((rc: any) => {
                                const role = roles.find((r: any) => r.id === rc.roleId);
                                if (!role) console.warn(`[SnapshotExport] Missing role for ID: ${rc.roleId}`, { availableIDs: roles.map((r: any) => r.id) });
                                const rName = role?.name || 'תפקיד לא ידוע';
                                return `${rName}: ${rc.count}`;
                            }).join(', ') || 'ללא';

                            return `• ${s.name} (${freqStr}): ${s.startTime} | משך: ${s.durationHours} | חיילים: ${s.requiredPeople} (${reqs})`;
                        }).join('\n');

                        return {
                            'שם המשימה': t.name,
                            'קטגוריה': t.category || '',
                            'רמת קושי': t.difficulty,
                            'סגמנטים (פירוט)': segmentsStr
                        };
                    }
                }
            };

            for (const tableName of TABLES_TO_SNAPSHOT) {
                const data = snapshotData[tableName];
                if (!data || data.length === 0) continue;

                const config = tableConfig[tableName];
                const sheetName = config?.title || tableName;
                const worksheet = workbook.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });

                const mappedData = config ? data.map(config.mapper) : data;
                if (mappedData.length > 0) {
                    const columns = Object.keys(mappedData[0]).map(key => ({ header: key, key: key, width: 20 }));
                    worksheet.columns = columns;
                    worksheet.addRows(mappedData);

                    // Style header
                    const row = worksheet.getRow(1);
                    row.font = { bold: true };
                    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                }
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_${snapshot.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);

            showToast('הקובץ ירד בהצלחה', 'success');
        } catch (error) {
            console.error('Download error:', error);
            showToast('שגיאה בהורדת הקובץ', 'error');
        } finally {
            setDownloadingSnapshotId(null);
        }
    };

    const handleRestore = async (snapshot: Snapshot, tables?: string[]) => {
        setRestoringSnapshot(snapshot);
        setSelectedTables(tables);
        setRestoreVerification('');
    };

    const confirmRestore = async () => {
        if (!restoringSnapshot || !user) return;
        if (restoreVerification !== RESTORE_VERIFICATION_TEXT) {
            showToast(`נא להקליד "${RESTORE_VERIFICATION_TEXT}" לאישור`, 'error');
            return;
        }

        setCreating(true);
        setRestoreProgress('🔄 יוצר גיבוי בטיחות...');

        try {
            showToast('🔄 יוצר גיבוי בטיחות...', 'info');

            const result = await snapshotService.restoreSnapshot(
                restoringSnapshot.id,
                organizationId,
                user.id,
                (progress: string) => setRestoreProgress(progress),
                selectedTables
            );

            // 3. Inject flattened attendance back to daily_presence
            if (!selectedTables || selectedTables.includes('daily_presence')) {
                setRestoreProgress('💉 מזריק נתוני נוכחות מחושבים...');

                // Fetch the flattened data from the RESTORED snapshot table
                // Note: The RPC has already restored the 'daily_attendance_snapshots' table
                const { data: attendanceData, error: fetchError } = await snapshotService.supabase
                    .from('daily_attendance_snapshots')
                    .select('*')
                    .eq('organization_id', organizationId);

                if (fetchError) {
                    console.error('Error fetching restored attendance data:', fetchError);
                } else if (attendanceData && attendanceData.length > 0) {
                    // Inject into daily_presence
                    // We need to map it to daily_presence format
                    const presenceRecords = attendanceData.map(record => ({
                        organization_id: organizationId,
                        person_id: record.person_id,
                        date: record.date,
                        status: record.status,
                        start_time: record.start_time,
                        end_time: record.end_time,
                        source: 'snapshot_restore',
                        updated_at: new Date().toISOString()
                    }));

                    // Upsert into daily_presence
                    // Since there could be thousands of records, we chunk it
                    for (let i = 0; i < presenceRecords.length; i += 500) {
                        const chunk = presenceRecords.slice(i, i + 500);
                        const { error: upsertError } = await snapshotService.supabase
                            .from('daily_presence')
                            .upsert(chunk, { onConflict: 'organization_id,person_id,date' });

                        if (upsertError) {
                            console.error('Error injecting attendance chunk:', upsertError);
                        }
                    }
                }
            }

            showToast(
                `הגרסה שוחזרה בהצלחה! ${result.preRestoreSnapshotId ? '\n🔒 נוצר גיבוי אוטומטי של המצב הקודם' : ''}`,
                'success'
            );

            setRestoringSnapshot(null);
            setPreviewSnapshot(null);
            await loadSnapshots();

            // Hard refresh strategy to ensure data is updated
            // 1. Immediate reset to force loading state
            await queryClient.resetQueries({ queryKey: ['organizationData'] });
            await queryClient.resetQueries({ queryKey: ['battalionPresence'] });

            // 2. Scheduled invalidation to catch any replication lag
            setTimeout(() => {
                console.log('🔄 Secondary invalidation for consistency');
                queryClient.invalidateQueries({ queryKey: ['organizationData'] });
                queryClient.invalidateQueries({ queryKey: ['battalionPresence'] });
            }, 1000);

            showToast('הנתונים מתעדכנים...', 'info');
        } catch (error: any) {
            console.error('Error restoring snapshot:', error);
            showToast(error.message || 'שגיאה בשחזור הגרסה', 'error');
        } finally {
            setCreating(false);
            setRestoreProgress('');
        }
    };



    if (loading && snapshots.length === 0) {
        return <SnapshotListSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-2">
                <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-800 text-right">גיבויים (Snapshots)</h2>
                    <p className="text-xs md:text-sm text-slate-500 font-bold text-right">שמור ושחזר את מצב המערכת בנקודות זמן שונות</p>
                </div>
                <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setShowCreateModal(true)}
                    disabled={snapshots.length >= 15}
                    className="shadow-lg shadow-blue-100 w-full md:w-auto py-3 md:py-2.5"
                >
                    צור גרסה חדשה
                </Button>
            </div>

            {snapshots.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Clock size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">אין גרסאות שמורות</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">צור את הגרסה הראשונה שלך כדי שתוכל לשחזר נתונים במידת הצורך.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-wider ${snapshots.length >= 13 ? 'bg-orange-100 text-orange-600 border border-orange-200' : 'bg-blue-50 text-blue-600 border border-blue-100'}`}>
                            <span dir="ltr">{snapshots.length} / 15</span> גרסאות בשימוש
                        </div>
                    </div>
                    {snapshots.map((snapshot) => (
                        <div key={snapshot.id} className="bg-white border border-slate-200 rounded-[1.5rem] md:rounded-3xl p-4 md:p-5 hover:border-blue-300 transition-all group shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                                    <FileText size={20} className="md:w-6 md:h-6" weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-black text-slate-800 text-base md:text-lg leading-tight truncate">{snapshot.name}</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 md:mt-1">
                                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500 font-bold">
                                            <Calendar size={14} className="shrink-0" />
                                            <span className="whitespace-nowrap">{new Date(snapshot.created_at).toLocaleDateString('he-IL')}</span>
                                            <span className="opacity-50 hidden md:inline">|</span>
                                            <span className="whitespace-nowrap md:hidden">{new Date(snapshot.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="whitespace-nowrap hidden md:inline">{new Date(snapshot.created_at).toLocaleTimeString('he-IL')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500 font-bold">
                                            <User size={14} className="shrink-0" />
                                            <span className="truncate max-w-[80px] md:max-w-none">{snapshot.created_by_name || 'המערכת'}</span>
                                        </div>
                                    </div>
                                    {snapshot.description && (
                                        <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium line-clamp-1 border-r-2 border-slate-100 pr-2">{snapshot.description}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 md:pl-2 shrink-0">
                                <Button
                                    variant="ghost"
                                    icon={Eye}
                                    onClick={() => setPreviewSnapshot(snapshot)}
                                    className="h-9 w-9 !p-0 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 shrink-0"
                                    title="תצוגה"
                                />
                                <Button
                                    variant="ghost"
                                    icon={DownloadSimple}
                                    onClick={() => handleDownload(snapshot)}
                                    isLoading={downloadingSnapshotId === snapshot.id}
                                    disabled={!!downloadingSnapshotId}
                                    className="h-9 w-9 !p-0 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 shrink-0"
                                    title="הורדה"
                                />
                                <Button
                                    variant="ghost"
                                    icon={ArrowsClockwise}
                                    onClick={() => handleRestore(snapshot)}
                                    className="h-9 w-9 !p-0 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-orange-50 shrink-0"
                                    title="שחזור"
                                />
                                <Button
                                    variant="ghost"
                                    icon={Trash}
                                    onClick={() => handleDeleteSnapshot(snapshot.id)}
                                    className="h-9 w-9 !p-0 rounded-xl text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                                    title="מחיקה"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Plus size={24} weight="bold" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">יצירת גרסה חדשה</h2>
                            <p className="text-sm font-bold text-slate-400">גיבוי מלא של נתוני הארגון</p>
                        </div>
                    </div>
                }
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="font-bold text-slate-500">ביטול</Button>
                        <Button
                            variant="primary"
                            icon={FileText}
                            onClick={() => handleCreateSnapshot()}
                            isLoading={creating}
                            disabled={!newName.trim()}
                            className="shadow-lg shadow-blue-100"
                        >
                            שמור גרסה
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="שם הגרסה (חובה)"
                        placeholder="שם העדכון"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="!bg-slate-50 font-black"
                    />
                    <Input
                        label="תיאור (אופציונלי)"
                        placeholder="הוסף פרטים נוספים על הגרסה..."
                        value={newDescription}
                        onChange={e => setNewDescription(e.target.value)}
                        className="!bg-slate-50"
                    />
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                        <Shield size={20} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 leading-relaxed font-bold">
                            יצירת גרסה תשמור את כל נתוני כוח האדם, המשימות, הנוכחות, האילוצים והציוד של הארגון.
                            ניתן יהיה לשחזר נתונים אלו בכל עת.
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Preview Modal */}
            {previewSnapshot && (
                <SnapshotPreviewModal
                    snapshot={previewSnapshot}
                    onClose={() => setPreviewSnapshot(null)}
                    onRestore={() => handleRestore(previewSnapshot)}
                />
            )}

            <ConfirmationModal {...modalProps} />

            {/* Destruction Safety Confirmation Modal for Restore */}
            {restoringSnapshot && (
                <ConfirmationModal
                    isOpen={true}
                    title="אישור שחזור מערכת"
                    type="danger"
                    confirmText={creating ? "⏳ מבצע שחזור..." : "שחזר כעת"}
                    disabled={creating}
                    onConfirm={() => {
                        if (!creating) {
                            confirmRestore();
                        }
                    }}
                    onCancel={() => {
                        if (!creating) {
                            setRestoringSnapshot(null);
                            setRestoreProgress('');
                        }
                    }}
                >
                    <div className="space-y-4">
                        {creating && restoreProgress ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                    <p className="text-sm font-bold text-blue-700">{restoreProgress}</p>
                                </div>
                                <p className="text-xs text-blue-600 mt-2 font-medium">נא לא לסגור את החלון...</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-slate-700">
                                    נא שים לב: שחזור לגרסה <span className="text-red-600">"{restoringSnapshot.name}"</span> ימחק את כל המידע הנוכחי במערכת ויחליף אותו במידע הישן.
                                </p>
                                <p className="text-xs text-slate-500 font-bold">
                                    פעולה זו היא הפיכה כי לפני השחזור, נא הקלד את המילה <span className="text-red-600 bg-red-50 px-1 rounded">"שחזור"</span> בשדה לסגור:
                                </p>
                                <Input
                                    value={restoreVerification}
                                    onChange={e => setRestoreVerification(e.target.value)}
                                    placeholder="שחזור"
                                    className="text-center font-bold"
                                    disabled={creating}
                                />
                            </>
                        )}
                    </div>
                </ConfirmationModal>
            )}
        </div>
    );
};
