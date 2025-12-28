import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shift, TaskTemplate, Person, Team, Role } from '../../types';
import { WarClock } from '../scheduling/WarClock';
import { supabase } from '../../services/supabaseClient';
import { differenceInHours, addDays, isSameDay } from 'date-fns';
import { Clock, Calendar, CheckCircle2, Moon, Search, UserCircle2, MessageSquare } from 'lucide-react';
import * as AllIcons from 'lucide-react';
import { logger } from '../../services/loggingService';
import { ClaimProfileModal } from '../auth/ClaimProfileModal';
import { AnnouncementsWidget } from './AnnouncementsWidget';

interface HomePageProps {
    shifts: Shift[];
    tasks: TaskTemplate[];
    people: Person[];
    teams: Team[];
    roles: Role[];
    onNavigate: (view: any, date?: Date) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ shifts, tasks, people, teams, roles, onNavigate }) => {
    const { user, profile, organization } = useAuth();
    const [viewerDays, setViewerDays] = useState<number>(7);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showClaimModal, setShowClaimModal] = useState(false);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!organization) return;
            try {
                const { data, error } = await supabase
                    .from('organization_settings')
                    .select('viewer_schedule_days')
                    .eq('organization_id', organization.id)
                    .maybeSingle();

                if (data) {
                    setViewerDays(data.viewer_schedule_days || 7);
                }
            } catch (err) {
                console.error('Failed to fetch home settings', err);
            } finally {
                setLoadingSettings(false);
            }
        };
        fetchSettings();
    }, [organization]);

    const myPerson = people.find(p =>
        p.userId === user?.id || (p as any).email === user?.email || (profile?.email && (p as any).email === profile.email)
    );

    if (!myPerson) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center animate-in fade-in zoom-in-95 duration-700 bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-50 translate-y-1/2 -translate-x-1/2"></div>

                <div className="relative z-10 max-w-2xl mx-auto">
                    <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center mb-8 mx-auto rotate-3 shadow-emerald-100/50 shadow-xl border border-white">
                        <AllIcons.UserCircle2 size={56} className="text-emerald-600" />
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
                        className="w-full sm:w-auto px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-500 transition-all shadow-xl shadow-emerald-600/20 hover:-translate-y-1 flex items-center justify-center gap-3"
                    >
                        מצא את הפרופיל שלי
                        <Search size={24} />
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
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-safe-top">

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

                {/* Main Content Column */}
                <div className="flex-1 min-w-0 w-full space-y-6">

                    {/* Active Shift Card */}
                    <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-6 md:p-8 relative overflow-hidden transition-all">
                        <div className="mb-6 relative z-10">
                            <h1 className="text-2xl md:text-4xl font-black text-slate-900 mb-1">
                                {getGreeting()}, <span className="text-blue-600">{myPerson.name.split(' ')[0]}</span>
                            </h1>
                            <p className="text-slate-600 flex items-center gap-2 text-sm font-bold opacity-70">
                                <Calendar size={14} aria-hidden="true" />
                                <span>{now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                            </p>
                        </div>

                        {activeShift ? (
                            <div
                                onClick={() => onNavigate('dashboard', activeShift.start)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate('dashboard', activeShift.start); } }}
                                className="relative rounded-2xl p-6 md:p-8 cursor-pointer overflow-hidden shadow-sm hover:shadow-md border border-slate-100 group transition-all bg-white"
                                role="button"
                                tabIndex={0}
                                aria-label={`משימה פעילה: ${activeShift.task?.name}`}
                            >
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/2" aria-hidden="true"></div>
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500" aria-hidden="true"></div>

                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-5 w-full">
                                        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 text-blue-600 shrink-0">
                                            {activeShift.task?.icon && (AllIcons as any)[activeShift.task.icon] ?
                                                React.createElement((AllIcons as any)[activeShift.task.icon], { size: 30 }) : <Clock size={30} />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_0_3px_rgba(34,197,94,0.15)]"></span>
                                                <h3 className="text-xl md:text-2xl font-bold truncate text-slate-800">{activeShift.task?.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-500 text-sm md:text-base font-medium">
                                                <span className="bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-slate-400" />
                                                    {activeShift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {activeShift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Countdown Timer */}
                                    <div className="w-full md:w-auto flex flex-col items-center md:items-end bg-slate-50 rounded-xl p-3 border border-slate-100 min-w-[200px]">
                                        <span className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-wider">נותר למשמרת</span>
                                        <span className="font-mono text-2xl md:text-3xl font-bold tracking-widest text-slate-700 tabular-nums">
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
                            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                                    <Moon size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800">אין משמרת פעילה</h3>
                                    <p className="text-sm text-slate-500">זה זמן מצוין לנוח ולצבור כוחות.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* War Clock Widget */}
                    <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-4 md:p-6 overflow-hidden">
                        <WarClock myPerson={myPerson} teams={teams} roles={roles} />
                    </div>

                    {/* Upcoming Schedule */}
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Clock className="text-blue-500" size={24} />
                                הלו"ז הקרוב שלך
                            </h2>
                            <span className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                מציג {viewerDays} ימים קדימה
                            </span>
                        </div>

                        {upcomingShifts.length === 0 ? (
                            <div className="bg-white rounded-3xl p-10 text-center border-2 border-slate-50 shadow-sm flex flex-col items-center">
                                <CheckCircle2 size={48} className="text-green-500 mb-4" />
                                <h3 className="text-lg font-bold text-slate-800 mb-1">היומן שלך ריק!</h3>
                                <p className="text-slate-500 text-sm mb-6">אין לך משמרות בשבוע הקרוב. זמן מעולה לנוח.</p>
                                <button onClick={() => onNavigate('dashboard')} className="text-blue-600 font-medium hover:underline">ללוח המלא</button>
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
                                            className="group flex items-center gap-4 bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-md transition-all cursor-pointer"
                                        >
                                            <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border ${isToday ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600'}`}>
                                                <span className="text-[10px] font-bold opacity-80">{dateLabel}</span>
                                                <span className="text-xl font-bold leading-none">{shift.start.getDate()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-slate-900 truncate group-hover:text-blue-700">{shift.task?.name}</h4>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                    <Clock size={12} />
                                                    {shift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {shift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="h-10 w-1.5 rounded-full" style={{ backgroundColor: shift.task?.color || '#cbd5e1' }}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Column */}
                <div className="w-full lg:w-80 shrink-0 space-y-6">
                    <AnnouncementsWidget myPerson={myPerson} />
                    <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 text-center">סטטיסטיקה שבועית</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="text-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <span className="block text-2xl font-bold text-indigo-600">{myShifts.length}</span>
                                <span className="text-xs text-indigo-800 font-medium">משמרות</span>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded-2xl border border-orange-100">
                                <span className="block text-2xl font-bold text-orange-600">
                                    {myShifts.reduce((acc, curr) => acc + differenceInHours(curr.end, curr.start), 0)}
                                </span>
                                <span className="text-xs text-orange-800 font-medium">שעות</span>
                            </div>
                        </div>
                        <button onClick={() => onNavigate('stats')} className="w-full mt-4 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-colors">צפה בדוח המלא</button>
                    </div>
                </div>
            </div>

            <ClaimProfileModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} />
        </div>
    );
};