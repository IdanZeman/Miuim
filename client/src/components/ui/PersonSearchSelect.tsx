import React, { useState, useMemo } from 'react';
import { Person, Team } from '@/types';
import { MagnifyingGlass as Search, Check, User } from '@phosphor-icons/react';
import { Select } from './Select';

interface PersonSearchSelectProps {
    people: Person[];
    teams: Team[];
    value: string | null;
    onChange: (id: string | null) => void;
    placeholder?: string;
    className?: string;
}

export const PersonSearchSelect: React.FC<PersonSearchSelectProps> = ({
    people,
    teams,
    value,
    onChange,
    placeholder = "חפש חייל לפי שם...",
    className = ""
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState<string | 'all'>('all');

    const filteredPeople = useMemo(() => {
        return people.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesTeam = selectedTeamId === 'all' || p.teamId === selectedTeamId;
            return matchesSearch && matchesTeam;
        });
    }, [people, searchTerm, selectedTeamId]);

    const selectedPerson = people.find(p => p.id === value);

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="flex flex-col md:flex-row gap-2.5">
                <div className="relative flex-1">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} weight="bold" />
                    <input
                        type="text"
                        placeholder={placeholder}
                        className="w-full h-11 pr-11 pl-4 bg-slate-100/50 border border-transparent rounded-xl text-base font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-52">
                    <Select
                        value={selectedTeamId}
                        onChange={(val) => setSelectedTeamId(val)}
                        options={[{ value: 'all', label: 'כל הצוותים' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                        className="bg-slate-100/50 border-transparent rounded-xl h-11 text-base font-bold"
                    />
                </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-2xl divide-y divide-slate-50 custom-scrollbar bg-slate-50/30 shadow-inner shadow-slate-200/5">
                <button
                    onClick={() => onChange(null)}
                    className={`w-full text-right px-5 py-3 text-[13px] flex items-center justify-between transition-all active:scale-[0.99] ${value === null ? 'bg-indigo-50/80 text-indigo-700 font-black' : 'hover:bg-white text-slate-500 font-bold'}`}
                >
                    <span>ללא שיוך</span>
                    {value === null && <Check size={16} weight="bold" className="text-indigo-600" />}
                </button>
                {filteredPeople.map(p => {
                    const team = teams.find(t => t.id === p.teamId);
                    return (
                        <button
                            key={p.id}
                            onClick={() => onChange(p.id)}
                            className={`w-full text-right px-5 py-3 text-[13px] flex items-center justify-between transition-all active:scale-[0.99] ${value === p.id ? 'bg-indigo-50/80 text-indigo-700 font-black' : 'hover:bg-white text-slate-700 font-bold'}`}
                        >
                            <div className="flex flex-col text-right">
                                <span>{p.name}</span>
                                {team && <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">{team.name}</span>}
                            </div>
                            {value === p.id && <Check size={16} weight="bold" className="text-indigo-600" />}
                        </button>
                    );
                })}
                {filteredPeople.length === 0 && (
                    <div className="p-8 text-center text-slate-400 text-xs font-bold italic opacity-60">לא נמצאו תוצאות לחיפוש זה</div>
                )}
            </div>
            {selectedPerson && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-in slide-in-from-top-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <User size={12} weight="bold" />
                    </div>
                    <span className="text-[13px] font-black text-indigo-700">נבחר: {selectedPerson.name}</span>
                </div>
            )}
        </div>
    );
};
