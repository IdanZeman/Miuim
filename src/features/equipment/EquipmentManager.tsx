import React, { useState, useMemo } from 'react';
import { Person, Equipment, EquipmentStatus, Team, EquipmentDailyCheck } from '@/types';
import {
    Package,
    MagnifyingGlass as Search,
    Plus,
    User,
    CheckCircle as CheckCircle2,
    WarningCircle as AlertCircle,
    ClockCounterClockwise as History,
    QrCode,
    Trash as Trash2,
    PencilSimple,
    Funnel as Filter,
    Tag,
    CaretRight as ChevronRight,
    Users,
    CaretLeft as ChevronLeft,
    CalendarBlank as CalendarIcon,
    Hammer,
    Check,
    Info,
    ClipboardText,
    Copy,
    XCircle,
    WarningCircle,
    CalendarBlank as Calendar
} from '@phosphor-icons/react';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { PageInfo } from '@/components/ui/PageInfo';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import { useToast } from '@/contexts/ToastContext';
import { DatePicker } from '@/components/ui/DatePicker';

interface EquipmentManagerProps {
    people: Person[];
    teams: Team[];
    equipment: Equipment[];
    equipmentDailyChecks: EquipmentDailyCheck[];
    onUpdateEquipment: (e: Equipment) => void;
    onAddEquipment: (e: Equipment) => void;
    onDeleteEquipment: (id: string) => void;
    onUpsertEquipmentCheck: (check: EquipmentDailyCheck) => void;
    isViewer?: boolean;
    currentPerson: Person | null;
}

