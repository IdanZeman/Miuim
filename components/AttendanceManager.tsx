import React, { useState, useRef } from 'react';
import { Person, Team, TeamRotation } from '../types';
import { Calendar, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Search, Settings, CalendarDays, ChevronDown } from 'lucide-react';
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
    isViewer = false
}) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [showRotationSettings, setShowRotationSettings] = useState<string | null>(null); // teamId or null
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);
    const [activeTab, setActiveTab] = useState<'list' | 'calendar'>('list');
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
        let newData = { isAvailable: newIsAvailable, startHour: '00:00', endHour: '23:59' };

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
                    ...currentData,
                    isAvailable: true,
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
        delete newDaily[dateKey];

        onUpdatePerson({ ...person, dailyAvailability: newDaily });
    };

    const handleToggleTeamAvailability = (teamId: string, date: Date, isAvailable: boolean) => {
        if (isViewer) return;
        const dateKey = date.toLocaleDateString('en-CA');

        const teamMembers = people.filter(p => p.teamId === teamId);
        const peopleToUpdate: Person[] = [];

        teamMembers.forEach(person => {
            const currentData = getEffectiveAvailability(person, date, teamRotations);

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
                peopleToUpdate.forEach(onUpdatePerson);
            }
        }
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

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
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

                            <div className="relative flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5 min-w-[160px] justify-center group hover:bg-white hover:border-slate-300 transition-colors">
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
                        <div className="w-full md:w-64">
                            <Input
                                placeholder="חיפוש לפי שם..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                icon={Search}
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

                                        {!collapsedTeams.has(team.id) && (
                                            <div className="divide-y divide-slate-100">
                                                {members.map(person => {
                                                    const avail = getPersonAvailability(person);
                                                    const isManualOverride = avail.source === 'manual';
                                                    let statusLabel = 'נוכח';
                                                    let statusColor = 'bg-green-100 text-green-700';
                                                    const availStatus = (avail as any).status;

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
                                                        <AttendanceRow
                                                            key={person.id}
                                                            person={person}
                                                            availability={avail}
                                                            onTogglePresence={handleTogglePresence}
                                                            onTimeChange={handleTimeChange}
                                                            onSelectPerson={setSelectedPersonForCalendar}
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
                </>
            ) : (
                <GlobalTeamCalendar
                    teams={teams}
                    people={people}
                    teamRotations={teamRotations}
                    onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                    onToggleTeamAvailability={handleToggleTeamAvailability}
                />
            )}

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

            {selectedPersonForCalendar && (
                <PersonalAttendanceCalendar
                    person={selectedPersonForCalendar}
                    teamRotations={teamRotations}
                    onClose={() => setSelectedPersonForCalendar(null)}
                    onUpdatePerson={onUpdatePerson}
                />
            )}
        </div>
    );
};
