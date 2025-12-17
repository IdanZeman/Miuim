import React, { useState, useRef } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { Calendar, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Search, Settings, CalendarDays, ChevronDown, ArrowLeft, ArrowRight, CheckSquare, ListChecks, X } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { GlobalTeamCalendar } from './GlobalTeamCalendar';
import { RotationEditor } from './RotationEditor';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { Input } from './ui/Input';
import { AttendanceRow } from './AttendanceRow';
import { BulkAttendanceModal } from './BulkAttendanceModal';
import { useToast } from '../contexts/ToastContext';

interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
    teamRotations?: TeamRotation[];
    onUpdatePerson: (p: Person) => void;
    onUpdatePeople?: (people: Person[]) => void;
    onAddRotation?: (r: TeamRotation) => void;
    onUpdateRotation?: (r: TeamRotation) => void;
    onDeleteRotation?: (id: string) => void;
    isViewer?: boolean;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
    people, teams, teamRotations = [],
    onUpdatePerson, onUpdatePeople,
    onAddRotation, onUpdateRotation, onDeleteRotation,
    isViewer = false
}) => {
    const { showToast } = useToast();
    const [viewMode, setViewMode] = useState<'calendar' | 'day_detail'>('calendar');
    const [selectedDate, setSelectedDate] = useState(new Date());
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
                const availA = getEffectiveAvailability(a, selectedDate, teamRotations);
                const availB = getEffectiveAvailability(b, selectedDate, teamRotations);

                // Sort by Availability (Available first)
                if (availA.isAvailable && !availB.isAvailable) return -1;
                if (!availA.isAvailable && availB.isAvailable) return 1;

                // Secondary sort by name
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

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col relative">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-portal p-6 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0 transition-all">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-idf-green" />
                        יומן נוכחות וזמינות
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        {viewMode === 'calendar'
                            ? 'מבט על - נוכחות חודשית'
                            : `ניהול נוכחות ליום ${selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}`
                        }
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Buttons moved to secondary toolbar */}
                </div>
            </div>

            {/* Bulk Actions Header - Only visible in bulk mode */}
            {isBulkMode && (
                <div className="bg-blue-600 text-white rounded-xl shadow-lg p-4 flex justify-between items-center shrink-0 animate-fadeIn">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsBulkMode(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                            <X size={20} />
                        </button>
                        <span className="font-bold text-lg">{selectedPersonIds.size} נבחרו</span>
                        <button onClick={handleSelectAll} className="text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors">
                            {selectedPersonIds.size === filteredPeople.length ? 'בטל בחירה' : 'בחר הכל'}
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => selectedPersonIds.size > 0 && setShowBulkModal(true)}
                            disabled={selectedPersonIds.size === 0}
                            className={`px-3 py-2 rounded-lg text-blue-100 hover:bg-blue-700 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium ${selectedPersonIds.size === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="אפשרויות מתקדמות"
                        >
                            <Settings size={16} />
                            <span className="hidden md:inline">מתקדם</span>
                        </button>

                        <div className="h-6 w-px bg-blue-500 mx-2"></div>

                        <button
                            onClick={() => selectedPersonIds.size > 0 && handleQuickBulkUpdate(false)}
                            disabled={selectedPersonIds.size === 0}
                            className={`flex items-center gap-2 bg-red-100 text-red-700 hover:bg-red-200 px-4 py-2 rounded-lg transition-colors font-bold shadow-sm ${selectedPersonIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                            <XCircle size={18} />
                            לא נמצאים
                        </button>

                        <button
                            onClick={() => selectedPersonIds.size > 0 && handleQuickBulkUpdate(true)}
                            disabled={selectedPersonIds.size === 0}
                            className={`flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg transition-colors font-bold shadow-sm ${selectedPersonIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}`}
                        >
                            <CheckCircle2 size={18} />
                            נמצאים
                        </button>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-h-0">
                {viewMode === 'calendar' ? (
                    <GlobalTeamCalendar
                        teams={teams}
                        people={people}
                        teamRotations={teamRotations}
                        onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                        onDateClick={handleDateClick}
                    />
                ) : (
                    /* Day Detail View */
                    <div className="h-full flex flex-col space-y-4">
                        {/* Controls for Day View - Hide in bulk mode to reduce clutter? Or keep? Keeping for date nav. */}
                        {!isBulkMode && (
                            <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-100 shrink-0">
                                <div className="flex items-center gap-4">
                                    {/* Back Button (Right of Date) */}
                                    {viewMode === 'day_detail' && !isBulkMode && (
                                        <button
                                            onClick={handleBackToCalendar}
                                            className="flex items-center gap-2 text-slate-600 hover:bg-slate-50 px-3 py-1.5 rounded-lg transition-colors font-bold border border-transparent hover:border-slate-200"
                                            title="חזרה ללוח שנה"
                                        >
                                            <ArrowRight size={20} />
                                            <span className="hidden md:inline">חזרה ללוח</span>
                                        </button>
                                    )}

                                    <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-200">
                                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all">
                                            <ChevronRight size={18} />
                                        </button>

                                        <div className="relative flex items-center justify-center px-4 min-w-[140px] group cursor-pointer">
                                            <span className="text-lg font-bold text-slate-700 pointer-events-none">
                                                {selectedDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                            </span>
                                            <input
                                                ref={dateInputRef}
                                                type="date"
                                                value={dateKey}
                                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                            />
                                        </div>

                                        <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))} className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-600 transition-all">
                                            <ChevronLeft size={18} />
                                        </button>
                                    </div>

                                    {/* Bulk Edit Button (Left of Date) */}
                                    {viewMode === 'day_detail' && !isBulkMode && (
                                        <button
                                            onClick={() => setIsBulkMode(true)}
                                            className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors font-bold border border-slate-200"
                                        >
                                            <ListChecks size={18} />
                                            <span className="hidden md:inline">עריכה קבוצתית</span>
                                        </button>
                                    )}
                                </div>
                                <div className="w-full md:w-64">
                                    <Input
                                        placeholder="חיפוש לפי שם..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        icon={Search}
                                    />
                                </div>
                            </div>
                        )}

                        {/* List of People */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto custom-scrollbar flex-1">
                            <div className="p-4 space-y-6">
                                {peopleByTeam.map(({ team, members }) => (
                                    filteredPeople.length > 0 && (
                                        <div key={team.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                                            <div
                                                className={`p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors ${team.color.replace('border-', 'border-l-4 border-')}`}
                                                onClick={() => {
                                                    if (isBulkMode) {
                                                        // Select all in team?
                                                        const allSelected = members.every(m => selectedPersonIds.has(m.id));
                                                        const next = new Set(selectedPersonIds);
                                                        members.forEach(m => {
                                                            if (allSelected) next.delete(m.id);
                                                            else next.add(m.id);
                                                        });
                                                        setSelectedPersonIds(next);
                                                    } else {
                                                        toggleTeamCollapse(team.id);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {isBulkMode && (
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${members.every(m => selectedPersonIds.has(m.id)) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                            {members.every(m => selectedPersonIds.has(m.id)) && <CheckSquare size={14} />}
                                                        </div>
                                                    )}
                                                    <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                                                    <span className="bg-white px-2 py-1 rounded-full text-xs font-bold text-slate-500 border border-slate-200">
                                                        {members.length} לוחמים
                                                    </span>
                                                    {(() => {
                                                        const rot = teamRotations.find(r => r.team_id === team.id);
                                                        return rot ? (
                                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-full text-xs font-bold border border-blue-200 flex items-center gap-1">
                                                                <CalendarDays size={12} />
                                                                סבב {rot.days_on_base}-{rot.days_at_home}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {!isViewer && team.id !== 'no-team' && !isBulkMode && (
                                                        <button onClick={(e) => { e.stopPropagation(); setShowRotationSettings(team.id); }} className="p-1.5 hover:bg-white hover:text-blue-600 rounded-md text-slate-400 transition-all shadow-sm" title="הגדרות סבב">
                                                            <Settings size={18} />
                                                        </button>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); toggleTeamCollapse(team.id); }} className="p-1.5 hover:bg-white hover:text-slate-600 rounded-md text-slate-400 transition-all shadow-sm">
                                                        {collapsedTeams.has(team.id) ? <ChevronLeft size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </div>
                                            </div>

                                            {!collapsedTeams.has(team.id) && (
                                                <div className="divide-y divide-slate-100">
                                                    {members.map(person => {
                                                        const avail = getPersonAvailability(person);
                                                        return (
                                                            <div key={person.id} className="flex items-center">
                                                                {isBulkMode && (
                                                                    <div className="pl-4 pr-4">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedPersonIds.has(person.id)}
                                                                            onChange={() => handleToggleSelectPerson(person.id)}
                                                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                        />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1">
                                                                    <AttendanceRow
                                                                        person={person}
                                                                        availability={avail}
                                                                        onTogglePresence={handleTogglePresence}
                                                                        onTimeChange={handleTimeChange}
                                                                        onSelectPerson={(p) => {
                                                                            if (isBulkMode) {
                                                                                handleToggleSelectPerson(p.id);
                                                                            } else {
                                                                                setSelectedPersonForCalendar(p);
                                                                            }
                                                                        }}
                                                                        onEditRotation={(p) => setEditingPersonalRotation(p)}
                                                                        isViewer={isViewer || isBulkMode} // Disable row interactions in bulk mode
                                                                        teamColor={team.color} // NEW
                                                                    />
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
                    </div>
                )}
            </div>

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
                    onClose={() => setSelectedPersonForCalendar(null)}
                    onUpdatePerson={onUpdatePerson}
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
        </div>
    );
};
