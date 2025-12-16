import React, { useState } from 'react';
import { Person, Shift, TaskTemplate } from '../types';
import { MapPin, Home, Briefcase, Download, Filter, Copy } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { useToast } from '../contexts/ToastContext';

interface LocationReportProps {
    people: Person[];
    shifts: Shift[];
    taskTemplates: TaskTemplate[];
    teamRotations?: any[];
}

type LocationStatus = 'mission' | 'base' | 'home';

interface PersonLocation {
    person: Person;
    status: LocationStatus;
    details: string; // Task Name or "Base" or "Home"
    time: string;
}

export const LocationReport: React.FC<LocationReportProps> = ({ people, shifts, taskTemplates, teamRotations = [] }) => {
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('08:00'); // Default check time
    const [filterTeam, setFilterTeam] = useState<string>('all');

    const generateReport = () => {
        const checkTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(':').map(Number);
        checkTime.setHours(hours, minutes, 0, 0);

        const activePeople = people.filter(p => p.isActive !== false);

        const report: PersonLocation[] = activePeople.map(person => {
            // 1. Check if in active shift at this time
            const activeShift = shifts.find(s => {
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                return s.assignedPersonIds.includes(person.id) && start <= checkTime && end >= checkTime;
            });

            if (activeShift) {
                const task = taskTemplates.find(t => t.id === activeShift.taskId);
                return {
                    person,
                    status: 'mission',
                    details: task?.name || 'משימה',
                    time: `${new Date(activeShift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(activeShift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                };
            }

            // 2. Check Attendance (Home/Base)
            const avail = getEffectiveAvailability(person, checkTime, teamRotations);

            if (!avail.isAvailable) {
                return {
                    person,
                    status: 'home',
                    details: 'בבית',
                    time: 'כל היום'
                };
            }

            // Check if within hours (arrived yet? left already?)
            if (avail.startHour && avail.endHour) {
                const [sH, sM] = avail.startHour.split(':').map(Number);
                const [eH, eM] = avail.endHour.split(':').map(Number);

                const arrival = new Date(checkTime); arrival.setHours(sH, sM, 0);
                const departure = new Date(checkTime); departure.setHours(eH, eM, 0);

                if (checkTime < arrival || checkTime > departure) {
                    return {
                        person,
                        status: 'home',
                        details: 'בבית (מחוץ לשעות)',
                        time: `${avail.startHour} - ${avail.endHour}`
                    };
                }
            }

            // Default: Base
            return {
                person,
                status: 'base',
                details: 'בבסיס (זמין)',
                time: avail.startHour ? `${avail.startHour} - ${avail.endHour}` : '08:00 - 17:00'
            };
        });

        return report.filter(r => filterTeam === 'all' || r.person.teamId === filterTeam);
    };

    const reportData = generateReport();

    // Group by status for display
    const grouped = {
        mission: reportData.filter(r => r.status === 'mission'),
        base: reportData.filter(r => r.status === 'base'),
        home: reportData.filter(r => r.status === 'home')
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 h-full flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                        <MapPin size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">דוח מיקום כוחות</h2>
                        <p className="text-sm text-slate-500">תמונת מצב בזמן אמת - מי איפה?</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <input
                        type="date"
                        value={selectedDate.toISOString().split('T')[0]}
                        onChange={e => setSelectedDate(new Date(e.target.value))}
                        className="bg-white border text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                        type="time"
                        value={selectedTime}
                        onChange={e => setSelectedTime(e.target.value)}
                        className="bg-white border text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>


                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            let csv = 'שם,סטטוס,פירוט,שעות\n';
                            reportData.forEach(r => {
                                const statusMap = { mission: 'במשימה', base: 'בבסיס', home: 'בבית' };
                                csv += `${r.person.name},${statusMap[r.status]},"${r.details}",${r.time}\n`;
                            });
                            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.setAttribute('href', url);
                            link.setAttribute('download', `location_report_${selectedDate.toISOString().split('T')[0]}_${selectedTime}.csv`);
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200"
                        title="ייצוא לאקסל"
                    >
                        <Download size={20} />
                    </button>
                    <button
                        onClick={async () => {
                            let text = `📍 *דוח מיקום - ${selectedDate.toLocaleDateString('he-IL')} ${selectedTime}*\n------------------\n`;

                            if (grouped.mission.length > 0) {
                                text += `\n🔴 *במשימה (${grouped.mission.length}):*\n`;
                                grouped.mission.forEach(r => text += `• ${r.person.name} - ${r.details} (${r.time})\n`);
                            }

                            if (grouped.base.length > 0) {
                                text += `\n🟢 *בבסיס (${grouped.base.length}):*\n`;
                                grouped.base.forEach(r => text += `• ${r.person.name} - ${r.details}\n`);
                            }

                            if (grouped.home.length > 0) {
                                text += `\n🏠 *בבית (${grouped.home.length}):*\n`;
                                grouped.home.forEach(r => text += `• ${r.person.name}\n`);
                            }

                            try {
                                await navigator.clipboard.writeText(text);
                                showToast('הדוח הועתק ללוח ההדבקה', 'success');
                            } catch (err) {
                                showToast('שגיאה בהעתקה', 'error');
                            }
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                        title="העתק לווטסאפ"
                    >
                        <Copy size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-8">
                {/* 1. Missions */}
                <section>
                    <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">
                        <Briefcase size={18} className="text-red-500" />
                        במשימה ({grouped.mission.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {grouped.mission.map(r => (
                            <div key={r.person.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
                                <span className="font-bold text-slate-800">{r.person.name}</span>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full inline-block mb-1">{r.details}</div>
                                    <div className="text-[10px] text-slate-400">{r.time}</div>
                                </div>
                            </div>
                        ))}
                        {grouped.mission.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים במשימה בזמן זה</p>}
                    </div>
                </section>

                {/* 2. Base */}
                <section>
                    <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 bg-green-50 p-2 rounded-lg border border-green-100">
                        <MapPin size={18} className="text-green-600" />
                        בבסיס ({grouped.base.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {grouped.base.map(r => (
                            <div key={r.person.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between">
                                <span className="font-bold text-slate-800">{r.person.name}</span>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block mb-1">{r.details}</div>
                                    <div className="text-[10px] text-slate-400">{r.time}</div>
                                </div>
                            </div>
                        ))}
                        {grouped.base.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים בבסיס</p>}
                    </div>
                </section>

                {/* 3. Home */}
                <section>
                    <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 bg-slate-100 p-2 rounded-lg border border-slate-200">
                        <Home size={18} className="text-slate-500" />
                        בבית ({grouped.home.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {grouped.home.map(r => (
                            <div key={r.person.id} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm opacity-75">
                                <span className="font-medium text-slate-600">{r.person.name}</span>
                                <div className="text-right">
                                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full inline-block mb-1">{r.details}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div >
    );
};
