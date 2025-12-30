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

    const myPerson = people.find(p =>
        p.userId === user?.id || (p as any).email === user?.email || (profile?.email && (p as any).email === profile.email)
    );

    useEffect(() => {
        if (myPerson) {
            logger.info('VIEW', 'Viewed Personal Roster', { personId: myPerson.id, category: 'navigation' });
        }
    }, [myPerson?.id]);

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
        <div className="max-w-5xl mx-auto space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-2 pb-10"> {/* Rule 5: Consistent rhythm */}

            {/* Premium Greeting Section (Mobile Optimized) */}
            <div className="px-4 md:px-0">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight">
                        {getGreeting()}, <span className="text-blue-600">{myPerson.name.split(' ')[0]}</span>
                    </h1>
                    <div className="flex items-center gap-3 text-slate-500 text-sm font-bold opacity-80 mt-1">
                        <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center border border-slate-100">
                            <Calendar size={14} className="text-blue-500" />
                        </div>
                        <span>{now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                        <span className="text-slate-300">|</span>
                        <span>{now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

                {/* Main Content Column */}
                <div className="flex-1 min-w-0 w-full space-y-6">

                    {/* Active Shift Card - Premium Glassmorphism */}
                    {activeShift && (
                        <div className="px-4 md:px-0">
                            <div
                                onClick={() => {
                                    logger.logClick('active_shift_card', 'HomePage');
                                    onNavigate('dashboard', activeShift.start);
                                }}
                                className="relative rounded-[2.5rem] p-6 md:p-10 cursor-pointer overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white/60 group transition-all bg-white/40 backdrop-blur-xl hover:scale-[1.01] active:scale-[0.99] active:duration-100" // Rule 2 & Interactive
                                role="button"
                                tabIndex={0}
                                aria-label={`משימה פעילה: ${activeShift.task?.name}`}
                            >
                                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100/50 rounded-full blur-3xl opacity-70 -translate-y-1/2 translate-x-1/2" aria-hidden="true"></div>
                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-500" aria-hidden="true"></div>

                                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                    <div className="flex items-center gap-6 w-full">
                                        <div className="w-20 h-20 bg-blue-600 rounded-[1.75rem] flex items-center justify-center shadow-xl shadow-blue-600/20 text-white shrink-0 rotate-3 group-hover:rotate-0 transition-transform">
                                            {activeShift.task?.icon && (AllIcons as any)[activeShift.task.icon] ?
                                                React.createElement((AllIcons as any)[activeShift.task.icon], { size: 36, strokeWidth: 2.5 }) : <Clock size={36} strokeWidth={2.5} />
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <span className="px-3 py-1 bg-green-500/10 text-green-600 text-[10px] uppercase font-black tracking-widest rounded-full flex items-center gap-1.5 border border-green-500/20">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                                    פעיל כעת
                                                </span>
                                                <h3 className="text-2xl md:text-3xl font-black truncate text-slate-800 tracking-tight">{activeShift.task?.name}</h3>
                                            </div>
                                            <div className="flex items-center gap-3 text-slate-600 text-base md:text-lg font-bold">
                                                <span className="flex items-center gap-2">
                                                    <Clock size={16} className="text-slate-400" />
                                                    {activeShift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {activeShift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Countdown Timer - Enhanced */}
                                    <div className="w-full md:w-auto flex flex-col items-center md:items-end bg-white/60 backdrop-blur shadow-sm rounded-2xl p-4 md:px-6 md:py-4 border border-slate-100/50 min-w-[180px]">
                                        <span className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-[0.2em]">נותר לסיום</span>
                                        <span className="font-mono text-3xl md:text-4xl font-black tracking-widest text-blue-700 tabular-nums">
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
                        </div>
                    )}

                    {!activeShift && (
                        <div className="px-4 md:px-0">
                            <div className="bg-white/80 backdrop-blur-xl rounded-[2rem] border border-slate-100 p-8 shadow-sm flex items-center gap-6">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 rotate-3 transition-transform hover:rotate-0">
                                    <Moon size={32} />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-slate-800">אין משמרת פעילה</h3>
                                    <p className="text-slate-500 font-bold opacity-70">מוזמן לנוח ולהתערנן עד למשימה הבאה.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* War Clock Widget Container */}
                    <div className="px-4 md:px-0">
                        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100/50 p-4 md:p-8 overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -z-10 translate-y-[-20%] translate-x-[-20%]" />
                            <WarClock myPerson={myPerson} teams={teams} roles={roles} />
                        </div>
                    </div>

                    {/* Upcoming Schedule Tiles */}
                    <div className="px-4 md:px-0 space-y-6">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-slate-100">
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100">
                                    <Clock size={20} strokeWidth={2.5} />
                                </div>
                                הלו"ז הקרוב
                            </h2>
                            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm leading-none">
                                {viewerDays} ימים
                            </span>
                        </div>

                        {upcomingShifts.length === 0 ? (
                            <div className="bg-white/60 backdrop-blur-sm rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm flex flex-col items-center">
                                <div className="w-20 h-20 bg-green-50 text-green-500 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl shadow-green-500/10 rotate-3 border border-white">
                                    <CheckCircle2 size={40} />
                                </div>
                                <h3 className="text-2xl font-black text-slate-800 mb-2">היומן שלך ריק!</h3>
                                <p className="text-slate-500 font-bold mb-8 max-w-[250px] mx-auto">איזה כיף, אין לך משמרות בשבוע הקרוב. זמן מעולה למילוי מצברים.</p>
                                <button
                                    onClick={() => {
                                        logger.logClick('empty_state_full_board', 'HomePage');
                                        onNavigate('dashboard');
                                    }}
                                    className="h-14 px-8 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-95"
                                >
                                    ללוח המלא
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
                                            onClick={() => {
                                                logger.logClick('upcoming_shift_card', 'HomePage');
                                                onNavigate('dashboard', shift.start);
                                            }}
                                            className="group flex h-24 items-center gap-4 bg-white rounded-3xl p-4 border border-slate-100 hover:border-blue-300 shadow-sm hover:shadow-xl transition-all cursor-pointer active:scale-[0.97]" // Rule 1 & Interactive
                                        >
                                            <div className={`w-16 h-full rounded-2xl flex flex-col items-center justify-center flex-shrink-0 border transition-colors ${isToday ? 'bg-blue-600 text-white border-blue-500 ring-4 ring-blue-50' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                                <span className={`text-[10px] font-black uppercase ${isToday ? 'opacity-100' : 'opacity-60'}`}>{dateLabel.slice(0, 3)}</span>
                                                <span className="text-2xl font-black leading-none mt-1">{shift.start.getDate()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0 py-1">
                                                <h4 className="font-black text-slate-800 text-lg truncate group-hover:text-blue-700 transition-colors uppercase tracking-tight">{shift.task?.name}</h4>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 font-bold mt-1 opacity-70">
                                                    <Clock size={14} />
                                                    {shift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                    <span className="text-slate-300">→</span>
                                                    {shift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                            <div className="h-10 w-2 rounded-full shadow-inner" style={{ backgroundColor: shift.task?.color || '#cbd5e1' }}></div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar Column - Optimized for Layout Stacking */}
                <div className="w-full lg:w-96 shrink-0 space-y-6 px-4 md:px-0">
                    <AnnouncementsWidget myPerson={myPerson} />

                    <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full blur-3xl -z-10 translate-y-[-30%] translate-x-[30%]" />

                        <h3 className="font-black text-slate-900 mb-6 text-center text-xl tracking-tight">סיכום שבועי</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-5 bg-indigo-50/50 backdrop-blur rounded-[2rem] border border-indigo-100 shadow-sm transition-all hover:shadow-indigo-100/50">
                                <span className="block text-4xl font-black text-indigo-600 mb-1">{myShifts.length}</span>
                                <span className="text-[10px] text-indigo-600/60 font-black uppercase tracking-widest leading-none">משימות</span>
                            </div>
                            <div className="text-center p-5 bg-blue-50/50 backdrop-blur rounded-[2rem] border border-blue-100 shadow-sm transition-all hover:shadow-blue-100/50">
                                <span className="block text-4xl font-black text-blue-600 mb-1">
                                    {myShifts.reduce((acc, curr) => acc + differenceInHours(curr.end, curr.start), 0)}
                                </span>
                                <span className="text-[10px] text-blue-600/60 font-black uppercase tracking-widest leading-none">שעות</span>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                logger.logClick('view_full_stats', 'HomePage');
                                onNavigate('stats');
                            }}
                            className="w-full mt-6 h-14 rounded-2xl bg-slate-900 text-white text-base font-black hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98] active:duration-100"
                        >
                            הדוח המלא שלי
                        </button>
                    </div>
                </div>
            </div>

            <ClaimProfileModal isOpen={showClaimModal} onClose={() => setShowClaimModal(false)} />
        </div>
    );
};