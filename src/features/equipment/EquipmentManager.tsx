import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import { Person, Equipment, EquipmentStatus, Team, EquipmentDailyCheck } from '@/types';
import { useTacticalDelete } from '@/hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '@/components/ui/TacticalDeleteWrapper';
import {
    Package,
    MagnifyingGlass as Search,
    Plus,
    User,
    CheckCircle as CheckCircle2,
    CheckCircle,
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
import { ActionBar } from '@/components/ui/ActionBar';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { FloatingActionButton } from '@/components/ui/FloatingActionButton';
import { useToast } from '@/contexts/ToastContext';
import { DatePicker } from '@/components/ui/DatePicker';
import { PersonSearchSelect } from '@/components/ui/PersonSearchSelect';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

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

    // Tactical Delete Hook
    const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
        async (itemId: string) => {
            onDeleteEquipment(itemId);
            // Toast will be shown by App.tsx after successful deletion
        },
        1300
    );

    // Optimistic UI State
    const [optimisticIds, setOptimisticIds] = useState<Record<string, Equipment>>({});
    const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Equipment | null>(null);

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
                organization_id: currentPerson?.organization_id || '',
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

    const handleExport = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('ציוד');

            // Set RTL
            worksheet.views = [{ rightToLeft: true }];

            // Headers
            const headers = viewMode === 'list'
                ? ['מספר צלם', 'סוג', 'שיוך', 'סטטוס', 'הערות']
                : ['מספר צלם', 'סוג', `סטטוס בדיקה (${selectedDate.toLocaleDateString('he-IL')})`];

            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
            headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

            // Data
            const itemsToExport = filteredItems;
            itemsToExport.forEach(item => {
                let row;
                if (viewMode === 'list') {
                    const assignedPerson = people.find(p => p.id === item.assigned_to_id);
                    const person = (assignedPerson && assignedPerson.isActive !== false) ? assignedPerson.name : '-';
                    const statusLabel = getStatusLabel(item.status);
                    row = worksheet.addRow([item.serial_number, item.type, person, statusLabel, item.notes || '']);
                } else {
                    const isVerified = item.last_verified_at && new Date(item.last_verified_at).toDateString() === selectedDate.toDateString();
                    const status = isVerified ? getStatusLabel(item.status) : 'טרם דווח';
                    row = worksheet.addRow([item.serial_number, item.type, status]);
                }

                // Add border to all cells
                row.eachCell(cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            // Adjust column widths
            worksheet.columns = headers.map(h => ({ width: Math.max(15, h.length * 2) }));

            // Generate and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `equipment_export_${new Date().toLocaleDateString('en-CA')}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
            showToast('הקובץ יוצא בהצלחה', 'success');
        } catch (err) {
            console.error('Export failed', err);
            showToast('שגיאה בייצוא קובץ', 'error');
        }
    };

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-hidden" dir="rtl">


            <ActionBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={handleExport}
                isSearchHidden={viewMode !== 'list'}
                variant="unified"
                className="px-4 md:px-6 sticky top-0 z-40 bg-white"
                leftActions={
                    <div className="flex items-center gap-2">
                        <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-lg shadow-indigo-100/50">
                            <Package size={20} weight="bold" />
                        </div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800 flex items-center gap-1.5 min-w-0">
                            <span className="truncate">רשימת ציוד</span>
                            <div className="hidden md:block">
                                <PageInfo
                                    title="ניהול ציוד"
                                    description={
                                        <div className="space-y-4">
                                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex items-start gap-3">
                                                <Package size={20} className="text-indigo-600 shrink-0 mt-0.5" weight="bold" />
                                                <div className="text-sm">
                                                    <h4 className="font-black text-indigo-900 mb-1">ניהול אמצעים ומלאי</h4>
                                                    <p className="text-indigo-700/80 leading-relaxed font-medium">מעקב אחר חתימות ציוד, תקינות, ובדיקות יומיות של אמצעי לחימה ואופטיקה.</p>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-indigo-600">
                                                        <Tag size={18} weight="bold" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700">סיווג לפי סוגי ציוד</span>
                                                </div>
                                                <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-emerald-600">
                                                        <CheckCircle size={18} weight="bold" />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-700">בדיקה יומית ודיווח סטטוס</span>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                />
                            </div>
                        </h2>
                    </div>
                }
                centerActions={
                    <div className="bg-slate-100/80 p-1 rounded-xl flex items-center gap-1">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-black transition-all ${viewMode === 'list'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}
                        >
                            רשימה
                        </button>
                        <button
                            onClick={() => setViewMode('verify')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-black transition-all ${viewMode === 'verify'
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                }`}
                        >
                            בדיקה יומית
                        </button>
                    </div>
                }
                filters={viewMode === 'list' ? [
                    {
                        id: 'type',
                        value: filterType,
                        onChange: setFilterType,
                        options: [{ value: 'all', label: 'כל הסוגים' }, ...equipmentTypes.map(t => ({ value: t, label: t }))],
                        placeholder: 'סינון לפי סוג',
                        icon: Tag
                    },
                    {
                        id: 'status',
                        value: filterStatus,
                        onChange: setFilterStatus,
                        options: [
                            { value: 'all', label: 'כל הסטטוסים' },
                            { value: 'present', label: 'נמצא' },
                            { value: 'missing', label: 'חסר' },
                            { value: 'damaged', label: 'תקול' },
                            { value: 'lost', label: 'אבד' }
                        ],
                        placeholder: 'סינון לפי סטטוס',
                        icon: Filter
                    }
                ] : []}
                rightActions={
                    <>
                        {/* Stats Badge - Desktop Only */}
                        <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 h-9">
                            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stats.total} פריטים</span>
                        </div>
                    </>
                }
            />

            {/* Content Area */}
            <div className="p-4 md:p-6 space-y-2">

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
                                className={`w-full flex items-center justify-between p-4 bg-white border border-slate-200/60 rounded-[1.5rem] shadow-sm active:scale-[0.98] active:bg-slate-50 transition-all text-right group ${!isViewer ? 'hover:bg-slate-50' : ''} ${
                                    isAnimating(item.id) ? 'tactical-delete-animation' : ''
                                }`}
                            >
                                {/* Left Info */}
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 shadow-sm shadow-indigo-100/50">
                                        <Package size={24} weight="bold" />
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
                                        <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors group ${
                                            isAnimating(item.id) ? 'tactical-delete-animation' : ''
                                        }`}>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                        <Package size={20} weight="bold" />
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
                                                            <PencilSimple size={18} weight="bold" />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setItemToDelete(item);
                                                                setIsDeleteModalOpen(true);
                                                            }}
                                                            className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-white hover:shadow-sm rounded-xl transition-all border border-transparent hover:border-slate-100"
                                                            title="מחיקה"
                                                        >
                                                            <Trash2 size={18} weight="bold" />
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
                                <ChevronRight size={20} weight="bold" />
                            </button>

                            <div className="flex items-center gap-2">
                                <CalendarIcon size={16} className="text-slate-500" aria-hidden="true" weight="bold" />
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
                                <ChevronLeft size={20} weight="bold" />
                            </button>
                        </div>

                        {/* Legend - Premium Visuals */}
                        <div className="bg-white border border-slate-100 shadow-sm rounded-2xl p-4 flex flex-wrap gap-6 items-center justify-center text-[13px] font-black text-slate-600">
                            <div className="flex items-center gap-2 group">
                                <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-100 transition-transform group-hover:scale-110">
                                    <CheckCircle2 size={18} weight="bold" />
                                </div>
                                <span className="tracking-tight uppercase text-[11px]">תקין / נמצא</span>
                            </div>
                            <div className="flex items-center gap-2 group">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-100 transition-transform group-hover:scale-110">
                                    <Hammer size={18} weight="bold" />
                                </div>
                                <span className="tracking-tight uppercase text-[11px]">תקול / לתיקון</span>
                            </div>
                            <div className="flex items-center gap-2 group">
                                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-100 transition-transform group-hover:scale-110">
                                    <AlertCircle size={18} weight="bold" />
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
                                                <CheckCircle2 size={24} weight={displayStatus === 'present' ? 'bold' : 'bold'} />
                                            </button>
                                            <button
                                                onClick={() => !isViewer && handleVerify(item.id, 'damaged')}
                                                className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-2 ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'damaged'
                                                    ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                                                    : 'bg-white border-slate-100 text-slate-300'
                                                    }`}
                                            >
                                                <Hammer size={24} weight={displayStatus === 'damaged' ? 'bold' : 'bold'} />
                                            </button>
                                            <button
                                                onClick={() => !isViewer && handleVerify(item.id, 'missing')}
                                                className={`h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border-2 ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'missing'
                                                    ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200'
                                                    : 'bg-white border-slate-100 text-slate-300'
                                                    }`}
                                            >
                                                <AlertCircle size={24} weight={displayStatus === 'missing' ? 'bold' : 'bold'} />
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
                                                            <QrCode size={20} weight="bold" />
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
                                                            <CheckCircle2 size={20} weight="bold" />
                                                        </button>
                                                        <button
                                                            onClick={() => !isViewer && handleVerify(item.id, 'damaged')}
                                                            disabled={!canVerifyItem(item)}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'damaged'
                                                                ? 'bg-amber-500 text-white shadow-md shadow-amber-100 ring-4 ring-amber-50'
                                                                : 'bg-slate-50/80 text-slate-300 hover:bg-amber-50 hover:text-amber-500'
                                                                }`}
                                                        >
                                                            <Hammer size={20} weight="bold" />
                                                        </button>
                                                        <button
                                                            onClick={() => !isViewer && handleVerify(item.id, 'missing')}
                                                            disabled={!canVerifyItem(item)}
                                                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${!canVerifyItem(item) ? 'opacity-40 cursor-not-allowed' : ''} ${displayStatus === 'missing'
                                                                ? 'bg-rose-500 text-white shadow-md shadow-rose-100 ring-4 ring-rose-50'
                                                                : 'bg-slate-50/80 text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                                                                }`}
                                                        >
                                                            <AlertCircle size={20} weight="bold" />
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
                            <Package size={40} className="text-slate-300" weight="bold" />
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
                            <Info size={20} className="text-indigo-600 shrink-0 mt-0.5" weight="bold" />
                            <div>
                                <h4 className="text-sm font-black text-indigo-900">רישום אמצעי חדש</h4>
                                <p className="text-[11px] font-bold text-indigo-700/70 leading-relaxed">הזן את פרטי האמצעי (נשק, אופטיקה וכו') ואת מספר הצלם הייחודי שלו.</p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2 text-right">
                            <label className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest flex items-center justify-start gap-2">
                                <Tag size={14} className="text-indigo-500" weight="bold" />
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
                                <QrCode size={14} className="text-indigo-500" weight="bold" />
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
                            <Users size={14} className="text-indigo-500" weight="bold" />
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
                            <History size={14} className="text-indigo-500" weight="bold" />
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
                                    handleTacticalDelete(editingItem.id!);
                                    setIsAddEditModalOpen(false);
                                }}
                                className="w-full h-12 text-rose-600 border-rose-100 hover:bg-rose-50 rounded-2xl font-black flex items-center justify-center gap-2"
                            >
                                <Trash2 size={18} weight="bold" />
                                מחק פריט מהמערכת
                            </Button>
                        </div>
                    )}
                </div>
            </GenericModal>
            {/* Delete Confirmation Modal */}
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                title="מחיקת ציוד"
                message={`האם אתה בטוח שברצונך למחוק את ${itemToDelete?.type} ${itemToDelete?.serial_number}? הפעולה לא ניתנת לביטול.`}
                confirmText="מחק שורה"
                cancelText="ביטול"
                type="danger"
                onConfirm={() => {
                    if (itemToDelete) {
                        handleTacticalDelete(itemToDelete.id);
                    }
                    setIsDeleteModalOpen(false);
                }}
                onCancel={() => setIsDeleteModalOpen(false)}
            />
            <TacticalDeleteStyles />
        </div >
    );
};

export default EquipmentManager;
