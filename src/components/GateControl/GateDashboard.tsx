import React, { useState, useMemo } from 'react';
import { useGateSystem, GateLog } from '../../hooks/useGateSystem';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../features/auth/AuthContext';
import { GateHistoryList } from './GateHistoryList';
import { Modal } from '../ui/Modal'; // Added Modal import
import {
    ArrowLeftRight, Settings, RefreshCw, Car, Footprints, LogOut, Search,
    Plus, MapPin, Filter, AlertTriangle, CheckCircle2, MoreVertical, Trash2, Edit2, User, PlusCircle,
    ChevronDown, ChevronUp, Download, Printer, UserPlus, History, ShieldCheck
} from 'lucide-react';
import { ManageAuthorizedVehiclesModal, AuthorizedVehiclesContent } from './ManageAuthorizedVehiclesModal';
import { GateHistory } from './GateHistory';
import { supabase } from '../../lib/supabase';

export const GateDashboard: React.FC = () => {
    const {
        checkVehicle,
        registerEntry,
        registerExit,
        activeLogs,
        authorizedVehicles,
        battalionOrganizations,
        battalionTeams,
        searchPeople, // New search function
        addAuthorizedVehicle,
        fetchGateHistory,
        isLoading
    } = useGateSystem();

    const { showToast } = useToast();
    const { profile } = useAuth();

    const canManageAuthorized = profile?.is_super_admin ||
        profile?.role === 'admin' ||
        profile?.permissions?.canManageGateAuthorized;

    // Tab State
    const [currentTab, setCurrentTab] = useState<'control' | 'authorized'>('control');

    // Security check: force back to control if unauthorized
    React.useEffect(() => {
        if (currentTab === 'authorized' && !canManageAuthorized) {
            setCurrentTab('control');
        }
    }, [currentTab, canManageAuthorized]);

    // Entry Form State
    const [direction, setDirection] = useState<'entry' | 'exit'>('entry');
    const [entryType, setEntryType] = useState<'vehicle' | 'pedestrian'>('vehicle');
    const [plateInput, setPlateInput] = useState('');
    const [driverName, setDriverName] = useState('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExceptional, setIsExceptional] = useState(false);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

    // Dashboard State
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [historyStartDate, setHistoryStartDate] = useState<Date>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [historyEndDate, setHistoryEndDate] = useState<Date>(new Date());
    const [historyLogs, setHistoryLogs] = useState<GateLog[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const [filteredDrivers, setFilteredDrivers] = useState<any[]>([]);
    const [filteredPedestrians, setFilteredPedestrians] = useState<any[]>([]);

    // Vehicle Check State
    const [match, setMatch] = useState<{ owner_name: string; is_permanent: boolean } | null>(null);

    // Effect for Vehicle Check (Async)
    React.useEffect(() => {
        if (entryType === 'pedestrian') {
            setMatch(null);
            return;
        }

        const performCheck = async () => {
            if (!plateInput || plateInput.length < 3) {
                setMatch(null);
                return;
            }
            try {
                // checkVehicle is async
                const result = await checkVehicle(plateInput);
                setMatch(result as any);
            } catch (e) {
                console.error(e);
                setMatch(null);
            }
        };

        const timer = setTimeout(performCheck, 500);
        return () => clearTimeout(timer);
    }, [plateInput, checkVehicle, entryType]);

    // Autocomplete Logic
    React.useEffect(() => {
        if (!plateInput || plateInput.length < 2) {
            setFilteredDrivers([]);
            setFilteredPedestrians([]);
            return;
        }

        if (entryType === 'vehicle') {
            const matches = authorizedVehicles.filter(v =>
                v.plate_number.includes(plateInput) || v.owner_name.includes(plateInput)
            ).slice(0, 5);
            setFilteredDrivers(matches);
            setFilteredPedestrians([]);
        } else {
            // Pedestrian Search (Now Async/SearchPeople)
            const performPedestrianSearch = async () => {
                const results = await searchPeople(plateInput);
                const enriched = results.map(p => {
                    const org = battalionOrganizations.find(o => o.id === p.organization_id);
                    const team = battalionTeams.find(t => t.id === p.team_id);
                    return { ...p, orgName: org?.name || '', teamName: team?.name || '' };
                });
                setFilteredPedestrians(enriched);
            };

            const timer = setTimeout(performPedestrianSearch, 300);
            return () => clearTimeout(timer);
        }
    }, [plateInput, authorizedVehicles, searchPeople, entryType, battalionOrganizations, battalionTeams]);

    // Check if vehicle is already inside
    const isAlreadyInside = useMemo(() => {
        return activeLogs.some(log => log.plate_number === plateInput && log.status === 'inside');
    }, [activeLogs, plateInput]);

    const handleRegisterEntry = async (e: React.FormEvent) => {
        e.preventDefault();

        // For Pedestrians, use plateInput (Name) as driverName if not set
        const finalDriverName = entryType === 'pedestrian' ? plateInput : driverName;
        const finalPlateNumber = entryType === 'pedestrian' ? plateInput : plateInput; // Use Name as ID for now

        if (!finalPlateNumber || (!finalDriverName && direction === 'entry')) {
            showToast(entryType === 'vehicle' ? 'נא להזין מספר רכב ושם נהג' : 'נא לבחור אדם מהרשימה', 'error');
            return;
        }

        if (direction === 'entry' && entryType === 'vehicle' && !match && !isExceptional) {
            showToast('רכב לא מזוהה - יש לסמן אישור כניסה חריג', 'error');
            return;
        }

        setIsSubmitting(true);

        if (direction === 'entry') {
            if (activeLogs.some(log => log.plate_number === finalPlateNumber && log.status === 'inside')) {
                showToast(entryType === 'vehicle' ? 'רכב זה כבר נמצא בבסיס' : 'אדם זה כבר נמצא בבסיס', 'error');
                setIsSubmitting(false);
                return;
            }

            const { success, error } = await registerEntry({
                plate_number: finalPlateNumber,
                driver_name: finalDriverName,
                notes: notes,
                entry_type: entryType,
                is_exceptional: isExceptional
            });

            if (success) {
                showToast('כניסה נרשמה בהצלחה', 'success');
                setRefreshTrigger(prev => prev + 1);
                setPlateInput('');
                setDriverName('');
                setNotes('');
                setIsExceptional(false);
                setIsReportModalOpen(false); // Close modal on success if on mobile
            } else {
                showToast(error || 'אירעה שגיאה ברישום הכניסה', 'error');
            }
        } else {
            // DIRECTION: EXIT
            const { data: existingLogs } = await supabase
                .from('gate_logs')
                .select('*')
                .eq('plate_number', finalPlateNumber)
                .eq('status', 'inside')
                .order('entry_time', { ascending: false })
                .limit(1);

            const existingLog = existingLogs?.[0];

            if (existingLog) {
                const { success, error } = await registerExit(existingLog.id);
                if (success) {
                    showToast(`יציאה נרשמה (נסגר רישום קיים)`, 'success');
                    setRefreshTrigger(prev => prev + 1);
                    setPlateInput('');
                    setDriverName('');
                    setNotes('');
                } else {
                    showToast(error || 'אירעה שגיאה ברישום היציאה', 'error');
                }
            } else {
                const now = new Date();
                const localTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString();

                const { success, error } = await registerEntry({
                    plate_number: finalPlateNumber,
                    driver_name: finalDriverName,
                    notes: notes,
                    entry_type: entryType,
                    status: 'left',
                    exit_time: localTime
                });

                if (success) {
                    showToast(`יציאה נרשמה (ללא רישום כניסה קודם)`, 'success');
                    setRefreshTrigger(prev => prev + 1);
                    setPlateInput('');
                    setDriverName('');
                    setNotes('');
                } else {
                    showToast(error || 'אירעה שגיאה ברישום היציאה', 'error');
                }
            }
        }
        setIsSubmitting(false);
    };

    const handleRegisterExit = async (logId: string, plateNumber: string) => {
        const { success, error } = await registerExit(logId);
        if (success) {
            showToast(`יציאה נרשמה ל-${plateNumber} `, 'success');
            setRefreshTrigger(prev => prev + 1);
        } else {
            showToast(error || 'אירעה שגיאה ברישום היציאה', 'error');
        }
    };

    const renderEntryForm = (isModal = false) => (
        <div className={`flex flex-col gap-6 ${!isModal ? 'h-full' : ''}`}>
            {/* Entry/Exit Form Card */}
            <div className={`bg-white ${!isModal ? 'rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100' : ''} overflow-visible relative z-10`}>
                {!isModal && (
                    <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-5">
                        <div className="flex flex-col">
                            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                                    <ShieldCheck size={20} strokeWidth={2.5} />
                                </div>
                                {direction === 'entry' ? 'דיווח כניסה' : 'דיווח יציאה'}
                            </h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 mr-11">רישום תנועה בזמן אמת</span>
                        </div>

                        {/* Type Toggle - Premium Segmented */}
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 h-11">
                            <button
                                onClick={() => setEntryType('vehicle')}
                                className={`px-4 rounded-lg transition-all flex items-center gap-2 ${entryType === 'vehicle' ? 'bg-white shadow-sm text-blue-600 font-black' : 'text-slate-400 hover:text-slate-600 font-bold'}`}
                                title="רכב"
                            >
                                <Car size={18} strokeWidth={2.5} />
                                <span className="text-xs hidden md:inline">רכב</span>
                            </button>
                            <button
                                onClick={() => setEntryType('pedestrian')}
                                className={`px-4 rounded-lg transition-all flex items-center gap-2 ${entryType === 'pedestrian' ? 'bg-white shadow-sm text-amber-600 font-black' : 'text-slate-400 hover:text-slate-600 font-bold'}`}
                                title="הולך רגל"
                            >
                                <Footprints size={18} strokeWidth={2.5} />
                                <span className="text-xs hidden md:inline">הולך רגל</span>
                            </button>
                        </div>
                    </div>
                )}

                {isModal && (
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 h-14">
                        <button
                            onClick={() => setEntryType('vehicle')}
                            className={`flex-1 rounded-xl transition-all flex items-center justify-center gap-2 font-black text-sm ${entryType === 'vehicle' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                        >
                            <Car size={20} strokeWidth={2.5} />
                            רכב
                        </button>
                        <button
                            onClick={() => setEntryType('pedestrian')}
                            className={`flex-1 rounded-xl transition-all flex items-center justify-center gap-2 font-black text-sm ${entryType === 'pedestrian' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-400'}`}
                        >
                            <Footprints size={20} strokeWidth={2.5} />
                            הולך רגל
                        </button>
                    </div>
                )}

                <form id="gate-entry-form" onSubmit={handleRegisterEntry} className="space-y-6">
                    {/* Direction Toggle - Enhanced for Mobile Focus */}
                    <div className={`grid grid-cols-2 gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50 ${isModal ? 'h-14' : 'h-12'}`}>
                        <button
                            type="button"
                            onClick={() => setDirection('entry')}
                            className={`rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${direction === 'entry'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            <LogOut className="rotate-180" size={18} strokeWidth={2.5} />
                            כניסה
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('exit')}
                            className={`rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${direction === 'exit'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                : 'text-slate-500 hover:text-slate-800'
                                }`}
                        >
                            <LogOut size={18} strokeWidth={2.5} />
                            יציאה
                        </button>
                    </div>

                    {/* Identifier Input - Premium Style */}
                    <div className="relative">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                {entryType === 'vehicle' ? 'מספר רכב' : 'זיהוי הולך רגל'}
                            </label>
                            {entryType === 'vehicle' && <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">צ' למספרי צבא</span>}
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                {entryType === 'vehicle' ? <Car size={20} strokeWidth={2.5} /> : <User size={20} strokeWidth={2.5} />}
                            </div>
                            <input
                                type="text"
                                value={plateInput}
                                onChange={(e) => setPlateInput(e.target.value)}
                                placeholder={entryType === 'vehicle' ? "00-000-00" : "חפש שם..."}
                                className="block w-full h-14 pr-12 pl-4 bg-slate-50 border-none rounded-2xl text-slate-950 placeholder-slate-300 focus:ring-4 focus:ring-blue-500/10 transition-all font-black text-xl tracking-widest text-center"
                                autoComplete="off"
                            />
                        </div>

                        {/* Autocomplete Dropdown (Pedestrians) */}
                        {entryType === 'pedestrian' && filteredPedestrians.length > 0 && (
                            <div className="absolute z-40 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto ring-1 ring-slate-200/50">
                                {renderPedestrianOptions()}
                            </div>
                        )}

                        {/* Autocomplete Dropdown (Vehicles - by Plate) */}
                        {entryType === 'vehicle' && filteredDrivers.length > 0 && (
                            <div className="absolute z-40 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-slate-200/50">
                                {filteredDrivers.map((vehicle) => (
                                    <div
                                        key={vehicle.id}
                                        className="p-4 hover:bg-slate-50 cursor-pointer text-sm flex justify-between items-center transition-colors border-b border-slate-50 last:border-none"
                                        onClick={() => {
                                            setDriverName(vehicle.owner_name);
                                            setPlateInput(vehicle.plate_number);
                                            setFilteredDrivers([]);
                                        }}
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-black text-slate-900">{vehicle.owner_name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{vehicle.organization_name || 'אורח'}</span>
                                        </div>
                                        <div className="bg-blue-600 text-white px-3 py-1 rounded-lg font-black text-sm tracking-widest shadow-md shadow-blue-500/20">
                                            {vehicle.plate_number}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status Indicator (Vehicle Only) - Enhanced feedback */}
                    {entryType === 'vehicle' && plateInput.length >= 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className={`p-4 rounded-2xl border-2 flex items-center gap-4 transition-all ${match
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                                    .replace('bg-emerald-50', 'bg-emerald-50') // dummy replace to keep logic same
                                : isLoading ? 'bg-slate-50 border-slate-100 text-slate-400' : 'bg-rose-50 border-rose-100 text-rose-800'
                                }`}>
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${match ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-200 text-white'}`}>
                                    {isLoading ? <LoadingSpinner size={20} /> : (
                                        match ? <CheckCircle2 size={24} strokeWidth={2.5} /> : <AlertTriangle className={!isLoading ? 'text-rose-500' : ''} size={24} strokeWidth={2.5} />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <p className="font-black text-base leading-none">
                                            {isLoading ? 'מבצע אימות...' : (match ? 'מורשה כניסה' : 'רכב לא רשום')}
                                        </p>
                                        {match && (
                                            <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                {match.is_permanent ? 'קבוע' : 'זמני'}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs font-bold opacity-70 mt-1">
                                        {isLoading ? 'בודק פרטי רכב במאגר...' : (match ? match.owner_name : 'יש לאשר ידנית או להוסיף למאגר')}
                                    </p>
                                </div>
                            </div>

                            {!match && !isLoading && (
                                <div className="space-y-3">
                                    <label className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${isExceptional ? 'bg-amber-50 border-amber-300 shadow-lg shadow-amber-200/20' : 'bg-white border-slate-100 hover:border-blue-200'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isExceptional ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-100 text-slate-400'}`}>
                                            <AlertTriangle size={20} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-black text-slate-900 text-sm">אישור כניסה חריג</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">דווח על כניסה שלא מן המניין</div>
                                        </div>
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isExceptional ? 'bg-amber-500 border-amber-500' : 'border-slate-200 bg-slate-50'}`}>
                                            {isExceptional && <CheckCircle2 size={16} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={isExceptional}
                                            onChange={(e) => setIsExceptional(e.target.checked)}
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!plateInput || !driverName) {
                                                showToast('נא להזין מספר רכב ושם נהג', 'error');
                                                return;
                                            }
                                            const now = new Date();
                                            const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                                            const { success, error } = await addAuthorizedVehicle({
                                                plate_number: plateInput,
                                                owner_name: driverName,
                                                organization_id: profile?.organization_id || '',
                                                vehicle_type: 'private',
                                                is_permanent: false,
                                                valid_from: now.toISOString(),
                                                valid_until: until.toISOString(),
                                                notes: 'אישור מהיר מהדיווח (24 שעות)'
                                            });
                                            if (success) {
                                                showToast('הרכב אושר ל-24 שעות הקרובות', 'success');
                                            } else {
                                                showToast(error || 'שגיאה באישור הרכב', 'error');
                                            }
                                        }}
                                        className="w-full h-11 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-black text-xs hover:bg-blue-50 active:scale-95 transition-all text-center"
                                    >
                                        <PlusCircle size={16} strokeWidth={2.5} />
                                        הוספה מהירה למאגר (24 שעות)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Details Inputs - Refined Grouping */}
                    <div className="space-y-4">
                        {entryType === 'vehicle' && (
                            <div className="relative group">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">שם הנהג</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <User size={18} />
                                    </div>
                                    <input
                                        value={driverName}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setDriverName(val);
                                            if (val.length > 1 && authorizedVehicles.length > 0) {
                                                const matches = authorizedVehicles.filter(v =>
                                                    v.owner_name.includes(val) &&
                                                    (!plateInput || v.plate_number !== plateInput)
                                                ).slice(0, 5);
                                                setFilteredDrivers(matches);
                                            } else {
                                                setFilteredDrivers([]);
                                            }
                                        }}
                                        onBlur={() => setTimeout(() => setFilteredDrivers([]), 200)}
                                        placeholder="שם מלא..."
                                        className="block w-full h-12 pr-11 pl-4 bg-slate-50 border-none rounded-xl text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        )}

                        <div className="group">
                            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2 px-1">הערות נוספות</label>
                            <div className="relative">
                                <div className="absolute top-3 right-4 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                    <Edit2 size={16} />
                                </div>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="פרטים נוספים, יעד, ליווי..."
                                    className="block w-full min-h-[80px] pr-11 pl-4 pt-3 bg-slate-50 border-none rounded-xl text-slate-900 placeholder-slate-300 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm resize-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2">
                        {!isModal && (
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`
                                w-full h-14 rounded-2xl font-black text-lg transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3
                                ${isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-blue-500/30 hover:shadow-blue-500/40'}
                            `}
                            >
                                {isSubmitting ? <LoadingSpinner size={24} /> : (
                                    <>
                                        <span>{direction === 'entry' ? 'אישור כניסה' : 'אישור יציאה'}</span>
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                                            {direction === 'entry' ? <LogOut className="rotate-180" size={18} /> : <LogOut size={18} />}
                                        </div>
                                    </>
                                )}
                            </button>
                        )}

                        <div className="flex flex-col gap-2 text-center mt-4 min-h-[20px]">
                            {direction === 'entry' && entryType === 'vehicle' && !match && plateInput.length >= 3 && !isExceptional && (
                                <p className="text-[10px] text-rose-600 font-black uppercase tracking-wider animate-pulse">
                                    * יש לסמן "אישור חריג" לרישום רכב לא רשום
                                </p>
                            )}
                            {direction === 'entry' && plateInput && !driverName && entryType === 'vehicle' && (
                                <p className="text-[10px] text-rose-500 font-black uppercase tracking-wider">
                                    * שם נהג הינו שדה חובה
                                </p>
                            )}
                            {isAlreadyInside && entryType === 'vehicle' && direction === 'entry' && (
                                <p className="text-[10px] text-blue-600 font-black uppercase tracking-wider">
                                    * שים לב: רכב זה כבר נמצא בבסיס
                                </p>
                            )}
                        </div>
                    </div>
                </form>
            </div>

            {!isModal && (
                <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100 text-blue-800 text-sm hidden lg:block">
                    <p className="flex items-center gap-2 font-bold mb-2">
                        <MapPin size={16} />
                        הנחיות לש.ג:
                    </p>
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>יש לבצע זיהוי ודאי לפני כניסה</li>
                        <li>עבור רכב צבאי - יש להזין צ'</li>
                        <li>בכל בעיה יש לפנות לקמב"ץ</li>
                    </ul>
                </div>
            )}
        </div>
    );

    // Auto-fill driver name if authorized vehicle matches
    React.useEffect(() => {
        if (match && entryType === 'vehicle') {
            setDriverName(match.owner_name);
        }
    }, [match, entryType]);

    // Fetch History Effect
    React.useEffect(() => {
        const loadHistory = async () => {
            setIsLoadingHistory(true);
            const { data, error } = await fetchGateHistory({
                search: historySearchTerm,
                startDate: historyStartDate,
                endDate: historyEndDate,
                limit: 100
            });

            if (error) console.error('Error fetching history:', error);
            if (data) setHistoryLogs(data);
            setIsLoadingHistory(false);
        };
        const debounce = setTimeout(loadHistory, 500);
        return () => clearTimeout(debounce);
    }, [historySearchTerm, historyStartDate, historyEndDate, fetchGateHistory, activeLogs, refreshTrigger]);

    const renderPedestrianOptions = () => {
        let lastOrg = '';
        let lastTeam = '';

        return filteredPedestrians.map((person) => {
            const showOrgHeader = person.orgName !== lastOrg;
            const showTeamHeader = person.teamName !== lastTeam || showOrgHeader;

            lastOrg = person.orgName;
            lastTeam = person.teamName;

            return (
                <React.Fragment key={person.id}>
                    {showOrgHeader && person.orgName && (
                        <div className="bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 border-b border-slate-200 sticky top-0">
                            {person.orgName}
                        </div>
                    )}
                    {showTeamHeader && person.teamName && (
                        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 border-b border-slate-100 pl-6">
                            {person.teamName}
                        </div>
                    )}
                    <div
                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm flex items-center gap-2 pl-4"
                        onClick={() => {
                            setPlateInput(person.name);
                            setDriverName(person.name);
                            setFilteredPedestrians([]);
                        }}
                    >
                        <User size={14} className="text-slate-400" />
                        <span className="font-medium text-slate-800">{person.name}</span>
                    </div>
                </React.Fragment>
            );
        });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <LoadingSpinner />
                <span className="mr-2 text-slate-500">טוען נתוני שער...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-slate-50/50">
            {/* Mobile-Only Premium Header */}
            <header className="md:hidden bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-4 pt-4 pb-4 shrink-0 transition-all">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            <ShieldCheck size={24} strokeWidth={2.5} />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">שער הכניסה</h1>
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">בקרת כניסה • ש.ג</span>
                        </div>
                    </div>

                    {/* Secondary Action (e.g. Refresh History) */}
                    <button
                        onClick={() => setRefreshTrigger(prev => prev + 1)}
                        className={`w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 active:scale-90 transition-all ${isLoadingHistory ? 'animate-spin' : ''}`}
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                {/* Premium Segmented Control (Mobile) */}
                <div className="flex items-center p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/50 h-14">
                    <button
                        onClick={() => setCurrentTab('control')}
                        className={`flex-1 flex items-center justify-center gap-2 h-full rounded-xl transition-all duration-300 ${currentTab === 'control' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                    >
                        <Car size={18} strokeWidth={currentTab === 'control' ? 2.5 : 2} />
                        <span className="text-sm">תנועה</span>
                    </button>
                    {canManageAuthorized && (
                        <button
                            onClick={() => setCurrentTab('authorized')}
                            className={`flex-1 flex items-center justify-center gap-2 h-full rounded-xl transition-all duration-300 ${currentTab === 'authorized' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                        >
                            <Settings size={18} strokeWidth={currentTab === 'authorized' ? 2.5 : 2} />
                            <span className="text-sm">ניהול</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Desktop Header (Preserved) */}
            <header className="hidden md:flex px-6 py-5 shrink-0 z-20 relative bg-white border-b border-slate-200/60">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="text-blue-600">
                            <ShieldCheck size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">בקרת כניסה - ש.ג</h1>
                            <p className="text-xs md:text-sm text-slate-500 font-medium">ניהול ורישום כניסות ויציאות</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-200/50 w-full md:w-auto">
                            <button
                                onClick={() => setCurrentTab('control')}
                                className={`flex-1 md:flex-none px-4 md:px-6 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${currentTab === 'control'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                            >
                                <Car size={16} strokeWidth={2.5} />
                                <span>תנועה</span>
                            </button>
                            {canManageAuthorized && (
                                <button
                                    onClick={() => setCurrentTab('authorized')}
                                    className={`flex-1 md:flex-none px-4 md:px-6 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${currentTab === 'authorized'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        }`}
                                >
                                    <Settings size={14} />
                                    <span>ניהול</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {currentTab === 'control' ? (
                    <div className="flex flex-col lg:flex-row h-full p-4 gap-4 animate-in fade-in duration-300">
                        {/* Desktop Sidebar Form */}
                        <aside className="hidden lg:flex w-full lg:w-1/3 flex-col gap-4 h-full overflow-y-auto pb-4">
                            {renderEntryForm()}
                        </aside>

                        {/* Mobile Form Modal */}
                        <Modal
                            isOpen={isReportModalOpen}
                            onClose={() => setIsReportModalOpen(false)}
                            title={
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                        {direction === 'entry' ? 'דיווח כניסה' : 'דיווח יציאה'}
                                    </h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className={`p-1 rounded-lg ${direction === 'entry' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                                            {direction === 'entry' ? <LogOut className="rotate-180" size={14} /> : <LogOut size={14} />}
                                        </div>
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {direction === 'entry' ? 'רישום כניסה בזמן אמת' : 'רישום יציאה מהבסיס'}
                                        </span>
                                    </div>
                                </div>
                            }
                            footer={
                                <Button
                                    type="submit"
                                    form="gate-entry-form"
                                    disabled={isSubmitting}
                                    className={`
                                        w-full h-12 rounded-xl font-black text-lg transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3
                                        ${isSubmitting ? 'bg-slate-100 text-slate-400' : 'bg-blue-600 text-white shadow-blue-500/30'}
                                    `}
                                >
                                    {isSubmitting ? <LoadingSpinner size={24} /> : (
                                        <>
                                            <span>{direction === 'entry' ? 'אישור כניסה' : 'אישור יציאה'}</span>
                                            <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                                                {direction === 'entry' ? <LogOut className="rotate-180" size={16} /> : <LogOut size={16} />}
                                            </div>
                                        </>
                                    )}
                                </Button>
                            }
                            size="lg"
                        >
                            <div className="pb-4">
                                {renderEntryForm(true)}
                            </div>
                        </Modal>

                        {/* History & Active List */}
                        <main className="flex-1 flex flex-col gap-4 overflow-hidden">
                            <div className="bg-white rounded-2xl flex flex-col flex-1 shadow-sm border border-slate-200/60 overflow-hidden">
                                {/* History Header - Premium Design */}
                                <div className="border-b border-slate-100 p-5 shrink-0 bg-white z-10 transition-all">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex flex-col">
                                            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                                <History className="text-blue-600" size={20} />
                                                היסטוריית תנועה
                                            </h2>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">דוחות אחרונים</span>
                                        </div>
                                        <div className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-black border border-blue-100 shadow-sm">
                                            {historyLogs.length} רשומות
                                        </div>
                                    </div>

                                    {/* Premium Search Bar */}
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                            <Search size={18} strokeWidth={2.5} />
                                        </div>
                                        <input
                                            type="text"
                                            value={historySearchTerm}
                                            onChange={(e) => setHistorySearchTerm(e.target.value)}
                                            placeholder="חיפוש לפי מספר רכב או שם..."
                                            className="block w-full h-12 pr-12 pl-4 bg-slate-50 border-none rounded-[1.25rem] text-slate-900 placeholder-slate-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-bold text-sm"
                                        />
                                    </div>
                                </div>

                                {/* List Content */}
                                <div className="flex-1 overflow-hidden flex flex-col relative">
                                    <GateHistoryList
                                        logs={historyLogs}
                                        isLoading={isLoadingHistory}
                                        onExit={handleRegisterExit}
                                    />
                                </div>
                            </div>
                        </main>
                    </div>
                ) : (
                    <div className="h-full px-4 md:px-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
                        <AuthorizedVehiclesContent className="h-full bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-200/60" />
                    </div>
                )}
            </div>

            {/* Premium Mobile FAB */}
            {currentTab === 'control' && (
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="md:hidden fixed bottom-28 left-6 w-16 h-16 bg-blue-600 text-white rounded-3xl shadow-[0_12px_40px_rgba(37,99,235,0.4)] hover:shadow-[0_12px_40px_rgba(37,99,235,0.6)] active:scale-90 transition-all flex items-center justify-center z-[100] group overflow-hidden"
                    aria-label="הוסף דיווח"
                >
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-700 to-blue-500 opacity-100 group-hover:scale-110 transition-transform" />
                    <Plus size={32} strokeWidth={3} className="relative z-10" />
                </button>
            )}
        </div>
    );
};
