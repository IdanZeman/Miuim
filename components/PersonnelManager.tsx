import React, { useState, useEffect } from 'react';
import { Search, Plus, ChevronDown, ChevronLeft, User, Users, Shield, Pencil, Trash2, FileSpreadsheet, X, Check, Download, Archive, AlertTriangle, Loader2, Filter, ArrowUpDown, ArrowDownAZ, ArrowUpZA, Layers, LayoutList } from 'lucide-react';
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
    const [showInactive, setShowInactive] = useState(false);

    // Filters
    const [filterTeamId, setFilterTeamId] = useState<string>('all');
    const [filterRoleId, setFilterRoleId] = useState<string>('all');
    const [filterCustomField, setFilterCustomField] = useState<string>('all');
    const [filterCustomValue, setFilterCustomValue] = useState<string>('');

    // NEW: Advanced View/Sort State
    const [viewGroupBy, setViewGroupBy] = useState<'teams' | 'roles' | 'none'>('teams');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [showFilters, setShowFilters] = useState(false);

    // Form/Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Editing IDs
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

    // Import Results Modal State
    const [importResults, setImportResults] = useState<{ added: number; updated: number; failed: number; errors: { name: string; error: string }[] } | null>(null);

    const [isSaving, setIsSaving] = useState(false); // NEW: Loading state

    // Form Fields
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState(''); // NEW
    const [newItemActive, setNewItemActive] = useState(true); // NEW
    const [newTeamId, setNewTeamId] = useState('');
    const [newRoleIds, setNewRoleIds] = useState<string[]>([]);
    const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});
    const [newIsCommander, setNewIsCommander] = useState(false); // NEW
    const [tempCustomKey, setTempCustomKey] = useState(''); // NEW // NEW

    // Generic Items (Team/Role)
    const [newItemName, setNewItemName] = useState('');
    const [newItemColor, setNewItemColor] = useState('border-slate-500'); // Default for teams

    // NEW: Bulk Selection
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    // NEW: Duplicate Warning State
    const [duplicateWarning, setDuplicateWarning] = useState<{ person: Person, isOpen: boolean } | null>(null);

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

    // Clear selection on tab change
    useEffect(() => {
        setSelectedItemIds(new Set());
    }, [activeTab]);

    // -- Helpers --
    const getPersonInitials = (name: string) => {
        const parts = name.split(' ');
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return name.slice(0, 2).toUpperCase();
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedItemIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedItemIds(newSet);
    };

    const handleBulkDelete = () => {
        if (selectedItemIds.size === 0) return;

        if (window.confirm(`האם אתה בטוח שברצונך למחוק ${selectedItemIds.size} פריטים?`)) {
            selectedItemIds.forEach(id => {
                if (activeTab === 'people') onDeletePerson(id);
                else if (activeTab === 'teams') onDeleteTeam(id);
                else if (activeTab === 'roles') onDeleteRole(id);
            });
            setSelectedItemIds(new Set());
            showToast('הפריטים נמחקו בהצלחה', 'success');
        }
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
        setDuplicateWarning(null);
        setEditingPersonId(null);
        setEditingTeamId(null);
        setEditingRoleId(null);
        setNewName('');
        setNewEmail('');
        setNewPhone(''); // NEW
        setNewItemActive(true); // NEW
        setNewTeamId('');
        setNewRoleIds([]);
        setNewCustomFields({});
        setNewIsCommander(false);
        setTempCustomKey('');
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
        setNewCustomFields(person.customFields || {});
        setNewIsCommander(!!person.isCommander);
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

    const handleBulkImport = async (importedPeople: Person[], newTeams: Team[] = [], newRoles: Role[] = []) => {
        setIsSaving(true);
        try {
            // 1. Add new Teams/Roles first
            newTeams.forEach(t => onAddTeam(t));
            newRoles.forEach(r => onAddRole(r));

            let added = 0;
            let updated = 0;
            let failed = 0;
            const detailedErrors: { name: string; error: string }[] = [];

            for (const p of importedPeople) {
                try {
                    const existing = people.find(ex => ex.id === p.id);
                    if (existing) {
                        // Safe Merge
                        await onUpdatePerson({
                            ...existing,
                            name: p.name,
                            teamId: p.teamId,
                            roleIds: p.roleIds,
                            email: p.email || existing.email,
                            phone: p.phone || existing.phone
                        });
                        updated++;
                    } else {
                        await onAddPerson(p);
                        added++;
                    }
                } catch (e: any) {
                    console.error("Import Error for", p.name, e);
                    failed++;
                    // Use explicit message if available, otherwise generic
                    let msg = e.message || 'שגיאה לא ידועה';

                    // Hebrew Translations for common DB errors
                    if (msg.includes('people_team_id_fkey')) { // Foreign key violation for team
                        msg = 'שגיאת שיוך לצוות: שם הצוות אינו קיים במערכת.';
                    } else if (msg.includes('duplicate key value violates unique constraint') || msg.includes('23505')) {
                        msg = 'נתונים כפולים: משתמש עם שם/טלפון זהה כבר קיים.';
                    } else if (msg.includes('violates not-null constraint')) {
                        const match = msg.match(/column "([^"]+)"/);
                        const col = match ? match[1] : '';
                        const colHebrew = col === 'id' ? 'מזהה' : col === 'name' ? 'שם מלא' : col === 'phone' ? 'טלפון' : col;
                        msg = `חסר שדה חובה${colHebrew ? ': ' + colHebrew : ''}.`;
                    }

                    detailedErrors.push({ name: p.name, error: msg });
                }
            }

            if (failed > 0) {
                setImportResults({ added, updated, failed, errors: detailedErrors });
            } else {
                showToast(`בוצע בהצלחה: ${added} נוספו, ${updated} עודכנו`, 'success');
            }
        } finally {
            setIsSaving(false);
        }
    };

    const executeSavePerson = async () => {
        setIsSaving(true);
        const personData: any = {
            name: newName,
            email: newEmail,
            phone: newPhone,
            isActive: newItemActive,
            teamId: newTeamId,
            roleIds: newRoleIds,
            maxHoursPerWeek: 40,
            unavailableDates: [],
            preferences: { preferNight: false, avoidWeekends: false },
            customFields: newCustomFields, // NEW
            isCommander: newIsCommander, // NEW
            color: 'bg-blue-500' // Default
        };

        try {
            if (editingPersonId) {
                const person = people.find(p => p.id === editingPersonId);
                await onUpdatePerson({ ...person, ...personData, id: editingPersonId } as Person);
                showToast('החייל עודכן בהצלחה', 'success');
            } else {
                await onAddPerson({ ...personData, id: `person-${Date.now()}` } as Person);
                showToast('החייל נוסף בהצלחה', 'success');
            }
            closeForm();
        } catch (e: any) {
            console.error("Save Error", e);
            showToast(e.message || 'שגיאה בשמירה', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (activeTab === 'people') {
            if (!newName.trim()) { showToast('נא להזין שם', 'error'); return; }
            if (!newTeamId && teams.length > 0) { showToast('נא לבחור צוות', 'error'); return; }

            // Duplicate Check (Manual Creation)
            if (!editingPersonId) {
                const dup = people.find(p =>
                    p.name.trim() === newName.trim() ||
                    (newEmail && p.email?.toLowerCase() === newEmail.toLowerCase()) ||
                    (newPhone && p.phone?.replace(/\D/g, '') === newPhone.replace(/\D/g, ''))
                );
                if (dup) {
                    setDuplicateWarning({ person: dup, isOpen: true });
                    return;
                }
            }
            await executeSavePerson();
        }
        else if (activeTab === 'teams') {
            if (!newItemName.trim()) { showToast('נא להזין שם צוות', 'error'); return; }
            const teamData = { name: newItemName, color: newItemColor };

            setIsSaving(true);
            try {
                if (editingTeamId) {
                    await onUpdateTeam({ ...teamData, id: editingTeamId });
                    showToast('הצוות עודכן', 'success');
                } else {
                    await onAddTeam({ ...teamData, id: `team-${Date.now()}` });
                    showToast('הצוות נוצר', 'success');
                }
                closeForm();
            } catch (e) {
                console.error("Team Save Error", e);
                showToast("שגיאה בשמירת צוות", 'error');
            } finally {
                setIsSaving(false);
            }
        }
        else if (activeTab === 'roles') {
            if (!newItemName.trim()) { showToast('נא להזין שם תפקיד', 'error'); return; }
            const roleData = { name: newItemName, color: newItemColor };

            setIsSaving(true);
            try {
                if (editingRoleId) {
                    await onUpdateRole({ ...roleData, id: editingRoleId });
                    showToast('התפקיד עודכן', 'success');
                } else {
                    await onAddRole({ ...roleData, id: `role-${Date.now()}` });
                    showToast('התפקיד נוצר', 'success');
                }
                closeForm();
            } catch (e) {
                console.error("Role Save Error", e);
                showToast("שגיאה בשמירת תפקיד", 'error');
            } finally {
                setIsSaving(false);
            }
        }
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
                    {/* Toggles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {editingPersonId && (
                            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${newItemActive ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setNewItemActive(!newItemActive)}>
                                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${newItemActive ? 'translate-x-4' : 'translate-x-0'}`} />
                                </div>
                                <span className="font-bold text-slate-700">{newItemActive ? 'פעיל' : 'לא פעיל'}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                            <div className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors ${newIsCommander ? 'bg-indigo-500' : 'bg-slate-300'}`} onClick={() => setNewIsCommander(!newIsCommander)}>
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${newIsCommander ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700 leading-none">מפקד צוות</span>
                                <span className="text-[10px] text-slate-500 font-bold">הגדרת סמכות פיקודית</span>
                            </div>
                        </div>
                    </div>
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

                    {/* Custom Fields Section */}
                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-sm font-bold text-slate-700 mb-2">שדות מותאמים אישית</label>
                        <div className="space-y-3">
                            {Object.entries(newCustomFields || {}).map(([key, value]) => (
                                <div key={key} className="flex gap-2 items-center">
                                    <div className="w-1/3 bg-slate-50 p-2 rounded text-sm text-slate-600 font-medium truncate" title={key}>{key}</div>
                                    <Input
                                        value={value}
                                        onChange={(e) => setNewCustomFields({ ...newCustomFields, [key]: e.target.value })}
                                        className="flex-1"
                                        placeholder="ערך"
                                    />
                                    <button onClick={() => {
                                        const next = { ...newCustomFields };
                                        delete next[key];
                                        setNewCustomFields(next);
                                    }} className="text-red-400 hover:text-red-600 p-2 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}

                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <Input
                                        label={Object.keys(newCustomFields).length === 0 ? "הוסף שדה חדש" : undefined}
                                        value={tempCustomKey}
                                        onChange={(e) => setTempCustomKey(e.target.value)}
                                        placeholder="שם שדה (לדוגמה: מידת נעליים)"
                                        list="custom-hits"
                                    />
                                    <datalist id="custom-hits">
                                        {Array.from(new Set(people.flatMap(p => Object.keys(p.customFields || {})))).map(k => (
                                            <option key={k} value={k} />
                                        ))}
                                    </datalist>
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        const key = tempCustomKey.trim();
                                        if (key) {
                                            if (newCustomFields[key] !== undefined) {
                                                showToast('שדה זה כבר קיים', 'error');
                                            } else {
                                                setNewCustomFields(prev => ({ ...prev, [key]: '' }));
                                                setTempCustomKey('');

                                                // Auto-add to all other soldiers if missing (Silent)
                                                const peopleToUpdate = people.filter(p =>
                                                    p.id !== editingPersonId &&
                                                    (p.customFields || {})[key] === undefined
                                                );

                                                if (peopleToUpdate.length > 0) {
                                                    Promise.all(peopleToUpdate.map(p => onUpdatePerson({
                                                        ...p,
                                                        customFields: { ...(p.customFields || {}), [key]: '' }
                                                    }))).catch(err => console.error("Failed to propagate custom field", err));
                                                }
                                            }
                                        }
                                    }}
                                    className="mb-[2px]"
                                    disabled={!tempCustomKey.trim()}
                                >
                                    <Plus size={18} />
                                </Button>
                            </div>
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
            {/* Sticky Header Container */}
            <div className="sticky top-0 bg-white z-30 pb-4 border-b border-slate-100 mb-6 -mx-4 md:-mx-6 px-4 md:px-6 pt-2 transition-all shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
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
                        {canEdit && selectedItemIds.size > 0 && (
                            <Button
                                onClick={handleBulkDelete}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border-red-200 flex-1 md:flex-none animate-in fade-in zoom-in duration-200 h-[42px]"
                            >
                                <Trash2 size={16} className="ml-2" />
                                <span className="hidden md:inline">מחק ({selectedItemIds.size})</span>
                                <span className="md:hidden">({selectedItemIds.size})</span>
                            </Button>
                        )}
                        {activeTab === 'people' && canEdit && (
                            <Button
                                variant="secondary"
                                onClick={() => setIsImportWizardOpen(true)}
                                icon={FileSpreadsheet}
                                className="flex-1 md:flex-none h-[42px]"
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
                                className="flex-1 md:flex-none h-[42px]"
                            >
                                <span className="md:hidden">הוסף</span>
                                <span className="hidden md:inline">הוסף חדש</span>
                            </Button>
                        )}
                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium text-sm md:text-base h-[42px]"
                            title="ייצוא ל-Excel"
                        >
                            <Download size={18} />
                            <span className="hidden md:inline">ייצוא</span>
                        </button>
                        <div className="flex items-center gap-2 md:mr-4">
                            <label className="flex text-xs font-bold text-slate-500 items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                <span className="hidden md:inline">הצג לא פעילים</span>
                                <span className="md:hidden">לא פעילים</span>
                            </label>
                        </div>
                    </div>
                </div>
                {activeTab === 'people' && (
                    <div className="flex flex-col gap-4 mt-2 border-t border-slate-100 pt-3 md:pt-4">
                        <div className="flex flex-row items-center gap-2">
                            <div className="flex-1">
                                <Input
                                    icon={Search}
                                    placeholder="חפש לפי שם..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-[42px]"
                                />
                            </div>
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="h-[42px] w-[42px] bg-white border border-slate-300 rounded-md shadow-sm hover:bg-slate-50 text-slate-600 transition-colors flex items-center justify-center shrink-0"
                                title={`סדר: ${sortOrder === 'asc' ? 'עולה' : 'יורד'}`}
                            >
                                {sortOrder === 'asc' ? <ArrowDownAZ size={21} /> : <ArrowUpZA size={21} />}
                            </button>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`h-[42px] w-[42px] border rounded-md shadow-sm transition-colors flex items-center justify-center shrink-0 ${showFilters ? 'bg-idf-yellow border-idf-yellow text-slate-900' : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-600'}`}
                                title="סינון"
                            >
                                <Filter size={21} />
                            </button>
                        </div>

                        {showFilters && (
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-1 fade-in duration-200">
                                <Select
                                    value={filterTeamId}
                                    onChange={(val) => setFilterTeamId(val)}
                                    options={[{ value: 'all', label: 'כל הצוותים' }, { value: 'no-team', label: 'ללא צוות' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                                    placeholder="סנן לפי צוות"
                                />
                                <Select
                                    value={filterRoleId}
                                    onChange={(val) => setFilterRoleId(val)}
                                    options={[{ value: 'all', label: 'כל התפקידים' }, ...roles.map(r => ({ value: r.id, label: r.name }))]}
                                    placeholder="סנן לפי תפקיד"
                                />

                                {Array.from(new Set(people.flatMap(p => Object.keys(p.customFields || {})))).length > 0 && (
                                    <div className="flex flex-1 gap-2 flex-col md:flex-row">
                                        <div className="w-full md:w-40">
                                            <Select
                                                value={filterCustomField}
                                                onChange={(val) => { setFilterCustomField(val); setFilterCustomValue(''); }}
                                                options={[
                                                    { value: 'all', label: 'סינון מתקדם' },
                                                    ...Array.from(new Set(people.flatMap(p => Object.keys(p.customFields || {})))).map(k => ({ value: k, label: k }))
                                                ]}
                                                placeholder="סינון שדות"
                                            />
                                        </div>
                                        {filterCustomField !== 'all' && (
                                            <div className="w-full md:w-32 animate-in fade-in zoom-in duration-200">
                                                <Input
                                                    value={filterCustomValue}
                                                    onChange={(e) => setFilterCustomValue(e.target.value)}
                                                    placeholder="ערך..."
                                                    className="h-[42px]"
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>





            {/* Content Lists */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {activeTab === 'people' && (
                    <div className="col-span-full space-y-6">


                        {(() => {
                            // 1. Filter
                            const filtered = people
                                .filter(p => !p.isActive ? showInactive : true)
                                .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .filter(p => filterTeamId === 'all' || (filterTeamId === 'no-team' ? !p.teamId : p.teamId === filterTeamId))
                                .filter(p => filterRoleId === 'all' || (p.roleIds || []).includes(filterRoleId))
                                .filter(p => filterCustomField === 'all' || (p.customFields?.[filterCustomField]?.toString().toLowerCase().includes(filterCustomValue.toLowerCase())));

                            // 2. Sort Helper
                            const sortList = (list: Person[]) => {
                                const sorted = [...list];
                                if (sortOrder === 'asc') return sorted.sort((a, b) => a.name.localeCompare(b.name));
                                return sorted.sort((a, b) => b.name.localeCompare(a.name));
                            };

                            // 3. Render Card Helper
                            const renderPerson = (person: Person) => {
                                const team = teams.find(t => t.id === person.teamId);
                                const colorClass = team ? (team.color?.replace('border-', 'bg-') || 'bg-slate-300') : person.color;

                                return (
                                    <div key={person.id} className="bg-white border border-slate-100 rounded-xl p-3 md:p-4 hover:shadow-md transition-all group">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                {canEdit && (
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItemIds.has(person.id)}
                                                        onChange={(e) => { e.stopPropagation(); toggleSelection(person.id); }}
                                                        className={`ml-2 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer transition-opacity ${selectedItemIds.has(person.id) ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
                                                    />
                                                )}
                                                <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs md:text-sm flex-shrink-0 ${colorClass}`}>{getPersonInitials(person.name)}</div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold text-sm md:text-base text-slate-800 truncate">
                                                        {person.name}
                                                        {person.isActive === false && <span className="mr-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">לא פעיל</span>}
                                                    </h4>
                                                    <span className="text-xs text-slate-500 truncate block">{person.email || 'אין אימייל'}</span>
                                                    <span className="text-xs text-slate-400 truncate block">{person.phone || ''}</span>
                                                    {Object.keys(person.customFields || {}).length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {Object.entries(person.customFields || {}).map(([k, v]) => v ? (
                                                                <span key={k} className="text-[9px] bg-slate-50 text-slate-400 px-1 rounded border border-slate-100" title={`${k}: ${v}`}>{v}</span>
                                                            ) : null)}
                                                        </div>
                                                    )}
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
                                            {(person.roleIds || []).map(rid => {
                                                const r = roles.find(rl => rl.id === rid);
                                                return r ? <span key={r.id} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">{r.name}</span> : null
                                            })}
                                        </div>
                                    </div>
                                );
                            };

                            // MODE: TEAMS
                            if (viewGroupBy === 'teams') {
                                let items = [...teams, { id: 'no-team', name: 'ללא צוות', color: 'bg-slate-300' } as any];
                                if (sortOrder === 'desc') items.sort((a, b) => b.name.localeCompare(a.name));
                                else items.sort((a, b) => a.name.localeCompare(b.name));

                                return items.map(group => {
                                    let members = filtered.filter(p => group.id === 'no-team' ? !p.teamId : p.teamId === group.id);
                                    members = sortList(members);
                                    if (members.length === 0) return null;

                                    const isCollapsed = collapsedTeams.has(group.id);

                                    return (
                                        <div key={group.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                            <div className="p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleTeamCollapse(group.id)}>
                                                <div className="flex items-center gap-3">
                                                    {/* Title */}
                                                    <h3 className="font-bold text-slate-800 text-base md:text-lg">{group.name}</h3>
                                                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 border border-slate-200">{members.length}</span>
                                                </div>
                                                <button className="text-slate-400">{isCollapsed ? <ChevronLeft size={20} /> : <ChevronDown size={20} />}</button>
                                            </div>
                                            {!isCollapsed && <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-200">{members.map(renderPerson)}</div>}
                                        </div>
                                    );
                                });
                            }

                            // MODE: ROLES
                            if (viewGroupBy === 'roles') {
                                let items = [...roles];
                                if (sortOrder === 'desc') items.sort((a, b) => b.name.localeCompare(a.name));
                                else items.sort((a, b) => a.name.localeCompare(b.name));

                                return items.map(role => {
                                    let members = filtered.filter(p => (p.roleIds || []).includes(role.id));
                                    members = sortList(members);
                                    if (members.length === 0) return null;

                                    const isCollapsed = collapsedTeams.has(role.id);

                                    return (
                                        <div key={role.id} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                            <div className="p-3 md:p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => toggleTeamCollapse(role.id)}>
                                                <div className="flex items-center gap-3">
                                                    <h3 className="font-bold text-slate-800 text-base md:text-lg">{role.name}</h3>
                                                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 border border-slate-200">{members.length}</span>
                                                </div>
                                                <button className="text-slate-400">{isCollapsed ? <ChevronLeft size={20} /> : <ChevronDown size={20} />}</button>
                                            </div>
                                            {!isCollapsed && <div className="p-3 md:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 border-t border-slate-200">{members.map(renderPerson)}</div>}
                                        </div>
                                    );
                                });
                            }

                            // MODE: LIST
                            const sorted = sortList([...filtered]);
                            return (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {sorted.map(renderPerson)}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'teams' && teams.map(team => (
                    <div key={team.id} className={`bg-white border-l-4 rounded-xl p-4 md:p-6 flex justify-between items-center group hover:shadow-md transition-all ${team.color || 'border-slate-500'}`}>
                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                            {canEdit && (
                                <input
                                    type="checkbox"
                                    checked={selectedItemIds.has(team.id)}
                                    onChange={(e) => { e.stopPropagation(); toggleSelection(team.id); }}
                                    className={`ml-2 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer transition-opacity ${selectedItemIds.has(team.id) ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
                                />
                            )}
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
                                {canEdit && (
                                    <input
                                        type="checkbox"
                                        checked={selectedItemIds.has(role.id)}
                                        onChange={(e) => { e.stopPropagation(); toggleSelection(role.id); }}
                                        className={`ml-2 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer transition-opacity ${selectedItemIds.has(role.id) ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}
                                    />
                                )}
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
                        <Button variant="primary" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <><Loader2 className="animate-spin ml-2" size={16} /> שומר...</> : 'שמור'}
                        </Button>
                    </div>
                )}
            >
                {renderModalContent()}
            </Modal>

            {/* Duplicate Warning Modal */}
            <Modal
                isOpen={!!duplicateWarning?.isOpen}
                onClose={() => setDuplicateWarning(null)}
                title="התראה: כפילות אפשרית"
            >
                <div className="space-y-6">
                    <div className="flex items-start gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <AlertTriangle className="text-amber-600 shrink-0 mt-0.5" size={24} />
                        <div>
                            <h4 className="font-bold text-slate-800 text-lg">נמצאה התאמה במערכת</h4>
                            <p className="text-slate-600 mt-1 leading-relaxed">
                                החייל <strong>{duplicateWarning?.person.name}</strong> כבר קיים אצלנו (זוהה לפי שם, טלפון או אימייל).
                            </p>
                        </div>
                    </div>

                    <p className="text-slate-600 text-lg leading-relaxed">
                        יצירת כרטיס נוסף תגרום לכפילות נתונים. האם אתם בטוחים שברצונכם להמשיך?
                    </p>

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => setDuplicateWarning(null)}
                            className="border-slate-300 hover:bg-slate-50"
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={() => {
                                setDuplicateWarning(null);
                                executeSavePerson();
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-white border-transparent"
                        >
                            צור כפילות
                        </Button>
                    </div>
                </div>
            </Modal>

            <ExcelImportWizard
                isOpen={isImportWizardOpen}
                onClose={() => setIsImportWizardOpen(false)}
                onImport={handleBulkImport}
                teams={teams}
                roles={roles}
                people={people}
                onAddTeam={onAddTeam}
                onAddRole={onAddRole}
                isSaving={isSaving}
            />

            {/* Import Results Modal */}
            <Modal
                isOpen={!!importResults}
                onClose={() => setImportResults(null)}
                title="סיכום ייבוא נתונים"
                size="lg"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                            <div className="text-2xl font-bold text-green-600">{importResults?.added}</div>
                            <div className="text-sm text-green-800">נוספו בהצלחה</div>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="text-2xl font-bold text-blue-600">{importResults?.updated}</div>
                            <div className="text-sm text-blue-800">עודכנו</div>
                        </div>
                        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                            <div className="text-2xl font-bold text-red-600">{importResults?.failed}</div>
                            <div className="text-sm text-red-800">נכשלו</div>
                        </div>
                    </div>

                    {importResults?.errors && importResults.errors.length > 0 && (
                        <div>
                            <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-red-500" />
                                פירוט שגיאות
                            </h4>
                            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                                {importResults.errors.map((err, idx) => (
                                    <div key={idx} className="p-3 text-sm flex gap-3 bg-red-50/30 items-start">
                                        <span className="font-bold text-slate-700 w-1/3 shrink-0 truncate sticky top-0">{err.name}</span>
                                        <span className="text-red-600 break-words flex-1">{err.error}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                        <Button onClick={() => setImportResults(null)}>סגור</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