const PersonSearchSelect = ({
    people,
    teams,
    value,
    onChange
}: {
    people: Person[],
    teams: Team[],
    value: string | null,
    onChange: (id: string | null) => void
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState<string | 'all'>('all');

    const filteredPeople = useMemo(() => {
        return people.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTeam = selectedTeamId === 'all' || p.teamId === selectedTeamId;
            return matchesSearch && matchesTeam;
        });
    }, [people, searchTerm, selectedTeamId]);

    const selectedPerson = people.find(p => p.id === value);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2.5">
                <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} weight="duotone" />
                    <input
                        type="text"
                        placeholder="חפש חייל לפי שם..."
                        className="w-full h-11 pr-11 pl-4 bg-slate-100/50 border border-transparent rounded-xl text-base font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-52">
                    <Select
                        value={selectedTeamId}
                        onChange={(val) => setSelectedTeamId(val)}
                        options={[{ value: 'all', label: 'כל הצוותים' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                        className="bg-slate-100/50 border-transparent rounded-xl h-11 text-base font-bold"
                    />
                </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50 custom-scrollbar bg-slate-50/30 shadow-inner shadow-slate-200/5">
                <button
                    onClick={() => onChange(null)}
                    className={`w-full text-right px-5 py-3 text-[13px] flex items-center justify-between transition-all active:scale-[0.99] ${value === null ? 'bg-indigo-50/80 text-indigo-700 font-black' : 'hover:bg-white text-slate-500 font-bold'}`}
                >
                    <span>ללא חתימה (ניטרלי)</span>
                    {value === null && <Check size={16} weight="bold" className="text-indigo-600" />}
                </button>
                {filteredPeople.map(p => {
                    const team = teams.find(t => t.id === p.teamId);
                    return (
                        <button
                            key={p.id}
                            onClick={() => onChange(p.id)}
                            className={`w-full text-right px-5 py-3 text-[13px] flex items-center justify-between transition-all active:scale-[0.99] ${value === p.id ? 'bg-indigo-50/80 text-indigo-700 font-black' : 'hover:bg-white text-slate-700 font-bold'}`}
                        >
                            <div className="flex flex-col text-right">
                                <span>{p.name}</span>
                                {team && <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{team.name}</span>}
                            </div>
                            {value === p.id && <Check size={16} weight="bold" className="text-indigo-600" />}
                        </button>
                    );
                })}
                {filteredPeople.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs font-bold italic opacity-60">לא נמצאו תוצאות לחיפוש זה</div>
                )}
            </div>
            {selectedPerson && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-in slide-in-from-top-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <User size={12} weight="bold" />
                    </div>
                    <span className="text-[13px] font-black text-indigo-700">חתום על ידי: {selectedPerson.name}</span>
                </div>
            )}
        </div>
    );
};

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({
    people,
    teams,
    equipment,
    equipmentDailyChecks,
    onUpdateEquipment,
    onAddEquipment,
    onDeleteEquipment,
    onUpsertEquipmentCheck,
    isViewer = false,
    currentPerson
}) => {
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'list' | 'verify'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showMobileTypeFilter, setShowMobileTypeFilter] = useState(false);
    const [showMobileStatusFilter, setShowMobileStatusFilter] = useState(false);

    // Optimistic UI State
    const [optimisticIds, setOptimisticIds] = useState<Record<string, Equipment>>({});

    // Reset optimistic state when real data arrives
    React.useEffect(() => {
        setOptimisticIds({});
    }, [equipment]);

    const displayedEquipment = useMemo(() => {
        return equipment.map(e => optimisticIds[e.id] || e);
    }, [equipment, optimisticIds]);

    // Date Navigation State
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Modal State
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<Equipment> | null>(null);

    // Derived Data
    const filteredItems = useMemo(() => {
        return displayedEquipment.filter(item => {
            const assignedPerson = people.find(p => p.id === item.assigned_to_id);
            const team = assignedPerson ? teams.find(t => t.id === assignedPerson.teamId) : null;

            const matchesSearch = item.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (assignedPerson?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (team?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesType = filterType === 'all' || item.type === filterType;
            const matchesStatus = filterStatus === 'all' || item.status === filterStatus;

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [displayedEquipment, searchTerm, filterType, filterStatus, people, teams]);

    const equipmentTypes = Array.from(new Set(displayedEquipment.map(e => e.type)));

    const handleSaveItem = async () => {
        if (!editingItem?.type || !editingItem?.serial_number) {
            showToast('נא למלא סוג ומספר צלם', 'error');
            return;
        }

        if (editingItem.id) {
            onUpdateEquipment(editingItem as Equipment);
            showToast('הפריט עודכן בהצלחה', 'success');
        } else {
            const newItem: Equipment = {
                id: Math.random().toString(36).substr(2, 9),
                organization_id: '',
                type: editingItem.type,
                serial_number: editingItem.serial_number,
                assigned_to_id: editingItem.assigned_to_id || null,
                signed_at: editingItem.assigned_to_id ? new Date().toISOString() : null,
                last_verified_at: null,
                status: 'present',
                notes: editingItem.notes
            };
            onAddEquipment(newItem);
            showToast('פריט חדש נוסף', 'success');
        }
        setIsAddEditModalOpen(false);
        setEditingItem(null);
    };

    const canVerifyItem = (item: Equipment) => {
        if (isViewer) return false;
        if (!currentPerson) return false;

        // Personal check
        if (item.assigned_to_id === currentPerson.id) return true;

        // Commander check
        if (currentPerson.isCommander && currentPerson.teamId) {
            const assignedPerson = people.find(p => p.id === item.assigned_to_id);
            if (assignedPerson && assignedPerson.teamId === currentPerson.teamId) {
                return true;
            }
        }

        // If no specifically restricted scope is found and user has edit access, allow (for admins)
        // We'll trust the component-level isViewer which is driven by dataScope
        return true;
    };

    const handleVerify = async (itemId: string, status: EquipmentStatus) => {
        const item = equipment.find(e => e.id === itemId);
        if (!item || !canVerifyItem(item)) {
            showToast('אין לך הרשאה לדווח על פריט זה', 'error');
            return;
        }

        // Create daily check record
        const checkDate = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const checkId = `check-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const dailyCheck: EquipmentDailyCheck = {
            id: checkId,
            equipment_id: item.id,
            organization_id: item.organization_id,
            check_date: checkDate,
            status: status,
            checked_by: currentPerson?.userId || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        onUpsertEquipmentCheck(dailyCheck);
        showToast(`עודכן סטטוס לתאריך ${selectedDate.toLocaleDateString('he-IL')}`, 'success');
    };

    const getStatusColor = (status: EquipmentStatus) => {
        switch (status) {
            case 'present': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
            case 'missing': return 'text-rose-600 bg-rose-50 border-rose-100';
            case 'damaged': return 'text-amber-600 bg-amber-50 border-amber-100';
            case 'lost': return 'text-slate-600 bg-slate-50 border-slate-100';
            default: return 'text-slate-600 bg-slate-50 border-slate-100';
        }
    };

    const getStatusLabel = (status: EquipmentStatus) => {
        switch (status) {
            case 'present': return 'נמצא';
            case 'missing': return 'חסר';
            case 'damaged': return 'תקול';
            case 'lost': return 'אבד';
            default: return status;
        }
    };

    // Helper to compare dates reliably (avoids timezone issues)
    const isSameDay = (date1: Date | string | null, date2: Date) => {
        if (!date1) return false;
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.toISOString().split('T')[0] === d2.toISOString().split('T')[0];
    };

    // Stats calculation
    const stats = useMemo(() => ({
        total: displayedEquipment.length,
        faulty: displayedEquipment.filter(e => e.status === 'damaged').length,
        missing: displayedEquipment.filter(e => e.status === 'missing' || e.status === 'lost').length,
        checkedOut: displayedEquipment.filter(e => e.assigned_to_id).length
    }), [displayedEquipment]);

    // Date Navigation Helpers
    const handlePrevDay = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        setSelectedDate(d);
    };

    const handleNextDay = () => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + 1);
        setSelectedDate(d);
    };

    const isToday = (date: Date) => {
        return date.toDateString() === new Date().toDateString();
    };

    const handleExportToClipboard = async () => {
        try {
            const header = viewMode === 'list'
                ? ['מספר צלם', 'סוג', 'שיוך', 'סטטוס', 'הערות'].join('\t')
                : [`מספר צלם`, 'סוג', `סטטוס בדיקה (${selectedDate.toLocaleDateString('he-IL')})`].join('\t');

            const rows = (viewMode === 'list' || viewMode === 'verify' ? displayedEquipment : []).map(item => {
                // Filter logic should ideally match "filteredItems" but standard export usually exports CURRENT view.
                // NOTE: Using 'filteredItems' to respect search/filter
                if (viewMode === 'list') {
                    const person = people.find(p => p.id === item.assigned_to_id)?.name || '-';
                    const statusLabel = getStatusLabel(item.status);
                    const cleanNotes = (item.notes || '').replace(/[\n\r]+/g, ' '); // Remove newlines for CSV/TSV safety
                    return [item.serial_number, item.type, person, statusLabel, cleanNotes].join('\t');
                } else {
                    const isVerified = item.last_verified_at && new Date(item.last_verified_at).toDateString() === selectedDate.toDateString();
                    const status = isVerified ? getStatusLabel(item.status) : 'טרם דווח';
                    return [item.serial_number, item.type, status].join('\t');
                }
            });

            // If using filteredItems:
            const itemsToExport = filteredItems;
            const exportRows = itemsToExport.map(item => {
                if (viewMode === 'list') {
                    const person = people.find(p => p.id === item.assigned_to_id)?.name || '-';
                    const statusLabel = getStatusLabel(item.status);
                    const cleanNotes = (item.notes || '').replace(/[\n\r]+/g, ' ');
                    return [item.serial_number, item.type, person, statusLabel, cleanNotes].join('\t');
                } else {
                    const isVerified = item.last_verified_at && new Date(item.last_verified_at).toDateString() === selectedDate.toDateString();
                    const status = isVerified ? getStatusLabel(item.status) : 'טרם דווח';
                    return [item.serial_number, item.type, status].join('\t');
                }
            }).join('\n');

            const content = `${header}\n${exportRows}`;
            await navigator.clipboard.writeText(content);
            showToast('הטבלה הועתקה ללוח בהצלחה', 'success');
        } catch (err) {
            console.error('Export failed', err);
            showToast('שגיאה בהעתקה ללוח', 'error');
        }
    };

    return (
        <div className="bg-slate-50 md:bg-white rounded-[2rem] md:rounded-2xl shadow-xl md:shadow-none border md:border-slate-100 p-0 md:p-6 min-h-[600px] relative overflow-hidden" dir="rtl">
            {/* Mobile Hero Header - Adapt from AbsenceManager style */}
            <div className="md:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 px-5 pt-6 pb-4 space-y-4 shrink-0 transition-all rounded-b-[2rem]">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                            רשימת ציוד
                        </h2>
                        <span className="text-[10px] font-black text-slate-400 upper-case tracking-widest mt-0.5">שו"ב אמצעים ומלאי יחידתי</span>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportToClipboard}
                            className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm shadow-indigo-100/50 hover:bg-indigo-100 transition-colors"
                            title="העתק רשימה"
                        >
                            <Copy size={20} weight="duotone" />
                        </button>
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm shadow-indigo-100/50">
                            <Package size={22} weight="duotone" />
                        </div>
                    </div>
                </div>

                {/* Mobile View Toggle */}
                <div className="flex p-1 bg-slate-200/50 rounded-2xl gap-1">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'list'
                            ? 'bg-white text-indigo-700 shadow-md scale-[1.02]'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <span>רשימה</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-300/50 text-slate-600'}`}>
                            {displayedEquipment.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setViewMode('verify')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'verify'
                            ? 'bg-white text-indigo-700 shadow-md scale-[1.02]'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <span>בדיקה יומית</span>
                        <ClipboardText size={16} weight="duotone" />
                    </button>
                </div>
            </div>

            <div className="pb-32">

                {/* Content Sheet (Responsive) */}
                <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 px-4 py-6 min-h-[70vh] md:mt-2">


                    {/* Header Section (Desktop Only Title) */}
                    <div className="hidden md:flex items-center gap-2 border-b border-slate-100 pb-4 mb-6">
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                                <Package size={24} weight="duotone" />
                            </div>
                            רשימת ציוד
                            <PageInfo
                                title="רשימת ציוד"
                                description={
                                    <div className="space-y-3 font-medium">
                                        <p>מערכת למעקב וניהול הציוד היחידתי (נשק, אופטיקה, קשר וכו').</p>
                                        <div className="grid grid-cols-1 gap-2">
                                            <div className="flex items-start gap-2 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                                <span><b>מעקב חתימות:</b> מי חתום על איזה ציוד כרגע.</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                                <span><b>סטטוס תקינות:</b> דיווח ומעקב אחר ציוד תקול, חסר או בתיקון.</span>
                                            </div>
                                            <div className="flex items-start gap-2 text-sm">
                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                                <span><b>בדיקה יומית:</b> (בלשונית 'בדיקה יומית') ביצוע ספירת מלאי יומית ואימות הימצאות הציוד.</span>
                                            </div>
                                        </div>
                                        <p className="text-sm bg-indigo-50 p-3 rounded-xl text-indigo-800 border border-indigo-100 mt-2">
                                            ניהול נכון כאן מונע אובדן ציוד ומבטיח כשירות מבצעית.
                                        </p>
                                    </div>
                                }
                            />
                        </h2>
                    </div>

                    {/* DESKTOP: Stats Strip */}
                    <div className="hidden md:flex items-center gap-6 mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                <Package size={24} weight="duotone" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold">סה"כ פריטים</p>
                                <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                <AlertCircle size={24} weight="duotone" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold">ציוד תקול</p>
                                <p className="text-2xl font-black text-slate-800">{stats.faulty}</p>
                            </div>
                        </div>
                        <div className="w-px h-10 bg-slate-200" />
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                                <History size={24} weight="duotone" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-bold">חסרים / אבודים</p>
                                <p className="text-2xl font-black text-slate-800">{stats.missing}</p>
                            </div>
                        </div>

                    </div>

                    {/* DESKTOP View Toggle */}
                    <div className="hidden md:flex items-center justify-between mb-6">
                        <div className="bg-slate-100/80 p-1.5 rounded-2xl flex items-center gap-1">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${viewMode === 'list'
                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <Package size={18} weight={viewMode === 'list' ? 'duotone' : 'regular'} />
                                רשימת ציוד
                            </button>
                            <button
                                onClick={() => setViewMode('verify')}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black transition-all ${viewMode === 'verify'
                                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                <ClipboardText size={18} weight={viewMode === 'verify' ? 'duotone' : 'regular'} />
                                בדיקה יומית
                            </button>
                        </div>

                        <button
                            onClick={handleExportToClipboard}
                            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-all border border-indigo-100"
                            title="העתק טבלה ללוח"
                        >
                            <Copy size={18} weight="bold" />
                            <span>העתק טבלה</span>
                        </button>
                    </div>

                    {/* MOBILE Controls (Only for List View) */}
                    {viewMode === 'list' && (
                        <div className="md:hidden flex items-center gap-2 mb-6">
                            <div className="relative flex-1">
                                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} weight="duotone" />
                                <input
                                    type="text"
                                    placeholder="חיפוש..."
                                    className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-base font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="w-[42px] shrink-0">
                                <button
                                    className={`w-[42px] h-[42px] flex items-center justify-center rounded-xl border transition-colors ${filterType !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                    onClick={() => setShowMobileTypeFilter(true)}
                                >
                                    <Tag size={18} weight="duotone" />
                                </button>
                            </div>
                            <div className="w-[42px] shrink-0">
                                <button
                                    className={`w-[42px] h-[42px] flex items-center justify-center rounded-xl border transition-colors ${filterStatus !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                    onClick={() => setShowMobileStatusFilter(true)}
                                >
                                    <Filter size={18} weight="duotone" />
                                </button>
                            </div>
                            {(filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
                                <button
                                    onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
                                    className="w-[42px] h-[42px] flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                                >
                                    <Trash2 size={18} weight="duotone" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* DESKTOP Controls (Only for List View) */}
                    {viewMode === 'list' && (
                        <div className="hidden md:flex items-center gap-4 mb-6">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="חיפוש לפי צלם, שם חייל, או סוג..."
                                    className="w-full h-11 pr-11 pl-4 bg-slate-100/50 border border-transparent rounded-[1.25rem] focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all text-base font-bold"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="w-56">
                                <Select
                                    value={filterType}
                                    onChange={setFilterType}
                                    options={[{ value: 'all', label: 'סינון לפי סוג: הכל' }, ...equipmentTypes.map(t => ({ value: t, label: t }))]}
                                    className="bg-slate-100/50 border-transparent rounded-[1.25rem] h-11"
                                />
                            </div>
                            <div className="w-56">
                                <Select
                                    value={filterStatus}
                                    onChange={setFilterStatus}
                                    options={[
                                        { value: 'all', label: 'סינון לפי סטטוס: הכל' },
                                        { value: 'present', label: 'נמצא' },
                                        { value: 'missing', label: 'חסר' },
                                        { value: 'damaged', label: 'תקול' },
                                        { value: 'lost', label: 'אבד' }
                                    ]}
                                    className="bg-slate-100/50 border-transparent rounded-[1.25rem] h-11"
                                />
                            </div>
                            {(filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
                                <button
                                    onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
                                    className="w-11 h-11 flex items-center justify-center bg-rose-50 text-rose-500 rounded-[1.25rem] hover:bg-rose-100 transition-colors border border-rose-100"
                                >
                                    <Trash2 size={20} weight="duotone" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* Content Area */}
                    <div className="space-y-2">

                        {/* MOBILE LIST VIEW */}
                        <div className="md:hidden space-y-4">
                            {viewMode === 'list' && filteredItems.map(item => {
                                const assignedPerson = people.find(p => p.id === item.assigned_to_id);

                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => {
                                            if (!isViewer) {
                                                setEditingItem(item);
                                                setIsAddEditModalOpen(true);
                                            }
                                        }}
                                        className={`w-full flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-[1.5rem] shadow-sm active:scale-[0.98] active:bg-slate-50 transition-all text-right group ${!isViewer ? 'hover:bg-slate-50' : ''}`}
                                    >
                                        {/* Left Info */}
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100/50">
                                                <Package size={24} weight="duotone" />
                                            </div>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base font-black text-slate-900 leading-tight">{item.serial_number}</span>
                                                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 font-black uppercase tracking-tight">{item.type}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    {assignedPerson ? (
                                                        <>
                                                            <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500 shrink-0 uppercase">
                                                                {assignedPerson.name.slice(0, 1)}
                                                            </div>
                                                            <span className="text-[13px] font-bold text-slate-600">{assignedPerson.name}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest italic">לא חתום</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Right Info / Status */}
                                        <div className="flex items-center gap-3">
                                            <div className={`px-3 py-1.5 rounded-xl text-[11px] font-black border tracking-tight ${getStatusColor(item.status)}`}>
                                                {getStatusLabel(item.status)}
                                            </div>
                                            {!isViewer && <ChevronLeft size={18} className="text-slate-300 group-hover:text-indigo-600 transition-colors" weight="bold" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* DESKTOP TABLE VIEW */}
                        {viewMode === 'list' && (
                            <div className="hidden md:block overflow-hidden rounded-[1.5rem] border border-slate-100 shadow-sm bg-white">
                                <table className="w-full text-right">
                                    <thead>
                                        <tr className="bg-slate-50/50 border-b border-slate-100">
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">פריט / צלם</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">סוג אמצעי</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">שיוך / אחריות</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">סטטוס תקינות</th>
                                            <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none text-left">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {filteredItems.map(item => {
                                            const assignedPerson = people.find(p => p.id === item.assigned_to_id);
                                            const team = assignedPerson ? teams.find(t => t.id === assignedPerson.teamId) : null;

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                                <Package size={20} weight="duotone" />
                                                            </div>
                                                            <span className="font-black text-slate-800 tracking-tight">{item.serial_number}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg uppercase tracking-tight">{item.type}</span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {assignedPerson ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-black text-slate-700 leading-tight">{assignedPerson.name}</span>
                                                                {team && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{team.name}</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest italic leading-tight">לא חתום</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`inline-flex px-3 py-1.5 rounded-xl text-[11px] font-black border tracking-tight ${getStatusColor(item.status)}`}>
                                                            {getStatusLabel(item.status)}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {!isViewer && (
                                                            <div className="flex items-center gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => { setEditingItem(item); setIsAddEditModalOpen(true); }}
                                                                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-100"
                                                                    title="עריכה"
                                                                >
                                                                    <PencilSimple size={18} weight="duotone" />
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
                                                                            onDeleteEquipment(item.id);
                                                                            showToast('הפריט נמחק', 'info');
                                                                        }
                                                                    }}
                                                                    className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-100"
                                                                    title="מחיקה"
                                                                >
                                                                    <Trash2 size={18} weight="duotone" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* VERIFY VIEW */}
                        {viewMode === 'verify' && (
                            <div className="space-y-4">

                                {/* Date Navigation Bar */}
                                <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200">
                                    {/* Prev Day - Right in RTL */}
                                    <button
                                        onClick={handlePrevDay}
                                        className="p-2 rounded-lg hover:bg-white text-indigo-600 transition-colors"
                                        aria-label="יום קודם"
                                    >
                                        <ChevronRight size={20} weight="duotone" />
                                    </button>

                                    <div className="flex items-center gap-2">
                                        <CalendarIcon size={16} className="text-slate-500" aria-hidden="true" weight="duotone" />
                                        <span className="font-bold text-slate-700" aria-live="polite">
                                            {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </span>
                                        {isToday(selectedDate) && (
                                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">היום</span>
                                        )}
                                    </div>

                                    {/* Next Day - Left in RTL */}
                                    <button
                                        onClick={handleNextDay}
                                        className={`p-2 rounded-lg hover:bg-white transition-colors ${!isToday(selectedDate) ? 'text-indigo-600' : 'text-slate-300 cursor-not-allowed'}`}
                                        aria-label="יום הבא"
                                        disabled={isToday(selectedDate)}
                                    >
                                        <ChevronLeft size={20} weight="duotone" />
                                    </button>
                                </div>

                                {/* Legend - Premium Visuals */}
                                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex flex-wrap gap-6 items-center justify-center text-[13px] font-black text-slate-600">
                                    <div className="flex items-center gap-2 group">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100 transition-transform group-hover:scale-110">
                                            <CheckCircle2 size={18} weight="duotone" />
                                        </div>
                                        <span className="tracking-tight uppercase text-[11px]">תקין / נמצא</span>
                                    </div>
                                    <div className="flex items-center gap-2 group">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-100 transition-transform group-hover:scale-110">
                                            <Hammer size={18} weight="duotone" />
                                        </div>
                                        <span className="tracking-tight uppercase text-[11px]">תקול / לתיקון</span>
                                    </div>
                                    <div className="flex items-center gap-2 group">
                                        <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-100 transition-transform group-hover:scale-110">
                                            <AlertCircle size={18} weight="duotone" />
                                        </div>
                                        <span className="tracking-tight uppercase text-[11px]">חסר / אבד</span>
                                    </div>
                                </div>

                                {/* MOBILE VERIFY VIEW - Card Based (Ergonomic) */}
                                <div className="md:hidden space-y-4">
                                    {displayedEquipment.map(item => {
                                        // Find daily check for this item on selected date
                                        const checkDate = selectedDate.toISOString().split('T')[0];
                                        const dailyCheck = equipmentDailyChecks.find(
                                            c => c.equipment_id === item.id && c.check_date === checkDate
                                        );
                                        const isVerifiedOnSelectedDate = !!dailyCheck;
                                        const displayStatus = dailyCheck?.status || 'unverified';

                                        return (
                                            <div key={item.id} className="bg-white border border-slate-100 shadow-sm rounded-3xl p-5 space-y-4 transition-all active:bg-slate-50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex flex-col">
                                                        <span className="text-lg font-black text-slate-900 leading-tight">{item.serial_number}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.type}</span>
                                                    </div>
                                                    {!isVerifiedOnSelectedDate && (
                                                        <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-xl text-[10px] font-black border border-rose-100 shadow-sm animate-pulse-subtle">
                                                            חסר דיווח
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Action Row - Mobile Optimized Touch Targets */}
                                                <div className="grid grid-cols-3 gap-3">
                                                    <button
                                                        onClick={() => !isViewer && handleVerify(item.id, 'present')}
                                                        className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-2 ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'present'
                                                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
                                                            : 'bg-white border-slate-100 text-slate-300'
                                                            }`}
                                                    >
                                                        <CheckCircle2 size={24} weight={displayStatus === 'present' ? 'bold' : 'duotone'} />
                                                    </button>
                                                    <button
                                                        onClick={() => !isViewer && handleVerify(item.id, 'damaged')}
                                                        className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-2 ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'damaged'
                                                            ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                                                            : 'bg-white border-slate-100 text-slate-300'
                                                            }`}
                                                    >
                                                        <Hammer size={24} weight={displayStatus === 'damaged' ? 'bold' : 'duotone'} />
                                                    </button>
                                                    <button
                                                        onClick={() => !isViewer && handleVerify(item.id, 'missing')}
                                                        className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-2 ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'missing'
                                                            ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200'
                                                            : 'bg-white border-slate-100 text-slate-300'
                                                            }`}
                                                    >
                                                        <AlertCircle size={24} weight={displayStatus === 'missing' ? 'bold' : 'duotone'} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* DESKTOP VERIFY VIEW - Styled Table */}
                                <div className="hidden md:block overflow-x-auto shadow-sm rounded-2xl bg-white border border-white">
                                    <table className="w-full text-right" dir="rtl">
                                        <thead>
                                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">פריט / צלם</th>
                                                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-left">סטטוס בדיקה (דיווח יומי)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {displayedEquipment.map(item => {
                                                // Find daily check for this item on selected date
                                                const checkDate = selectedDate.toISOString().split('T')[0];
                                                const dailyCheck = equipmentDailyChecks.find(
                                                    c => c.equipment_id === item.id && c.check_date === checkDate
                                                );
                                                const isVerifiedOnSelectedDate = !!dailyCheck;
                                                const displayStatus = dailyCheck?.status || 'unverified';

                                                return (
                                                    <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                        <td className="px-6 py-5">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                                    <QrCode size={20} weight="duotone" />
                                                                </div>
                                                                <div className="flex flex-col">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-black text-slate-800 tracking-tight">{item.serial_number}</span>
                                                                        {!isVerifiedOnSelectedDate && (
                                                                            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm shadow-rose-200" title="טרם דווח" />
                                                                        )}
                                                                    </div>
                                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.type}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-5">
                                                            <div className="flex gap-2 justify-end">
                                                                <button
                                                                    onClick={() => !isViewer && handleVerify(item.id, 'present')}
                                                                    disabled={!canVerifyItem(item)}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'present'
                                                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100 ring-4 ring-emerald-50'
                                                                        : 'bg-slate-50/80 text-slate-300 hover:bg-emerald-50 hover:text-emerald-500'
                                                                        }`}
                                                                >
                                                                    <CheckCircle2 size={20} weight="duotone" />
                                                                </button>
                                                                <button
                                                                    onClick={() => !isViewer && handleVerify(item.id, 'damaged')}
                                                                    disabled={!canVerifyItem(item)}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'damaged'
                                                                        ? 'bg-amber-500 text-white shadow-md shadow-amber-100 ring-4 ring-amber-50'
                                                                        : 'bg-slate-50/80 text-slate-300 hover:bg-amber-50 hover:text-amber-500'
                                                                        }`}
                                                                >
                                                                    <Hammer size={20} weight="duotone" />
                                                                </button>
                                                                <button
                                                                    onClick={() => !isViewer && handleVerify(item.id, 'missing')}
                                                                    disabled={!canVerifyItem(item)}
                                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'missing'
                                                                        ? 'bg-rose-500 text-white shadow-md shadow-rose-100 ring-4 ring-rose-50'
                                                                        : 'bg-slate-50/80 text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                                                                        }`}
                                                                >
                                                                    <AlertCircle size={20} weight="duotone" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {viewMode === 'list' && filteredItems.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200 shadow-sm mx-4 animate-in fade-in zoom-in duration-500">
                                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                                    <Package size={40} className="text-slate-300" weight="duotone" />
                                </div>
                                <p className="text-xl font-black text-slate-900 tracking-tight">
                                    {searchTerm || filterType !== 'all' || filterStatus !== 'all' ? 'לא נמצאו פריטים תואמים' : 'רשימת הציוד ריקה'}
                                </p>
                                <p className="text-sm font-bold text-slate-400 mt-1">
                                    {searchTerm || filterType !== 'all' || filterStatus !== 'all' ? 'נסה לשנות את הפילטרים או מונחי החיפוש' : 'לחץ על ה- FAB כדי להוסיף את האמצעי הראשון'}
                                </p>
                                {!isViewer && !searchTerm && filterType === 'all' && filterStatus === 'all' && (
                                    <button
                                        onClick={() => { setEditingItem({}); setIsAddEditModalOpen(true); }}
                                        className="mt-8 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-indigo-100 active:scale-95 transition-all flex items-center gap-2"
                                    >
                                        <Plus size={20} weight="bold" />
                                        <span>הוסף פריט ראשון</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Floating Action Button (FAB) - Standard Yellow Bottom FAB */}
                <FloatingActionButton
                    icon={Plus}
                    onClick={() => { setEditingItem({}); setIsAddEditModalOpen(true); }}
                    ariaLabel="הוסף פריט חדש"
                    show={!isViewer}
                />

                {/* Add/Edit Modal (S for Mobile Ergonomics) */}
                <GenericModal
                    isOpen={isAddEditModalOpen}
                    onClose={() => setIsAddEditModalOpen(false)}
                    title={editingItem?.id ? 'עריכת פריט ציוד' : 'הוספת פריט חדש'}
                    size="lg"
                    footer={(
                        <div className="flex w-full items-center gap-4">
                            <Button variant="outline" onClick={() => setIsAddEditModalOpen(false)} className="flex-1">ביטול</Button>
                            <Button onClick={handleSaveItem} className="flex-[2] font-black">שמור פריט</Button>
                        </div>
                    )}
                >
                    <div className="space-y-6 text-right pb-4">
                        {/* Header Accents in Sheet */}
                        {!editingItem?.id && (
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                                <Info size={20} className="text-indigo-600 shrink-0 mt-0.5" weight="duotone" />
                                <div>
                                    <h4 className="text-sm font-black text-indigo-900">רישום אמצעי חדש</h4>
                                    <p className="text-[11px] font-bold text-indigo-700/70 leading-relaxed">הזן את פרטי האמצעי (נשק, אופטיקה וכו') ואת מספר הצלם הייחודי שלו.</p>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2 text-right">
                                <label className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest flex items-center justify-start gap-2">
                                    <Tag size={14} className="text-indigo-500" weight="duotone" />
                                    סוג פריט
                                </label>
                                <Input
                                    placeholder="נשק, כוונת, משקפת..."
                                    value={editingItem?.type || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                                    className="h-12 text-base font-bold bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/10"
                                />
                            </div>
                            <div className="space-y-2 text-right">
                                <label className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest flex items-center justify-start gap-2">
                                    <QrCode size={14} className="text-indigo-500" weight="duotone" />
                                    מספר צלם / סידורי
                                </label>
                                <Input
                                    placeholder="הזן מספר הנדסי/צלם"
                                    value={editingItem?.serial_number || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, serial_number: e.target.value })}
                                    className="h-12 text-base font-bold bg-white border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-500/10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2 text-right">
                            <label className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest flex items-center justify-start gap-2">
                                <Users size={14} className="text-indigo-500" weight="duotone" />
                                שיוך / חתימה (למי משויך?)
                            </label>
                            <div className="bg-white border border-slate-200 rounded-[1.5rem] shadow-sm overflow-hidden p-1">
                                <PersonSearchSelect
                                    people={people}
                                    teams={teams}
                                    value={editingItem?.assigned_to_id || null}
                                    onChange={(val) => setEditingItem({
                                        ...editingItem,
                                        assigned_to_id: val,
                                        signed_at: val ? new Date().toISOString() : null
                                    })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2 text-right">
                            <label className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest flex items-center justify-start gap-2">
                                <History size={14} className="text-indigo-500" weight="duotone" />
                                הערות ותקינות
                            </label>
                            <textarea
                                className="w-full h-32 p-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-base font-medium shadow-sm resize-none text-right placeholder:text-slate-300"
                                placeholder="מצב הציוד, פגיעות, חוסרים או הערות חשובות..."
                                value={editingItem?.notes || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                            />
                        </div>

                        {editingItem?.id && (
                            <div className="pt-4 border-t border-slate-100">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
                                            onDeleteEquipment(editingItem.id!);
                                            setIsAddEditModalOpen(false);
                                            showToast('הפריט נמחק', 'info');
                                        }
                                    }}
                                    className="w-full h-12 text-rose-600 border-rose-100 hover:bg-rose-50 rounded-2xl font-black flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={18} weight="duotone" />
                                    מחק פריט מהמערכת
                                </Button>
                            </div>
                        )}
                    </div>
                </GenericModal>

                {/* Mobile Type Filter - Transform to Sheet-like behavior or clean Modal */}
                <GenericModal
                    isOpen={showMobileTypeFilter}
                    onClose={() => setShowMobileTypeFilter(false)}
                    title="סינון לפי סוג ציוד"
                    size="full"
                >
                    <div className="grid grid-cols-2 gap-3 p-1">
                        <button
                            onClick={() => { setFilterType('all'); setShowMobileTypeFilter(false); }}
                            className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${filterType === 'all'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                : 'bg-white border-slate-100 text-slate-600 shadow-sm'
                                }`}
                        >
                            <span className="font-black text-sm uppercase tracking-widest">הצג הכל</span>
                        </button>
                        {equipmentTypes.map(type => (
                            <button
                                key={type}
                                onClick={() => { setFilterType(type); setShowMobileTypeFilter(false); }}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${filterType === type
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                    : 'bg-white border-slate-100 text-slate-600 shadow-sm'
                                    }`}
                            >
                                <span className="font-black text-sm text-center truncate w-full">{type}</span>
                            </button>
                        ))}
                    </div>
                </GenericModal>

                {/* Mobile Status Filter */}
                <GenericModal
                    isOpen={showMobileStatusFilter}
                    onClose={() => setShowMobileStatusFilter(false)}
                    title="סינון לפי סטטוס"
                    size="full"
                >
                    <div className="space-y-3 p-1">
                        <button
                            onClick={() => { setFilterStatus('all'); setShowMobileStatusFilter(false); }}
                            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-[0.98] ${filterStatus === 'all'
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg'
                                : 'bg-white border-slate-100 text-slate-600 shadow-sm'
                                }`}
                        >
                            <span className="font-black text-sm uppercase tracking-widest">כל הסטטוסים</span>
                            {filterStatus === 'all' && <Check size={18} weight="bold" />}
                        </button>
                        {[
                            { value: 'present', label: 'נמצא', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
                            { value: 'missing', label: 'חסר', color: 'bg-rose-50 text-rose-600 border-rose-100' },
                            { value: 'damaged', label: 'תקול', color: 'bg-amber-50 text-amber-600 border-amber-100' },
                            { value: 'lost', label: 'אבד', color: 'bg-slate-100 text-slate-600 border-slate-200' }
                        ].map(status => (
                            <button
                                key={status.value}
                                onClick={() => { setFilterStatus(status.value); setShowMobileStatusFilter(false); }}
                                className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all active:scale-[0.98] ${filterStatus === status.value
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                    : 'bg-white border-slate-100 text-slate-600 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className={`px-3 py-1 rounded-xl text-xs font-black border ${status.color}`}>
                                        {status.label}
                                    </span>
                                </div>
                                {filterStatus === status.value && <Check size={18} weight="bold" />}
                            </button>
                        ))}
                    </div>
                </GenericModal>
            </div>
        </div>
    );
};

export default EquipmentManager;