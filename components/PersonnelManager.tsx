
import React, { useState } from 'react';
import { Person, Team, Role } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { Plus, Trash2, Shield, Users, Check, Pencil, Star, Heart, Truck, Syringe, Zap, Anchor, Target, Eye, Cpu, Cross } from 'lucide-react';

interface PersonnelManagerProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    onAddPerson: (p: Person) => void;
    onDeletePerson: (id: string) => void;
    onUpdatePerson?: (p: Person) => void;
    onAddTeam: (t: Team) => void;
    onUpdateTeam: (t: Team) => void;
    onDeleteTeam: (id: string) => void;
    onAddRole: (r: Role) => void;
    onDeleteRole: (id: string) => void;
    onUpdateRole?: (r: Role) => void;
}

type Tab = 'people' | 'teams' | 'roles';

const TEAM_COLORS = [
    'border-slate-500', 'border-red-500', 'border-orange-500',
    'border-amber-500', 'border-green-500', 'border-emerald-500',
    'border-teal-500', 'border-cyan-500', 'border-blue-500',
    'border-indigo-500', 'border-violet-500', 'border-purple-500',
    'border-fuchsia-500', 'border-pink-500', 'border-rose-500'
];

const ROLE_COLORS = [
    'bg-slate-100 text-slate-800', 'bg-red-100 text-red-800', 'bg-orange-100 text-orange-800',
    'bg-green-100 text-green-800', 'bg-blue-100 text-blue-800', 'bg-indigo-100 text-indigo-800',
    'bg-purple-100 text-purple-800', 'bg-pink-100 text-pink-800', 'bg-teal-100 text-teal-800'
];

