import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X as XIcon, Plus as PlusIcon, MagnifyingGlass as SearchIcon, Trash as TrashIcon, Car as CarIcon, Calendar as CalendarIcon, ShieldCheck as ShieldCheckIcon, User as UserIcon, Buildings as Building2Icon, Pencil as PencilIcon, DotsThreeVertical as MoreVerticalIcon, ArrowsClockwise as RefreshIcon, CaretDown as ChevronDownIcon } from '@phosphor-icons/react';
import { useGateSystem, AuthorizedVehicle } from '../../hooks/useGateSystem';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../features/auth/AuthContext';
import { GenericModal } from '../ui/GenericModal';
import { DateTimePicker } from '../ui/DatePicker';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { CircleNotch as Loader2 } from '@phosphor-icons/react';

interface AuthorizedVehiclesContentProps {
    className?: string;
}

export const AuthorizedVehiclesContent: React.FC<AuthorizedVehiclesContentProps> = ({ className }) => {
    const {
        authorizedVehicles,
        battalionOrganizations,
        addAuthorizedVehicle,
        updateAuthorizedVehicle,
        deleteAuthorizedVehicle,
        isLoading
    } = useGateSystem();

    const { profile } = useAuth();
    const { showToast } = useToast();

    // Local State
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'add' | 'edit'>('list');
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Form State
    const [plateNumber, setPlateNumber] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState('');
    const [vehicleType, setVehicleType] = useState('private');
    const [validFrom, setValidFrom] = useState('');
    const [validUntil, setValidUntil] = useState('');
    const [isPermanent, setIsPermanent] = useState(false);
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filtered List
    const filteredVehicles = useMemo(() => {
        if (!searchTerm) return authorizedVehicles;
        const lowerTerm = searchTerm.toLowerCase();
        return authorizedVehicles.filter(v =>
            v.plate_number.includes(lowerTerm) ||
            v.owner_name.toLowerCase().includes(lowerTerm) ||
            v.organizations?.name?.toLowerCase().includes(lowerTerm)
        );
    }, [authorizedVehicles, searchTerm]);

    const getLocalISOString = (date: Date) => {
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
    };

    const handleSaveVehicle = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!plateNumber || !ownerName || !selectedOrgId) {
            showToast('אנא מלא את כל שדות החובה', 'error');
            return;
        }

        setIsSubmitting(true);
        const vehicleData = {
            plate_number: plateNumber,
            owner_name: ownerName,
            organization_id: selectedOrgId,
            vehicle_type: vehicleType,
            is_permanent: isPermanent,
            valid_from: isPermanent ? null : (validFrom || null),
            valid_until: isPermanent ? null : (validUntil || null),
            notes: notes || null
        };

        const { success, error } = viewMode === 'edit' && editingVehicleId
            ? await updateAuthorizedVehicle(editingVehicleId, vehicleData)
            : await addAuthorizedVehicle(vehicleData);

        if (success) {
            showToast(viewMode === 'edit' ? 'רכב עודכן בהצלחה' : 'רכב נוסף בהצלחה', 'success');
            resetForm();
            setViewMode('list');
        } else {
            showToast(error || 'שגיאה בשמירת רכב', 'error');
        }
        setIsSubmitting(false);
    };

    const resetForm = () => {
        setPlateNumber('');
        setOwnerName('');
        setNotes('');
        setValidFrom('');
        setValidUntil('');
        setIsPermanent(false);
        setEditingVehicleId(null);
    };

    const handleEditVehicle = (vehicle: AuthorizedVehicle) => {
        setEditingVehicleId(vehicle.id);
        setPlateNumber(vehicle.plate_number);
        setOwnerName(vehicle.owner_name);
        setSelectedOrgId(vehicle.organization_id);
        setVehicleType(vehicle.vehicle_type);
        setValidFrom(vehicle.valid_from ? getLocalISOString(new Date(vehicle.valid_from)) : '');
        setValidUntil(vehicle.valid_until ? getLocalISOString(new Date(vehicle.valid_until)) : '');
        setIsPermanent(vehicle.is_permanent || (!vehicle.valid_from && !vehicle.valid_until));
        setNotes(vehicle.notes || '');
        setViewMode('edit');
    };

    const handleDeleteVehicle = async (id: string, plate: string) => {
        if (!confirm(`האם אתה בטוח שברצונך למחוק את הרכב ${plate}?`)) return;

        const { success, error } = await deleteAuthorizedVehicle(id);
        if (success) {
            showToast('רכב נמחק בהצלחה', 'success');
        } else {
            showToast(error || 'שגיאה במחיקת רכב', 'error');
        }
    };

    React.useEffect(() => {
        if (viewMode === 'add' && !selectedOrgId && battalionOrganizations.length > 0) {
            const myOrg = battalionOrganizations.find(o => o.id === profile?.organization_id);
            setSelectedOrgId(myOrg ? myOrg.id : battalionOrganizations[0].id);
        }
    }, [viewMode, battalionOrganizations, profile?.organization_id, selectedOrgId]);

    const renderAddVehicleButtons = () => (
        <div className="flex gap-4 w-full">
            <Button
                type="button"
                variant="outline"
                onClick={() => { setViewMode('list'); resetForm(); }}
                className="flex-1 h-14 rounded-2xl border-slate-200 text-slate-500 font-bold hover:bg-slate-50 transition-all"
                disabled={isSubmitting}
            >
                ביטול
            </Button>
            <Button
                type="submit"
                form="add-vehicle-form"
                disabled={isSubmitting}
                className="flex-[1.5] h-14 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
            >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (viewMode === 'edit' ? 'עדכן פרטים' : 'הוסף רכב')}
            </Button>
        </div>
    );

    const renderAddVehicleForm = () => (
        <form id="add-vehicle-form" onSubmit={handleSaveVehicle} className="space-y-6 animate-in slide-in-from-bottom-4 duration-400">
            {/* Plate Number Section */}
            <div className="bg-slate-50/50 p-5 rounded-3xl border border-slate-100/50">
                <label className="block text-[11px] font-black text-blue-600 uppercase tracking-widest mb-3 px-1">מספר רכב (חובה)</label>
                <div className="relative group">
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                        <CarIcon size={20} weight="duotone" />
                    </div>
                    <Input
                        value={plateNumber}
                        onChange={(e) => setPlateNumber(e.target.value)}
                        placeholder="00-000-00"
                        className="font-black text-2xl tracking-widest h-16 pr-12 rounded-2xl bg-white border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                        maxLength={8}
                        required
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 px-1 flex items-center gap-1.5">
                        <UserIcon size={14} className="text-slate-400" weight="duotone" />
                        שם בעל הרכב
                    </label>
                    <Input
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="שם מלא..."
                        className="h-12 rounded-2xl bg-white border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold"
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-600 mb-2 px-1 flex items-center gap-1.5">
                        <Building2Icon size={14} className="text-slate-400" weight="duotone" />
                        שיוך יחידתי
                    </label>
                    <div className="relative">
                        <select
                            value={selectedOrgId}
                            onChange={(e) => setSelectedOrgId(e.target.value)}
                            className="w-full h-12 px-4 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all bg-white font-bold text-slate-900 appearance-none"
                            required
                        >
                            <option value="" disabled>בחר יחידה...</option>
                            {battalionOrganizations.map(org => (
                                <option key={org.id} value={org.id}>{org.name}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
                            <ChevronDownIcon size={18} weight="bold" />
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 px-1">סוג רכב</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                        { id: 'private', label: 'פרטי' },
                        { id: 'operational', label: 'מבצעי' },
                        { id: 'military', label: 'צבאי' },
                        { id: 'truck', label: 'משאית' },
                    ].map((type) => (
                        <button
                            key={type.id}
                            type="button"
                            onClick={() => setVehicleType(type.id)}
                            className={`h-11 rounded-xl text-xs font-black transition-all border-2 ${vehicleType === type.id ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white border-slate-100 text-slate-500 hover:border-slate-200'}`}
                        >
                            {type.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-slate-50/80 p-5 rounded-[2rem] space-y-5 border border-slate-100">
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">תוקף אישור כניסה</h4>
                    {isPermanent && (
                        <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-widest">
                            קבוע
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap gap-2">
                    {[
                        { label: '4 שע\'', hours: 4 },
                        { label: '12 שע\'', hours: 12 },
                        { label: 'יממה', hours: 24 },
                        { label: 'שבוע', hours: 24 * 7 },
                    ].map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                                const now = new Date();
                                const until = new Date(now.getTime() + preset.hours * 60 * 60 * 1000);
                                setValidFrom(getLocalISOString(now));
                                setValidUntil(getLocalISOString(until));
                                setIsPermanent(false);
                            }}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${!isPermanent && validUntil.slice(0, 13) === getLocalISOString(new Date(new Date().getTime() + preset.hours * 60 * 60 * 1000)).slice(0, 13) ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400'}`}
                        >
                            {preset.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            setValidFrom('');
                            setValidUntil('');
                            setIsPermanent(true);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all border-2 ${isPermanent ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                    >
                        ללא הגבלה
                    </button>
                </div>

                {!isPermanent ? (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <DateTimePicker
                            label="מתי?"
                            value={validFrom}
                            onChange={(val) => {
                                setValidFrom(val);
                                setIsPermanent(false);
                            }}
                        />
                        <DateTimePicker
                            label="עד מתי?"
                            value={validUntil}
                            onChange={(val) => {
                                setValidUntil(val);
                                setIsPermanent(false);
                            }}
                        />
                    </div>
                ) : (
                    <div className="flex items-center gap-3 text-blue-600 bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 animate-in zoom-in-95 duration-300">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                            <ShieldCheckIcon size={20} weight="duotone" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-black tracking-tight">אישור כניסה קבוע</span>
                            <span className="text-[10px] font-bold opacity-70 uppercase tracking-widest">אין תאריך תפוגה מוגדר</span>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-600 mb-2 px-1">הערות רלוונטיות</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="סיבת כניסה, אישור מיוחד, או כל הערה אחרת..."
                    className="w-full min-h-[100px] p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-medium text-sm text-slate-900 resize-none"
                />
            </div>
        </form>
    );

    return (
        <div className={`flex flex-col h-full bg-slate-50/30 overflow-hidden ${className}`}>
            {/* Content Header - Premium Style */}
            <div className="px-6 py-5 border-b border-slate-100/60 flex items-center justify-between bg-white z-10">
                <div className="flex flex-col">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">רכבים מורשים</h2>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ניהול מאגר מורשי כניסה</span>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100">
                    <ShieldCheckIcon size={24} weight="duotone" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-32 custom-scrollbar">
                {viewMode === 'list' && (
                    <>
                        {/* Premium Toolbar */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-6">
                            <div className="relative group flex-1">
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                    <SearchIcon size={18} weight="bold" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="חפש לפי מספר רכב, שם או יחידה..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="block w-full h-12 pr-12 pl-4 bg-white border-slate-200/60 rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-bold text-sm shadow-sm"
                                />
                            </div>
                            <Button
                                onClick={() => setViewMode('add')}
                                className="hidden md:flex shrink-0 items-center gap-2 h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 font-black px-6"
                            >
                                <PlusIcon size={20} weight="bold" />
                                <span>הוסף רכב</span>
                            </Button>
                        </div>

                        {/* List - Premium Cards */}
                        {isLoading ? (
                            <DashboardSkeleton />
                        ) : filteredVehicles.length === 0 ? (
                            <div className="text-center py-16 text-slate-400 bg-white rounded-3xl border border-dashed border-slate-200 shadow-sm">
                                <CarIcon size={48} className="mx-auto mb-4 opacity-30" weight="duotone" />
                                <p className="text-lg font-bold">לא נמצאו רכבים תואמים</p>
                                <p className="text-sm">נסה לשנות את מונחי החיפוש</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {filteredVehicles.map((vehicle) => (
                                    <div key={vehicle.id} className="group p-4 bg-white rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all flex items-center justify-between relative active:scale-[0.99]">
                                        {/* Status Accents */}
                                        <div className="absolute top-0 bottom-0 right-0 w-1.5 bg-blue-600/10 group-hover:bg-blue-600 transition-all rounded-r-3xl" />

                                        <div className="flex items-center gap-4 min-w-0 mr-2">
                                            <div className="w-14 h-14 bg-slate-50 group-hover:bg-blue-50 rounded-[1.25rem] flex flex-col items-center justify-center text-slate-400 group-hover:text-blue-600 border border-slate-100 transition-all shrink-0">
                                                <CarIcon size={20} weight="duotone" />
                                                <span className="text-[9px] font-black uppercase mt-0.5 tracking-tighter">VEHICLE</span>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                                                    <h3 className="font-black text-slate-900 text-lg leading-none tracking-tight">{vehicle.plate_number}</h3>
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100/50">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-[10px] font-black uppercase tracking-widest">מורשה כניסה</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-slate-500 font-bold">
                                                    <span className="flex items-center gap-1.5 truncate">
                                                        <UserIcon size={12} className="text-slate-400" weight="duotone" />
                                                        {vehicle.owner_name}
                                                    </span>
                                                    {vehicle.organizations?.name && (
                                                        <>
                                                            <div className="w-1 h-1 rounded-full bg-slate-200" />
                                                            <span className="flex items-center gap-1.5 text-blue-600/70 truncate uppercase tracking-tight">
                                                                <Building2Icon size={12} weight="duotone" />
                                                                {vehicle.organizations.name}
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="mt-2.5">
                                                    {vehicle.is_permanent || (!vehicle.valid_from && !vehicle.valid_until) ? (
                                                        <div className="inline-flex items-center gap-2 text-[10px] text-blue-700 font-black bg-blue-50 px-3 py-1 rounded-xl">
                                                            <ShieldCheckIcon size={12} weight="duotone" />
                                                            תוקף קבוע
                                                        </div>
                                                    ) : (
                                                        <div className="inline-flex items-center gap-2 text-[10px] text-amber-700 font-black bg-amber-50 px-3 py-1 rounded-xl border border-amber-100/50">
                                                            <CalendarIcon size={12} weight="duotone" />
                                                            <span>עד {vehicle.valid_until ? new Date(vehicle.valid_until).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'ללא הגבלה'}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions - Premium Controls */}
                                        <div className="flex items-center gap-1">
                                            {/* Desktop Controls */}
                                            <div className="hidden md:flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEditVehicle(vehicle)}
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all active:scale-90"
                                                >
                                                    <PencilIcon size={18} weight="bold" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVehicle(vehicle.id, vehicle.plate_number)}
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                                                >
                                                    <TrashIcon size={18} weight="bold" />
                                                </button>
                                            </div>

                                            {/* Mobile Menu */}
                                            <div className="md:hidden relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === vehicle.id ? null : vehicle.id);
                                                    }}
                                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-50 rounded-xl transition-all active:scale-90"
                                                >
                                                    <MoreVerticalIcon size={20} weight="bold" />
                                                </button>

                                                {activeMenuId === vehicle.id && (
                                                    <div className="absolute left-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 py-2 animate-in fade-in zoom-in-95 duration-150 origin-top-left ring-1 ring-slate-200/50 overflow-hidden">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditVehicle(vehicle);
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full px-4 py-3 text-right text-xs font-black text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                                <PencilIcon size={14} weight="bold" />
                                                            </div>
                                                            עריכת פרטים
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeleteVehicle(vehicle.id, vehicle.plate_number);
                                                                setActiveMenuId(null);
                                                            }}
                                                            className="w-full px-4 py-3 text-right text-xs font-black text-red-600 hover:bg-rose-50 flex items-center gap-3 transition-colors border-t border-slate-100"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                                                                <TrashIcon size={14} weight="bold" />
                                                            </div>
                                                            מחיקה מהמאגר
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Standardized FAB */}
                        <FloatingActionButton
                            show={viewMode === 'list'}
                            onClick={() => setViewMode('add')}
                            icon={PlusIcon}
                            ariaLabel="הוסף רכב"
                            className="md:hidden"
                        />
                    </>
                )}

                {/* Mobile Forms are in Modal (managed via viewMode switch) */}
                <div className="md:hidden">
                    <GenericModal
                        isOpen={viewMode === 'add' || viewMode === 'edit'}
                        onClose={() => { setViewMode('list'); resetForm(); }}
                        title={
                            <div className="flex flex-col">
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                    {viewMode === 'edit' ? 'עריכת מורשה' : 'הוספת מורשה חדש'}
                                </h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="p-1 rounded-lg bg-blue-50 text-blue-600">
                                        <CarIcon size={14} weight="duotone" />
                                    </div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        {viewMode === 'edit' ? 'עדכון פרטי רכב' : 'רישום רכב למאגר'}
                                    </span>
                                </div>
                            </div>
                        }
                        size="full"
                        footer={renderAddVehicleButtons()}
                    >
                        <div className="pb-6">
                            {renderAddVehicleForm()}
                        </div>
                    </GenericModal>
                </div>

                {/* Desktop Forms - Premium Integration */}
                <div className="hidden md:block">
                    {(viewMode === 'add' || viewMode === 'edit') && (
                        <div className="max-w-2xl mx-auto bg-white p-8 rounded-[2rem] border border-slate-100 shadow-2xl shadow-slate-300/30 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between mb-8 border-b border-slate-50 pb-6">
                                <div className="flex flex-col">
                                    <h3 className="font-black text-2xl text-slate-900 tracking-tight">
                                        {viewMode === 'edit' ? 'עריכת רכב מורשה' : 'רישום רכב חדש'}
                                    </h3>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">הזן פרטו לזיהוי אוטומטי במערכת</span>
                                </div>
                                <button
                                    onClick={() => { setViewMode('list'); resetForm(); }}
                                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all"
                                >
                                    <XIcon size={20} weight="bold" />
                                </button>
                            </div>

                            {renderAddVehicleForm()}

                            <div className="mt-10 pt-8 border-t border-slate-50">
                                {renderAddVehicleButtons()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface ManageAuthorizedVehiclesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ManageAuthorizedVehiclesModal: React.FC<ManageAuthorizedVehiclesModalProps> = ({ isOpen, onClose }) => {
    const modalTitle = (
        <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">רכבים מורשים</h2>
            <div className="flex items-center gap-2 mt-1">
                <ShieldCheckIcon size={14} className="text-blue-600" weight="duotone" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ניהול מאגר מורשי כניסה</span>
            </div>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="2xl"
        >
            <div className="h-[80vh] md:h-auto md:min-h-[500px]">
                <AuthorizedVehiclesContent className="h-full bg-transparent p-0" />
            </div>
        </GenericModal>
    );
};
