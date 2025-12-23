import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Shift, TaskTemplate, Person, Team, Role } from '../types';
import { WarClock } from './WarClock';
import { supabase } from '../services/supabaseClient';
import { differenceInHours, addDays, isSameDay } from 'date-fns'; // You might need to install date-fns or use native Intl
import { Clock, Calendar, CheckCircle2, Moon } from 'lucide-react';
import * as AllIcons from 'lucide-react';
import { logger } from '../services/loggingService';

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
    const [viewerDays, setViewerDays] = useState<number>(7); // Default fallback
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Fetch Organization Settings
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

    // Find current user's person record
    const myPerson = people.find(p =>
        p.userId === user?.id || (p as any).email === user?.email || (profile?.email && (p as any).email === profile.email)
    );

    if (!myPerson) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in zoom-in duration-500">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                    <UserUnknownIcon size={48} className="text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">טרם חוברת לפרופיל אישי</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                    כדי לראות את המשמרות והמשימות שלך, עליך להיות מקושר לפרופיל במערכת.
                </p>
                <div className="flex gap-4">
                    <button
                        onClick={() => onNavigate('personnel')}
                        className="px-6 py-2 bg-blue-600 text-white rounded-full font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                    >
                        מצא את הפרופיל שלי
                    </button>
                    <button
                        onClick={() => onNavigate('contact')}
                        className="px-6 py-2 bg-white text-slate-700 border border-slate-200 rounded-full font-medium hover:bg-slate-50 transition-colors"
                    >
                        פנה למנהל
                    </button>
                </div>
            </div>
        );
    }

    // Filter Shifts
    const now = new Date();
    const limitDate = addDays(now, viewerDays);

    // Sort shifts: Active first, then upcoming
    const myShifts = shifts
        .filter(s => s.assignedPersonIds.includes(myPerson.id) && !s.isCancelled)
        .map(s => {
            const start = new Date(s.startTime);
            const end = new Date(s.endTime);
            const task = tasks.find(t => t.id === s.taskId);
            return { ...s, start, end, task };
        })
        .filter(s => s.start <= limitDate && s.end >= now) // Only show relevant ones (active or upcoming within limit)
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
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Hero */}
            {/* Header / Hero */}
            <div className="mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                    {getGreeting()}, <span className="text-blue-600">{myPerson.name.split(' ')[0]}</span>
                </h1>
                <p className="text-black flex items-center gap-2">
                    <Calendar size={16} />
                    <span>{now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </p>
            </div>

            {/* Active Shift Card - Compact Banner */}
            {activeShift ? (
                <div
                    onClick={() => onNavigate('dashboard', activeShift.start)}
                    className="bg-blue-600 rounded-2xl p-4 text-white shadow-lg shadow-blue-200 mb-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-blue-700 transition-all"
                >
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shrink-0">
                            {activeShift.task?.icon && (AllIcons as any)[activeShift.task.icon] ? (
                                React.createElement((AllIcons as any)[activeShift.task.icon], { size: 24, className: "text-white" })
                            ) : (
                                <Clock size={24} className="text-white" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.6)]"></span>
                                <h3 className="text-lg font-bold truncate leading-tight">{activeShift.task?.name}</h3>
                            </div>
                            <p className="text-blue-100 text-sm font-medium flex items-center gap-2">
                                <span>{activeShift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {activeShift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="w-1 h-1 bg-blue-300 rounded-full"></span>
                                <span className="font-mono">
                                    {(() => {
                                        const diff = activeShift.end.getTime() - currentTime.getTime();
                                        if (diff <= 0) return "00:00";
                                        const h = Math.floor(diff / (1000 * 60 * 60));
                                        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                        return `${h}:${m.toString().padStart(2, '0')}`;
                                    })()} נותר
                                </span>
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white border border-slate-100 p-4 rounded-2xl flex items-center gap-4 shadow-sm mb-6">
                    <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 shrink-0">
                        <Moon size={20} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">אין משמרת פעילה</h3>
                        <p className="text-xs text-slate-500">זמן לנוח.</p>
                    </div>
                </div>
            )}

            {/* War Clock / Daily Schedule */}
            <div className="mb-8 animate-in slide-in-from-bottom-2 duration-700 delay-100">
                <WarClock myPerson={myPerson} teams={teams} roles={roles} />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Available Tasks / Next Up */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Clock className="text-blue-500" size={24} />
                            הלו"ז הקרוב שלך
                        </h2>
                        <span className="text-sm text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                            מציג {viewerDays} ימים קדימה
                        </span>
                    </div>

                    {myShifts.length === 0 ? (
                        <div className="bg-white rounded-3xl p-10 text-center border-2 border-slate-50 shadow-sm flex flex-col items-center">
                            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4 text-green-500">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800 mb-1">היומן שלך ריק!</h3>
                            <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">
                                אין לך משמרות או משימות בשבוע הקרוב. זמן מעולה לנוח ולצבור כוחות.
                            </p>
                            <button onClick={() => onNavigate('dashboard')} className="text-blue-600 font-medium text-sm hover:underline">
                                עבור ללוח השיבוצים המלא
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {upcomingShifts.length === 0 && !activeShift && (
                                <p className="text-slate-500">אין משימות עתידיות בטווח הזמן המוגדר.</p>
                            )}

                            {/* Active Shift Card (Detailed) */}
                            {/* Active Shift Card - Removed from here as it is now at the top */}


                            {/* Upcoming List */}
                            {upcomingShifts.map((shift, idx) => {
                                const isToday = isSameDay(shift.start, now);
                                const isTomorrow = isSameDay(shift.start, addDays(now, 1));
                                const dateLabel = isToday ? 'היום' : isTomorrow ? 'מחר' : shift.start.toLocaleDateString('he-IL', { weekday: 'long' });

                                return (
                                    <div
                                        key={shift.id}
                                        onClick={() => onNavigate('dashboard', shift.start)}
                                        className="group flex items-center gap-4 bg-white rounded-2xl p-4 border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-pointer"
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center flex-shrink-0 ${isToday ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'}`}>
                                            <span className="text-xs font-bold">{dateLabel}</span>
                                            <span className="text-lg font-bold leading-none">{shift.start.getDate()}</span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 truncate text-lg">{shift.task?.name}</h4>
                                            <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
                                                <span className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100 text-xs">
                                                    <Clock size={12} />
                                                    {shift.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                    {' - '}
                                                    {shift.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-xs">
                                                    משך: {differenceInHours(shift.end, shift.start)} שעות
                                                </span>
                                            </div>
                                        </div>

                                        <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: shift.task?.color || '#cbd5e1' }}></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sidebar Stats / Info */}
                <div className="space-y-6">
                    {/* Quick Stats */}
                    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
                        <h3 className="font-bold text-slate-800 mb-4 text-center">סטטיסטיקה שבועית</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <span className="block text-2xl font-bold text-indigo-600">
                                    {myShifts.length}
                                </span>
                                <span className="text-xs text-indigo-800 font-medium">משמרות קרובות</span>
                            </div>
                            <div className="text-center p-3 bg-orange-50 rounded-2xl border border-orange-100">
                                <span className="block text-2xl font-bold text-orange-600">
                                    {myShifts.reduce((acc, curr) => acc + differenceInHours(curr.end, curr.start), 0)}
                                </span>
                                <span className="text-xs text-orange-800 font-medium">שעות לו"ז</span>
                            </div>
                        </div>
                        <div className="mt-6 pt-4 border-t border-slate-50">
                            <button
                                onClick={() => onNavigate('stats')}
                                className="w-full py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900 transition-colors shadow-lg shadow-slate-200"
                            >
                                צפה בדוח המלא שלך
                            </button>
                        </div>
                    </div>

                    {/* Team Status (Mini) */}
                    {/* Maybe show who is on shift from my team? Cool feature. */}
                </div>
            </div>
        </div>
    );
};

// Helper Icon
const UserUnknownIcon = ({ size, className }: { size: number, className: string }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
    </svg>
);
