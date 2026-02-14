import React, { useState, useEffect } from 'react';
import { Clock, MapPin, CheckCircle, Warning, NavigationArrow } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { OrganizationSettings, Person, DailyPresence, AuthorizedLocation } from '../../types';
import { reportAttendance, calculateDistance, findNearestLocation } from '../../services/attendanceReportService';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';

interface AttendanceReportingWidgetProps {
    myPerson: Person;
    settings: OrganizationSettings;
    plannedStatus?: string; // e.g., 'arrival', 'base', 'departure', 'home'
    onReported?: () => void;
    onRefreshData?: () => void;
}

export const AttendanceReportingWidget: React.FC<AttendanceReportingWidgetProps> = ({
    myPerson,
    settings,
    plannedStatus,
    onReported,
    onRefreshData
}) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [locationLoading, setLocationLoading] = useState(true);
    const [userLoc, setUserLoc] = useState<{ lat: number, lng: number } | null>(null);
    const [todayPresence, setTodayPresence] = useState<DailyPresence | null>(null);
    const [nearestLoc, setNearestLoc] = useState<{ location: AuthorizedLocation, distance: number } | null>(null);
    const [locationError, setLocationError] = useState<string | null>(null);

    const isReportingEnabled = settings.attendance_reporting_enabled;
    const authorizedLocations = settings.authorized_locations || [];

    useEffect(() => {
        if (!isReportingEnabled) return;

        fetchTodayPresence();
        trackLocation();

        // Subscribe to today's presence changes
        const channel = supabase.channel(`presence-${myPerson.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'daily_presence',
                filter: `person_id=eq.${myPerson.id}`
            }, () => {
                fetchTodayPresence();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [isReportingEnabled, myPerson.id]);

    const fetchTodayPresence = async () => {
        const todayIso = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('daily_presence')
            .select('*')
            .eq('person_id', myPerson.id)
            .eq('date', todayIso)
            .maybeSingle();

        if (data) {
            setTodayPresence(data);
        } else {
            setTodayPresence(null);
        }
    };

    const trackLocation = () => {
        if (!navigator.geolocation) {
            showToast('Geolocation is not supported by your browser', 'error');
            setLocationLoading(false);
            return;
        }

        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLoc(newLoc);
                const near = findNearestLocation(newLoc.lat, newLoc.lng, authorizedLocations);
                setNearestLoc(near);
                setLocationLoading(false);
                setLocationError(null);
            },
            (err) => {
                console.error('Location error:', err);
                setLocationLoading(false);
                if (err.code === 1) { // PERMISSION_DENIED
                    setLocationError('גישה למיקום נדחתה. אנא אפשר את המיקום בדפדפן.');
                } else if (err.code === 2) { // POSITION_UNAVAILABLE
                    setLocationError('המיקום אינו זמין כעת.');
                } else if (err.code === 3) { // TIMEOUT
                    setLocationError('זמן ההמתנה למיקום פג.');
                } else {
                    setLocationError('שגיאה בזיהוי מיקום.');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
    };

    const handleReport = async (type: 'arrival' | 'departure') => {
        if (!userLoc) {
            showToast('לא ניתן לזהות מיקום', 'error');
            return;
        }

        setLoading(true);
        const result = await reportAttendance(
            myPerson.id,
            myPerson.organization_id!,
            type,
            userLoc,
            authorizedLocations
        );

        if (result.success) {
            showToast(result.message, 'success');
            setTodayPresence(result.data!);
            onReported?.();
            onRefreshData?.();
        } else {
            showToast(result.message, 'error');
        }
        setLoading(false);
    };

    if (!isReportingEnabled) return null;

    const hasCheckedIn = !!todayPresence?.actual_arrival_at;
    const hasCheckedOut = !!todayPresence?.actual_departure_at;
    const canReport = nearestLoc !== null;

    // Check if check-out is planned
    const isPlannedDeparture = plannedStatus === 'departure' || plannedStatus === 'single_day';

    const getDisabledReason = () => {
        if (locationLoading) return "מזהה מיקום...";
        if (locationError) return locationError;
        if (!userLoc) return "ממתין לנתוני מיקום...";
        if (!canReport) return "הנך מחוץ לטווח הדיווח המורשה (צריך להיות בטווח של כ-100 מטר מהבסיס)";
        if (hasCheckedIn && !hasCheckedOut && !isPlannedDeparture) return "לא מתוכננת יציאה להיום";
        return "";
    };

    const disabledReason = getDisabledReason();

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden relative group"
        >
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="p-6 md:p-8 relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-colors ${canReport ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-slate-100 text-slate-400 shadow-none'}`}>
                            <Clock size={28} weight="bold" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">דיווח נוכחות</h3>
                            <div className="flex items-center gap-2 mt-1">
                                {locationLoading ? (
                                    <span className="text-xs text-slate-400 font-bold animate-pulse">מזהה מיקום...</span>
                                ) : nearestLoc ? (
                                    <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                                        <MapPin size={14} weight="fill" />
                                        זוהה בסיס: {nearestLoc.location.name}
                                    </span>
                                ) : (
                                    <span className="text-xs text-amber-500 font-bold flex items-center gap-1">
                                        <Warning size={14} weight="bold" />
                                        {locationError || "מחוץ לטווח הדיווח המורשה"}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        {!hasCheckedIn ? (
                            <Button
                                onClick={() => handleReport('arrival')}
                                isLoading={loading}
                                disabled={!canReport || loading}
                                variant="primary"
                                title={!canReport ? disabledReason : ""}
                                className={`w-full md:w-40 h-14 rounded-xl font-black text-lg shadow-xl hover:-translate-y-1 transition-all ${!canReport ? 'grayscale opacity-50' : 'shadow-blue-600/20'}`}
                                icon={CheckCircle}
                            >
                                כניסה
                            </Button>
                        ) : !hasCheckedOut ? (
                            <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                                <div className="px-4 py-2 bg-green-50 text-green-700 rounded-xl border border-green-100 flex items-center gap-2">
                                    <CheckCircle size={18} weight="bold" />
                                    <span className="font-bold text-sm">נכנסת ב- {new Date(todayPresence!.actual_arrival_at!).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="flex flex-col gap-1 w-full md:w-auto">
                                    <Button
                                        onClick={() => handleReport('departure')}
                                        isLoading={loading}
                                        disabled={!canReport || loading}
                                        variant="action"
                                        size="lg"
                                        className="bg-amber-500 hover:bg-amber-600 shadow-amber-500/20 w-full"
                                        icon={NavigationArrow}
                                        iconWeight="fill"
                                        title={disabledReason}
                                    >
                                        החתמת יציאה
                                    </Button>
                                    {!isPlannedDeparture && (
                                        <p className="text-[10px] text-amber-600 font-bold text-center">שים לב: לא מתוכננת יציאה להיום</p>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="px-6 py-4 bg-slate-50 text-slate-500 rounded-2xl border border-slate-100 flex flex-col md:flex-row items-center gap-4 w-full justify-center">
                                <div className="flex items-center gap-2">
                                    <CheckCircle size={24} weight="fill" className="text-green-500" />
                                    <div className="font-black text-sm text-slate-900">הדיווח היומי הושלם</div>
                                </div>
                                <div className="h-8 w-px bg-slate-200 hidden md:block" />
                                <div className="flex flex-col md:flex-row gap-3">
                                    <div className="flex flex-col text-center md:text-right">
                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">הגעה</span>
                                        <div className="text-xs font-black text-slate-700">
                                            {new Date(todayPresence!.actual_arrival_at!).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <div className="flex flex-col text-center md:text-right">
                                        <span className="text-[10px] font-bold text-amber-600 uppercase">יציאה</span>
                                        <div className="text-xs font-black text-slate-700">
                                            {new Date(todayPresence!.actual_departure_at!).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
