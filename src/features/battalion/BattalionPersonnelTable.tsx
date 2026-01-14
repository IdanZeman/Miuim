import React, { useState, useMemo } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { Person } from '@/types';
import { MagnifyingGlass as Search, DownloadSimple as Download, CircleNotch as Loader2, User, CaretDown, CaretRight, Users, Eye, Plus, PencilSimple as Pencil, Trash, DotsThreeVertical } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import ExcelJS from 'exceljs';
import { ActionBar } from '../../components/ui/ActionBar';
import { PageInfo } from '../../components/ui/PageInfo';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { PersonEditorModal } from '../personnel/PersonEditorModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../services/loggingService';
import { useQueryClient } from '@tanstack/react-query';

// --- Sub-component to avoid code duplication ---
interface PersonRowProps {
    person: Person;
    roles: any[]; // Or stricter type if available
    presence: { status: string; label: string; class: string; details: string | null };
    canEdit: boolean;
    onEdit: (e: React.MouseEvent) => void;
    onDelete: (e: React.MouseEvent) => void;
    onClick: () => void;
    mobileMenuOpen: boolean;
    onMobileMenuToggle: (e: React.MouseEvent) => void;
    onMobileMenuClose: (e: React.MouseEvent) => void;
}

const PersonRow: React.FC<PersonRowProps> = ({
    person,
    roles,
    presence,
    canEdit,
    onEdit,
    onDelete,
    onClick,
    mobileMenuOpen,
    onMobileMenuToggle,
    onMobileMenuClose
}) => {
    // Helper to get role names
    const personRoleNames = roles.filter(r => person.roleIds?.includes(r.id)).map(r => r.name);

    return (
        <div
            className="p-4 pr-12 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer border-b border-slate-50 last:border-0"
            onClick={onClick}
        >
            <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                    <User size={20} />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <p className="font-black text-slate-900 leading-none">{person.name}</p>
                    </div>
                    {personRoleNames.length > 0 && (
                        <p className="hidden md:block text-xs font-bold text-slate-500 mt-1">
                            {personRoleNames.join(', ')}
                        </p>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${presence.class}`}>
                    {presence.label}
                </div>
                {/* Eye icon hidden on mobile */}
                <Eye size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors hidden md:block" />

                {canEdit && (
                    <>
                        {/* Desktop Actions */}
                        <div className="hidden md:flex items-center gap-1">
                            <button
                                onClick={onEdit}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                title="ערוך חייל"
                            >
                                <Pencil size={16} weight="bold" />
                            </button>
                            <button
                                onClick={onDelete}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all"
                                title="מחק חייל"
                            >
                                <Trash size={16} weight="bold" />
                            </button>
                        </div>

                        {/* Mobile Actions Menu */}
                        <div className="md:hidden relative">
                            <button
                                onClick={onMobileMenuToggle}
                                className={`p-1.5 rounded-lg transition-all ${mobileMenuOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                            >
                                <DotsThreeVertical size={20} weight="bold" />
                            </button>

                            {mobileMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40 bg-black/5"
                                        onClick={onMobileMenuClose}
                                    />
                                    <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-slate-100 p-1 min-w-[140px] flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={(e) => {
                                                onEdit(e);
                                                onMobileMenuClose(e);
                                            }}
                                            className="w-full p-2.5 rounded-lg text-right text-sm font-bold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-3"
                                        >
                                            <Pencil size={16} weight="bold" />
                                            ערוך
                                        </button>
                                        <div className="h-px bg-slate-100 mx-1" />
                                        <button
                                            onClick={(e) => {
                                                onDelete(e);
                                                onMobileMenuClose(e);
                                            }}
                                            className="w-full p-2.5 rounded-lg text-right text-sm font-bold text-red-600 hover:bg-red-50 transition-all flex items-center gap-3"
                                        >
                                            <Trash size={16} weight="bold" />
                                            מחק
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export const BattalionPersonnelTable: React.FC = () => {
    const { organization, checkAccess } = useAuth();
    const { showToast } = useToast();
    const canEdit = checkAccess('personnel', 'edit');
    const queryClient = useQueryClient();

    // Optimized Data Hook - Must be first to avoid reference errors
    const {
        companies = [],
        people = [],
        teams = [],
        roles = [],
        presenceSummary = [],
        isLoading,
        refetch
    } = useBattalionData(organization?.battalion_id) as any;

    // UI State - Initialize after data is available
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

    // -- Management State --
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [personToEdit, setPersonToEdit] = useState<Person | null>(null);
    const [targetOrgId, setTargetOrgId] = useState<string>('');

    const [personToDelete, setPersonToDelete] = useState<Person | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [mobileMenuPersonId, setMobileMenuPersonId] = useState<string | null>(null);

    // Optimize presence lookup using a Map (O(1) instead of O(N))
    const presenceMap = useMemo(() => {
        const map = new Map<string, { status: string; label: string; class: string; details: string | null }>();
        presenceSummary.forEach((entry: any) => {
            let label = '';
            let details = null;
            let statusClass = 'bg-slate-50 text-slate-400';

            switch (entry.status) {
                case 'base':
                    label = 'בבסיס';
                    statusClass = 'bg-emerald-50 text-emerald-600';
                    if (entry.arrival_date) details = `הגיע: ${new Date(entry.arrival_date).toLocaleDateString('he-IL')}`;
                    break;
                case 'home':
                    label = 'בבית';
                    statusClass = 'bg-blue-50 text-blue-600';
                    if (entry.departure_date) details = `יצא: ${new Date(entry.departure_date).toLocaleDateString('he-IL')}`;
                    break;
                case 'sick':
                    label = 'גימלים';
                    statusClass = 'bg-rose-50 text-rose-600';
                    break;
                case 'leave':
                    label = 'חופשה';
                    statusClass = 'bg-indigo-50 text-indigo-600';
                    break;
                default:
                    label = 'לא הוזן';
            }
            map.set(entry.person_id, { status: entry.status, label, class: statusClass, details });
        });
        return map;
    }, [presenceSummary]);

    const getPersonPresence = (personId: string) => {
        return presenceMap.get(personId) || { status: 'none', label: 'לא הוזן', class: 'bg-slate-50 text-slate-400', details: null };
    };

    const getPersonRoles = (person: Person) => {
        return roles.filter((r: any) => person.roleIds?.includes(r.id)).map((r: any) => r.name);
    };

    const toggleCompany = (companyId: string) => {
        const newExpanded = new Set(expandedCompanies);
        if (newExpanded.has(companyId)) {
            newExpanded.delete(companyId);
        } else {
            newExpanded.add(companyId);
        }
        setExpandedCompanies(newExpanded);
    };

    const toggleTeam = (teamId: string) => {
        const newExpanded = new Set(expandedTeams);
        if (newExpanded.has(teamId)) {
            newExpanded.delete(teamId);
        } else {
            newExpanded.add(teamId);
        }
        setExpandedTeams(newExpanded);
    };

    const filteredPeople = useMemo(() => {
        return people.filter((p: any) => {
            const name = p?.name || '';
            const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesActive = showInactive || p?.isActive !== false;
            return matchesSearch && matchesActive;
        });
    }, [people, searchTerm, showInactive]);

    const handleExport = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('סד"כ גדודי', { views: [{ rightToLeft: true }] });

            // Data preparation for table
            const tableRows = filteredPeople.map((p: any) => {
                const org = companies.find((c: any) => c.id === p.organization_id);
                const team = teams.find((t: any) => t.id === p.teamId);
                const personRoles = getPersonRoles(p).join(', ');
                const presence = getPersonPresence(p.id);

                return [
                    p.name,
                    org?.name || '-',
                    team?.name || '-',
                    personRoles || '-',
                    presence.label,
                    presence.details || '-'
                ];
            });

            const columns = [
                { name: 'שם מלא', filterButton: true },
                { name: 'פלוגה', filterButton: true },
                { name: 'צוות', filterButton: true },
                { name: 'תפקידים', filterButton: true },
                { name: 'מצב נוכחות', filterButton: true },
                { name: 'פירוט', filterButton: true }
            ];

            worksheet.addTable({
                name: 'BattalionPersonnel',
                ref: 'A1',
                headerRow: true,
                style: { theme: 'TableStyleMedium2', showRowStripes: true },
                columns: columns,
                rows: tableRows
            });

            // Style Status Cell
            tableRows.forEach((rowData, idx) => {
                const rowIndex = idx + 2;
                const statusCell = worksheet.getCell(`E${rowIndex}`);
                const statusLabel = rowData[4];

                if (statusLabel === 'בבסיס') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                    statusCell.font = { color: { argb: 'FF065F46' }, bold: true };
                } else if (statusLabel === 'בבית') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    statusCell.font = { color: { argb: 'FF991B1B' }, bold: true };
                } else if (statusLabel === 'גימלים') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                    statusCell.font = { color: { argb: 'FFBE123C' }, bold: true };
                } else if (statusLabel === 'חופשה') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                    statusCell.font = { color: { argb: 'FF3730A3' }, bold: true };
                }
            });

            // Column Widths
            worksheet.columns = [
                { width: 25 }, // Name
                { width: 15 }, // Company
                { width: 15 }, // Team
                { width: 30 }, // Roles
                { width: 15 }, // Status
                { width: 35 }  // Details
            ];

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `battalion_personnel_${new Date().toLocaleDateString('en-CA')}.xlsx`;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Export Error:', error);
        }
    };

    const handleDeletePerson = async () => {
        if (!personToDelete || isDeleting) return;

        setIsDeleting(true);
        try {
            const { error } = await supabase
                .from('people')
                .delete()
                .eq('id', personToDelete.id);

            if (error) throw error;

            await logger.logDelete('person', personToDelete.id, personToDelete.name, personToDelete);

            // Close modal immediately
            setPersonToDelete(null);
            showToast('החייל נמחק בהצלחה', 'success');

            // Invalidate queries in background (using hook)
            queryClient.invalidateQueries({ queryKey: ['battalionCompanies'] });
            queryClient.invalidateQueries({ queryKey: ['organizationData'] });
            queryClient.invalidateQueries({ queryKey: ['battalionPresence'] });

            // Also call refetch as backup
            if (refetch) refetch();
        } catch (err: any) {
            console.error('Error deleting person:', err);
            showToast('שגיאה במחיקת חייל', 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditPerson = (p: Person, e: React.MouseEvent) => {
        e.stopPropagation();
        setPersonToEdit(p);
        setTargetOrgId(p.organization_id || '');
        setIsEditorOpen(true);
    };

    const handleAddPerson = (orgId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setPersonToEdit(null);
        setTargetOrgId(orgId);
        setIsEditorOpen(true);
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-slate-500 font-bold">טוען סד"כ גדודי...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ActionBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={handleExport}
                className="p-4"
                leftActions={
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Users className="text-blue-600" size={24} weight="duotone" />
                            סד"כ גדודי
                            <PageInfo
                                title={'סד"כ גדודי'}
                                description={
                                    <>
                                        <p className="mb-2">מבט מרוכז על כלל כוח האדם בגדוד.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>חלוקה:</b> הרשימה מחולקת לפי פלוגות וצוותים.</li>
                                            <li><b>חיפוש:</b> ניתן לחפש חייל לפי שם בכל הרמות.</li>
                                            <li><b>ייצוא:</b> ניתן לייצא את כל נתוני הסד"כ לאקסל.</li>
                                        </ul>
                                    </>
                                }
                            />
                        </h2>
                    </div>
                }
                rightActions={
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 transition-colors hover:bg-slate-100 shadow-sm">
                            <input
                                type="checkbox"
                                checked={showInactive}
                                onChange={(e) => setShowInactive(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-xs font-bold text-slate-600 whitespace-nowrap">הצג לא פעילים</span>
                        </label>
                    </div>
                }
            />

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {/* Hierarchical List */}
                <div className="space-y-4" key={`companies-${expandedCompanies.size}`}>
                    {companies.map(company => {
                        const companyPeople = filteredPeople.filter(p => p.organization_id === company.id);
                        const companyTeams = teams.filter(t => t.organization_id === company.id);
                        const isExpanded = expandedCompanies.has(company.id);

                        if (companyPeople.length === 0) return null;

                        return (
                            <div key={company.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* Company Header */}
                                <div className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-all">
                                    <button
                                        onClick={() => toggleCompany(company.id)}
                                        className="flex items-center gap-4 flex-1 text-right"
                                    >
                                        <div className="flex items-center gap-4">
                                            {isExpanded ? <CaretDown size={20} weight="bold" className="text-blue-600" /> : <CaretRight size={20} weight="bold" className="text-slate-400" />}
                                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg shadow-sm">
                                                {company.name.charAt(0)}
                                            </div>
                                            <div className="text-right">
                                                <h3 className="text-xl font-black text-slate-900">{company.name}</h3>
                                                <p className="text-sm font-bold text-slate-400">{companyPeople.length} חיילים</p>
                                            </div>
                                        </div>
                                    </button>

                                    {canEdit && (
                                        <button
                                            onClick={(e) => handleAddPerson(company.id, e)}
                                            className="ml-4 p-3 rounded-2xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all flex items-center gap-2 group/btn"
                                            title="הוסף חייל לפלוגה"
                                        >
                                            <Plus size={18} weight="bold" />
                                            <span className="max-w-0 overflow-hidden group-hover/btn:max-w-xs transition-all duration-300 font-black text-xs whitespace-nowrap">הוסף חייל</span>
                                        </button>
                                    )}
                                </div>

                                {/* Company Content */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100">
                                        {/* Teams */}
                                        {companyTeams.map(team => {
                                            const teamPeople = companyPeople.filter(p => p.teamId === team.id);
                                            const isTeamExpanded = expandedTeams.has(team.id);

                                            if (teamPeople.length === 0) return null;

                                            return (
                                                <div key={team.id} className="border-b border-slate-50 last:border-0">
                                                    {/* Team Header */}
                                                    <button
                                                        onClick={() => toggleTeam(team.id)}
                                                        className="w-full p-4 pr-12 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {isTeamExpanded ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
                                                            <Users size={18} className="text-blue-500" weight="duotone" />
                                                            <span className="font-bold text-slate-700">{team.name}</span>
                                                            <span className="text-xs font-bold text-slate-400">({teamPeople.length})</span>
                                                        </div>
                                                    </button>

                                                    {/* Team People */}
                                                    {isTeamExpanded && (
                                                        <div className="bg-slate-50/50 divide-y divide-slate-100">
                                                            {teamPeople.map((person: any) => {
                                                                const presence = getPersonPresence(person.id);
                                                                return (
                                                                    <PersonRow
                                                                        key={person.id}
                                                                        person={person}
                                                                        roles={roles}
                                                                        presence={presence}
                                                                        canEdit={canEdit}
                                                                        onEdit={(e) => handleEditPerson(person, e)}
                                                                        onDelete={(e) => { e.stopPropagation(); setPersonToDelete(person); }}
                                                                        onClick={() => setSelectedPerson(person)}
                                                                        mobileMenuOpen={mobileMenuPersonId === person.id}
                                                                        onMobileMenuToggle={(e) => {
                                                                            e.stopPropagation();
                                                                            setMobileMenuPersonId(mobileMenuPersonId === person.id ? null : person.id);
                                                                        }}
                                                                        onMobileMenuClose={(e) => {
                                                                            e.stopPropagation();
                                                                            setMobileMenuPersonId(null);
                                                                        }}
                                                                    />
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* People without team */}
                                        {companyPeople.filter(p => !p.teamId).map((person: any) => {
                                            const presence = getPersonPresence(person.id);
                                            return (
                                                <PersonRow
                                                    key={person.id}
                                                    person={person}
                                                    roles={roles}
                                                    presence={presence}
                                                    canEdit={canEdit}
                                                    onEdit={(e) => handleEditPerson(person, e)}
                                                    onDelete={(e) => { e.stopPropagation(); setPersonToDelete(person); }}
                                                    onClick={() => setSelectedPerson(person)}
                                                    mobileMenuOpen={mobileMenuPersonId === person.id}
                                                    onMobileMenuToggle={(e) => {
                                                        e.stopPropagation();
                                                        setMobileMenuPersonId(mobileMenuPersonId === person.id ? null : person.id);
                                                    }}
                                                    onMobileMenuClose={(e) => {
                                                        e.stopPropagation();
                                                        setMobileMenuPersonId(null);
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Person Details Modal */}
                {selectedPerson && (
                    <Modal
                        isOpen={true}
                        onClose={() => setSelectedPerson(null)}
                        title={
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <User size={24} weight="duotone" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-800">{selectedPerson.name}</h2>
                                    <p className="text-sm font-bold text-slate-400">פרטי חייל</p>
                                </div>
                            </div>
                        }
                        size="lg"
                    >
                        <div className="space-y-4">
                            {/* Organization & Team */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs font-bold text-slate-400 mb-1">פלוגה</p>
                                    <p className="font-black text-slate-900">
                                        {companies.find(c => c.id === selectedPerson.organization_id)?.name || '-'}
                                    </p>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs font-bold text-slate-400 mb-1">צוות</p>
                                    <p className="font-black text-slate-900">
                                        {teams.find(t => t.id === selectedPerson.teamId)?.name || 'ללא צוות'}
                                    </p>
                                </div>
                            </div>

                            {/* Roles */}
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-slate-400 mb-2">תפקידים</p>
                                <div className="flex flex-wrap gap-2">
                                    {getPersonRoles(selectedPerson).map((role, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold">
                                            {role}
                                        </span>
                                    ))}
                                    {getPersonRoles(selectedPerson).length === 0 && (
                                        <span className="text-slate-400 font-bold">אין תפקידים</span>
                                    )}
                                </div>
                            </div>

                            {/* Presence Status */}
                            <div className="bg-slate-50 p-4 rounded-xl">
                                <p className="text-xs font-bold text-slate-400 mb-2">סטטוס נוכחות</p>
                                <div className="space-y-1">
                                    <div className={`inline-flex px-3 py-1.5 rounded-xl text-sm font-black ${getPersonPresence(selectedPerson.id).class}`}>
                                        {getPersonPresence(selectedPerson.id).label}
                                    </div>
                                    {getPersonPresence(selectedPerson.id).details && (
                                        <p className="text-xs font-bold text-slate-500 mt-1">
                                            {getPersonPresence(selectedPerson.id).details}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Contact Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedPerson.phone && (
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <p className="text-xs font-bold text-slate-400 mb-1">טלפון</p>
                                        <p className="font-black text-slate-900 direction-ltr text-right">{selectedPerson.phone}</p>
                                    </div>
                                )}
                                {selectedPerson.email && (
                                    <div className="bg-slate-50 p-4 rounded-xl">
                                        <p className="text-xs font-bold text-slate-400 mb-1">אימייל</p>
                                        <p className="font-bold text-slate-900 text-sm break-all">{selectedPerson.email}</p>
                                    </div>
                                )}
                            </div>

                            {/* Custom Fields */}
                            {selectedPerson.customFields && Object.keys(selectedPerson.customFields).length > 0 && (
                                <div className="bg-slate-50 p-4 rounded-xl">
                                    <p className="text-xs font-bold text-slate-400 mb-3">פרטים נוספים</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {Object.entries(selectedPerson.customFields).map(([key, value]) => (
                                            <div key={key} className="bg-white p-3 rounded-lg">
                                                <p className="text-xs font-bold text-slate-400 mb-0.5 capitalize">{key}</p>
                                                <p className="font-bold text-slate-900 text-sm">{String(value)}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="grid grid-cols-1 gap-4">
                                {selectedPerson.isActive === false && (
                                    <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                                        <p className="text-sm font-black text-rose-700">חייל לא פעיל</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Modal>
                )}
            </div>

            {/* Person Editor Modal - Shows only company-specific roles */}
            <PersonEditorModal
                isOpen={isEditorOpen}
                onClose={() => setIsEditorOpen(false)}
                person={personToEdit}
                organizationId={targetOrgId}
                teams={teams.filter(t => t.organization_id === targetOrgId)}
                roles={roles.filter(r => r.organization_id === targetOrgId)}
                onSuccess={() => refetch?.()}
            />

            {/* Delete Confirmation */}
            <ConfirmationModal
                isOpen={!!personToDelete}
                onCancel={() => setPersonToDelete(null)}
                onConfirm={handleDeletePerson}
                title="מחיקת חייל"
                message={`האם אתה בטוח שברצונך למחוק את ${personToDelete?.name}? פעולה זו תמחוק גם את כל היסטוריית הנוכחות והשיבוצים שלו.`}
                confirmText="מחק חייל"
                type="danger"
            />
        </div>
    );
};
