import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../features/auth/AuthContext';
import { CarpoolRide, Person, TeamRotation, Absence } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Car, Clock, CalendarBlank, Plus, User, ArrowRight, ArrowLeft, SteeringWheel, Trash } from '@phosphor-icons/react';
import { format, addDays, parseISO, differenceInHours, addHours, setHours, setMinutes } from 'date-fns';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { useTacticalDelete } from '../../hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '../../components/ui/TacticalDeleteWrapper';

interface CarpoolWidgetProps {
    myPerson?: Person;
}

export const CarpoolWidget: React.FC<CarpoolWidgetProps> = ({ myPerson }) => {
    const { organization } = useAuth();
    const { showToast } = useToast();
    const [rides, setRides] = useState<CarpoolRide[]>([]);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [showReminder, setShowReminder] = useState(false);
    const [upcomingShift, setUpcomingShift] = useState<{ type: 'departure' | 'arrival', time: Date } | null>(null);

    // Tactical Delete Hook
    const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
        async (rideId: string) => {
            const { error } = await supabase.from('carpool_rides').delete().eq('id', rideId);
            if (error) throw error;
            
            // Remove from local state immediately to prevent re-appearance
            setRides(prev => prev.filter(r => r.id !== rideId));
            showToast('הטרמפ נמחק בהצלחה', 'success');
        },
        1300 // Animation duration
    );

    // Schedule Data State
    const [teamRotations, setTeamRotations] = useState<TeamRotation[]>([]);
    const [absences, setAbsences] = useState<Absence[]>([]);
    const [scheduleLoaded, setScheduleLoaded] = useState(false);

    // Form State
    const [newRide, setNewRide] = useState<Partial<CarpoolRide>>({
        direction: 'to_base',
        date: new Date().toISOString().split('T')[0],
        time: '08:00',
        seats: 3
    });

    useEffect(() => {
        if (organization) {
            fetchRides();
        }
    }, [organization]);

    // 1. Fetch Schedule Data needed for calculation
    useEffect(() => {
        if (!organization || !myPerson) return;

        const fetchScheduleData = async () => {
            try {
                // Fetch Rotations
                const { data: rotationsData } = await supabase
                    .from('team_rotations')
                    .select('*')
                    .eq('organization_id', organization.id);

                // Fetch Absences for this person (optimized for recent/future)
                const { data: absenceData } = await supabase
                    .from('absences')
                    .select('*')
                    .eq('person_id', myPerson.id)
                    .gte('end_date', new Date(Date.now() - 86400000).toISOString().split('T')[0]);

                if (rotationsData) setTeamRotations(rotationsData);
                if (absenceData) setAbsences(absenceData);
                setScheduleLoaded(true);
            } catch (err) {
                console.error("Error fetching schedule data for widget:", err);
            }
        };

        fetchScheduleData();
    }, [organization, myPerson]);

    // 2. Calculate Upcoming Shift using getEffectiveAvailability
    useEffect(() => {
        if (!scheduleLoaded || !myPerson) return;

        const now = new Date();
        const LOOKAHEAD_DAYS = 4;
        const LOOKAHEAD_HOURS = 36;
        let foundShift: { type: 'departure' | 'arrival', time: Date } | null = null;

        for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
            const checkDate = addDays(now, i);
            const avail = getEffectiveAvailability(myPerson, checkDate, teamRotations, absences, []);

            const parseTime = (dateObj: Date, timeStr: string) => {
                if (!timeStr || !timeStr.includes(':')) return dateObj; // Safety fallback
                const [h, m] = timeStr.split(':').map(Number);
                return setMinutes(setHours(dateObj, h), m);
            };

            // Detect Departure
            if (avail.status === 'departure' || (avail.endHour && avail.endHour !== '23:59')) {
                const shiftTime = parseTime(checkDate, avail.endHour || '14:00');
                const hoursUntil = differenceInHours(shiftTime, now);

                if (hoursUntil >= -4 && hoursUntil <= LOOKAHEAD_HOURS) {
                    foundShift = { type: 'departure', time: shiftTime };
                    break;
                }
            }

            // Detect Arrival
            if (avail.status === 'arrival' || (avail.startHour && avail.startHour !== '00:00')) {
                const shiftTime = parseTime(checkDate, avail.startHour || '10:00');
                const hoursUntil = differenceInHours(shiftTime, now);

                if (hoursUntil >= -4 && hoursUntil <= LOOKAHEAD_HOURS) {
                    foundShift = { type: 'arrival', time: shiftTime };
                    break;
                }
            }

            // Detect Implicit Base -> Home Transition
            if (avail.status === 'base' || avail.status === 'full') {
                const nextDate = addDays(checkDate, 1);
                const nextAvail = getEffectiveAvailability(myPerson, nextDate, teamRotations, absences, []);

                if (nextAvail.status === 'home') {
                    if (!avail.endHour || avail.endHour === '23:59') {
                        // Default exit time assumption (16:00) if not specified
                        const shiftTime = parseTime(checkDate, '16:00');
                        const hoursUntil = differenceInHours(shiftTime, now);

                        if (hoursUntil >= -4 && hoursUntil <= LOOKAHEAD_HOURS) {
                            foundShift = { type: 'departure', time: shiftTime };
                            break;
                        }
                    }
                }
            }
        }

        setUpcomingShift(foundShift);

    }, [scheduleLoaded, myPerson, teamRotations, absences]);

    // Check if we should show the reminder based on upcoming shift
    useEffect(() => {
        if (!upcomingShift || !myPerson) {
            setShowReminder(false);
            return;
        }

        const shiftDateStr = format(upcomingShift.time, 'yyyy-MM-dd');
        const dismissedKey = `carpool_dismissed_${shiftDateStr}_${upcomingShift.type}`;

        const hasMyRide = rides.some(r =>
            r.creator_id === myPerson.id &&
            r.date === shiftDateStr &&
            ((upcomingShift.type === 'departure' && r.direction === 'to_home') ||
                (upcomingShift.type === 'arrival' && r.direction === 'to_base'))
        );

        if (hasMyRide) {
            setShowReminder(false);
            return;
        }

        // Only show if not previously dismissed/seen
        if (!localStorage.getItem(dismissedKey)) {
            setShowReminder(true);
        }
    }, [rides, upcomingShift, myPerson]);

    // Auto-mark as seen when shown (To prevent showing again on refresh)
    useEffect(() => {
        if (showReminder && upcomingShift) {
            const dismissedKey = `carpool_dismissed_${format(upcomingShift.time, 'yyyy-MM-dd')}_${upcomingShift.type}`;
            localStorage.setItem(dismissedKey, 'true');
        }
    }, [showReminder, upcomingShift]);

    const handleDismissReminder = () => {
        if (upcomingShift) {
            const dismissedKey = `carpool_dismissed_${format(upcomingShift.time, 'yyyy-MM-dd')}_${upcomingShift.type}`;
            localStorage.setItem(dismissedKey, 'true');
        }
        setShowReminder(false);
    }

    const handleReminderDrive = () => {
        if (upcomingShift) {
            setNewRide({
                direction: upcomingShift.type === 'departure' ? 'to_home' : 'to_base',
                date: format(upcomingShift.time, 'yyyy-MM-dd'),
                time: format(upcomingShift.time, 'HH:mm'),
                seats: 3,
                location: '',
                notes: ''
            });
            setIsAddModalOpen(true);
            handleDismissReminder();
        }
    }

    const handleReminderSearch = () => {
        setIsViewModalOpen(true);
        handleDismissReminder();
    }

    // --- DEBUG HELPER (Disabled/Commented for Production) ---
    /*
    const handleDebugSimulate = () => {
        const fakeTime = addHours(new Date(), 3);
        const type = 'departure';
        const dismissedKey = `carpool_dismissed_${fakeTime.getTime()}_${type}`;
        localStorage.removeItem(dismissedKey);
        setUpcomingShift({ type, time: fakeTime });
        setShowReminder(true); 
        showToast('מצב בדיקה מופעל', 'success');
    };
    */
    // ------------------------------------------

    const fetchRides = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('carpool_rides')
                .select('*')
                .eq('organization_id', organization?.id)
                .gte('date', today)
                .order('date', { ascending: true })
                .order('time', { ascending: true });

            if (error) throw error;
            setRides(data || []);
        } catch (error) {
            console.error('Error fetching carpool rides:', error);
        }
    };

    const handleAddRide = async () => {
        if (!myPerson || !organization) return;

        if (!newRide.location || !newRide.time || !newRide.date) {
            showToast('נא למלא את כל שדות החובה', 'error');
            return;
        }

        setIsLoading(true);
        try {
            const ridePayload: Partial<CarpoolRide> = {
                organization_id: organization.id,
                creator_id: myPerson.id,
                driver_name: myPerson.name,
                driver_phone: myPerson.phone || '',
                type: 'offer',
                direction: newRide.direction as 'to_base' | 'to_home',
                date: newRide.date,
                time: newRide.time,
                location: newRide.location,
                seats: Number(newRide.seats) || 3,
                notes: newRide.notes || '',
                created_at: new Date().toISOString()
            };

            const { error } = await supabase.from('carpool_rides').insert([ridePayload]);
            if (error) throw error;

            showToast('הטרמפ פורסם בהצלחה!', 'success');
            setIsAddModalOpen(false);
            fetchRides();
            setNewRide({
                direction: 'to_base',
                date: new Date().toISOString().split('T')[0],
                time: '08:00',
                seats: 3,
                location: '',
                notes: ''
            });

        } catch (error: any) {
            console.error('Error adding ride:', error);
            showToast('שגיאה בפרסום הטרמפ', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const getWhatsAppLink = (ride: CarpoolRide) => {
        const phone = ride.driver_phone?.replace(/\D/g, '') || '';
        if (!phone) return null;
        const internationalPhone = phone.startsWith('972') ? phone : `972${phone.startsWith('0') ? phone.slice(1) : phone}`;
        const directionText = ride.direction === 'to_base' ? 'לבסיס' : 'הביתה';
        const text = `היי ${ride.driver_name.split(' ')[0]}, ראיתי באפליקציה שאתה יוצא ${directionText} ב-${format(parseISO(ride.date), 'dd/MM')} בשעה ${ride.time} מ${ride.location}. נשאר מקום?`;
        return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(text)}`;
    };

    // Render a single ride card (Compact for widget, Detailed for Modal)
    const renderRideCard = (ride: CarpoolRide, isCompact = false) => {
        const isMyRide = ride.creator_id === myPerson?.id;
        const whatsAppLink = getWhatsAppLink(ride);
        const rideDate = parseISO(ride.date); // Safely parse ISO string YYYY-MM-DD

        return (
            <div 
                key={ride.id} 
                className={`bg-white border border-slate-100 rounded-2xl flex flex-col ${isCompact ? 'p-3' : 'p-4'} shadow-sm transition-all hover:shadow-md group ${isAnimating(ride.id) ? 'tactical-delete-animation' : ''}`}
                style={{
                    overflow: 'hidden',
                    transformOrigin: 'center',
                }}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${ride.direction === 'to_base' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                            {ride.direction === 'to_base' ? <ArrowRight size={16} weight="bold" /> : <ArrowLeft size={16} weight="bold" />}
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-400 block leading-none mb-0.5">
                                {ride.direction === 'to_base' ? 'נוסע לבסיס' : 'חוזר הביתה'}
                            </span>
                            <h4 className={`font-black text-slate-800 leading-tight ${isCompact ? 'text-sm' : 'text-base'}`}>
                                {ride.location}
                            </h4>
                        </div>
                    </div>
                    {isMyRide && !isCompact && (
                        <button 
                            onClick={() => handleTacticalDelete(ride.id)} 
                            className="text-rose-500 hover:text-rose-600 transition-colors p-1 hover:bg-rose-50 rounded-lg"
                            title="מחק טרמפ"
                        >
                            <Trash size={18} weight="bold" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-600 font-bold mb-3">
                    <div className="flex items-center gap-1">
                        <CalendarBlank size={14} className="text-slate-400" />
                        {format(rideDate, 'dd/MM')}
                    </div>
                    <div className="flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" />
                        {ride.time}
                    </div>
                    <div className="flex items-center gap-1">
                        <User size={14} className="text-slate-400" />
                        {ride.seats} מקומות
                    </div>
                </div>

                {ride.notes && !isCompact && (
                    <p className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg mb-3">
                        "{ride.notes}"
                    </p>
                )}

                <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500">{ride.driver_name}</span>

                    {!isMyRide && whatsAppLink ? (
                        <a
                            href={whatsAppLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[#25D366] hover:bg-[#1ebd59] text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors shadow-sm shadow-green-100"
                        >
                            {isCompact ? 'Message' : 'שלח הודעה'}
                        </a>
                    ) : (
                        <span className="text-[10px] text-slate-400 italic">
                            {isMyRide ? 'המודעה שלך' : ''}
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* --- HOME PAGE WIDGET --- */}
            <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] border border-slate-100 p-6 md:p-8 flex flex-col relative overflow-hidden">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="flex items-center gap-3">
                        {/* DEBUG BUTTON COMMENTED OUT 
                        <div 
                            onClick={handleDebugSimulate}
                            className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-100 transition-colors"
                        >
                            <Car size={20} weight="fill" />
                        </div>
                        */}
                        <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                            <Car size={20} weight="fill" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900 text-lg leading-none mb-1">לוח טרמפים</h3>
                            <p className="text-xs font-bold text-slate-400">הצטרף לנסיעה או הצע מקום</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 transition-all shadow-lg active:scale-95"
                    >
                        <Plus size={18} weight="bold" />
                    </button>
                </div>

                {rides.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/50">
                        <Car size={32} className="text-slate-300 mb-2" weight="duotone" />
                        <span className="text-sm font-bold text-slate-400">אין טרמפים זמינים כרגע</span>
                        <button onClick={() => setIsAddModalOpen(true)} className="text-xs text-indigo-600 font-black mt-1 hover:underline">
                            היה הראשון לפרסם!
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rides.slice(0, 3).map(ride => renderRideCard(ride, true))}

                        <button
                            onClick={() => setIsViewModalOpen(true)}
                            className="w-full py-2 text-xs font-black text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors mt-2"
                        >
                            צפה בכולם ({rides.length})
                        </button>
                    </div>
                )}
            </div>

            {/* --- ADD RIDE MODAL --- */}
            <GenericModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                title="פרסום טרמפ חדש"
                size="md"
            >
                <div className="space-y-4 p-4">
                    <div className="bg-indigo-50 p-3 rounded-xl flex items-center gap-3 text-indigo-800 text-sm">
                        <Car size={24} className="shrink-0" />
                        <span className="font-medium">אנא מלא את פרטי הנסיעה בצורה מדויקת כדי שחברים לצוות יוכלו להצטרף.</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={() => setNewRide({ ...newRide, direction: 'to_base' })}
                            className={`p-3 rounded-xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all ${newRide.direction === 'to_base' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                        >
                            <ArrowRight size={24} />
                            נוסע לבסיס
                        </button>
                        <button
                            onClick={() => setNewRide({ ...newRide, direction: 'to_home' })}
                            className={`p-3 rounded-xl border-2 font-bold text-sm flex flex-col items-center gap-2 transition-all ${newRide.direction === 'to_home' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-100 text-slate-400 hover:bg-slate-50'}`}
                        >
                            <ArrowLeft size={24} />
                            חוזר הביתה
                        </button>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">מאיפה / לאן?</label>
                        <Input
                            value={newRide.location || ''}
                            onChange={(e) => setNewRide({ ...newRide, location: e.target.value })}
                            placeholder={newRide.direction === 'to_base' ? "מאיפה יוצאים? (למשל: רכבת מרכז)" : "לאן נוסעים? (למשל: תל אביב)"}
                            className="w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">תאריך</label>
                            <Input
                                type="date"
                                value={newRide.date}
                                onChange={(e) => setNewRide({ ...newRide, date: e.target.value })}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">שעה</label>
                            <Input
                                type="time"
                                value={newRide.time}
                                onChange={(e) => setNewRide({ ...newRide, time: e.target.value })}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">מספר מקומות פנויים</label>
                        <Select
                            value={String(newRide.seats || 3)}
                            onChange={(val) => setNewRide({ ...newRide, seats: parseInt(val) })}
                            options={[1, 2, 3, 4, 5, 6].map(n => ({ value: String(n), label: `${n} מקומות` }))}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">הערות (אופציונלי)</label>
                        <Input
                            value={newRide.notes || ''}
                            onChange={(e) => setNewRide({ ...newRide, notes: e.target.value })}
                            placeholder="למשל: לא מעשן, יוצא בזמן..."
                            className="w-full"
                        />
                    </div>

                    <Button
                        onClick={handleAddRide}
                        disabled={isLoading}
                        className="w-full mt-4 font-black h-12 bg-slate-900 text-white"
                    >
                        {isLoading ? 'מפרסם...' : 'פרסם טרמפ'}
                    </Button>
                </div>
            </GenericModal>

            {/* --- VIEW ALL MODAL --- */}
            <GenericModal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title="לוח טרמפים"
                size="lg"
            >
                <div className="p-4 bg-slate-50 min-h-[60vh]">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-black text-slate-800">כל הטרמפים הזמינים</h2>
                        <Button onClick={() => { setIsViewModalOpen(false); setIsAddModalOpen(true); }} size="sm">
                            <Plus size={16} weight="bold" className="ml-2" />
                            הוסף טרמפ
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {rides.map(ride => renderRideCard(ride))
                        }
                        {rides.length === 0 && (
                            <div className="col-span-2 text-center py-12 text-slate-400">
                                לא נמצאו טרמפים נוספים
                            </div>
                        )}
                    </div>
                </div>
            </GenericModal>

            {/* --- REMINDER POPUP MODAL --- */}
            <GenericModal
                isOpen={showReminder && upcomingShift !== null}
                onClose={handleDismissReminder}
                title="תזכורת נסיעה 🚗"
                size="sm"
            >
                <div className="p-6">
                    <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-in zoom-in duration-300">
                        <SteeringWheel size={32} weight="fill" />
                    </div>

                    <h3 className="text-xl font-black text-slate-800 text-center mb-2">
                        {upcomingShift?.type === 'departure'
                            ? 'מתכנן לנסוע הביתה?'
                            : 'מתכנן לנסוע לבסיס?'
                        }
                    </h3>
                    <p className="text-center text-slate-500 mb-6">
                        {upcomingShift?.type === 'departure'
                            ? `ראיתי שאתה יוצא הביתה ב-${format(upcomingShift?.time || new Date(), 'HH:mm')}.`
                            : `ראיתי שאתה צריך להגיע לבסיס ב-${format(upcomingShift?.time || new Date(), 'HH:mm')}.`
                        }
                        <br />
                        איך אתה מתכנן להגיע?
                    </p>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleReminderDrive}
                            className="w-full py-4 rounded-xl bg-slate-900 text-white font-bold text-lg hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <Car size={24} weight="fill" />
                            אני נוהג / מציע טרמפ
                        </button>
                        <button
                            onClick={handleReminderSearch}
                            className="w-full py-4 rounded-xl border-2 border-slate-100 text-slate-700 font-bold text-lg hover:bg-slate-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <User size={24} weight="fill" />
                            מחפש טרמפ
                        </button>
                        <button
                            onClick={handleDismissReminder}
                            className="text-xs text-slate-400 font-medium hover:text-slate-600 mt-2"
                        >
                            לא רלוונטי / הסתר
                        </button>
                    </div>
                </div>
            </GenericModal>

            {/* Global Tactical Delete Styles */}
            <TacticalDeleteStyles />
        </>
    );
};
