
import React, { useState, useEffect } from 'react';
import { Person, Shift, TaskTemplate, Team, DailyPresence, Absence, HourlyBlockage } from '../../types';
import { MapPin, House as Home, Briefcase, Funnel as Filter, Copy, CaretDown as ChevronDown, Users, SquaresFour as LayoutGrid, ArrowsDownUp as ArrowUpDown, User, CaretRight as ChevronRight, CaretLeft as ChevronLeft, Clock, DotsThreeVertical as MoreVertical } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { useToast } from '../../contexts/ToastContext';
import { Select } from '../../components/ui/Select';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { TimePicker } from '../../components/ui/DatePicker';
import { logger } from '../../services/loggingService';
import { ExportButton } from '../../components/ui/ExportButton';
import { GenericModal } from '../../components/ui/GenericModal';
import { generateLocationReportExcel } from '../../utils/excelExport';

interface LocationReportProps {
    people: Person[];
    shifts: Shift[];
    taskTemplates: TaskTemplate[];
    teamRotations?: any[];
    teams?: Team[]; // Added teams prop
    unifiedPresence?: DailyPresence[];
    absences?: Absence[];
    hourlyBlockages?: HourlyBlockage[];
}

type LocationStatus = 'mission' | 'base' | 'home';

interface PersonLocation {
    person: Person;
    status: LocationStatus;
    details: string; // Task Name or "Base" or "Home"
    time: string;
}

