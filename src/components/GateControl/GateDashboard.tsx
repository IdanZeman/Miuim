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
        battalionPeople,
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
        if (!plateInput) {
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
            // Pedestrian Search (Hierarchical)
            const lowerInput = plateInput.toLowerCase();
            const matches = battalionPeople
                .filter(p => p.name.toLowerCase().includes(lowerInput))
                .map(p => {
                    const org = battalionOrganizations.find(o => o.id === p.organization_id);
                    const team = battalionTeams.find(t => t.id === p.team_id);
                    return { ...p, orgName: org?.name || '', teamName: team?.name || '' };
                })
                .sort((a, b) => {
                    // Sort by Org -> Team -> Name
                    if (a.orgName !== b.orgName) return a.orgName.localeCompare(b.orgName);
                    if (a.teamName !== b.teamName) return a.teamName.localeCompare(b.teamName);
                    return a.name.localeCompare(b.name);
                })
                .slice(0, 50);

            setFilteredPedestrians(matches);
            setFilteredDrivers([]);
        }
    }, [plateInput, authorizedVehicles, battalionPeople, entryType, battalionOrganizations, battalionTeams]);

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
        <div className={`flex flex-col gap-4 ${!isModal ? 'h-full' : ''}`}>
            {/* Entry/Exit Form Card */}
            <div className={`bg-white ${!isModal ? 'rounded-2xl p-5' : ''} overflow-visible relative z-10`}>
                {!isModal && (
                    <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                                {direction === 'entry' ? <LogOut className="rotate-180" size={18} /> : <LogOut size={18} />}
                            </div>
                            {direction === 'entry' ? 'דיווח כניסה' : 'דיווח יציאה'}
                        </h2>
                        {/* Type Toggle */}
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setEntryType('vehicle')}
                                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 ${entryType === 'vehicle' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="רכב"
                            >
                                <Car size={18} />
                                <span className="text-xs font-bold hidden md:inline">רכב</span>
                            </button>
                            <button
                                onClick={() => setEntryType('pedestrian')}
                                className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-2 ${entryType === 'pedestrian' ? 'bg-white shadow text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
                                title="הולך רגל"
                            >
                                <Footprints size={18} />
                                <span className="text-xs font-bold hidden md:inline">הולך רגל</span>
                            </button>
                        </div>
                    </div>
                )}

                {isModal && (
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                        <button
                            onClick={() => setEntryType('vehicle')}
                            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-bold ${entryType === 'vehicle' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                        >
                            <Car size={18} />
                            רכב
                        </button>
                        <button
                            onClick={() => setEntryType('pedestrian')}
                            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 font-bold ${entryType === 'pedestrian' ? 'bg-white shadow text-amber-600' : 'text-slate-400'}`}
                        >
                            <Footprints size={18} />
                            הולך רגל
                        </button>
                    </div>
                )}

                <form onSubmit={handleRegisterEntry} className="space-y-5">
                    {/* Direction Toggle */}
                    <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                        <button
                            type="button"
                            onClick={() => setDirection('entry')}
                            className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${direction === 'entry'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <LogOut className="rotate-180" size={16} />
                            כניסה
                        </button>
                        <button
                            type="button"
                            onClick={() => setDirection('exit')}
                            className={`py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${direction === 'exit'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                        >
                            <LogOut size={16} />
                            יציאה
                        </button>
                    </div>

                    {/* Identifier Input */}
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-600 mb-1">
                            {entryType === 'vehicle' ? 'מספר רכב' : 'שם מלא (סינון לפי הקלדה)'}
                        </label>
                        <Input
                            type="text"
                            value={plateInput}
                            onChange={(e) => setPlateInput(e.target.value)}
                            placeholder={entryType === 'vehicle' ? "הכנס מספר רכב..." : "הכנס שם לחיפוש..."}
                            className="text-lg font-bold tracking-wider text-center bg-blue-50 border-blue-200"
                            autoComplete="off"
                        />

                        {/* Autocomplete Dropdown (Pedestrians) */}
                        {entryType === 'pedestrian' && filteredPedestrians.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                                {renderPedestrianOptions()}
                            </div>
                        )}

                        {/* Autocomplete Dropdown (Vehicles - by Plate) */}
                        {entryType === 'vehicle' && filteredDrivers.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                                {filteredDrivers.map((vehicle) => (
                                    <div
                                        key={vehicle.id}
                                        className="p-2 hover:bg-blue-50 cursor-pointer text-sm flex justify-between items-center"
                                        onClick={() => {
                                            setDriverName(vehicle.owner_name);
                                            setPlateInput(vehicle.plate_number);
                                            setFilteredDrivers([]);
                                        }}
                                    >
                                        <span className="font-medium text-slate-800">{vehicle.owner_name}</span>
                                        <span className="text-slate-500 text-xs bg-slate-100 px-1.5 py-0.5 rounded font-bold">{vehicle.plate_number}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status Indicator (Vehicle Only) */}
                    {entryType === 'vehicle' && plateInput.length >= 3 && (
                        <div className="space-y-3">
                            <div className={`p-3 rounded-xl border flex items-center gap-3 transition-colors ${match
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : isLoading ? 'bg-slate-50 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}>
                                {isLoading ? <LoadingSpinner size={18} /> : (
                                    match ? <CheckCircle2 className="text-green-600" size={20} /> : <AlertTriangle className="text-amber-500" size={20} />
                                )}
                                <div className="flex-1">
                                    <p className="font-bold text-sm">
                                        {isLoading ? 'בודק...' : (match ? 'מורשה כניסה' : 'לא רשום במאגר')}
                                    </p>
                                    {match && (
                                        <p className="text-xs opacity-80">
                                            {match.is_permanent ? 'אישור קבוע' : 'אישור זמני'} • {match.owner_name}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {!match && !isLoading && (
                                <div className="space-y-2">
                                    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${isExceptional ? 'bg-amber-50 border-amber-200 shadow-sm' : 'bg-white border-slate-200 hover:border-amber-300'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isExceptional ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <AlertTriangle size={16} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-800 text-xs">אישור כניסה חריג</div>
                                            <div className="text-[10px] text-slate-500">דווח על כניסת רכב למרות שאינו במאגר</div>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                            checked={isExceptional}
                                            onChange={(e) => setIsExceptional(e.target.checked)}
                                        />
                                    </label>

                                    <Button
                                        type="button"
                                        variant="outline"
                                        fullWidth
                                        className="h-10 text-xs gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
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
                                    >
                                        <PlusCircle size={16} />
                                        אשר רכב ל-24 שעות
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Details Inputs */}
                    <div className="space-y-3">
                        {entryType === 'vehicle' && (
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-600 mb-1">שם הנהג</label>
                                <Input
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
                                    placeholder="חפש לפי שם נהג..."
                                    className="bg-slate-50"
                                    autoComplete="off"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">הערות</label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="הערות ש.ג (אופציונלי)..."
                                className="bg-slate-50"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Button
                            type="submit"
                            fullWidth
                            disabled={isSubmitting}
                            className="h-12 text-lg font-bold"
                        >
                            {isSubmitting ? <LoadingSpinner size={20} /> : (direction === 'entry' ? 'רשום כניסה' : 'רשום יציאה')}
                        </Button>

                        <div className="flex flex-col gap-1 text-center">
                            {direction === 'entry' && entryType === 'vehicle' && !match && plateInput.length >= 3 && !isExceptional && (
                                <p className="text-[11px] text-amber-600 font-bold animate-pulse">
                                    * יש לסמן "אישור כניסה חריג" כדי לרשום רכב לא מזוהה
                                </p>
                            )}
                            {direction === 'entry' && plateInput && !driverName && entryType === 'vehicle' && (
                                <p className="text-[11px] text-red-500 font-bold">
                                    * חובה להזין שם נהג
                                </p>
                            )}
                            {isAlreadyInside && entryType === 'vehicle' && direction === 'entry' && (
                                <p className="text-[11px] text-red-500 font-bold">
                                    * רכב זה כבר רשום כנמצא בבסיס
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
        <div className="flex flex-col h-full relative overflow-hidden">
            {/* Top Page Header */}
            <header className="px-6 py-5 shrink-0 z-20 relative">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
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
                        {/* Tab Switcher */}
                        <div className="flex p-1 bg-white rounded-xl shadow-sm w-full md:w-auto">
                            <button
                                onClick={() => setCurrentTab('control')}
                                className={`flex-1 md:flex-none px-4 md:px-6 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${currentTab === 'control'
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <RefreshCw size={14} className={currentTab === 'control' ? 'animate-spin-slow' : ''} />
                                <span className="hidden md:inline">דיווח</span>
                                <span className="md:hidden">דיווח</span>
                            </button>
                            {canManageAuthorized && (
                                <button
                                    onClick={() => setCurrentTab('authorized')}
                                    className={`flex-1 md:flex-none px-4 md:px-6 py-1.5 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${currentTab === 'authorized'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                        }`}
                                >
                                    <Settings size={14} />
                                    <span className="hidden md:inline">ניהול</span>
                                    <span className="md:hidden">ניהול</span>
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
                            title={direction === 'entry' ? 'דיווח כניסה' : 'דיווח יציאה'}
                            size="lg"
                        >
                            <div className="pb-4">
                                {renderEntryForm(true)}
                            </div>
                        </Modal>

                        {/* History & Active List */}
                        <main className="flex-1 flex flex-col gap-4 overflow-hidden">
                            <div className="bg-white rounded-2xl flex flex-col flex-1 shadow-sm border border-slate-200/60 overflow-hidden">
                                {/* History Header */}
                                <div className="border-b border-slate-100 p-4 shrink-0 bg-white z-10">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            <History className="text-blue-600" size={20} />
                                            היסטוריה ודוחות
                                        </h2>
                                        <div className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                            {historyLogs.length} רשומות
                                        </div>
                                    </div>

                                    {/* Search Filter */}
                                    <div className="relative">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <Input
                                            value={historySearchTerm}
                                            onChange={(e) => setHistorySearchTerm(e.target.value)}
                                            placeholder="חיפוש לפי מספר רכב, שם נהג או ארגון..."
                                            className="pr-10 bg-slate-50/50 border-slate-200 h-10 w-full focus:bg-white transition-all"
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
                    <div className="h-full px-6 py-2 animate-in fade-in slide-in-from-bottom-4 duration-300 overflow-y-auto">
                        <AuthorizedVehiclesContent className="h-full bg-white rounded-2xl p-6 shadow-sm border border-slate-200/60" />
                    </div>
                )}
            </div>

            {/* Mobile FAB */}
            {currentTab === 'control' && (
                <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="lg:hidden fixed bottom-24 left-6 w-16 h-16 bg-yellow-400 text-slate-900 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:bg-yellow-500 transition-all flex items-center justify-center z-[100] active:scale-95 shadow-yellow-400/40"
                    aria-label="הוסף דיווח"
                >
                    <Plus size={32} strokeWidth={3} />
                </button>
            )}
        </div>
    );
};
