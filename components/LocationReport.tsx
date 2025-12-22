import React, { useState } from 'react';
import { Person, Shift, TaskTemplate, Team } from '../types';
import { MapPin, Home, Briefcase, Download, Filter, Copy, ChevronDown, Users, LayoutGrid, ArrowUpDown, User } from 'lucide-react';
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
    const [groupBy, setGroupBy] = useState<'status' | 'team' | 'alpha'>('status');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

    const toggleSection = (section: string) => {
        setExpanded(prev => ({ ...prev, [section]: !(prev[section] ?? true) }));
    };

    const isSectionExpanded = (key: string) => expanded[key] ?? true;

    const getTeamName = (teamId?: string) => {
        if (!teamId) return 'כללי';
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'כללי';
    };

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
            const statusSortOrder = { mission: 0, base: 1, home: 2 };
            const grouped = {
                mission: reportData.filter(r => r.status === 'mission').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name)),
                base: reportData.filter(r => r.status === 'base').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name)),
                home: reportData.filter(r => r.status === 'home').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name))
            };

            const renderSectionHeader = (
                key: 'mission' | 'base' | 'home',
                title: string,
                count: number,
                icon: React.ReactNode,
                bgClass: string,
                borderClass: string
            ) => (
                <div
                    onClick={() => toggleSection(key)}
                    className={`flex items-center justify-between font-bold text-slate-700 mb-3 p-3 rounded-xl border-2 cursor-pointer select-none transition-all shadow-sm ${bgClass} ${borderClass}`}
                >
                    <div className="flex items-center gap-3">
                        {icon}
                        <span className="text-base">{title} <span className="text-slate-400 font-black text-sm ml-1">({count})</span></span>
                    </div>
                    <ChevronDown
                        size={18}
                        className={`transition-transform duration-300 ${isSectionExpanded(key) ? 'rotate-180' : ''}`}
                    />
                </div>
            );

            return (
                <div className="space-y-6">
                    {/* Missions */}
                    <section>
                        {renderSectionHeader('mission', 'במשימה', grouped.mission.length, <Briefcase size={20} className="text-rose-500" />, 'bg-rose-50/50 hover:bg-rose-50', 'border-rose-100')}
                        {isSectionExpanded('mission') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {grouped.mission.map(r => <PersonCard key={r.person.id} r={r} teamName={getTeamName(r.person.teamId)} />)}
                                {grouped.mission.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים במשימה בזמן זה</p>}
                            </div>
                        )}
                    </section>

                    {/* Base */}
                    <section>
                        {renderSectionHeader('base', 'בבסיס', grouped.base.length, <MapPin size={20} className="text-emerald-600" />, 'bg-emerald-50/50 hover:bg-emerald-50', 'border-emerald-100')}
                        {isSectionExpanded('base') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {grouped.base.map(r => <PersonCard key={r.person.id} r={r} type="base" teamName={getTeamName(r.person.teamId)} />)}
                                {grouped.base.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים בבסיס</p>}
                            </div>
                        )}
                    </section>

                    {/* Home */}
                    <section>
                        {renderSectionHeader('home', 'בבית', grouped.home.length, <Home size={20} className="text-slate-500" />, 'bg-slate-50 hover:bg-slate-100', 'border-slate-200')}
                        {isSectionExpanded('home') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {grouped.home.map(r => <PersonCard key={r.person.id} r={r} type="home" teamName={getTeamName(r.person.teamId)} />)}
                                {grouped.home.length === 0 && <p className="text-sm text-slate-400 italic px-2">כולם בבסיס</p>}
                            </div>
                        )}
                    </section>
                </div>
            );
        } else if (groupBy === 'team') {
            // Group by Team
            const teamsMap = new Map<string, PersonLocation[]>();

            // Get all unique teams that have people in reportData
            const activeTeamIds = Array.from(new Set(reportData.map(r => r.person.teamId || 'no_team')));

            activeTeamIds.forEach(tid => {
                const teamName = tid === 'no_team' ? 'כללי' : (teams.find(t => t.id === tid)?.name || 'כללי');
                const members = reportData
                    .filter(r => (r.person.teamId || 'no_team') === tid)
                    .sort((a, b) => {
                        const statusScore = { mission: 0, base: 1, home: 2 };
                        return statusScore[a.status] - statusScore[b.status] || a.person.name.localeCompare(b.person.name);
                    });
                if (members.length > 0) teamsMap.set(teamName, members);
            });

            return (
                <div className="space-y-6">
                    {Array.from(teamsMap.entries()).map(([teamName, members]) => (
                        <section key={teamName}>
                            <div
                                onClick={() => toggleSection(teamName)}
                                className="flex items-center justify-between font-bold text-slate-700 mb-3 p-3 rounded-xl border-2 border-slate-100 bg-white hover:bg-slate-50 cursor-pointer shadow-sm transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <Users size={20} className="text-blue-500" />
                                    <span className="text-base">{teamName} <span className="text-slate-400 font-black text-sm ml-1">({members.length})</span></span>
                                </div>
                                <ChevronDown
                                    size={18}
                                    className={`transition-transform duration-300 ${isSectionExpanded(teamName) ? 'rotate-180' : ''}`}
                                />
                            </div>
                            {isSectionExpanded(teamName) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {members.map(r => (
                                        <PersonCard
                                            key={r.person.id}
                                            r={r}
                                            showStatusBadge
                                            teamName={teamName}
                                        />
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            );
        } else {
            // Alphabetical (Alpha)
            const sorted = [...reportData].sort((a, b) => a.person.name.localeCompare(b.person.name));
            return (
                <div className="space-y-6">
                    <section>
                        <div className="flex items-center justify-between font-bold text-slate-700 mb-3 p-3 rounded-xl border-2 border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <User size={20} className="text-indigo-500" />
                                <span className="text-base">רשימה שמית <span className="text-slate-400 font-black text-sm ml-1">({sorted.length})</span></span>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                            {sorted.map(r => (
                                <PersonCard
                                    key={r.person.id}
                                    r={r}
                                    showStatusBadge
                                    teamName={getTeamName(r.person.teamId)}
                                />
                            ))}
                        </div>
                    </section>
                </div>
            );
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
                            className="bg-slate-50 border border-slate-200 text-sm rounded-lg pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-white transition-colors shadow-sm font-bold text-slate-700"
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

                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    {/* Group/Sort select dropdown */}
                    <div className="relative group">
                        <select
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value as any)}
                            className="bg-blue-50 border border-blue-200 text-sm rounded-lg pl-9 pr-8 py-2 outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-white transition-colors shadow-sm font-black text-blue-700"
                        >
                            <option value="status">מיון לפי סטטוס</option>
                            <option value="team">מיון לפי צוות</option>
                            <option value="alpha">מיון לפי א-ב</option>
                        </select>
                        <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 pointer-events-none" size={16} />
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" size={14} />
                    </div>
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>

                    <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                        <input
                            type="date"
                            value={selectedDate.toISOString().split('T')[0]}
                            onChange={e => setSelectedDate(new Date(e.target.value))}
                            className="bg-white border-0 text-sm rounded px-2 py-1 outline-none w-auto"
                        />
                        <input
                            type="time"
                            value={selectedTime}
                            onChange={e => setSelectedTime(e.target.value)}
                            className="bg-white border-0 text-sm rounded px-2 py-1 outline-none w-auto"
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
                                } else if (groupBy === 'team') {
                                    // Team copy logic
                                    const teamsMap = new Map<string, PersonLocation[]>();
                                    reportData.forEach(r => {
                                        const tid = r.person.teamId || 'no_team';
                                        if (!teamsMap.has(tid)) teamsMap.set(tid, []);
                                        teamsMap.get(tid)?.push(r);
                                    });
                                    teamsMap.forEach((members, tid) => {
                                        const teamName = tid === 'no_team' ? 'כללי' : (teams.find(t => t.id === tid)?.name || 'כללי');
                                        text += `*${teamName} (${members.length}):*\n`;
                                        text += members.map(r => `• ${r.person.name} - ${r.status === 'mission' ? r.details : (r.status === 'base' ? 'בבסיס' : 'בבית')}`).join('\n') + '\n\n';
                                    })
                                } else {
                                    // Alpha copy logic
                                    const sorted = [...reportData].sort((a, b) => a.person.name.localeCompare(b.person.name));
                                    text += `*רשימה שמית (${sorted.length}):*\n`;
                                    text += sorted.map(r => `• ${r.person.name} - ${r.status === 'mission' ? r.details : (r.status === 'base' ? 'בבסיס' : 'בבית')}`).join('\n');
                                }

                                try {
                                    await navigator.clipboard.writeText(text);
                                    showToast('הדוח הועתק ללוח ההדבקה', 'success');
                                } catch (err) {
                                    showToast('שגיאה בהעתקה', 'error');
                                }
                            }
                            }
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
    teamName?: string;
}

const PersonCard: React.FC<PersonCardProps> = ({ r, type = 'mission', showStatusBadge = false, teamName }) => {
    const statusColors = {
        mission: 'text-rose-600 bg-rose-50',
        base: 'text-emerald-600 bg-emerald-50',
        home: 'text-slate-500 bg-slate-100'
    };

    const badgeClass = showStatusBadge ? statusColors[r.status] : (type === 'mission' ? 'text-rose-600 bg-rose-50' : type === 'base' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 bg-slate-100');

    return (
        <div className={`bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex items-center justify-between transition-all hover:shadow-md hover:border-slate-300 ${type === 'home' && !showStatusBadge ? 'opacity-70' : ''}`}>
            <div className="min-w-0">
                <span className="font-black text-slate-800 block truncate">{r.person.name}</span>
                <div className="flex flex-col gap-0.5 mt-1">
                    {teamName && <span className="text-[10px] text-slate-400 font-bold">{teamName}</span>}
                    {showStatusBadge && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full inline-block font-black w-fit ${r.status === 'mission' ? 'bg-rose-100 text-rose-700' : r.status === 'base' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {r.status === 'mission' ? 'במשימה' : r.status === 'base' ? 'בבסיס' : 'בבית'}
                        </span>
                    )}
                </div>
            </div>
            <div className="text-right flex flex-col items-end gap-1">
                <div className={`text-[10px] font-black px-2 py-1 rounded-lg inline-block whitespace-nowrap ${badgeClass} border border-black/5`}>
                    {r.details}
                </div>
                {r.time && r.time !== 'כל היום' && <div className="text-[9px] text-slate-400 font-bold">{r.time}</div>}
            </div>
        </div>
    );
};