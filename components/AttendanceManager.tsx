
import React, { useState } from 'react';
import { Person, Team } from '../types';
import { Calendar, Clock, CheckCircle2, XCircle, ChevronRight, ChevronLeft, Save, User } from 'lucide-react';

interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
    onUpdatePerson: (p: Person) => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({ people, teams, onUpdatePerson }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());

    const dateKey = selectedDate.toLocaleDateString('en-CA'); // YYYY-MM-DD

    const handleTogglePresence = (person: Person) => {
        // Default is 24/7 available
        const currentData = person.dailyAvailability?.[dateKey] || { isAvailable: true, startHour: '00:00', endHour: '23:59' };

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: {
                    ...currentData,
                    isAvailable: !currentData.isAvailable
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const handleTimeChange = (person: Person, field: 'startHour' | 'endHour', value: string) => {
        const currentData = person.dailyAvailability?.[dateKey] || { isAvailable: true, startHour: '00:00', endHour: '23:59' };

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: {
                    ...currentData,
                    [field]: value
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    // Group people by team
    const peopleByTeam = teams.map(team => ({
        team,
        members: people.filter(p => p.teamId === team.id)
    }));

    // Handle people without team
    const noTeamMembers = people.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
    if (noTeamMembers.length > 0) {
        peopleByTeam.push({
            team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' },
            members: noTeamMembers
        });
    }

    return (
        <div className="space-y-6">
            {/* Header & Date Control */}
            <div className="bg-white rounded-xl shadow-portal p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="text-idf-green" />
                        יומן נוכחות וזמינות
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">נהל את זמינות הלוחמים והגדר שעות פעילות לכל יום</p>
                </div>

                <div className="flex items-center bg-slate-100 rounded-full p-1">
                    <button onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() + 1);
                        setSelectedDate(d);
                    }} className="p-2 hover:bg-white rounded-full shadow-sm transition-all"><ChevronRight size={16} /></button>

                    <span className="px-4 text-sm font-bold text-slate-600 min-w-[140px] text-center">
                        {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>

                    <button onClick={() => {
                        const d = new Date(selectedDate);
                        d.setDate(d.getDate() - 1);
                        setSelectedDate(d);
                    }} className="p-2 hover:bg-white rounded-full shadow-sm transition-all"><ChevronLeft size={16} /></button>
                </div>
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 gap-6">
                {peopleByTeam.map(({ team, members }) => (
                    <div key={team.id} className="bg-white rounded-xl shadow-portal overflow-hidden border border-slate-100">
                        <div className={`p-4 border-b border-slate-100 bg-slate-50 flex items-center gap-3 ${team.color.replace('border-', 'border-l-4 border-')}`}>
                            <h3 className="font-bold text-lg text-slate-800">{team.name}</h3>
                            <span className="bg-white px-2 py-1 rounded-full text-xs font-bold text-slate-500 border border-slate-200">
                                {members.length} לוחמים
                            </span>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {members.map(person => {
                                const avail = person.dailyAvailability?.[dateKey] || { isAvailable: true, startHour: '00:00', endHour: '23:59' }; // Default state

                                return (
                                    <div key={person.id} className={`p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${avail.isAvailable ? 'bg-white' : 'bg-slate-50 opacity-75'}`}>
                                        {/* Person Info */}
                                        <div className="flex items-center gap-4 flex-1 w-full md:w-auto">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color}`}>
                                                {person.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{person.name}</h4>
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className={`px-2 py-0.5 rounded-full font-bold ${avail.isAvailable ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {avail.isAvailable ? 'נוכח' : 'נעדר'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Controls */}
                                        <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                            {avail.isAvailable ? (
                                                <div className="flex items-center gap-2 animate-fadeIn flex-wrap">
                                                    <div className="flex flex-col">
                                                        <label className="text-[10px] text-slate-400 font-bold">התחלה</label>
                                                        <input
                                                            type="time"
                                                            value={avail.startHour || '00:00'}
                                                            onChange={(e) => handleTimeChange(person, 'startHour', e.target.value)}
                                                            className="border border-slate-300 rounded p-1 text-sm w-32 focus:ring-2 focus:ring-idf-yellow outline-none text-right"
                                                            lang="he"
                                                        />
                                                    </div>
                                                    <span className="text-slate-300 mt-3">-</span>
                                                    <div className="flex flex-col">
                                                        <label className="text-[10px] text-slate-400 font-bold">סיום</label>
                                                        <input
                                                            type="time"
                                                            value={avail.endHour || '23:59'}
                                                            onChange={(e) => handleTimeChange(person, 'endHour', e.target.value)}
                                                            className="border border-slate-300 rounded p-1 text-sm w-32 focus:ring-2 focus:ring-idf-yellow outline-none text-right"
                                                            lang="he"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400 text-sm italic bg-slate-100 px-4 py-2 rounded-lg">
                                                    <XCircle size={16} />
                                                    לא זמין לשיבוץ ביום זה
                                                </div>
                                            )}

                                            <div className="w-px h-10 bg-slate-200 mx-2 hidden md:block"></div>

                                            <button
                                                onClick={() => handleTogglePresence(person)}
                                                className={`flex flex-col items-center justify-center w-20 p-2 rounded-lg transition-all border ${avail.isAvailable ? 'border-red-200 bg-red-50 hover:bg-red-100 text-red-700' : 'border-green-200 bg-green-50 hover:bg-green-100 text-green-700'}`}
                                            >
                                                {avail.isAvailable ? <XCircle size={20} /> : <CheckCircle2 size={20} />}
                                                <span className="text-[10px] font-bold mt-1">{avail.isAvailable ? 'סמן כנעדר' : 'סמן כנוכח'}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {members.length === 0 && <div className="p-8 text-center text-slate-400 italic">אין לוחמים בצוות זה</div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
