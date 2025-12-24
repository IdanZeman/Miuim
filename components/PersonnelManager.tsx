import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, ChevronDown, ChevronLeft, User, Users, Shield, Pencil, Trash2, FileSpreadsheet, X, Check, Download, Archive, AlertTriangle, Loader2, Filter, ArrowUpDown, ArrowDownAZ, ArrowUpZA, Layers, LayoutList, MoreVertical } from 'lucide-react';
import { Person, Team, Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { logger } from '../services/loggingService';
import { Modal } from './ui/Modal';
import { PageInfo } from './ui/PageInfo';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { ExcelImportWizard } from './ExcelImportWizard';
import { SheetModal } from './ui/SheetModal';
import { ROLE_ICONS } from '../constants';

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
    isViewer?: boolean;
}

type Tab = 'people' | 'teams' | 'roles';

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
    initialTab = 'people',
    isViewer = false
}) => {
    // Log component view
    useEffect(() => {
        logger.log({
            level: 'DEBUG',
            action: 'VIEW',
            entityType: 'page',
            entityName: 'Personnel Manager',
            component: 'PersonnelManager',
            category: 'navigation'
        });
    }, []);
    const { checkAccess } = useAuth();
    const canEdit = !isViewer && checkAccess('personnel', 'edit');
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

    // NEW: Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, person: Person } | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // Long Press Logic
    const touchTimer = React.useRef<NodeJS.Timeout | null>(null);

    const handleTouchStart = (e: React.TouchEvent, person: Person) => {
        const touch = e.touches[0];
        const x = touch.clientX;
        const y = touch.clientY;
        touchTimer.current = setTimeout(() => {
            setContextMenu({ x, y, person });
        }, 600);
    };

    const handleTouchEnd = () => {
        if (touchTimer.current) {
            clearTimeout(touchTimer.current);
            touchTimer.current = null;
        }
    };


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
                if (activeTab === 'people') {
                    onDeletePerson(id);
                    logger.logDelete('person', id, 'Unknown', { bulk: true });
                }
                else if (activeTab === 'teams') {
                    onDeleteTeam(id);
                    logger.logDelete('team', id, 'Unknown', { bulk: true });
                }
                else if (activeTab === 'roles') {
                    onDeleteRole(id);
                    logger.logDelete('role', id, 'Unknown', { bulk: true });
                }
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
        logger.log({ action: 'EXPORT', entityName: activeTab, category: 'data' });
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
            logger.log({ action: 'CREATE', entityType: 'person', entityName: 'bulk_import', metadata: { added, updated, failed } });
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
            customFields: newCustomFields, // NEW
            isCommander: newIsCommander, // NEW
            color: 'bg-blue-500' // Default
        };

        try {
            if (editingPersonId) {
                const person = people.find(p => p.id === editingPersonId);
                await onUpdatePerson({ ...person, ...personData, id: editingPersonId } as Person);
                logger.logUpdate('person', editingPersonId, personData.name, person, personData);
                showToast('החייל עודכן בהצלחה', 'success');
            } else {
                const newId = `person-${Date.now()}`;
                await onAddPerson({ ...personData, id: newId } as Person);
                logger.logCreate('person', newId, personData.name, personData);
                showToast('החייל נוסף בהצלחה', 'success');
            }
            closeForm();
        } catch (e: any) {
            console.error("Save Error", e);
            showToast(e.message || 'שגיאה בשמירה', 'error');
            logger.logError(e, 'PersonnelManager:SavePerson');
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
                <div className="space-y-6">
                    {/* 1. Essential Info Group */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 px-2">פרטים אישיים</h3>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {/* Name */}
                            <div className="flex items-center px-4 py-3">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">שם מלא</div>
                                <input
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="ישראל ישראלי"
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right placeholder:text-slate-300 h-full w-full"
                                />
                            </div>
                            {/* Phone */}
                            <div className="flex items-center px-4 py-3">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">טלפון</div>
                                <input
                                    value={newPhone}
                                    onChange={e => setNewPhone(e.target.value)}
                                    placeholder="050-0000000"
                                    type="tel"
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right placeholder:text-slate-300 h-full w-full"
                                    dir="ltr"
                                />
                            </div>
                            {/* Email */}
                            <div className="flex items-center px-4 py-3">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">אימייל</div>
                                <input
                                    value={newEmail}
                                    onChange={e => setNewEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    type="email"
                                    className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right placeholder:text-slate-300 h-full w-full"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2. Team & Status Group */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 px-2">שיוך וסטטוס</h3>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {/* Team Selector */}
                            <div className="flex items-center justify-between px-4 py-3 bg-white relative">
                                <div className="w-24 shrink-0 font-bold text-slate-700 text-sm">צוות</div>
                                <Select
                                    value={newTeamId}
                                    onChange={(val) => setNewTeamId(val)}
                                    options={teams.map(t => ({ value: t.id, label: t.name }))}
                                    placeholder="בחר צוות"
                                    className="bg-transparent border-none shadow-none hover:bg-slate-50 pr-0"
                                    containerClassName="flex-1"
                                />
                            </div>

                            {/* Active Status */}
                            <div className="flex items-center justify-between px-4 py-3" onClick={() => setNewItemActive(!newItemActive)}>
                                <div className="font-bold text-slate-700 text-sm">סטטוס פעיל</div>
                                <div className={`w-12 h-7 rounded-full transition-colors relative ${newItemActive ? 'bg-green-500' : 'bg-slate-200'}`}>
                                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${newItemActive ? 'left-1' : 'left-6'}`} />
                                </div>
                            </div>

                            {/* Commander Status */}
                            <div className="flex items-center justify-between px-4 py-3" onClick={() => setNewIsCommander(!newIsCommander)}>
                                <div className="flex flex-col">
                                    <span className="font-bold text-slate-700 text-sm">מפקד צוות</span>
                                    <span className="text-[10px] text-slate-400">הגדר סמכות פיקודית</span>
                                </div>
                                <div className={`w-12 h-7 rounded-full transition-colors relative ${newIsCommander ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all shadow-sm ${newIsCommander ? 'left-1' : 'left-6'}`} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. Roles Group (Chips) */}
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-slate-500 px-2">תפקידים והכשרות</h3>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
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
                                            className={`h-10 px-4 rounded-xl text-sm border-2 transition-all flex items-center gap-2 ${isSelected
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm'
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-slate-300'
                                                }`}
                                        >
                                            {role.icon && ROLE_ICONS[role.icon] && React.createElement(ROLE_ICONS[role.icon], { size: 16, className: isSelected ? 'text-blue-500' : 'text-slate-400' })}
                                            {role.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 4. Custom Fields Group */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-bold text-slate-500">נתונים נוספים</h3>
                        </div>

                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {Object.entries(newCustomFields || {}).map(([key, value]) => (
                                <div key={key} className="flex items-center px-4 py-3 group">
                                    <div className="w-1/3 shrink-0 font-bold text-slate-700 text-sm truncate" title={key}>{key}</div>
                                    <input
                                        value={value}
                                        onChange={(e) => setNewCustomFields({ ...newCustomFields, [key]: e.target.value })}
                                        className="flex-1 bg-transparent border-none outline-none text-slate-900 text-right placeholder:text-slate-300 h-full"
                                    />
                                    <button onClick={() => {
                                        const next = { ...newCustomFields };
                                        delete next[key];
                                        setNewCustomFields(next);
                                    }} className="mr-2 text-slate-300 hover:text-red-500">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}

                            {/* Simple Add Field Row */}
                            <div className="flex items-center px-4 py-3 bg-slate-50">
                                <div className="flex-1 relative">
                                    <input
                                        value={tempCustomKey}
                                        onChange={(e) => setTempCustomKey(e.target.value)}
                                        placeholder="הוסף שדה חדש..."
                                        list="custom-hits-sheet"
                                        className="w-full bg-transparent text-sm font-medium outline-none text-slate-700 placeholder:text-slate-400"
                                    />
                                    <datalist id="custom-hits-sheet">
                                        {Array.from(new Set(people.flatMap(p => Object.keys(p.customFields || {})))).map(k => (
                                            <option key={k} value={k} />
                                        ))}
                                    </datalist>
                                </div>
                                <button
                                    onClick={() => {
                                        const key = tempCustomKey.trim();
                                        if (key && !newCustomFields[key]) {
                                            setNewCustomFields(prev => ({ ...prev, [key]: '' }));
                                            setTempCustomKey('');
                                        }
                                    }}
                                    disabled={!tempCustomKey}
                                    className="bg-white border border-slate-200 text-slate-600 rounded-lg p-1.5 shadow-sm hover:text-blue-600 hover:border-blue-200 disabled:opacity-50"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="h-6" />
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
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 p-0 md:p-6 min-h-[600px] relative overflow-hidden">
            {/* Sticky Header Container */}
            {/* Sticky Header Container */}
            {/* Sticky Header Container */}
            {/* Sticky Header Container */}
            <div className="sticky top-0 bg-white z-40 pb-3 border-b border-slate-100 mb-0 px-4 md:px-0 pt-4 transition-all shadow-sm space-y-3">
                <div className="flex items-center gap-2 mb-2 md:hidden">
                    <h2 className="text-xl font-bold text-slate-800">ניהול כוח אדם</h2>
                    <PageInfo
                        title="ניהול כוח אדם"
                        description={
                            <>
                                <p className="mb-2">כאן מנהלים את האנשים, הצוותים והתפקידים ביחידה.</p>
                                <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                    <li><b>חיילים:</b> הוספה, עריכה, ומחיקה של אנשי צוות.</li>
                                    <li><b>צוותים:</b> חלוקה לצוותים אורגניים.</li>
                                    <li><b>תפקידים:</b> הגדרת הסמכות ומקצועות.</li>
                                </ul>
                                <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                    <b>טיפ:</b> הקפידו שפרטי הקשר מעודכנים כדי שהמערכת תוכל לשלוח הודעות בצורה תקינה.
                                </p>
                            </>
                        }
                    />
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
                    <div className="hidden md:flex items-center gap-2 mr-2">
                        <h2 className="text-xl font-bold text-slate-800">ניהול כוח אדם</h2>
                        <PageInfo
                            title="ניהול כוח אדם"
                            description={
                                <>
                                    <p className="mb-2">כאן מנהלים את האנשים, הצוותים והתפקידים ביחידה.</p>
                                    <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                        <li><b>חיילים:</b> הוספה, עריכה, ומחיקה של אנשי צוות.</li>
                                        <li><b>צוותים:</b> הוספה ועריכה.</li>
                                        <li><b>תפקידים:</b> הגדרת פקלים הסמכות ומקצועות.</li>
                                    </ul>
                                </>
                            }
                        />
                    </div>
                    {/* Tabs Segmented Control */}
                    <div className="flex p-1 bg-slate-100 rounded-lg w-full md:w-auto shrink-0 order-2 md:order-1 overflow-x-auto no-scrollbar">
                        {(['people', 'teams', 'roles'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                                    }`}
                            >
                                {tab === 'people' && 'חיילים'}
                                {tab === 'teams' && 'צוותים'}
                                {tab === 'roles' && 'תפקידים'}
                            </button>
                        ))}
                    </div>

                    {/* Search & Actions */}
                    <div className="flex items-center gap-2 w-full md:w-auto flex-1 md:max-w-md order-1 md:order-2">
                        {/* Search Bar */}
                        <div className="flex-1 relative">
                            <Input
                                icon={Search}
                                placeholder={activeTab === 'people' ? "חפש חייל..." : activeTab === 'teams' ? "חפש צוות..." : "חפש תפקיד..."}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-[40px] bg-slate-50 border-slate-200 focus:bg-white focus:ring-2 focus:ring-idf-olive/20"
                            />
                        </div>

                        {/* Filter Button */}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`h-[40px] w-[40px] rounded-lg border border-slate-200 transition-colors flex items-center justify-center shrink-0 ${showFilters ? 'bg-idf-yellow text-slate-900 border-idf-yellow' : 'bg-white text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Filter size={20} />
                        </button>

                        {/* Bulk Delete Action */}
                        {canEdit && selectedItemIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="h-[40px] px-3 rounded-lg bg-red-50 text-red-600 border border-red-100 flex items-center gap-2 font-bold text-sm hover:bg-red-100 animate-in fade-in zoom-in duration-200"
                            >
                                <Trash2 size={16} />
                                <span className="hidden md:inline">מחק ({selectedItemIds.size})</span>
                                <span className="md:hidden">({selectedItemIds.size})</span>
                            </button>
                        )}


                        {/* Kebab Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMoreMenu(!showMoreMenu)}
                                className="h-[40px] w-[40px] rounded-lg border border-slate-200 bg-white text-slate-500 flex items-center justify-center transition-colors hover:bg-slate-50"
                            >
                                <MoreVertical size={20} />
                            </button>

                            {showMoreMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreMenu(false)} />
                                    <div className="absolute top-12 left-0 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden py-1 animate-in fade-in zoom-in duration-200">
                                        {activeTab === 'people' && canEdit && (
                                            <button onClick={() => { setIsImportWizardOpen(true); setShowMoreMenu(false); }} className="w-full text-right px-4 py-2.5 hover:bg-slate-50 text-sm font-medium flex items-center gap-2 text-slate-700">
                                                <FileSpreadsheet size={16} /> ייבוא מאקסל
                                            </button>
                                        )}
                                        <button onClick={() => { handleExport(); setShowMoreMenu(false); }} className="w-full text-right px-4 py-2.5 hover:bg-slate-50 text-sm font-medium flex items-center gap-2 text-slate-700">
                                            <Download size={16} /> ייצוא
                                        </button>
                                        <div className="px-4 py-2.5 border-t border-slate-50 flex items-center justify-between">
                                            <span className="text-sm font-medium text-slate-700">הצג לא פעילים</span>
                                            <input
                                                type="checkbox"
                                                checked={showInactive}
                                                onChange={(e) => setShowInactive(e.target.checked)}
                                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100 grid grid-cols-2 gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
                        <Select
                            value={filterTeamId}
                            onChange={(val) => setFilterTeamId(val)}
                            options={[{ value: 'all', label: 'כל הצוותים' }, { value: 'no-team', label: 'ללא צוות' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                            placeholder="צוות"
                            className="bg-white"
                        />
                        <Select
                            value={filterRoleId}
                            onChange={(val) => setFilterRoleId(val)}
                            options={[{ value: 'all', label: 'כל התפקידים' }, ...roles.map(r => ({ value: r.id, label: r.name }))]}
                            placeholder="תפקיד"
                            className="bg-white"
                        />
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

                            // 3. Render Card Helper (Refactored for Mobile List)
                            const renderPerson = (person: Person) => {
                                const team = teams.find(t => t.id === person.teamId);
                                const colorClass = team ? (team.color?.replace('border-', 'bg-') || 'bg-slate-300') : person.color;
                                const isSelected = selectedItemIds.has(person.id);

                                // Prevent default context menu
                                const handleContextMenu = (e: React.MouseEvent) => {
                                    e.preventDefault();
                                    if (canEdit) {
                                        setContextMenu({ x: e.clientX, y: e.clientY, person });
                                    }
                                };

                                return (
                                    <div
                                        key={person.id}
                                        className={`flex items-center gap-3 py-3 px-1 border-b border-slate-100 bg-white transition-colors select-none ${isSelected ? 'bg-blue-50' : 'active:bg-slate-50'}`}
                                        onTouchStart={(e) => canEdit && handleTouchStart(e, person)}
                                        onTouchEnd={handleTouchEnd}
                                        onContextMenu={handleContextMenu}
                                        onClick={() => {
                                            if (selectedItemIds.size > 0 || isSelected) {
                                                toggleSelection(person.id);
                                            } else if (canEdit) {
                                                handleEditPersonClick(person);
                                            }
                                        }}
                                    >
                                        {/* Checkbox (Visible if editing allowed) */}
                                        {canEdit && (
                                            <div onClick={(e) => { e.stopPropagation(); toggleSelection(person.id); }} className="shrink-0 p-2 -mr-2 cursor-pointer">
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                                    {isSelected && <Check size={12} className="text-white" />}
                                                </div>
                                            </div>
                                        )}

                                        {/* Avatar (Left) */}
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${colorClass}`}>
                                            {getPersonInitials(person.name)}
                                        </div>

                                        {/* Content (Center) */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h4 className={`font-bold text-slate-900 text-base truncate ${!person.isActive ? 'line-through text-slate-400' : ''}`}>
                                                    {person.name}
                                                </h4>
                                                {!person.isActive && <span className="w-2 h-2 rounded-full bg-red-400"></span>}
                                            </div>

                                            {/* Roles Pills */}
                                            <div className="flex flex-wrap gap-1 mt-0.5">
                                                {(person.roleIds || []).length > 0 ? (
                                                    (person.roleIds || []).map(rid => {
                                                        const r = roles.find(rl => rl.id === rid);
                                                        return r ? (
                                                            <span key={r.id} className="text-[10px] px-1.5 py-px rounded-full bg-slate-100 text-slate-600 font-medium">
                                                                {r.name}
                                                            </span>
                                                        ) : null
                                                    })
                                                ) : (
                                                    <span className="text-[11px] text-slate-400">ללא תפקיד</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status / Indicator (Right) */}
                                        <div className="shrink-0 flex items-center justify-center w-6">
                                            {person.isActive !== false ? (
                                                <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm"></div>
                                            ) : (
                                                <div className="w-2.5 h-2.5 rounded-full bg-slate-300"></div>
                                            )}
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
                                        <div key={group.id} className="bg-white">
                                            <div className="sticky top-[60px] z-20 bg-slate-50 border-y border-slate-100 p-2 flex items-center justify-between cursor-pointer" onClick={() => toggleTeamCollapse(group.id)}>
                                                <div className="flex items-center gap-2">
                                                    {canEdit && (
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const allSelected = members.length > 0 && members.every(m => selectedItemIds.has(m.id));
                                                                const newSet = new Set(selectedItemIds);
                                                                if (allSelected) {
                                                                    members.forEach(m => newSet.delete(m.id));
                                                                } else {
                                                                    members.forEach(m => newSet.add(m.id));
                                                                }
                                                                setSelectedItemIds(newSet);
                                                            }}
                                                            className="p-1 cursor-pointer hover:bg-slate-200 rounded-full transition-colors mx-1"
                                                        >
                                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${(members.length > 0 && members.every(m => selectedItemIds.has(m.id))) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                                                {(members.length > 0 && members.every(m => selectedItemIds.has(m.id))) && <Check size={12} className="text-white" />}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <h3 className="font-bold text-slate-800 text-sm">{group.name}</h3>
                                                    <span className="bg-white text-slate-500 text-[10px] px-1.5 rounded-full border border-slate-200 font-mono font-bold">{members.length}</span>
                                                </div>
                                                <button className="text-slate-400">{isCollapsed ? <ChevronLeft size={16} /> : <ChevronDown size={16} />}</button>
                                            </div>
                                            {!isCollapsed && <div className="divide-y divide-slate-50">{members.map(renderPerson)}</div>}
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
                                        <div key={role.id} className="bg-white">
                                            <div className="sticky top-[60px] z-20 bg-slate-50 border-y border-slate-100 p-2 flex items-center justify-between cursor-pointer" onClick={() => toggleTeamCollapse(role.id)}>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-800 text-sm">{role.name}</h3>
                                                    <span className="bg-white text-slate-500 text-[10px] px-1.5 rounded-full border border-slate-200 font-mono font-bold">{members.length}</span>
                                                </div>
                                                <button className="text-slate-400">{isCollapsed ? <ChevronLeft size={16} /> : <ChevronDown size={16} />}</button>
                                            </div>
                                            {!isCollapsed && <div className="divide-y divide-slate-50">{members.map(renderPerson)}</div>}
                                        </div>
                                    );
                                });
                            }

                            // MODE: LIST
                            const sorted = sortList([...filtered]);
                            return (
                                <div className="flex flex-col">
                                    {sorted.map(renderPerson)}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {activeTab === 'teams' && teams.map(team => {
                    const isSelected = selectedItemIds.has(team.id);
                    return (
                        <div
                            key={team.id}
                            className={`flex items-center gap-3 py-3 px-1 border-b border-slate-100 bg-white transition-colors cursor-pointer select-none ${isSelected ? 'bg-blue-50' : 'active:bg-slate-50'}`}
                            onClick={() => {
                                if (selectedItemIds.size > 0 || isSelected) toggleSelection(team.id);
                                else if (canEdit) handleEditTeamClick(team);
                            }}
                        >
                            {/* Checkbox */}
                            {canEdit && (
                                <div onClick={(e) => { e.stopPropagation(); toggleSelection(team.id); }} className="shrink-0 p-2 -mr-2 cursor-pointer">
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                </div>
                            )}

                            {/* Avatar/Icon */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-500 md:text-white font-bold text-sm shrink-0 shadow-sm ${team.color?.replace('border-', 'bg-') || 'bg-slate-100'}`}>
                                <Users size={18} className="md:text-white text-inherit mix-blend-multiply md:mix-blend-normal" />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-base truncate">{team.name}</h4>
                                <p className="text-xs text-slate-500">{people.filter(p => p.teamId === team.id).length} חיילים</p>
                            </div>

                            {/* Actions */}
                            {canEdit && (
                                <button onClick={(e) => { e.stopPropagation(); onDeleteTeam(team.id); }} className="p-2 text-slate-300 hover:text-red-500 rounded-full">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    );
                })}

                {activeTab === 'roles' && roles.map(role => {
                    const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                    const isSelected = selectedItemIds.has(role.id);
                    return (
                        <div
                            key={role.id}
                            className={`flex items-center gap-3 py-3 px-1 border-b border-slate-100 bg-white transition-colors cursor-pointer select-none ${isSelected ? 'bg-blue-50' : 'active:bg-slate-50'}`}
                            onClick={() => {
                                if (selectedItemIds.size > 0 || isSelected) toggleSelection(role.id);
                                else if (canEdit) handleEditRoleClick(role);
                            }}
                        >
                            {/* Checkbox */}
                            {canEdit && (
                                <div onClick={(e) => { e.stopPropagation(); toggleSelection(role.id); }} className="shrink-0 p-2 -mr-2 cursor-pointer">
                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                        {isSelected && <Check size={12} className="text-white" />}
                                    </div>
                                </div>
                            )}

                            {/* Avatar/Icon */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-slate-600 font-bold text-sm shrink-0 shadow-sm ${role.color || 'bg-slate-100'}`}>
                                <Icon size={18} />
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-slate-900 text-base truncate">{role.name}</h4>
                                <p className="text-xs text-slate-500">{people.filter(p => (p.roleIds || []).includes(role.id)).length} חיילים</p>
                            </div>

                            {/* Actions */}
                            {canEdit && (
                                <button onClick={(e) => { e.stopPropagation(); onDeleteRole(role.id); }} className="p-2 text-slate-300 hover:text-red-500 rounded-full">
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* FAB (Floating Action Button) */}
            {
                canEdit && !isModalOpen && (
                    <button
                        onClick={() => {
                            if (activeTab === 'people' && teams.length === 0) {
                                showToast('יש להגדיר צוותים לפני הוספת חיילים', 'error');
                                setActiveTab('teams');
                                return;
                            }
                            setIsAdding(true); setEditingTeamId(null); setEditingPersonId(null); setEditingRoleId(null); setNewItemName(''); setNewName(''); setNewEmail('');
                        }}
                        className="fixed bottom-24 md:bottom-8 left-6 w-14 h-14 bg-idf-yellow text-slate-900 rounded-full shadow-lg hover:shadow-xl hover:bg-yellow-400 transition-all flex items-center justify-center z-50 hover:scale-105 active:scale-95"
                    >
                        <Plus size={28} />
                    </button>
                )
            }

            {/* Context Menu Portal (Could be a simple absolute div if precise positioning needed, or a fixed overlay) */}
            {
                contextMenu && (
                    <>
                        <div
                            className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[1px]"
                            onClick={() => setContextMenu(null)}
                        />
                        <div
                            className="fixed z-50 bg-white rounded-lg shadow-xl border border-slate-100 w-48 overflow-hidden animate-in zoom-in-95 duration-100"
                            style={{ top: contextMenu.y, left: contextMenu.x - 192 < 10 ? 10 : contextMenu.x - 192 }}
                        >
                            <div className="bg-slate-50 px-3 py-2 border-b border-slate-100">
                                <span className="font-bold text-slate-800 text-sm">{contextMenu.person.name}</span>
                            </div>
                            <button onClick={() => { handleEditPersonClick(contextMenu.person); setContextMenu(null); }} className="w-full text-right px-4 py-3 hover:bg-slate-50 text-sm font-medium flex items-center gap-2 text-slate-700">
                                <Pencil size={16} /> ערוך פרטים
                            </button>
                            <button onClick={() => { onDeletePerson(contextMenu.person.id); setContextMenu(null); }} className="w-full text-right px-4 py-3 hover:bg-red-50 text-sm font-medium flex items-center gap-2 text-red-600">
                                <Trash2 size={16} /> מחק חייל
                            </button>
                            <button onClick={() => {
                                // Toggle status
                                onUpdatePerson({ ...contextMenu.person, isActive: !contextMenu.person.isActive });
                                setContextMenu(null);
                            }} className="w-full text-right px-4 py-3 hover:bg-slate-50 text-sm font-medium flex items-center gap-2 text-slate-500">
                                {contextMenu.person.isActive ? <X size={16} /> : <Check size={16} />}
                                {contextMenu.person.isActive ? 'סמן כלא פעיל' : 'סמן כפעיל'}
                            </button>
                        </div>
                    </>
                )
            }

            {/* Reusable SheetModal for All Forms */}
            <SheetModal
                isOpen={isModalOpen}
                onClose={closeForm}
                title={getModalTitle()}
                isSaving={isSaving}
                onSave={handleSave}
            >
                {renderModalContent()}
            </SheetModal>

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
        </div >
    );
};
