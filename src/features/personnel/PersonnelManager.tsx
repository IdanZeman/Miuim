import React, { useState, useEffect, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createPortal } from 'react-dom';
import { MagnifyingGlass as Search, Plus, CaretDown as ChevronDown, CaretLeft as ChevronLeft, User, Users, Shield, PencilSimple as Pencil, Envelope as Mail, Pulse as Activity, Trash, FileXls as FileSpreadsheet, X, Check, DownloadSimple as Download, Archive, Warning as AlertTriangle, Funnel as Filter, ArrowsDownUp as ArrowUpDown, SortAscending as ArrowDownAZ, SortDescending as ArrowUpZA, Stack as Layers, List as LayoutList, DotsThreeVertical as MoreVertical, MagnifyingGlass, Funnel, DotsThreeVertical, FunnelIcon, DotsThreeVerticalIcon, FileXls, DownloadSimple, SortDescending, SortAscending, SortDescendingIcon, SortAscendingIcon, CaretLeft, CaretLeftIcon, MagnifyingGlassIcon, Globe, Tag, CloudArrowUp, WhatsappLogo } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Person, Team, Role, CustomFieldDefinition } from '../../types';
import { supabase } from '../../services/supabaseClient'; // optimization: check if still needed or remove
import { organizationService } from '../../services/organizationService';
import { mapPersonFromDB } from '../../services/mappers';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';
import { PageInfo } from '../../components/ui/PageInfo';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { ExcelImportWizard } from './ExcelImportWizard';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { GenericModal } from '../../components/ui/GenericModal';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { ROLE_ICONS } from '../../constants';
import ExcelJS from 'exceljs';
import { ExportButton } from '../../components/ui/ExportButton';
import { ActionBar, ActionListItem } from '../../components/ui/ActionBar';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { getPersonInitials, formatPhoneNumber } from '../../utils/nameUtils';
import { getWhatsAppLink } from '../../utils/phoneUtils';
import { PersonnelTableView } from './PersonnelTableView';
import { Table as TableIcon, SquaresFour as GridIcon, GearSix } from '@phosphor-icons/react';
import { CustomFieldsManager } from './CustomFieldsManager';
import { useTacticalDelete } from '../../hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '../../components/ui/TacticalDeleteWrapper';
import { EmptyStateCard } from '../../components/ui/EmptyStateCard';

interface PersonnelManagerProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    onAddPerson: (person: Person, options?: { skipDb?: boolean }) => void;
    onAddPeople?: (people: Person[]) => void;
    onDeletePerson: (id: string) => void;
    onDeletePeople: (ids: string[]) => void;
    onUpdatePerson: (person: Person, options?: { skipDb?: boolean }) => void;
    onUpdatePeople: (people: Person[]) => void;
    onAddTeam: (team: Team, options?: { skipDb?: boolean }) => Promise<Team | undefined | void>;
    onAddTeams?: (teams: Team[]) => Promise<Team[]>;
    onUpdateTeam: (team: Team, options?: { skipDb?: boolean }) => void | Promise<void>;
    onDeleteTeam: (id: string) => void;
    onAddRole: (role: Role, options?: { skipDb?: boolean }) => Promise<Role | undefined | void>;
    onAddRoles?: (roles: Role[]) => Promise<Role[]>;
    onDeleteRole: (id: string) => void;
    onUpdateRole: (role: Role, options?: { skipDb?: boolean }) => void;
    initialTab?: 'people' | 'teams' | 'roles';
    isViewer?: boolean;
    organizationId?: string;
    initialAction?: { type: 'edit_person', personId: string } | null;
    onClearNavigationAction?: () => void;
    onTabChange?: (tab: 'people' | 'teams' | 'roles') => void;
}

type Tab = 'people' | 'teams' | 'roles';

