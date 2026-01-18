import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shift, TaskTemplate, Person, Team, Role, Absence, TeamRotation, HourlyBlockage } from '../../types';
import { WarClock } from '../scheduling/WarClock';
import { supabase } from '../../services/supabaseClient';
import { differenceInHours, addDays, isSameDay } from 'date-fns';
import { Clock, CalendarBlank as Calendar, CheckCircle as CheckCircle2, Moon, MagnifyingGlass as Search, UserCircle as UserCircle2, ChatCircleDots as MessageSquare } from '@phosphor-icons/react';
import * as AllIcons from '@phosphor-icons/react';
import { logger } from '../../services/loggingService';
import { ClaimProfileModal } from '../auth/ClaimProfileModal';
import { AnnouncementsWidget } from './AnnouncementsWidget';
import { LeaveForecastWidget } from './LeaveForecastWidget';

interface HomePageProps {
    shifts: Shift[];
    tasks: TaskTemplate[];
    people: Person[];
    teams: Team[];
    roles: Role[];
    absences: Absence[];
    teamRotations: TeamRotation[];
    hourlyBlockages: HourlyBlockage[];
    onNavigate: (view: any, date?: Date) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
    shifts, tasks, people, teams, roles,
    absences, teamRotations, hourlyBlockages,
    onNavigate
}) => {
    const { user, profile, organization } = useAuth();
    const [viewerDays, setViewerDays] = useState<number>(7);
    const [homeForecastDays, setHomeForecastDays] = useState<number>(30);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showClaimModal, setShowClaimModal] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Debugging Unlink Persistence - Removed to reduce noise
    const myPerson = people.find(p => p.userId === user?.id);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!organization) return;
            try {
                const { data, error } = await supabase
                    .from('organization_settings')
                    .select('viewer_schedule_days, home_forecast_days')
                    .eq('organization_id', organization.id)
                    .maybeSingle();

                if (data) {
                    setViewerDays(data.viewer_schedule_days || 7);
                    setHomeForecastDays(data.home_forecast_days || 30);
                }
            } catch (err) {
                console.error('Failed to fetch home settings', err);
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [organization]);

    if (!myPerson) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in zoom-in-95 duration-700 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mb-8 mx-auto rotate-3 shadow-emerald-100/50 shadow-xl border border-white">
                        <AllIcons.UserCircle size={56} className="text-emerald-600" weight="bold" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">מי אתה ברשימה?</h2>
                    <div className="space-y-6 text-lg text-slate-600 leading-relaxed mb-10">
                        <p>זהו צעד אחרון לפני שתוכל לראות את כל המידע שרלוונטי אליך.</p>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-inner">
                            <p className="font-medium text-slate-800">המערכת עדיין לא יודעת מי אתה מבין כל הלוחמים בפלוגה.</p>
                            <p className="text-sm mt-2 text-slate-500">על מנת שנוכל להציג לך את המשמרות, המשימות והסטטיסטיקות האישיות שלך, אנחנו צריכים שתחבר את המשתמש הנוכחי שלך לשם שלך ברשימת הפלוגה.</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowClaimModal(true)}
                        className="w-full sm:w-auto mx-auto px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 hover:-translate-y-1 flex items-center justify-center gap-3"
                    >
                        מצא את הפרופיל שלי
                        <Search size={24} weight="bold" />
                    </button>
                </div>
                <ClaimProfileModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} />
            </div>
        );
    }

    const now = new Date();
    const limitDate = addDays(now, viewerDays);
    const myShifts = shifts
        .filter(s => s.assignedPersonIds.includes(myPerson.id) && !s.isCancelled)
        .map(s => ({ ...s, start: new Date(s.startTime), end: new Date(s.endTime), task: tasks.find(t => t.id === s.taskId) }))
        .filter(s => s.start <= limitDate && s.end >= now)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    const activeShift = myShifts.find(s => s.start <= now && s.end >= now);
    const upcomingShifts = myShifts.filter(s => s.start > now);

    const getGreeting = () => {
        const hour = now.getHours();
        if (hour >= 5 && hour < 12) return 'בוקר טוב';
        if (hour >= 12 && hour < 18) return 'צהריים טובים';
        if (hour >= 18 && hour < 22) return 'ערב טוב';
        return 'לילה טוב';
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 min-h-[80vh] border border-slate-100 animate-in fade-in zoom-in-95 duration-500">
            {/* A. Header Section (Greeting & Date) */}
            <header className="mb-6 md:mb-8 flex flex-col gap-2">
                <h1 className="text-2xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                    {getGreeting()}, <span className="text-blue-600">{myPerson.name.split(' ')[0]}</span>
                </h1>
                <div className="flex items-center gap-3 text-slate-500 text-xs md:text-sm font-bold opacity-80">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-50 shadow-sm flex items-center justify-center border border-slate-100">
                        <Calendar size={14} className="text-blue-500" weight="bold" />
                    </div>
                    <span>{now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    <span className="text-slate-300">|</span>
                    <span>{now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </header>

            {/* B. The Grid of Widgets */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">

                {/* Right Column (Shift & Schedule & WarClock) - Primary Content */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Active Shift Card */}
                    {activeShift ? (
                        <div
                            onClick={() => {
                                logger.logClick('active_shift_card', 'HomePage');
                                onNavigate('dashboard', activeShift.start);
                            }}
                            className="relative rounded-[1.5rem] md:rounded-[2rem] p-5 md:p-10 cursor-pointer overflow-hidden shadow-2xl shadow-blue-900/5 ring-1 ring-slate-100 group transition-all bg-white hover:scale-[1.01] active:scale-[0.99] active:duration-100"
                            role="button"
                            tabIndex={0}
                            aria-label={`משימה פעילה: ${activeShift.task?.name}`}
                        >
                            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/80 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3" aria-hidden="true"></div>
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" aria-hidden="true"></div>

                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="flex items-center gap-6 w-full">
                                    <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600 rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-blue-600/20 text-white shrink-0 md:rotate-3 group-hover:rotate-0 transition-transform">
                                        {activeShift.task?.icon && (AllIcons as any)[activeShift.task.icon] ?
                                            React.createElement((AllIcons as any)[activeShift.task.icon], { size: 28, weight: "bold", className: "md:hidden" }) : <Clock size={28} weight="bold" className="md:hidden" />
                                        }
                                        {activeShift.task?.icon && (AllIcons as any)[activeShift.task.icon] ?
                                            React.createElement((AllIcons as any)[activeShift.task.icon], { size: 36, weight: "bold", className: "hidden md:block" }) : <Clock size={36} weight="bold" className="hidden md:block" />
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-black tracking-wider rounded-md flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 bg-green-600 rounded-full animate-pulse"></span>
                                                פעיל כעת
                                            </span>
                                        </div>
                                        <h3 className="text-xl md:text-3xl font-black truncate text-slate-900 tracking-tight leading-none mb-1">{activeShift.task?.name}</h3>
                                        <div className="flex items-center gap-2 text-slate-500 text-sm md:text-base font-bold">
                                            <Clock size={16} weight="bold" />
                                            {activeShift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {activeShift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>

                                <div className="w-full md:w-auto flex flex-col items-center md:items-end bg-slate-50 rounded-2xl p-4 min-w-[160px] border border-slate-100">
                                    <span className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-wider">נותר לסיום</span>
                                    <span className="font-mono text-3xl md:text-4xl font-black tracking-widest text-blue-600 tabular-nums">
                                        {(() => {
                                            const diff = activeShift.end.getTime() - currentTime.getTime();
                                            if (diff <= 0) return "00:00:00";
                                            const h = Math.floor(diff / (1000 * 60 * 60));
                                            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                            const s = Math.floor((diff % (1000 * 60)) / 1000);
                                            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2rem] border border-slate-100 p-5 md:p-8 flex items-center gap-4 md:gap-6 relative overflow-hidden">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-slate-100 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white rounded-xl md:rounded-2xl flex items-center justify-center text-slate-400 shadow-sm relative z-10">
                                <Moon size={24} weight="bold" className="md:hidden" />
                                <Moon size={32} weight="bold" className="hidden md:block" />
                            </div>
                            <div className="space-y-0.5 md:space-y-1 relative z-10">
                                <h3 className="text-lg md:text-xl font-black text-slate-800">אין משמרת פעילה</h3>
                                <p className="text-slate-500 text-xs md:text-base font-medium">זמן מעולה למילוי מצברים לקראת המשימה הבאה.</p>
                            </div>
                        </div>
                    )}

                    {/* War Clock Widget */}
                    <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 p-6 md:p-8 overflow-hidden relative">
                        <div className="relative z-10">

                            <WarClock myPerson={myPerson} teams={teams} roles={roles} />
                        </div>
                    </div>

                    {/* Leave Forecast Widget */}
                    <LeaveForecastWidget
                        myPerson={myPerson}
                        forecastDays={homeForecastDays}
                        onNavigate={onNavigate}
                        absences={absences}
                        teamRotations={teamRotations}
                        hourlyBlockages={hourlyBlockages}
                    />

                    {/* Upcoming Schedule */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
                                הלו"ז הקרוב
                            </h2>
                            <span className="text-[11px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full">
                                {viewerDays} ימים קדימה
                            </span>
                        </div>

                        {upcomingShifts.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-green-500">
                                    <CheckCircle2 size={32} weight="bold" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900">היומן ריק</h3>
                                <p className="text-slate-500">אין משמרות עתידיות לטווח הזמן שנבחר.</p>
                                <button
                                    onClick={() => onNavigate('dashboard')}
                                    className="mt-4 text-blue-600 font-bold text-sm hover:underline"
                                >
                                    עבור ללוח השיבוצים המלא
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {upcomingShifts.map((shift) => {
                                    const isToday = isSameDay(shift.start, now);
                                    const dateLabel = isToday ? 'היום' : isSameDay(shift.start, addDays(now, 1)) ? 'מחר' : shift.start.toLocaleDateString('he-IL', { weekday: 'long' });

                                    return (
                                        <div
                                            key={shift.id}
                                            onClick={() => onNavigate('dashboard', shift.start)}
                                            className="group flex h-24 items-center gap-4 bg-white rounded-2xl p-4 border border-slate-100 hover:border-blue-500/30 hover:shadow-lg transition-all cursor-pointer active:scale-[0.98]"
                                        >
                                            <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 border transition-colors ${isToday ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                <span className="text-[9px] font-black uppercase opacity-80">{dateLabel.slice(0, 3)}</span>
                                                <span className="text-xl font-black leading-none">{shift.start.getDate()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 text-base truncate mb-1">{shift.task?.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                                    {shift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="text-slate-300">&rarr;</span>
                                                    {shift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="h-8 w-1.5 rounded-full" style={{ backgroundColor: shift.task?.color || '#cbd5e1' }}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Left Column (Updates & Stats) - Secondary Content */}
                <div className="lg:col-span-1 space-y-6">
                    <AnnouncementsWidget myPerson={myPerson} />

                    <div className="bg-slate-50 rounded-[1.5rem] md:rounded-[2.5rem] p-6 md:p-8 border border-slate-100 relative overflow-hidden">
                        <h3 className="font-black text-slate-900 mb-4 md:mb-6 text-center text-base md:text-lg">סיכום שבועי</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl text-center shadow-sm border border-slate-100">
                                <span className="block text-2xl md:text-3xl font-black text-blue-600">{myShifts.length}</span>
                                <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase">משימות</span>
                            </div>
                            <div className="bg-white p-3 md:p-4 rounded-xl md:rounded-2xl text-center shadow-sm border border-slate-100">
                                <span className="block text-2xl md:text-3xl font-black text-blue-600">
                                    {myShifts.reduce((acc, curr) => acc + differenceInHours(curr.end, curr.start), 0)}
                                </span>
                                <span className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase">שעות</span>
                            </div>
                        </div>
                        <button
                            onClick={() => onNavigate('stats')}
                            className="w-full mt-6 py-3 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10"
                        >
                            צפה בדוח המלא
                        </button>
                    </div>
                </div>

            </div>

            <ClaimProfileModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} />
        </div>
    );
};