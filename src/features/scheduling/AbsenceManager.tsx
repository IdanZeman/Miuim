import React, { useState, useMemo } from 'react';
import { Person, Absence } from '@/types';
import { addAbsence, deleteAbsence, updateAbsence, upsertDailyPresence } from '@/services/supabaseClient';
import { useToast } from '@/contexts/ToastContext';
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
    Info
} from '@phosphor-icons/react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Select } from '@/components/ui/Select';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { logger } from '@/services/loggingService';
import { PageInfo } from '@/components/ui/PageInfo';
import { GenericModal } from '@/components/ui/GenericModal';



interface AbsenceManagerProps {
    people: Person[];
    absences: Absence[];
    onAddAbsence: (absence: Absence) => void;
    onUpdateAbsence: (absence: Absence) => void;
    onDeleteAbsence: (id: string) => void;
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
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null); // NEW // NEW

    // Permissions
    const canApprove = profile?.permissions?.canApproveRequests || profile?.is_super_admin;
    const canManage = !isViewer; // Or specifically canManageUsers if we want to restrict creation

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

    // Approval Modal State
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvingAbsence, setApprovingAbsence] = useState<Absence | null>(null);
    // Optimistic UI State
    const [pendingUpdates, setPendingUpdates] = useState<Record<string, Partial<Absence>>>({});
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

    // --- Helpers ---
    // Dynamic Status Calculation based on DAILY AVAILABILITY (Source of Truth)
    const getComputedAbsenceStatus = (person: Person, absence: Absence): { status: 'approved' | 'rejected' | 'pending' | 'partially_approved' } => {
        // If we have an explicit optimistic status (that is NOT pending), usage it. 
        // If it is pending, CheckIcon DB (dailyAvailability).
        if (absence.status && absence.status !== 'pending') return { status: absence.status as any };

        const start = new Date(absence.start_date);
        const end = new Date(absence.end_date);

        let totalDays = 0;
        let homeDays = 0;
        let baseDays = 0;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            totalDays++;
            const dateKey = d.toLocaleDateString('en-CA');
            const availability = person.dailyAvailability?.[dateKey];

            if (!availability) {
                continue;
            }

            if (availability.status === 'home' || availability.status === 'leave') {
                homeDays++;
            } else if (availability.status === 'base' || availability.status === 'arrival' || availability.status === 'departure') {
                baseDays++;
            }
        }

        if (homeDays === totalDays && totalDays > 0) return { status: 'approved' };
        if (homeDays > 0 && homeDays < totalDays) return { status: 'partially_approved' };
        // REMOVED: if (baseDays > 0) return { status: 'rejected' };
        // Pending request should remain pending even if currently scheduled as base.

        return { status: 'pending' };
    };
    const filteredPeople = useMemo(() => {
        return activePeople.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }, [activePeople, searchTerm]);

    const activeAbsences = useMemo(() => {
        return absences.filter(a => activePeople.some(p => p.id === a.person_id));
    }, [absences, activePeople]);

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
                if (filterStatus === 'approved') return status === 'approved' || status === 'partially_approved';
                if (filterStatus === 'rejected') return status === 'rejected';
                return true;
            });
        }

        return filtered
            .sort((a, b) => {
                if (sortBy === 'status') {
                    const statusA = a.status || 'pending';
                    const statusB = b.status || 'pending';
                    return statusA.localeCompare(statusB);
                }
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                if (sortBy === 'date') return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
                const personA = people.find(p => p.id === a.person_id)?.name || '';
                const personB = people.find(p => p.id === b.person_id)?.name || '';
                return personA.localeCompare(personB, 'he');
            });
    }, [activeAbsences, sortBy, people, filterStatus]);

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

        // Determine status: if user can approve, auto-approve? 
        // Logic: If creating new, set as 'pending'. Admin can approve immediately if they want via the list.
        // OR: If creator has permission, allow them to CheckIcon "Approved"? 
        // For simplicity: Create as 'pending' unless editing existing.
        let status = editingAbsence?.status || 'pending';

        try {
            if (editingAbsence) {
                // Update
                const updated = {
                    ...editingAbsence,
                    person_id: formPersonId,
                    start_date: formStartDate,
                    end_date: formEndDate,
                    start_time: finalStartTime,
                    end_time: finalEndTime,
                    reason: formReason,
                    status
                };
                await updateAbsence(updated);
                onUpdateAbsence(updated);
                showToast('ההיעדרות עודכנה בהצלחה', 'success');
            } else {
                // Add
                const newAbsence = await addAbsence({
                    person_id: formPersonId,
                    organization_id: organization.id,
                    start_date: formStartDate,
                    end_date: formEndDate,
                    start_time: finalStartTime,
                    end_time: finalEndTime,
                    reason: formReason,
                    status: 'pending' // Always pending initially
                });
                onAddAbsence(newAbsence);
                showToast('הבקשה נשלחה לאישור', 'success');
                await logger.logCreate('absence', newAbsence.id, 'בקשת יציאה', newAbsence);
            }
            setIsModalOpen(false);
        } catch (e) {
            logger.error('CREATE', 'Failed to save absence', e);
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

            await updateAbsence(updated);

            if (updates.length > 0) {
                await upsertDailyPresence(updates);
            }

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

            setPendingUpdates(prev => ({ ...prev, [updated.id]: updated }));
            onUpdateAbsence(updated);
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
            await updateAbsence(updated);

            // 2. Upsert Daily Presence
            if (updates.length > 0) {
                await upsertDailyPresence(updates);
            }

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

            setPendingUpdates(prev => ({ ...prev, [updated.id]: updated }));
            onUpdateAbsence(updated);
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
        try {
            await deleteAbsence(deleteConfirmId);
            onDeleteAbsence(deleteConfirmId);
            showToast('ההיעדרות נמחקה', 'success');
            await logger.logDelete('absence', deleteConfirmId, 'מחיקת בקשת יציאה');
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



    const formatTimeRange = (start?: string, end?: string) => {
        if (!start || !end || (start === '00:00' && end === '23:59')) return null;
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
        <div className="relative min-h-screen bg-transparent" dir="rtl">
            {/* Main Premium Container */}
            <div className="relative z-10 max-w-[1600px] mx-auto pt-0 md:pt-6 px-0 md:px-6 pb-6 h-screen flex flex-col">
                <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 overflow-hidden flex flex-col flex-1">

                    {/* Premium Mobile Header - Glassmorphism */}
                    <div className="md:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-5 pt-8 pb-4 space-y-4 shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <h1 className="text-2xl font-black text-slate-900 tracking-tight">בקשות והיעדרויות</h1>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ניהול אילוצים ובקשות יציאה</span>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm shadow-emerald-100/50">
                                <CalendarDays size={26} weight="duotone" />
                            </div>
                        </div>

                        {/* Mobile Search & Action Toolbar */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 relative group">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
                                    <Search size={18} strokeWidth={2.5} />
                                </div>
                                <input
                                    placeholder="חפש חייל..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    inputMode="search"
                                    className="block w-full h-12 pr-12 pl-4 bg-slate-100/60 border border-transparent rounded-2xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-base"
                                />
                            </div>
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`h-12 w-12 rounded-2xl border border-slate-200 transition-all flex items-center justify-center shrink-0 ${filterStatus !== 'all' ? 'bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-200' : 'bg-white text-slate-500'}`}
                            >
                                <Filter size={20} weight="bold" />
                            </button>
                        </div>

                        {/* Mobile Segmented Control */}
                        <div className="flex p-1.5 bg-slate-100 rounded-2xl gap-1">
                            <button
                                onClick={() => setIsSidebarOpen(true)}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${isSidebarOpen || selectedPersonId
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                רשימת שמות
                            </button>
                            <button
                                onClick={() => { setIsSidebarOpen(false); setSelectedPersonId(null); }}
                                className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${!isSidebarOpen && !selectedPersonId
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                בקשות ({activeAbsences.length})
                            </button>
                        </div>
                    </div>

                    {/* Desktop Header Container (Hidden on Mobile) */}
                    <div className="hidden md:flex sticky top-0 bg-white/95 backdrop-blur-md z-40 py-3 mb-0 px-6 transition-all border-b border-slate-100 shadow-sm items-center justify-between shrink-0">
                        <div className="flex items-center gap-4 shrink-0">
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                                <CalendarDays size={24} weight="duotone" />
                            </div>
                            <div className="flex flex-col">
                                <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">בקשות יציאה והיעדרויות</h1>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ניהול אילוצים ובקשות יציאה</span>
                                    <PageInfo
                                        title="ניהול היעדרויות"
                                        description={
                                            <div className="space-y-2">
                                                <p>כאן מנהלים את כל בקשות היציאה, החופשות והסיווגים של אנשי הצוות.</p>
                                                <ul className="list-disc list-inside space-y-1 text-sm font-medium text-slate-600">
                                                    <li><b>אישור בקשה:</b> מעדכן אוטומטית את יומן הנוכחות כ"בבית".</li>
                                                    <li><b>דחיית בקשה:</b> מסמן את החייל כ"בבסיס".</li>
                                                    <li><b>תצוגה אישית:</b> לחיצה על שם חייל תפתח יומן שנתי עבורו.</li>
                                                </ul>
                                            </div>
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Active Filters Display */}
                            {filterStatus !== 'all' && (
                                <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider border border-emerald-100 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                    סינון: {filterStatus === 'pending' ? 'ממתין' : filterStatus === 'approved' ? 'מאושר' : 'נדחה'}
                                    <button onClick={() => setFilterStatus('all')} className="hover:text-emerald-800 transition-colors"><X size={14} weight="bold" /></button>
                                </span>
                            )}

                            <div className="h-10 w-px bg-slate-100 mx-2"></div>

                            <button
                                onClick={() => {
                                    const areAllCollapsed = teams.length > 0 && teams.every(t => collapsedTeams[t.id]);
                                    if (areAllCollapsed) expandAllTeams();
                                    else collapseAllTeams();
                                }}
                                className="flex items-center gap-2 text-xs font-black text-slate-500 hover:text-emerald-600 transition-all px-4 py-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100"
                            >
                                {teams.length > 0 && teams.every(t => collapsedTeams[t.id]) ? (
                                    <><ChevronDown size={16} weight="bold" /> פתח הכל</>
                                ) : (
                                    <><ChevronUp size={16} weight="bold" /> כווץ הכל</>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
                        {/* Sidebar: People List */}
                        <div className={`w-full md:w-80 bg-white border-l border-slate-100 flex flex-col shrink-0 flex-1 md:flex-none min-h-0 ${isSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
                            {/* PC Only Title Area */}
                            <div className="hidden md:flex px-6 py-5 border-b border-slate-100 bg-white items-center justify-between">
                                <div className="flex flex-col text-right">
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">רשימת שמות</h3>
                                    <span className="text-[10px] text-slate-400 font-bold">{activePeople.length} חיילים פעילים</span>
                                </div>
                                <div className="flex items-center gap-1">
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

                            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
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
                                                    const pendingCount = personAbsences.filter(a => getComputedAbsenceStatus(person, a).status === 'pending').length;
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
                                        <div className="flex items-center gap-3">
                                            {/* Desktop Sort Controls */}
                                            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                                                <button
                                                    onClick={() => setSortBy('date')}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${sortBy === 'date' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    תאריך
                                                </button>
                                                <button
                                                    onClick={() => setSortBy('name')}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${sortBy === 'name' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    שם
                                                </button>
                                                <button
                                                    onClick={() => setSortBy('status')}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${sortBy === 'status' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    סטטוס
                                                </button>
                                            </div>

                                            <div className="h-6 w-px bg-slate-100 hidden md:block mx-1"></div>

                                            {/* Filter Status */}
                                            <div className="relative">
                                                <button
                                                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                                                    className={`h-9 px-3 rounded-xl text-[10px] font-black border transition-all flex items-center gap-2 ${filterStatus !== 'all' ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                >
                                                    <Filter size={14} weight="bold" />
                                                    <span>
                                                        {filterStatus === 'all' ? 'כל הסטטוסים' : filterStatus === 'pending' ? 'ממתין' : filterStatus === 'approved' ? 'מאושר' : 'נדחה'}
                                                    </span>
                                                </button>

                                                {isFilterOpen && (
                                                    <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setIsFilterOpen(false)}></div>
                                                        <div className="absolute top-full left-0 mt-2 w-40 bg-white rounded-[1.25rem] shadow-2xl border border-slate-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                                            {[
                                                                { id: 'all', label: 'כל הסטטוסים' },
                                                                { id: 'pending', label: 'ממתין לאישור' },
                                                                { id: 'approved', label: 'מאושרים' },
                                                                { id: 'rejected', label: 'נדחו' }
                                                            ].map(f => (
                                                                <button
                                                                    key={f.id}
                                                                    onClick={() => { setFilterStatus(f.id as any); setIsFilterOpen(false); }}
                                                                    className={`w-full text-right px-4 py-2 text-xs font-bold transition-colors ${filterStatus === f.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}
                                                                >
                                                                    {f.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {activeAbsences.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                                <CalendarIcon size={48} className="mb-4 opacity-20" weight="duotone" />
                                                <p>אין בקשות יציאה רשומות במערכת</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {sortedAbsences.map(absence => {
                                                    const person = people.find(p => p.id === absence.person_id);
                                                    if (!person) return null;

                                                    // Merge with pending updates if any
                                                    const effectiveAbsence = { ...absence, ...(pendingUpdates[absence.id] || {}) };
                                                    const status = getComputedAbsenceStatus(person, effectiveAbsence).status;

                                                    // Status Helpers
                                                    const isApproved = status === 'approved';
                                                    const isRejected = status === 'rejected';
                                                    const isPartial = status === 'partially_approved';
                                                    const isPending = status === 'pending';

                                                    return (
                                                        <div key={absence.id} className={`relative flex flex-col md:flex-row md:items-center gap-4 p-5 bg-white border rounded-[2rem] hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500 group overflow-hidden ${isPending ? 'border-amber-100 bg-amber-50/5' : 'border-slate-100'}`}>
                                                            {/* Status Decorator */}
                                                            <div className={`absolute top-0 bottom-0 right-0 w-1.5 md:w-2 transition-all group-hover:w-3
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

                                                                        {/* Mobile Header Actions */}
                                                                        <div className="flex items-center gap-2 md:hidden mr-auto">
                                                                            {isPending && canApprove && (
                                                                                <>
                                                                                    <button onClick={(e) => { e.stopPropagation(); initiateApproval(absence); }} className="w-10 h-10 flex items-center justify-center bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-200 active:scale-90 transition-transform"><Check size={20} weight="bold" /></button>
                                                                                    <button onClick={(e) => { e.stopPropagation(); handleReject(absence); }} className="w-10 h-10 flex items-center justify-center bg-rose-500 text-white rounded-xl shadow-lg shadow-rose-200 active:scale-90 transition-transform"><X size={20} weight="bold" /></button>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-500">
                                                                        <div className="flex items-center gap-2.5 bg-slate-50/80 px-4 py-1.5 rounded-xl border border-slate-100/50 shadow-sm">
                                                                            <CalendarDays size={16} className="text-emerald-500" weight="duotone" />
                                                                            <span className="text-sm font-bold text-slate-700 tracking-tight">
                                                                                {new Date(absence.start_date).toDateString() === new Date(absence.end_date).toDateString()
                                                                                    ? new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })
                                                                                    : `${new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} - ${new Date(absence.end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`}
                                                                            </span>
                                                                            {formatTimeRange(absence.start_time, absence.end_time) && (
                                                                                <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100/50 mr-1">
                                                                                    {formatTimeRange(absence.start_time, absence.end_time)}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        {absence.reason && (
                                                                            <div className="flex items-center gap-2 max-w-[300px]">
                                                                                <Tag size={16} className="text-slate-400" weight="duotone" />
                                                                                <span className="text-sm font-bold text-slate-500 truncate">{absence.reason}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Actions (Desktop Only) */}
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
                                                const status = absence?.status || 'pending';

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
                                                                ? (status === 'approved' ? 'bg-emerald-50/40 border-emerald-100/50 text-emerald-900'
                                                                    : status === 'rejected' ? 'bg-rose-50/40 border-rose-100/50 text-rose-900'
                                                                        : 'bg-amber-50/40 border-amber-100/50 text-amber-900')
                                                                : 'bg-white border-slate-50 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5'}
                                                    ${isToday ? 'ring-2 ring-emerald-500 ring-offset-2 z-10' : ''}
                                                `}
                                                    >
                                                        {/* Background status accent for absence */}
                                                        {absence && (
                                                            <div className={`absolute top-0 right-0 left-0 h-1.5 transition-all group-hover:h-2
                                                        ${status === 'approved' ? 'bg-emerald-500' : status === 'rejected' ? 'bg-rose-500' : 'bg-amber-500'}
                                                    `}></div>
                                                        )}

                                                        <div className="flex justify-between w-full items-start z-10">
                                                            <span className={`text-base md:text-xl font-black tracking-tighter transition-colors ${absence ? 'text-slate-800' : 'text-slate-300 group-hover:text-emerald-500'}`}>
                                                                {date.getDate()}
                                                            </span>
                                                            {absence && (
                                                                <div className="shrink-0 p-1.5 rounded-xl bg-white/80 backdrop-blur-sm shadow-sm border border-white/50">
                                                                    {status === 'approved' && <CheckCircle size={16} className="text-emerald-600" weight="bold" />}
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
                                    <Tag size={12} className="text-emerald-500" weight="duotone" />
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
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <DatePicker label="תאריך יציאה" value={formStartDate} onChange={setFormStartDate} />
                                    <DatePicker label="תאריך חזרה" value={formEndDate} onChange={setFormEndDate} />
                                </div>

                                <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-100 transition-all hover:bg-white hover:shadow-sm hover:border-emerald-200 group">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-slate-100 group-hover:border-emerald-100">
                                                <CalendarDays size={20} weight="duotone" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-black text-slate-800">היעדרות ליום שלם</div>
                                                <div className="text-[10px] font-bold text-slate-400">מתייחס לכל טווח התאריכים</div>
                                            </div>
                                        </div>
                                        <div className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id="isFullDay"
                                                checked={isFullDay}
                                                onChange={(e) => setIsFullDay(e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                        </div>
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
                                    <ShieldCheck size={24} className="text-emerald-600" weight="duotone" />
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
                                            <AlertTriangle size={14} className="shrink-0" weight="duotone" />
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

                    {/* Primary Action Button (FAB) */}
                    <FloatingActionButton
                        icon={Plus}
                        onClick={() => openAddModal()}
                        ariaLabel="בקשה חדשה"
                        show={canManage}
                    />
                </div>
            </div>
        </div>
    );
};
