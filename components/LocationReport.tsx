import React, { useState } from 'react';
import { Person, Shift, TaskTemplate, Team } from '../types';
import { MapPin, Home, Briefcase, Download, Filter, Copy } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { useToast } from '../contexts/ToastContext';

interface LocationReportProps {
    people: Person[];
    shifts: Shift[];
    taskTemplates: TaskTemplate[];
    teamRotations?: any[];
    teams?: Team[]; // Added teams prop
}

type LocationStatus = 'mission' | 'base' | 'home';

interface PersonLocation {
    person: Person;
    status: LocationStatus;
    details: string; // Task Name or "Base" or "Home"
    time: string;
}

export const LocationReport: React.FC<LocationReportProps> = ({ people, shifts, taskTemplates, teamRotations = [], teams = [] }) => {
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('08:00'); // Default check time
    const [filterTeam, setFilterTeam] = useState<string>('all');

    const [groupBy, setGroupBy] = useState<'status' | 'team'>('status');

    // ... existing generateReport logic ...
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

    // Grouping Logic
    const renderContent = () => {
        if (groupBy === 'status') {
            const grouped = {
                mission: reportData.filter(r => r.status === 'mission'),
                base: reportData.filter(r => r.status === 'base'),
                home: reportData.filter(r => r.status === 'home')
            };

            return (
                <div className="space-y-8">
                    {/* Missions */}
                    <section>
                        <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 bg-red-50 p-2 rounded-lg border border-red-100">
                            <Briefcase size={18} className="text-red-500" />
                            במשימה ({grouped.mission.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {grouped.mission.map(r => (
                                <PersonCard key={r.person.id} r={r} />
                            ))}
                            {grouped.mission.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים במשימה בזמן זה</p>}
                        </div>
                    </section>

                    {/* Base */}
                    <section>
                        <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 bg-green-50 p-2 rounded-lg border border-green-100">
                            <MapPin size={18} className="text-green-600" />
                            בבסיס ({grouped.base.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {grouped.base.map(r => (
                                <PersonCard key={r.person.id} r={r} type="base" />
                            ))}
                            {grouped.base.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים בבסיס</p>}
                        </div>
                    </section>

                    {/* Home */}
                    <section>
                        <h3 className="flex items-center gap-2 font-bold text-slate-700 mb-3 bg-slate-100 p-2 rounded-lg border border-slate-200">
                            <Home size={18} className="text-slate-500" />
                            בבית ({grouped.home.length})
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {grouped.home.map(r => (
                                <PersonCard key={r.person.id} r={r} type="home" />
                            ))}
                        </div>
                    </section>
                </div>
            );
        } else {
            // Group by Team
            // Extract unique team IDs present in the report data
            // We use a Set to get unique IDs, then map to Team objects (or names)
            // But we actually need to look up the Team Name from `people` (or pass `teams` prop if available).
            // Currently `LocationReport` doesn't receive `teams`. We can infer from `person.teamId` but we don't have the Team Name unless it sits on `person`.
            // `Person` interface has `teamId`. The Parent component likely needs to pass `teams` or we assume we can't show team names easily without it.
            // Wait, previous code used `teams.find(t => t.id === person.teamId)?.name`.
            // Ah, I need to check if `teams` is passed to props. It IS NOT in the current signature: `({ people, shifts, taskTemplates, teamRotations = [] })`.
            // I should urge the user to pass `teams` or fetch them? simpler is to pass them.
            // But I cannot easily update the parent call (App.tsx) AND this file in one Replace.
            // Let's assume for now I group by `teamId` and if I can't find name, I show "Unknown Team" or similar, OR I realize `Person` objects might be hydrated? No.
            // Wait, looking at App.tsx lines 739 (PersonnelManager) passes teams. But LocationReport is invoked where?
            // LocationReport is NOT in the main switch in App.tsx!
            // Wait, earlier read of App.tsx showed it missing? No, let me re-check App.tsx content from previous turn...
            // It was NOT in the main switch. Ah, it might be a sub-component or I missed it.
            // Let's check `App.tsx` again or search for usage.
            // Actually, I'll just group by `teamId` string for now.

            const teamsMap = new Map<string, PersonLocation[]>();
            reportData.forEach(r => {
                const tid = r.person.teamId || 'no_team';
                if (!teamsMap.has(tid)) teamsMap.set(tid, []);
                teamsMap.get(tid)?.push(r);
            });

            return (
                <div className="space-y-8">
                    {Array.from(teamsMap.entries()).map(([teamId, members]) => (
                        <section key={teamId}>
                            <h3 className="flex items-center gap-2 font-bold text-slate-800 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                {(() => {
                                    const team = teams.find(t => t.id === teamId);
                                    const teamName = team ? team.name : `צוות ${teamId}`;
                                    const displayName = teamId === 'no_team' ? 'עובדים כלליים' : teamName;
                                    return `${displayName} (${members.length})`;
                                })()}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {members.map(r => (
                                    <PersonCard key={r.person.id} r={r} showStatusBadge={true} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            )
        }
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
                        <p className="text-sm text-slate-500">תמונת מצב בזמן אמת</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Team Filter */}
                    <div className="relative">
                        <select
                            value={filterTeam}
                            onChange={(e) => setFilterTeam(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-white transition-colors shadow-sm"
                        >
                            <option value="all">כל הצוותים</option>
                            {teams.length > 0 ? (
                                teams.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))
                            ) : (
                                Array.from(new Set(people.map(p => p.teamId).filter(Boolean))).map(tid => (
                                    <option key={tid} value={tid}>{tid}</option>
                                ))
                            )}
                        </select>
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    {/* Group By Toggle */}
                    <div className="flex bg-slate-100 rounded-lg p-1">
                        <button
                            onClick={() => setGroupBy('status')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${groupBy === 'status' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >
                            לפי סטטוס
                        </button>
                        <button
                            onClick={() => setGroupBy('team')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${groupBy === 'team' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                        >
                            לפי צוות
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        <input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={e => setSelectedDate(new Date(e.target.value))}
                            className="bg-white border-0 text-sm rounded px-2 py-1 outline-none w-32"
                        />
                        <input
                            type="time"
                            value={selectedTime}
                            onChange={e => setSelectedTime(e.target.value)}
                            className="bg-white border-0 text-sm rounded px-2 py-1 outline-none w-20"
                        />
                    </div>

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                let csv = 'שם,צוות,סטטוס,פירוט,שעות\n';
                                reportData.forEach(r => {
                                    const statusMap = { mission: 'במשימה', base: 'בבסיס', home: 'בבית' };
                                    const team = r.person.teamId || '';
                                    // Handle comma in details by wrapping in quotes
                                    csv += `${r.person.name},${team},${statusMap[r.status]},"${r.details.replace(/"/g, '""')}",${r.time}\n`;
                                });
                                // BOM for Hebrew Excel support
                                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `location_report_${selectedDate.toISOString().split('T')[0]}.csv`);
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
                                let text = `📍 *דוח מיקום* - ${selectedDate.toLocaleDateString('he-IL')}\n\n`;

                                if (groupBy === 'status') {
                                    const grouped = {
                                        mission: reportData.filter(r => r.status === 'mission'),
                                        base: reportData.filter(r => r.status === 'base'),
                                        home: reportData.filter(r => r.status === 'home')
                                    };
                                    if (grouped.mission.length) {
                                        text += `*במשימה (${grouped.mission.length}):*\n` + grouped.mission.map(r => `• ${r.person.name} (${r.details})`).join('\n') + '\n\n';
                                    }
                                    if (grouped.base.length) {
                                        text += `*בבסיס (${grouped.base.length}):*\n` + grouped.base.map(r => `• ${r.person.name}`).join('\n') + '\n\n';
                                    }
                                    if (grouped.home.length) {
                                        text += `*בבית (${grouped.home.length}):*\n` + grouped.home.map(r => `• ${r.person.name}`).join('\n');
                                    }
                                } else {
                                    // Team copy logic
                                    const teamsMap = new Map<string, PersonLocation[]>();
                                    reportData.forEach(r => {
                                        const tid = r.person.teamId || 'no_team';
                                        if (!teamsMap.has(tid)) teamsMap.set(tid, []);
                                        teamsMap.get(tid)?.push(r);
                                    });
                                    teamsMap.forEach((members, tid) => {
                                        text += `*${tid === 'no_team' ? 'כללי' : tid} (${members.length}):*\n`;
                                        text += members.map(r => `• ${r.person.name} - ${r.status === 'mission' ? r.details : (r.status === 'base' ? 'בבסיס' : 'בבית')}`).join('\n') + '\n\n';
                                    })
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
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {renderContent()}
            </div>
        </div >
    );
};

// Fix: Explicitly type props and use React.FC to ensure 'key' is accepted
interface PersonCardProps {
    r: PersonLocation;
    type?: 'mission' | 'base' | 'home';
    showStatusBadge?: boolean;
}

const PersonCard: React.FC<PersonCardProps> = ({ r, type = 'mission', showStatusBadge = false }) => {
    const statusColors = {
        mission: 'text-red-600 bg-red-50',
        base: 'text-green-600 bg-green-50',
        home: 'text-slate-500 bg-slate-100'
    };

    // If showStatusBadge is true, we need to determine color dynamically from r.status
    const badgeClass = showStatusBadge ? statusColors[r.status] : (type === 'mission' ? 'text-red-600 bg-red-50' : type === 'base' ? 'text-green-600 bg-green-50' : 'text-slate-500 bg-slate-100');

    return (
        <div className={`bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between ${type === 'home' && !showStatusBadge ? 'opacity-75' : ''}`}>
            <div>
                <span className="font-bold text-slate-800 block">{r.person.name}</span>
                {showStatusBadge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full inline-block mt-1 ${r.status === 'mission' ? 'bg-red-100 text-red-700' : r.status === 'base' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                        {r.status === 'mission' ? 'במשימה' : r.status === 'base' ? 'בבסיס' : 'בבית'}
                    </span>
                )}
            </div>
            <div className="text-right">
                <div className={`text-xs font-bold px-2 py-0.5 rounded-full inline-block mb-1 ${badgeClass}`}>
                    {r.details}
                </div>
                {r.time && r.time !== 'כל היום' && <div className="text-[10px] text-slate-400">{r.time}</div>}
            </div>
        </div>
    );
};
