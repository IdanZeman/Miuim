import React, { useState } from 'react';
import { Person, Team, Role } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { Plus, Trash2, Shield, Users, Check, Pencil, Star, Heart, Truck, Syringe, Zap, Anchor, Target, Eye, Cpu, Cross, FileSpreadsheet, ChevronDown, ChevronLeft } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { Select } from './ui/Select';
import { ExcelImportWizard } from './ExcelImportWizard';

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
    initialTab?: 'people' | 'teams' | 'roles';
}

type Tab = 'people' | 'teams' | 'roles';

const TEAM_COLORS = [
    'border-blue-500', 'border-green-500', 'border-purple-500', 'border-orange-500', 'border-pink-500',
    'border-teal-500', 'border-indigo-500', 'border-cyan-500', 'border-rose-500', 'border-amber-500'
];

const ROLE_COLORS = [
    'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700',
    'bg-orange-100 text-orange-700', 'bg-pink-100 text-pink-700', 'bg-teal-100 text-teal-700',
    'bg-indigo-100 text-indigo-700', 'bg-cyan-100 text-cyan-700', 'bg-rose-100 text-rose-700',
    'bg-amber-100 text-amber-700'
];

const ROLE_ICONS: Record<string, any> = {
    Shield, Users, Check, Pencil, Star, Heart, Truck, Syringe, Zap, Anchor, Target, Eye, Cpu, Cross
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
    onUpdateRole,
    initialTab = 'people'
}) => {
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const { showToast } = useToast();
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);

    // Update active tab when initialTab prop changes
    React.useEffect(() => {
        if (initialTab) {
            if (initialTab === 'people' && teams.length === 0) {
                showToast('יש להגדיר צוותים לפני צפייה בחיילים', 'error');
                setActiveTab('teams');
            } else {
                setActiveTab(initialTab);
            }
        }
    }, [initialTab, teams.length, showToast]);

    const [isAdding, setIsAdding] = useState(false);


    // Edit States
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

    // Form State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

    // Team/Role Form State
    const [newItemName, setNewItemName] = useState('');
    const [selectedColor, setSelectedColor] = useState(''); // Shared for Team/Role
    const [selectedIcon, setSelectedIcon] = useState('Shield'); // Only for Roles
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const handleSavePerson = () => {
        if (!newName || !selectedTeamId) return;

        // Calculate color based on the selected team
        const selectedTeam = teams.find(t => t.id === selectedTeamId);
        const teamColor = selectedTeam ? selectedTeam.color.replace('border-', 'bg-') : 'bg-slate-500';

        const personData: Person = {
            id: editingPersonId || Math.random().toString(36).substr(2, 9),
            name: newName,
            email: newEmail,
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
        setNewEmail(p.email || '');
        setSelectedTeamId(p.teamId);
        setSelectedRoleIds(p.roleIds);
        setEditingPersonId(p.id);
        setActiveTab('people');
        setIsAdding(false); // Don't show top form
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
        setIsAdding(false); // Don't show top form
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
        setIsAdding(false); // Don't show top form
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
        setNewItemName('');
        setNewName('');
        setNewEmail('');
        setSelectedTeamId('');
        setSelectedRoleIds([]);
        setSelectedColor('');
        setSelectedIcon('Shield');
    }

    const handleBulkImport = (newPeople: Person[]) => {
        newPeople.forEach(p => onAddPerson(p));
        showToast(`נוספו ${newPeople.length} חיילים בהצלחה`, 'success');
    };

    // Render inline form component
    const renderEditForm = (type: 'person' | 'team' | 'role', itemId: string) => {
        if (type === 'person' && editingPersonId !== itemId) return null;
        if (type === 'team' && editingTeamId !== itemId) return null;
        if (type === 'role' && editingRoleId !== itemId) return null;

        return (
            <div className="col-span-full mb-4 bg-slate-50 p-4 md:p-6 rounded-xl border-2 border-idf-yellow animate-fadeIn">
                <h3 className="font-bold text-slate-800 mb-4 text-base md:text-lg">
                    {type === 'person' ? 'עריכת חייל' : type === 'team' ? 'עריכת צוות' : 'עריכת תפקיד'}
                </h3>

                {type === 'person' ? (
                    <div className="space-y-3 md:space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם מלא" className="p-2 md:p-3 rounded-lg border border-slate-300 w-full text-sm md:text-base" />
                            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="אימייל (אופציונלי)" className="p-2 md:p-3 rounded-lg border border-slate-300 w-full text-sm md:text-base" />
                            <Select
                                value={selectedTeamId}
                                onChange={setSelectedTeamId}
                                options={teams.map(t => ({ value: t.id, label: t.name }))}
                                placeholder="בחר צוות..."
                                className="bg-white md:col-span-2"
                            />
                        </div>
                        <div>
                            <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">תפקידים:</label>
                            <div className="flex flex-wrap gap-2">
                                {roles.map(r => (
                                    <button key={r.id} onClick={() => toggleRole(r.id)} className={`px-2 md:px-3 py-1 rounded-full text-xs border ${selectedRoleIds.includes(r.id) ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                                        {r.name} {selectedRoleIds.includes(r.id) && <Check size={12} className="inline" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={handleSavePerson} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">עדכן</button>
                            <button onClick={closeForm} className="px-3 md:px-4 py-1.5 md:py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm">ביטול</button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3 md:space-y-4">
                        <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={`שם ה${type === 'team' ? 'צוות' : 'תפקיד'}`} className="w-full p-2 md:p-3 rounded-lg border border-slate-300 text-sm md:text-base" />

                        {type === 'team' && (
                            <div>
                                <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">צבע צוות:</label>
                                <div className="flex flex-wrap gap-2">
                                    {TEAM_COLORS.map(colorClass => (
                                        <button key={colorClass} onClick={() => setSelectedColor(colorClass)} className={`w-6 h-6 rounded-full ${colorClass.replace('border-', 'bg-')} ${selectedColor === colorClass ? 'ring-2 ring-offset-2 ring-slate-800' : 'opacity-70'}`} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {type === 'role' && (
                            <>
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">צבע תפקיד:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {ROLE_COLORS.map(colorClass => (
                                            <button key={colorClass} onClick={() => setSelectedColor(colorClass)} className={`w-6 h-6 rounded-full ${colorClass.split(' ')[0]} ${selectedColor === colorClass ? 'ring-2 ring-offset-2 ring-slate-800' : 'opacity-70'}`} />
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">סמל:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(ROLE_ICONS).map(([name, Icon]) => (
                                            <button key={name} onClick={() => setSelectedIcon(name)} className={`p-2 rounded-lg ${selectedIcon === name ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                                <Icon size={16} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        <div className="flex justify-end gap-2">
                            <button onClick={type === 'team' ? handleSaveTeam : handleSaveRole} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">עדכן</button>
                            <button onClick={closeForm} className="px-3 md:px-4 py-1.5 md:py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm">ביטול</button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-xl shadow-portal p-4 md:p-6 min-h-[600px]">
            {/* Tabs Header */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 md:mb-8 pb-4 border-b border-slate-100 gap-4">
                <div className="flex p-1 bg-slate-100 rounded-full w-full md:w-auto">
                    <button onClick={() => {
                        if (teams.length === 0) {
                            showToast('יש להגדיר צוותים לפני צפייה בחיילים', 'error');
                            return;
                        }
                        setActiveTab('people'); closeForm();
                    }} className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${activeTab === 'people' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>חיילים</button>
                    <button onClick={() => { setActiveTab('teams'); closeForm(); }} className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${activeTab === 'teams' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>צוותים</button>
                    <button onClick={() => { setActiveTab('roles'); closeForm(); }} className={`flex-1 md:flex-initial px-4 md:px-6 py-2 rounded-full text-xs md:text-sm font-bold transition-all ${activeTab === 'roles' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>תפקידים</button>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    {activeTab === 'people' && (
                        /* Import Button */
                        <button onClick={() => setIsImportWizardOpen(true)} className="flex-1 md:flex-none bg-green-100 text-green-800 hover:bg-green-200 px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center justify-center gap-2 transition-colors">
                            ייבוא <FileSpreadsheet size={18} />
                        </button>
                    )}
                    <button onClick={() => {
                        if (activeTab === 'people' && teams.length === 0) {
                            showToast('יש להגדיר צוותים לפני הוספת חיילים', 'error');
                            setActiveTab('teams');
                            return;
                        }
                        setIsAdding(true); setEditingTeamId(null); setEditingPersonId(null); setEditingRoleId(null); setNewItemName(''); setNewName(''); setNewEmail('');
                    }} className="flex-1 md:flex-none bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover px-4 md:px-5 py-2 md:py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center justify-center gap-2">
                        הוסף חדש <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Top Form - Only for "Add New" */}
            {isAdding && !editingPersonId && !editingTeamId && !editingRoleId && (
                <div className="mb-6 md:mb-8 bg-slate-50 p-4 md:p-6 rounded-xl border border-slate-200 animate-fadeIn">
                    <h3 className="font-bold text-slate-800 mb-4 text-base md:text-lg">
                        {`הוספת ${activeTab === 'people' ? 'לוחם' : activeTab === 'teams' ? 'צוות' : 'תפקיד'}`}
                    </h3>

                    {activeTab === 'people' ? (
                        <div className="space-y-3 md:space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם מלא" className="p-2 md:p-3 rounded-lg border border-slate-300 w-full text-sm md:text-base" />
                                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="אימייל (אופציונלי)" className="p-2 md:p-3 rounded-lg border border-slate-300 w-full text-sm md:text-base" />
                                <Select
                                    value={selectedTeamId}
                                    onChange={setSelectedTeamId}
                                    options={teams.map(t => ({ value: t.id, label: t.name }))}
                                    placeholder="בחר צוות..."
                                    className="bg-white md:col-span-2"
                                />
                            </div>
                            <div>
                                <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">תפקידים:</label>
                                <div className="flex flex-wrap gap-2">
                                    {roles.map(r => (
                                        <button key={r.id} onClick={() => toggleRole(r.id)} className={`px-2 md:px-3 py-1 rounded-full text-xs border ${selectedRoleIds.includes(r.id) ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                                            {r.name} {selectedRoleIds.includes(r.id) && <Check size={12} className="inline" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={handleSavePerson} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">שמור</button>
                                <button onClick={closeForm} className="px-3 md:px-4 py-1.5 md:py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm">ביטול</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 md:space-y-4">
                            <input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder={`שם ה${activeTab === 'teams' ? 'צוות' : 'תפקיד'}`} className="w-full p-2 md:p-3 rounded-lg border border-slate-300 text-sm md:text-base" />

                            {activeTab === 'teams' && (
                                <div>
                                    <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">צבע צוות:</label>
                                    <div className="flex flex-wrap gap-2">
                                        {TEAM_COLORS.map(colorClass => (
                                            <button key={colorClass} onClick={() => setSelectedColor(colorClass)} className={`w-6 h-6 rounded-full ${colorClass.replace('border-', 'bg-')} ${(selectedColor || TEAM_COLORS[0]) === colorClass ? 'ring-2 ring-offset-2 ring-slate-800' : 'opacity-70'}`} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'roles' && (
                                <>
                                    <div>
                                        <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">צבע תפקיד:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {ROLE_COLORS.map(colorClass => (
                                                <button key={colorClass} onClick={() => setSelectedColor(colorClass)} className={`w-6 h-6 rounded-full ${colorClass.split(' ')[0]} ${(selectedColor || ROLE_COLORS[0]) === colorClass ? 'ring-2 ring-offset-2 ring-slate-800' : 'opacity-70'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs md:text-sm font-bold text-slate-500 mb-2">סמל:</label>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(ROLE_ICONS).map(([name, Icon]) => (
                                                <button key={name} onClick={() => setSelectedIcon(name)} className={`p-2 rounded-lg ${selectedIcon === name ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                                                    <Icon size={16} />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="flex justify-end gap-2">
                                <button onClick={activeTab === 'teams' ? handleSaveTeam : handleSaveRole} className="px-4 md:px-6 py-1.5 md:py-2 bg-idf-yellow text-slate-900 rounded-full font-bold text-sm md:text-base">שמור</button>
                                <button onClick={closeForm} className="px-3 md:px-4 py-1.5 md:py-2 text-slate-500 hover:bg-slate-200 rounded-full text-sm">ביטול</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content Lists */}
            {/* Content Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activeTab === 'people' && (
                    <div className="col-span-full space-y-6">
                        {teams.concat([{ id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' } as any]).map(team => {
                            const teamMembers = people.filter(p => (team.id === 'no-team' ? !p.teamId : p.teamId === team.id));
                            if (teamMembers.length === 0) return null;
                            const isCollapsed = collapsedTeams.has(team.id);

                            return (
                                <div key={team.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                    <div
                                        className="p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => toggleTeamCollapse(team.id)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1 h-6 rounded-full ${team.color?.replace('border-', 'bg-') || 'bg-slate-300'}`}></div>
                                            <h3 className="font-bold text-slate-800 text-base md:text-lg">{team.name}</h3>
                                            <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 border border-slate-200">
                                                {teamMembers.length}
                                            </span>
                                        </div>
                                        <button className="text-slate-400">
                                            {isCollapsed ? <ChevronLeft size={20} /> : <ChevronDown size={20} />}
                                        </button>
                                    </div>

                                    {!isCollapsed && (
                                        <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-200">
                                            {teamMembers.map(person => (
                                                <React.Fragment key={person.id}>
                                                    <div className="bg-white border border-slate-100 rounded-xl p-3 md:p-4 hover:shadow-md transition-all group">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm flex-shrink-0 ${person.color}`}>{getPersonInitials(person.name)}</div>
                                                                <div className="min-w-0 flex-1">
                                                                    <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">{person.name}</h4>
                                                                    <span className="text-xs text-slate-500 truncate block">{person.email || 'אין אימייל'}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                <button onClick={() => handleEditPersonClick(person)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={14} /></button>
                                                                <button onClick={() => onDeletePerson(person.id)} className="text-slate-300 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={14} /></button>
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 md:mt-3 flex flex-wrap gap-1">
                                                            {person.roleIds.map(rid => {
                                                                const r = roles.find(role => role.id === rid);
                                                                return r ? <span key={rid} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-100">{r.name}</span> : null;
                                                            })}
                                                        </div>
                                                    </div>
                                                    {renderEditForm('person', person.id)}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'teams' && teams.map(team => (
                    <React.Fragment key={team.id}>
                        <div className={`bg-white border-l-4 rounded-xl p-4 md:p-6 flex justify-between items-center group hover:shadow-md transition-all ${team.color || 'border-slate-500'}`}>
                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                <div className="bg-slate-100 p-2 md:p-3 rounded-full text-slate-600 flex-shrink-0"><Users size={18} /></div>
                                <h4 className="font-bold text-base md:text-lg text-slate-800 truncate">{team.name}</h4>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleEditTeamClick(team)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={16} /></button>
                                <button onClick={() => onDeleteTeam(team.id)} className="text-slate-400 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                            </div>
                        </div>
                        {renderEditForm('team', team.id)}
                    </React.Fragment>
                ))}

                {activeTab === 'roles' && roles.map(role => {
                    const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                    return (
                        <React.Fragment key={role.id}>
                            <div className="bg-white border border-idf-card-border rounded-xl p-3 md:p-4 flex justify-between items-center group hover:border-purple-300 transition-colors">
                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                    <div className={`p-2 rounded-lg flex-shrink-0 ${role.color || 'bg-slate-100 text-slate-600'}`}>
                                        <Icon size={16} />
                                    </div>
                                    <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">{role.name}</h4>
                                </div>
                                <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={() => handleEditRoleClick(role)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={14} /></button>
                                    <button onClick={() => onDeleteRole(role.id)} className="text-slate-300 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={14} /></button>
                                </div>
                            </div>
                            {renderEditForm('role', role.id)}
                        </React.Fragment>
                    );
                })}
            </div>
            <ExcelImportWizard
                isOpen={isImportWizardOpen}
                onClose={() => setIsImportWizardOpen(false)}
                onImport={handleBulkImport}
                teams={teams}
                roles={roles}
                onAddTeam={onAddTeam}
                onAddRole={onAddRole}
            />
        </div>
    );
};
