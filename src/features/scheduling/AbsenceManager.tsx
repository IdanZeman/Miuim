import React, { useState, useMemo } from 'react';
import { Person, Absence } from '@/types';
import { addAbsence, deleteAbsence, updateAbsence, upsertDailyPresence } from '@/services/supabaseClient';
import { useToast } from '@/contexts/ToastContext';
import { useAuth } from '@/features/auth/AuthContext';
import { Calendar as CalendarIcon, Search, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, UserX, FileText, Info, AlertTriangle, Clock, CheckCircle2, CalendarDays, Wand2, ArrowUpDown, Tag, ShieldCheck, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { Select } from '@/components/ui/Select';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';

interface AbsenceManagerProps {
    people: Person[];
    absences: Absence[];
    onAddAbsence: (absence: Absence) => void;
    onUpdateAbsence: (absence: Absence) => void;
    onDeleteAbsence: (id: string) => void;
    onUpdatePerson: (p: Person) => void;
    isViewer?: boolean;
    onNavigateToAttendance?: () => void;
}

export const AbsenceManager: React.FC<AbsenceManagerProps> = ({
    people, absences, onAddAbsence, onUpdateAbsence, onDeleteAbsence, onUpdatePerson,
    isViewer = false, onNavigateToAttendance
}) => {
    const activePeople = people.filter(p => p.isActive !== false);
    const { organization, profile } = useAuth();
    const { showToast } = useToast();
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

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

    // Time & Full Day State
    const [formStartTime, setFormStartTime] = useState<string>('08:00');
    const [formEndTime, setFormEndTime] = useState<string>('17:00');
    const [isFullDay, setIsFullDay] = useState(true);

    // Approval Modal State
    const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
    const [approvingAbsence, setApprovingAbsence] = useState<Absence | null>(null);
    const [approvalStartDate, setApprovalStartDate] = useState<string>('');
    const [approvalEndDate, setApprovalEndDate] = useState<string>('');
    const [approvalDepartureTime, setApprovalDepartureTime] = useState('10:00');
    const [approvalReturnTime, setApprovalReturnTime] = useState('14:00'); // Return to base time if relevant, or just end of leave

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [sortBy, setSortBy] = useState<'date' | 'name'>('date');

    // --- Helpers ---
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
        return activeAbsences
            .sort((a, b) => {
                if (a.status === 'pending' && b.status !== 'pending') return -1;
                if (a.status !== 'pending' && b.status === 'pending') return 1;
                if (sortBy === 'date') return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
                const personA = people.find(p => p.id === a.person_id)?.name || '';
                const personB = people.find(p => p.id === b.person_id)?.name || '';
                return personA.localeCompare(personB);
            });
    }, [activeAbsences, sortBy, people]);

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
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showToast('שגיאה בשמירה', 'error');
        }
    };

    const initiateApproval = (absence: Absence) => {
        setApprovingAbsence(absence);
        setApprovalStartDate(absence.start_date);
        setApprovalEndDate(absence.end_date);
        setApprovalDepartureTime(absence.start_time !== '00:00' ? absence.start_time || '10:00' : '10:00');
        setApprovalReturnTime(absence.end_time !== '23:59' ? absence.end_time || '14:00' : '14:00');
        setIsApprovalModalOpen(true);
    };

    const handleConfirmApproval = async () => {
        if (!approvingAbsence || !profile) return;
        if (approvalEndDate < approvalStartDate) {
            showToast('תאריך חזרה חייב להיות אחרי או שווה לתאריך יציאה', 'error');
            return;
        }

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
                // If it's the first/last day, we might want to record the specific leave/return times
                // but for 'home' status it's usually considered the whole day.
                // However, the schema allows it.
                start_time: isFirstDay ? approvalDepartureTime : '00:00',
                end_time: isLastDay ? approvalReturnTime : '23:59'
            });
        }

        try {
            // 1. Update Absence (Dates/Times) - Status is filtered out by mapper
            const updated: Absence = {
                ...approvingAbsence,
                status: 'approved', // Optimistic UI update
                start_date: approvalStartDate,
                end_date: approvalEndDate,
                start_time: approvalDepartureTime,
                end_time: approvalReturnTime,
                approved_by: profile.id,
                approved_at: new Date().toISOString()
            };

            await updateAbsence(updated);

            // 2. Upsert Daily Presence
            if (updates.length > 0) {
                await upsertDailyPresence(updates);
            }

            // 3. Update Person Daily Availability JSON (Source of Truth for status badges)
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

            onUpdateAbsence(updated);
            showToast('הבקשה אושרה והנוכחות עודכנה', 'success');
            setIsApprovalModalOpen(false);
            setApprovingAbsence(null);
        } catch (e) {
            console.error(e);
            showToast('שגיאה באישור הבקשה', 'error');
        }
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

            onUpdateAbsence(updated);
            showToast('הבקשה נדחתה והנוכחות עודכנה לבסיס', 'info');
        } catch (e) {
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
            setDeleteConfirmId(null);
        } catch (e) {
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
        if (baseDays > 0) return { status: 'rejected' };

        return { status: 'pending' };
    };

    const formatTimeRange = (start?: string, end?: string) => {
        if (!start || !end || (start === '00:00' && end === '23:59')) return null;
        return `${start} - ${end}`;
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] overflow-hidden">
            {/* Header */}
            <div className="bg-white p-4 md:px-6 md:py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                        <CalendarDays size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">בקשות יציאה והיעדרויות</h2>
                        <p className="text-xs text-slate-500 font-medium">ניהול אילוצים ובקשות מיוחדות מהחיילים</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {onNavigateToAttendance && (
                        <Button
                            variant="outline"
                            onClick={onNavigateToAttendance}
                            icon={Wand2}
                            className="text-blue-600 border-blue-200 hover:bg-blue-50 hidden md:flex"
                        >
                            הפעל מחולל סבבים
                        </Button>
                    )}
                    {canManage && (
                        <Button onClick={() => openAddModal()} icon={Plus} className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200" data-testid="add-absence-btn">
                            <span className="hidden md:inline">בקשה חדשה</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Info Alert */}
            <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-start md:items-center gap-3">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5 md:mt-0" />
                <p className="text-xs md:text-sm text-amber-800 font-medium leading-tight">
                    בקשות שאושרו יסומנו אוטומטית כ"בבית" ביומן הנוכחות עבור התאריכים הרלוונטיים. בקשות שנדחו יסומנו כ"בבסיס" (או לפי ברירת המחדל).
                </p>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                {/* Sidebar: People List */}
                <div className={`w-full md:w-80 bg-slate-50/50 border-l border-slate-100 flex-col shrink-0 ${selectedPersonId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100 space-y-3">
                        <Input
                            placeholder="חיפוש חייל..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={Search}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        <button
                            onClick={() => setSelectedPersonId(null)}
                            className={`w-full text-right p-3 rounded-lg font-bold text-sm transition-all ${selectedPersonId === null ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                            aria-selected={selectedPersonId === null}
                            role="button"
                        >
                            כל הבקשות יציאה (רשימה מרוכזת)
                        </button>
                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                        {filteredPeople.map((person, index) => {
                            const isSelected = selectedPersonId === person.id;
                            const personAbsences = activeAbsences.filter(a => a.person_id === person.id);
                            const pendingCount = personAbsences.filter(a => {
                                const computed = getComputedAbsenceStatus(person, a);
                                return computed.status === 'pending';
                            }).length;

                            return (
                                <React.Fragment key={person.id}>
                                    <button
                                        onClick={() => setSelectedPersonId(person.id)}
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
                        })}
                    </div>
                </div>

                {/* Main Content */}
                <div className={`flex-1 flex flex-col min-w-0 bg-white overflow-hidden relative ${!selectedPersonId ? 'hidden md:flex' : 'flex'}`}>
                    {!selectedPersonId ? (
                        // All Absences List View
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                    רשימת בקשות יציאה
                                    <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">{activeAbsences.length}</span>
                                </h3>
                                <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-slate-200 shadow-sm">
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

                                            // Calculate status based on presence data
                                            const computed = getComputedAbsenceStatus(person, absence);
                                            const status = computed.status;

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
                                                                    {isApproved && <CheckCircle2 size={10} />}
                                                                    {isRejected && <XCircle size={10} />}
                                                                    {isPartial && <AlertTriangle size={10} />}
                                                                    {isPending && <Clock size={10} />}

                                                                    {isApproved ? 'אושר' : isRejected ? 'נדחה' : isPartial ? 'אושר חלקית' : 'ממתין לאישור'}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-3 text-slate-500 text-sm">
                                                                <div className="flex items-center gap-1.5">
                                                                    <CalendarDays size={14} className="text-slate-400" />
                                                                    <span className="font-medium text-slate-700">
                                                                        {new Date(absence.start_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} - {new Date(absence.end_date).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
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

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-2 z-10 mt-3 md:mt-0 border-t md:border-t-0 pt-3 md:pt-0">
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
                                        onClick={() => setSelectedPersonId(null)}
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
        </div>
    );
};