export const LocationReport: React.FC<LocationReportProps> = ({
    people, shifts, taskTemplates, teamRotations = [], teams = [],
    unifiedPresence = [], absences = [], hourlyBlockages = []
}) => {
    const { showToast } = useToast();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedTime, setSelectedTime] = useState<string>('08:00'); // Default check time
    const [filterTeam, setFilterTeam] = useState<string>('all');
    const [groupBy, setGroupBy] = useState<'status' | 'team' | 'alpha'>('status');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);

    const toggleSection = (section: string) => {
        setExpanded(prev => ({ ...prev, [section]: !(prev[section] ?? true) }));
    };

    const isSectionExpanded = (key: string) => expanded[key] ?? true;

    const getTeamName = (teamId?: string) => {
        if (!teamId) return 'כללי';
        const team = teams.find(t => t.id === teamId);
        return team ? team.name : 'כללי';
    };

    const generateReport = () => {
        const checkTime = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(':').map(Number);
        checkTime.setHours(hours, minutes, 0, 0);

        const report: PersonLocation[] = people.map(person => {
            // Check if inactive
            if (person.isActive === false) {
                return {
                    person,
                    status: 'inactive' as any,
                    details: 'לא פעיל (בבסיס)',
                    time: 'קבוע'
                };
            }

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
                    time: `${new Date(activeShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })} - ${new Date(activeShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })}`
                };
            }

            // 2. Check Attendance (Home/Base)
            const avail = getEffectiveAvailability(person, checkTime, teamRotations, absences, hourlyBlockages, unifiedPresence);

            // User Rule: Arrival Day = Base, Departure Day = Home (But respect specific time check)
            if (avail.status === 'arrival') {
                const [sH, sM] = (avail.startHour || '00:00').split(':').map(Number);
                const arrivalTime = new Date(checkTime);
                arrivalTime.setHours(sH, sM, 0, 0);

                if (checkTime < arrivalTime) {
                    return {
                        person,
                        status: 'home',
                        details: `בבית (מגיע ב-${avail.startHour})`,
                        time: avail.startHour ? `${avail.startHour} - ${avail.endHour || '23:59'}` : '08:00 - 17:00'
                    };
                }

                return {
                    person,
                    status: 'base',
                    details: avail.startHour ? `הגעה ב-${avail.startHour}` : 'הגעה לבסיס',
                    time: avail.startHour ? `${avail.startHour} - ${avail.endHour || '23:59'}` : '08:00 - 17:00'
                };
            }

            if (avail.status === 'departure') {
                const [eH, eM] = (avail.endHour || '23:59').split(':').map(Number);
                const departureTime = new Date(checkTime);
                departureTime.setHours(eH, eM, 0, 0);

                if (checkTime < departureTime) {
                    return {
                        person,
                        status: 'base',
                        details: avail.endHour ? `יציאה ב-${avail.endHour}` : 'יציאה הביתה',
                        time: avail.endHour ? `${avail.startHour || '00:00'} - ${avail.endHour}` : '08:00 - 17:00'
                    };
                }

                return {
                    person,
                    status: 'home',
                    details: `בבית (יצא ב-${avail.endHour})`,
                    time: avail.endHour ? `${avail.startHour || '00:00'} - ${avail.endHour}` : '08:00 - 17:00'
                };
            }

            if (!avail.isAvailable || avail.status === 'home' || avail.status === 'unavailable') {
                return {
                    person,
                    status: 'home',
                    details: 'בבית',
                    time: 'כל היום'
                };
            }

            // Fallback for Partial Checks (Classic Logic) if status is generic 'base' but has hours
            if (avail.startHour && avail.endHour && (avail.startHour !== '00:00' || avail.endHour !== '23:59')) {
                // Single Day Logic or similar
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

            const isFullDay = (!avail.startHour || avail.startHour === '00:00') && (!avail.endHour || avail.endHour === '23:59');

            return {
                person,
                status: 'base',
                details: 'בבסיס (זמין)',
                time: isFullDay ? '' : (avail.startHour ? `${avail.startHour} - ${avail.endHour}` : '08:00 - 17:00')
            };
        });

        return report.filter(r => filterTeam === 'all' || r.person.teamId === filterTeam);
    };

    const reportData = generateReport();

    const handleExportExcel = async () => {
        // Hydrate orgName with team name since the utility uses orgName/team field logic
        const dataForExport = reportData
            .filter(r => r.status !== 'inactive') // Exclude inactive from Excel
            .map(r => ({
                ...r,
                orgName: r.person.teamId ? getTeamName(r.person.teamId) : ''
            }));

        await generateLocationReportExcel(
            dataForExport,
            `location_report_${selectedDate.toISOString().split('T')[0]}`,
            false // isBattalionReport
        );
    };

    useEffect(() => {
        logger.info('VIEW', 'Viewed Location Report', {
            date: selectedDate.toISOString().split('T')[0],
            time: selectedTime,
            filterTeam,
            groupBy,
            category: 'stats'
        });
    }, [selectedDate, selectedTime, filterTeam, groupBy]);

    const renderContent = () => {
        if (groupBy === 'status') {
            const grouped = {
                mission: reportData.filter(r => r.status === 'mission').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name)),
                base: reportData.filter(r => r.status === 'base').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name)),
                home: reportData.filter(r => r.status === 'home').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name)),
                inactive: reportData.filter(r => r.status === 'inactive').sort((a, b) => getTeamName(a.person.teamId).localeCompare(getTeamName(b.person.teamId)) || a.person.name.localeCompare(b.person.name))
            };

            const renderSectionHeader = (
                key: LocationStatus,
                title: string,
                count: number,
                icon: React.ReactNode,
                bgClass: string,
                borderClass: string
            ) => (
                <div
                    onClick={() => toggleSection(key)}
                    className={`flex items-center justify-between font-bold text-slate-700 mb-3 p-3 rounded-xl border-2 cursor-pointer select-none transition-all ${bgClass} ${borderClass}`}
                >
                    <div className="flex items-center gap-3">
                        {icon}
                        <span className="text-base">{title} <span className="text-slate-400 font-black text-sm ml-1">({count})</span></span>
                    </div>
                    <ChevronDown
                        size={18}
                        className={`transition-transform duration-300 ${isSectionExpanded(key) ? 'rotate-180' : ''}`}
                        weight="bold"
                    />
                </div>
            );

            return (
                <div className="space-y-6">
                    <section>
                        {renderSectionHeader('mission', 'במשימה', grouped.mission.length, <Briefcase size={20} className="text-rose-500" weight="bold" />, 'bg-rose-50/50 hover:bg-rose-50', 'border-rose-100')}
                        {isSectionExpanded('mission') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {grouped.mission.map(r => <PersonCard key={r.person.id} r={r} teamName={getTeamName(r.person.teamId)} />)}
                                {grouped.mission.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים במשימה בזמן זה</p>}
                            </div>
                        )}
                    </section>

                    <section>
                        {renderSectionHeader('base', 'בבסיס', grouped.base.length, <MapPin size={20} className="text-emerald-600" weight="bold" />, 'bg-emerald-50/50 hover:bg-emerald-50', 'border-emerald-100')}
                        {isSectionExpanded('base') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {grouped.base.map(r => <PersonCard key={r.person.id} r={r} type="base" teamName={getTeamName(r.person.teamId)} />)}
                                {grouped.base.length === 0 && <p className="text-sm text-slate-400 italic px-2">אין חיילים בבסיס</p>}
                            </div>
                        )}
                    </section>

                    <section>
                        {renderSectionHeader('home', 'בבית', grouped.home.length, <Home size={20} className="text-slate-500" weight="bold" />, 'bg-slate-50 hover:bg-slate-100', 'border-slate-200')}
                        {isSectionExpanded('home') && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                {grouped.home.map(r => <PersonCard key={r.person.id} r={r} type="home" teamName={getTeamName(r.person.teamId)} />)}
                                {grouped.home.length === 0 && <p className="text-sm text-slate-400 italic px-2">כולם בבסיס</p>}
                            </div>
                        )}
                    </section>

                    {grouped.inactive.length > 0 && (
                        <section>
                            {renderSectionHeader('inactive', 'לא פעילים (בבסיס)', grouped.inactive.length, <User size={20} className="text-slate-400" weight="bold" />, 'bg-slate-100/50 hover:bg-slate-100', 'border-slate-200')}
                            {isSectionExpanded('inactive') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {grouped.inactive.map(r => <PersonCard key={r.person.id} r={r} teamName={getTeamName(r.person.teamId)} showStatusBadge />)}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            );
        } else if (groupBy === 'team') {
            const teamsMap = new Map<string, PersonLocation[]>();
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
                                    <Users size={20} className="text-blue-500" weight="bold" />
                                    <span className="text-base">{teamName} <span className="text-slate-400 font-black text-sm ml-1">({members.length})</span></span>
                                </div>
                                <ChevronDown
                                    size={18}
                                    className={`transition-transform duration-300 ${isSectionExpanded(teamName) ? 'rotate-180' : ''}`}
                                    weight="bold"
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
            const sorted = [...reportData].sort((a, b) => a.person.name.localeCompare(b.person.name));
            return (
                <div className="space-y-6">
                    <section>
                        <div className="flex items-center justify-between font-bold text-slate-700 mb-3 p-3 rounded-xl border-2 border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-3">
                                <User size={20} className="text-indigo-500" weight="bold" />
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
        <div className="bg-transparent min-h-full flex flex-col">
            <div className="bg-white p-4 md:p-6 border-b border-slate-100 sticky top-0 z-30 flex flex-col gap-4 shadow-sm">

                {/* Top Row: Title & Controls */}
                {/* Top Row: Title & Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center justify-between w-full md:w-auto">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-2 shrink-0">
                            <MapPin className="text-emerald-500" size={24} weight="bold" />
                            דוח מיקום כוחות
                        </h2>

                        <button
                            onClick={() => setIsActionsMenuOpen(true)}
                            className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-500 active:bg-slate-100 transition-colors shrink-0"
                            aria-label="פעולות נוספות"
                        >
                            <MoreVertical size={20} weight="bold" />
                        </button>
                    </div>

                    {/* Desktop: All Controls */}
                    <div className="hidden md:flex items-center gap-2">
                        <DateNavigator
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                            mode="day"
                            className="h-10"
                        />

                        <TimePicker
                            label=""
                            value={selectedTime}
                            onChange={setSelectedTime}
                            className="w-28 h-10"
                        />

                        <div className="w-px h-6 bg-slate-200 mx-1" />

                        <ExportButton
                            onExport={handleExportExcel}
                            iconOnly
                            variant="secondary"
                            size="sm"
                            className="w-10 h-10 rounded-xl"
                            title="ייצוא דוח מיקום"
                        />

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

                                try {
                                    await navigator.clipboard.writeText(text);
                                    showToast('הועתק', 'success');
                                    logger.info('EXPORT', `Copied Location Report to clipboard for ${selectedDate.toLocaleDateString('he-IL')}`, {
                                        date: selectedDate.toISOString().split('T')[0],
                                        itemCount: reportData.length,
                                        category: 'data'
                                    });
                                } catch (e) { showToast('שגיאה', 'error'); }
                            }}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-200 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                            title="העתק לווצאפ"
                        >
                            <Copy size={18} weight="bold" />
                        </button>

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
                            className="w-10 h-10 p-0 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
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
                            className="w-10 h-10 p-0 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        />
                    </div>

                    {/* Mobile: Date, Time (Menu moved to top) */}
                    <div className="md:hidden flex items-center gap-2 w-full">
                        <DateNavigator
                            date={selectedDate}
                            onDateChange={setSelectedDate}
                            mode="day"
                            className="h-10 flex-1"
                            showTodayButton={false}
                        />

                        <TimePicker
                            label=""
                            value={selectedTime}
                            onChange={setSelectedTime}
                            className="w-24 h-10"
                        />
                    </div>
                </div>
            </div>

            {/* Mobile Actions Menu */}
            <GenericModal
                isOpen={isActionsMenuOpen}
                onClose={() => setIsActionsMenuOpen(false)}
                title="פעולות"
                size="sm"
            >
                <div className="flex flex-col gap-2 p-2">
                    <button
                        onClick={() => {
                            handleExportExcel();
                            setIsActionsMenuOpen(false);
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-right"
                    >
                        <img src="/images/excel.svg" alt="Excel" width={20} height={20} className="object-contain" />
                        <span className="font-bold text-slate-800">ייצוא לאקסל</span>
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

                            try {
                                await navigator.clipboard.writeText(text);
                                showToast('הועתק', 'success');
                                setIsActionsMenuOpen(false);
                            } catch (e) { showToast('שגיאה', 'error'); }
                        }}
                        className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors text-right"
                    >
                        <Copy size={20} weight="bold" className="text-blue-600" />
                        <span className="font-bold text-slate-800">העתק לווצאפ</span>
                    </button>

                    <div className="border-t border-slate-100 my-2" />

                    <div className="px-2 py-2">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">סינון לפי צוות</label>
                        <Select
                            value={filterTeam}
                            onChange={(val) => { setFilterTeam(val); }}
                            options={[
                                { value: 'all', label: 'כל הצוותים' },
                                ...(teams.length > 0
                                    ? teams.map(t => ({ value: t.id, label: t.name }))
                                    : Array.from(new Set(people.map(p => p.teamId).filter(Boolean))).map(tid => ({ value: tid!, label: tid! }))
                                )
                            ]}
                            className="w-full"
                        />
                    </div>

                    <div className="px-2 py-2">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">מיון תצוגה</label>
                        <Select
                            value={groupBy}
                            onChange={(val) => { setGroupBy(val as any); }}
                            options={[
                                { value: 'status', label: 'לפי סטטוס' },
                                { value: 'team', label: 'לפי צוות' },
                                { value: 'alpha', label: 'לפי א-ב' }
                            ]}
                            className="w-full"
                        />
                    </div>
                </div>
            </GenericModal>

            <div className="flex-1 overflow-y-auto pt-6 pb-20 custom-scrollbar relative">
                {renderContent()}
            </div>
        </div>
    );
};

interface PersonCardProps {
    r: PersonLocation;
    type?: 'mission' | 'base' | 'home';
    showStatusBadge?: boolean;
    teamName?: string;
}

const PersonCard: React.FC<PersonCardProps> = ({ r, showStatusBadge = false, teamName }) => {
    return (
        <div className="p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors flex items-start text-right bg-white">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-bold text-slate-800 text-sm">{r.person.name}</span>
                    {showStatusBadge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${r.status === 'mission' ? 'bg-rose-100 text-rose-700' : r.status === 'base' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {r.status === 'mission' ? 'משימה' : r.status === 'base' ? 'בסיס' : 'בית'}
                        </span>
                    )}
                </div>
                {teamName && <span className="text-[11px] text-slate-400 block">{teamName}</span>}
            </div>

            <div className="flex flex-col items-end gap-1 pl-2">
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                    {r.details}
                </span>
                {r.time && r.time !== 'כל היום' && (
                    <span dir="ltr" className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded">
                        {r.time}
                    </span>
                )}
            </div>
        </div>
    );
};