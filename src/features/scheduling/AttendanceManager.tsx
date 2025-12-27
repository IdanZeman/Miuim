
import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, TeamRotation, TaskTemplate, SchedulingConstraint, OrganizationSettings, Shift, DailyPresence, Absence } from '@/types';
import { Calendar, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Search, Settings, CalendarDays, ChevronDown, ArrowLeft, ArrowRight, CheckSquare, ListChecks, X, Wand2, Sparkles } from 'lucide-react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { GlobalTeamCalendar } from './GlobalTeamCalendar';
import { RotationEditor } from './RotationEditor';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { Input } from '@/components/ui/Input';
import { AttendanceRow } from './AttendanceRow';
import { AttendanceTable } from './AttendanceTable';
import { BulkAttendanceModal } from './BulkAttendanceModal';
import { useToast } from '@/contexts/ToastContext';
import { RotaWizardModal } from './RotaWizardModal';
import { PageInfo } from '@/components/ui/PageInfo';

interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
    teamRotations?: TeamRotation[];
    tasks?: TaskTemplate[]; // NEW
    constraints?: SchedulingConstraint[]; // NEW
    absences?: Absence[]; // NEW
    settings?: OrganizationSettings | null; // NEW
    onUpdatePerson: (p: Person) => void;
    onUpdatePeople?: (people: Person[]) => void;
    onAddRotation?: (r: TeamRotation) => void;
    onUpdateRotation?: (r: TeamRotation) => void;
    onDeleteRotation?: (id: string) => void;
    onAddShifts?: (shifts: Shift[]) => void; // NEW
    isViewer?: boolean;
    initialOpenRotaWizard?: boolean;
    onDidConsumeInitialAction?: () => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
    people, teams, teamRotations = [],
    tasks = [], constraints = [], absences = [], settings = null,
    onUpdatePerson, onUpdatePeople,
    onAddRotation, onUpdateRotation, onDeleteRotation, onAddShifts,
    isViewer = false, initialOpenRotaWizard = false, onDidConsumeInitialAction
}) => {
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'calendar' | 'day_detail'>('calendar');
    const [calendarViewType, setCalendarViewType] = useState<'grid' | 'table'>('grid'); // NEW: sub-view for calendar
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date()); // Lifted state for calendar view
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [showRotationSettings, setShowRotationSettings] = useState<string | null>(null);
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);
    const [editingPersonalRotation, setEditingPersonalRotation] = useState<Person | null>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Bulk Mode State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showRotaWizard, setShowRotaWizard] = useState(initialOpenRotaWizard); // Initialize from prop

    useEffect(() => {
        if (initialOpenRotaWizard && onDidConsumeInitialAction) {
            onDidConsumeInitialAction();
        }
    }, [initialOpenRotaWizard, onDidConsumeInitialAction]);

    const getPersonAvailability = (person: Person) => {
        return getEffectiveAvailability(person, selectedDate, teamRotations, absences);
    };

    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const dateKey = selectedDate.toLocaleDateString('en-CA');

    const handleTogglePresence = (person: Person) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        const newIsAvailable = !currentData.isAvailable;
        let newData = {
            isAvailable: newIsAvailable,
            startHour: '00:00',
            endHour: '23:59',
            source: 'manual'
        };

        if (!newIsAvailable) {
            newData.startHour = '00:00';
            newData.endHour = '00:00';
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: newData
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const handleTimeChange = (person: Person, field: 'startHour' | 'endHour', value: string) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: {
                    ...currentData,
                    isAvailable: true,
                    [field]: value,
                    source: 'manual'
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const filteredPeople = people.filter(p => p.name.includes(searchTerm));

    let peopleByTeam = teams.map(team => ({
        team,
        members: filteredPeople
            .filter(p => p.teamId === team.id)
            .sort((a, b) => {
                // Stable sort by name only
                return a.name.localeCompare(b.name);
            })
    }));

    const noTeamMembers = filteredPeople.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
    if (noTeamMembers.length > 0) {
        peopleByTeam.push({
            team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' },
            members: noTeamMembers
        });
    }

    peopleByTeam.sort((a, b) => b.members.length - a.members.length);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setViewMode('day_detail');
    };

    const handleBackToCalendar = () => {
        setViewMode('calendar');
        setIsBulkMode(false);
        setSelectedPersonIds(new Set());
    };

    // Bulk Actions
    const handleToggleSelectPerson = (id: string) => {
        const next = new Set(selectedPersonIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPersonIds(next);
    };

    const handleSelectAll = () => {
        if (selectedPersonIds.size === filteredPeople.length) {
            setSelectedPersonIds(new Set());
        } else {
            setSelectedPersonIds(new Set(filteredPeople.map(p => p.id)));
        }
    };

    const handleBulkApply = (data: { startDate: string; endDate: string; isAvailable: boolean; startHour: string; endHour: string; reason?: string }) => {
        if (!onUpdatePeople) return;

        const peopleToUpdate: Person[] = [];
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        people.forEach(person => {
            if (selectedPersonIds.has(person.id)) {
                let updatedPerson = { ...person };
                let current = new Date(start);

                while (current <= end) {
                    const key = current.toLocaleDateString('en-CA');
                    updatedPerson.dailyAvailability = {
                        ...updatedPerson.dailyAvailability,
                        [key]: {
                            isAvailable: data.isAvailable,
                            status: data.isAvailable ? 'base' : 'home', // Infer status for bulk operations
                            startHour: data.startHour,
                            endHour: data.endHour,
                            source: 'manual'
                        }
                    };
                    current.setDate(current.getDate() + 1);
                }
                peopleToUpdate.push(updatedPerson);
            }
        });

        onUpdatePeople(peopleToUpdate);
        showToast(`${peopleToUpdate.length} לוחמים עודכנו בהצלחה`, 'success');
        setIsBulkMode(false);
        setSelectedPersonIds(new Set());
    };

    const handleQuickBulkUpdate = (isAvailable: boolean) => {
        const dateStr = selectedDate.toLocaleDateString('en-CA');
        handleBulkApply({
            startDate: dateStr,
            endDate: dateStr,
            isAvailable,
            startHour: isAvailable ? '00:00' : '00:00',
            endHour: isAvailable ? '23:59' : '00:00'
        });
    };

    const handleUpdatePersonalRotation = (rotationSettings: any) => {
        if (!editingPersonalRotation) return;
        const updatedPerson = {
            ...editingPersonalRotation,
            personalRotation: rotationSettings
        };
        onUpdatePerson(updatedPerson);
        setEditingPersonalRotation(null);
        showToast('הגדרות סבב אישי עודכנו', 'success');
    };

    const handleUpdateAvailability = (personId: string, date: string, status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[]) => {
        if (isViewer) return;

        const person = people.find(p => p.id === personId);
        if (!person) return;

        const currentData = person.dailyAvailability?.[date] || {
            isAvailable: true, // default
            startHour: '00:00',
            endHour: '23:59',
            source: 'manual',
            unavailableBlocks: []
        };

        let newData: any = {
            ...currentData,
            source: 'manual',
            status: status, // Persist the status ('base', 'home', 'unavailable')
            unavailableBlocks: unavailableBlocks || []
        };

        if (status === 'base') {
            newData.isAvailable = true;
            if (customTimes) {
                newData.startHour = customTimes.start;
                newData.endHour = customTimes.end;
            } else {
                newData.startHour = '00:00';
                newData.endHour = '23:59';
            }
        } else if (status === 'home') {
            newData.isAvailable = false;
            newData.startHour = '00:00';
            newData.endHour = '00:00';
            // newData.reason = 'בבית'; // Optional
        } else if (status === 'unavailable') {
            // Legacy support or specific full-day constraint
            newData.isAvailable = false;
            newData.startHour = '00:00';
            newData.endHour = '00:00';
            newData.reason = 'אילוץ / לא זמין';
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [date]: newData
            }
        };

        onUpdatePerson(updatedPerson);
        showToast('הסטטוס עודכן בהצלחה', 'success');
    };

    const handleExport = () => {
        if (viewMode === 'calendar') {
            // Export Month
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let csvContent = `דוח נוכחות חודשי - ${viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })} \n`;
            csvContent += 'תאריך,שם מלא,צוות,סטטוס,שעות,סיבה\n';

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month, d);
                const dateStr = date.toLocaleDateString('he-IL');

                people.forEach(person => {
                    const avail = getEffectiveAvailability(person, date, teamRotations, absences);
                    const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
                    const status = avail.isAvailable ? 'נמצא' : 'בבית';
                    const hours = avail.isAvailable ? `${avail.startHour} - ${avail.endHour} ` : '-';
                    const reason = (avail as any).reason || (avail.source === 'rotation' ? 'סבב' : (avail.source === 'manual' ? 'ידני' : 'כרגיל'));

                    // Safe strings
                    const sName = `"${person.name.replace(/"/g, '""')}"`;
                    const sTeam = `"${teamName.replace(/"/g, '""')}"`;

                    csvContent += `${dateStr},${sName},${sTeam},${status},${hours},${reason}\n`;
                });
            }

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `attendance_month_${month + 1}_${year}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } else {
            // Export Day (Existing logic)
            const dateStr = selectedDate.toLocaleDateString('he-IL');
            let csvContent = `דוח נוכחות ליום ${dateStr}\n`;
            csvContent += 'שם מלא,צוות,סטטוס,שעות,סיבה/מקור\n';

            people.forEach(person => {
                const avail = getPersonAvailability(person);
                const teamName = teams.find(t => t.id === person.teamId)?.name || 'ללא צוות';
                const status = avail.isAvailable ? 'נמצא' : 'לא נמצא';
                const hours = avail.isAvailable ? `${avail.startHour} - ${avail.endHour}` : '-';
                const reason = (avail as any).reason || (avail.source === 'rotation' ? 'סבב' : (avail.source === 'manual' ? 'ידני' : 'כרגיל'));

                // Safe strings
                const sName = `"${person.name.replace(/"/g, '""')}"`;
                const sTeam = `"${teamName.replace(/"/g, '""')}"`;

                csvContent += `${sName},${sTeam},${status},${hours},${reason}\n`;
            });

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `attendance_${selectedDate.toLocaleDateString('en-CA')}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] relative overflow-hidden">
            {/* --- GREEN HEADER (Mobile & Desktop Unified or Mobile Only?) --- */}

            {/* --- UNIFIED MOBILE CONTAINER --- */}
            <div className={`
                flex-1 flex flex-col md:hidden
                relative isolate z-10 overflow-hidden
            `}>
                {/* Mobile Header (Integrated into Sheet) */}
                <div className="px-4 pt-6 pb-4 border-b border-slate-50 flex flex-col gap-5 shrink-0">
                    <div className="flex items-center justify-between">
                        {/* Right Side: View Toggles (Icons) */}
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'calendar' ? 'bg-white text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <CalendarDays size={20} />
                            </button>
                            <button
                                onClick={() => { setViewMode('day_detail'); setSelectedDate(new Date()); }}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'day_detail' ? 'bg-white text-blue-600 scale-105' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <ListChecks size={20} />
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />
                            {!isViewer && (
                                <button
                                    onClick={() => setShowRotaWizard(true)}
                                    className="p-2 text-amber-500 hover:text-amber-600 transition-all active:scale-95"
                                    title="מחולל סבבים"
                                >
                                    <Wand2 size={20} />
                                </button>
                            )}
                        </div>

                        {/* Left Side: Back Button (Integrated into Header) */}
                        <div className="flex items-center">
                            {viewMode === 'day_detail' && (
                                <button
                                    onClick={handleBackToCalendar}
                                    className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors py-1 px-2"
                                >
                                    <ChevronRight size={22} />
                                    <span className="text-sm font-black">חודש</span>
                                </button>
                            )}
                            {viewMode === 'calendar' && (
                                <span className="text-sm font-black text-slate-300 mr-2">תצוגת יומן</span>
                            )}
                        </div>
                    </div>

                    {/* Date Navigator (Day/Month adaptive) */}
                    <div className="flex items-center justify-between px-1">
                        <button
                            onClick={() => {
                                if (viewMode === 'calendar') {
                                    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
                                } else {
                                    const next = new Date(selectedDate);
                                    next.setDate(selectedDate.getDate() - 1);
                                    setSelectedDate(next);
                                }
                            }}
                            className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-full border border-slate-200 shadow-sm active:scale-90 transition-transform"
                        >
                            <ChevronRight size={24} />
                        </button>

                        <div className="flex flex-col items-center flex-1 mx-2">
                            <span className="text-lg font-black text-slate-800 text-center leading-tight">
                                {viewMode === 'calendar'
                                    ? viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
                                    : selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'short' })
                                }
                            </span>
                            <button
                                onClick={() => {
                                    const now = new Date();
                                    setViewDate(now);
                                    setSelectedDate(now);
                                }}
                                className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full mt-1.5 border border-blue-100 uppercase tracking-tighter"
                            >
                                {viewMode === 'calendar' ? 'חודש נוכחי' : 'היום'}
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                if (viewMode === 'calendar') {
                                    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
                                } else {
                                    const next = new Date(selectedDate);
                                    next.setDate(selectedDate.getDate() + 1);
                                    setSelectedDate(next);
                                }
                            }}
                            className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 rounded-full border border-slate-200 shadow-sm active:scale-90 transition-transform"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Render (Mobile) */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                                organizationName={(settings as any)?.organization_name}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Search Bar */}
                            <div className="p-4 pb-2">
                                <Input
                                    placeholder="חיפוש לפי שם..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    icon={Search}
                                    className="bg-slate-50 border-slate-200"
                                />
                            </div>
                            <AttendanceTable
                                teams={teams}
                                people={filteredPeople}
                                teamRotations={teamRotations}
                                absences={absences}
                                currentDate={selectedDate}
                                onDateChange={setSelectedDate}
                                onSelectPerson={(p) => {
                                    if (isBulkMode) handleToggleSelectPerson(p.id);
                                    else setSelectedPersonForCalendar(p);
                                }}
                                onUpdateAvailability={handleUpdateAvailability}
                                className="h-full"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* --- DESKTOP VIEW CONTAINER --- */}
            <div className="hidden md:flex flex-col flex-1 overflow-hidden">
                {/* Desktop Header (Preserved) */}
                <div className="bg-white shadow-sm border-b border-slate-200 p-4 justify-between items-center shrink-0 z-20 relative flex">
                    <div className="flex items-center gap-4">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="text-idf-green" />
                            יומן נוכחות
                            <PageInfo
                                title="יומן נוכחות"
                                description={
                                    <>
                                        <p className="mb-2">כאן ניתן לראות ולנהל את זמינות הלוחמים.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>תצוגת לוח שנה:</b> מבט חודשי גלובלי על הסבבים והנוכחות.</li>
                                            <li><b>תצוגת רשימה:</b> ניהול מפורט של זמינות לכל לוחם ברמה היומית.</li>
                                            <li><b>סבבים:</b> הגדרת סבבי יציאות (11/3, חצאים וכו') לניהול מהיר.</li>
                                        </ul>
                                        <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                            הנתונים כאן משפיעים ישירות על יכולת השיבוץ של המערכת.
                                        </p>
                                    </>
                                }
                            />
                        </h2>
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <CalendarDays size={16} />
                                תצוגה לוח שנה
                            </button>
                            <button
                                onClick={() => setViewMode('day_detail')}
                                data-testid="list-view-btn"
                                className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'day_detail' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <ListChecks size={16} />
                                תצוגה רשימה
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Desktop Date Controls */}
                        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => {
                                    const d = viewMode === 'calendar' ? viewDate : selectedDate;
                                    const setter = viewMode === 'calendar' ? setViewDate : setSelectedDate;
                                    setter(new Date(d.getFullYear(), d.getMonth() - 1, 1));
                                }}
                                className="p-1 hover:bg-white rounded shadow-sm"
                            >
                                <ChevronRight size={18} />
                            </button>

                            <span className="font-bold min-w-[120px] text-center">
                                {(viewMode === 'calendar' ? viewDate : selectedDate).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}
                            </span>

                            <button
                                onClick={() => {
                                    const d = viewMode === 'calendar' ? viewDate : selectedDate;
                                    const setter = viewMode === 'calendar' ? setViewDate : setSelectedDate;
                                    setter(new Date(d.getFullYear(), d.getMonth() + 1, 1));
                                }}
                                className="p-1 hover:bg-white rounded shadow-sm"
                            >
                                <ChevronLeft size={18} />
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                const now = new Date();
                                setViewDate(now);
                                setSelectedDate(now);
                            }}
                            className="px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-bold transition-colors"
                        >
                            חודש נוכחי
                        </button>
                        {!isViewer && (
                            <button
                                onClick={() => setShowRotaWizard(true)}
                                data-testid="open-rota-wizard-btn"
                                className="px-3 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 border border-amber-100"
                            >
                                <Sparkles size={16} />
                                מחולל סבבים
                            </button>
                        )}
                        <button onClick={handleExport} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-bold transition-colors">ייצוא</button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col isolate z-10">
                    {/* Content Render (Desktop) */}
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col bg-white overflow-hidden">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                                organizationName={(settings as any)?.organization_name}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
                            <AttendanceTable
                                teams={teams}
                                people={filteredPeople}
                                teamRotations={teamRotations}
                                absences={absences}
                                currentDate={selectedDate}
                                onDateChange={setSelectedDate}
                                onSelectPerson={(p) => {
                                    if (isBulkMode) handleToggleSelectPerson(p.id);
                                    else setSelectedPersonForCalendar(p);
                                }}
                                onUpdateAvailability={isViewer ? undefined : handleUpdateAvailability}
                                className="h-full"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Modals & Overlays (Outside sheet flow or global) */}
            {showRotationSettings && (
                (() => {
                    const team = teams.find(t => t.id === showRotationSettings);
                    if (!team) return null;
                    return (
                        <RotationEditor
                            team={team}
                            existing={teamRotations.find(r => r.team_id === team.id)}
                            onClose={() => setShowRotationSettings(null)}
                            onAddRotation={onAddRotation}
                            onUpdateRotation={onUpdateRotation}
                            onDeleteRotation={onDeleteRotation}
                        />
                    );
                })()
            )}

            {selectedPersonForCalendar && !isBulkMode && (
                <PersonalAttendanceCalendar
                    person={selectedPersonForCalendar}
                    teamRotations={teamRotations}
                    absences={absences}
                    onClose={() => setSelectedPersonForCalendar(null)}
                    onUpdatePerson={onUpdatePerson}
                    isViewer={isViewer}
                />
            )}

            {editingPersonalRotation && !isBulkMode && (
                <PersonalRotationEditor
                    person={editingPersonalRotation}
                    isOpen={true}
                    onClose={() => setEditingPersonalRotation(null)}
                    onSave={handleUpdatePersonalRotation}
                />
            )}

            <BulkAttendanceModal
                isOpen={showBulkModal}
                onClose={() => setShowBulkModal(false)}
                onApply={handleBulkApply}
                selectedCount={selectedPersonIds.size}
            />

            {showRotaWizard && (
                <RotaWizardModal
                    isOpen={showRotaWizard}
                    onClose={() => setShowRotaWizard(false)}
                    people={people}
                    teams={teams}
                    tasks={tasks}
                    constraints={constraints}
                    absences={absences}
                    settings={settings}
                    teamRotations={teamRotations}
                    onSaveRoster={(roster: DailyPresence[]) => {
                        // Convert Roster to Person updates for immediate UI reflection
                        // onUpdatePeople(Array.from(updates.values())); // REMOVED: Prevent double-write. RotaWizardModal already handles the DB save and Invalidation.
                        // showToast('השיבוץ נטען לתצוגה', 'success');
                    }}
                />
            )}
        </div>
    );
};
