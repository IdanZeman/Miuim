import React, { useState } from 'react';
import { Person, Shift, TaskTemplate, Team } from '../types';
import { MapPin, Home, Briefcase, Download, Filter, Copy, ChevronDown, Users, LayoutGrid, ArrowUpDown, User } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { useToast } from '../contexts/ToastContext';
import { Select } from './ui/Select';

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

    // Compact Action Row & Header
    return (
        <div className="bg-slate-50 min-h-full flex flex-col">
            {/* Sticky Header */}
            <div className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-200">
                <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <MapPin className="text-emerald-500" size={20} />
                            דוח מיקום כוחות
                        </h2>
                        {/* More Actions (Export) */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => {
                                    let csv = 'שם,צוות,סטטוס,פירוט,שעות\n';
                                    reportData.forEach(r => {
                                        const statusMap = { mission: 'במשימה', base: 'בבסיס', home: 'בבית' };
                                        const team = r.person.teamId || '';
                                        csv += `${r.person.name},${team},${statusMap[r.status]},"${r.details.replace(/"/g, '""')}",${r.time}\n`;
                                    });
                                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                                    const link = document.createElement('a');
                                    const url = URL.createObjectURL(blob);
                                    link.setAttribute('href', url);
                                    link.setAttribute('download', `location_report_${selectedDate.toISOString().split('T')[0]}.csv`);
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                }}
                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                            >
                                <Download size={18} />
                            </button>
                            <button
                                onClick={async () => {
                                    let text = `📍 *דוח מיקום* - ${selectedDate.toLocaleDateString('he-IL')}\n\n`;
                                    const grouped = {
                                        mission: reportData.filter(r => r.status === 'mission'),
                                        base: reportData.filter(r => r.status === 'base'),
                                        home: reportData.filter(r => r.status === 'home')
                                    };
                                    if (grouped.mission.length) text += `*במשימה (${grouped.mission.length}):*\n` + grouped.mission.map(r => `• ${r.person.name} (${r.details})`).join('\n') + '\n\n';
                                    if (grouped.base.length) text += `*בבסיס (${grouped.base.length}):*\n` + grouped.base.map(r => `• ${r.person.name}`).join('\n') + '\n\n';
                                    if (grouped.home.length) text += `*בבית (${grouped.home.length}):*\n` + grouped.home.map(r => `• ${r.person.name}`).join('\n');

                                    try { await navigator.clipboard.writeText(text); showToast('הועתק', 'success'); } catch (e) { showToast('שגיאה', 'error'); }
                                }}
                                className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                            >
                                <Copy size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Controls Row: Date Right, Icons Left - Compact Version */}
                    <div className="flex items-center justify-between gap-2 mb-3 px-1 max-w-full overflow-hidden">
                        {/* Date/Time - Fixed Widths to prevent overflow */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-lg shrink-0">
                            <input
                                type="date"
                                value={selectedDate.toISOString().split('T')[0]}
                                onChange={e => setSelectedDate(new Date(e.target.value))}
                                className="bg-transparent border-0 text-xs font-bold text-slate-700 w-[110px] outline-none p-0.5"
                            />
                            <div className="w-px h-3 bg-slate-300 mx-0.5 shrink-0" />
                            <input
                                type="time"
                                value={selectedTime}
                                onChange={e => setSelectedTime(e.target.value)}
                                className="bg-transparent border-0 text-xs font-bold text-slate-700 w-[65px] outline-none p-0.5 text-center"
                            />
                        </div>

                        {/* Filter Icons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Select
                                triggerMode="icon"
                                value={filterTeam}
                                onChange={setFilterTeam}
                                options={[
                                    { value: 'all', label: 'כל הצוותים' },
                                    ...(teams.length > 0
                                        ? teams.map(t => ({ value: t.id, label: t.name }))
                                        : Array.from(new Set(people.map(p => p.teamId).filter(Boolean))).map(tid => ({ value: tid!, label: tid! }))
                                    )
                                ]}
                                placeholder="סינון לפי צוות"
                                icon={Filter}
                                className="bg-slate-50 border-slate-200 h-9 w-9 p-0" // Using height/width directly for compact icon
                            />
                            <Select
                                triggerMode="icon"
                                value={groupBy}
                                onChange={(val) => setGroupBy(val as any)}
                                options={[
                                    { value: 'status', label: 'לפי סטטוס' },
                                    { value: 'team', label: 'לפי צוות' },
                                    { value: 'alpha', label: 'לפי א-ב' }
                                ]}
                                placeholder="מיון תצוגה"
                                icon={ArrowUpDown}
                                className="bg-slate-50 border-slate-200 h-9 w-9 p-0"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pb-20 custom-scrollbar relative">
                {renderContent()}
            </div>
        </div>
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
    // Flat Layout, No Cards
    return (
        <div className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors flex items-start text-right bg-white">
            {/* Left: Info */}
            <div className="flex-1 min-w-0">
                {/* Name Row */}
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-slate-800 text-sm">{r.person.name}</span>
                    {showStatusBadge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${r.status === 'mission' ? 'bg-rose-100 text-rose-700' : r.status === 'base' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {r.status === 'mission' ? 'משימה' : r.status === 'base' ? 'בסיס' : 'בית'}
                        </span>
                    )}
                </div>
                {/* Subtext: Team */}
                {teamName && <span className="text-[11px] text-slate-400 block">{teamName}</span>}
            </div>

            {/* Right: Details & Time */}
            <div className="flex flex-col items-end gap-1 pl-2">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                    {r.details}
                </span>
                {r.time && r.time !== 'כל היום' && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">
                        {r.time}
                    </span>
                )}
            </div>
        </div>
    );
};