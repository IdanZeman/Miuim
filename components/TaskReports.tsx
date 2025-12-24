
import React, { useEffect, useState } from 'react';
import { Person, Shift, TaskTemplate, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, CalendarCheck, UserCircle, BarChart2, Moon, Search, ClipboardList } from 'lucide-react';
import { PersonalStats } from './PersonalStats';
import { DetailedUserStats } from './DetailedUserStats';
import { supabase } from '../services/supabaseClient';
import { Input } from './ui/Input';

interface TaskReportsProps {
    people: Person[];
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    isViewer?: boolean;
    currentUserEmail?: string;
    currentUserName?: string;
}

export const TaskReports: React.FC<TaskReportsProps> = ({ people, shifts, tasks, roles, isViewer = false, currentUserEmail, currentUserName }) => {
    const [viewMode, setViewMode] = useState<'overview' | 'personal'>('overview');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [nightShiftStart, setNightShiftStart] = useState('22:00');
    const [nightShiftEnd, setNightShiftEnd] = useState('06:00');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('organization_settings')
                .select('*')
                .maybeSingle();

            if (data) {
                setNightShiftStart(data.night_shift_start.slice(0, 5));
                setNightShiftEnd(data.night_shift_end.slice(0, 5));
            }
        };
        fetchSettings();
    }, []);

    // Viewer Restriction Logic
    useEffect(() => {
        if (isViewer) {
            setViewMode('personal');
            const person = people.find(p => p.name === currentUserName || (p as any).email === currentUserEmail);
            if (person) {
                setSelectedPersonId(person.id);
            }
        }
    }, [isViewer, currentUserName, currentUserEmail, people]);

    const loadData = people.map(person => {
        const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id));
        const totalHours = personShifts.reduce((acc, shift) => {
            const task = tasks.find(t => t.id === shift.taskId);
            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            return acc + duration;
        }, 0);

        return {
            name: person.name.split(' ')[0],
            hours: totalHours,
        };
    });

    const totalSlots = shifts.reduce((acc, s) => {
        const task = tasks.find(t => t.id === s.taskId);
        return acc + (task?.requiredPeople || 1);
    }, 0);
    const filledSlots = shifts.reduce((acc, s) => acc + s.assignedPersonIds.length, 0);

    const coverageData = [
        { name: 'מאויש', value: filledSlots, color: '#34d399' },
        { name: 'חסר', value: Math.max(0, totalSlots - filledSlots), color: '#fcd34d' },
    ];

    return (
        <div className="bg-transparent pb-20">
            {/* Standard White Header - Non-sticky for dashboard */}
            <div className="bg-white pb-6 pt-2 border-b border-slate-100">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-slate-800 text-xl font-bold flex items-center gap-2">
                            <ClipboardList className="text-emerald-500" />
                            דוחות משימה
                        </h2>

                        {/* Tab Switcher */}
                        <div className="bg-slate-100 p-1 rounded-lg flex border border-slate-200">
                            <button
                                onClick={() => setViewMode('overview')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'overview' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                מבט על
                            </button>
                            <button
                                onClick={() => setViewMode('personal')}
                                className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'personal' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                מבט אישי
                            </button>
                        </div>
                    </div>

                    {/* Search (Only in Personal Mode) */}
                    {viewMode === 'personal' && !isViewer && (
                        <div className="bg-slate-50 rounded-xl p-1 border border-slate-200">
                            <Input
                                placeholder="חפש חייל..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                icon={Search}
                                className="bg-transparent border-none text-slate-800 placeholder-slate-400 focus:ring-0"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="py-6 space-y-6">
                {viewMode === 'overview' ? (
                    <div className="space-y-6">
                        {/* Horizontal Bar Chart */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">עומס שעות מצטבר</h3>
                            <div className="overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                                <div className="space-y-3 pt-2">
                                    {loadData.map((data, index) => {
                                        const maxHours = Math.max(...loadData.map(d => d.hours), 1);
                                        const percentage = Math.min(100, Math.max(2, (data.hours / maxHours) * 100));

                                        return (
                                            <div key={index} className="flex items-center gap-3">
                                                {/* Name */}
                                                <div className="w-24 shrink-0 text-sm font-bold text-slate-700 text-right truncate" title={data.name}>
                                                    {data.name}
                                                </div>

                                                {/* Bar */}
                                                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${data.hours > 100 ? 'bg-red-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>

                                                {/* Value */}
                                                <div className="w-10 shrink-0 text-xs font-bold text-slate-500 text-left">
                                                    {Math.round(data.hours)} ש'
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Compact Gauge/Donut */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-2">סטטוס איוש</h3>
                            <div className="h-[200px] w-full"> {/* Reduced Height */}
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={coverageData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {coverageData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-6">
                                {coverageData.map(d => (
                                    <div key={d.name} className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-sm text-slate-600 font-bold">{d.name} ({d.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Advanced Stats: Night Leaders (Adapted) */}
                        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                            <div className="p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                <Moon className="text-indigo-500" size={18} />
                                <h3 className="font-bold text-indigo-900">שיאני לילה</h3>
                            </div>
                            <div className="divide-y divide-slate-50">
                                {people.map(person => {
                                    const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id));
                                    let nightHours = 0;
                                    personShifts.forEach(shift => {
                                        const start = new Date(shift.startTime);
                                        const end = new Date(shift.endTime);
                                        let current = new Date(start);
                                        const startHour = parseInt(nightShiftStart.split(':')[0]);
                                        const endHour = parseInt(nightShiftEnd.split(':')[0]);
                                        while (current < end) {
                                            const h = current.getHours();
                                            const isNight = startHour > endHour ? (h >= startHour || h < endHour) : (h >= startHour && h < endHour);
                                            if (isNight) nightHours++;
                                            current.setHours(current.getHours() + 1);
                                        }
                                    });
                                    return { person, nightHours };
                                })
                                    .sort((a, b) => b.nightHours - a.nightHours)
                                    .slice(0, 3)
                                    .map((item, index) => (
                                        <div key={item.person.id} className="p-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-bold text-slate-400 w-4">{index + 1}</span>
                                                <span className="font-bold text-slate-700">{item.person.name}</span>
                                            </div>
                                            <span className="font-bold text-indigo-600">{item.nightHours} ש'</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Personal Mode - List */
                    <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 divide-y divide-slate-100/50">
                        {selectedPersonId ? ( // Keep legacy view capability if needed, but mainly use list
                            <DetailedUserStats
                                person={people.find(p => p.id === selectedPersonId)!}
                                shifts={shifts}
                                tasks={tasks}
                                roles={roles}
                                onBack={() => setSelectedPersonId(null)}
                                nightShiftStart={nightShiftStart}
                                nightShiftEnd={nightShiftEnd}
                            />
                        ) : (
                            people
                                .filter(p => p.name.includes(searchTerm))
                                .map(person => (
                                    <PersonalStats
                                        key={person.id}
                                        person={person}
                                        shifts={shifts}
                                        tasks={tasks}
                                        onClick={() => { }} // Removed full page navigation
                                        nightShiftStart={nightShiftStart}
                                        nightShiftEnd={nightShiftEnd}
                                    />
                                ))
                        )}
                        {people.filter(p => p.name.includes(searchTerm)).length === 0 && (
                            <div className="p-8 text-center text-slate-400">
                                לא נמצאו תוצאות
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
