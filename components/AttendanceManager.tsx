import React, { useState, useRef } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { Calendar, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Search, Settings, CalendarDays, ChevronDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { GlobalTeamCalendar } from './GlobalTeamCalendar';
import { RotationEditor } from './RotationEditor';
import { Input } from './ui/Input';
import { AttendanceRow } from './AttendanceRow';

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
    const [viewMode, setViewMode] = useState<'calendar' | 'day_detail'>('calendar');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [showRotationSettings, setShowRotationSettings] = useState<string | null>(null); // teamId or null
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);
    const [openSettingsForPerson, setOpenSettingsForPerson] = useState(false);
    const dateInputRef = useRef<HTMLInputElement>(null);

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

        const newIsAvailable = !currentData.isAvailable;
        let newData = {
            isAvailable: newIsAvailable,
            startHour: '00:00',
            endHour: '23:59',
            source: 'manual' // Explicitly mark as manual override
        };

        // If turning OFF, set times to 00:00
        if (!newIsAvailable) {
            newData.startHour = '00:00';
            newData.endHour = '00:00';
        }
        // Logic to preserve previous hours has been removed to enforce 00:00-23:59 default

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
                    source: 'manual' // Ensure source is set
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const filteredPeople = people.filter(p => p.name.includes(searchTerm));

    let peopleByTeam = teams.map(team => ({
        team,
        members: filteredPeople.filter(p => p.teamId === team.id)
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
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto h-[calc(100vh-140px)] flex flex-col">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-portal p-6 flex flex-col md:flex-row justify-between items-center gap-4 shrink-0">
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

                {viewMode === 'day_detail' && (
                    <button
                        onClick={handleBackToCalendar}
                        className="flex items-center gap-2 text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors font-bold"
                    >
                        <ArrowRight size={20} />
                        חזרה ללוח שנה
                    </button>
                )}
            </div>

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
                        {/* Controls for Day View */}
                        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col md:flex-row justify-between items-center gap-4 border border-slate-100 shrink-0">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))} className="p-2 hover:bg-slate-50 rounded-md text-slate-600 transition-colors border border-slate-200">
                                    <ChevronRight size={20} />
                                </button>

                                <div className="relative flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5 min-w-[160px] justify-center group hover:bg-white hover:border-blue-300 transition-colors">
                                    <span className="text-lg font-bold text-slate-700 pointer-events-none pl-6">
                                        {selectedDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                    <input
                                        ref={dateInputRef}
                                        type="date"
                                        value={dateKey}
                                        onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                    />
                                    <CalendarDays className="absolute left-3 text-slate-400 group-hover:text-blue-500 transition-colors pointer-events-none" size={16} />
                                </div>

                                <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))} className="p-2 hover:bg-slate-50 rounded-md text-slate-600 transition-colors border border-slate-200">
                                    <ChevronLeft size={20} />
                                </button>
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

                        {/* List of People */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-y-auto custom-scrollbar flex-1">
                            <div className="p-4 space-y-6">
                                {peopleByTeam.map(({ team, members }) => (
                                    filteredPeople.length > 0 && (
                                        <div key={team.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                                            <div
                                                className={`p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors ${team.color.replace('border-', 'border-l-4 border-')}`}
                                                onClick={() => toggleTeamCollapse(team.id)}
                                            >
                                                <div className="flex items-center gap-3">
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
                                                    {!isViewer && team.id !== 'no-team' && (
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
                                                            <AttendanceRow
                                                                key={person.id}
                                                                person={person}
                                                                availability={avail}
                                                                onTogglePresence={handleTogglePresence}
                                                                onTimeChange={handleTimeChange}
                                                                onSelectPerson={(p) => {
                                                                    setOpenSettingsForPerson(false);
                                                                    setSelectedPersonForCalendar(p);
                                                                }}
                                                                onEditRotation={(p) => {
                                                                    setOpenSettingsForPerson(true);
                                                                    setSelectedPersonForCalendar(p);
                                                                }}
                                                                isViewer={isViewer}
                                                            />
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

            {selectedPersonForCalendar && (
                <PersonalAttendanceCalendar
                    person={selectedPersonForCalendar}
                    teamRotations={teamRotations}
                    onClose={() => {
                        setSelectedPersonForCalendar(null);
                        setOpenSettingsForPerson(false);
                    }}
                    onUpdatePerson={onUpdatePerson}
                    initialShowSettings={openSettingsForPerson}
                />
            )}
        </div>
    );
};
