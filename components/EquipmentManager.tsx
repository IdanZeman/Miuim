import React, { useState, useMemo } from 'react';
import { Person, Equipment, EquipmentStatus, EquipmentVerification, Team } from '../types';
import { Package, Search, Plus, User, Calendar, CheckCircle2, AlertCircle, History, QrCode, ClipboardCheck, Trash2, Edit3, Filter, ShieldCheck, Tag, ChevronRight, Users, UserPlus } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../services/supabaseClient';

interface EquipmentManagerProps {
    people: Person[];
    teams: Team[];
    equipment: Equipment[];
    onUpdateEquipment: (e: Equipment) => void;
    onAddEquipment: (e: Equipment) => void;
    onDeleteEquipment: (id: string) => void;
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
                <select
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                >
                    <option value="all">כל הצוותים</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
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
    onDeleteEquipment
}) => {
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'list' | 'verify' | 'history'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

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
                organization_id: '', // Handled by App.tsx
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

        const now = new Date().toISOString();
        const updated: Equipment = {
            ...item,
            status,
            last_verified_at: now
        };
        onUpdateEquipment(updated);
        showToast(`וידוא בוצע בהצלחה עבור ${item.serial_number}`, 'success');
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-right" dir="rtl">
            {/* Header Card */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 shadow-sm">
                            <Package size={28} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">דוח צלם / ניהול אמצעים</h2>
                            <p className="text-sm text-slate-500 font-medium">מעקב אחר ציוד, חתימות וביקורות</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                רשימת ציוד
                            </button>
                            <button
                                onClick={() => setViewMode('verify')}
                                className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'verify' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                ביקורת יומית
                            </button>
                        </div>
                        <button
                            onClick={() => { setEditingItem({}); setIsAddEditModalOpen(true); }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
                        >
                            <Plus size={18} />
                            <span>הוסף פריט</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="חיפוש צלם, סוג, לוחם או צוות..."
                            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm font-medium"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Select
                        value={filterType}
                        onChange={setFilterType}
                        options={[{ value: 'all', label: 'כל הסוגים' }, ...equipmentTypes.map(t => ({ value: t, label: t }))]}
                    />
                    <Select
                        value={filterStatus}
                        onChange={setFilterStatus}
                        options={[
                            { value: 'all', label: 'כל הסטטוסים' },
                            { value: 'present', label: 'נמצא' },
                            { value: 'missing', label: 'חסר' },
                            { value: 'damaged', label: 'תקול' },
                            { value: 'lost', label: 'אבד' }
                        ]}
                    />
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold text-slate-600">
                        <Tag size={16} className="text-indigo-500" />
                        <span>סה"כ: {filteredItems.length} פריטים</span>
                    </div>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredItems.map(item => {
                        const assignedPerson = people.find(p => p.id === item.assigned_to_id);
                        const team = assignedPerson ? teams.find(t => t.id === assignedPerson.teamId) : null;

                        return (
                            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all overflow-hidden group">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                <QrCode size={20} />
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <h4 className="font-black text-slate-800">{item.serial_number}</h4>
                                                <p className="text-xs text-slate-500 font-bold">{item.type}</p>
                                            </div>
                                        </div>
                                        <div className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${getStatusColor(item.status)}`}>
                                            {getStatusLabel(item.status)}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-slate-400" />
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[10px] font-bold text-slate-400">חתום ע"י:</span>
                                                    <span className="text-sm font-black text-slate-700">
                                                        {assignedPerson?.name || <span className="text-slate-400 italic font-medium">לא חתום</span>}
                                                    </span>
                                                </div>
                                            </div>
                                            {team && (
                                                <div className="px-2 py-1 bg-white border border-slate-100 rounded-lg shadow-sm text-[10px] font-black text-slate-500">
                                                    {team.name}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] px-1">
                                            <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                                                <Calendar size={12} />
                                                <span>וידוא אחרון:</span>
                                            </div>
                                            <span className="text-slate-600 font-bold">
                                                {item.last_verified_at ? new Date(item.last_verified_at).toLocaleDateString('he-IL') : 'מעולם לא'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end gap-2 text-left">
                                        <button
                                            onClick={() => onDeleteEquipment(item.id)}
                                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="מחק"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => { setEditingItem(item); setIsAddEditModalOpen(true); }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                            title="ערוך"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
                            <Package size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-bold">לא נמצא ציוד התואם לחיפוש</p>
                        </div>
                    )}
                </div>
            )}

            {/* Verification View */}
            {viewMode === 'verify' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 bg-slate-50/50 border-b border-slate-200">
                        <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <ClipboardCheck className="text-indigo-600" size={22} />
                            ביקורת צלמים יומית
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 font-bold italic">* סמנו את הסטטוס העדכני לכל פריט</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead>
                                <tr className="bg-white border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">צלם / מס"צ</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">סוג</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">חתום ע"י</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-left">עדכון סטטוס</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {equipment.map(item => {
                                    const assignedPerson = people.find(p => p.id === item.assigned_to_id);
                                    const team = assignedPerson ? teams.find(t => t.id === assignedPerson.teamId) : null;
                                    const isVerifiedToday = item.last_verified_at && new Date(item.last_verified_at).toDateString() === new Date().toDateString();

                                    return (
                                        <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${isVerifiedToday ? 'bg-emerald-50/30' : ''}`}>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-black text-slate-700">{item.serial_number}</span>
                                                    {isVerifiedToday && <ShieldCheck size={16} className="text-emerald-500" />}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-slate-500 text-right">{item.type}</td>
                                            <td className="px-6 py-4 text-sm font-black text-slate-700 text-right">
                                                <div className="flex items-center gap-2">
                                                    <span>{assignedPerson?.name || '-'}</span>
                                                    {team && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-bold">{team.name}</span>}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-left">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleVerify(item.id, 'present')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${item.status === 'present' && isVerifiedToday ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}
                                                    >
                                                        נמצא
                                                    </button>
                                                    <button
                                                        onClick={() => handleVerify(item.id, 'missing')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${item.status === 'missing' && isVerifiedToday ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'}`}
                                                    >
                                                        חסר
                                                    </button>
                                                    <button
                                                        onClick={() => handleVerify(item.id, 'damaged')}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${item.status === 'damaged' && isVerifiedToday ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50'}`}
                                                    >
                                                        תקול
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
            <Modal
                isOpen={isAddEditModalOpen}
                onClose={() => setIsAddEditModalOpen(false)}
                title={editingItem?.id ? 'עריכת פריט' : 'הוספת פריט חדש'}
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <button onClick={() => setIsAddEditModalOpen(false)} className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-colors">ביטול</button>
                        <button onClick={handleSaveItem} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95">שמור פריט</button>
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
        </div>
    );
};
