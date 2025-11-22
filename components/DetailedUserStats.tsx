
import React, { useMemo } from 'react';
import { Person, Shift, TaskTemplate, Role } from '../types';
import {
    Clock, Calendar, Award, TrendingUp, Moon, Sun,
    ArrowLeft, CheckCircle, AlertCircle
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
}

export const DetailedUserStats: React.FC<DetailedUserStatsProps> = ({ person, shifts, tasks, roles, onBack, nightShiftStart = '22:00', nightShiftEnd = '06:00' }) => {

    const stats = useMemo(() => {
        const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id))
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        let totalHours = 0;
        let nightHours = 0;
        let totalLoad = 0;
        const weeklyHours = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat

        personShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            if (!task) return;

            const duration = task.durationHours;
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
    }, [person, shifts, tasks, nightShiftStart, nightShiftEnd]);

    const dayNightData = [
        { name: 'יום', value: stats.dayHours, color: '#fbbf24' },
        { name: 'לילה', value: stats.nightHours, color: '#6366f1' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-6">
                    <button
                        onClick={onBack}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white shadow-md"
                        style={{ backgroundColor: person.color }}>
                        {person.name.charAt(0)}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">{person.name}</h2>
                        <div className="flex items-center gap-2 text-slate-500">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-xs font-medium">
                                {person.roleIds.map(id => roles.find(r => r.id === id)?.name).filter(Boolean).join(', ')}
                            </span>
                            <span className="text-sm">• {stats.shiftCount} משמרות</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <p className="text-sm text-slate-500">סה"כ שעות</p>
                        <p className="text-2xl font-bold text-slate-800">{stats.totalHours}</p>
                    </div>
                    <div className="w-px bg-slate-200 h-12"></div>
                    <div className="text-right">
                        <p className="text-sm text-slate-500">עומס מצטבר</p>
                        <p className="text-2xl font-bold text-indigo-600">{stats.totalLoad}</p>
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Activity */}
                <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-blue-500" />
                        פעילות שבועית
                    </h3>
                    <div className="h-[300px]">
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
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <Moon size={20} className="text-indigo-500" />
                        יום / לילה
                    </h3>
                    <div className="h-[220px] relative">
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
                    <div className="flex justify-center gap-6 mt-4">
                        {dayNightData.map(d => (
                            <div key={d.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                <span className="text-sm text-slate-600 font-bold">{d.name} ({d.value})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Task Breakdown Chart */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Award className="text-orange-500" size={20} />
                    התפלגות משימות
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="h-[300px] w-full">
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
                    <div className="grid grid-cols-2 gap-4">
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
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Calendar size={20} className="text-purple-500" />
                    משמרות אחרונות
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {stats.shifts.map(shift => {
                        const task = tasks.find(t => t.id === shift.taskId);
                        const start = new Date(shift.startTime);
                        const end = new Date(shift.endTime);
                        return (
                            <div key={shift.id} className="border border-slate-100 rounded-xl p-4 flex items-center gap-4 hover:border-blue-200 transition-colors">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${task?.difficulty && task.difficulty > 1.5 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                    {task?.difficulty && task.difficulty > 1.5 ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                                </div>
                                <div>
                                    <p className="font-bold text-slate-800">{task?.name}</p>
                                    <p className="text-xs text-slate-500">
                                        {start.toLocaleDateString('he-IL')} • {start.getHours()}:{start.getMinutes().toString().padStart(2, '0')} - {end.getHours()}:{end.getMinutes().toString().padStart(2, '0')}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
