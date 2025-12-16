
import React, { useEffect, useState } from 'react';
import { Person, Shift, TaskTemplate, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, CalendarCheck, UserCircle, BarChart2, Moon, Search } from 'lucide-react';
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
                .single();

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
            max: person.maxHoursPerWeek,
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
        <div className="space-y-8 animate-in fade-in duration-500">
            {!isViewer && (
                <div className="flex justify-end mb-4">
                    <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                        <button
                            onClick={() => setViewMode('overview')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'overview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2">
                                <BarChart2 size={16} />
                                <span>מבט על</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setViewMode('personal')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'personal' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <div className="flex items-center gap-2">
                                <UserCircle size={16} />
                                <span>מבט אישי</span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {viewMode === 'personal' ? (
                selectedPersonId ? (
                    <DetailedUserStats
                        person={people.find(p => p.id === selectedPersonId)!}
                        shifts={shifts}
                        tasks={tasks}
                        roles={roles}
                        onBack={isViewer ? undefined : () => setSelectedPersonId(null)}
                        nightShiftStart={nightShiftStart}
                        nightShiftEnd={nightShiftEnd}
                    />
                ) : (
                    isViewer ? (
                        <div className="flex flex-col items-center justify-center h-64 bg-white rounded-xl shadow-sm p-8 text-center">
                            <UserCircle size={48} className="text-slate-300 mb-4" />
                            <h3 className="text-lg font-bold text-slate-800 mb-2">לא נמצאו נתונים</h3>
                            <p className="text-slate-500 max-w-md">
                                לא הצלחנו למצוא פרופיל חייל המקושר למשתמש שלך ({currentUserName || currentUserEmail}).
                                אנא פנה למנהל המערכת לוודא שהשם שלך במערכת זהה לשם המשתמש.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="max-w-md mx-auto">
                                <Input
                                    placeholder="חפש חייל..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    icon={Search}
                                    className="rounded-full"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {people.filter(p => p.name.includes(searchTerm)).map(person => (
                                    <PersonalStats
                                        key={person.id}
                                        person={person}
                                        shifts={shifts}
                                        tasks={tasks}
                                        onClick={() => setSelectedPersonId(person.id)}
                                        nightShiftStart={nightShiftStart}
                                        nightShiftEnd={nightShiftEnd}
                                    />
                                ))}
                                <div className="bg-white rounded-xl shadow-portal p-6 flex items-center justify-between border-b-4 border-purple-400">
                                    <div>
                                        <p className="text-slate-500 font-medium text-sm mb-1">משמרות פעילות</p>
                                        <h3 className="text-3xl font-bold text-slate-800">{shifts.length}</h3>
                                    </div>
                                    <div className="bg-purple-50 p-3 rounded-full text-purple-500"><CalendarCheck size={24} /></div>
                                </div>
                            </div>
                        </div>
                    )
                )
            ) : (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="bg-white p-6 rounded-xl shadow-portal">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">עומס שעות שבועי</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={loadData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} name="שעות בפועל" />
                                        <Bar dataKey="max" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="תקרה" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-portal flex flex-col">
                            <h3 className="text-lg font-bold text-slate-800 mb-6">סטטוס איוש</h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={coverageData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={80}
                                            outerRadius={100}
                                            paddingAngle={5}
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
                            <div className="flex justify-center gap-6 mt-4">
                                {coverageData.map(d => (
                                    <div key={d.name} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                                        <span className="text-sm text-slate-600 font-bold">{d.name} ({d.value})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Advanced Stats Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Night Shift Leaders */}
                        <div className="bg-white rounded-xl shadow-portal p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Moon className="text-indigo-500" size={20} />
                                מלכי הלילה 🌙
                            </h3>
                            <div className="space-y-4">
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
                                            // Check if hour is within night shift range
                                            // Handle crossing midnight (e.g. 22:00 to 06:00)
                                            const isNight = startHour > endHour
                                                ? (h >= startHour || h < endHour)
                                                : (h >= startHour && h < endHour);

                                            if (isNight) nightHours++;
                                            current.setHours(current.getHours() + 1);
                                        }
                                    });
                                    return { person, nightHours };
                                })
                                    .sort((a, b) => b.nightHours - a.nightHours)
                                    .slice(0, 5)
                                    .map((item, index) => (
                                        <div key={item.person.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${index === 0 ? 'ring-2 ring-yellow-400' : ''}`} style={{ backgroundColor: item.person.color }}>
                                                    {item.person.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 block">{item.person.name}</span>
                                                    {index === 0 && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">אלוף הלילה 🏆</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-bold text-indigo-600">{item.nightHours}</span>
                                                <span className="text-xs text-slate-400 mr-1">שעות</span>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {/* Task Distribution Leaderboard */}
                        <div className="bg-white rounded-xl shadow-portal p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <Activity className="text-orange-500" size={20} />
                                שיאני המשימות
                            </h3>
                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                                {tasks.map(task => {
                                    // Find who did this task the most
                                    const counts = people.map(person => {
                                        const count = shifts.filter(s => s.taskId === task.id && s.assignedPersonIds.includes(person.id)).length;
                                        return { person, count };
                                    }).sort((a, b) => b.count - a.count);

                                    const topPerformer = counts[0];
                                    if (!topPerformer || topPerformer.count === 0) return null;

                                    return (
                                        <div key={task.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: task.color }}>
                                                    <BarChart2 size={20} />
                                                </div>
                                                <div>
                                                    <span className="font-bold text-slate-800 block">{task.name}</span>
                                                    <span className="text-xs text-slate-500">בוצע {shifts.filter(s => s.taskId === task.id).length} פעמים סה"כ</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: topPerformer.person.color }}>
                                                    {topPerformer.person.name.charAt(0)}
                                                </div>
                                                <div className="flex flex-col items-end leading-none">
                                                    <span className="text-xs font-bold text-slate-700">{topPerformer.person.name.split(' ')[0]}</span>
                                                    <span className="text-[10px] text-slate-400">{topPerformer.count} ביצועים</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