const ROLE_ICONS: Record<string, React.ElementType> = {
    Shield, Star, Heart, Truck, Syringe, Zap, Anchor, Target, Eye, Cpu, Cross
};

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
    people,
    teams,
    roles,
    onAddPerson,
    onDeletePerson,
    onUpdatePerson,
    onAddTeam,
    onUpdateTeam,
    onDeleteTeam,
    onAddRole,
    onDeleteRole,
    onUpdateRole
}) => {
    const [activeTab, setActiveTab] = useState<Tab>('people');
    const [isAdding, setIsAdding] = useState(false);

    // Edit States
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

    // Form State
    const [newName, setNewName] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

    // Team/Role Form State
    const [newItemName, setNewItemName] = useState('');
    const [selectedColor, setSelectedColor] = useState(''); // Shared for Team/Role
    const [selectedIcon, setSelectedIcon] = useState('Shield'); // Only for Roles

    const handleSavePerson = () => {
        if (!newName || !selectedTeamId) return;

        // Calculate color based on the selected team
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        const teamColor = selectedTeam ? selectedTeam.color.replace('border-', 'bg-') : 'bg-slate-500';

        const personData: Person = {
            id: editingPersonId || Math.random().toString(36).substr(2, 9),
            name: newName,
            teamId: selectedTeamId,
            roleIds: selectedRoleIds,
            maxHoursPerWeek: 40,
            unavailableDates: [],
            preferences: { preferNight: false, avoidWeekends: false },
            color: teamColor
        };

        if (editingPersonId && onUpdatePerson) {
            // Update existing person with new data (including potentially new color from team)
            onUpdatePerson(personData);
        } else {
            // Add new person
            onAddPerson(personData);
        }

        closeForm();
    };

    const handleEditPersonClick = (p: Person) => {
        setNewName(p.name);
        setSelectedTeamId(p.teamId);
        setSelectedRoleIds(p.roleIds);
        setEditingPersonId(p.id);
        setActiveTab('people');
        setIsAdding(true);
    };

    const handleSaveTeam = () => {
        if (!newItemName) return;

        if (editingTeamId) {
            onUpdateTeam({
                id: editingTeamId,
                name: newItemName,
                color: selectedColor || TEAM_COLORS[0]
            });
        } else {
            onAddTeam({
                id: `team-${Date.now()}`,
                name: newItemName,
                color: selectedColor || TEAM_COLORS[0]
            });
        }
        closeForm();
    };

    const handleEditTeamClick = (t: Team) => {
        setNewItemName(t.name);
        setSelectedColor(t.color || TEAM_COLORS[0]);
        setEditingTeamId(t.id);
        setActiveTab('teams');
        setIsAdding(true);
    };

    const handleSaveRole = () => {
        if (!newItemName) return;

        const roleData: Role = {
            id: editingRoleId || `role-${Date.now()}`,
            name: newItemName,
            color: selectedColor || ROLE_COLORS[0],
            icon: selectedIcon
        };

        if (editingRoleId && onUpdateRole) {
            onUpdateRole(roleData);
        } else {
            onAddRole(roleData);
        }
        closeForm();
    };

    const handleEditRoleClick = (r: Role) => {
        setNewItemName(r.name);
        setSelectedColor(r.color);
        setSelectedIcon(r.icon || 'Shield');
        setEditingRoleId(r.id);
        setActiveTab('roles');
        setIsAdding(true);
    };

    const toggleRole = (id: string) => {
        if (selectedRoleIds.includes(id)) setSelectedRoleIds(prev => prev.filter(x => x !== id));
        else setSelectedRoleIds(prev => [...prev, id]);
    };

    const closeForm = () => {
        setIsAdding(false);
        setEditingTeamId(null);
        setEditingPersonId(null);
        setEditingRoleId(null);
        setNewItemName('');
        setNewName('');
        setSelectedTeamId('');
        setSelectedRoleIds([]);
        setSelectedColor('');
        setSelectedIcon('Shield');
    }

    return (
        <div className="bg-white rounded-xl shadow-portal p-6 min-h-[600px]">
            {/* Tabs Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-slate-100 gap-4">
                <div className="flex p-1 bg-slate-100 rounded-full">
                    <button onClick={() => { setActiveTab('people'); closeForm(); }} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'people' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>לוחמים</button>
                    <button onClick={() => { setActiveTab('teams'); closeForm(); }} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>צוותים</button>
                    <button onClick={() => { setActiveTab('roles'); closeForm(); }} className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${activeTab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>תפקידים</button>
                </div>
                <button onClick={() => { setIsAdding(true); setEditingTeamId(null); setEditingPersonId(null); setEditingRoleId(null); setNewItemName(''); setNewName(''); }} className="bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover px-5 py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center gap-2 transition-transform hover:scale-105">
                    <Plus size={18} /> הוסף חדש
                </button>
            </div>

            {/* Forms */}
            {isAdding && (
                <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fadeIn max-w-2xl mx-auto">
                    <h3 className="font-bold text-slate-800 mb-4 text-lg">
                        {editingTeamId ? 'עריכת צוות' : editingPersonId ? 'עריכת לוחם' : editingRoleId ? 'עריכת תפקיד' : `הוספת ${activeTab === 'people' ? 'לוחם' : activeTab === 'teams' ? 'צוות' : 'תפקיד'}`}
                    </h3>

                    {activeTab === 'people' ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם מלא" className="p-3 rounded-lg border border-slate-300 w-full focus:ring-2 focus:ring-idf-yellow outline-none" />
                                <select value={selectedTeamId} onChange={e => setSelectedTeamId(e.target.value)} className="p-3 rounded-lg border border-slate-300 w-full focus:ring-2 focus:ring-idf-yellow outline-none bg-white">
                                    <option value="">בחר צוות...</option>
                                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-500 mb-2">תפקידים:</label>
                                <div className="flex flex-wrap gap-2">
                                    {roles.map(r => (
                                        <button key={r.id} onClick={() => toggleRole(r.id)} className={`px-3 py-1 rounded-full text-xs border transition-all ${selectedRoleIds.includes(r.id) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'}`}>
                                            {r.name} {selectedRoleIds.includes(r.id) && <Check size={12} className="inline" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={handleSavePerson} className="px-6 py-2 bg-idf-yellow text-slate-900 rounded-full font-bold shadow-sm">{editingPersonId ? 'עדכן' : 'שמור'}</button>
                                <button onClick={closeForm} className="px-4 py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm font-medium">ביטול</button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="flex gap-2">
                                <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={`שם ה${activeTab === 'teams' ? 'צוות' : 'תפקיד'}`} className="flex-1 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none" />
                            </div>

                            {/* Color Picker for Teams */}
                            {activeTab === 'teams' && (
                                <div>
                                    <label className="block text-sm font-bold text-slate-500 mb-2">צבע צוות:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {TEAM_COLORS.map(colorClass => (
                                            <button
                                                key={colorClass}
                                                onClick={() => setSelectedColor(colorClass)}
                                                className={`w-6 h-6 rounded-full border-2 transition-all ${colorClass.replace('border-', 'bg-')} ${(selectedColor || TEAM_COLORS[0]) === colorClass ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Color & Icon Picker for Roles */}
                            {activeTab === 'roles' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-2">צבע תפקיד:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {ROLE_COLORS.map(colorClass => (
                                                <button
                                                    key={colorClass}
                                                    onClick={() => setSelectedColor(colorClass)}
                                                    className={`w-6 h-6 rounded-full border-2 border-transparent transition-all ${colorClass.split(' ')[0]} ${(selectedColor || ROLE_COLORS[0]) === colorClass ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-70 hover:opacity-100'}`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-500 mb-2">סמל (אייקון):</label>
                                        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                            {Object.entries(ROLE_ICONS).map(([name, Icon]) => (
                                                <button
                                                    key={name}
                                                    onClick={() => setSelectedIcon(name)}
                                                    className={`p-2 rounded-lg transition-all ${selectedIcon === name ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
                                                    title={name}
                                                >
                                                    <Icon size={18} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2 mt-2">
                                <button onClick={activeTab === 'teams' ? handleSaveTeam : handleSaveRole} className="px-6 py-2 bg-idf-yellow text-slate-900 rounded-lg font-bold shadow-sm">
                                    {editingTeamId || editingRoleId ? 'עדכן' : 'שמור'}
                                </button>
                                <button onClick={closeForm} className="px-4 text-slate-500 hover:bg-slate-200 rounded-lg font-medium">ביטול</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeTab === 'people' && people.map(person => {
                    const team = teams.find(t => t.id === person.teamId);
                    return (
                        <div key={person.id} className="bg-white border border-idf-card-border rounded-xl p-4 hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${person.color}`}>{getPersonInitials(person.name)}</div>
                                    <div>
                                        <h4 className="font-bold text-slate-800">{person.name}</h4>
                                        <span className="text-xs text-slate-500">{team?.name || 'ללא צוות'}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditPersonClick(person)} className="text-slate-400 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={16} /></button>
                                    <button onClick={() => onDeletePerson(person.id)} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-1">
                                {person.roleIds.map(rid => {
                                    const r = roles.find(role => role.id === rid);
                                    return r ? <span key={rid} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-100">{r.name}</span> : null;
                                })}
                            </div>
                        </div>
                    );
                })}

                {activeTab === 'teams' && teams.map(team => (
                    <div key={team.id} className={`bg-white border-l-4 rounded-xl p-6 flex justify-between items-center group hover:shadow-md transition-all ${team.color || 'border-slate-500'}`}>
                        <div className="flex items-center gap-3">
                            <div className="bg-slate-100 p-3 rounded-full text-slate-600"><Users size={20} /></div>
                            <h4 className="font-bold text-lg text-slate-800">{team.name}</h4>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEditTeamClick(team)} className="text-slate-400 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={18} /></button>
                            <button onClick={() => onDeleteTeam(team.id)} className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}

                {activeTab === 'roles' && roles.map(role => {
                    const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                    return (
                        <div key={role.id} className="bg-white border border-idf-card-border rounded-xl p-4 flex justify-between items-center group hover:border-purple-300 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${role.color || 'bg-slate-100 text-slate-600'}`}>
                                    <Icon size={18} />
                                </div>
                                <h4 className="font-bold text-slate-800">{role.name}</h4>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditRoleClick(role)} className="text-slate-400 hover:text-blue-500 p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={16} /></button>
                                <button onClick={() => onDeleteRole(role.id)} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
