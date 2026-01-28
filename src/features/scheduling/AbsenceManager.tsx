import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { ActionBar, ActionListItem } from '@/components/ui/ActionBar';
import { PageInfo } from '@/components/ui/PageInfo';
import { Person, Absence } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { getComputedAbsenceStatus } from '@/utils/attendanceUtils';
import { useAuth } from '@/features/auth/AuthContext';
import {
    CalendarBlank as CalendarIcon,
    MagnifyingGlass as Search,
    Plus,
    Plus as PlusIcon,
    Trash,
    PencilSimple as Edit2,
    Check,
    X,
    CaretLeft as ChevronLeft,
    CaretRight as ChevronRight,
    Warning as AlertTriangle,
    Clock,
    CheckCircle,
    CheckCircle as CheckCircle2,
    XCircle,
    CalendarBlank as CalendarDays,
    Tag,
    Funnel as Filter,
    DotsThreeVertical as MoreVertical,
    DotsThree as MoreHorizontal,
    CaretDown as ChevronDown,
    CaretUp as ChevronUp,
    ArrowRight,
    ArrowLeft,
    FileText,
    ShieldCheck,
    Info,
    ArrowsDownUp,
    SortAscending,
    SortDescending
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Select } from '@/components/ui/Select';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { logger } from '@/services/loggingService';
import { GenericModal } from '@/components/ui/GenericModal';
import { SheetModal } from '@/components/ui/SheetModal';



interface AbsenceManagerProps {
    people: Person[];
    absences: Absence[];
    onAddAbsence: (absence: Absence) => void;
    onUpdateAbsence: (absence: Absence, presenceUpdates?: any[]) => void;
    onDeleteAbsence: (id: string, presenceUpdates?: any[]) => void;
    onUpdatePerson: (p: Person) => void;
    isViewer?: boolean;
    onNavigateToAttendance?: () => void;
    shifts?: import('@/types').Shift[]; // NEW
    tasks?: import('@/types').TaskTemplate[]; // NEW
    teams?: import('@/types').Team[]; // NEW
}

