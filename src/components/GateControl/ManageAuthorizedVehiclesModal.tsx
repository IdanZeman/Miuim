import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Search, Trash2, Car, Calendar as CalendarIcon, ShieldCheck, User, Building2, Pencil, MoreVertical } from 'lucide-react';
import { useGateSystem, AuthorizedVehicle } from '../../hooks/useGateSystem';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../features/auth/AuthContext';
import { Modal } from '../ui/Modal';

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
        setIsSubmitting(true); // Should be false, wait... fixing in replacement
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
        <div className="flex gap-3 w-full">
            <Button
                type="button"
                variant="outline"
                onClick={() => { setViewMode('list'); resetForm(); }}
                className="flex-1 h-12 rounded-full border-slate-200 text-slate-600 font-bold"
                disabled={isSubmitting}
            >
                ביטול
            </Button>
            <Button
                type="submit"
                form="add-vehicle-form"
                disabled={isSubmitting}
                className="flex-1 h-12 rounded-full font-bold bg-[#FFD15F] hover:bg-[#FFC63A] text-slate-900 border-none shadow-lg shadow-amber-200"
            >
                {isSubmitting ? <LoadingSpinner size={20} /> : (viewMode === 'edit' ? 'עדכן רכב' : 'הוסף לשרת')}
            </Button>
        </div>
    );

    const renderAddVehicleForm = () => (
        <form id="add-vehicle-form" onSubmit={handleSaveVehicle} className="space-y-4 animate-in slide-in-from-right-2 duration-300">
            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">מספר רכב <span className="text-red-500">*</span></label>
                <Input
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="00-000-00"
                    className="font-bold text-lg tracking-wider h-12 rounded-xl"
                    maxLength={8}
                    required
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">שם בעל הרכב <span className="text-red-500">*</span></label>
                    <Input
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        placeholder="שם מלא..."
                        className="h-11 rounded-xl"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">שיוך יחידתי <span className="text-red-500">*</span></label>
                    <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white"
                        required
                    >
                        <option value="" disabled>בחר יחידה...</option>
                        {battalionOrganizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">סוג רכב</label>
                    <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-white"
                    >
                        <option value="private">רכב פרטי</option>
                        <option value="operational">רכב מבצעי</option>
                        <option value="military">רכב צבאי (חום)</option>
                        <option value="truck">משאית / לוגיסטיקה</option>
                    </select>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-4 border border-slate-100/50">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">תוקף אישור כניסה</h4>

                <div className="flex flex-wrap gap-2 mb-4">
                    {[
                        { label: '4 שע\'', hours: 4 },
                        { label: '12 שע\'', hours: 12 },
                        { label: '24 שע\'', hours: 24 },
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
                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${!isPermanent && validUntil.slice(0, 13) === getLocalISOString(new Date(new Date().getTime() + preset.hours * 60 * 60 * 1000)).slice(0, 13) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}
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
                        className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all shadow-sm ${isPermanent ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-green-400 hover:text-green-600'}`}
                    >
                        צמיתות (ללא הגבלה)
                    </button>
                    <button
                        type="button"
                        onClick={() => { setValidFrom(''); setValidUntil(''); setIsPermanent(false); }}
                        className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-400 hover:text-red-500 transition-all shadow-sm"
                    >
                        ניקוי
                    </button>
                </div>

                {!isPermanent ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1 px-1">מתאריך ושעה</label>
                            <Input
                                type="datetime-local"
                                value={validFrom}
                                onChange={(e) => {
                                    setValidFrom(e.target.value);
                                    setIsPermanent(false);
                                }}
                                className="h-10 text-sm rounded-xl px-3 border-slate-200"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-400 mb-1 px-1">עד תאריך ושעה</label>
                            <Input
                                type="datetime-local"
                                value={validUntil}
                                onChange={(e) => {
                                    setValidUntil(e.target.value);
                                    setIsPermanent(false);
                                }}
                                className="h-10 text-sm rounded-xl px-3 border-slate-200"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl border border-green-100 animate-in slide-in-from-top-2 duration-200">
                        <ShieldCheck size={16} />
                        <span className="text-xs font-bold">אישור כניסה קבוע - ללא הגבלת זמן</span>
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">הערות</label>
                <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="הערות נוספות..."
                    className="h-11 rounded-xl"
                />
            </div>
        </form>
    );

    return (
        <div className={`flex flex-col h-full overflow-hidden ${className}`}>
            {/* Content Header (Optional if Tabs exist, but good for context) */}
            <div className="px-4 py-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                    <h2 className="text-base md:text-lg font-bold text-slate-800">רכבים מורשים</h2>
                    <p className="text-[10px] md:text-xs text-slate-500 font-medium">ניהול המורשים לכניסה לבסיס</p>
                </div>
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                    <ShieldCheck size={20} />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                {viewMode === 'list' && (
                    <>
                        {/* Toolbar */}
                        <div className="flex flex-col sm:flex-row gap-4 mb-4 md:mb-6">
                            <div className="relative flex-1">
                                <Input
                                    placeholder="חפש לפי מספר רכב, שם או יחידה..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-11"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            </div>
                            <Button
                                onClick={() => setViewMode('add')}
                                className="hidden md:flex shrink-0 items-center gap-2 h-11"
                            >
                                <Plus size={18} />
                                <span>הוסף רכב חדש</span>
                            </Button>
                        </div>

                        {/* List */}
                        {isLoading ? (
                            <div className="flex justify-center py-10">
                                <LoadingSpinner />
                            </div>
                        ) : filteredVehicles.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                <Car size={48} className="mx-auto mb-3 opacity-50" />
                                <p>לא נמצאו רכבים תואמים</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {filteredVehicles.map((vehicle) => (
                                    <div key={vehicle.id} className="group p-3 rounded-2xl border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all bg-white flex items-center justify-between relative overflow-visible">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="bg-slate-50 h-10 w-10 shrink-0 rounded-xl flex items-center justify-center text-slate-400 font-black text-sm border border-slate-100/50">
                                                {vehicle.plate_number.slice(-2)}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <h3 className="font-bold text-slate-900 text-sm md:text-base leading-none">{vehicle.plate_number}</h3>
                                                    <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-bold border border-green-100/50 leading-none">מורשה</span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                                                    <span className="flex items-center gap-1 truncate max-w-[80px]"><User size={10} className="text-slate-400" /> {vehicle.owner_name}</span>
                                                    {vehicle.organizations?.name && (
                                                        <span className="flex items-center gap-1 text-blue-600 truncate max-w-[80px]"><Building2 size={10} className="opacity-70" /> {vehicle.organizations.name}</span>
                                                    )}
                                                </div>
                                                <div className="mt-1">
                                                    {vehicle.is_permanent || (!vehicle.valid_from && !vehicle.valid_until) ? (
                                                        <span className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50/50 px-1.5 py-0.5 rounded-lg w-fit">
                                                            <ShieldCheck size={10} />
                                                            קבוע
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[10px] text-amber-600 font-bold bg-amber-50/50 px-1.5 py-0.5 rounded-lg w-fit">
                                                            <CalendarIcon size={10} />
                                                            {vehicle.valid_until ? new Date(vehicle.valid_until).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }) : 'ללא הגבלה'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Actions */}
                                        <div className="flex items-center gap-1">
                                            {/* Desktop: Explicit Buttons */}
                                            <div className="hidden md:flex items-center gap-1">
                                                <button
                                                    onClick={() => handleEditVehicle(vehicle)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="ערוך רכב"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVehicle(vehicle.id, vehicle.plate_number)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="מחק רכב"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            {/* Mobile: Three-Dots Menu */}
                                            <div className="md:hidden relative">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveMenuId(activeMenuId === vehicle.id ? null : vehicle.id);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
                                                >
                                                    <MoreVertical size={20} />
                                                </button>

                                                {activeMenuId === vehicle.id && (
                                                    <>
                                                        <div
                                                            className="fixed inset-0 z-10"
                                                            onClick={() => setActiveMenuId(null)}
                                                        />
                                                        <div className="absolute left-0 top-full mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-1.5 animate-in fade-in zoom-in-95 duration-100 transform origin-top-left">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditVehicle(vehicle);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-right text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 transition-colors"
                                                            >
                                                                <Pencil size={14} />
                                                                ערוך רכב
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteVehicle(vehicle.id, vehicle.plate_number);
                                                                    setActiveMenuId(null);
                                                                }}
                                                                className="w-full px-4 py-2 text-right text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                                מחק רכב
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Mobile FAB for adding vehicles */}
                        <button
                            onClick={() => setViewMode('add')}
                            className="md:hidden fixed bottom-24 left-6 w-16 h-16 bg-yellow-400 text-slate-900 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:bg-yellow-500 transition-all flex items-center justify-center z-[110] active:scale-95 shadow-yellow-400/40"
                            aria-label="הוסף רכב"
                        >
                            <Plus size={32} strokeWidth={3} />
                        </button>
                    </>
                )}

                {/* Always visible on Desktop as part of content, but we wrap it in Modal for mobile */}
                <div className="md:hidden">
                    <Modal
                        isOpen={viewMode === 'add' || viewMode === 'edit'}
                        onClose={() => { setViewMode('list'); resetForm(); }}
                        title={viewMode === 'edit' ? 'עריכת רכב מורשה' : 'הוספת רכב מורשה'}
                        size="lg"
                        footer={renderAddVehicleButtons()}
                    >
                        <div className="p-0">
                            {renderAddVehicleForm()}
                        </div>
                    </Modal>
                </div>
                <div className="hidden md:block">
                    {(viewMode === 'add' || viewMode === 'edit') && (
                        <div className="max-w-xl mx-auto bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="font-bold text-xl text-slate-800">
                                    {viewMode === 'edit' ? 'עריכת רכב מורשה' : 'הוספת רכב מורשה חדש'}
                                </h3>
                                <Button variant="ghost" size="sm" onClick={() => { setViewMode('list'); resetForm(); }} className="text-slate-400 hover:text-slate-600 rounded-full">ביטול</Button>
                            </div>
                            {renderAddVehicleForm()}
                            <div className="mt-8 pt-6 border-t border-slate-50">
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
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl max-h-[85vh] animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute -top-12 right-0 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
                >
                    <X size={24} />
                </button>
                <AuthorizedVehiclesContent className="h-[80vh] bg-white rounded-2xl shadow-xl border border-slate-200" />
            </div>
        </div>,
        document.body
    );
};