export const PersonnelManager: React.FC<PersonnelManagerProps> = ({
    people,
    teams,
    roles,
    onAddPerson,
    onAddPeople,
    onDeletePerson,
    onDeletePeople,
    onUpdatePerson,
    onUpdatePeople,
    onAddTeam,
    onAddTeams,
    onUpdateTeam,
    onDeleteTeam,
    onAddRole,
    onAddRoles,
    onDeleteRole,
    onUpdateRole,
    initialTab = 'people',
    isViewer = false,
    organizationId: propOrgId,
    initialAction,
    onClearNavigationAction,
    onTabChange
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

    // Tactical Delete Hooks for animated deletion
    const {
        animatingIds: deletingPeopleIds,
        handleTacticalDelete: handleTacticalDeletePerson
    } = useTacticalDelete<string>(onDeletePerson);

    const {
        animatingIds: deletingTeamIds,
        handleTacticalDelete: handleTacticalDeleteTeam
    } = useTacticalDelete<string>(onDeleteTeam);

    const {
        animatingIds: deletingRoleIds,
        handleTacticalDelete: handleTacticalDeleteRole
    } = useTacticalDelete<string>(onDeleteRole);

    // Keep snapshot of items being deleted for animation
    const deletingPeopleSnapshot = React.useRef<Map<string, Person>>(new Map());
    const deletingTeamsSnapshot = React.useRef<Map<string, Team>>(new Map());
    const deletingRolesSnapshot = React.useRef<Map<string, Role>>(new Map());

    // Manual control for animation state (without triggering delete action)
    const [manualDeletingPeopleIds, setManualDeletingPeopleIds] = useState<Set<string>>(new Set());
    const [manualDeletingTeamIds, setManualDeletingTeamIds] = useState<Set<string>>(new Set());
    const [manualDeletingRoleIds, setManualDeletingRoleIds] = useState<Set<string>>(new Set());

    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [searchTerm, setSearchTerm] = useState('');
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [isImportWizardOpen, setIsImportWizardOpen] = useState(false);
    const [showInactive, setShowInactive] = useState(false);

    // Filters
    const [filterTeamId, setFilterTeamId] = useState<string>('all');
    const [filterRoleId, setFilterRoleId] = useState<string>('all');
    const [filterCustomField, setFilterCustomField] = useState<string>('all');
    const [filterCustomValue, setFilterCustomValue] = useState<string | string[]>('');

    // NEW: Advanced View/Sort State
    const [viewGroupBy, setViewGroupBy] = useState<'teams' | 'roles' | 'none'>('teams');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
    const [isManageFieldsOpen, setIsManageFieldsOpen] = useState(false);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    // Form/Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    // Editing IDs
    const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
    const [isPropagating, setIsPropagating] = useState(false); // NEW
    const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
    const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

    // Import Results Modal State
    const [importResults, setImportResults] = useState<{ added: number; updated: number; failed: number; errors: { name: string; error: string }[] } | null>(null);

    // NEW: Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; type?: 'danger' | 'warning' | 'info' }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'danger'
    });

    const [isSaving, setIsSaving] = useState(false); // NEW: Loading state

    // --- UTILS: Safe Color Processing ---
    const getThemeColors = (colorStr?: string) => {
        if (!colorStr) return { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
        // Extract base color name (e.g. "blue" from "bg-blue-500" or "border-blue-600")
        const match = colorStr.match(/(?:bg|border|text)-([a-z]+)-(?:[0-9]+)/);
        const base = match ? match[1] : colorStr.replace(/^(bg|border|text)-/, '').split('-')[0];

        if (!base || base === 'slate' || base === 'gray') {
            return { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
        }

        return {
            bg: `bg-${base}-50`,
            text: `text-${base}-600`,
            border: `border-${base}-200`
        };
    };

    // Form Fields
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newPhone, setNewPhone] = useState(''); // NEW
    const [newItemActive, setNewItemActive] = useState(true); // NEW
    const [newTeamId, setNewTeamId] = useState('');
    const [newRoleIds, setNewRoleIds] = useState<string[]>([]);
    const [newCustomFields, setNewCustomFields] = useState<Record<string, any>>({});

    // Custom Fields Schema
    const [customFieldsSchema, setCustomFieldsSchema] = useState<CustomFieldDefinition[]>([]);
    const { organization } = useAuth(); // Needed for fallback

    // Determine the truly active organization ID we are managing
    const activeOrgId = propOrgId || organization?.id;

    useEffect(() => {
        const fetchSettings = async () => {
            if (!activeOrgId) return;
            try {
                const schema = await organizationService.fetchCustomFieldsSchema(activeOrgId);
                setCustomFieldsSchema(schema);
            } catch (error) {
                console.error('Error fetching custom fields schema:', error);
            }
        };
        fetchSettings();
    }, [activeOrgId]);

    // New State for Field Creation
    const [isCreatingField, setIsCreatingField] = useState(false);
    const [creatingFieldData, setCreatingFieldData] = useState<{
        label: string;
        type: string;
        optionsString: string;
    }>({ label: '', type: 'text', optionsString: '' });

    const handleCreateField = async () => {
        if (!creatingFieldData.label || !activeOrgId) return;

        const newField: CustomFieldDefinition = {
            id: crypto.randomUUID(),
            key: creatingFieldData.label,
            label: creatingFieldData.label,
            type: creatingFieldData.type as any,
            order: customFieldsSchema.length,
            options: creatingFieldData.type === 'select' || creatingFieldData.type === 'multiselect'
                ? creatingFieldData.optionsString.split(',').map(s => s.trim()).filter(Boolean)
                : undefined
        };

        const updatedSchema = [...customFieldsSchema, newField];
        setCustomFieldsSchema(updatedSchema);
        setIsCreatingField(false);
        setCreatingFieldData({ label: '', type: 'text', optionsString: '' });

        // Persist to DB
        try {
            await organizationService.updateCustomFieldsSchema(activeOrgId, updatedSchema);
        } catch (error) {
            console.error('Error saving custom schema:', error);
        }
    };

    const handleDeleteFieldGlobally = (key: string) => {
        requestConfirm(
            'מחיקת שדה והנתונים שלו',
            'שים לב: פעולה זו תמחק את השדה מההגדרות וגם תמחק את כל הנתונים שהוזנו בשדה זה עבור כל החיילים. הפעולה אינה הפיכה. האם להמשיך?',
            async () => {
                const updatedSchema = customFieldsSchema.filter(f => f.key !== key);
                setCustomFieldsSchema(updatedSchema);
                setConfirmModal(prev => ({ ...prev, isOpen: false })); // סגירה מיידית של חלון האישור

                try {
                    if (activeOrgId) {
                        // 1. Update schema definition
                        await organizationService.updateCustomFieldsSchema(activeOrgId, updatedSchema);

                        // 2. Cleanse all people locally and update DB (as fallback/primary mechanism)
                        // -- LEAK PREVENTION: Only propagate to people in the SAME organization --
                        const modifiedPeople = people
                            .filter(p => p.organization_id === activeOrgId && p.customFields && Object.prototype.hasOwnProperty.call(p.customFields, key))
                            .map(p => {
                                const newFields = { ...p.customFields };
                                delete newFields[key];
                                return { ...p, customFields: newFields };
                            });

                        if (modifiedPeople.length > 0) {
                            await onUpdatePeople(modifiedPeople);
                        }

                        // 3. Try RPC as well for comprehensive cleanup (in case some people aren't loaded)
                        await organizationService.deleteCustomFieldGlobally(activeOrgId, key);

                        showToast('השדה והנתונים נמחקו בהצלחה', 'success');
                    }
                } catch (error) {
                    console.error('Error saving custom schema:', error);
                    showToast('שגיאה במחיקת שדה', 'error');
                }
            },
            'danger'
        );
    };

    // Generic Items (Team/Role)
    const [newItemName, setNewItemName] = useState('');
    const [newItemColor, setNewItemColor] = useState('border-slate-500'); // Default for teams
    const [newItemIcon, setNewItemIcon] = useState('Shield'); // NEW: For roles

    // NEW: Bulk Selection
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

    // NEW: Duplicate Warning State
    const [duplicateWarning, setDuplicateWarning] = useState<{ person: Person, isOpen: boolean } | null>(null);

    // NEW: Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, person: Person } | null>(null);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    // -- Derived/Sorted Data --
    const sortedTeamsAsc = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name, 'he')), [teams]);
    const sortedRolesAsc = useMemo(() => [...roles].sort((a, b) => a.name.localeCompare(b.name, 'he')), [roles]);

    const displayTeamsList = useMemo(() => {
        // Include teams being deleted for animation
        const allDeletingIds = new Set([...deletingTeamIds, ...manualDeletingTeamIds]);
        const allTeams = [...teams];

        // Add deleted teams that are still animating
        allDeletingIds.forEach(id => {
            if (!teams.find(t => t.id === id) && deletingTeamsSnapshot.current.has(id)) {
                allTeams.push(deletingTeamsSnapshot.current.get(id)!);
            }
        });

        return allTeams
            .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const cmp = a.name.localeCompare(b.name, 'he');
                return sortOrder === 'asc' ? cmp : -cmp;
            });
    }, [teams, deletingTeamIds, manualDeletingTeamIds, searchTerm, sortOrder]);

    const displayRolesList = useMemo(() => {
        // Include roles being deleted for animation
        const allDeletingIds = new Set([...deletingRoleIds, ...manualDeletingRoleIds]);
        const allRoles = [...roles];

        // Add deleted roles that are still animating
        allDeletingIds.forEach(id => {
            if (!roles.find(r => r.id === id) && deletingRolesSnapshot.current.has(id)) {
                allRoles.push(deletingRolesSnapshot.current.get(id)!);
            }
        });

        return allRoles
            .filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .sort((a, b) => {
                const cmp = a.name.localeCompare(b.name, 'he');
                return sortOrder === 'asc' ? cmp : -cmp;
            });
    }, [roles, deletingRoleIds, manualDeletingRoleIds, searchTerm, sortOrder]);

    const filteredPeople = useMemo(() => {
        // Include people being deleted for animation
        // Combine both hook-based and manual animation IDs
        const allDeletingIds = new Set([...deletingPeopleIds, ...manualDeletingPeopleIds]);
        const allPeople = [...people];

        // Add deleted people that are still animating
        allDeletingIds.forEach(id => {
            if (!people.find(p => p.id === id) && deletingPeopleSnapshot.current.has(id)) {
                allPeople.push(deletingPeopleSnapshot.current.get(id)!);
            }
        });

        const normalizedSearch = searchTerm.trim().toLowerCase();

        const filtered = allPeople
            .filter(p => {
                if (!normalizedSearch) return true;
                const teamName = teams.find(t => t.id === p.teamId)?.name || '';
                const roleNames = (p.roleIds || [])
                    .map(roleId => roles.find(r => r.id === roleId)?.name || '')
                    .join(' ');

                const customFieldValues = Object.values(p.customFields || {})
                    .map(val => Array.isArray(val) ? val.join(' ') : String(val ?? ''))
                    .join(' ');

                return [
                    p.name,
                    p.email || '',
                    p.phone || '',
                    teamName,
                    roleNames,
                    customFieldValues
                ]
                    .join(' ')
                    .toLowerCase()
                    .includes(normalizedSearch);
            })
            .filter(p => (p.isActive === false ? showInactive : true))
            .filter(p => filterTeamId === 'all' || (filterTeamId === 'no-team' ? !p.teamId : p.teamId === filterTeamId))
            .filter(p => filterRoleId === 'all' || (p.roleIds || []).includes(filterRoleId))
            .filter(p => {
                if (filterCustomField === 'all') return true;
                const val = p.customFields?.[filterCustomField];
                if (val === undefined || val === null) return false;

                if (Array.isArray(filterCustomValue)) {
                    if (filterCustomValue.length === 0) return true;
                    if (typeof val === 'boolean') return filterCustomValue.includes(val.toString());
                    if (Array.isArray(val)) return val.some(v => filterCustomValue.includes(v));
                    return filterCustomValue.includes(val.toString());
                }

                if (!filterCustomValue) return true;
                if (typeof val === 'boolean') return val.toString() === filterCustomValue;
                return val.toString().toLowerCase().includes(filterCustomValue.toLowerCase());
            });

        const sorted = [...filtered];
        if (sortOrder === 'asc') sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        else sorted.sort((a, b) => b.name.localeCompare(a.name, 'he'));
        return sorted;
    }, [people, deletingPeopleIds, manualDeletingPeopleIds, filterTeamId, filterRoleId, filterCustomField, filterCustomValue, showInactive, sortOrder, searchTerm, teams, roles]);

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

    // Clean up deleted people snapshot when animation ends
    useEffect(() => {
        // Remove people from snapshot that are no longer animating
        deletingPeopleSnapshot.current.forEach((_, id) => {
            if (!deletingPeopleIds.has(id)) {
                deletingPeopleSnapshot.current.delete(id);
            }
        });
    }, [deletingPeopleIds]);

    // Track people count changes to detect deletions
    const prevPeopleRef = React.useRef<Person[]>(people);
    useEffect(() => {
        const prevPeople = prevPeopleRef.current;
        const removedPeople = prevPeople.filter(prev => !people.find(curr => curr.id === prev.id));

        if (removedPeople.length > 0) {
            removedPeople.forEach(person => {
                if (!deletingPeopleSnapshot.current.has(person.id)) {
                    deletingPeopleSnapshot.current.set(person.id, person);
                    setManualDeletingPeopleIds(prev => new Set(prev).add(person.id));

                    setTimeout(() => {
                        setManualDeletingPeopleIds(prev => {
                            const next = new Set(prev);
                            next.delete(person.id);
                            return next;
                        });
                        deletingPeopleSnapshot.current.delete(person.id);
                    }, 1300);
                }
            });
        }
        prevPeopleRef.current = people;
    }, [people]);

    // Track teams count changes to detect deletions
    const prevTeamsRef = React.useRef<Team[]>(teams);
    useEffect(() => {
        const prevTeams = prevTeamsRef.current;
        const removedTeams = prevTeams.filter(prev => !teams.find(curr => curr.id === prev.id));

        if (removedTeams.length > 0) {
            removedTeams.forEach(team => {
                if (!deletingTeamsSnapshot.current.has(team.id)) {
                    deletingTeamsSnapshot.current.set(team.id, team);
                    setManualDeletingTeamIds(prev => new Set(prev).add(team.id));

                    setTimeout(() => {
                        setManualDeletingTeamIds(prev => {
                            const next = new Set(prev);
                            next.delete(team.id);
                            return next;
                        });
                        deletingTeamsSnapshot.current.delete(team.id);
                    }, 1300);
                }
            });
        }
        prevTeamsRef.current = teams;
    }, [teams]);

    // Track roles count changes to detect deletions
    const prevRolesRef = React.useRef<Role[]>(roles);
    useEffect(() => {
        const prevRoles = prevRolesRef.current;
        const removedRoles = prevRoles.filter(prev => !roles.find(curr => curr.id === prev.id));

        if (removedRoles.length > 0) {
            removedRoles.forEach(role => {
                if (!deletingRolesSnapshot.current.has(role.id)) {
                    deletingRolesSnapshot.current.set(role.id, role);
                    setManualDeletingRoleIds(prev => new Set(prev).add(role.id));

                    setTimeout(() => {
                        setManualDeletingRoleIds(prev => {
                            const next = new Set(prev);
                            next.delete(role.id);
                            return next;
                        });
                        deletingRolesSnapshot.current.delete(role.id);
                    }, 1300);
                }
            });
        }
        prevRolesRef.current = roles;
    }, [roles]);

    // Handle initial action (e.g. from Command Palette)
    useEffect(() => {
        if (initialAction?.type === 'edit_person' && initialAction.personId) {
            const person = people.find(p => p.id === initialAction.personId);
            if (person) {
                setActiveTab('people');
                handleEditPersonClick(person);
                onClearNavigationAction?.();
            }
        }
        // Only switch tab if initialTab is explicitly different from current and we haven't handled it
        // We use a mounting ref or check onClearNavigationAction availability
    }, [initialAction, people, onClearNavigationAction]);

    // Set initial tab once on mount or when specifically requested externally
    const [hasInitializedTab, setHasInitializedTab] = useState(false);
    useEffect(() => {
        if (!hasInitializedTab && initialTab) {
            setActiveTab(initialTab);
            setHasInitializedTab(true);
        }
    }, [initialTab, hasInitializedTab]);

    // Clear selection on tab change and notify parent
    useEffect(() => {
        setSelectedItemIds(new Set());
        if (hasInitializedTab) {
            onTabChange?.(activeTab);
        }
    }, [activeTab, onTabChange, hasInitializedTab]);

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

    const requestConfirm = (title: string, message: string, action: () => void, type: 'danger' | 'warning' = 'danger') => {
        setConfirmModal({
            isOpen: true,
            title,
            message,
            onConfirm: () => {
                action();
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            },
            type
        });
    };

    const handleBulkDelete = () => {
        if (selectedItemIds.size === 0) return;

        const ids = Array.from(selectedItemIds);

        // --- OPTIMIZATION: For people deletion, skip the first generic confirmation ---
        // because App.tsx already provides a much more detailed impact-aware confirmation.
        if (activeTab === 'people') {
            onDeletePeople(ids);
            setSelectedItemIds(new Set());
            return;
        }

        // For Teams/Roles, use tactical delete with confirmation
        requestConfirm(
            'מחיקת פריטים',
            `האם אתה בטוח שברצונך למחוק ${selectedItemIds.size} פריטים? פעולה זו היא בלתי הפיכה.`,
            async () => {
                // Delete all items in parallel so animations happen simultaneously
                await Promise.all(ids.map(id => {
                    if (activeTab === 'teams') return handleTacticalDeleteTeam(id);
                    else if (activeTab === 'roles') return handleTacticalDeleteRole(id);
                    return Promise.resolve();
                }));

                logger.info('DELETE', `Bulk deleted ${selectedItemIds.size} ${activeTab}`, {
                    count: selectedItemIds.size,
                    type: activeTab,
                    ids: ids,
                    category: 'data'
                });
                setSelectedItemIds(new Set());
                showToast('הפריטים נמחקו בהצלחה', 'success');
            }
        );
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
        setNewItemName('');
        setNewItemIcon('Shield');
    };

    const handleSelectAll = () => {
        let itemsToSelect: string[] = [];
        if (activeTab === 'people') itemsToSelect = filteredPeople.map(p => p.id);
        else if (activeTab === 'teams') itemsToSelect = displayTeamsList.map(t => t.id);
        else if (activeTab === 'roles') itemsToSelect = displayRolesList.map(r => r.id);

        const currentSelected = new Set(selectedItemIds);
        const allAlreadySelected = itemsToSelect.length > 0 && itemsToSelect.every(id => currentSelected.has(id));

        if (allAlreadySelected) {
            itemsToSelect.forEach(id => currentSelected.delete(id));
        } else {
            itemsToSelect.forEach(id => currentSelected.add(id));
        }
        setSelectedItemIds(currentSelected);
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
        setIsModalOpen(true);
    };

    // Helper to save person before deletion (for animation)
    const handleDeletePersonWithAnimation = async (personId: string) => {
        const person = people.find(p => p.id === personId);
        if (person) {
            deletingPeopleSnapshot.current.set(personId, person);
            handleTacticalDeletePerson(personId);
        }
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
        setNewItemIcon(role.icon || 'Shield');
        setIsModalOpen(true);
    };

    const handleExport = async () => {
        if (!canEdit) {
            showToast('אין לך הרשאה לייצא נתונים', 'error');
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('ייצוא נתונים', { views: [{ rightToLeft: true }] });
            let fileName = '';

            if (activeTab === 'people') {
                // 1. Static Columns
                const columns = [
                    { name: 'שם מלא', filterButton: true, width: 25 },
                    { name: 'צוות', filterButton: true, width: 15 },
                    { name: 'תפקידים', filterButton: true, width: 30 },
                    { name: 'טלפון', filterButton: true, width: 15 },
                    { name: 'אימייל', filterButton: true, width: 25 },
                    { name: 'סטטוס', filterButton: true, width: 12 }
                ];

                // 2. Add Custom Fields Columns
                const sortedSchema = [...customFieldsSchema].sort((a, b) => (a.order || 0) - (b.order || 0));
                sortedSchema.forEach(field => {
                    columns.push({
                        name: field.label,
                        filterButton: true,
                        width: 20
                    } as any);
                });

                const activePeople = people.filter(p => p.isActive !== false);
                const rows = activePeople.map(p => {
                    const teamName = teams.find(t => t.id === p.teamId)?.name || 'ללא צוות';
                    const roleNames = (p.roleIds || [])
                        .map(id => roles.find(r => r.id === id)?.name)
                        .filter(Boolean)
                        .join(' | ');
                    const status = p.isActive === false ? 'לא פעיל' : 'פעיל';

                    // Base Data
                    const rowData = [p.name, teamName, roleNames, p.phone || '', p.email || '', status];

                    // Custom Fields Data
                    sortedSchema.forEach(field => {
                        let value = p.customFields?.[field.key];

                        // Format based on type
                        if (value === undefined || value === null) {
                            value = '';
                        } else if (field.type === 'boolean') {
                            value = value ? 'כן' : 'לא';
                        } else if (Array.isArray(value)) {
                            value = value.join(', ');
                        }

                        rowData.push(value);
                    });

                    return rowData;
                });

                worksheet.addTable({
                    name: 'PeopleTable',
                    ref: 'A1',
                    headerRow: true,
                    totalsRow: false,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true },
                    columns: columns.map(c => ({ name: c.name, filterButton: c.filterButton })),
                    rows: rows,
                });

                // Set column widths
                worksheet.columns = columns.map(c => ({ width: c.width }));

                fileName = `people_export_${new Date().toLocaleDateString('en-CA')}.xlsx`;
            } else if (activeTab === 'teams') {
                const columns = [
                    { name: 'שם צוות', filterButton: true },
                    { name: 'מספר חברים', filterButton: true },
                    { name: 'צבע', filterButton: true }
                ];

                const rows = sortedTeamsAsc.map(t => {
                    const memberCount = people.filter(p => p.isActive !== false && p.teamId === t.id).length;
                    return [t.name, memberCount, t.color];
                });

                worksheet.addTable({
                    name: 'TeamsTable',
                    ref: 'A1',
                    headerRow: true,
                    columns: columns,
                    rows: rows,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true }
                });

                worksheet.columns = [{ width: 25 }, { width: 15 }, { width: 20 }];
                fileName = `teams_export_${new Date().toLocaleDateString('en-CA')}.xlsx`;
            } else if (activeTab === 'roles') {
                const columns = [
                    { name: 'שם תפקיד', filterButton: true },
                    { name: 'מספר משובצים', filterButton: true },
                    { name: 'צבע', filterButton: true }
                ];

                const rows = sortedRolesAsc.map(r => {
                    const count = people.filter(p => p.isActive !== false && (p.roleIds || []).includes(r.id)).length;
                    return [r.name, count, r.color];
                });

                worksheet.addTable({
                    name: 'RolesTable',
                    ref: 'A1',
                    headerRow: true,
                    columns: columns,
                    rows: rows,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true }
                });

                worksheet.columns = [{ width: 25 }, { width: 15 }, { width: 20 }];
                fileName = `roles_export_${new Date().toLocaleDateString('en-CA')}.xlsx`;
            }

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
            showToast('הקובץ יוצא בהצלחה', 'success');

            logger.log({
                action: 'EXPORT',
                entityName: activeTab,
                category: 'data',
                metadata: { fileName }
            });
        } catch (error) {
            console.error('Export failed:', error);
            showToast('שגיאה בייצוא הנתונים', 'error');
        }
    };

    const handleBulkImport = async (importedPeople: Person[], newTeams: Team[] = [], newRoles: Role[] = [], newCustomFields: CustomFieldDefinition[] = []) => {
        setIsSaving(true);
        try {
            // ID Mapping Stores
            const teamIdMap = new Map<string, string>();
            const roleIdMap = new Map<string, string>();

            // 1. Add new Teams first
            if (newTeams.length > 0) {
                if (onAddTeams) {
                    const createdTeams = await onAddTeams(newTeams);
                    newTeams.forEach((oldT, idx) => {
                        const newT = createdTeams[idx];
                        if (newT) teamIdMap.set(oldT.id, newT.id);
                    });
                } else {
                    for (const t of newTeams) {
                        const createdTeam = await onAddTeam(t);
                        if (createdTeam && (createdTeam as any).id) {
                            teamIdMap.set(t.id, (createdTeam as any).id);
                        }
                    }
                }
            }

            // 1.2 Add new Roles
            if (newRoles.length > 0) {
                if (onAddRoles) {
                    const createdRoles = await onAddRoles(newRoles);
                    newRoles.forEach((oldR, idx) => {
                        const newR = createdRoles[idx];
                        if (newR) roleIdMap.set(oldR.id, newR.id);
                    });
                } else {
                    for (const r of newRoles) {
                        const createdRole = await onAddRole(r);
                        if (createdRole && (createdRole as any).id) {
                            roleIdMap.set(r.id, (createdRole as any).id);
                        }
                    }
                }
            }

            // 1.5. Add new Custom Fields
            if (newCustomFields.length > 0 && activeOrgId) {
                const updatedSchema = [...customFieldsSchema, ...newCustomFields];
                setCustomFieldsSchema(updatedSchema);
                try {
                    await supabase
                        .from('organization_settings')
                        .update({ custom_fields_schema: updatedSchema })
                        .eq('organization_id', activeOrgId);
                } catch (error) {
                    console.error('Error saving custom schema:', error);
                }
            }

            let added = 0;
            let updated = 0;
            let failed = 0;
            const detailedErrors: { name: string; error: string }[] = [];

            const peopleToAddMap = new Map<string, Person>();
            const peopleToUpdateMap = new Map<string, Person>();
            const seenNewPeopleUniqueKeys = new Set<string>();
            const existingPeopleMap = new Map<string, Person>(people.map(p => [p.id, p]));

            for (const p of importedPeople) {
                const correctedTeamId = teamIdMap.get(p.teamId) || p.teamId;
                const correctedRoleIds = (p.roleIds || []).map(rid => roleIdMap.get(rid) || rid);

                const existing = existingPeopleMap.get(p.id);
                if (existing) {
                    peopleToUpdateMap.set(p.id, {
                        ...existing,
                        name: p.name,
                        teamId: correctedTeamId,
                        roleIds: correctedRoleIds,
                        email: p.email || existing.email,
                        phone: p.phone || existing.phone,
                        customFields: { ...existing.customFields, ...(p.customFields || {}) }
                    });
                } else {
                    const uniqueKey = (p.phone || p.email || p.name).trim().toLowerCase();
                    if (seenNewPeopleUniqueKeys.has(uniqueKey)) continue;
                    seenNewPeopleUniqueKeys.add(uniqueKey);

                    const newId = p.id || uuidv4();
                    peopleToAddMap.set(newId, {
                        ...p,
                        id: newId,
                        teamId: correctedTeamId,
                        roleIds: correctedRoleIds
                    });
                }
            }

            const peopleToAdd = Array.from(peopleToAddMap.values());
            const peopleToUpdate = Array.from(peopleToUpdateMap.values());

            if (peopleToAdd.length > 0) {
                try {
                    if (onAddPeople) {
                        await onAddPeople(peopleToAdd);
                        added += peopleToAdd.length;
                    } else if (onAddPerson) {
                        for (const p of peopleToAdd) {
                            await onAddPerson(p);
                            added++;
                        }
                    }
                } catch (e: any) {
                    console.error("Batch Add Error", e);
                    failed += peopleToAdd.length;
                    detailedErrors.push({ name: 'Bulk Add', error: e.message || 'Error during batch add' });
                }
            }

            if (peopleToUpdate.length > 0) {
                try {
                    await onUpdatePeople(peopleToUpdate);
                    updated += peopleToUpdate.length;
                } catch (e: any) {
                    console.error("Batch Update Error", e);
                    failed += peopleToUpdate.length;
                    detailedErrors.push({ name: 'Bulk Update', error: e.message || 'Error during batch update' });
                }
            }

            if (failed > 0) {
                setImportResults({ added, updated, failed, errors: detailedErrors });
            } else {
                showToast(`בוצע בהצלחה: ${added} נוספו, ${updated} עודכנו`, 'success');
            }
            logger.log({ action: 'CREATE', entityType: 'person', entityName: 'bulk_import', metadata: { added, updated, failed } });
        } catch (err: any) {
            console.error('Final Import Error:', err);
            showToast('שגיאה במהלך הייבוא הסופי', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const executeSavePerson = async () => {
        setIsSaving(true);
        // Clean up empty orphaned fields before saving
        const cleanedCustomFields = { ...newCustomFields };
        Object.entries(cleanedCustomFields).forEach(([key, value]) => {
            const inSchema = customFieldsSchema.some(f => f.key === key);
            if (!inSchema && (value === undefined || value === null || value === "")) {
                delete cleanedCustomFields[key];
            }
        });

        // Specific normalization for phone/email fields in custom data
        customFieldsSchema.forEach(field => {
            if (field.type === 'phone' && cleanedCustomFields[field.key]) {
                cleanedCustomFields[field.key] = formatPhoneNumber(cleanedCustomFields[field.key]);
            }
        });

        const personData: any = {
            name: newName,
            email: newEmail,
            phone: formatPhoneNumber(newPhone),
            isActive: newItemActive,
            teamId: newTeamId,
            roleIds: newRoleIds,
            customFields: cleanedCustomFields,
            color: 'bg-blue-500' // Default
        };

        try {
            const { data, error } = await supabase.rpc('upsert_person', {
                p_id: editingPersonId ?? null,
                p_name: personData.name,
                p_email: personData.email,
                p_team_id: personData.teamId || null,
                p_role_ids: personData.roleIds || [],
                p_phone: personData.phone,
                p_is_active: personData.isActive,
                p_custom_fields: personData.customFields,
                p_color: personData.color
            });

            if (error) throw error;
            if (!data) throw new Error('שגיאה בשמירת חייל');

            const savedPerson = mapPersonFromDB(data);

            if (editingPersonId) {
                const previousPerson = people.find(p => p.id === editingPersonId);
                await onUpdatePerson(savedPerson as Person, { skipDb: true });
                logger.logUpdate('person', editingPersonId, personData.name, previousPerson, savedPerson);
                showToast('החייל עודכן בהצלחה', 'success');
            } else {
                await onAddPerson(savedPerson as Person, { skipDb: true });
                logger.logCreate('person', savedPerson.id, personData.name, savedPerson);
                showToast('החייל נוסף בהצלחה', 'success');
            }

            closeForm();
        } catch (e: any) {
            showToast(e?.message || 'שגיאה בשמירה', 'error');
            logger.logError(editingPersonId ? 'UPDATE' : 'CREATE', 'Failed to save person', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSave = async () => {
        if (activeTab === 'people') {
            if (!newName.trim()) { showToast('נא להזין שם', 'error'); return; }
            if (!newTeamId && teams.length > 0) { showToast('נא לבחור צוות', 'error'); return; }

            // Validate Required Custom Fields
            for (const field of customFieldsSchema) {
                const val = newCustomFields[field.key];
                if (field.required && (val === undefined || val === null || (typeof val === 'string' && val.trim() === ''))) {
                    showToast(`נא להזין ${field.label}`, 'error');
                    return;
                }
            }

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
                const { data, error } = await supabase.rpc('upsert_team', {
                    p_id: editingTeamId ?? null,
                    p_name: teamData.name,
                    p_color: teamData.color
                });

                if (error) throw error;

                const savedTeam = data as Team | null;
                if (savedTeam) {
                    if (editingTeamId) {
                        await onUpdateTeam(savedTeam, { skipDb: true });
                        showToast('הצוות עודכן', 'success');
                    } else {
                        await onAddTeam(savedTeam, { skipDb: true });
                        showToast('הצוות נוצר', 'success');
                    }
                } else {
                    showToast('שגיאה בשמירת צוות', 'error');
                }
                closeForm();
            } catch (e: any) {
                showToast("שגיאה בשמירת צוות", 'error');
                logger.error(editingTeamId ? 'UPDATE' : 'CREATE', "Failed to save team", e);
            } finally {
                setIsSaving(false);
            }
        }
        else if (activeTab === 'roles') {
            if (!newItemName.trim()) { showToast('נא להזין שם תפקיד', 'error'); return; }
            const roleData = { name: newItemName.trim(), color: newItemColor, icon: newItemIcon };

            setIsSaving(true);
            try {
                const { data, error } = await supabase.rpc('upsert_role', {
                    p_id: editingRoleId ?? null,
                    p_name: roleData.name,
                    p_color: roleData.color,
                    p_icon: roleData.icon
                });

                if (error) throw error;

                const savedRole = data as Role | null;
                if (savedRole) {
                    if (editingRoleId) {
                        await onUpdateRole(savedRole, { skipDb: true });
                        showToast('התפקיד עודכן', 'success');
                    } else {
                        await onAddRole(savedRole, { skipDb: true });
                        showToast('התפקיד נוצר', 'success');
                    }
                } else {
                    showToast('שגיאה בשמירת תפקיד', 'error');
                }

                closeForm();
            } catch (e: any) {
                showToast("שגיאה בשמירת תפקיד", 'error');
                logger.error(editingRoleId ? 'UPDATE' : 'CREATE', "Failed to save role", e);
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
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">פרטים אישיים</h3>
                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {/* Name */}
                            <div className="flex items-center px-5 py-4 group">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                    <User size={18} weight="bold" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">שם מלא</label>
                                    <input
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="ישראל ישראלי"
                                        className="block w-full bg-transparent border-none p-0 outline-none text-slate-900 font-bold text-base placeholder:text-slate-300"
                                    />
                                </div>
                            </div>
                            {/* Phone */}
                            <div className="flex items-center px-5 py-4 group">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                    <div className="text-sm font-black">#</div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">טלפון</label>
                                    <input
                                        value={newPhone}
                                        onChange={e => setNewPhone(e.target.value)}
                                        placeholder="050-0000000"
                                        type="tel"
                                        className="block w-full bg-transparent border-none p-0 outline-none text-slate-900 font-bold text-base placeholder:text-slate-300 text-right"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                            {/* Email */}
                            <div className="flex items-center px-5 py-4 group">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                    <Mail size={18} weight="bold" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">אימייל</label>
                                    <input
                                        value={newEmail}
                                        onChange={e => setNewEmail(e.target.value)}
                                        placeholder="email@example.com"
                                        type="email"
                                        className="block w-full bg-transparent border-none p-0 outline-none text-slate-900 font-bold text-base placeholder:text-slate-300"
                                        dir="ltr"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. Team & Status Group */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">שיוך וסטטוס</h3>
                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                            {/* Team Selector */}
                            <div className="flex items-center px-5 py-4 group bg-white relative">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                    <Users size={18} weight="bold" />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">צוות</label>
                                    <Select
                                        value={newTeamId}
                                        onChange={(val) => setNewTeamId(val)}
                                        options={sortedTeamsAsc.map(t => ({ value: t.id, label: t.name }))}
                                        placeholder="בחר צוות"
                                        className="bg-transparent border-none shadow-none hover:bg-slate-50 pr-0 h-auto py-0 font-bold text-base"
                                        containerClassName="w-full"
                                    />
                                </div>
                            </div>

                            {/* Active Status */}
                            <div
                                className="flex items-center justify-between px-5 py-4 cursor-pointer active:bg-slate-50 transition-colors"
                                onClick={() => setNewItemActive(!newItemActive)}
                                role="switch"
                                aria-checked={newItemActive}
                                aria-label="סטטוס פעיל"
                                tabIndex={0}
                                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setNewItemActive(!newItemActive); } }}
                            >
                                <div className="flex items-center">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-4 transition-colors ${newItemActive ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                                        <Activity size={18} weight="bold" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-black text-slate-900">סטטוס פעיל</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">מופיע בחיפושים ושיבוצים</div>
                                    </div>
                                </div>
                                <div className={`w-12 h-6 rounded-full transition-all relative ${newItemActive ? 'bg-green-500' : 'bg-slate-200'}`}>
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${newItemActive ? 'left-1' : 'left-7'}`} />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* 3. Roles Group */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">תפקידים והכשרות</h3>
                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5">
                            <div className="flex flex-wrap gap-2.5">
                                {sortedRolesAsc.map(role => {
                                    const isSelected = newRoleIds.includes(role.id);
                                    const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                                    return (
                                        <button
                                            key={role.id}
                                            onClick={() => {
                                                if (isSelected) setNewRoleIds(newRoleIds.filter(id => id !== role.id));
                                                else setNewRoleIds([...newRoleIds, role.id]);
                                            }}
                                            className={`h-11 px-4 rounded-2xl text-xs font-black border-2 transition-all flex items-center gap-2.5 active:scale-95 ${isSelected
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md shadow-indigo-100'
                                                : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                                                }`}
                                        >
                                            <Icon size={16} strokeWidth={isSelected ? 3 : 2} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                                            {role.name}
                                        </button>
                                    );
                                })}
                            </div>
                            {roles.length === 0 && (
                                <p className="text-xs font-bold text-slate-400 text-center py-4">אין תפקידים מוגדרים במערכת</p>
                            )}
                        </div>
                    </div>

                    {/* 4. Custom Fields Group - Schema Based */}
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">נתונים נוספים</h3>

                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden p-5 space-y-4">
                            {customFieldsSchema
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .map(field => {
                                    const value = newCustomFields[field.key];

                                    return (
                                        <div key={field.key} className="space-y-1.5 group">
                                            <div className="flex items-center justify-between">
                                                <label className="block text-xs font-bold text-slate-700">
                                                    {field.label}
                                                    {field.required && <span className="text-red-500 mr-1">*</span>}
                                                </label>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleDeleteFieldGlobally(field.key)}
                                                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                        title="מחק שדה מהארגון"
                                                    >
                                                        <Trash size={14} weight="bold" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Render Input based on Type */}
                                            {field.type === 'boolean' ? (
                                                <div
                                                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                                    onClick={() => setNewCustomFields({ ...newCustomFields, [field.key]: !value })}
                                                >
                                                    <div className={`w-10 h-6 rounded-full relative ${value ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm ${value ? 'left-1' : 'left-5'}`} />
                                                    </div>
                                                    <span className="text-sm font-medium text-slate-600">
                                                        {value ? 'כן' : 'לא'}
                                                    </span>
                                                </div>
                                            ) : field.type === 'select' ? (
                                                <Select
                                                    value={value}
                                                    onChange={(val) => setNewCustomFields({ ...newCustomFields, [field.key]: val })}
                                                    options={[
                                                        { value: '', label: field.placeholder || 'בחר...' },
                                                        ...(field.options || []).map(opt => ({ value: opt, label: opt }))
                                                    ]}
                                                    placeholder={field.placeholder || "בחר..."}
                                                    className="bg-slate-50 border-slate-200 rounded-xl"
                                                />
                                            ) : field.type === 'multiselect' ? (
                                                <div className="space-y-2">
                                                    <div className="flex flex-wrap gap-2">
                                                        {((value as string[]) || []).map((val: string) => (
                                                            <span key={val} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                                                {val}
                                                                <button
                                                                    onClick={() => {
                                                                        const current = (value as string[]) || [];
                                                                        setNewCustomFields({
                                                                            ...newCustomFields,
                                                                            [field.key]: current.filter(v => v !== val)
                                                                        });
                                                                    }}
                                                                    className="hover:text-red-500"
                                                                >
                                                                    <X size={12} weight="bold" />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <select
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        onChange={(e) => {
                                                            if (!e.target.value) return;
                                                            const current = (value as string[]) || [];
                                                            if (!current.includes(e.target.value)) {
                                                                setNewCustomFields({
                                                                    ...newCustomFields,
                                                                    [field.key]: [...current, e.target.value]
                                                                });
                                                            }
                                                            e.target.value = '';
                                                        }}
                                                    >
                                                        <option value="">{field.placeholder || "הוסף אפשרות..."}</option>
                                                        {(field.options || []).filter(opt => !((value as string[]) || []).includes(opt)).map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : field.type === 'textarea' ? (
                                                <textarea
                                                    value={value || ''}
                                                    onChange={(e) => setNewCustomFields({ ...newCustomFields, [field.key]: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 min-h-[80px]"
                                                    placeholder={field.placeholder}
                                                />
                                            ) : (
                                                <Input
                                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                                                    value={value || ''}
                                                    onChange={(e) => setNewCustomFields({ ...newCustomFields, [field.key]: e.target.value })}
                                                    placeholder={field.placeholder}
                                                    className={`bg-slate-50 border-slate-200 rounded-xl ${['phone', 'number', 'email'].includes(field.type) ? 'text-right' : ''}`}
                                                    dir={['phone', 'number', 'email'].includes(field.type) ? 'ltr' : undefined}
                                                />
                                            )}

                                            {field.helpText && (
                                                <p className="text-[10px] text-slate-400 mr-1">{field.helpText}</p>
                                            )}
                                        </div>
                                    );
                                })}

                            {/* 2. Orphaned / Legacy Fields (Not in Schema) */}
                            {Object.entries(newCustomFields || {})
                                .filter(([key, value]) => {
                                    const inSchema = customFieldsSchema.some(f => f.key === key);
                                    if (inSchema) return false;
                                    // Only show if it has an actual value (even "false" for boolean)
                                    return value !== undefined && value !== null && value !== "";
                                })
                                .map(([key, value]) => (
                                    <div key={key} className="flex items-center gap-2 group">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5 truncate flex items-center gap-1">
                                                {key}
                                                <span className="bg-slate-100 text-slate-500 px-1 py-0.5 rounded text-[8px] font-normal">לא מוגדר</span>
                                            </label>
                                            <input
                                                value={value}
                                                onChange={(e) => setNewCustomFields({ ...newCustomFields, [key]: e.target.value })}
                                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold shadow-sm"
                                            />
                                        </div>
                                        <button
                                            onClick={() => {
                                                const next = { ...newCustomFields };
                                                delete next[key];
                                                setNewCustomFields(next);
                                            }}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors mt-4 bg-slate-50 rounded-xl"
                                            title="מחק שדה"
                                        >
                                            <Trash size={16} weight="bold" />
                                        </button>
                                    </div>
                                ))
                            }

                            {/* 3. New Field Creator */}
                            <div className="pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setIsCreatingField(true)}
                                    className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                                >
                                    <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center group-hover:bg-indigo-50 group-hover:border-indigo-200 transition-colors">
                                        <Plus size={14} weight="bold" />
                                    </div>
                                    <span>הוסף שדה מותאם חדש</span>
                                </button>

                                <GenericModal
                                    isOpen={isCreatingField}
                                    onClose={() => setIsCreatingField(false)}
                                    title="הגדרת שדה חדש"
                                    size="sm"
                                    footer={
                                        <div className="flex gap-3 w-full">
                                            <Button
                                                variant="primary"
                                                onClick={handleCreateField}
                                                disabled={!creatingFieldData.label}
                                                className="flex-1"
                                            >
                                                שמור שדה
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                onClick={() => setIsCreatingField(false)}
                                                className="flex-1"
                                            >
                                                ביטול
                                            </Button>
                                        </div>
                                    }
                                >
                                    <div className="space-y-4 py-2">
                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700">שם השדה</label>
                                            <Input
                                                placeholder="לדוגמה: מידת נעליים"
                                                value={creatingFieldData.label}
                                                onChange={e => setCreatingFieldData({ ...creatingFieldData, label: e.target.value })}
                                                autoFocus
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-sm font-bold text-slate-700">סוג שדה</label>
                                            <Select
                                                value={creatingFieldData.type}
                                                onChange={val => setCreatingFieldData({ ...creatingFieldData, type: val })}
                                                options={[
                                                    { value: 'text', label: 'טקסט חופשי' },
                                                    { value: 'number', label: 'מספר' },
                                                    { value: 'phone', label: 'טלפון' },
                                                    { value: 'email', label: 'אימייל' },
                                                    { value: 'date', label: 'תאריך' },
                                                    { value: 'boolean', label: 'כן/לא' },
                                                    { value: 'select', label: 'רשימת בחירה' },
                                                    { value: 'multiselect', label: 'בחירה מרובה' },
                                                    { value: 'textarea', label: 'טקסט ארוך' }
                                                ]}
                                                className="w-full"
                                            />
                                        </div>

                                        {(creatingFieldData.type === 'select' || creatingFieldData.type === 'multiselect') && (
                                            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                                                <label className="text-sm font-bold text-slate-700">אפשרויות בחירה</label>
                                                <Input
                                                    placeholder="הפרד בפסיק (דוגמה: S,M,L,XL)"
                                                    value={creatingFieldData.optionsString}
                                                    onChange={e => setCreatingFieldData({ ...creatingFieldData, optionsString: e.target.value })}
                                                />
                                                <p className="text-[11px] text-slate-400">הזן את הערכים האפשריים מופרדים בפסיקים</p>
                                            </div>
                                        )}
                                    </div>
                                </GenericModal>
                            </div>
                        </div>
                    </div>
                    <div className="h-6" />
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">מידע כללי</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden p-1">
                        <Input
                            placeholder={`שם ${activeTab === 'teams' ? 'הצוות' : 'התפקיד'}`}
                            value={newItemName}
                            onChange={e => setNewItemName(e.target.value)}
                            className="bg-transparent border-none shadow-none h-14 font-black text-lg"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">בחירת צבע</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5">
                        <div className="flex flex-wrap gap-4 justify-center">
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
                                    className={`w-10 h-10 rounded-2xl ${color.bg} transition-all hover:scale-110 flex items-center justify-center active:scale-90 ${newItemColor === color.value ? 'ring-4 ring-offset-2 ring-indigo-500/20 shadow-lg scale-110' : 'opacity-80'}`}
                                >
                                    {newItemColor === color.value && <Check size={20} className="text-white" weight="bold" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {activeTab === 'roles' && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">בחירת אייקון</h3>
                        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5">
                            <div className="grid grid-cols-5 gap-4">
                                {Object.entries(ROLE_ICONS).map(([key, Icon]) => (
                                    <button
                                        key={key}
                                        onClick={() => setNewItemIcon(key)}
                                        className={`h-12 rounded-2xl flex items-center justify-center transition-all active:scale-90 ${newItemIcon === key
                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110'
                                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                            }`}
                                    >
                                        <Icon size={24} strokeWidth={2.5} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <div className="h-4" />
            </div>
        );
    };

    const renderCustomFilterInput = () => {
        if (filterCustomField === 'all') return null;
        const field = customFieldsSchema.find(f => f.key === filterCustomField);
        if (!field) return null;

        // 1. Boolean
        if (field.type === 'boolean') {
            return (
                <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ערך לסינון</label>
                    <Select
                        value={typeof filterCustomValue === 'string' ? filterCustomValue : ''}
                        onChange={(val) => setFilterCustomValue(val)}
                        options={[
                            { value: '', label: 'הכל' },
                            { value: 'true', label: 'כן' },
                            { value: 'false', label: 'לא' }
                        ]}
                        placeholder="בחר..."
                        className="bg-slate-50 md:bg-white border-transparent md:border-slate-200 rounded-xl h-12 md:h-11 font-bold"
                    />
                </div>
            );
        }

        // 2. Select / MultiSelect
        if (field.type === 'select' || field.type === 'multiselect') {
            const currentValues = Array.isArray(filterCustomValue) ? filterCustomValue : [];

            return (
                <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ערכים שנבחרו (ניתן לבחור כמה)</label>
                    <div className="flex flex-wrap gap-2 mb-2 min-h-[30px] bg-slate-50/50 p-2 rounded-xl">
                        {currentValues.length === 0 && <span className="text-xs text-slate-400 italic">כל הערכים...</span>}
                        {currentValues.map(val => (
                            <span key={val} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100 animate-in zoom-in duration-200">
                                {val}
                                <button
                                    onClick={() => setFilterCustomValue(currentValues.filter(v => v !== val))}
                                    className="hover:text-red-500"
                                >
                                    <X size={12} weight="bold" />
                                </button>
                            </span>
                        ))}
                    </div>
                    <select
                        className="w-full bg-slate-50 md:bg-white border border-transparent md:border-slate-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 h-12 md:h-11"
                        onChange={(e) => {
                            if (!e.target.value) return;
                            if (!currentValues.includes(e.target.value)) {
                                setFilterCustomValue([...currentValues, e.target.value]);
                            }
                            e.target.value = '';
                        }}
                    >
                        <option value="">הוסף ערך לסינון...</option>
                        {(field.options || []).filter(opt => !currentValues.includes(opt)).map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>
            );
        }

        // 3. Text / Default
        return (
            <div className="space-y-1.5 animate-in fade-in zoom-in duration-200">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">ערך לסינון</label>
                <input
                    value={typeof filterCustomValue === 'string' ? filterCustomValue : ''}
                    onChange={(e) => setFilterCustomValue(e.target.value)}
                    placeholder="הקלד לסינון..."
                    className="block w-full h-12 md:h-11 px-4 bg-slate-50 md:bg-white border-transparent md:border-slate-200 rounded-xl text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300"
                />
            </div>
        );
    };

    const isPeopleFiltered = Boolean(
        searchTerm ||
        filterTeamId !== 'all' ||
        filterRoleId !== 'all' ||
        filterCustomField !== 'all'
    );

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-visible">
            <ActionBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                isSearchExpanded={isSearchExpanded}
                onSearchExpandedChange={setIsSearchExpanded}
                onExport={canEdit ? handleExport : undefined}
                variant="unified"
                className="px-3 md:px-6 sticky top-0 bg-white z-30 shadow-sm rounded-t-[2rem]"
                leftActions={
                    <div className="flex items-center gap-2 md:gap-3 shrink-0">
                        <div className="hidden 2xl:flex w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl items-center justify-center shrink-0">
                            <Users size={22} weight="bold" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight truncate">ניהול כוח אדם</h2>
                            <span className="hidden xl:block text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">ניהול יחידתי וסד״כ</span>
                        </div>
                        <div className="hidden xl:block">
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
                    </div>
                }
                centerActions={
                    <div className="bg-slate-100/80 p-0.5 rounded-xl flex items-center gap-0.5">
                        {[
                            { id: 'people', label: 'חיילים', icon: User },
                            { id: 'teams', label: 'צוותים', icon: Users },
                            { id: 'roles', label: 'תפקידים', icon: Shield }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as Tab)}
                                className={`px-3 lg:px-5 py-2 rounded-lg text-[11px] md:text-xs font-black transition-all duration-300 flex items-center gap-2 ${activeTab === tab.id
                                    ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                                    : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                title={tab.label}
                            >
                                <tab.icon size={16} weight="bold" />
                                <span className={(isSearchExpanded || selectedItemIds.size > 0) ? 'hidden' : 'inline'}>{tab.label}</span>
                            </button>
                        ))}
                    </div>
                }
                filters={activeTab === 'people' ? [
                    {
                        id: 'team',
                        value: filterTeamId,
                        onChange: setFilterTeamId,
                        options: [{ value: 'all', label: 'כל הצוותים' }, ...sortedTeamsAsc.map(t => ({ value: t.id, label: t.name }))],
                        placeholder: 'סינון לפי צוות',
                        icon: Users
                    },
                    {
                        id: 'role',
                        value: filterRoleId,
                        onChange: setFilterRoleId,
                        options: [{ value: 'all', label: 'כל התפקידים' }, ...sortedRolesAsc.map(r => ({ value: r.id, label: r.name }))],
                        placeholder: 'סינון לפי תפקיד',
                        icon: Shield
                    },
                    {
                        id: 'customField',
                        value: filterCustomField,
                        onChange: (val) => { setFilterCustomField(val); setFilterCustomValue(''); },
                        options: [{ value: 'all', label: 'שדה מותאם' }, ...customFieldsSchema.map(f => ({ value: f.key, label: f.label }))],
                        placeholder: 'סנן לפי שדה',
                        icon: Tag
                    }
                ] : []}
                rightActions={
                    <>
                        {/* View Mode Toggle - Desktop */}
                        {activeTab === 'people' && (
                            <>
                                <div className="hidden md:flex bg-slate-100 p-0.5 rounded-lg">
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        title="תצוגת כרטיסים"
                                    >
                                        <GridIcon size={16} weight={viewMode === 'grid' ? 'bold' : 'regular'} />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('table')}
                                        className={`w-8 h-8 flex items-center justify-center rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        title="תצוגת טבלה"
                                    >
                                        <TableIcon size={16} weight={viewMode === 'table' ? 'bold' : 'regular'} />
                                    </button>
                                </div>
                                <div className="w-px h-5 bg-slate-200 mx-1" />
                            </>
                        )}

                        {/* Sort Button */}
                        {selectedItemIds.size === 0 && (
                            <button
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                className="hidden md:flex h-9 w-9 rounded-xl text-slate-500 items-center justify-center transition-all hover:bg-slate-100"
                                title={sortOrder === 'asc' ? 'מיין בסדר יורד' : 'מיין בסדר עולה'}
                            >
                                {sortOrder === 'asc' ? <SortAscending size={20} /> : <SortDescending size={20} />}
                            </button>
                        )}

                        {/* Manage Fields Button */}
                        {selectedItemIds.size === 0 && canEdit && (
                            <button
                                onClick={() => setIsManageFieldsOpen(true)}
                                className="hidden md:flex h-9 w-9 rounded-xl text-slate-500 items-center justify-center transition-all hover:bg-slate-100"
                                title="ניהול שדות מותאמים"
                            >
                                <GearSix size={20} weight="bold" />
                            </button>
                        )}

                        {/* Show Inactive Toggle */}
                        {selectedItemIds.size === 0 && canEdit && (
                            <button
                                onClick={() => setShowInactive(!showInactive)}
                                className={`hidden md:flex h-9 w-9 items-center justify-center rounded-xl transition-all ${showInactive ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}
                                title={showInactive ? 'הסתר לא פעילים' : 'הצג לא פעילים'}
                            >
                                {showInactive ? <Eye size={20} weight="bold" /> : <EyeSlash size={20} weight="bold" />}
                            </button>
                        )}

                        {/* Import Button */}
                        {selectedItemIds.size === 0 && canEdit && activeTab === 'people' && (
                            <button
                                onClick={() => setIsImportWizardOpen(true)}
                                className="hidden md:flex h-9 w-9 text-emerald-600 rounded-xl items-center justify-center hover:bg-emerald-50 transition-colors"
                                title="ייבוא מאקסל"
                            >
                                <CloudArrowUp size={20} weight="bold" />
                            </button>
                        )}

                        {/* Custom Filter Value Input (Desktop only) */}
                        {filterCustomField !== 'all' && (
                            <>
                                <div className="w-px h-5 bg-slate-200 mx-1" />
                                <div className="hidden md:flex items-center gap-2 bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 ml-1">
                                    {renderCustomFilterInput()}
                                    <button
                                        onClick={() => { setFilterCustomField('all'); setFilterCustomValue(''); }}
                                        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                                    >
                                        <X size={14} weight="bold" />
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Select All - Desktop Style */}
                        {canEdit && selectedItemIds.size > 0 && (activeTab === 'people' ? filteredPeople.length > 0 : activeTab === 'teams' ? displayTeamsList.length > 0 : displayRolesList.length > 0) && (
                            <>
                                <div className="w-px h-5 bg-slate-200 mx-1" />
                                <button
                                    onClick={handleSelectAll}
                                    className={`hidden md:flex h-9 px-4 rounded-xl items-center gap-2 font-black text-xs transition-all animate-in fade-in zoom-in duration-200 ${(() => {
                                        const items = activeTab === 'people' ? filteredPeople : activeTab === 'teams' ? displayTeamsList : displayRolesList;
                                        const allSelected = items.length > 0 && items.every(i => selectedItemIds.has(i.id));
                                        return allSelected
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-600 hover:bg-slate-50';
                                    })()
                                        }`}
                                    title="בחר הכל"
                                >
                                    <Check size={16} weight="bold" />
                                    <span>
                                        {(() => {
                                            const items = activeTab === 'people' ? filteredPeople : activeTab === 'teams' ? displayTeamsList : displayRolesList;
                                            const allSelected = items.length > 0 && items.every(i => selectedItemIds.has(i.id));
                                            return allSelected ? 'בטל בחירה' : 'בחר הכל';
                                        })()}
                                    </span>
                                </button>
                            </>
                        )}

                        {/* Bulk Delete - Desktop Style */}
                        {canEdit && selectedItemIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="hidden md:flex h-9 px-4 rounded-xl text-red-600 items-center gap-2 font-black text-xs hover:bg-red-50 transition-all animate-in fade-in zoom-in duration-200"
                            >
                                <Trash size={16} />
                                <span>מחק ({selectedItemIds.size})</span>
                            </button>
                        )}
                    </>
                }
                mobileMoreActions={
                    <div className="space-y-2">
                        {/* Sort Button - Mobile List Item Style (inside ActionBar modal) */}
                        <div className="md:hidden w-full">
                            <ActionListItem
                                icon={sortOrder === 'asc' ? SortAscending : SortDescending}
                                label="מיון רשימה"
                                description={sortOrder === 'asc' ? 'לפי שם (א-ת)' : 'לפי שם (ת-א)'}
                                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                                color="bg-blue-50 text-blue-600"
                            />
                        </div>

                        {activeTab === 'people' && canEdit && (
                            <ActionListItem
                                icon={CloudArrowUp}
                                label="ייבוא מאקסל"
                                description="הוספת כמות גדולה של אנשים בבת אחת"
                                onClick={() => setIsImportWizardOpen(true)}
                                color="bg-emerald-50 text-emerald-600"
                            />
                        )}

                        {
                            canEdit && (
                                <ActionListItem
                                    icon={showInactive ? Eye : EyeSlash}
                                    label="הצג לא פעילים"
                                    description="הצגת אנשים שהוגדרו כלא פעילים ביחידה"
                                    color="bg-slate-50 text-slate-500"
                                    extra={
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setShowInactive(!showInactive); }}
                                            className={`w-12 h-6 rounded-full transition-all relative cursor-pointer ${showInactive ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${showInactive ? 'right-1' : 'right-7'}`} />
                                        </div>
                                    }
                                />
                            )
                        }
                    </div>
                }
            />

            {/* Custom Content area (Personnel Table, Teams, Roles) */}
            <div className="flex-1 p-1 md:px-6 md:pb-6 md:pt-0 pt-0">
                <div className="relative">
                    {/* Only the Import Wizard remains here, opened by the ActionBar menu */}

                    {/* Content Lists */}
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {activeTab === 'people' && (
                            <div className="col-span-full space-y-6">
                                {viewMode === 'table' && (
                                    <div className="h-full">
                                        <PersonnelTableView
                                            people={filteredPeople}
                                            teams={teams}
                                            roles={roles}
                                            customFieldsSchema={customFieldsSchema}
                                            onUpdatePerson={onUpdatePerson}
                                            searchTerm={searchTerm}
                                            selectedItemIds={selectedItemIds}
                                            toggleSelection={toggleSelection}
                                            canEdit={canEdit}
                                            onEditPerson={handleEditPersonClick}
                                        />
                                    </div>
                                )}

                                {viewMode === 'grid' && (
                                    <div className="space-y-6">
                                        {/* (Existing grid content follows below...) */}


                                        {(() => {
                                            // 2. Sort Helper
                                            const sortList = (list: Person[]) => {
                                                const sorted = [...list];
                                                if (sortOrder === 'asc') return sorted.sort((a, b) => a.name.localeCompare(b.name, 'he'));
                                                return sorted.sort((a, b) => b.name.localeCompare(a.name, 'he'));
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

                                                const isDeleting = deletingPeopleIds.has(person.id) || manualDeletingPeopleIds.has(person.id);

                                                return (
                                                    <div
                                                        key={person.id}
                                                        className={`flex items-center gap-3 md:gap-4 py-3 px-4 md:py-4 md:px-5 bg-white md:bg-white md:border-b md:border-slate-100 select-none relative group active:bg-slate-50/80 md:active:bg-slate-50 transition-all ${isSelected ? 'bg-indigo-50/50' : ''} ${isDeleting ? 'tactical-delete-animation' : ''}`}
                                                        onTouchStart={(e) => canEdit && handleTouchStart(e, person)}
                                                        onTouchEnd={handleTouchEnd}
                                                        onContextMenu={handleContextMenu}
                                                        onClick={(e) => {
                                                            if (e.detail > 1) return;
                                                            if (selectedItemIds.size > 0 || isSelected) {
                                                                toggleSelection(person.id);
                                                            } else if (canEdit) {
                                                                handleEditPersonClick(person);
                                                            }
                                                        }}
                                                    >
                                                        {/* Status Accent (Mobile Only) */}
                                                        <div className={`absolute top-2 bottom-2 right-0 w-1 rounded-l-full transition-all ${person.isActive !== false ? 'bg-indigo-500' : 'bg-slate-300'} md:hidden`} />

                                                        {/* Checkbox */}
                                                        {canEdit && (
                                                            <div onClick={(e) => { e.stopPropagation(); toggleSelection(person.id); }} className="shrink-0 cursor-pointer -mr-1">
                                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                                                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Avatar Group */}
                                                        <div className="relative shrink-0">
                                                            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-white font-black text-xs transition-transform group-active:scale-95 ${colorClass}`}>
                                                                {getPersonInitials(person.name)}
                                                            </div>
                                                        </div>

                                                        {/* Content Area */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <h4 className={`font-black text-slate-900 text-base md:text-base tracking-tight truncate ${!person.isActive ? 'text-slate-400 opacity-60' : ''}`}>
                                                                    {person.name}
                                                                </h4>
                                                                {!person.isActive && (
                                                                    <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-black rounded-lg uppercase tracking-widest">
                                                                        לא פעיל
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Labels / Metadata */}
                                                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {(person.roleIds || []).length > 0 ? (
                                                                        (person.roleIds || []).map(rid => {
                                                                            const r = roles.find(rl => rl.id === rid);
                                                                            if (!r) return null;
                                                                            const roleColor = r.color ? r.color.replace('border-', 'bg-').replace('-500', '-50').replace('-600', '-50') : 'bg-slate-50';
                                                                            const roleText = r.color ? r.color.replace('border-', 'text-') : 'text-slate-600';

                                                                            return (
                                                                                <span key={r.id} className={`text-[10px] md:text-[11px] px-1.5 py-0.5 rounded-lg font-bold uppercase tracking-tight ${roleColor} ${roleText}`}>
                                                                                    {r.name}
                                                                                </span>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg">ללא תפקיד</span>
                                                                    )}
                                                                </div>
                                                                {person.phone && (
                                                                    <a
                                                                        href={getWhatsAppLink(person.phone)}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded-lg border border-green-100 hover:bg-green-100 hover:scale-105 transition-all text-[11px] font-bold tracking-tight group/whatsapp"
                                                                        title="פתח ב-WhatsApp"
                                                                    >
                                                                        <WhatsappLogo size={12} weight="fill" className="text-green-600 group-hover/whatsapp:scale-110 transition-transform" />
                                                                        {formatPhoneNumber(person.phone)}
                                                                    </a>
                                                                )}

                                                                {/* Schema Custom Fields */}
                                                                {(customFieldsSchema || []).map(field => {
                                                                    let val = person.customFields?.[field.key];
                                                                    if (val === undefined || val === null || val === '') return null;

                                                                    if (field.type === 'boolean') val = val ? 'כן' : 'לא';
                                                                    if (Array.isArray(val)) val = val.join(', ');

                                                                    return (
                                                                        <div key={field.key} className="flex items-center gap-1 text-[10px] bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 max-w-[150px]">
                                                                            <span className="text-slate-400 font-medium">{field.label}:</span>
                                                                            <span className="font-bold text-slate-600 truncate">{val.toString()}</span>
                                                                        </div>
                                                                    );
                                                                })}

                                                                {/* Orphaned Custom Fields */}
                                                                {Object.entries(person.customFields || {}).map(([key, val]) => {
                                                                    if (customFieldsSchema.some(f => f.key === key)) return null;
                                                                    if (!val) return null;
                                                                    return (
                                                                        <div key={key} className="flex items-center gap-1 text-[10px] bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100 max-w-[150px]">
                                                                            <span className="text-amber-400 font-medium">{key}:</span>
                                                                            <span className="font-bold text-amber-700 truncate">{val.toString()}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>

                                                        {/* Interaction Indicator (Chevron if not selected) */}
                                                        <div className="shrink-0 flex items-center justify-center text-slate-300 md:hidden">
                                                            <CaretLeftIcon size={18} weight="bold" />
                                                        </div>
                                                    </div>
                                                );
                                            };

                                            // 4. Empty State
                                            if (filteredPeople.length === 0) {
                                                return (
                                                    <EmptyStateCard
                                                        title={isPeopleFiltered ? 'לא נמצאו חיילים' : 'רשימת החיילים ריקה'}
                                                        description={isPeopleFiltered ? 'נסה לשנות את מונחי החיפוש או הסינון' : 'לחץ על כפתור ה-+ להוספת חייל ראשון'}
                                                        icon={<User size={26} weight="bold" />}
                                                        canEdit={canEdit}
                                                        noAccessText="אין לך הרשאות יצירה"
                                                        className="mx-4"
                                                    />
                                                );
                                            }

                                            // MODE: TEAMS
                                            if (viewGroupBy === 'teams') {
                                                let items = [...teams, { id: 'no-team', name: 'ללא צוות', color: 'bg-slate-300' } as any];
                                                if (sortOrder === 'desc') items.sort((a, b) => b.name.localeCompare(a.name, 'he'));
                                                else items.sort((a, b) => a.name.localeCompare(b.name, 'he'));

                                                return items.map(group => {
                                                    let members = filteredPeople.filter(p => group.id === 'no-team' ? !p.teamId : p.teamId === group.id);
                                                    members = sortList(members);
                                                    if (members.length === 0) return null;

                                                    const isCollapsed = collapsedTeams.has(group.id);

                                                    return (
                                                        <div key={group.id} className="bg-white">
                                                            <div className="sticky top-[112px] md:top-[72px] z-20 bg-slate-50/95 backdrop-blur-xl border-y border-slate-100/60 px-5 py-2.5 flex items-center justify-between cursor-pointer shadow-sm" onClick={() => toggleTeamCollapse(group.id)}>
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
                                                                    <h3 className="font-black text-slate-800 text-sm tracking-tight">{group.name}</h3>
                                                                    <span className="bg-white text-slate-500 text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 font-bold shadow-sm">{members.length}</span>
                                                                </div>
                                                                <button className="text-slate-400 p-1 hover:bg-slate-200/50 rounded-lg transition-colors">
                                                                    {isCollapsed ? <ChevronLeft size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                                                                </button>
                                                            </div>
                                                            {!isCollapsed && (
                                                                <div className="divide-y divide-slate-50">
                                                                    <AnimatePresence initial={false}>
                                                                        {members.map(p => renderPerson(p))}
                                                                    </AnimatePresence>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            }

                                            // MODE: ROLES
                                            if (viewGroupBy === 'roles') {
                                                let items = [...roles];
                                                if (sortOrder === 'desc') items.sort((a, b) => b.name.localeCompare(a.name, 'he'));
                                                else items.sort((a, b) => a.name.localeCompare(b.name, 'he'));

                                                return items.map(role => {
                                                    let members = filteredPeople.filter(p => (p.roleIds || []).includes(role.id));
                                                    members = sortList(members);
                                                    if (members.length === 0) return null;

                                                    const isCollapsed = collapsedTeams.has(role.id);

                                                    return (
                                                        <div key={role.id} className="bg-white">
                                                            <div className="sticky top-[112px] md:top-[72px] z-20 bg-slate-50/95 backdrop-blur-md border-y border-slate-100/60 px-5 py-2.5 flex items-center justify-between cursor-pointer shadow-sm" onClick={() => toggleTeamCollapse(role.id)}>
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-black text-slate-800 text-sm tracking-tight">{role.name}</h3>
                                                                    <span className="bg-white text-slate-500 text-[10px] px-2 py-0.5 rounded-lg border border-slate-200 font-bold shadow-sm">{members.length}</span>
                                                                </div>
                                                                <button className="text-slate-400 p-1 hover:bg-slate-200/50 rounded-lg transition-colors">
                                                                    {isCollapsed ? <ChevronLeft size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
                                                                </button>
                                                            </div>
                                                            {!isCollapsed && (
                                                                <div className="divide-y divide-slate-50">
                                                                    <AnimatePresence initial={false}>
                                                                        {members.map(p => renderPerson(p))}
                                                                    </AnimatePresence>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                });
                                            }

                                            // MODE: LIST
                                            const sorted = sortList([...filteredPeople]);
                                            return (
                                                <div className="flex flex-col">
                                                    <AnimatePresence initial={false}>
                                                        {sorted.map(renderPerson)}
                                                    </AnimatePresence>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'teams' && (
                            displayTeamsList.length === 0 ? (
                                <EmptyStateCard
                                    title={searchTerm ? 'לא נמצאו צוותים' : 'לא הוגדרו צוותים'}
                                    description={searchTerm ? 'נסה לשנות את מונחי החיפוש' : 'לחץ על כפתור ה-+ להוספת צוות ראשון'}
                                    icon={<Users size={26} weight="bold" />}
                                    canEdit={canEdit}
                                    noAccessText="אין לך הרשאות יצירה"
                                />
                            ) : displayTeamsList.map(team => {
                                const isSelected = selectedItemIds.has(team.id);
                                const isDeleting = deletingTeamIds.has(team.id) || manualDeletingTeamIds.has(team.id);
                                const memberCount = people.filter(p => p.teamId === team.id).length;
                                return (
                                    <div
                                        key={team.id}
                                        className={`flex items-center gap-3 md:gap-4 py-3 px-4 md:py-4 md:px-5 bg-white md:bg-white md:border-b md:border-slate-100 transition-all select-none relative group active:bg-slate-50/80 md:active:bg-slate-50 ${isSelected ? 'bg-indigo-50/50 scale-[0.99] md:scale-100' : ''} ${isDeleting ? 'tactical-delete-animation' : ''}`}
                                        onClick={(e) => {
                                            if (e.detail > 1) return;
                                            if (selectedItemIds.size > 0 || isSelected) toggleSelection(team.id);
                                            else if (canEdit) handleEditTeamClick(team);
                                        }}
                                    >
                                        {/* Checkbox */}
                                        {canEdit && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); toggleSelection(team.id); }}
                                                className="shrink-0 cursor-pointer -mr-1"
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                aria-label={`בחר את הצוות ${team.name}`}
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSelection(team.id); } }}
                                            >
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600 shadow-sm' : 'border-slate-200 bg-white'}`}>
                                                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                </div>
                                            </div>
                                        )}

                                        {/* Avatar/Icon */}
                                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 transition-transform group-active:scale-95 ${getThemeColors(team.color).bg}`}>
                                            <Users size={18} className={getThemeColors(team.color).text} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-slate-900 text-base md:text-base tracking-tight truncate">{team.name}</h4>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold uppercase tracking-tight">
                                                    {memberCount} חיילים
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions or Chevron */}
                                        <div className="shrink-0 flex items-center gap-2">
                                            {canEdit && (
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    requestConfirm(
                                                        'מחיקת צוות',
                                                        `האם אתה בטוח שברצונך למחוק את הצוות "${team.name}"?`,
                                                        () => handleTacticalDeleteTeam(team.id)
                                                    );
                                                }}
                                                    className="p-2 text-slate-300 hover:text-red-500 rounded-full transition-colors hidden md:block"
                                                    aria-label={`מחק את הצוות ${team.name}`}
                                                >
                                                    <Trash size={18} weight="bold" />
                                                </button>
                                            )}
                                            <div className="text-slate-300 md:hidden">
                                                <ChevronLeft size={18} strokeWidth={2.5} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}

                        {activeTab === 'roles' && (
                            displayRolesList.length === 0 ? (
                                <EmptyStateCard
                                    title={searchTerm ? 'לא נמצאו תפקידים' : 'לא הוגדרו תפקידים'}
                                    description={searchTerm ? 'נסה לשנות את מונחי החיפוש' : 'לחץ על כפתור ה-+ להוספת תפקיד ראשון'}
                                    icon={<Shield size={26} weight="bold" />}
                                    canEdit={canEdit}
                                    noAccessText="אין לך הרשאות יצירה"
                                />
                            ) : displayRolesList.map(role => {
                                const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                                const isSelected = selectedItemIds.has(role.id);
                                const isDeleting = deletingRoleIds.has(role.id) || manualDeletingRoleIds.has(role.id);
                                const assignedCount = people.filter(p => (p.roleIds || []).includes(role.id)).length;
                                return (
                                    <div
                                        key={role.id}
                                        className={`flex items-center gap-4 py-4 px-5 bg-white md:bg-white md:border-b md:border-slate-100 transition-all select-none relative group active:bg-slate-50/80 md:active:bg-slate-50 ${isSelected ? 'bg-indigo-50/50 scale-[0.99] md:scale-100' : ''} ${isDeleting ? 'tactical-delete-animation' : ''}`}
                                        onClick={(e) => {
                                            if (e.detail > 1) return;
                                            if (selectedItemIds.size > 0 || isSelected) toggleSelection(role.id);
                                            else if (canEdit) handleEditRoleClick(role);
                                        }}
                                    >
                                        {/* Checkbox */}
                                        {canEdit && (
                                            <div
                                                onClick={(e) => { e.stopPropagation(); toggleSelection(role.id); }}
                                                className="shrink-0 cursor-pointer -mr-1"
                                                role="checkbox"
                                                aria-checked={isSelected}
                                                aria-label={`בחר את התפקיד ${role.name}`}
                                                tabIndex={0}
                                                onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSelection(role.id); } }}
                                            >
                                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white'}`}>
                                                    {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                                                </div>
                                            </div>
                                        )}

                                        {/* Avatar/Icon */}
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 transition-transform group-active:scale-95 ${getThemeColors(role.color).bg}`}>
                                            <Icon size={22} strokeWidth={2.5} className={getThemeColors(role.color).text} />
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-black text-slate-900 text-lg md:text-base tracking-tight truncate">{role.name}</h4>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-bold uppercase tracking-tight">
                                                    {assignedCount} חיילים
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions or Chevron */}
                                        <div className="shrink-0 flex items-center gap-2">
                                            {canEdit && (
                                                <button onClick={(e) => {
                                                    e.stopPropagation();
                                                    requestConfirm(
                                                        'מחיקת תפקיד',
                                                        `האם אתה בטוח שברצונך למחוק את התפקיד "${role.name}"?`,
                                                        () => handleTacticalDeleteRole(role.id)
                                                    );
                                                }}
                                                    className="p-2 text-slate-300 hover:text-red-500 rounded-full transition-colors hidden md:block"
                                                    aria-label={`מחק את התפקיד ${role.name}`}
                                                >
                                                    <Trash size={18} weight="bold" />
                                                </button>
                                            )}
                                            <div className="text-slate-300 md:hidden">
                                                <ChevronLeft size={18} strokeWidth={2.5} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* FAB or Selection Bar - Premium Mobile */}
                    {
                        canEdit && !isModalOpen && (
                            selectedItemIds.size > 0 ? (
                                <div className="md:hidden fixed bottom-28 inset-x-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
                                    <div className="bg-slate-900 rounded-[2rem] p-4 shadow-2xl shadow-slate-900/40 flex items-center justify-between border border-white/10">
                                        <div className="flex items-center gap-3 mr-2">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-black">
                                                {selectedItemIds.size}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-white font-black text-sm">נבחרו פריטים</span>
                                                <span className="text-slate-400 text-[10px] uppercase font-bold">פעולות קבוצתיות</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleSelectAll}
                                                className={`h-11 px-4 rounded-xl font-black text-xs active:scale-95 transition-all flex items-center gap-2 ${(() => {
                                                    const items = activeTab === 'people' ? filteredPeople : activeTab === 'teams' ? displayTeamsList : displayRolesList;
                                                    const allSelected = items.length > 0 && items.every(i => selectedItemIds.has(i.id));
                                                    return allSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700';
                                                })()
                                                    }`}
                                            >
                                                <Check size={16} weight="bold" />
                                                <span>
                                                    {(() => {
                                                        const items = activeTab === 'people' ? filteredPeople : activeTab === 'teams' ? displayTeamsList : displayRolesList;
                                                        const allSelected = items.length > 0 && items.every(i => selectedItemIds.has(i.id));
                                                        return allSelected ? 'בטל הכל' : 'בחר הכל';
                                                    })()}
                                                </span>
                                            </button>
                                            <button
                                                onClick={() => setSelectedItemIds(new Set())}
                                                className="h-11 px-4 rounded-xl bg-slate-800 text-slate-300 font-black text-xs hover:bg-slate-700 active:scale-95 transition-all"
                                            >
                                                ביטול
                                            </button>
                                            <button
                                                onClick={handleBulkDelete}
                                                className="h-11 px-5 rounded-xl bg-red-500 text-white font-black text-xs shadow-lg shadow-red-500/20 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <Trash size={16} weight="bold" />
                                                מחק
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <FloatingActionButton
                                    icon={Plus}
                                    onClick={() => {
                                        if (activeTab === 'people' && teams.length === 0) {
                                            showToast('יש להגדיר צוותים לפני הוספת חיילים', 'error');
                                            setActiveTab('teams');
                                            return;
                                        }
                                        setIsAdding(true); setEditingTeamId(null); setEditingPersonId(null); setEditingRoleId(null); setNewItemName(''); setNewName(''); setNewName(''); setNewEmail('');
                                    }}
                                    ariaLabel={`הוסף ${activeTab === 'people' ? 'חייל' : activeTab === 'teams' ? 'צוות' : 'תפקיד'}`}
                                    show={true}
                                />
                            )
                        )
                    }

                    {/* Context Menu Portal (Could be a simple absolute div if precise positioning needed, or a fixed overlay) */}
                    {
                        contextMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[1px]"
                                    onClick={() => setContextMenu(null)}
                                    aria-label="סגור תפריט"
                                    role="button"
                                />
                                <div
                                    className="fixed z-50 bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/20 w-64 overflow-hidden animate-in zoom-in-95 duration-200 shadow-slate-900/10 p-2"
                                    style={{ top: contextMenu.y, left: Math.max(10, Math.min(window.innerWidth - 266, contextMenu.x - 240)) }}
                                    role="menu"
                                    aria-label={`אפשרויות עבור ${contextMenu.person.name}`}
                                >
                                    <div className="px-4 py-3 mb-1">
                                        <span className="font-black text-slate-900 text-sm tracking-tight block">{contextMenu.person.name}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{teams.find(t => t.id === contextMenu.person.teamId)?.name || 'ללא צוות'}</span>
                                    </div>

                                    <div className="h-px bg-slate-100/50 mx-2 mb-1" />

                                    <button onClick={() => { handleEditPersonClick(contextMenu.person); setContextMenu(null); }} className="w-full text-right px-4 py-3 hover:bg-slate-50 rounded-xl text-[13px] font-black flex items-center gap-3 text-slate-700 transition-colors" role="menuitem">
                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                            <Pencil size={18} strokeWidth={2.5} />
                                        </div>
                                        <span>ערוך פרטים</span>
                                    </button>

                                    <button onClick={() => {
                                        // Toggle status
                                        onUpdatePerson({ ...contextMenu.person, isActive: !contextMenu.person.isActive });
                                        setContextMenu(null);
                                    }} className="w-full text-right px-4 py-3 hover:bg-slate-50 rounded-xl text-[13px] font-black flex items-center gap-3 text-slate-700 transition-colors" role="menuitem">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${contextMenu.person.isActive ? 'bg-slate-50 text-slate-500' : 'bg-green-50 text-green-600'}`}>
                                            {contextMenu.person.isActive ? <X size={18} strokeWidth={2.5} /> : <Check size={18} strokeWidth={2.5} />}
                                        </div>
                                        <span>{contextMenu.person.isActive ? 'סמן כלא פעיל' : 'סמן כפעיל'}</span>
                                    </button>

                                    <div className="h-px bg-slate-100/50 mx-2 my-1" />

                                    <button onClick={() => {
                                        setContextMenu(null);
                                        const person = contextMenu.person;
                                        deletingPeopleSnapshot.current.set(person.id, person);
                                        handleTacticalDeletePerson(person.id);
                                    }} className="w-full text-right px-4 py-3 hover:bg-red-50 rounded-xl text-[13px] font-black flex items-center gap-3 text-red-600 transition-colors" role="menuitem">
                                        <div className="w-8 h-8 rounded-lg bg-red-100/50 text-red-600 flex items-center justify-center">
                                            <Trash size={18} weight="bold" />
                                        </div>
                                        <span>מחק חייל לצמיתות</span>
                                    </button>
                                </div>
                            </>
                        )
                    }

                    {/* Reusable GenericModal for All Forms */}
                    <GenericModal
                        isOpen={isModalOpen}
                        onClose={closeForm}
                        title={getModalTitle()}
                        size="lg"
                        headerActions={(() => {
                            if (activeTab === 'people' && editingPersonId) {
                                return (
                                    <button
                                        onClick={() => {
                                            if (!editingPersonId) return;
                                            setSelectedItemIds(new Set());
                                            closeForm();
                                            handleDeletePersonWithAnimation(editingPersonId);
                                        }}
                                        disabled={isSaving}
                                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        aria-label="מחק חייל"
                                        title="מחק חייל"
                                    >
                                        <Trash size={20} weight="bold" />
                                    </button>
                                );
                            }

                            if (activeTab === 'teams' && editingTeamId) {
                                return (
                                    <button
                                        onClick={() => {
                                            setSelectedItemIds(new Set());
                                            closeForm();
                                            handleTacticalDeleteTeam(editingTeamId);
                                        }}
                                        disabled={isSaving}
                                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        aria-label="מחק צוות"
                                        title="מחק צוות"
                                    >
                                        <Trash size={20} weight="bold" />
                                    </button>
                                );
                            }

                            if (activeTab === 'roles' && editingRoleId) {
                                return (
                                    <button
                                        onClick={() => {
                                            setSelectedItemIds(new Set());
                                            closeForm();
                                            handleTacticalDeleteRole(editingRoleId);
                                        }}
                                        disabled={isSaving}
                                        className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                                        aria-label="מחק תפקיד"
                                        title="מחק תפקיד"
                                    >
                                        <Trash size={20} weight="bold" />
                                    </button>
                                );
                            }

                            return undefined;
                        })()}
                        footer={(
                            <div className="flex w-full items-center gap-4">
                                <Button
                                    variant="outline"
                                    onClick={closeForm}
                                    disabled={isSaving}
                                    className="flex-1"
                                >
                                    ביטול
                                </Button>
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-[2] font-black"
                                >
                                    {isSaving ? 'שומר שינויים...' : 'שמור'}
                                </Button>
                            </div>
                        )}
                    >
                        <div className="py-2">
                            {renderModalContent()}
                        </div>
                    </GenericModal>

                    {/* Duplicate Warning Modal */}
                    <GenericModal
                        isOpen={!!duplicateWarning?.isOpen}
                        onClose={() => setDuplicateWarning(null)}
                        title="התראה: כפילות אפשרית"
                        size="sm"
                        footer={(
                            <div className="flex justify-end gap-3 w-full">
                                <Button
                                    variant="outline"
                                    onClick={() => setDuplicateWarning(null)}
                                    className="border-slate-300 hover:bg-slate-50 flex-1"
                                >
                                    ביטול
                                </Button>
                                <Button
                                    onClick={() => {
                                        setDuplicateWarning(null);
                                        executeSavePerson();
                                    }}
                                    className="bg-amber-500 hover:bg-amber-600 text-white border-transparent flex-1"
                                >
                                    צור כפילות
                                </Button>
                            </div>
                        )}
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
                        </div>
                    </GenericModal>

                    <ExcelImportWizard
                        isOpen={isImportWizardOpen}
                        onClose={() => setIsImportWizardOpen(false)}
                        onImport={handleBulkImport}
                        teams={teams}
                        roles={roles}
                        people={people}
                        customFieldsSchema={customFieldsSchema}
                        onAddTeam={onAddTeam}
                        onAddRole={onAddRole}
                        isSaving={isSaving}
                    />

                    {/* Import Results Modal */}
                    <GenericModal
                        isOpen={!!importResults}
                        onClose={() => setImportResults(null)}
                        title="סיכום ייבוא נתונים"
                        size="lg"
                        footer={(
                            <div className="flex justify-end w-full">
                                <Button onClick={() => setImportResults(null)}>סגור</Button>
                            </div>
                        )}
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
                        </div>
                    </GenericModal>
                    {/* Confirmation Modal */}
                    <ConfirmationModal
                        isOpen={confirmModal.isOpen}
                        title={confirmModal.title}
                        message={confirmModal.message}
                        onConfirm={confirmModal.onConfirm}
                        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                        type={confirmModal.type}
                    />

                    {/* Manage Custom Fields Modal */}
                    <GenericModal
                        isOpen={isManageFieldsOpen}
                        onClose={() => setIsManageFieldsOpen(false)}
                        title="ניהול שדות מותאמים אישית"
                        size="lg"
                    >
                        <CustomFieldsManager
                            fields={customFieldsSchema}
                            onFieldsChange={async (newFields) => {
                                setCustomFieldsSchema(newFields);
                                if (!activeOrgId) return;
                                try {
                                    await supabase
                                        .from('organization_settings')
                                        .update({ custom_fields_schema: newFields })
                                        .eq('organization_id', activeOrgId);
                                    showToast('השדות עודכנו בהצלחה', 'success');
                                } catch (error) {
                                    console.error('Error saving custom schema:', error);
                                    showToast('שגיאה בשמירת השדות', 'error');
                                }
                            }}
                        />
                    </GenericModal>
                </div>
            </div>
            <TacticalDeleteStyles />
        </div >
    );
};