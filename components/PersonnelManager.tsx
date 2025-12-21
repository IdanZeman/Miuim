import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronLeft, User, Users, Shield, Pencil, Trash2, FileSpreadsheet, X, Check, Download, Archive } from 'lucide-react';
import { Person, Team, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ExcelImportWizard } from './ExcelImportWizard';

interface PersonnelManagerProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    onAddPerson: (person: Person) => void;
    onDeletePerson: (id: string) => void;
    onUpdatePerson: (person: Person) => void;
    onAddTeam: (team: Team) => void;
    onUpdateTeam: (team: Team) => void;
    onDeleteTeam: (id: string) => void;
    onAddRole: (role: Role) => void;
    onDeleteRole: (id: string) => void;
    onUpdateRole: (role: Role) => void;
    initialTab?: 'people' | 'teams' | 'roles';
}

type Tab = 'people' | 'teams' | 'roles';

const ROLE_ICONS: Record<string, any> = {
    shield: Shield,
    users: Users,
    user: User,
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
    const { checkAccess } = useAuth();
    const canEdit = checkAccess('personnel', 'edit');
    const { showToast } = useToast();

    // -- State --
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [showInactive, setShowInactive] = useState(false); // NEW: Toggle inactive

    // Form/Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Editing IDs
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

    // Form Fields
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState(''); // NEW
    const [newItemActive, setNewItemActive] = useState(true); // NEW
    const [newTeamId, setNewTeamId] = useState('');
    const [newRoleIds, setNewRoleIds] = useState<string[]>([]);

    // Generic Items (Team/Role)
    const [newItemName, setNewItemName] = useState('');
    const [newItemColor, setNewItemColor] = useState('border-slate-500'); // Default for teams

    // -- Effects --
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const shouldOpen = localStorage.getItem('open_import_wizard');
            if (shouldOpen) {
                setIsImportWizardOpen(true);
                localStorage.removeItem('open_import_wizard');
            }
        }
    }, []);

    // -- Helpers --
    const getPersonInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const toggleTeamCollapse = (teamId: string) => {
        const newSet = new Set(collapsedTeams);
        if (newSet.has(teamId)) newSet.delete(teamId);
        else newSet.add(teamId);
        setCollapsedTeams(newSet);
    };

    const closeForm = () => {
        setIsModalOpen(false);
        setIsAdding(false);
        setEditingPersonId(null);
        setEditingTeamId(null);
        setEditingRoleId(null);
        setNewName('');
        setNewEmail('');
        setNewPhone(''); // NEW
        setNewItemActive(true); // NEW
        setNewTeamId('');
        setNewRoleIds([]);
        setNewItemName('');
    };

    // -- Handlers --
    const handleEditPersonClick = (person: Person) => {
        setEditingPersonId(person.id);
        setNewName(person.name);
        setNewEmail(person.email || '');
        setNewPhone(person.phone || ''); // NEW
        setNewItemActive(person.isActive !== false); // NEW
        setNewTeamId(person.teamId);
        setNewRoleIds(person.roleIds || []);
        setIsModalOpen(true);
    };

    const handleEditTeamClick = (team: Team) => {
        setEditingTeamId(team.id);
        setNewItemName(team.name);
        setNewItemColor(team.color);
        setIsModalOpen(true);
    };

    const handleEditRoleClick = (role: Role) => {
        setEditingRoleId(role.id);
        setNewItemName(role.name);
        setNewItemColor(role.color);
        setIsModalOpen(true);
    };

    const handleExport = () => {
        let csvContent = '';
        let fileName = '';

        if (activeTab === 'people') {
            const header = 'שם,צוות,תפקידים,טלפון,אימייל,סטטוס\n';
            const rows = people.map(p => {
                const teamName = teams.find(t => t.id === p.teamId)?.name || 'ללא צוות';
                const roleNames = (p.roleIds || [])
                    .map(id => roles.find(r => r.id === id)?.name)
                    .filter(Boolean)
                    .join(' | ');
                const status = p.isActive === false ? 'לא פעיל' : 'פעיל';
                // Escape commas in fields
                const safeName = p.name ? `"${p.name.replace(/"/g, '""')}"` : '';
                const safeTeam = `"${teamName.replace(/"/g, '""')}"`;
                const safeRoles = `"${roleNames.replace(/"/g, '""')}"`;

                return `${safeName},${safeTeam},${safeRoles},${p.phone || ''},${p.email || ''},${status}`;
            }).join('\n');
            csvContent = header + rows;
            fileName = `people_export_${new Date().toLocaleDateString('he-IL').replace(/\./g, '-')}.csv`;
        } else if (activeTab === 'teams') {
            const header = 'שם צוות,מספר חברים,צבע\n';
            const rows = teams.map(t => {
                const memberCount = people.filter(p => p.teamId === t.id).length;
                return `"${t.name}",${memberCount},${t.color}`;
            }).join('\n');
            csvContent = header + rows;
            fileName = `teams_export_${new Date().toLocaleDateString('he-IL').replace(/\./g, '-')}.csv`;
        } else if (activeTab === 'roles') {
            const header = 'שם תפקיד,מספר משובצים,צבע\n';
            const rows = roles.map(r => {
                const count = people.filter(p => (p.roleIds || []).includes(r.id)).length;
                return `"${r.name}",${count},${r.color}`;
            }).join('\n');
            csvContent = header + rows;
            fileName = `roles_export_${new Date().toLocaleDateString('he-IL').replace(/\./g, '-')}.csv`;
        }

        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkImport = (importedPeople: Person[]) => {
        importedPeople.forEach(p => onAddPerson(p));
        showToast(`גויסו בהצלחה ${importedPeople.length} חיילים`, 'success');
    };

    const handleSave = () => {
        if (activeTab === 'people') {
            if (!newName.trim()) { showToast('נא להזין שם', 'error'); return; }
            if (!newTeamId && teams.length > 0) { showToast('נא לבחור צוות', 'error'); return; }

            const personData: any = {
                name: newName,
                email: newEmail,
                phone: newPhone, // NEW
                isActive: newItemActive, // NEW
                teamId: newTeamId,
                roleIds: newRoleIds,
                maxHoursPerWeek: 40,
                unavailableDates: [],
                preferences: { preferNight: false, avoidWeekends: false },
                color: 'bg-blue-500' // Default
            };

            if (editingPersonId) {
                const person = people.find(p => p.id === editingPersonId);
                onUpdatePerson({ ...person, ...personData, id: editingPersonId } as Person);
                showToast('החייל עודכן בהצלחה', 'success');
            } else {
                onAddPerson({ ...personData, id: `person-${Date.now()}` } as Person);
                showToast('החייל נוסף בהצלחה', 'success');
            }
        }
        else if (activeTab === 'teams') {
            if (!newItemName.trim()) { showToast('נא להזין שם צוות', 'error'); return; }
            const teamData = { name: newItemName, color: newItemColor };
            if (editingTeamId) {
                onUpdateTeam({ ...teamData, id: editingTeamId });
                showToast('הצוות עודכן', 'success');
            } else {
                onAddTeam({ ...teamData, id: `team-${Date.now()}` });
                showToast('הצוות נוצר', 'success');
            }
        }
        else if (activeTab === 'roles') {
            if (!newItemName.trim()) { showToast('נא להזין שם תפקיד', 'error'); return; }
            const roleData = { name: newItemName, color: newItemColor };
            if (editingRoleId) {
                onUpdateRole({ ...roleData, id: editingRoleId });
                showToast('התפקיד עודכן', 'success');
            } else {
                onAddRole({ ...roleData, id: `role-${Date.now()}` });
                showToast('התפקיד נוצר', 'success');
            }
        }
        closeForm();
    };

    const getModalTitle = () => {
        if (activeTab === 'people') return editingPersonId ? 'עריכת חייל' : 'הוספת חייל חדש';
        if (activeTab === 'teams') return editingTeamId ? 'עריכת צוות' : 'הוספת צוות חדש';
        if (activeTab === 'roles') return editingRoleId ? 'עריכת תפקיד' : 'הוספת תפקיד חדש';
        return '';
    };

    // Use effect to open modal when state changes if needed, 
    // but we control it explicitly in click handlers
    useEffect(() => {
        if (isAdding) setIsModalOpen(true);
    }, [isAdding]);


    // ...

    const renderModalContent = () => {
        if (activeTab === 'people') {
            return (
                <div className="space-y-4">
                    <Input
                        label="שם מלא"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        placeholder="ישראל ישראלי"
                    />
                    <Input
                        label="טלפון נייד"
                        value={newPhone}
                        onChange={e => setNewPhone(e.target.value)}
                        placeholder="050-0000000"
                    />
                    <Input
                        label="אימייל"
                        value={newEmail}
                        onChange={e => setNewEmail(e.target.value)}
                        placeholder="email@example.com"
                    />
                    <div>
                        <Select
                            label="צוות"
                            value={newTeamId}
                            onChange={(val) => setNewTeamId(val)}
                            options={[{ value: '', label: 'בחר צוות...' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                            placeholder="בחר צוות..."
                            direction="top" // NEW
                        />
                    </div>
                    {/* Active Toggle */}
                    {editingPersonId && (
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${newItemActive ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setNewItemActive(!newItemActive)}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${newItemActive ? 'translate-x-(-4)' : 'translate-x-0'}`} />
                            </div>
                            <span className="font-bold text-slate-700">{newItemActive ? 'פעיל' : 'לא פעיל (בארכיון)'}</span>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">תפקידים</label>
                        <div className="flex flex-wrap gap-2">
                            {roles.map(role => {
                                const isSelected = newRoleIds.includes(role.id);
                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => {
                                            if (isSelected) setNewRoleIds(newRoleIds.filter(id => id !== role.id));
                                            else setNewRoleIds([...newRoleIds, role.id]);
                                        }}
                                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${isSelected ? 'bg-blue-100 border-blue-300 text-blue-700 font-bold' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-blue-300'}`}
                                    >
                                        {role.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    {/* Footer moved to prop */}
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <Input
                    label={`שם ${activeTab === 'teams' ? 'הצוות' : 'התפקיד'}`}
                    value={newItemName}
                    onChange={e => setNewItemName(e.target.value)}
                />

                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">צבע</label>
                    <div className="flex flex-wrap gap-3">
                        {[
                            { value: 'border-red-500', bg: 'bg-red-500' },
                            { value: 'border-orange-500', bg: 'bg-orange-500' },
                            { value: 'border-yellow-500', bg: 'bg-yellow-500' },
                            { value: 'border-green-500', bg: 'bg-green-500' },
                            { value: 'border-teal-500', bg: 'bg-teal-500' },
                            { value: 'border-blue-500', bg: 'bg-blue-500' },
                            { value: 'border-indigo-500', bg: 'bg-indigo-500' },
                            { value: 'border-purple-500', bg: 'bg-purple-500' },
                            { value: 'border-pink-500', bg: 'bg-pink-500' },
                            { value: 'border-slate-500', bg: 'bg-slate-500' },
                        ].map((color) => (
                            <button
                                key={color.value}
                                onClick={() => setNewItemColor(color.value)}
                                className={`w-8 h-8 rounded-full ${color.bg} transition-transform hover:scale-110 flex items-center justify-center ${newItemColor === color.value ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : ''}`}
                            >
                                {newItemColor === color.value && <Check size={14} className="text-white" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer moved to prop */}
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
                    {activeTab === 'people' && canEdit && (
                        /* Import Button */
                        <Button
                            variant="secondary"
                            onClick={() => setIsImportWizardOpen(true)}
                            icon={FileSpreadsheet}
                            className="flex-1 md:flex-none"
                        >
                            <span className="hidden md:inline">ייבוא</span>
                        </Button>
                    )}
                    {canEdit && (
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (activeTab === 'people' && teams.length === 0) {
                                    showToast('יש להגדיר צוותים לפני הוספת חיילים', 'error');
                                    setActiveTab('teams');
                                    return;
                                }
                                setIsAdding(true); setEditingTeamId(null); setEditingPersonId(null); setEditingRoleId(null); setNewItemName(''); setNewName(''); setNewEmail('');
                            }}
                            icon={Plus}
                            className="flex-1 md:flex-none"
                        >
                            <span className="md:hidden">הוסף</span>
                            <span className="hidden md:inline">הוסף חדש</span>
                        </Button>
                    )}
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm md:text-base"
                        title="ייצוא ל-Excel"
                    >
                        <Download size={18} />
                        <span className="hidden md:inline">ייצוא</span>
                    </button>
                    <div className="flex items-center gap-2 md:mr-4">
                        {/* Mobile: Toggle Button */}
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            className={`md:hidden p-2 rounded-lg transition-colors border ${showInactive ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}
                            title="הצג לא פעילים"
                        >
                            <Archive size={18} />
                        </button>

                        {/* Desktop: Checkbox */}
                        <label className="hidden md:flex text-xs font-bold text-slate-500 items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                            הצג לא פעילים
                        </label>
                    </div>
                </div>
            </div>

            {/* Content Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activeTab === 'people' && (
                    <div className="col-span-full space-y-6">
                        <div className="max-w-md mx-auto mb-6">
                            <Input
                                icon={Search}
                                placeholder="חפש לוחם..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        {teams.concat([{ id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' } as any]).map(team => {
                            const teamMembers = people
                                .filter(p => (team.id === 'no-team' ? !p.teamId : p.teamId === team.id))
                                .filter(p => !p.isActive ? showInactive : true) // Filter inactive
                                .filter(p => p.name.includes(searchTerm));
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
                                                <div key={person.id} className="bg-white border border-slate-100 rounded-xl p-3 md:p-4 hover:shadow-md transition-all group">
                                                    <div className="flex justify-between items-start">
                                                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm flex-shrink-0 ${team.color ? team.color.replace('border-', 'bg-') : person.color}`}>{getPersonInitials(person.name)}</div>
                                                            <div className="min-w-0 flex-1">
                                                                <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">
                                                                    {person.name}
                                                                    {person.isActive === false && <span className="mr-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">לא פעיל</span>}
                                                                </h4>
                                                                <span className="text-xs text-slate-500 truncate block">{person.email || 'אין אימייל'}</span>
                                                                <span className="text-xs text-slate-400 truncate block">{person.phone || ''}</span>
                                                            </div>
                                                        </div>
                                                        {canEdit && (
                                                            <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                <button onClick={() => handleEditPersonClick(person)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={14} /></button>
                                                                <button onClick={() => onDeletePerson(person.id)} className="text-slate-300 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={14} /></button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        {(person.roleIds || []).map(roleId => {
                                                            const role = roles.find(r => r.id === roleId);
                                                            if (!role) return null;
                                                            return (
                                                                <span key={role.id} className={`text-[10px] px-1.5 py-0.5 rounded-md ${role.color} text-slate-700 font-medium`}>
                                                                    {role.name}
                                                                </span>
                                                            );
                                                        })}
                                                        {/* Fallback for legacy single roleId if roleIds is empty but roleId exists */}
                                                        {(!person.roleIds || person.roleIds.length === 0) && person.roleId && (
                                                            (() => {
                                                                const role = roles.find(r => r.id === person.roleId);
                                                                return role ? (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${role.color} text-slate-700 font-medium`}>
                                                                        {role.name}
                                                                    </span>
                                                                ) : null;
                                                            })()
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {activeTab === 'teams' && teams.map(team => (
                    <div key={team.id} className={`bg-white border-l-4 rounded-xl p-4 md:p-6 flex justify-between items-center group hover:shadow-md transition-all ${team.color || 'border-slate-500'}`}>
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                            <div className="bg-slate-100 p-2 md:p-3 rounded-full text-slate-600 flex-shrink-0"><Users size={18} /></div>
                            <h4 className="font-bold text-base md:text-lg text-slate-800 truncate">{team.name}</h4>
                        </div>
                        {canEdit && (
                            <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => handleEditTeamClick(team)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={16} /></button>
                                <button onClick={() => onDeleteTeam(team.id)} className="text-slate-400 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={16} /></button>
                            </div>
                        )}
                    </div>
                ))}

                {activeTab === 'roles' && roles.map(role => {
                    const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                    return (
                        <div key={role.id} className="bg-white border border-idf-card-border rounded-xl p-3 md:p-4 flex justify-between items-center group hover:border-purple-300 transition-colors">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                <div className={`p-2 rounded-lg flex-shrink-0 ${role.color || 'bg-slate-100 text-slate-600'}`}>
                                    <Icon size={16} />
                                </div>
                                <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">{role.name}</h4>
                            </div>
                            {canEdit && (
                                <div className="flex items-center gap-1 md:gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0">
                                    <button onClick={() => handleEditRoleClick(role)} className="text-slate-400 hover:text-blue-500 p-1 md:p-1.5 hover:bg-blue-50 rounded-full"><Pencil size={14} /></button>
                                    <button onClick={() => onDeleteRole(role.id)} className="text-slate-300 hover:text-red-500 p-1 md:p-1.5 hover:bg-red-50 rounded-full"><Trash2 size={14} /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={closeForm}
                title={getModalTitle()}
                size="md"
                footer={(
                    <div className="flex justify-end gap-2 w-full">
                        <Button variant="ghost" onClick={closeForm}>ביטול</Button>
                        <Button variant="primary" onClick={handleSave}>שמור</Button>
                    </div>
                )}
            >
                {renderModalContent()}
            </Modal>

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
