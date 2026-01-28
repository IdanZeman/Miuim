import React, { useEffect, useState } from 'react';
import { Person, Shift, TaskTemplate, Role } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import ExcelJS from 'exceljs';
import { useToast } from '../../contexts/ToastContext';
import { Pulse as Activity, Users, CalendarCheck, UserCircle, ChartBar as BarChart2, Moon, MagnifyingGlass as Search, ClipboardText as ClipboardList, DownloadSimple, MicrosoftExcelLogo } from '@phosphor-icons/react';
import { PersonalStats } from './PersonalStats';
import { DetailedUserStats } from './DetailedUserStats';
import { supabase } from '../../services/supabaseClient';
import { Input } from '../../components/ui/Input';
import { ShiftHistoryModal } from './ShiftHistoryModal';
import { ExportButton } from '../../components/ui/ExportButton';
import { MissionReportModal } from './MissionReportModal';

interface TaskReportsProps {
    people: Person[];
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    teams: import('../../types').Team[]; // Added teams
    isViewer?: boolean;
    currentUserEmail?: string;
    currentUserName?: string;
}

export const TaskReports: React.FC<TaskReportsProps> = ({ people, shifts, tasks, roles, teams, isViewer = false, currentUserEmail, currentUserName }) => {
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'overview' | 'personal'>('overview');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [nightShiftStart, setNightShiftStart] = useState('22:00');
    const [nightShiftEnd, setNightShiftEnd] = useState('06:00');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPersonForHistory, setSelectedPersonForHistory] = useState<Person | null>(null);
    const [isMissionReportModalOpen, setIsMissionReportModalOpen] = useState(false);

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

    // Calculate team averages for comparison
    const teamAverages = React.useMemo(() => {
        const activePeople = people.filter(p => p.isActive !== false);
        if (activePeople.length === 0) {
            return { avgHoursPerPerson: 0, avgShiftsPerPerson: 0, avgNightHoursPerPerson: 0, avgLoadPerPerson: 0 };
        }

        let totalHours = 0;
        let totalNightHours = 0;
        let totalLoad = 0;

        activePeople.forEach(person => {
            const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id));
            personShifts.forEach(shift => {
                const task = tasks.find(t => t.id === shift.taskId);
                if (!task) return;

                const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
                totalHours += duration;
                totalLoad += duration * task.difficulty;

                // Night hours
                const start = new Date(shift.startTime);
                const end = new Date(shift.endTime);
                let current = new Date(start);
                const startHour = parseInt(nightShiftStart.split(':')[0]);
                const endHour = parseInt(nightShiftEnd.split(':')[0]);

                while (current < end) {
                    const h = current.getHours();
                    const isNight = startHour > endHour ? (h >= startHour || h < endHour) : (h >= startHour && h < endHour);
                    if (isNight) totalNightHours++;
                    current.setHours(current.getHours() + 1);
                }
            });
        });

        return {
            avgHoursPerPerson: totalHours / activePeople.length,
            avgShiftsPerPerson: shifts.length / activePeople.length,
            avgNightHoursPerPerson: totalNightHours / activePeople.length,
            avgLoadPerPerson: totalLoad / activePeople.length
        };
    }, [people, shifts, tasks, nightShiftStart, nightShiftEnd]);

    const totalSlots = shifts.reduce((acc, s) => {
        // Use snapshot if available
        if (s.requirements?.requiredPeople) {
            return acc + s.requirements.requiredPeople;
        }

        // Fallback to task segment lookup
        const task = tasks.find(t => t.id === s.taskId);
        if (task && s.segmentId) {
            const segment = task.segments?.find(seg => seg.id === s.segmentId);
            if (segment?.requiredPeople) {
                return acc + segment.requiredPeople;
            }
        }

        return acc + 1; // Default fallback
    }, 0);
    const filledSlots = shifts.reduce((acc, s) => acc + s.assignedPersonIds.length, 0);

    const handleExportAllFutureTasks = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('שיבוץ עתידי - כללי', { views: [{ rightToLeft: true }] });

        worksheet.columns = [
            { header: 'שם חייל', key: 'personName', width: 20 },
            { header: 'תאריך', key: 'date', width: 15 },
            { header: 'יום', key: 'day', width: 10 },
            { header: 'שעות', key: 'time', width: 15 },
            { header: 'משימה', key: 'task', width: 25 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

        const now = new Date();
        const activePeople = people.filter(p => p.isActive !== false);

        activePeople.forEach(person => {
            const personFutureShifts = shifts
                .filter(s => s.assignedPersonIds.includes(person.id) && new Date(s.startTime) >= now)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            personFutureShifts.forEach(shift => {
                const task = tasks.find(t => t.id === shift.taskId);
                const start = new Date(shift.startTime);
                const end = new Date(shift.endTime);

                worksheet.addRow({
                    personName: person.name,
                    date: start.toLocaleDateString('he-IL'),
                    day: start.toLocaleDateString('he-IL', { weekday: 'long' }),
                    time: `${start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`,
                    task: task?.name || 'משימה',
                });
            });

            if (personFutureShifts.length > 0) {
                worksheet.addRow({}); // Add empty row between people
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `דוח_שיבוץ_עתידי_מרוכז_${new Date().toLocaleDateString('he-IL').replace(/\./g, '_')}.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
        showToast('דוח מרוכז נוצר וירד בהצלחה', 'success');
    };

    const coverageData = [
        { name: 'מאויש', value: filledSlots, color: '#34d399' },
        { name: 'חסר', value: Math.max(0, totalSlots - filledSlots), color: '#fcd34d' },
    ];

    return (
        <div className="bg-transparent pb-20">
            {/* Compact Header / Controls */}
            <div className="bg-white pb-3 pt-1.5 border-b border-slate-100 flex flex-col gap-2.5 sticky top-0 z-20">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Left: Tab Switcher - Integrated */}
                    <div className="flex bg-slate-100 p-1 rounded-xl shrink-0 h-9 items-center">
                        <button
                            onClick={() => { setViewMode('overview'); setSelectedPersonId(null); }}
                            className={`h-7 px-3 rounded-lg text-xs font-bold transition-all flex items-center ${viewMode === 'overview' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            מבט על
                        </button>
                        <button
                            onClick={() => setViewMode('personal')}
                            className={`h-7 px-3 rounded-lg text-xs font-bold transition-all flex items-center ${viewMode === 'personal' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            מבט אישי
                        </button>
                    </div>

                    {/* Right: Search & Export (Only in Personal Mode) */}
                    {viewMode === 'personal' && !isViewer && (
                        <div className="flex items-center gap-2 flex-1 max-w-md">
                            <div className="bg-slate-50 rounded-xl px-2 h-9 border border-slate-200 flex items-center flex-1">
                                <Input
                                    placeholder="חפש חייל..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    icon={Search}
                                    className="bg-transparent border-none text-slate-800 placeholder-slate-400 focus:ring-0 h-full py-0 text-sm"
                                />
                            </div>
                            <button
                                onClick={() => setIsMissionReportModalOpen(true)}
                                className="bg-white border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm group"
                                title="הפקת דוח משימות מרוכז"
                            >
                                <MicrosoftExcelLogo size={16} weight="bold" className="text-emerald-600 group-hover:scale-110 transition-transform" />
                                <span className="hidden md:inline">דוח משימות</span>
                            </button>
                            <ExportButton
                                onExport={handleExportAllFutureTasks}
                                iconOnly
                                variant="premium"
                                size="sm"
                                className="w-9 h-9 rounded-xl"
                                title="ייצוא ריכוז משימות עתידי לכלל הלוחמים"
                            />
                        </div>
                    )}
                    {/* Overview Export Button */}
                    {viewMode === 'overview' && !isViewer && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsMissionReportModalOpen(true)}
                                className="bg-white border border-slate-200 text-slate-700 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 h-9 px-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm group"
                                title="הפקת דוח משימות מרוכז"
                            >
                                <MicrosoftExcelLogo size={16} weight="bold" className="text-emerald-600 group-hover:scale-110 transition-transform" />
                                <span className="hidden md:inline">דוח משימות</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="py-3 space-y-3">
                {/* Team Analytics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-3.5 text-white shadow-lg shadow-blue-500/10 relative overflow-hidden group">
                        <div className="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl group-hover:scale-150 transition-transform" />
                        <div className="relative z-10">
                            <div className="text-[9px] font-black uppercase tracking-widest opacity-70 mb-0.5">סה"כ שעות מאוישות</div>
                            <div className="text-xl md:text-2xl font-black">{loadData.reduce((acc, d) => acc + d.hours, 0).toFixed(0)}<span className="text-xs opacity-60 ml-1 font-bold">ש'</span></div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                <Users size={16} weight="bold" />
                            </div>
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 leading-none">סד"כ פעיל</div>
                                <div className="text-base md:text-lg font-black text-slate-800 leading-tight">{people.filter(p => p.isActive !== false).length} <span className="text-[9px] text-slate-300">אנשים</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                                <Moon size={16} weight="bold" />
                            </div>
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 leading-none">שעות לילה בצוות</div>
                                <div className="text-base md:text-lg font-black text-slate-800 leading-tight">{teamAverages.avgNightHoursPerPerson.toFixed(1)} <span className="text-[9px] text-slate-300">ממוצע</span></div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                                <Activity size={16} weight="bold" />
                            </div>
                            <div>
                                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5 leading-none">ניקוד עומס ממוצע</div>
                                <div className="text-base md:text-lg font-black text-slate-800 leading-tight">{teamAverages.avgLoadPerPerson.toFixed(0)} <span className="text-[9px] text-slate-300">PT</span></div>
                            </div>
                        </div>
                    </div>
                </div>
                {viewMode === 'overview' ? (
                    <div className="space-y-4">
                        {/* Horizontal Bar Chart */}
                        <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-100">
                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4">עומס שעות מצטבר</h3>
                            <div className="overflow-y-auto max-h-[350px] md:max-h-[500px] pr-2 custom-scrollbar">
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
                        <div className="bg-white p-4 md:p-6 rounded-2xl border border-slate-100">
                            <h3 className="text-base md:text-lg font-bold text-slate-800 mb-2">סטטוס איוש</h3>
                            <div className="h-[180px] md:h-[200px] w-full"> {/* Reduced Height */}
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
                            <div className="p-3 md:p-4 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
                                <Moon className="text-indigo-500" size={18} weight="bold" />
                                <h3 className="font-bold text-indigo-900 text-sm md:text-base">שיאני לילה</h3>
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
                                        onClick={() => setSelectedPersonForHistory(person)}
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

            {/* Shift History Modal */}
            {selectedPersonForHistory && ( // 5. Render ShiftHistoryModal
                <ShiftHistoryModal
                    isOpen={!!selectedPersonForHistory}
                    onClose={() => setSelectedPersonForHistory(null)}
                    person={selectedPersonForHistory}
                    shifts={shifts}
                    tasks={tasks}
                    roles={roles}
                    people={people}
                    teamAverages={teamAverages}
                    nightShiftStart={nightShiftStart}
                    nightShiftEnd={nightShiftEnd}
                />
            )}

            <MissionReportModal
                isOpen={isMissionReportModalOpen}
                onClose={() => setIsMissionReportModalOpen(false)}
                shifts={shifts}
                people={people}
                tasks={tasks}
                teams={teams}
                roles={roles}
                nightShiftStart={nightShiftStart}
                nightShiftEnd={nightShiftEnd}
            />
        </div>
    );
};
