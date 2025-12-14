import React, { useState, useRef } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Save, User, ChevronDown, Search, Settings, Plus, Trash2, CalendarDays } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { GlobalTeamCalendar } from './GlobalTeamCalendar'; // NEW

interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
    teamRotations?: TeamRotation[]; // NEW
    onUpdatePerson: (p: Person) => void;
    onUpdatePeople?: (people: Person[]) => void; // New optional prop for bulk updates
    onAddRotation?: (r: TeamRotation) => void;
    onUpdateRotation?: (r: TeamRotation) => void;
    onDeleteRotation?: (id: string) => void;
    isViewer?: boolean;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
    people, teams, teamRotations = [],
    onUpdatePerson, onUpdatePeople, onAddRotation, onUpdateRotation, onDeleteRotation,
    isViewer = false
}) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [showRotationSettings, setShowRotationSettings] = useState<string | null>(null); // teamId or null
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list'); // NEW
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Updated to use shared utility (removed local helper functions)
    // We pass teamRotations to the util so it can find the right one if teamId is provided or implicit in person
    const getPersonAvailability = (person: Person) => {
        return getEffectiveAvailability(person, selectedDate, teamRotations);
    };

    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const dateKey = selectedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD

    const handleTogglePresence = (person: Person) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        // Use generic "24/7" avail as base if toggling from false->true, otherwise invert current
        const newIsAvailable = !currentData.isAvailable;
        let newData = { isAvailable: newIsAvailable, startHour: '00:00', endHour: '23:59' };

        // Preserve hours if toggling back to true and we have them
        if (newIsAvailable && currentData.startHour) {
            newData.startHour = currentData.startHour;
            newData.endHour = currentData.endHour;
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
                    ...currentData, // Keep existing fields
                    isAvailable: true, // Ensure it's marked as available if we edit time
                    [field]: value
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const handleClearOverride = (person: Person) => {
        if (isViewer) return;
        if (!person.dailyAvailability || !person.dailyAvailability[dateKey]) return;

        const newDaily = { ...person.dailyAvailability };
        delete newDaily[dateKey]; // Remove the entry to revert to rotation/default

        onUpdatePerson({ ...person, dailyAvailability: newDaily });
    };

    const handleToggleTeamAvailability = (teamId: string, date: Date, isAvailable: boolean) => {
        if (isViewer) return;
        const dateKey = date.toLocaleDateString('en-CA');

        // Find all members of this team
        const teamMembers = people.filter(p => p.teamId === teamId);
        const peopleToUpdate: Person[] = [];

        teamMembers.forEach(person => {
            const currentData = getEffectiveAvailability(person, date, teamRotations);

            // Update if state is different
            if (currentData.isAvailable !== isAvailable) {
                const newData = {
                    isAvailable: isAvailable,
                    startHour: isAvailable ? (currentData.startHour === '00:00' ? '08:00' : currentData.startHour) : '00:00',
                    endHour: isAvailable ? (currentData.endHour === '00:00' ? '17:00' : currentData.endHour) : '00:00'
                };

                const updatedPerson = {
                    ...person,
                    dailyAvailability: {
                        ...person.dailyAvailability,
                        [dateKey]: newData
                    }
                };
                peopleToUpdate.push(updatedPerson);
            }
        });

        if (peopleToUpdate.length > 0) {
            if (onUpdatePeople) {
                onUpdatePeople(peopleToUpdate);
            } else {
                // Fallback for safety
                peopleToUpdate.forEach(onUpdatePerson);
            }
        }
    };

    // Rotation Management Logic
    const RotationEditor: React.FC<{ team: Team, existing?: TeamRotation, onClose: () => void }> = ({ team, existing, onClose }) => {
        // State for form
        const [daysOn, setDaysOn] = useState(existing?.days_on_base || 11);
        const [daysOff, setDaysOff] = useState(existing?.days_at_home || 3);
        const [anchorDate, setAnchorDate] = useState(existing?.start_date || new Date().toISOString().split('T')[0]);
        const [endDate, setEndDate] = useState(existing?.end_date || ''); // NEW
        const [arrTime, setArrTime] = useState(existing?.arrival_time || '10:00');
        const [depTime, setDepTime] = useState(existing?.departure_time || '14:00');

        const handleSave = () => {
            const rot: TeamRotation = {
                id: existing?.id || uuidv4(),
                organization_id: team.organization_id || '',
                team_id: team.id,
                days_on_base: daysOn,
                days_at_home: daysOff,
                cycle_length: daysOn + daysOff,
                start_date: anchorDate,
                end_date: endDate || undefined, // NEW
                arrival_time: arrTime,
                departure_time: depTime
            };

            if (existing) onUpdateRotation?.(rot);
            else onAddRotation?.(rot);
            onClose();
        };

        return (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-12 animate-fadeIn" onClick={onClose}>
                <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white text-slate-800">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <Settings size={20} className="text-slate-400" />
                            הגדרות סבב - {team.name}
                        </h3>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                            <XCircle size={24} />
                        </button>
                    </div>

                    <div className="p-6 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Guidance Note */}
                            <div className="md:col-span-2 bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-800 flex items-start gap-3">
                                <CalendarDays className="shrink-0 mt-0.5 text-blue-600" size={20} />
                                <div>
                                    <strong className="block text-blue-900 mb-1">הגדרת סבב יציאות:</strong>
                                    <p className="opacity-90 leading-relaxed">
                                        כאן מגדירים את המחזוריות הקבועה של הצוות. המערכת תחשב אוטומטית מי נמצא ומי בבית.<br />
                                        <strong>ימים בבסיס:</strong> כולל יום ההגעה עד יום היציאה.<br />
                                        <strong>תאריך התחלה:</strong> יום ההגעה הראשון שממנו מתחילים לספור את המחזור עבור *כל* הצוות.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ימים בבסיס</label>
                                    <div className="relative">
                                        <input type="number" value={daysOn} onChange={e => setDaysOn(parseInt(e.target.value))} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="11" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">ימים בבית</label>
                                    <div className="relative">
                                        <input type="number" value={daysOff} onChange={e => setDaysOff(parseInt(e.target.value))} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="3" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">תאריך התחלה (עוגן)</label>
                                    <input type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">תאריך סיום (אופציונלי)</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">שעת הגעה (יום 1)</label>
                                    <input type="time" value={arrTime} onChange={e => setArrTime(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm ltr-input focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1.5">שעת יציאה (יום אחרון)</label>
                                    <input type="time" value={depTime} onChange={e => setDepTime(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm ltr-input focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-4">
                        {existing ? (
                            <button onClick={() => onDeleteRotation?.(existing.id)} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                                <Trash2 size={16} /> מחק סבב
                            </button>
                        ) : <div></div>}

                        <div className="flex gap-3">
                            <button onClick={onClose} className="px-6 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg text-sm font-bold border border-transparent hover:border-slate-200 transition-all">ביטול</button>
                            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-lg flex items-center gap-2 transition-all">
                                <Save size={16} /> שמור הגדרות
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Group people by team
    const filteredPeople = people.filter(p => p.name.includes(searchTerm));

    // 1. Map existing teams
    let peopleByTeam = teams.map(team => ({
        team,
        members: filteredPeople.filter(p => p.teamId === team.id)
    }));

    // 2. Handle people without team
    const noTeamMembers = filteredPeople.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
    if (noTeamMembers.length > 0) {
        peopleByTeam.push({
            team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' },
            members: noTeamMembers
        });
    }

    // 3. Sort by size (Largest first)
    peopleByTeam.sort((a, b) => b.members.length - a.members.length);

    return (
        <div className="space-y-6">
            {/* Header & Date Control */}
            <div className="bg-white rounded-xl shadow-portal p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-idf-green" />
                        יומן נוכחות וזמינות
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">נהל את זמינות החיילים והגדר שעות פעילות לכל יום</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                    <button
                        onClick={() => setActiveTab('list')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        רשימת צוותים
                    </button>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeTab === 'calendar' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        לוח סבבים
                    </button>
                </div>
            </div>

            {/* Content Switcher */}
            {activeTab === 'list' ? (
                /* Original List View */
                <>
                    {/* Header & Date Control (Only for list view) */}
                    <div className="bg-white rounded-xl shadow-portal p-4 mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-100">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))} className="p-2 hover:bg-white rounded-md text-slate-600 transition-colors shadow-sm bg-slate-50 border border-slate-200">
                                <ChevronRight size={20} />
                            </button>

                            <div
                                className="relative flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5 min-w-[160px] justify-center group hover:bg-white hover:border-slate-300 transition-colors cursor-pointer"
                                onClick={() => dateInputRef.current?.showPicker()}
                            >
                                <span className="text-lg font-bold text-slate-700 pointer-events-none">
                                    {selectedDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={dateKey}
                                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                    className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                                />
                                <CalendarDays className="absolute left-3 text-slate-400 group-hover:text-blue-500 transition-colors pointer-events-none" size={16} />
                            </div>

                            <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))} className="p-2 hover:bg-white rounded-md text-slate-600 transition-colors shadow-sm bg-slate-50 border border-slate-200">
                                <ChevronLeft size={20} />
                            </button>

                            <button
                                onClick={() => setSelectedDate(new Date())}
                                className="mr-2 text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-md transition-colors border border-blue-100"
                            >
                                היום
                            </button>
                        </div>
                        <div className="relative w-full md:w-64">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="חיפוש לפי שם..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-4 pr-9 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {/* Teams Grid */}
                        <div className="grid grid-cols-1 gap-6">
                            {peopleByTeam.map(({ team, members }) => (
                                filteredPeople.length > 0 && (
                                    <div key={team.id} className="bg-white rounded-xl shadow-portal overflow-hidden border border-slate-100">
                                        <div
                                            className={`p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors ${team.color.replace('border-', 'border-l-4 border-')}`}
                                            onClick={() => toggleTeamCollapse(team.id)}
                                        >
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                                                <span className="bg-white px-2 py-1 rounded-full text-xs font-bold text-slate-500 border border-slate-200">
                                                    {members.length} לוחמים
                                                </span>
                                                {/* Rotation Badge */}
                                                {(() => {
                                                    const rot = teamRotations.find(r => r.team_id === team.id);
                                                    return rot ? (
                                                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-bold border border-blue-200 flex items-center gap-1">
                                                            <CalendarDays size={12} />
                                                            סבב {rot.days_on_base}-{rot.days_at_home}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-400">ללא סבב מוגדר</span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                                                {!isViewer && team.id !== 'no-team' && (
                                                    <>
                                                        <button onClick={(e) => { e.stopPropagation(); setShowRotationSettings(team.id); }} className="p-1.5 hover:bg-white hover:text-blue-600 rounded-md text-slate-400 transition-all shadow-sm" title="הגדרות סבב">
                                                            <Settings size={18} />
                                                        </button>
                                                    </>
                                                )}
                                                <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
                                                <button onClick={(e) => { e.stopPropagation(); toggleTeamCollapse(team.id); }} className="p-1.5 hover:bg-white hover:text-slate-600 rounded-md text-slate-400 transition-all shadow-sm">
                                                    {collapsedTeams.has(team.id) ? <ChevronLeft size={20} /> : <ChevronDown size={20} />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Settings Panel - Moved to top level */}

                                        {!collapsedTeams.has(team.id) && (
                                            <div className="divide-y divide-slate-100">
                                                {members.map(person => {
                                                    // Use getPersonAvailability instead of direct access
                                                    const avail = getPersonAvailability(person);
                                                    const isManualOverride = avail.source === 'manual';

                                                    // Visuals for status
                                                    let statusLabel = 'נוכח';
                                                    let statusColor = 'bg-green-100 text-green-700';

                                                    const availStatus = (avail as any).status; // Explicitly cast for now to avoid TS error

                                                    if (!avail.isAvailable) {
                                                        statusLabel = 'בבית';
                                                        statusColor = 'bg-slate-100 text-slate-500';
                                                    } else if (availStatus === 'arrival') {
                                                        statusLabel = 'חוזר לבסיס';
                                                        statusColor = 'bg-blue-100 text-blue-700';
                                                    } else if (availStatus === 'departure') {
                                                        statusLabel = 'יוצא הביתה';
                                                        statusColor = 'bg-orange-100 text-orange-700';
                                                    }

                                                    return (
                                                        <div key={person.id} className={`p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${avail.isAvailable ? 'bg-white' : 'bg-slate-50/50 opacity-90'}`}>
                                                            {/* Person Info */}
                                                            <div className="flex items-center gap-4 flex-1 w-full md:w-auto cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors group" onClick={() => setSelectedPersonForCalendar(person)}>
                                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} group-hover:ring-4 ring-slate-100 transition-all text-sm`}>
                                                                    {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                                </div>
                                                                <div className="flex flex-col justify-center">
                                                                    <div className="flex items-center gap-3 flex-wrap">
                                                                        <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{person.name}</h4>

                                                                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${statusColor} flex items-center gap-1 shadow-sm`}>
                                                                            {availStatus === 'arrival' && <ChevronLeft size={10} className="rotate-180" />}
                                                                            {availStatus === 'departure' && <ChevronRight size={10} className="rotate-180" />}
                                                                            {statusLabel}
                                                                        </span>

                                                                        {isManualOverride && (
                                                                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold" title="שינוי ידני חריג">
                                                                                ידני
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {/* Optional: Add Role subtitle here if available in future */}
                                                                </div>
                                                            </div>

                                                            {/* Controls */}
                                                            <div className="flex items-center gap-4">
                                                                {/* Times - Styled nicely */}
                                                                {avail.isAvailable && (
                                                                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">התחלה</span>
                                                                            <input
                                                                                type="time"
                                                                                value={avail.startHour}
                                                                                onChange={e => handleTimeChange(person, 'startHour', e.target.value)}
                                                                                className="bg-slate-50 rounded px-1 text-sm font-bold text-slate-700 w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 ltr-input"
                                                                                disabled={isViewer}
                                                                            />
                                                                        </div>
                                                                        <div className="w-px h-8 bg-slate-100 mx-1"></div>
                                                                        <div className="flex flex-col items-center">
                                                                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">סיום</span>
                                                                            <input
                                                                                type="time"
                                                                                value={avail.endHour}
                                                                                onChange={e => handleTimeChange(person, 'endHour', e.target.value)}
                                                                                className="bg-slate-50 rounded px-1 text-sm font-bold text-slate-700 w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 ltr-input"
                                                                                disabled={isViewer}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                {/* Status Toggle - Modern Pill Style */}
                                                                <div className="flex items-center gap-2">
                                                                    {isManualOverride && (
                                                                        <button onClick={() => handleClearOverride(person)} className="text-xs text-amber-600 hover:underline px-2" title="אפס לברירת מחדל">
                                                                            איפוס
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={() => handleTogglePresence(person)}
                                                                        className={`
                                                                    relative flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-all duration-200
                                                                    ${avail.isAvailable
                                                                                ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 hover:shadow-md'
                                                                                : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}
                                                                `}
                                                                        disabled={isViewer}
                                                                    >
                                                                        {avail.isAvailable ? (
                                                                            <>
                                                                                <CheckCircle2 size={16} className="text-green-600" />
                                                                                <span>נוכח</span>
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <XCircle size={16} />
                                                                                <span>לא נוכח</span>
                                                                            </>
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {members.length === 0 && <div className="p-8 text-center text-slate-400 italic">אין חיילים בצוות זה</div>}
                                            </div>
                                        )}
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                /* Global Calendar View */
                <GlobalTeamCalendar
                    teams={teams}
                    people={people}
                    teamRotations={teamRotations}
                    onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                    onToggleTeamAvailability={handleToggleTeamAvailability}
                />
            )}

            {/* Rotation Settings Modal */}
            {showRotationSettings && (
                (() => {
                    const team = teams.find(t => t.id === showRotationSettings);
                    if (!team) return null;
                    return (
                        <RotationEditor
                            team={team}
                            existing={teamRotations.find(r => r.team_id === team.id)}
                            onClose={() => setShowRotationSettings(null)}
                        />
                    );
                })()
            )}

            {/* Calendar Modal */}
            {selectedPersonForCalendar && (
                <PersonalAttendanceCalendar
                    person={selectedPersonForCalendar}
                    teamRotations={teamRotations}
                    onClose={() => setSelectedPersonForCalendar(null)}
                />
            )}
        </div>
    );
};
