import React, { useMemo, useEffect, useState } from 'react';
import { Person, Shift, TaskTemplate, Role } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { useAuth } from '../contexts/AuthContext'; // NEW: Import useAuth
import { supabase } from '../services/supabaseClient'; // NEW: Import supabase
import {
    Clock, Calendar, Award, TrendingUp, Moon, Sun,
    ArrowRight, CheckCircle, AlertCircle
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

interface DetailedUserStatsProps {
    person: Person;
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    onBack: () => void;
    nightShiftStart?: string;
    nightShiftEnd?: string;
    showBackButton?: boolean; // NEW
}

export const DetailedUserStats: React.FC<DetailedUserStatsProps> = ({
    person,
    shifts,
    tasks,
    roles,
    onBack,
    nightShiftStart = '22:00',
    nightShiftEnd = '06:00',
    showBackButton = true // Default true
}) => {
    const { organization } = useAuth(); // NEW: Get organization
    const [viewerDaysLimit, setViewerDaysLimit] = useState(2); // NEW: Default 2 days

    // NEW: Load viewer days limit from organization settings
    useEffect(() => {
        if (organization?.id) {
            supabase
                .from('organization_settings')
                .select('viewer_schedule_days')
                .eq('organization_id', organization.id)
                .maybeSingle()
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error fetching viewer settings:', error);
                    }
                    if (data?.viewer_schedule_days) {
                        setViewerDaysLimit(data.viewer_schedule_days);
                    }
                });
        }
    }, [organization?.id]);

    const stats = useMemo(() => {
        // NEW: Calculate cutoff date based on viewer days limit
        const now = new Date();
        const cutoffDate = new Date(now);
        cutoffDate.setDate(now.getDate() + viewerDaysLimit - 1); // Include today + N days
        cutoffDate.setHours(23, 59, 59, 999); // End of the last allowed day

        const personShifts = shifts
            .filter(s => s.assignedPersonIds.includes(person.id))
            .filter(s => {
                const shiftStart = new Date(s.startTime);
                return shiftStart <= cutoffDate; // Show shifts up to cutoff date
            })
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        let totalHours = 0;
        let nightHours = 0;
        let totalLoad = 0;
        const weeklyHours = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat

        personShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            if (!task) return;

            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
            totalLoad += duration * task.difficulty;

            const start = new Date(shift.startTime);
            const day = start.getDay();
            weeklyHours[day] += duration;

            // Night Hours
            const end = new Date(shift.endTime);
            let current = new Date(start);

            const startHour = parseInt(nightShiftStart.split(':')[0]);
            const endHour = parseInt(nightShiftEnd.split(':')[0]);

            while (current < end) {
                const h = current.getHours();
                const isNight = startHour > endHour
                    ? (h >= startHour || h < endHour)
                    : (h >= startHour && h < endHour);

                if (isNight) nightHours += 1;
                current.setHours(current.getHours() + 1);
            }
        });

        return {
            totalHours,
            nightHours,
            dayHours: totalHours - nightHours,
            totalLoad,
            shiftCount: personShifts.length,
            weeklyHours: weeklyHours.map((h, i) => ({
                name: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'][i],
                hours: h
            })),
            shifts: personShifts
        };
    }, [person, shifts, tasks, nightShiftStart, nightShiftEnd, viewerDaysLimit]); // NEW: Add viewerDaysLimit

    const dayNightData = [
        { name: 'יום', value: stats.dayHours, color: '#fbbf24' },
        { name: 'לילה', value: stats.nightHours, color: '#6366f1' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-sm border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Top Section: Back Button + Avatar + Name */}
                    <div className="flex items-center gap-3 md:gap-6">
                        {showBackButton && (
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 flex-shrink-0"
                            >
                                <ArrowRight size={20} />
                            </button>
                        )}
                        {/* Avatar with Initials */}
                        <div
                            className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center text-lg md:text-2xl font-bold text-white shadow-md flex-shrink-0 ${person.color}`}
                        >
                            {getPersonInitials(person.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 truncate">{person.name}</h2>
                            <div className="flex flex-wrap items-center gap-2 text-slate-500 mt-1">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium">
                                    {(person.roleIds || []).map(id => roles.find(r => r.id === id)?.name).filter(Boolean).join(', ')}
                                </span>
                                <span className="text-xs md:text-sm">• {stats.shiftCount} משמרות</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats Section - Stacked on mobile */}
                    <div className="flex gap-4 justify-start md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                        <div className="text-right">
                            <p className="text-xs md:text-sm text-slate-500">סה"כ שעות</p>
                            <p className="text-xl md:text-2xl font-bold text-slate-800">{stats.totalHours}</p>
                        </div>
                        <div className="w-px bg-slate-200"></div>
                        <div className="text-right">
                            <p className="text-xs md:text-sm text-slate-500">עומס מצטבר</p>
                            <p className="text-xl md:text-2xl font-bold text-indigo-600">{stats.totalLoad}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Weekly Activity */}
                <div className="lg:col-span-2 bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-500" />
                        פעילות שבועית
                    </h3>
                    <div className="h-[200px] md:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.weeklyHours}>
                                <defs>
                                    <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
                                    cursor={{ stroke: '#3b82f6', strokeWidth: 2 }}
                                />
                                <Area type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Day/Night Distribution */}
                <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                        <Moon size={18} className="text-indigo-500" />
                        יום / לילה
                    </h3>
                    <div className="h-[180px] md:h-[220px] relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={dayNightData}
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {dayNightData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-bold text-slate-800">{stats.totalHours}</span>
                            <span className="text-xs text-slate-500">שעות</span>
                        </div>
                    </div>
                    <div className="flex justify-center gap-4 md:gap-6 mt-4">
                        {dayNightData.map(d => (
                            <div key={d.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                <span className="text-xs md:text-sm text-slate-600 font-bold">{d.name} ({d.value})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Task Breakdown Chart */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 md:mb-6 flex items-center gap-2">
                    <Award className="text-orange-500" size={18} />
                    התפלגות משימות
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 items-center">
                    <div className="h-[250px] md:h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={(() => {
                                        // Helper to convert Tailwind color class to hex
                                        const getColorFromClass = (colorClass: string): string => {
                                            const colorMap: Record<string, string> = {
                                                'border-l-blue-500': '#3b82f6',
                                                'border-l-green-500': '#22c55e',
                                                'border-l-red-500': '#ef4444',
                                                'border-l-yellow-500': '#eab308',
                                                'border-l-purple-500': '#a855f7',
                                                'border-l-pink-500': '#ec4899',
                                                'border-l-indigo-500': '#6366f1',
                                                'border-l-orange-500': '#f97316',
                                                'border-l-teal-500': '#14b8a6',
                                                'border-l-cyan-500': '#06b6d4',
                                            };
                                            return colorMap[colorClass] || colorClass;
                                        };

                                        const taskData = stats.shifts.reduce((acc: any[], shift) => {
                                            const task = tasks.find(t => t.id === shift.taskId);
                                            if (!task) return acc;
                                            const existing = acc.find(i => i.name === task.name);
                                            if (existing) {
                                                existing.value++;
                                            } else {
                                                acc.push({
                                                    name: task.name,
                                                    value: 1,
                                                    color: getColorFromClass(task.color)
                                                });
                                            }
                                            return acc;
                                        }, []);
                                        return taskData;
                                    })()}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {(() => {
                                        const getColorFromClass = (colorClass: string): string => {
                                            const colorMap: Record<string, string> = {
                                                'border-l-blue-500': '#3b82f6',
                                                'border-l-green-500': '#22c55e',
                                                'border-l-red-500': '#ef4444',
                                                'border-l-yellow-500': '#eab308',
                                                'border-l-purple-500': '#a855f7',
                                                'border-l-pink-500': '#ec4899',
                                                'border-l-indigo-500': '#6366f1',
                                                'border-l-orange-500': '#f97316',
                                                'border-l-teal-500': '#14b8a6',
                                                'border-l-cyan-500': '#06b6d4',
                                            };
                                            return colorMap[colorClass] || colorClass;
                                        };

                                        return stats.shifts.reduce((acc: any[], shift) => {
                                            const task = tasks.find(t => t.id === shift.taskId);
                                            if (!task) return acc;
                                            const existing = acc.find(i => i.name === task.name);
                                            if (existing) {
                                                existing.value++;
                                            } else {
                                                acc.push({
                                                    name: task.name,
                                                    value: 1,
                                                    color: getColorFromClass(task.color)
                                                });
                                            }
                                            return acc;
                                        }, []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ));
                                    })()}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        {(() => {
                            const getColorFromClass = (colorClass: string): string => {
                                const colorMap: Record<string, string> = {
                                    'border-l-blue-500': '#3b82f6',
                                    'border-l-green-500': '#22c55e',
                                    'border-l-red-500': '#ef4444',
                                    'border-l-yellow-500': '#eab308',
                                    'border-l-purple-500': '#a855f7',
                                    'border-l-pink-500': '#ec4899',
                                    'border-l-indigo-500': '#6366f1',
                                    'border-l-orange-500': '#f97316',
                                    'border-l-teal-500': '#14b8a6',
                                    'border-l-cyan-500': '#06b6d4',
                                };
                                return colorMap[colorClass] || colorClass;
                            };

                            return Array.from(new Set(stats.shifts.map(s => s.taskId))).map(taskId => {
                                const task = tasks.find(t => t.id === taskId);
                                if (!task) return null;
                                const count = stats.shifts.filter(s => s.taskId === taskId).length;
                                return (
                                    <div key={taskId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: getColorFromClass(task.color) }}></div>
                                        <div>
                                            <span className="block font-bold text-slate-700">{task.name}</span>
                                            <span className="text-xs text-slate-500">{count} ביצועים</span>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>
            </div>

            {/* Recent Shifts List */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Calendar size={18} className="text-purple-500" />
                    משמרות ({viewerDaysLimit} ימים קדימה)
                </h3>
                {stats.shifts.length === 0 ? (
                    <div className="text-center py-8 md:py-12 text-slate-400">
                        <Calendar size={36} className="md:hidden mx-auto mb-3 opacity-50" />
                        <Calendar size={48} className="hidden md:block mx-auto mb-3 opacity-50" />
                        <p className="font-medium text-sm md:text-base">אין משמרות בטווח הזמן</p>
                        <p className="text-xs md:text-sm mt-1">משמרות ב-{viewerDaysLimit} ימים הקרובים יופיעו כאן</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                        {stats.shifts.map(shift => {
                            const task = tasks.find(t => t.id === shift.taskId);
                            const start = new Date(shift.startTime);
                            const end = new Date(shift.endTime);
                            return (
                                <div key={shift.id} className="border border-slate-100 rounded-xl p-3 md:p-4 flex items-center gap-3 md:gap-4 hover:border-blue-200 transition-colors">
                                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${task?.difficulty && task.difficulty > 1.5 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                        {task?.difficulty && task.difficulty > 1.5 ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-slate-800 text-sm md:text-base truncate">{task?.name}</p>
                                        <p className="text-xs text-slate-500">
                                            {start.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })} • {start.getHours()}:{start.getMinutes().toString().padStart(2, '0')}-{end.getHours()}:{end.getMinutes().toString().padStart(2, '0')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