export const AbsenceManager: React.FC<AbsenceManagerProps> = ({
    people, absences, onAddAbsence, onUpdateAbsence, onDeleteAbsence, onUpdatePerson,
    isViewer = false, onNavigateToAttendance, shifts = [], tasks = [], teams = []
}) => {
    const activePeople = people.filter(p => p.isActive !== false);
    const { organization, profile, checkAccess } = useAuth();
    const canEdit = !isViewer && checkAccess('absences', 'edit');
    const { showToast } = useToast();
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true); // NEW: Controls mobile view state

    // Sidebar State
    const [collapsedTeams, setCollapsedTeams] = useState<Record<string, boolean>>({});

    // Filter State
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Permissions
    const canApprove = profile?.permissions?.canApproveRequests || profile?.is_super_admin;
    const canManage = canEdit; // Strict check for edit permissions

    // Scope Filtering
    const currentPerson = useMemo(() => people.find(p => p.userId === profile?.id), [people, profile]);

    // Determine the effective people list based on scope
    const scopedPeople = useMemo(() => {
        // Super Admin gets everything (bypass scope if needed, but dataScope usually 'organization' for them)
        if (profile?.is_super_admin) return activePeople;

        const scope = profile?.permissions?.dataScope || 'personal';

        if (scope === 'organization' || scope === 'battalion') {
            return activePeople;
        }

        if (scope === 'team' || scope === 'my_team') {
            if (!currentPerson?.teamId) return []; // Safety: If no team assigned, show nothing instead of everything
            return activePeople.filter(p => p.teamId === currentPerson.teamId);
        }

        // Default to personal
        if (currentPerson) {
            return activePeople.filter(p => p.id === currentPerson.id);
        }

        // Safety fallback: if no person linked to user and scope is personal, show nothing
        return [];
    }, [activePeople, profile, currentPerson]);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
    const [formPersonId, setFormPersonId] = useState<string>('');
    const [formStartDate, setFormStartDate] = useState<string>('');
    const [formEndDate, setFormEndDate] = useState<string>('');
    const [formReason, setFormReason] = useState<string>('');
    const [showInfo, setShowInfo] = useState(false); // NEW

    // Time & Full Day State
    const [formStartTime, setFormStartTime] = useState<string>('08:00');
    const [formEndTime, setFormEndTime] = useState<string>('17:00');
    const [isFullDay, setIsFullDay] = useState(true);
    const [formStatus, setFormStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [initialFormStatus, setInitialFormStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
    const [activeMobileMenu, setActiveMobileMenu] = useState<string | null>(null);

    const handleExport = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('בקשות היעדרות');

        worksheet.columns = [
            { header: 'שם חייל', key: 'name', width: 20 },
            { header: 'תאריך התחלה', key: 'startDate', width: 15 },
            { header: 'תאריך סיום', key: 'endDate', width: 15 },
            { header: 'שעות', key: 'times', width: 15 },
            { header: 'סיבה', key: 'reason', width: 30 },
            { header: 'סטטוס', key: 'status', width: 15 }
        ];

        activeAbsences.forEach(absence => {
            const person = people.find(p => p.id === absence.person_id);
            const times = absence.start_time && absence.end_time ? `${absence.start_time} - ${absence.end_time}` : 'יום מלא';
            worksheet.addRow({
                name: person?.name || 'לא ידוע',
                startDate: new Date(absence.start_date).toLocaleDateString('he-IL'),
                endDate: new Date(absence.end_date).toLocaleDateString('he-IL'),
                times: times,
                reason: absence.reason || '',
                status: absence.status === 'approved' ? 'מאושר' : absence.status === 'pending' ? 'ממתין' : 'נדחה'
            });
        });

        // Styling
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };
        worksheet.views = [{ rightToLeft: true }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `absences_${new Date().toISOString().split('T')[0]}.xlsx`;
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    // Approval Modal State
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvingAbsence, setApprovingAbsence] = useState<Absence | null>(null);
    const [approvalStartDate, setApprovalStartDate] = useState<string>('');
    const [approvalEndDate, setApprovalEndDate] = useState<string>('');
    const [approvalDepartureTime, setApprovalDepartureTime] = useState('10:00');
    const [approvalReturnTime, setApprovalReturnTime] = useState('14:00'); // Return to base time if relevant, or just end of leave

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [conflictModalState, setConflictModalState] = useState<{
        isOpen: boolean;
        conflicts: { taskName: string; startTime: string; endTime: string }[];
    }>({ isOpen: false, conflicts: [] });

    const [sortBy, setSortBy] = useState<'date' | 'name' | 'status'>('date');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const selectedPerson = useMemo(() => people.find(p => p.id === selectedPersonId) || null, [people, selectedPersonId]);


    // --- Helpers ---
    // Moved getComputedAbsenceStatus to attendanceUtils.ts
    const filteredPeople = useMemo(() => {
        return scopedPeople.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [scopedPeople, searchTerm]);

    const activeAbsences = useMemo(() => {
        return absences.filter(a => scopedPeople.some(p => p.id === a.person_id));
    }, [absences, scopedPeople]);

    const pendingAbsences = useMemo(() => {
        return activeAbsences.filter(a => a.status === 'pending');
    }, [activeAbsences]);

    const sortedAbsences = useMemo(() => {
        let filtered = activeAbsences;

        // Filter by Status
        if (filterStatus !== 'all') {
            filtered = filtered.filter(a => {
                const person = people.find(p => p.id === a.person_id);
                if (!person) return false;
                const status = getComputedAbsenceStatus(person, a).status;
                if (filterStatus === 'pending') return status === 'pending';
                if (filterStatus === 'approved') return status === 'approved' || (status as string) === 'partially_approved';
                if (filterStatus === 'rejected') return status === 'rejected';
                return true;
            });
        }

        return filtered
            .sort((a, b) => {
                let comparison = 0;

                // Primary Sort Category
                if (sortBy === 'status') {
                    const statusA = a.status || 'pending';
                    const statusB = b.status || 'pending';
                    comparison = statusA.localeCompare(statusB);
                } else if (sortBy === 'date') {
                    comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
                } else {
                    const personA = people.find(p => p.id === a.person_id)?.name || '';
                    const personB = people.find(p => p.id === b.person_id)?.name || '';
                    comparison = personA.localeCompare(personB, 'he');
                }

                // If values are equal, fallback to date
                if (comparison === 0 && sortBy !== 'date') {
                    comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
                }

                // Apply Sort Order
                return sortOrder === 'desc' ? -comparison : comparison;
            });
    }, [activeAbsences, sortBy, sortOrder, people, filterStatus]);

    const getMonthDays = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    };

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const openAddModal = (personId?: string, dateStr?: string) => {
        setEditingAbsence(null);
        setFormPersonId(personId || selectedPersonId || (filteredPeople[0]?.id || ''));
        const today = new Date().toISOString().split('T')[0];
        setFormStartDate(dateStr || today);
        setFormEndDate(dateStr || today);
        setFormReason('');

        // Reset Time defaults
        setIsFullDay(true);
        setFormStatus('pending');
        setInitialFormStatus('pending');
        setFormStartTime('08:00');
        setFormEndTime('17:00');

        setIsModalOpen(true);
    };

    const openEditModal = (absence: Absence) => {
        setEditingAbsence(absence);
        setFormPersonId(absence.person_id);
        setFormStartDate(absence.start_date);
        setFormEndDate(absence.end_date);
        setFormReason(absence.reason || '');

        // Use computed status as fallback if the DB status is pending or missing
        const person = people.find(p => p.id === absence.person_id);
        const computed = person ? getComputedAbsenceStatus(person, absence).status : 'pending';
        const displayStatus = (absence.status && absence.status !== 'pending' ? absence.status : computed) as any;
        setFormStatus(displayStatus);
        setInitialFormStatus(displayStatus);

        // Parse Time
        const isFull = (absence.start_time === '00:00' && absence.end_time === '23:59') || (!absence.start_time && !absence.end_time);
        setIsFullDay(isFull);
        setFormStartTime(absence.start_time && absence.start_time !== '00:00' ? absence.start_time : '08:00');
        setFormEndTime(absence.end_time && absence.end_time !== '23:59' ? absence.end_time : '17:00');

        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!organization || !formPersonId || !formStartDate || !formEndDate) return;
        if (formEndDate < formStartDate) {
            showToast('תאריך סיום מוכרח להיות אחרי או שווה לתאריך התחלה', 'error');
            return;
        }

        const finalStartTime = isFullDay ? '00:00' : formStartTime;
        const finalEndTime = isFullDay ? '23:59' : formEndTime;

        // Determine status transitions
        // statusChanged must check against what the user SAW (initialFormStatus)
        // rather than just the underlying DB status which might be 'pending' even if shown as 'approved'
        const oldStatus = editingAbsence?.status || 'pending';
        const newStatus = editingAbsence || canApprove ? formStatus : 'pending';
        const statusChanged = initialFormStatus !== newStatus;

        try {
            if (editingAbsence) {
                // Update Absence Record
                const updated = {
                    ...editingAbsence,
                    person_id: formPersonId,
                    start_date: formStartDate,
                    end_date: formEndDate,
                    start_time: finalStartTime,
                    end_time: finalEndTime,
                    reason: formReason,
                    status: newStatus,
                    // If newly approved, mark who/when
                    ...(newStatus === 'approved' && oldStatus !== 'approved' ? {
                        approved_by: profile?.id,
                        approved_at: new Date().toISOString()
                    } : {})
                };

                let upsertData: any[] | undefined = undefined;

                // SYNC Logic: If status changed and involves 'approved'
                if (statusChanged) {
                    const start = new Date(formStartDate);
                    const end = new Date(formEndDate);
                    upsertData = [];

                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                        const dateStr = d.toLocaleDateString('en-CA');
                        const isFirstDay = dateStr === formStartDate;
                        const isLastDay = dateStr === formEndDate;

                        upsertData.push({
                            person_id: formPersonId,
                            date: dateStr,
                            status: (newStatus === 'approved' ? 'home' : 'base') as any,
                            source: 'manual' as const,
                            organization_id: organization.id,
                            start_time: newStatus === 'approved' ? (isFirstDay ? finalStartTime : '00:00') : '00:00',
                            end_time: newStatus === 'approved' ? (isLastDay ? finalEndTime : '23:59') : '23:59'
                        });
                    }

                    if (upsertData.length > 0) {
                        // Update Local Person State
                        const person = people.find(p => p.id === formPersonId);
                        if (person) {
                            const newAvailability = { ...(person.dailyAvailability || {}) };
                            upsertData.forEach(upd => {
                                newAvailability[upd.date] = {
                                    isAvailable: newStatus !== 'approved',
                                    status: upd.status,
                                    startHour: upd.start_time,
                                    endHour: upd.end_time,
                                    source: 'manual'
                                };
                            });
                            onUpdatePerson({ ...person, dailyAvailability: newAvailability });
                        }
                    }
                }

                onUpdateAbsence(updated, upsertData);
                showToast(statusChanged ? 'הסטטוס והנוכחות עודכנה' : 'ההיעדרות עודכנה בהצלחה', 'success');
            } else {
                // Add
                const newAbsence: Absence = {
                    id: crypto.randomUUID(), // Temp ID, will be replaced by DB if handled in App.tsx
                    person_id: formPersonId,
                    organization_id: organization.id,
                    start_date: formStartDate,
                    end_date: formEndDate,
                    start_time: finalStartTime,
                    end_time: finalEndTime,
                    reason: formReason,
                    status: 'pending' // Always pending initially for new requests
                };
                onAddAbsence(newAbsence);
                showToast('הבקשה נשלחה לאישור', 'success');
                await logger.logCreate('absence', newAbsence.id, 'בקשת יציאה', newAbsence);
            }
            setIsModalOpen(false);
        } catch (e) {
            logger.error('SAVE', 'Failed to save absence', e);
            console.error(e);
            showToast('שגיאה בשמירה', 'error');
        }
    };

    const initiateApproval = (absence: Absence) => {
        setApprovingAbsence(absence);
        setApprovalStartDate(absence.start_date);
        setApprovalEndDate(absence.end_date);
        // Default to request times. If full day (00:00-23:59), default to standard base hours (08:00-17:00)
        setApprovalDepartureTime(absence.start_time !== '00:00' ? absence.start_time || '08:00' : '08:00');
        setApprovalReturnTime(absence.end_time !== '23:59' ? absence.end_time || '17:00' : '17:00');
        setIsApprovalModalOpen(true);
    };

    const executeApproval = async () => {
        if (!approvingAbsence || !profile) return;

        const start = new Date(approvalStartDate);
        const end = new Date(approvalEndDate);
        const updates = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toLocaleDateString('en-CA');
            const isFirstDay = dateStr === approvalStartDate;
            const isLastDay = dateStr === approvalEndDate;

            updates.push({
                person_id: approvingAbsence.person_id,
                date: dateStr,
                status: 'home' as const,
                source: 'manual' as const,
                organization_id: organization?.id,
                start_time: isFirstDay ? approvalDepartureTime : '00:00',
                end_time: isLastDay ? approvalReturnTime : '23:59'
            });
        }

        try {
            const updated: Absence = {
                ...approvingAbsence,
                status: 'approved',
                start_date: approvalStartDate,
                end_date: approvalEndDate,
                start_time: approvalDepartureTime,
                end_time: approvalReturnTime,
                approved_by: profile.id,
                approved_at: new Date().toISOString()
            };

            const person = people.find(p => p.id === approvingAbsence.person_id);
            if (person) {
                const newAvailability = { ...(person.dailyAvailability || {}) };
                updates.forEach(upd => {
                    newAvailability[upd.date] = {
                        isAvailable: false,
                        status: 'home',
                        startHour: upd.start_time,
                        endHour: upd.end_time,
                        source: 'manual'
                    };
                });
                onUpdatePerson({ ...person, dailyAvailability: newAvailability });
            }

            onUpdateAbsence(updated, updates);
            showToast('הבקשה אושרה והנוכחות עודכנה', 'success');
            setIsApprovalModalOpen(false);
            setApprovingAbsence(null);
            await logger.logUpdate('absence', updated.id, 'אושרה בקשת יציאה', approvingAbsence, updated);
        } catch (e) {
            logger.error('UPDATE', 'Failed to execute approval', e);
            console.error(e);
            showToast('שגיאה באישור הבקשה', 'error');
        }
    };

    const handleConfirmApproval = async () => {
        if (!approvingAbsence || !profile) return;
        if (approvalEndDate < approvalStartDate) {
            showToast('תאריך חזרה חייב להיות אחרי או שווה לתאריך יציאה', 'error');
            return;
        }

        // NEW: CheckIcon for Conflicts with Shifts
        // 1. Identify date range
        // 2. Filter shifts for this person in this range
        const personId = approvingAbsence.person_id;
        const approvalStartTimeIso = new Date(`${approvalStartDate}T${approvalDepartureTime}`).toISOString();
        const approvalEndTimeIso = new Date(`${approvalEndDate}T${approvalReturnTime}`).toISOString();

        const conflictingShifts = shifts.filter(s => {
            // CheckIcon if person is assigned
            if (!s.assignedPersonIds.includes(personId)) return false;
            if (s.isCancelled) return false;

            // CheckIcon Overlap: (ShiftStart < AbsenceEnd) && (ShiftEnd > AbsenceStart)
            // Note: Shift times are full ISOs. We constructing Approval ISOs for CheckIcon.
            // Simplified CheckIcon: Does the shift fall on any day of the absence?
            // More precise: Time overlap.

            // However, approvalStartDate is YYYY-MM-DD. We constructing boundaries.

            return s.startTime < approvalEndTimeIso && s.endTime > approvalStartTimeIso;
        });

        if (conflictingShifts.length > 0) {
            const conflicts = conflictingShifts.map(s => {
                const t = tasks.find(t => t.id === s.taskId);
                return {
                    taskName: t ? t.name : 'משימה לא ידועה',
                    startTime: s.startTime,
                    endTime: s.endTime
                };
            });

            // Open Conflict Modal
            setConflictModalState({ isOpen: true, conflicts });
            return;
        }

        // If no conflicts, proceed directly
        await executeApproval();
    };

    const handleReject = async (absence: Absence) => {
        if (!profile) return;

        const start = new Date(absence.start_date);
        const end = new Date(absence.end_date);
        const updates = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            updates.push({
                person_id: absence.person_id,
                date: d.toLocaleDateString('en-CA'),
                status: 'base' as const,
                source: 'manual' as const,
                organization_id: organization?.id,
                start_time: '00:00',
                end_time: '23:59'
            });
        }

        try {
            // 1. Update Absence (Optimistic UI) 
            const updated: Absence = {
                ...absence,
                status: 'rejected',
                approved_by: profile.id,
                approved_at: new Date().toISOString()
            };

            // 3. Update Person Daily Availability JSON
            const person = people.find(p => p.id === absence.person_id);
            if (person) {
                const newAvailability = { ...(person.dailyAvailability || {}) };
                updates.forEach(upd => {
                    newAvailability[upd.date] = {
                        isAvailable: true,
                        status: 'base',
                        startHour: '00:00',
                        endHour: '23:59',
                        source: 'manual'
                    };
                });
                onUpdatePerson({ ...person, dailyAvailability: newAvailability });
            }

            onUpdateAbsence(updated, updates);
            showToast('הבקשה נדחתה והנוכחות עודכנה לבסיס', 'info');
            await logger.logUpdate('absence', updated.id, 'נדחתה בקשת יציאה', absence, updated);
        } catch (e) {
            logger.error('UPDATE', 'Failed to reject absence', e);
            console.error(e);
            showToast('שגיאה בדחיית הבקשה', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        const absence = absences.find(a => a.id === deleteConfirmId);
        if (!absence) return;

        try {
            // Revert presence to 'base' for the deleted absence range
            const start = new Date(absence.start_date);
            const end = new Date(absence.end_date);
            const updates = [];
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                updates.push({
                    person_id: absence.person_id,
                    date: d.toLocaleDateString('en-CA'),
                    status: 'base' as const,
                    source: 'manual' as const,
                    organization_id: organization?.id,
                    start_time: '00:00',
                    end_time: '23:59'
                });
            }

            // Sync local person state
            const person = people.find(p => p.id === absence.person_id);
            if (person) {
                const newAvailability = { ...(person.dailyAvailability || {}) };
                updates.forEach(upd => {
                    newAvailability[upd.date] = {
                        isAvailable: true,
                        status: 'base',
                        startHour: '00:00',
                        endHour: '23:59',
                        source: 'manual'
                    };
                });
                onUpdatePerson({ ...person, dailyAvailability: newAvailability });
            }

            onDeleteAbsence(deleteConfirmId, updates);
            showToast('ההיעדרות נמחקה והנוכחות שוחזרה', 'success');
            await logger.logDelete('absence', deleteConfirmId, 'מחיקת בקשת יציאה - שחזור נוכחות');
            setDeleteConfirmId(null);
        } catch (e) {
            logger.error('DELETE', 'Failed to delete absence', e);
            console.error(e);
            showToast('שגיאה במחיקה', 'error');
        }
    };

    const selectedPersonAbsences = useMemo(() => {
        if (!selectedPersonId) return [];
        return activeAbsences.filter(a => a.person_id === selectedPersonId);
    }, [activeAbsences, selectedPersonId]);

    const getAbsenceForDate = (date: Date) => {
        if (!selectedPersonId) return null;
        const dateStr = date.toLocaleDateString('en-CA');
        return selectedPersonAbsences.find(a => dateStr >= a.start_date && dateStr <= a.end_date);
    };



    const formatTimeRange = (start?: string, end?: string, isMultiDay?: boolean) => {
        if (!start || !end) return null;
        if (start === '00:00' && end === '23:59') return null;
        if (isMultiDay) {
            return `יציאה: ${start} | חזרה: ${end}`;
        }
        return `${start} - ${end}`;
    };

    // Sidebar Helpers
    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => ({ ...prev, [teamId]: !prev[teamId] }));
    };

    const expandAllTeams = () => setCollapsedTeams({});
    const collapseAllTeams = () => {
        const all: Record<string, boolean> = {};
        teams.forEach(t => all[t.id] = true);
        if (teams.length === 0) {
            // If no teams, maybe group by 'no-team'
        }
        setCollapsedTeams(all);
    };

    const groupedPeople = useMemo(() => {
        const groups: Record<string, Person[]> = {};
        filteredPeople.forEach(p => {
            const tId = p.teamId || 'ungrouped';
            if (!groups[tId]) groups[tId] = [];
            groups[tId].push(p);
        });
        return groups;
    }, [filteredPeople]);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-hidden" dir="rtl">

            <ActionBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={!isViewer ? handleExport : undefined}
                variant="unified"
                className="px-4 md:px-6 sticky top-0 z-40 bg-white"
                mobileMoreActions={
                    <div className="space-y-2">
                        <Select
                            value={sortBy}
                            onChange={(val) => setSortBy(val as any)}
                            options={[
                                { value: 'date', label: 'מיין לפי תאריך' },
                                { value: 'name', label: 'מיין לפי שם' },
                                { value: 'status', label: 'מיין לפי סטטוס' }
                            ]}
                            className="bg-slate-50 border-transparent rounded-2xl h-12 text-sm font-bold"
                            icon={ArrowsDownUp}
                            placeholder="מיון לפי"
                        />
                        <ActionListItem
                            icon={sortOrder === 'asc' ? SortAscending : SortDescending}
                            label={sortOrder === 'asc' ? 'סדר עולה' : 'סדר יורד'}
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            color="bg-indigo-50 text-indigo-600"
                            extra={null}
                        />
                    </div>
                }
                leftActions={
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl items-center justify-center">
                            <CalendarDays size={22} weight="bold" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight">ניהול היעדרויות</h2>
                            <span className="hidden md:block text-[10px] font-black text-slate-400 uppercase tracking-widest">אילוצים ובקשות יציאה</span>
                        </div>
                        <PageInfo
                            title="ניהול היעדרויות"
                            description={
                                <div className="space-y-3">
                                    <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
                                        <Info size={20} className="text-emerald-600 shrink-0 mt-0.5" weight="bold" />
                                        <div className="text-sm">
                                            <h4 className="font-black text-emerald-900 mb-1">בקשות יציאה וחופשות</h4>
                                            <p className="text-emerald-700/80 leading-relaxed font-medium">כאן מנהלים את כל בקשות היציאה, החופשות והסיווגים של אנשי הצוות.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span><b>אישור בקשה:</b> מעדכן אוטומטית את יומן הנוכחות כ"חופשה".</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span><b>דחיית בקשה:</b> מסמן את החייל כ"בבסיס".</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            <span><b>תצוגה אישית:</b> לחיצה על שם חייל תפתח יומן שנתי עבורו.</span>
                                        </div>
                                    </div>
                                </div>
                            }
                        />
                    </div>
                }
                centerActions={
                    <div className="md:hidden bg-slate-100/50 p-1 rounded-xl flex items-center gap-1 w-full md:w-auto">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-[0.875rem] text-xs font-black transition-all ${isSidebarOpen
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            שמות
                        </button>
                        <button
                            onClick={() => { setIsSidebarOpen(false); setSelectedPersonId(null); }}
                            className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-[0.875rem] text-xs font-black transition-all ${!isSidebarOpen
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            בקשות ({activeAbsences.length})
                        </button>
                    </div>
                }
                rightActions={
                    <>
                        <Select
                            value={sortBy}
                            onChange={(val) => setSortBy(val as any)}
                            options={[
                                { value: 'date', label: 'מיין לפי תאריך' },
                                { value: 'name', label: 'מיין לפי שם' },
                                { value: 'status', label: 'מיין לפי סטטוס' }
                            ]}
                            className="hidden md:flex bg-transparent border-transparent rounded-xl h-9 w-44 font-bold text-xs"
                            icon={ArrowsDownUp}
                        />
                        <button
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className="hidden md:flex h-9 w-9 rounded-xl border-transparent bg-transparent text-slate-500 items-center justify-center transition-all hover:bg-slate-50 hover:text-indigo-600"
                            title={sortOrder === 'asc' ? 'מיין בסדר יורד' : 'מיין בסדר עולה'}
                        >
                            {sortOrder === 'asc' ? <SortAscending size={20} /> : <SortDescending size={20} />}
                        </button>
                    </>
                }
                filters={[
                    {
                        id: 'status',
                        value: filterStatus,
                        onChange: (val) => setFilterStatus(val as any),
                        options: [
                            { value: 'all', label: 'כל הסטטוסים' },
                            { value: 'pending', label: 'ממתין' },
                            { value: 'approved', label: 'מאושר' },
                            { value: 'rejected', label: 'נדחה' }
                        ],
                        placeholder: 'סינון לפי סטטוס',
                        icon: Filter
                    }
                ]}
            />

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
                {/* Sidebar: People List */}
                <div className={`w-full md:w-80 bg-white border-l border-slate-100 flex flex-col shrink-0 flex-1 md:flex-none min-h-0 ${isSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
                    {/* PC Only Title Area */}
                    <div className="hidden md:flex px-6 py-5 border-b border-slate-100 bg-white items-center justify-between">
                        <div className="flex flex-col text-right">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">רשימת שמות</h3>
                            <span className="text-[10px] text-slate-400 font-bold">{activePeople.length} חיילים פעילים</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const areAllCollapsed = teams.length > 0 && teams.every(t => collapsedTeams[t.id]);
                                    if (areAllCollapsed) expandAllTeams();
                                    else collapseAllTeams();
                                }}
                                className="text-[10px] font-black text-slate-400 hover:text-blue-600 transition-all px-2 py-1.5 rounded-md hover:bg-blue-50 border border-transparent flex items-center gap-1 whitespace-nowrap"
                                title={teams.length > 0 && teams.every(t => collapsedTeams[t.id]) ? "פתח הכל" : "כווץ הכל"}
                            >
                                {teams.length > 0 && teams.every(t => collapsedTeams[t.id]) ? (
                                    <><ChevronDown size={12} weight="bold" /> פתח הכל</>
                                ) : (
                                    <><ChevronUp size={12} weight="bold" /> כווץ הכל</>
                                )}
                            </button>
                            <button
                                onClick={() => setIsSearchOpen(!isSearchOpen)}
                                className={`p-2 rounded-lg transition-colors ${isSearchOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                                <Search size={18} weight="bold" />
                            </button>
                        </div>
                    </div>

                    {isSearchOpen && (
                        <div className="p-3 border-b border-slate-100 bg-white animate-in slide-in-from-top-2 duration-200">
                            <div className="relative group">
                                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                <input
                                    autoFocus
                                    placeholder="חפש חייל..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-10 pr-10 pl-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-inner"
                                />
                                {searchTerm && (
                                    <button onClick={() => setSearchTerm('')} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        <X size={14} weight="bold" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 pb-32 md:pb-2 space-y-1">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <button
                                onClick={() => setSelectedPersonId(null)}
                                className={`hidden md:block text-xs font-black uppercase tracking-wider transition-all ${selectedPersonId === null ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}
                            >
                                כל הבקשות
                            </button>
                        </div>

                        {/* Teams Rendering */}
                        {teams.length > 0 ? (
                            <>
                                {teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(team => {
                                    const teamPeople = groupedPeople[team.id] || [];
                                    if (teamPeople.length === 0) return null;
                                    const isCollapsed = collapsedTeams[team.id];

                                    return (
                                        <div key={team.id} className="mb-2">
                                            <button
                                                onClick={() => toggleTeamCollapse(team.id)}
                                                className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/60 transition-all text-right group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-5 rounded-full ${team.color || 'bg-slate-300'} shadow-sm`}></div>
                                                    <span className="font-black text-[11px] text-slate-500 uppercase tracking-widest">{team.name}</span>
                                                </div>
                                                <ChevronDown size={14} className={`text-slate-400 transition-all duration-300 ${isCollapsed ? '-rotate-90' : ''}`} weight="bold" />
                                            </button>

                                            {!isCollapsed && (
                                                <div className="space-y-1 mt-1 origin-top animate-in slide-in-from-top-1 duration-200">
                                                    {teamPeople.map(person => {
                                                        const isSelected = selectedPersonId === person.id;
                                                        const personAbsences = activeAbsences.filter(a => a.person_id === person.id);
                                                        const pendingCount = personAbsences.filter(a => {
                                                            const computed = getComputedAbsenceStatus(person, a);
                                                            return computed.status === 'pending';
                                                        }).length;

                                                        return (
                                                            <button
                                                                key={person.id}
                                                                onClick={() => { setSelectedPersonId(person.id); setIsSidebarOpen(false); }}
                                                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-right group ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-1 ring-blue-500' : 'hover:bg-white text-slate-600'}`}
                                                            >
                                                                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-[11px] font-black shadow-lg shadow-black/5 shrink-0 transition-all ${isSelected ? 'bg-white/20 text-white' : person.color.replace('border-', 'bg-') + ' text-white'}`}>
                                                                    {person.name.slice(0, 2)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={`font-black tracking-tight truncate text-[14px] ${isSelected ? 'text-white' : 'text-slate-700'}`}>{person.name}</div>
                                                                    {pendingCount > 0 && <div className={`text-[9px] font-black uppercase tracking-tighter ${isSelected ? 'text-white/80' : 'text-amber-600 animate-pulse'}`}>ממתין {pendingCount}</div>}
                                                                </div>
                                                                {personAbsences.length > 0 && (
                                                                    <span className={`text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-black shrink-0 transition-all ${isSelected ? 'bg-white text-blue-600' : pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                                                        {personAbsences.length}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                                {/* Ungrouped */}
                                {groupedPeople['ungrouped']?.length > 0 && (
                                    <div className="mb-2">
                                        <div className="px-2 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">ללא צוות</div>
                                        {groupedPeople['ungrouped'].map(person => {
                                            const isSelected = selectedPersonId === person.id;
                                            const personAbsences = activeAbsences.filter(a => a.person_id === person.id);
                                            const pendingCount = personAbsences.filter(a => a.status === 'pending').length;
                                            return (
                                                <button
                                                    key={person.id}
                                                    onClick={() => { setSelectedPersonId(person.id); setIsSidebarOpen(false); }}
                                                    className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-right group ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-1 ring-blue-500' : 'hover:bg-white text-slate-600'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm shrink-0 transition-all ${isSelected ? 'bg-white/20 text-white' : person.color.replace('border-', 'bg-') + ' text-white'}`}>
                                                        {person.name.slice(0, 2)}
                                                    </div>
                                                    <div className="flex-1 min-w-0 text-right">
                                                        <div className={`font-bold truncate text-[13px] ${isSelected ? 'text-white' : 'text-slate-700'}`}>{person.name}</div>
                                                        {pendingCount > 0 && <div className={`text-[9px] font-black uppercase ${isSelected ? 'text-white/80' : 'text-amber-600'}`}>ממתין {pendingCount}</div>}
                                                    </div>
                                                    {personAbsences.length > 0 && (
                                                        <span className={`text-[9px] w-5 h-5 rounded-full flex items-center justify-center font-black shrink-0 transition-all ${isSelected ? 'bg-white text-blue-600' : pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                                            {personAbsences.length}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        ) : (
                            // Fallback Flat List (If no teams passed or empty)
                            filteredPeople.map((person) => {
                                const isSelected = selectedPersonId === person.id;
                                const personAbsences = activeAbsences.filter(a => a.person_id === person.id);
                                const pendingCount = personAbsences.filter(a => getComputedAbsenceStatus(person, a).status === 'pending').length;

                                return (
                                    <button
                                        key={person.id}
                                        onClick={() => { setSelectedPersonId(person.id); setIsSidebarOpen(false); }}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right group mb-1 ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 ring-1 ring-blue-500' : 'hover:bg-white text-slate-600'}`}
                                        aria-selected={isSelected}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-black shadow-sm shrink-0 transition-all ${isSelected ? 'bg-white/20 text-white' : person.color.replace('border-', 'bg-') + ' text-white'}`}>
                                            {person.name.slice(0, 2)}
                                        </div>
                                        <div className="flex-1 min-w-0 text-right">
                                            <div className={`font-bold truncate ${isSelected ? 'text-white' : 'text-slate-700'}`}>{person.name}</div>
                                            {pendingCount > 0 && <div className={`text-[10px] font-black uppercase ${isSelected ? 'text-white/80' : 'text-amber-600'}`}>ממתין {pendingCount}</div>}
                                        </div>
                                        {personAbsences.length > 0 && (
                                            <span className={`text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black shrink-0 transition-all ${isSelected ? 'bg-white text-blue-600' : pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>
                                                {personAbsences.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className={`flex-1 flex flex-col min-w-0 bg-slate-50/30 overflow-hidden relative ${!isSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
                    {!selectedPersonId ? (
                        // All Absences List View
                        <div className="flex flex-col h-full">
                            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="flex flex-col text-right">
                                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                                            כל הבקשות
                                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-100">
                                                {activeAbsences.length}
                                            </span>
                                        </h3>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 pb-32 md:pb-4">
                                {activeAbsences.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <CalendarIcon size={48} className="mb-4 opacity-20" weight="bold" />
                                        <p>אין בקשות יציאה רשומות במערכת</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {sortedAbsences.map(absence => {
                                            const person = people.find(p => p.id === absence.person_id);
                                            if (!person) return null;

                                            const status = getComputedAbsenceStatus(person, absence).status;

                                            // Status Helpers
                                            const isApproved = status === 'approved';
                                            const isRejected = status === 'rejected';
                                            const isPartial = status === 'partially_approved';
                                            const isPending = status === 'pending';

                                            return (
                                                <div
                                                    key={absence.id}
                                                    onClick={() => openEditModal(absence)}
                                                    className={`relative flex flex-col md:flex-row md:items-center gap-4 p-5 bg-white border rounded-[2rem] hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500 group cursor-pointer md:cursor-default ${isPending ? 'border-amber-100 bg-amber-50/5' : 'border-slate-100'}`}
                                                >
                                                    {/* Status Decorator */}
                                                    <div className={`absolute top-0 bottom-0 right-0 w-1.5 md:w-2 transition-all group-hover:w-3 rounded-r-[2rem]
                                                        ${isApproved ? 'bg-emerald-500' : isRejected ? 'bg-rose-500' : isPartial ? 'bg-orange-500' : 'bg-amber-500'}
                                                    `}></div>

                                                    <div className="flex items-center gap-5 z-10 flex-1 min-w-0">
                                                        <div className={`w-14 h-14 rounded-[1.25rem] flex items-center justify-center text-white font-black shadow-lg shadow-black/5 z-10 text-xl shrink-0 transition-transform group-hover:scale-105 duration-500 ${person.color.replace('border-', 'bg-')}`}>
                                                            {person.name.slice(0, 2)}
                                                        </div>
                                                        <div className="flex-1 min-w-0 text-right">
                                                            <div className="flex flex-wrap items-center gap-3 mb-2">
                                                                <div className="font-black text-slate-900 text-lg tracking-tight truncate">{person.name}</div>
                                                                <div className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm
                                                                    ${isApproved ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : isRejected ? 'bg-rose-50 text-rose-600 border border-rose-100' : isPartial ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'}
                                                                `}>
                                                                    {isApproved ? (
                                                                        <>
                                                                            <CheckCircle size={14} weight="bold" />
                                                                            <span>מאושר</span>
                                                                        </>
                                                                    ) : isRejected ? (
                                                                        <>
                                                                            <XCircle size={14} weight="bold" />
                                                                            <span>נדחה</span>
                                                                        </>
                                                                    ) : isPartial ? (
                                                                        <>
                                                                            <AlertTriangle size={14} weight="bold" />
                                                                            <span>חלקי</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Clock size={14} weight="bold" />
                                                                            <span>ממתין</span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Mobile Actions Button */}
                                                                <div className="md:hidden mr-auto">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setActiveMobileMenu(absence.id);
                                                                        }}
                                                                        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeMobileMenu === absence.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                                                    >
                                                                        <MoreVertical size={22} weight="bold" />
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-500">
                                                                <div className="flex items-center gap-2.5 bg-slate-50/80 px-4 py-1.5 rounded-xl border border-slate-100/50 shadow-sm">
                                                                    <CalendarDays size={16} className="text-emerald-500" weight="bold" />
                                                                    <span className="text-sm font-bold text-slate-700 tracking-tight">
                                                                        {new Date(absence.start_date).toDateString() === new Date(absence.end_date).toDateString()
                                                                            ? new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
                                                                            : `${new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} - ${new Date(absence.end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`}
                                                                    </span>
                                                                    {formatTimeRange(absence.start_time, absence.end_time, absence.start_date !== absence.end_date) && (
                                                                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50 mr-1" dir="ltr">
                                                                            {formatTimeRange(absence.start_time, absence.end_time, absence.start_date !== absence.end_date)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {absence.reason && (
                                                                    <div className="flex items-center gap-2 max-w-[300px]">
                                                                        <Tag size={16} className="text-slate-400" weight="bold" />
                                                                        <span className="text-sm font-bold text-slate-500 truncate">{absence.reason}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Desktop Actions */}
                                                    <div className="hidden md:flex items-center gap-3">
                                                        {(isPending || isPartial) && canApprove && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-10 px-5 rounded-xl"
                                                                    onClick={() => initiateApproval(absence)}
                                                                    icon={Check}
                                                                >
                                                                    אשר
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-rose-600 border-rose-100 hover:bg-rose-50 h-10 px-5 rounded-xl"
                                                                    onClick={() => handleReject(absence)}
                                                                    icon={X}
                                                                >
                                                                    דחה
                                                                </Button>
                                                            </>
                                                        )}

                                                        {canManage && (
                                                            <div className="flex gap-1.5 mr-3 border-r pr-3 border-slate-100">
                                                                <button onClick={() => openEditModal(absence)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" aria-label="ערוך"><Edit2 size={20} weight="bold" /></button>
                                                                <button onClick={() => setDeleteConfirmId(absence.id)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" aria-label="מחק"><Trash size={20} weight="bold" /></button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Person Calendar View
                        <div className="flex flex-col h-full bg-white">
                            <div className="sticky top-0 z-30 px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-white/95 backdrop-blur-md">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => { setSelectedPersonId(null); setIsSidebarOpen(true); }}
                                        className="w-10 h-10 flex items-center justify-center bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-500 rounded-2xl transition-all group"
                                    >
                                        <ChevronRight size={22} weight="bold" />
                                    </button>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black shadow-lg shadow-black/5 ${people.find(p => p.id === selectedPersonId)?.color.replace('border-', 'bg-')}`}>
                                            {people.find(p => p.id === selectedPersonId)?.name.slice(0, 2)}
                                        </div>
                                        <div className="flex flex-col text-right">
                                            <h2 className="text-xl font-black text-slate-900 leading-tight">
                                                {people.find(p => p.id === selectedPersonId)?.name}
                                            </h2>
                                            <span className="text-xs font-bold text-slate-400">תצוגת יומן שנתי</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 bg-slate-100/80 p-1.5 rounded-[1.25rem] border border-white shadow-sm">
                                    <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-blue-600"><ChevronRight size={18} weight="bold" /></button>
                                    <span className="text-sm font-black text-slate-800 min-w-[100px] text-center">{viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</span>
                                    <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-blue-600"><ChevronLeft size={18} weight="bold" /></button>
                                </div>
                            </div>

                            <div className="flex-1 p-2 md:p-6 overflow-y-auto">
                                <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2 md:mb-4">
                                    {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => <div key={day} className="text-center font-bold text-slate-400 text-xs md:text-sm py-1 md:py-2">{day}</div>)}
                                </div>
                                <div className="grid grid-cols-7 gap-1 md:gap-4">
                                    {getMonthDays(viewDate).map((date, i) => {
                                        if (!date) return <div key={`empty-${i}`} className="aspect-square bg-slate-50/50 rounded-xl" />;

                                        const dateStr = date.toLocaleDateString('en-CA');
                                        const absence = getAbsenceForDate(date);
                                        const isToday = new Date().toDateString() === date.toDateString();

                                        // Source of Truth Status
                                        const computed = (selectedPerson && absence) ? getComputedAbsenceStatus(selectedPerson, absence) : { status: absence?.status || 'pending' };
                                        const status = computed.status;

                                        return (
                                            <div
                                                key={dateStr}
                                                onClick={() => {
                                                    if (!canManage) return;
                                                    if (absence) openEditModal(absence);
                                                    else openAddModal(selectedPersonId, dateStr);
                                                }}
                                                className={`
                                                    aspect-square rounded-[1.5rem] flex flex-col items-center justify-between p-2 md:p-4 transition-all border-2 relative group overflow-hidden ${canManage ? 'cursor-pointer' : ''}
                                                    ${absence
                                                        ? (status === 'approved' || status === 'partially_approved' ? 'bg-emerald-50/40 border-emerald-100/50 text-emerald-900'
                                                            : status === 'rejected' ? 'bg-rose-50/40 border-rose-100/50 text-rose-900'
                                                                : 'bg-amber-50/40 border-amber-100/50 text-amber-900')
                                                        : 'bg-white border-slate-50 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5'}
                                                    ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2 z-10' : ''}
                                                `}
                                            >
                                                {/* Background status accent for absence */}
                                                {absence && (
                                                    <div className={`absolute top-0 right-0 left-0 h-1.5 transition-all group-hover:h-2
                                                        ${status === 'approved' || status === 'partially_approved' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'}
                                                    `}></div>
                                                )}

                                                <div className="flex justify-between w-full items-start z-10">
                                                    <span className={`text-base md:text-xl font-black tracking-tighter transition-colors ${absence ? 'text-slate-800' : 'text-slate-300 group-hover:text-emerald-500'}`}>
                                                        {date.getDate()}
                                                    </span>
                                                    {absence && (
                                                        <div className="shrink-0 p-1.5 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm border border-white/50">
                                                            {(status === 'approved' || status === 'partially_approved') && <CheckCircle size={16} className="text-emerald-600" weight="bold" />}
                                                            {status === 'rejected' && <XCircle size={16} className="text-rose-600" weight="bold" />}
                                                            {status === 'pending' && <Clock size={16} className="text-amber-600" weight="bold" />}
                                                        </div>
                                                    )}
                                                </div>

                                                {absence ? (
                                                    <div className="w-full mt-auto z-10">
                                                        <div className={`text-[10px] md:text-[11px] font-black px-2.5 py-1 rounded-xl truncate w-full text-center tracking-tight shadow-sm border border-white/20
                                                            ${status === 'approved' ? 'bg-emerald-500 text-white'
                                                                : status === 'rejected' ? 'bg-rose-500 text-white'
                                                                    : 'bg-amber-500 text-white'}
                                                        `}>
                                                            {absence.reason || 'היעדרות'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    canManage && (
                                                        <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                                                            <div className="bg-emerald-600 text-white p-2.5 rounded-2xl shadow-lg shadow-emerald-200">
                                                                <Plus size={18} weight="bold" />
                                                            </div>
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            <GenericModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">
                            {editingAbsence ? 'עריכת היעדרות' : 'בקשת יציאה חדשה'}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                            <Tag size={12} className="text-emerald-500" />
                            <span>{editingAbsence ? 'עדכון פרטי בקשה' : 'דיווח אילוץ או חופשה'}</span>
                        </div>
                    </div>
                }
                size="md"
                footer={
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                onClick={() => setIsModalOpen(false)}
                                className="h-12 md:h-11 text-base md:text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                            >
                                ביטול
                            </Button>
                            {canManage && editingAbsence && (
                                <Button
                                    variant="ghost"
                                    className="text-rose-600 hover:bg-rose-50 h-12 md:h-11 text-base md:text-sm font-bold"
                                    onClick={() => { setIsModalOpen(false); setDeleteConfirmId(editingAbsence.id); }}
                                    icon={Trash}
                                >
                                    מחק
                                </Button>
                            )}
                        </div>

                        <Button
                            onClick={handleSave}
                            icon={Check}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 md:h-11 px-8 text-base md:text-sm font-black shadow-lg shadow-emerald-200 transition-all active:scale-95"
                        >
                            {editingAbsence ? 'שמור שינויים' : 'שלח בקשה'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-8 py-4">
                    {!selectedPersonId && !editingAbsence && (
                        <div className="relative">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">בחירת חייל</label>
                            <Select
                                value={formPersonId}
                                onChange={(val) => setFormPersonId(val)}
                                options={activePeople.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(p => ({ value: p.id, label: p.name }))}
                                placeholder="חפש ובחר חייל..."
                            />
                        </div>
                    )}

                    <div className="space-y-6">
                        {(editingAbsence || canApprove) && (
                            <div className="relative">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">סטטוס בקשה</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'pending', label: 'ממתין', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
                                        { id: 'approved', label: 'מאושר', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
                                        { id: 'rejected', label: 'נדחה', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle }
                                    ].map((status) => {
                                        const Icon = status.icon;
                                        const isSelected = formStatus === status.id;
                                        return (
                                            <button
                                                key={status.id}
                                                onClick={() => setFormStatus(status.id as any)}
                                                className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-2 ${isSelected ? status.color + ' ring-2 ring-offset-2 ring-emerald-500/20' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 hover:bg-slate-50 opacity-60'}`}
                                            >
                                                <Icon size={20} weight={isSelected ? 'fill' : 'bold'} />
                                                <span className="text-xs font-black">{status.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <DatePicker label="תאריך יציאה" value={formStartDate} onChange={setFormStartDate} />
                            <DatePicker label="תאריך חזרה" value={formEndDate} onChange={setFormEndDate} />
                        </div>

                        <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm hover:border-emerald-200 group">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100 group-hover:border-emerald-100">
                                        <CalendarDays size={20} weight="bold" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-slate-800">היעדרות ליום שלם</div>
                                        <div className="text-[10px] font-bold text-slate-400">מתייחס לכל טווח התאריכים</div>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        id="isFullDay"
                                        checked={isFullDay}
                                        onChange={(e) => setIsFullDay(e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>

                        {!isFullDay && (
                            <div className="grid grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
                                <TimePicker label="שעת יציאה" value={formStartTime} onChange={setFormStartTime} />
                                <TimePicker label="שעת חזרה" value={formEndTime} onChange={setFormEndTime} />
                            </div>
                        )}
                    </div>

                    <div className="relative space-y-2 pt-2 border-t border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">סיבה / הערה</label>
                        <Input
                            value={formReason}
                            onChange={e => setFormReason(e.target.value)}
                            placeholder="לדוגמה: חופשה שנתית, מחלה, הפנייה רפואית..."
                            icon={FileText}
                        />
                    </div>
                </div>
            </GenericModal>

            {/* Approval Modal */}
            <GenericModal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                title={
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-xl font-black text-emerald-800 leading-tight flex items-center gap-2">
                            <ShieldCheck size={24} className="text-emerald-600" weight="bold" />
                            <span>אישור בקשת יציאה</span>
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] text-emerald-600 font-black uppercase tracking-[0.2em] px-1">
                            <span>תאום שעות יציאה וחזרה סופיות</span>
                        </div>
                    </div>
                }
                size="sm"
                footer={
                    <div className="flex flex-col md:flex-row gap-3 w-full">
                        <Button
                            variant="ghost"
                            onClick={() => setIsApprovalModalOpen(false)}
                            className="flex-1 h-12 md:h-11 text-base md:text-sm font-bold text-slate-500 hover:bg-slate-100"
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={handleConfirmApproval}
                            icon={Check}
                            className="flex-[2] h-12 md:h-11 text-base md:text-sm font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200 transition-all active:scale-95"
                        >
                            אשר יציאה
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6 py-2">
                    <div className="bg-emerald-50/50 p-5 rounded-[1.5rem] border border-emerald-100 flex items-start gap-4 shadow-sm">
                        <div className="mt-1 w-8 h-8 rounded-full bg-white flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
                            <Info size={18} weight="bold" />
                        </div>
                        <p className="text-emerald-900 text-[14px] font-bold leading-relaxed">
                            אנא אשר את שעות היציאה והחזרה הסופיות. ימים אלו יסומנו אוטומטית כ<span className="font-black underline underline-offset-4 decoration-emerald-300">"בית"</span> ביומן הנוכחות.
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <DatePicker label="תאריך יציאה" value={approvalStartDate} onChange={setApprovalStartDate} />
                            <DatePicker label="תאריך חזרה" value={approvalEndDate} onChange={setApprovalEndDate} />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <TimePicker label="שעת יציאה" value={approvalDepartureTime} onChange={setApprovalDepartureTime} />
                            <TimePicker label="שעת חזרה" value={approvalReturnTime} onChange={setApprovalReturnTime} />
                        </div>
                    </div>
                </div>
            </GenericModal>


            {/* Conflict Warning Modal */}
            <ConfirmationModal
                isOpen={conflictModalState.isOpen}
                onCancel={() => setConflictModalState({ ...conflictModalState, isOpen: false })}
                onConfirm={() => {
                    setConflictModalState({ ...conflictModalState, isOpen: false });
                    executeApproval();
                }}
                title="התראה על כפילות שיבוץ"
                confirmText="אשר בכל זאת"
                cancelText="ביטול"
                type="danger"
            >
                <div className="text-right" dir="rtl">
                    <p className="font-bold text-slate-800 mb-2">שים לב! החייל משובץ למשימות הבאות בטווח הזמן של ההיעדרות:</p>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 space-y-2 max-h-[200px] overflow-y-auto">
                        {conflictModalState.conflicts.map((c, i) => {
                            const start = new Date(c.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                            const end = new Date(c.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
                            const date = new Date(c.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });

                            return (
                                <div key={i} className="flex items-center gap-2 text-sm text-red-700">
                                    <AlertTriangle size={14} className="shrink-0" weight="bold" />
                                    <span className="font-bold">{c.taskName}</span>
                                    <span className="text-red-500 text-xs bg-white px-1 py-0.5 rounded border border-red-100">
                                        {date} | {start} - {end}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-sm text-slate-500 mt-3">אישור הבקשה <span className="font-bold">לא ימחק</span> את המשימות הקיימות. האם להמשיך באישור ההיעדרות?</p>
                </div>
            </ConfirmationModal>

            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={!!deleteConfirmId}
                title="מחיקת היעדרות"
                message="האם אתה בטוח שברצונך למחוק היעדרות זו?"
                confirmText="מחק"
                cancelText="ביטול"
                type="danger"
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirmId(null)}
            />

            {/* Mobile Actions Modal */}
            {activeMobileMenu && (
                (() => {
                    const absence = absences.find(a => a.id === activeMobileMenu);
                    if (!absence) return null;
                    const person = people.find(p => p.id === absence.person_id);
                    if (!person) return null;

                    const status = getComputedAbsenceStatus(person, absence).status;
                    const isPending = status === 'pending';

                    return (
                        <SheetModal
                            isOpen={!!activeMobileMenu}
                            onClose={() => setActiveMobileMenu(null)}
                            title={`פעולות עבור ${person.name}`}
                        >
                            <div className="flex flex-col gap-2 py-4">
                                {isPending && canApprove && (
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                        <Button
                                            onClick={() => { setActiveMobileMenu(null); initiateApproval(absence); }}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black h-16 rounded-[1.5rem] flex flex-col items-center justify-center gap-1 shadow-lg shadow-emerald-200 transition-all active:scale-95"
                                        >
                                            <CheckCircle size={24} weight="bold" />
                                            <span className="text-sm">אשר בקשה</span>
                                        </Button>
                                        <Button
                                            onClick={() => { setActiveMobileMenu(null); handleReject(absence); }}
                                            variant="ghost"
                                            className="bg-rose-50 text-rose-600 border border-rose-100 font-black h-16 rounded-[1.5rem] flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
                                        >
                                            <XCircle size={24} weight="bold" />
                                            <span className="text-sm">דחה בקשה</span>
                                        </Button>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {canManage && (
                                        <button
                                            onClick={() => { setActiveMobileMenu(null); openEditModal(absence); }}
                                            className="w-full flex items-center gap-4 p-4 bg-slate-50 text-slate-700 hover:bg-slate-100 font-black transition-all rounded-[1.5rem]"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0 border border-slate-100">
                                                <Edit2 size={24} weight="bold" />
                                            </div>
                                            <div className="flex-1 text-right">
                                                <div className="text-base font-black">ערוך בקשה</div>
                                                <div className="text-xs text-slate-500 font-bold">שנה תאריכים, שעות או סיבה</div>
                                            </div>
                                        </button>
                                    )}

                                    {canManage && (
                                        <button
                                            onClick={() => { setActiveMobileMenu(null); setDeleteConfirmId(absence.id); }}
                                            className="w-full flex items-center gap-4 p-4 bg-rose-50/30 text-rose-600 hover:bg-rose-50 font-black transition-all rounded-[1.5rem] border border-rose-100/50"
                                        >
                                            <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center text-rose-500 shadow-sm shrink-0 border border-rose-100">
                                                <Trash size={24} weight="bold" />
                                            </div>
                                            <div className="flex-1 text-right">
                                                <div className="text-base font-black">מחק בקשה</div>
                                                <div className="text-xs text-rose-400 font-bold">מחיקה לצמיתות של הבקשה</div>
                                            </div>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </SheetModal>
                    );
                })()
            )}

            {/* Primary Action Button (FAB) */}
            <FloatingActionButton
                icon={Plus}
                onClick={() => openAddModal()}
                ariaLabel="בקשה חדשה"
                show={canManage}
            />
        </div>
    );
};
