import React, { useState, useMemo } from 'react';
import { Person, Equipment, EquipmentStatus, Team } from '@/types';
import { Package, Search, Plus, User, CheckCircle2, AlertCircle, History, QrCode, ClipboardCheck, Trash2, Edit3, Filter, Tag, ChevronRight, Users, ChevronLeft, Calendar as CalendarIcon, Hammer, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PageInfo } from '@/components/ui/PageInfo';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/contexts/ToastContext';

interface EquipmentManagerProps {
    people: Person[];
    teams: Team[];
    equipment: Equipment[];
    onUpdateEquipment: (e: Equipment) => void;
    onAddEquipment: (e: Equipment) => void;
    onDeleteEquipment: (id: string) => void;
    isViewer?: boolean;
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
        <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="חפש חייל לפי שם..."
                        className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-48">
                    <Select
                        value={selectedTeamId}
                        onChange={(val) => setSelectedTeamId(val)}
                        options={[{ value: 'all', label: 'כל הצוותים' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                        placeholder="סינון צוות"
                        className="bg-slate-50 border-slate-200 rounded-xl px-3 py-2 text-sm h-full"
                    />
                </div>
            </div>

            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50 custom-scrollbar bg-slate-50/30">
                <button
                    onClick={() => onChange(null)}
                    className={`w-full text-right px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${value === null ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-white text-slate-500'}`}
                >
                    <span>ללא חתימה</span>
                    {value === null && <CheckCircle2 size={14} />}
                </button>
                {filteredPeople.map(p => {
                    const team = teams.find(t => t.id === p.teamId);
                    return (
                        <button
                            key={p.id}
                            onClick={() => onChange(p.id)}
                            className={`w-full text-right px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${value === p.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-white text-slate-700'}`}
                        >
                            <div className="flex flex-col text-right">
                                <span>{p.name}</span>
                                {team && <span className="text-[10px] text-slate-400 font-medium">{team.name}</span>}
                            </div>
                            {value === p.id && <CheckCircle2 size={14} />}
                        </button>
                    );
                })}
                {filteredPeople.length === 0 && (
                    <div className="p-4 text-center text-slate-400 text-xs italic">לא נמצאו תוצאות</div>
                )}
            </div>
            {selectedPerson && (
                <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg border border-indigo-100 animate-in slide-in-from-top-1">
                    <User size={14} className="text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700">נבחר: {selectedPerson.name}</span>
                </div>
            )}
        </div>
    );
};

export const EquipmentManager: React.FC<EquipmentManagerProps> = ({
    people,
    teams,
    equipment,
    onUpdateEquipment,
    onAddEquipment,
    onDeleteEquipment,
    isViewer = false
}) => {
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'list' | 'verify'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [showMobileTypeFilter, setShowMobileTypeFilter] = useState(false);
    const [showMobileStatusFilter, setShowMobileStatusFilter] = useState(false);

    // Date Navigation State
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Modal State
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<Equipment> | null>(null);

    // Derived Data
    const filteredItems = useMemo(() => {
        return equipment.filter(item => {
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
    }, [equipment, searchTerm, filterType, filterStatus, people, teams]);

    const equipmentTypes = Array.from(new Set(equipment.map(e => e.type)));

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

    const handleVerify = async (itemId: string, status: EquipmentStatus) => {
        const item = equipment.find(e => e.id === itemId);
        if (!item) return;

        // Create timestamp based on selected date + current time
        const timestamp = new Date(selectedDate);
        const now = new Date();
        timestamp.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

        const updated: Equipment = {
            ...item,
            status,
            last_verified_at: timestamp.toISOString()
        };

        onUpdateEquipment(updated);
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

    // Stats calculation
    const stats = useMemo(() => ({
        total: equipment.length,
        faulty: equipment.filter(e => e.status === 'damaged').length,
        missing: equipment.filter(e => e.status === 'missing' || e.status === 'lost').length,
        checkedOut: equipment.filter(e => e.assigned_to_id).length
    }), [equipment]);

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

    return (
        <div className="min-h-screen text-right font-sans pb-32" dir="rtl">
            {/* Tabs - Solid and Visible */}
            <div className="mb-4 px-1 md:hidden">
                <div
                    className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl flex shadow-sm border border-white/20"
                    role="tablist"
                    aria-label="תצוגות ניהול ציוד"
                >
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'list'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-white/50'
                            }`}
                        role="tab"
                        aria-selected={viewMode === 'list'}
                        aria-controls="equipment-content"
                    >
                        <span>רשימת ציוד</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${viewMode === 'list' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                            {equipment.length}
                        </span>
                    </button>
                    <button
                        onClick={() => setViewMode('verify')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${viewMode === 'verify'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-600 hover:bg-white/50'
                            }`}
                        role="tab"
                        aria-selected={viewMode === 'verify'}
                        aria-controls="equipment-content"
                    >
                        <span>בדיקה יומית</span>
                        <ClipboardCheck size={16} aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Content Sheet (Responsive) */}
            <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 px-4 py-6 min-h-[70vh] md:mt-6">


                {/* Header Section */}
                <div className="mb-6 flex items-center gap-2 border-b border-slate-100 pb-4">
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-indigo-600" size={28} />
                        ניהול ושו"ב אמצעים
                        <PageInfo
                            title="ניהול ושו&quot;ב אמצעים"
                            description={
                                <>
                                    <p className="mb-2">מערכת למעקב וניהול הציוד היחידתי (נשק, אופטיקה, קשר וכו').</p>
                                    <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                        <li><b>מעקב חתימות:</b> מי חתום על איזה ציוד כרגע.</li>
                                        <li><b>סטטוס תקינות:</b> דיווח ומעקב אחר ציוד תקול, חסר או בתיקון.</li>
                                        <li><b>בדיקה יומית:</b> (בלשונית 'בדיקה יומית') ביצוע ספירת מלאי יומית ואימות הימצאות הציוד.</li>
                                    </ul>
                                    <p className="text-sm bg-indigo-50 p-2 rounded text-indigo-800">
                                        ניהול נכון כאן מונע אובדן ציוד ומבטיח כשירות מבצעית.
                                    </p>
                                </>
                            }
                        />
                    </h2>
                </div>

                {/* DESKTOP: Stats Strip */}
                <div className="hidden md:flex items-center gap-6 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Package size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-bold">סה"כ פריטים</p>
                            <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                            <AlertCircle size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-bold">ציוד תקול</p>
                            <p className="text-2xl font-black text-slate-800">{stats.faulty}</p>
                        </div>
                    </div>
                    <div className="w-px h-10 bg-slate-200" />
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                            <History size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 font-bold">חסרים / אבודים</p>
                            <p className="text-2xl font-black text-slate-800">{stats.missing}</p>
                        </div>
                    </div>
                    <div className="mr-auto">
                        {!isViewer && (
                            <button
                                onClick={() => { setEditingItem({}); setIsAddEditModalOpen(true); }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                            >
                                <Plus size={20} />
                                <span>הוסף פריט חדש</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* MOBILE Controls (Only for List View) */}
                {viewMode === 'list' && (
                    <div className="md:hidden flex items-center gap-2 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="חיפוש..."
                                className="w-full pr-10 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-[42px] shrink-0">
                            <button
                                className={`w-[42px] h-[42px] flex items-center justify-center rounded-xl border transition-colors ${filterType !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                onClick={() => setShowMobileTypeFilter(true)}
                            >
                                <Tag size={18} />
                            </button>
                        </div>
                        <div className="w-[42px] shrink-0">
                            <button
                                className={`w-[42px] h-[42px] flex items-center justify-center rounded-xl border transition-colors ${filterStatus !== 'all' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                                onClick={() => setShowMobileStatusFilter(true)}
                            >
                                <Filter size={18} />
                            </button>
                        </div>
                        {(filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
                            <button
                                onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
                                className="w-[42px] h-[42px] flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                )}

                {/* DESKTOP Controls (Only for List View) */}
                {viewMode === 'list' && (
                    <div className="hidden md:flex items-center gap-4 mb-6">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="חיפוש לפי צלם, שם חייל, או סוג..."
                                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm font-medium"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="w-48">
                            <Select
                                value={filterType}
                                onChange={setFilterType}
                                options={[{ value: 'all', label: 'סינון לפי סוג: הכל' }, ...equipmentTypes.map(t => ({ value: t, label: t }))]}
                                triggerMode="default"
                                className="bg-slate-50 border-slate-200 py-2.5"
                            />
                        </div>
                        <div className="w-48">
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
                                triggerMode="default"
                                className="bg-slate-50 border-slate-200 py-2.5"
                            />
                        </div>
                        {(filterType !== 'all' || filterStatus !== 'all' || searchTerm) && (
                            <button
                                onClick={() => { setFilterType('all'); setFilterStatus('all'); setSearchTerm(''); }}
                                className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                )}

                {/* Content Area */}
                <div className="space-y-2">

                    {/* MOBILE LIST VIEW */}
                    <div className="md:hidden space-y-2">
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
                                    className={`w-full flex items-center justify-between p-3.5 bg-white border-b border-slate-50 transition-colors last:border-0 text-right group ${!isViewer ? 'hover:bg-slate-50' : ''}`}
                                >
                                    {/* Left Info */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                            <Package size={20} />
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-slate-800">{item.serial_number}</span>
                                                <span className="text-[10px] px-1.5 rounded bg-slate-100 text-slate-500 font-bold">{item.type}</span>
                                            </div>
                                            <div className="flex items-center gap-1 mt-0.5">
                                                {assignedPerson ? (
                                                    <>
                                                        <User size={10} className="text-slate-400" />
                                                        <span className="text-xs font-medium text-slate-600">{assignedPerson.name}</span>
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">לא חתום</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Info / Status */}
                                    <div className="flex items-center gap-3">
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${getStatusColor(item.status)}`}>
                                            {getStatusLabel(item.status)}
                                        </div>
                                        {!isViewer && <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-400" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* DESKTOP TABLE VIEW */}
                    {viewMode === 'list' && (
                        <div className="hidden md:block overflow-hidden rounded-xl border border-slate-200">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">פריט / מספר סידורי</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">סוג</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">מיקום / חייל אחראי</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">סטטוס</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">בדיקה אחרונה</th>
                                        <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {filteredItems.map(item => {
                                        const assignedPerson = people.find(p => p.id === item.assigned_to_id);
                                        const team = assignedPerson ? teams.find(t => t.id === assignedPerson.teamId) : null;

                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                                            <Package size={18} />
                                                        </div>
                                                        <span className="font-bold text-slate-800">{item.serial_number}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-sm font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md">{item.type}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {assignedPerson ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-bold text-slate-700">{assignedPerson.name}</span>
                                                            {team && <span className="text-xs text-slate-400">{team.name}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-sm text-slate-400 italic">לא משויך</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(item.status)}`}>
                                                        {getStatusLabel(item.status)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-500 font-medium">
                                                    {item.last_verified_at ? new Date(item.last_verified_at).toLocaleDateString('he-IL') : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {!isViewer && (
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => { setEditingItem(item); setIsAddEditModalOpen(true); }}
                                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                                title="ערוך"
                                                            >
                                                                <Edit3 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => onDeleteEquipment(item.id)}
                                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                title="מחק"
                                                            >
                                                                <Trash2 size={16} />
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
                                    <ChevronRight size={20} />
                                </button>

                                <div className="flex items-center gap-2">
                                    <CalendarIcon size={16} className="text-slate-500" aria-hidden="true" />
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
                                    <ChevronLeft size={20} />
                                </button>
                            </div>

                            {/* Legend - Clean & Explicit */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap gap-4 items-center justify-center text-xs text-slate-600">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                                        <CheckCircle2 size={14} />
                                    </div>
                                    <span className="font-bold">תקין/נמצא</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm">
                                        <Hammer size={14} />
                                    </div>
                                    <span className="font-bold">תקול/דורש תיקון</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-lg bg-rose-500 text-white flex items-center justify-center shadow-sm">
                                        <AlertCircle size={14} />
                                    </div>
                                    <span className="font-bold">חסר/אבד</span>
                                </div>
                            </div>

                            <div className="overflow-x-auto -mx-2 px-2 md:mx-0 md:px-0">
                                <table className="w-full text-right bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-xs font-black text-slate-500">פריט</th>
                                            <th className="px-4 py-3 text-xs font-black text-slate-500">סטטוס בדיקה ליום זה</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {equipment.map(item => {
                                            // Check if the verification date matches the selected date
                                            const isVerifiedOnSelectedDate = item.last_verified_at &&
                                                new Date(item.last_verified_at).toDateString() === selectedDate.toDateString();

                                            // If not verified on this specific date, show as "Not Verified" (Gray)
                                            // regardless of its current global status
                                            const displayStatus = isVerifiedOnSelectedDate ? item.status : 'unverified';

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                                                            <span className="font-bold text-slate-800 text-sm md:text-base">{item.serial_number}</span>
                                                            <span className="text-[10px] text-slate-500 md:text-sm md:bg-slate-100 md:px-2 md:py-0.5 md:rounded w-fit">{item.type}</span>

                                                            {!isVerifiedOnSelectedDate && (
                                                                <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-100 w-fit mt-1 md:mt-0">
                                                                    חסר דיווח ליום זה
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex gap-2 justify-end">

                                                            <button
                                                                onClick={() => !isViewer && handleVerify(item.id, 'present')}
                                                                disabled={isViewer}
                                                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${displayStatus === 'present'
                                                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200 ring-2 ring-emerald-100'
                                                                    : 'bg-slate-50 text-slate-300 hover:bg-emerald-50 hover:text-emerald-500'
                                                                    } ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                title="תקין / נמצא"
                                                                aria-label={`סמן את ${item.serial_number} כתקין`}
                                                                aria-pressed={displayStatus === 'present'}
                                                            >
                                                                <CheckCircle2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => !isViewer && handleVerify(item.id, 'damaged')}
                                                                disabled={isViewer}
                                                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${displayStatus === 'damaged'
                                                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200 ring-2 ring-amber-100'
                                                                    : 'bg-slate-50 text-slate-300 hover:bg-amber-50 hover:text-amber-500'
                                                                    } ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                title="תקול / דורש תיקון"
                                                                aria-label={`סמן את ${item.serial_number} כתקול`}
                                                                aria-pressed={displayStatus === 'damaged'}
                                                            >
                                                                <Hammer size={18} />
                                                            </button>
                                                            <button
                                                                onClick={() => !isViewer && handleVerify(item.id, 'missing')}
                                                                disabled={isViewer}
                                                                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${displayStatus === 'missing'
                                                                    ? 'bg-rose-500 text-white shadow-md shadow-rose-200 ring-2 ring-rose-100'
                                                                    : 'bg-slate-50 text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                                                                    } ${isViewer ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                title="חסר / אבד"
                                                                aria-label={`סמן את ${item.serial_number} כחסר`}
                                                                aria-pressed={displayStatus === 'missing'}
                                                            >
                                                                <AlertCircle size={18} />
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
                        <div className="text-center py-12 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                            <Package size={48} className="mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-700">לא נמצאו פריטים</h3>
                            <p className="text-slate-400 mb-6">נסה לשנות את הפילטרים או הוסף פריט חדש</p>
                            {!isViewer && (
                                <button
                                    onClick={() => { setEditingItem({}); setIsAddEditModalOpen(true); }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold shadow-sm transition-all"
                                >
                                    צור פריט ראשון
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Floating Action Button (FAB) - Mobile Only */}
            {!isViewer && (
                <button
                    onClick={() => { setEditingItem({}); setIsAddEditModalOpen(true); }}
                    className="md:hidden fixed bottom-24 left-6 z-50 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-600/30 flex items-center justify-center hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
                    aria-label="הוסף פריט חדש"
                >
                    <Plus size={28} />
                </button>
            )}

            {/* Add/Edit Modal (Existing) */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Package size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">{editingItem?.id ? 'עריכת פריט' : 'הוספת פריט חדש'}</h2>
                            <p className="text-sm font-bold text-slate-400">{editingItem?.id ? 'עדכון פרטי ציוד קיים' : 'רישום ציוד חדש למערכת'}</p>
                        </div>
                    </div>
                }
                footer={
                    <div className="flex justify-between items-center w-full gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setIsAddEditModalOpen(false)}
                            className="font-bold text-slate-500 hover:text-slate-700"
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={handleSaveItem}
                            icon={Check}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg shadow-indigo-200 px-8"
                        >
                            שמור פריט
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6 text-right">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5 text-right">
                            <label className="text-xs font-black text-slate-500 px-1 uppercase tracking-wider flex items-center justify-start gap-2">
                                <Tag size={14} className="text-indigo-500" />
                                סוג פריט
                            </label>
                            <Input
                                placeholder="נשק, כוונת, אמצעי לילה..."
                                value={editingItem?.type || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, type: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5 text-right">
                            <label className="text-xs font-black text-slate-500 px-1 uppercase tracking-wider flex items-center justify-start gap-2">
                                <QrCode size={14} className="text-indigo-500" />
                                מספר צלם / סידורי
                            </label>
                            <Input
                                placeholder="הזן מספר ייחודי"
                                value={editingItem?.serial_number || ''}
                                onChange={(e) => setEditingItem({ ...editingItem, serial_number: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2 text-right">
                        <label className="text-xs font-black text-slate-500 px-1 uppercase tracking-wider flex items-center justify-start gap-2">
                            <Users size={14} className="text-indigo-500" />
                            שיוך לחייל (חתימה)
                        </label>
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

                    <div className="space-y-1.5 text-right">
                        <label className="text-xs font-black text-slate-500 px-1 uppercase tracking-wider flex items-center justify-start gap-2">
                            <History size={14} className="text-indigo-500" />
                            הערות נוספות
                        </label>
                        <textarea
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium resize-none h-24 text-right"
                            placeholder="מצב הציוד, חסרים, שברים וכו'..."
                            value={editingItem?.notes || ''}
                            onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                        />
                    </div>
                </div>
            </Modal>

            {/* Mobile Type Filter Modal */}
            <Modal
                isOpen={showMobileTypeFilter}
                onClose={() => setShowMobileTypeFilter(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Tag size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800">סינון לפי סוג</h3>
                            <p className="text-sm font-bold text-slate-400">הצג פריטים מסוג מסוים בלבד</p>
                        </div>
                    </div>
                }
                footer={
                    <div className="w-full">
                        <Button variant="ghost" className="w-full font-bold text-slate-500" onClick={() => setShowMobileTypeFilter(false)}>סגור</Button>
                    </div>
                }
                className="md:hidden"
            >
                <div className="grid grid-cols-2 gap-3 p-1">
                    <button
                        onClick={() => { setFilterType('all'); setShowMobileTypeFilter(false); }}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${filterType === 'all'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <span className="font-black">הכל</span>
                    </button>
                    {equipmentTypes.map(type => (
                        <button
                            key={type}
                            onClick={() => { setFilterType(type); setShowMobileTypeFilter(false); }}
                            className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${filterType === type
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <span className="font-bold text-sm text-center">{type}</span>
                        </button>
                    ))}
                </div>
            </Modal>

            {/* Mobile Status Filter Modal */}
            <Modal
                isOpen={showMobileStatusFilter}
                onClose={() => setShowMobileStatusFilter(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Filter size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800">סינון לפי סטטוס</h3>
                            <p className="text-sm font-bold text-slate-400">סינון לפי מצב הציוד</p>
                        </div>
                    </div>
                }
                footer={
                    <div className="w-full">
                        <Button variant="ghost" className="w-full font-bold text-slate-500" onClick={() => setShowMobileStatusFilter(false)}>סגור</Button>
                    </div>
                }
                className="md:hidden"
            >
                <div className="space-y-2 p-1">
                    <button
                        onClick={() => { setFilterStatus('all'); setShowMobileStatusFilter(false); }}
                        className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${filterStatus === 'all'
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        <span className="font-black">כל הסטטוסים</span>
                        {filterStatus === 'all' && <Check size={16} />}
                    </button>
                    {[
                        { value: 'present', label: 'נמצא', color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
                        { value: 'missing', label: 'חסר', color: 'bg-rose-50 text-rose-600 border-rose-200' },
                        { value: 'damaged', label: 'תקול', color: 'bg-amber-50 text-amber-600 border-amber-200' },
                        { value: 'lost', label: 'אבד', color: 'bg-slate-100 text-slate-600 border-slate-300' }
                    ].map(status => (
                        <button
                            key={status.value}
                            onClick={() => { setFilterStatus(status.value); setShowMobileStatusFilter(false); }}
                            className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${filterStatus === status.value
                                ? 'bg-slate-800 border-slate-800 text-white shadow-md'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${status.color}`}>
                                    {status.label}
                                </span>
                            </div>
                            {filterStatus === status.value && <Check size={16} />}
                        </button>
                    ))}
                </div>
            </Modal>
        </div>
    );
};