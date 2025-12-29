import React, { useState, useMemo } from 'react';
import { Person, Absence } from '@/types';
import { addAbsence, deleteAbsence, updateAbsence, upsertDailyPresence } from '@/services/supabaseClient';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/features/auth/AuthContext';
import { Calendar as CalendarIcon, Search, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, UserX, FileText, Info, AlertTriangle, Clock, CheckCircle2, CalendarDays, Wand2, ArrowUpDown, Tag, ShieldCheck, XCircle, ChevronDown, ArrowRight, ChevronUp, Filter, MoreVertical } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Select } from '@/components/ui/Select';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { logger } from '@/services/loggingService';

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
    const { organization, profile } = useAuth();
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
        // If it is pending, check DB (dailyAvailability).
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
        return activePeople.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
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
                return personA.localeCompare(personB);
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
        // OR: If creator has permission, allow them to check "Approved"? 
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

        // NEW: Check for Conflicts with Shifts
        // 1. Identify date range
        // 2. Filter shifts for this person in this range
        const personId = approvingAbsence.person_id;
        const approvalStartTimeIso = new Date(`${approvalStartDate}T${approvalDepartureTime}`).toISOString();
        const approvalEndTimeIso = new Date(`${approvalEndDate}T${approvalReturnTime}`).toISOString();

        const conflictingShifts = shifts.filter(s => {
            // Check if person is assigned
            if (!s.assignedPersonIds.includes(personId)) return false;
            if (s.isCancelled) return false;

            // Check Overlap: (ShiftStart < AbsenceEnd) && (ShiftEnd > AbsenceStart)
            // Note: Shift times are full ISOs. We constructing Approval ISOs for check.
            // Simplified check: Does the shift fall on any day of the absence?
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
        <div className="bg-white rounded-2xl shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-100px)] overflow-hidden">
            {/* Header */}
            <div className="bg-white p-4 md:px-6 md:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                        <CalendarDays size={24} />
                    </div>
                    <div className="relative">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-bold text-slate-800">בקשות יציאה והיעדרויות</h2>
                            <button
                                onClick={() => setShowInfo(!showInfo)}
                                className={`p-1 rounded-full transition-colors ${showInfo ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'}`}
                            >
                                <Info size={18} />
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">ניהול אילוצים ובקשות מיוחדות מהחיילים</p>

                        {/* Info Popover */}
                        {showInfo && (
                            <div className="absolute top-full right-0 mt-2 w-72 bg-white p-3 rounded-xl shadow-xl border border-amber-100 z-50 text-right animate-in fade-in zoom-in-95">
                                <div className="text-xs text-slate-600 leading-relaxed relative">
                                    <div className="absolute -top-4 -right-1 w-3 h-3 bg-white border-t border-r border-amber-100 rotate-45 transform"></div>
                                    <span className="font-bold block mb-1 text-amber-600">לידיעתך:</span>
                                    בקשות שאושרו יסומנו אוטומטית כ"בבית" ביומן הנוכחות. בקשות שנדחו יסומנו כ"בבסיס".
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {canManage && (
                        <Button onClick={() => openAddModal()} icon={Plus} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" data-testid="add-absence-btn">
                            <span className="hidden md:inline">בקשה חדשה</span>
                        </Button>
                    )}
                </div>
            </div>



            {/* Mobile Tabs */}
            <div className="flex md:hidden border-b border-slate-200 bg-white shrink-0">
                <button
                    onClick={() => setIsSidebarOpen(true)}
                    className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${isSidebarOpen || selectedPersonId ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    רשימת שמות
                </button>
                <button
                    onClick={() => { setIsSidebarOpen(false); setSelectedPersonId(null); }}
                    className={`flex-1 py-3 text-sm font-bold text-center border-b-2 transition-colors ${!isSidebarOpen && !selectedPersonId ? 'border-blue-600 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    בקשות יציאה ({activeAbsences.length})
                </button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar: People List */}
                <div className={`w-full md:w-80 bg-slate-50/50 border-l border-slate-100 flex-col shrink-0 flex-1 md:flex-none min-h-0 ${isSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-2 h-[57px]">
                        {isSearchOpen ? (
                            <div className="flex-1 flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-200">
                                <div className="relative flex-1">
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder="חיפוש חייל..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onBlur={() => { if (!searchTerm) setIsSearchOpen(false); }}
                                        className="w-full pl-3 pr-8 py-1.5 text-sm bg-white border border-blue-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder-slate-400"
                                    />
                                    <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                                <button
                                    onClick={() => { setSearchTerm(''); setIsSearchOpen(false); }}
                                    className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <button
                                    onClick={() => {
                                        const areAllCollapsed = teams.length > 0 && teams.every(t => collapsedTeams[t.id]);
                                        if (areAllCollapsed) expandAllTeams();
                                        else collapseAllTeams();
                                    }}
                                    className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/50"
                                >
                                    {teams.length > 0 && teams.every(t => collapsedTeams[t.id]) ? (
                                        <>
                                            <ChevronDown size={14} />
                                            פתח צוותים
                                        </>
                                    ) : (
                                        <>
                                            <ChevronUp size={14} />
                                            כווץ צוותים
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setIsSearchOpen(true)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-full transition-all shadow-sm border border-transparent hover:border-slate-100"
                                    title="חיפוש"
                                >
                                    <Search size={16} />
                                </button>
                            </>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        <div className="flex items-center justify-between px-2 mb-2">
                            <button
                                onClick={() => setSelectedPersonId(null)}
                                className={`hidden md:block text-sm font-bold transition-all ${selectedPersonId === null ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'}`}
                            >
                                כל הבקשות
                            </button>
                        </div>

                        {/* Teams Rendering */}
                        {teams.length > 0 ? (
                            <>
                                {teams.map(team => {
                                    const teamPeople = groupedPeople[team.id] || [];
                                    if (teamPeople.length === 0) return null;
                                    const isCollapsed = collapsedTeams[team.id];

                                    return (
                                        <div key={team.id} className="mb-2">
                                            <button
                                                onClick={() => toggleTeamCollapse(team.id)}
                                                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 transition-colors text-right group"
                                            >
                                                <span className="font-bold text-xs text-slate-500 uppercase">{team.name}</span>
                                                <ChevronDown size={14} className={`text-slate-400 transition-transform ${isCollapsed ? '' : 'rotate-180'}`} />
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
                                                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-right ${isSelected ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-100/50'}`}
                                                            >
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${person.color.replace('border-', 'bg-')}`}>
                                                                    {person.name.slice(0, 2)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className={`font-bold truncate text-sm ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{person.name}</div>
                                                                    {pendingCount > 0 && <div className="text-[10px] text-amber-600 font-bold">{pendingCount} ממתינות</div>}
                                                                </div>
                                                                {personAbsences.length > 0 && (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center ${pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
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
                                        <div className="px-2 py-1 font-bold text-xs text-slate-400 uppercase">ללא צוות</div>
                                        {groupedPeople['ungrouped'].map(person => {
                                            const isSelected = selectedPersonId === person.id;
                                            const personAbsences = activeAbsences.filter(a => a.person_id === person.id);
                                            const pendingCount = personAbsences.filter(a => getComputedAbsenceStatus(person, a).status === 'pending').length;
                                            return (
                                                <button
                                                    key={person.id}
                                                    onClick={() => { setSelectedPersonId(person.id); setIsSidebarOpen(false); }}
                                                    className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-right mb-1 ${isSelected ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-100/50'}`}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${person.color.replace('border-', 'bg-')}`}>
                                                        {person.name.slice(0, 2)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className={`font-bold truncate text-sm ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>{person.name}</div>
                                                        {pendingCount > 0 && <div className="text-[10px] text-amber-600 font-bold">{pendingCount} ממתינות</div>}
                                                    </div>
                                                    {personAbsences.length > 0 && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold min-w-[18px] text-center ${pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
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
                            filteredPeople.map((person, index) => {
                                const isSelected = selectedPersonId === person.id;
                                const personAbsences = activeAbsences.filter(a => a.person_id === person.id);
                                const pendingCount = personAbsences.filter(a => {
                                    const computed = getComputedAbsenceStatus(person, a);
                                    return computed.status === 'pending';
                                }).length;

                                return (
                                    <React.Fragment key={person.id}>
                                        <button
                                            onClick={() => { setSelectedPersonId(person.id); setIsSidebarOpen(false); }}
                                            className={`w-full flex items-center gap-3 p-3 transition-all text-right ${isSelected ? 'bg-red-50 border-r-4 border-red-500 shadow-sm' : 'hover:bg-slate-50 border-r-4 border-transparent'}`}
                                            aria-selected={isSelected}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${person.color.replace('border-', 'bg-')}`}>
                                                {person.name.slice(0, 2)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className={`font-bold truncate ${isSelected ? 'text-red-900' : 'text-slate-700'}`}>{person.name}</div>
                                                {pendingCount > 0 && <div className="text-[10px] text-amber-600 font-bold">{pendingCount} ממתינות לאישור</div>}
                                            </div>
                                            {personAbsences.length > 0 && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-bold min-w-[20px] text-center ${pendingCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {personAbsences.length}
                                                </span>
                                            )}
                                        </button>
                                        {index < filteredPeople.length - 1 && <div className="h-px bg-slate-50 mx-4"></div>}
                                    </React.Fragment>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className={`flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative ${!isSidebarOpen ? 'flex' : 'hidden md:flex'}`}>
                    {!selectedPersonId ? (
                        // All Absences List View
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                        רשימת בקשות יציאה
                                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{activeAbsences.length}</span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* Sort Controls */}
                                    <div className="hidden md:flex gap-1 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
                                        <button
                                            onClick={() => setSortBy('date')}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${sortBy === 'date' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            לפי תאריך
                                        </button>
                                        <button
                                            onClick={() => setSortBy('name')}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${sortBy === 'name' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            לפי שם
                                        </button>
                                        <button
                                            onClick={() => setSortBy('status')}
                                            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${sortBy === 'status' ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                                        >
                                            לפי סטטוס
                                        </button>
                                    </div>

                                    {/* Mobile Sort Icon & Modal */}
                                    <div className="md:hidden relative">
                                        <button
                                            onClick={() => setIsSortOpen(!isSortOpen)}
                                            className={`p-1.5 rounded-md transition-all ${isSortOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                            title="מיון"
                                        >
                                            <ArrowUpDown size={16} />
                                        </button>

                                        {isSortOpen && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                                                <div className="fixed inset-0 z-40" onClick={() => setIsSortOpen(false)}></div>
                                                <div className="w-full max-w-xs bg-white rounded-lg shadow-2xl border border-slate-100 py-1 z-50 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95">
                                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm text-center">
                                                        מיון לפי
                                                    </div>
                                                    <button onClick={() => { setSortBy('date'); setIsSortOpen(false); }} className={`text-right px-3 py-3 text-sm font-medium border-b border-slate-50 ${sortBy === 'date' ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}>לפי תאריך</button>
                                                    <button onClick={() => { setSortBy('name'); setIsSortOpen(false); }} className={`text-right px-3 py-3 text-sm font-medium border-b border-slate-50 ${sortBy === 'name' ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}>לפי שם</button>
                                                    <button onClick={() => { setSortBy('status'); setIsSortOpen(false); }} className={`text-right px-3 py-3 text-sm font-medium border-b border-slate-50 ${sortBy === 'status' ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}>לפי סטטוס</button>
                                                    <button onClick={() => setIsSortOpen(false)} className="p-3 text-center text-slate-400 text-xs mt-auto">סגור</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Status Filters - Custom Dropdown/Modal */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsFilterOpen(!isFilterOpen)}
                                            className={`p-1.5 rounded-md transition-all ${filterStatus !== 'all' || isFilterOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                                            title="סנן לפי סטטוס"
                                        >
                                            <Filter size={16} />
                                        </button>

                                        {isFilterOpen && (
                                            <div className="fixed inset-0 z-50 md:absolute md:inset-auto md:top-full md:left-0 md:mt-2 flex items-center justify-center md:block p-4 md:p-0 bg-black/50 md:bg-transparent">
                                                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsFilterOpen(false)}></div>
                                                <div className="w-full max-w-xs md:w-32 bg-white rounded-lg shadow-2xl md:shadow-xl border border-slate-100 py-1 z-50 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 md:animate-none">
                                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 md:hidden font-bold text-slate-700 text-sm text-center">
                                                        סינון לפי סטטוס
                                                    </div>
                                                    {[
                                                        { value: 'all', label: 'כל הסטטוסים' },
                                                        { value: 'pending', label: 'ממתין' },
                                                        { value: 'approved', label: 'מאושר' },
                                                        { value: 'rejected', label: 'נדחה' }
                                                    ].map(opt => (
                                                        <button
                                                            key={opt.value}
                                                            onClick={() => { setFilterStatus(opt.value as any); setIsFilterOpen(false); }}
                                                            className={`text-right px-3 py-3 md:py-2 text-sm md:text-xs font-medium hover:bg-slate-50 transition-colors border-b md:border-none border-slate-50 last:border-0 ${filterStatus === opt.value ? 'text-blue-600 bg-blue-50' : 'text-slate-600'}`}
                                                        >
                                                            {opt.label}
                                                        </button>
                                                    ))}
                                                    <button onClick={() => setIsFilterOpen(false)} className="md:hidden p-3 text-center text-slate-400 text-xs mt-auto">סגור</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {activeAbsences.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <CalendarIcon size={48} className="mb-4 opacity-20" />
                                        <p>אין בקשות יציאה רשומות במערכת</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {sortedAbsences.map(absence => {
                                            const person = people.find(p => p.id === absence.person_id);
                                            if (!person) return null;

                                            // Merge with pending updates if any
                                            const effectiveAbsence = { ...absence, ...(pendingUpdates[absence.id] || {}) };

                                            // Calculate status based on presence data
                                            const computed = getComputedAbsenceStatus(person, effectiveAbsence);
                                            const status = effectiveAbsence.status !== 'pending' ? effectiveAbsence.status : computed.status;

                                            // Status Helpers
                                            const isApproved = status === 'approved';
                                            const isRejected = status === 'rejected';
                                            const isPartial = status === 'partially_approved';
                                            const isPending = status === 'pending';

                                            return (
                                                <div key={absence.id} className={`relative flex flex-col md:flex-row md:items-center gap-4 p-4 bg-white border rounded-xl hover:shadow-lg transition-all group overflow-hidden ${isPending ? 'border-amber-200 ring-1 ring-amber-100' : 'border-slate-100'}`}>
                                                    {/* Status Strip */}
                                                    <div className={`absolute top-0 bottom-0 right-0 w-1.5 
                                                        ${isApproved ? 'bg-green-500' : isRejected ? 'bg-red-500' : isPartial ? 'bg-orange-500' : 'bg-amber-500'}
                                                    `}></div>

                                                    <div className="flex items-center gap-4 z-10 flex-1">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm z-10 text-lg ${person.color.replace('border-', 'bg-')}`}>
                                                            {person.name.slice(0, 2)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <div className="font-bold text-slate-800 text-lg">{person.name}</div>
                                                                <div className={`text-xs px-2 py-0.5 rounded-full font-bold flex items-center gap-1
                                                                    ${isApproved ? 'bg-green-100 text-green-700' : isRejected ? 'bg-red-100 text-red-700' : isPartial ? 'bg-orange-100 text-orange-800' : 'bg-amber-100 text-amber-800 animate-pulse'}
                                                                `}>


                                                                    {isApproved ? (
                                                                        <>
                                                                            <CheckCircle2 size={10} />
                                                                            <span className="hidden md:inline">אושר</span>
                                                                        </>
                                                                    ) : isRejected ? (
                                                                        <>
                                                                            <XCircle size={10} />
                                                                            <span className="hidden md:inline">נדחה</span>
                                                                        </>
                                                                    ) : isPartial ? (
                                                                        <>
                                                                            <AlertTriangle size={10} />
                                                                            <span className="hidden md:inline">אושר חלקית</span>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Clock size={10} />
                                                                            <span className="hidden md:inline">ממתין לאישור</span>
                                                                            <span className="md:hidden">ממתין</span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Mobile Header Actions (Approve/Reject + More Menu) */}
                                                                <div className="flex items-center gap-1 md:hidden mr-4 pl-2">
                                                                    {isPending && canApprove && (
                                                                        <>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); initiateApproval(absence); }}
                                                                                className="p-1.5 bg-green-50 text-green-600 rounded-full border border-green-100 shadow-sm"
                                                                            >
                                                                                <Check size={14} />
                                                                            </button>
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleReject(absence); }}
                                                                                className="p-1.5 bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm"
                                                                            >
                                                                                <X size={14} />
                                                                            </button>
                                                                        </>
                                                                    )}

                                                                    {/* 3-Dots Menu */}
                                                                    {canManage && (
                                                                        <div className="relative">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); setActiveActionMenuId(activeActionMenuId === absence.id ? null : absence.id); }}
                                                                                className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-full"
                                                                            >
                                                                                <MoreVertical size={16} />
                                                                            </button>
                                                                            {activeActionMenuId === absence.id && (
                                                                                <div className="absolute top-full left-0 mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); openEditModal(absence); setActiveActionMenuId(null); }}
                                                                                        className="w-full text-right px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                                                                    >
                                                                                        <Edit2 size={14} /> עריכה
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(absence.id); setActiveActionMenuId(null); }}
                                                                                        className="w-full text-right px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-50"
                                                                                    >
                                                                                        <Trash2 size={14} /> מחיקה
                                                                                    </button>
                                                                                </div>
                                                                            )}
                                                                            {/* Menu Overlay */}
                                                                            {activeActionMenuId === absence.id && (
                                                                                <div className="fixed inset-0 z-40" onClick={() => setActiveActionMenuId(null)}></div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-3 text-slate-500 text-sm">
                                                                <div className="flex items-center gap-1.5">
                                                                    <CalendarDays size={14} className="text-slate-400" />
                                                                    <span className="font-medium text-slate-700">
                                                                        {new Date(absence.start_date).toDateString() === new Date(absence.end_date).toDateString()
                                                                            ? new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
                                                                            : `${new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} - ${new Date(absence.end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}`}
                                                                    </span>
                                                                    {formatTimeRange(absence.start_time, absence.end_time) && (
                                                                        <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-1 dir-ltr inline-block">
                                                                            {formatTimeRange(absence.start_time, absence.end_time)}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {absence.reason && (
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md truncate max-w-[200px] bg-slate-50 text-slate-600">
                                                                        <Tag size={12} className="text-slate-400" />
                                                                        <span className="truncate text-xs">{absence.reason}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions (Desktop Only) */}
                                                    <div className="hidden md:flex items-center gap-2">
                                                        {(isPending || isPartial) && canApprove && (
                                                            <>
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-green-600 hover:bg-green-700 text-white"
                                                                    onClick={() => initiateApproval(absence)}
                                                                    icon={Check}
                                                                >
                                                                    אשר
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                                                    onClick={() => handleReject(absence)}
                                                                    icon={X}
                                                                >
                                                                    דחה
                                                                </Button>
                                                            </>
                                                        )}

                                                        {canManage && (
                                                            <div className="flex gap-1 mr-2 border-r pr-2 border-slate-200">
                                                                <Button size="sm" variant="ghost" onClick={() => openEditModal(absence)} icon={Edit2} aria-label="ערוך" />
                                                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => setDeleteConfirmId(absence.id)} icon={Trash2} aria-label="מחק" />
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
                        <div className="flex flex-col h-full">
                            <div className="relative p-4 md:py-4 border-b border-slate-100 flex items-center justify-between bg-white h-[72px]">
                                {/* Right Side: Back Button */}
                                <div className="flex items-center z-10">
                                    <button
                                        onClick={() => { setSelectedPersonId(null); setIsSidebarOpen(true); }}
                                        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 hover:bg-slate-50 px-3 py-2 rounded-lg transition-all group"
                                    >
                                        <div className="bg-slate-100 p-1 rounded-md group-hover:bg-slate-200 transition-colors">
                                            <ChevronRight size={20} />
                                        </div>
                                        <span className="font-medium hidden md:inline">חזרה לרשימה</span>
                                    </button>
                                </div>

                                {/* Center: Date Navigation */}
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-4 bg-slate-50 px-4 py-1.5 rounded-full border border-slate-200 shadow-sm z-0">
                                    <button onClick={handlePrevMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600" aria-label="חודש קודם"><ChevronRight size={20} /></button>
                                    <span className="text-lg font-bold min-w-[120px] text-center text-slate-800" aria-live="polite">{viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</span>
                                    <button onClick={handleNextMonth} className="p-1 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600" aria-label="חודש הבא"><ChevronLeft size={20} /></button>
                                </div>

                                {/* Left Side: Name */}
                                <div className="flex items-center z-10">
                                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">
                                        {people.find(p => p.id === selectedPersonId)?.name}
                                    </h2>
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
                                                    aspect-square rounded-xl flex flex-col items-center justify-between p-1 md:p-2 transition-all border relative group ${canManage ? 'cursor-pointer' : ''}
                                                    ${absence
                                                        ? (status === 'approved' ? 'bg-green-50 border-green-200'
                                                            : status === 'rejected' ? 'bg-red-50 border-red-200'
                                                                : 'bg-amber-50 border-amber-200')
                                                        : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md'}
                                                    ${isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                                                `}
                                            >
                                                <div className="flex justify-between w-full items-start">
                                                    <span className={`text-sm md:text-base font-bold ${absence ? 'text-slate-800' : 'text-slate-400'}`}>{date.getDate()}</span>
                                                    {absence && (
                                                        <div className="">
                                                            {status === 'approved' && <CheckCircle2 size={14} className="text-green-600" />}
                                                            {status === 'rejected' && <X size={14} className="text-red-500" />}
                                                            {status === 'pending' && <Clock size={14} className="text-amber-500" />}
                                                        </div>
                                                    )}
                                                </div>

                                                {absence && (
                                                    <div className="flex flex-col items-center w-full">
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-full mb-1
                                                            ${status === 'approved' ? 'bg-green-100 text-green-700'
                                                                : status === 'rejected' ? 'bg-red-100 text-red-700'
                                                                    : 'bg-amber-100 text-amber-700'}
                                                        `}>
                                                            {absence.reason || 'היעדרות'}
                                                        </span>
                                                    </div>
                                                )}

                                                {!absence && canManage && (
                                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <div className="bg-blue-50 text-blue-600 p-2 rounded-full">
                                                            <Plus size={20} />
                                                        </div>
                                                    </div>
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
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAbsence ? 'עריכת היעדרות' : 'בקשת יציאה חדשה'} size="md">
                <div className="space-y-4">
                    {!selectedPersonId && !editingAbsence && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">חייל</label>
                            <Select
                                value={formPersonId}
                                onChange={(val) => setFormPersonId(val)}
                                options={activePeople.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id, label: p.name }))}
                                placeholder="בחר חייל..."
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <DatePicker label="תאריך יציאה (משוער)" value={formStartDate} onChange={setFormStartDate} />
                        <DatePicker label="תאריך חזרה (משוער)" value={formEndDate} onChange={setFormEndDate} />
                    </div>

                    <div className="flex items-center gap-2 py-1">
                        <input
                            type="checkbox"
                            id="isFullDay"
                            checked={isFullDay}
                            onChange={(e) => setIsFullDay(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                        />
                        <label htmlFor="isFullDay" className="text-sm font-medium text-slate-700">כל היום (התעלם משעות)</label>
                    </div>

                    {!isFullDay && (
                        <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                            <TimePicker label="שעת יציאה" value={formStartTime} onChange={setFormStartTime} />
                            <TimePicker label="שעת חזרה" value={formEndTime} onChange={setFormEndTime} />
                        </div>
                    )}

                    <div>
                        <Input
                            label="סיבה / הערה"
                            value={formReason}
                            onChange={e => setFormReason(e.target.value)}
                            placeholder="לדוגמה: חופשה שנתית, מחלה, הפנייה רפואית..."
                            icon={FileText}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        {canManage && editingAbsence && (
                            <Button variant="ghost" className="text-red-600 hover:bg-red-50 mr-auto" onClick={() => { setIsModalOpen(false); setDeleteConfirmId(editingAbsence.id); }} icon={Trash2}>
                                מחק
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
                        <Button variant="primary" onClick={handleSave} icon={Check}>שלח בקשה</Button>
                    </div>
                </div>
            </Modal>

            {/* Approval Modal */}
            <Modal
                isOpen={isApprovalModalOpen}
                onClose={() => setIsApprovalModalOpen(false)}
                title={
                    <div className="flex items-center gap-2 text-green-700">
                        <ShieldCheck size={24} />
                        <span>אישור יציאה</span>
                    </div>
                }
                size="sm"
            >
                <div className="space-y-4">
                    <p className="text-slate-600 text-sm">
                        אנא אשר את שעות היציאה והחזרה הסופיות. ימים אלו יסומנו כ"בית" ביומן.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 mb-2">
                        <DatePicker
                            label="תאריך יציאה"
                            value={approvalStartDate}
                            onChange={setApprovalStartDate}
                        />
                        <DatePicker
                            label="תאריך חזרה"
                            value={approvalEndDate}
                            onChange={setApprovalEndDate}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <TimePicker
                            label="שעת יציאה בפועל"
                            value={approvalDepartureTime}
                            onChange={setApprovalDepartureTime}
                        />
                        <TimePicker
                            label="שעת חזרה בפועל"
                            value={approvalReturnTime}
                            onChange={setApprovalReturnTime}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        <Button variant="ghost" onClick={() => setIsApprovalModalOpen(false)}>ביטול</Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirmApproval} icon={Check}>
                            אשר יציאה
                        </Button>
                    </div>
                </div>
            </Modal>

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
                                    <AlertTriangle size={14} className="shrink-0" />
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
        </div >
    );
};
