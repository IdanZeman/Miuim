import React, { useState, useMemo } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { Person } from '@/types';
import { MagnifyingGlass as Search, DownloadSimple as Download, CircleNotch as Loader2, User, CaretDown, CaretRight, CaretLeft, Users, Eye } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import ExcelJS from 'exceljs';
import { ActionBar } from '../../components/ui/ActionBar';
import { PageInfo } from '../../components/ui/PageInfo';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

export const BattalionPersonnelTable: React.FC = () => {
    const { organization } = useAuth();

    // Optimized Data Hook - Must be first to avoid reference errors
    const {
        companies = [],
        people = [],
        teams = [],
        roles = [],
        presenceSummary = [],
        isLoading
    } = useBattalionData(organization?.battalion_id);

    // UI State - Initialize after data is available
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [expandedCompanies, setExpandedCompanies] = useState<Set<string>>(new Set());
    const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

    // Companies start collapsed by default
    // Users can expand them manually by clicking

    const getPersonPresence = (personId: string) => {
        const entry = presenceSummary.find(p => p.person_id === personId);
        if (!entry) return { status: 'none', label: 'לא הוזן', class: 'bg-slate-50 text-slate-400', details: null };

        let label = '';
        let details = null;

        switch (entry.status) {
            case 'base':
                label = 'בבסיס';
                if (entry.arrival_date) {
                    details = `הגיע: ${new Date(entry.arrival_date).toLocaleDateString('he-IL')}`;
                }
                return { status: entry.status, label, class: 'bg-emerald-50 text-emerald-600', details };
            case 'home':
                label = 'בבית';
                if (entry.departure_date) {
                    details = `יצא: ${new Date(entry.departure_date).toLocaleDateString('he-IL')}`;
                }
                return { status: entry.status, label, class: 'bg-blue-50 text-blue-600', details };
            case 'sick':
                return { status: entry.status, label: 'גימלים', class: 'bg-rose-50 text-rose-600', details: null };
            case 'leave':
                return { status: entry.status, label: 'חופשה', class: 'bg-indigo-50 text-indigo-600', details: null };
            default:
                return { status: entry.status, label: 'לא הוזן', class: 'bg-slate-50 text-slate-400', details: null };
        }
    };

    const getPersonRoles = (person: Person) => {
        return roles.filter(r => person.roleIds?.includes(r.id)).map(r => r.name);
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
        return people.filter(p => {
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

            // Headers
            const headers = ['שם מלא', 'פלוגה', 'צוות', 'תפקידים', 'מצב נוכחות', 'פירוט'];
            const headerRow = worksheet.addRow(headers);
            headerRow.font = { bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Slate 200
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });

            // Data
            filteredPeople.forEach(p => {
                const org = companies.find(c => c.id === p.organization_id);
                const team = teams.find(t => t.id === p.teamId);
                const personRoles = getPersonRoles(p).join(', ');
                const presence = getPersonPresence(p.id);

                const row = worksheet.addRow([
                    p.name,
                    org?.name || '-',
                    team?.name || '-',
                    personRoles || '-',
                    presence.label,
                    presence.details || '-'
                ]);

                // Style Status Cell
                const statusCell = row.getCell(5);
                statusCell.alignment = { horizontal: 'center' };
                if (presence.status === 'base') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }; // Green
                    statusCell.font = { color: { argb: 'FF065F46' } };
                } else if (presence.status === 'home') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Red
                    statusCell.font = { color: { argb: 'FF991B1B' } };
                } else if (presence.status === 'sick') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; // Rose
                    statusCell.font = { color: { argb: 'FFBE123C' } };
                } else if (presence.status === 'leave') {
                    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Indigo
                    statusCell.font = { color: { argb: 'FF3730A3' } };
                }

                // General borders
                row.eachCell(cell => {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            // Column Widths
            worksheet.columns = [
                { width: 20 }, // Name
                { width: 15 }, // Company
                { width: 15 }, // Team
                { width: 25 }, // Roles
                { width: 15 }, // Status
                { width: 30 }  // Details
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

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-slate-500 font-bold">טוען סד"כ גדודי...</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ActionBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onExport={handleExport}
                className="px-4 md:px-6 sticky top-0 z-40 bg-white"
                leftActions={
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Users className="text-blue-600" size={24} weight="bold" />
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
                                <button
                                    onClick={() => toggleCompany(company.id)}
                                    className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black text-lg shadow-sm">
                                            {company.name.charAt(0)}
                                        </div>
                                        <div className="text-right">
                                            <h3 className="text-xl font-black text-slate-900">{company.name}</h3>
                                            <p className="text-sm font-bold text-slate-400">{companyPeople.length} חיילים</p>
                                        </div>
                                    </div>
                                    {isExpanded ? <CaretDown size={20} weight="bold" className="text-blue-600" /> : <CaretLeft size={20} weight="bold" className="text-slate-400" />}
                                </button>

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
                                                        className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors pl-6"
                                                    >
                                                        <div className="flex items-center gap-3 pr-8">
                                                            <Users size={18} className="text-blue-500" weight="bold" />
                                                            <span className="font-bold text-slate-700">{team.name}</span>
                                                            <span className="text-xs font-bold text-slate-400">({teamPeople.length})</span>
                                                        </div>
                                                        {isTeamExpanded ? <CaretDown size={16} weight="bold" /> : <CaretLeft size={16} weight="bold" />}
                                                    </button>

                                                    {/* Team People */}
                                                    {isTeamExpanded && (
                                                        <div className="bg-slate-50/50 divide-y divide-slate-100">
                                                            {teamPeople.map(person => {
                                                                const presence = getPersonPresence(person.id);
                                                                const personRoles = getPersonRoles(person);

                                                                return (
                                                                    <div
                                                                        key={person.id}
                                                                        className="p-4 pr-16 flex items-center justify-between hover:bg-white transition-colors group cursor-pointer"
                                                                        onClick={() => setSelectedPerson(person)}
                                                                    >
                                                                        <div className="flex items-center gap-4 flex-1">
                                                                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                                                <User size={20} />
                                                                            </div>
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <p className="font-black text-slate-900 leading-none">{person.name}</p>
                                                                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-black border border-blue-100/50">
                                                                                        {companies.find(c => c.id === person.organization_id)?.name}
                                                                                    </span>
                                                                                </div>
                                                                                {personRoles.length > 0 && (
                                                                                    <p className="text-xs font-bold text-slate-500 mt-1">
                                                                                        {personRoles.join(', ')}
                                                                                    </p>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-3">
                                                                            <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${presence.class}`}>
                                                                                {presence.label}
                                                                            </div>
                                                                            <Eye size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {/* People without team */}
                                        {companyPeople.filter(p => !p.teamId).map(person => {
                                            const presence = getPersonPresence(person.id);
                                            const personRoles = getPersonRoles(person);

                                            return (
                                                <div
                                                    key={person.id}
                                                    className="p-4 pr-12 flex items-center justify-between hover:bg-slate-50 transition-colors group cursor-pointer border-b border-slate-50 last:border-0"
                                                    onClick={() => setSelectedPerson(person)}
                                                >
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                            <User size={20} />
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-black text-slate-900 leading-none">{person.name}</p>
                                                                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-600 text-[9px] font-black border border-blue-100/50">
                                                                    {companies.find(c => c.id === person.organization_id)?.name}
                                                                </span>
                                                            </div>
                                                            {personRoles.length > 0 && (
                                                                <p className="text-xs font-bold text-slate-500 mt-1">
                                                                    {personRoles.join(', ')}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`px-3 py-1.5 rounded-xl text-xs font-black ${presence.class}`}>
                                                            {presence.label}
                                                        </div>
                                                        <Eye size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                                                    </div>
                                                </div>
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
                                    <User size={24} weight="bold" />
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
                                        <p className="font-black text-slate-900 text-right" dir="ltr">{selectedPerson.phone}</p>
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
        </div>
    );
};
