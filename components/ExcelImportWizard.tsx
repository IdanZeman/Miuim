import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertCircle, Plus, ArrowUpRight, Download } from 'lucide-react';
import { Person, Team, Role } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Select } from './ui/Select';
import { Button } from './ui/Button';

interface ExcelImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (people: Person[], newTeams?: Team[], newRoles?: Role[]) => Promise<void>;
    teams: Team[];
    roles: Role[];
    people: Person[]; // NEW: Existing people for conflict check
    onAddTeam: (t: Team) => void;
    onAddRole: (r: Role) => void;
    isSaving?: boolean;
}

type Step = 'upload' | 'mapping' | 'resolution' | 'preview';

interface ColumnMapping {
    excelColumn: string;
    systemField: 'name' | 'first_name' | 'last_name' | 'team' | 'role' | 'mobile' | 'email' | 'is_commander' | 'is_active' | 'ignore';
}

interface ParsedData {
    headers: string[];
    rows: any[];
}

interface ResolutionItem {
    originalName: string;
    type: 'team' | 'role' | 'person';
    action: 'create' | 'map' | 'ignore' | 'merge'; // 'merge' for persons
    targetId?: string; // If mapping/merging, which ID to use
    matchReason?: string; // e.g. "Matched by Phone"
    excelRowIndex?: number; // For persons, identifying the source row
}

export const ExcelImportWizard: React.FC<ExcelImportWizardProps> = ({
    isOpen,
    onClose,
    onImport,
    teams,
    roles,
    people,
    onAddTeam,
    onAddRole,
    isSaving = false // Default to false
}) => {
    const { showToast } = useToast();
    const [step, setStep] = useState<Step>('upload');
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [previewData, setPreviewData] = useState<Person[]>([]);
    const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset state when opening/closing
    React.useEffect(() => {
        if (!isOpen) {
            const timer = setTimeout(() => {
                setStep('upload');
                setParsedData(null);
                setMappings([]);
                setPreviewData([]);
                setResolutions([]);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const systemFields = [
        { value: 'name', label: 'שם מלא' },
        { value: 'first_name', label: 'שם פרטי' },
        { value: 'last_name', label: 'שם משפחה' },
        { value: 'team', label: 'צוות' },
        { value: 'role', label: 'תפקיד' },
        { value: 'email', label: 'אימייל' },
        { value: 'mobile', label: 'טלפון נייד' },
        { value: 'is_commander', label: 'מפקד (כן/לא)' },
        { value: 'is_active', label: 'פעיל (כן/לא)' },
        { value: 'ignore', label: 'התעלם' }
    ];

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

                if (data.length === 0) {
                    showToast('הקובץ ריק', 'error');
                    return;
                }

                const headers = data[0] as string[];
                const rows = data.slice(1);

                setParsedData({ headers, rows });

                // Initialize mappings - try to auto-guess
                const initialMappings = headers.map(header => {
                    let field: any = 'ignore';
                    const h = header.toLowerCase().trim();
                    if (h === 'שם' || h === 'שם מלא' || h === 'name' || h === 'full name') field = 'name';
                    else if (h.includes('פרטי') || h === 'first name') field = 'first_name';
                    else if (h.includes('משפחה') || h === 'last name') field = 'last_name';
                    else if (h.includes('צוות') || h.includes('מחלק')) field = 'team';
                    else if (h.includes('תפקיד')) field = 'role';
                    else if (h.includes('טלפון') || h.includes('נייד')) field = 'mobile';
                    else if (h.includes('מייל') || h.includes('דוא')) field = 'email';
                    else if (h.includes('מפקד') || h.includes('commander')) field = 'is_commander';
                    else if (h.includes('פעיל') || h.includes('active')) field = 'is_active';

                    return { excelColumn: header, systemField: field };
                });

                setMappings(initialMappings);
                setStep('mapping');
            } catch (error) {
                console.error("Error reading excel:", error);
                showToast('שגיאה בקריאת הקובץ', 'error');
            }
        };
        reader.readAsBinaryString(file);
    };

    const downloadTemplate = () => {
        // Create template with all Person fields
        const headers = [
            'שם מלא',
            'שם פרטי',
            'שם משפחה',
            'צוות',
            'תפקיד (ניתן להפריד בפסיק)',
            'טלפון נייד',
            'אימייל',
            'מפקד (כן/לא)',
            'פעיל (כן/לא)'
        ];

        const exampleRow = [
            'יוסי כהן',
            'יוסי',
            'כהן',
            'מחלקה א',
            'מקלען, נהג',
            '050-1234567',
            'yossi@example.com',
            'כן',
            'כן'
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'תבנית חיילים');
        XLSX.writeFile(wb, 'תבנית_ייבוא_חיילים.xlsx');
        showToast('תבנית הורדה בהצלחה', 'success');
    };

    const handleMappingChange = (index: number, systemField: any) => {
        const newMappings = [...mappings];
        newMappings[index].systemField = systemField;
        setMappings(newMappings);
    };

    const analyzeConflicts = () => {
        if (!parsedData) return;

        const hasFullName = mappings.some(m => m.systemField === 'name');
        const hasSplitName = mappings.some(m => m.systemField === 'first_name') &&
            mappings.some(m => m.systemField === 'last_name');

        if (!hasFullName && !hasSplitName) {
            showToast('חובה למפות עמודת "שם מלא" או "שם פרטי" + "שם משפחה"', 'error');
            return;
        }

        const unknownTeams = new Set<string>();
        const unknownRoles = new Set<string>();
        const personConflicts: ResolutionItem[] = [];

        // Find relevant columns
        const teamColIdx = mappings.findIndex(m => m.systemField === 'team');
        const roleColIdx = mappings.findIndex(m => m.systemField === 'role');

        // Person match columns
        const nameColIdx = mappings.findIndex(m => m.systemField === 'name');
        const fNameIdx = mappings.findIndex(m => m.systemField === 'first_name');
        const lNameIdx = mappings.findIndex(m => m.systemField === 'last_name');
        const phoneColIdx = mappings.findIndex(m => m.systemField === 'mobile');
        const emailColIdx = mappings.findIndex(m => m.systemField === 'email');

        parsedData.rows.forEach((row: any, rowIndex: number) => {
            // Check Team
            if (teamColIdx !== -1) {
                const teamName = row[teamColIdx]?.toString().trim();
                if (teamName && !teams.some(t => t.name.trim().toLowerCase() === teamName.toLowerCase())) {
                    unknownTeams.add(teamName);
                }
            }
            // Check Roles
            if (roleColIdx !== -1) {
                const roleRaw = row[roleColIdx]?.toString().trim();
                if (roleRaw) {
                    const names = roleRaw.split(',').map((s: string) => s.trim());
                    names.forEach((name: string) => {
                        if (name && !roles.some(r => r.name.trim().toLowerCase() === name.toLowerCase())) {
                            unknownRoles.add(name);
                        }
                    });
                }
            }

            // Check Person Duplicates
            let name = '';
            if (nameColIdx !== -1) name = row[nameColIdx]?.toString().trim() || '';

            if (!name && fNameIdx !== -1 && lNameIdx !== -1) {
                name = `${row[fNameIdx] || ''} ${row[lNameIdx] || ''}`.trim();
            }

            const phone = phoneColIdx !== -1 ? row[phoneColIdx]?.toString().trim() : '';
            const email = emailColIdx !== -1 ? row[emailColIdx]?.toString().trim().toLowerCase() : '';

            // Normalize for matching
            const normPhone = phone.replace(/\D/g, '');

            if (name || normPhone || email) {
                const match = people.find(p => {
                    // Phone Match
                    if (normPhone && p.phone) {
                        const pPhone = p.phone.replace(/\D/g, '');
                        if (normPhone.length >= 7 && normPhone === pPhone) return true;
                    }
                    // Email Match
                    if (email && p.email && email === p.email.toLowerCase()) return true;
                    // Name Match (Exact)
                    if (name && p.name && name.toLowerCase() === p.name.toLowerCase()) return true;
                    return false;
                });

                if (match) {
                    let reason = 'שם זהה';
                    if (email && match.email?.toLowerCase() === email) reason = 'אימייל זהה';
                    else if (normPhone && match.phone?.replace(/\D/g, '') === normPhone) reason = 'טלפון זהה';

                    personConflicts.push({
                        originalName: name || email || 'ללא שם',
                        type: 'person',
                        action: 'merge',
                        targetId: match.id,
                        matchReason: reason,
                        excelRowIndex: rowIndex
                    });
                }
            }
        });

        // Onboarding Check: If empty system, auto-create unknown teams/roles (Persons won't conflict)
        if (teams.length === 0 && roles.length === 0 && unknownTeams.size > 0) {
            const autoResolutions: ResolutionItem[] = [
                ...Array.from(unknownTeams).map(name => ({
                    originalName: name,
                    type: 'team' as const,
                    action: 'create' as const
                })),
                ...Array.from(unknownRoles).map(name => ({
                    originalName: name,
                    type: 'role' as const,
                    action: 'create' as const
                }))
            ];
            setResolutions(autoResolutions);
            generatePreview(autoResolutions);
            return;
        }

        if (unknownTeams.size === 0 && unknownRoles.size === 0 && personConflicts.length === 0) {
            generatePreview([]); // No conflicts
        } else {
            const newResolutions: ResolutionItem[] = [
                ...Array.from(unknownTeams).map(name => ({
                    originalName: name,
                    type: 'team' as const,
                    action: 'create' as const
                })),
                ...Array.from(unknownRoles).map(name => ({
                    originalName: name,
                    type: 'role' as const,
                    action: 'create' as const
                })),
                ...personConflicts
            ];
            setResolutions(newResolutions);
            setStep('resolution');
        }
    };

    const handleResolutionChange = (index: number, updates: Partial<ResolutionItem>) => {
        const newRes = [...resolutions];
        newRes[index] = { ...newRes[index], ...updates };
        setResolutions(newRes);
    };

    const generatePreview = (currentResolutions: ResolutionItem[]) => {
        if (!parsedData) return;

        // Temporary map for created items to visualize them
        const tempTeams = [...teams];
        const tempRoles = [...roles];

        currentResolutions.forEach(res => {
            if (res.action === 'create') {
                if (res.type === 'team') {
                    tempTeams.push({ id: `temp-team-${res.originalName}`, name: res.originalName, color: 'border-slate-500' });
                } else {
                    tempRoles.push({ id: `temp-role-${res.originalName}`, name: res.originalName, color: 'bg-slate-200' });
                }
            }
        });

        const newPeople: Person[] = parsedData.rows.map((row: any, idx) => {
            // Check Resolution first
            const resolution = currentResolutions.find(r => r.type === 'person' && r.excelRowIndex === idx);
            if (resolution && resolution.action === 'ignore') return null;

            const rowData: any = {};
            mappings.forEach((map, colIndex) => {
                if (map.systemField !== 'ignore') {
                    rowData[map.systemField] = row[colIndex];
                }
            });

            // Construct full name
            let fullName = rowData.name;
            if (!fullName && rowData.first_name && rowData.last_name) {
                fullName = `${rowData.first_name} ${rowData.last_name}`;
            }

            if (!fullName) return null;

            // Resolve Team
            let teamId = '';
            if (rowData.team) {
                const rawTeam = rowData.team.toString().trim();
                const teamRes = currentResolutions.find(r => r.type === 'team' && r.originalName === rawTeam);

                if (teamRes) {
                    if (teamRes.action === 'map' && teamRes.targetId) teamId = teamRes.targetId;
                    else if (teamRes.action === 'create') teamId = `temp-team-${rawTeam}`;
                    // ignore -> teamId = ''
                } else {
                    // Match existing
                    const found = tempTeams.find(t => t.name.trim().toLowerCase() === rawTeam.toLowerCase());
                    if (found) teamId = found.id;
                }
            }

            // Resolve Roles
            let roleIds: string[] = [];
            if (rowData.role) {
                const rawRoles = rowData.role.toString().split(',').map((s: string) => s.trim());
                roleIds = rawRoles.map(rawRole => {
                    const roleRes = currentResolutions.find(r => r.type === 'role' && r.originalName === rawRole);
                    if (roleRes) {
                        if (roleRes.action === 'map' && roleRes.targetId) return roleRes.targetId;
                        else if (roleRes.action === 'create') return `temp-role-${rawRole}`;
                        return null;
                    } else {
                        const found = tempRoles.find(r => r.name.trim().toLowerCase() === rawRole.toLowerCase());
                        return found ? found.id : null;
                    }
                }).filter(Boolean) as string[];
            }

            // Generate color
            const color = teamId
                ? (tempTeams.find(t => t.id === teamId)?.color.replace('border-', 'bg-') || 'bg-slate-500')
                : 'bg-slate-500';

            // Determine ID (New vs Merge)
            let id = `imported-${Date.now()}-${idx}`;
            let basePerson: Partial<Person> = {};

            if (resolution && resolution.action === 'merge' && resolution.targetId) {
                id = resolution.targetId;
                const existing = people.find(p => p.id === id);
                if (existing) {
                    basePerson = existing;
                }
            }

            // Parse boolean fields
            const parseBoolean = (value: any): boolean => {
                if (typeof value === 'boolean') return value;
                const str = String(value).trim().toLowerCase();
                return str === 'כן' || str === 'yes' || str === 'true' || str === '1';
            };

            return {
                ...basePerson, // Start with existing data
                id: id,
                name: fullName || basePerson.name || '',
                teamId: teamId || basePerson.teamId || '',
                roleIds: roleIds.length > 0 ? roleIds : (basePerson.roleIds || []),
                email: rowData.email || basePerson.email || '',
                phone: rowData.mobile || basePerson.phone || '',
                isCommander: rowData.is_commander !== undefined ? parseBoolean(rowData.is_commander) : (basePerson.isCommander || false),
                isActive: rowData.is_active !== undefined ? parseBoolean(rowData.is_active) : (basePerson.isActive ?? true),
                maxShiftsPerWeek: basePerson.maxShiftsPerWeek || 7,

                preferences: basePerson.preferences || { preferNight: false, avoidWeekends: false },
                color: color !== 'bg-slate-500' ? color : (basePerson.color || 'bg-slate-500')
            } as Person;
        }).filter(Boolean) as Person[];

        setPreviewData(newPeople);
        setStep('preview');
    };

    const handleFinalImport = async () => {
        // 1. Create real items for conflicts marked as 'create'
        const resolutionMap = new Map<string, string>(); // entries: 'type-name' -> 'real-id'

        const teamsToCreate: Team[] = [];
        const rolesToCreate: Role[] = [];

        resolutions.forEach(res => {
            if (res.action === 'create') {
                const newId = `${res.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                if (res.type === 'team') {
                    const t = { id: newId, name: res.originalName, color: 'border-slate-500' };
                    // onAddTeam(t); // No need to update parent state blindly, pass explicitly
                    teamsToCreate.push(t);
                } else {
                    const r = { id: newId, name: res.originalName, color: 'bg-slate-200' };
                    // onAddRole(r);
                    rolesToCreate.push(r);
                }
                resolutionMap.set(`${res.type}-${res.originalName}`, newId);
            }
        });

        // 2. Fix IDs in previewData
        const finalPeople = previewData.map(p => {
            let finalTeamId = p.teamId;
            // Check if teamId was temp
            if (p.teamId.startsWith('temp-team-')) {
                const originalName = p.teamId.replace('temp-team-', '');
                if (resolutionMap.has(`team-${originalName}`)) {
                    finalTeamId = resolutionMap.get(`team-${originalName}`)!;
                } else {
                    finalTeamId = '';
                }
            }

            const finalRoleIds = p.roleIds.map(rid => {
                if (rid.startsWith('temp-role-')) {
                    const originalName = rid.replace('temp-role-', '');
                    return resolutionMap.get(`role-${originalName}`) || null;
                }
                return rid;
            }).filter(Boolean) as string[];

            return {
                ...p,
                teamId: finalTeamId,
                roleIds: finalRoleIds
            };
        });

        await onImport(finalPeople, teamsToCreate, rolesToCreate);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white md:rounded-2xl shadow-xl w-full h-full md:h-auto md:max-w-2xl md:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" />
                            ייבוא לוחמים מאקסל
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {/* Dynamic Step Counter based on Onboarding (3 steps) vs Existing (4 steps) */}
                            {teams.length === 0 && roles.length === 0 ? (
                                <>
                                    {step === 'upload' && 'שלב 1/3: העלאת קובץ'}
                                    {step === 'mapping' && 'שלב 2/3: מיפוי עמודות'}
                                    {step === 'preview' && 'שלב 3/3: בדיקה ואישור'}
                                </>
                            ) : (
                                <>
                                    {step === 'upload' && 'שלב 1/4: העלאת קובץ'}
                                    {step === 'mapping' && 'שלב 2/4: מיפוי עמודות'}
                                    {step === 'resolution' && 'שלב 3/4: פתרון התנגשויות'}
                                    {step === 'preview' && 'שלב 4/4: בדיקה ואישור'}
                                </>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto text-right" dir="rtl">

                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center h-full py-10 m-6 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                            />
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                                <Upload size={32} className="text-blue-500" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-700 mb-2">לחץ להעלאת קובץ אקסל</h3>
                            <p className="text-slate-500 text-sm mb-4">תומך בקבצי .xlsx, .xls, .csv</p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    downloadTemplate();
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm"
                            >
                                <Download size={16} />
                                הורד תבנית אקסל
                            </button>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="pb-6">
                            <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-blue-800 text-sm mx-6 mt-6 mb-4">
                                <AlertCircle size={20} className="flex-shrink-0" />
                                <p>המערכת זיהתה את העמודות הבאות. אנא התאם כל עמודה באקסל לשדה המתאים במערכת.</p>
                            </div>

                            {/* Header Row */}
                            <div className="sticky top-0 z-20 bg-white flex items-center gap-2 md:gap-4 px-4 md:px-6 py-3 text-xs font-bold text-slate-500 shadow-sm border-y border-slate-100">
                                <div className="w-5/12 md:w-1/3 flex items-center gap-1">
                                    <FileSpreadsheet size={14} />
                                    <span>עמודה באקסל (מקור)</span>
                                </div>
                                <div className="w-6 md:w-8"></div>
                                <div className="flex-1">שדה במערכת (יעד)</div>
                            </div>

                            <div className="grid gap-3 px-4 md:px-6 pt-4">
                                {mappings.map((mapping, idx) => (
                                    <div key={idx} className="flex items-center gap-2 md:gap-4 p-2 md:p-3 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow">

                                        {/* Excel Source (Right side in RTL) */}
                                        <div className="w-5/12 md:w-1/3 flex items-center gap-2 overflow-hidden bg-slate-50 px-2 py-2 md:px-3 rounded-md border border-slate-200 group">
                                            <FileSpreadsheet className="text-green-600 flex-shrink-0 group-hover:scale-110 transition-transform w-4 h-4 md:w-5 md:h-5" />
                                            <div className="font-bold text-slate-700 truncate text-xs md:text-sm" title={mapping.excelColumn}>
                                                {mapping.excelColumn}
                                            </div>
                                        </div>

                                        {/* Arrow (Pointing Left in RTL) */}
                                        <ArrowLeft className="text-slate-300 w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />

                                        {/* System Target (Left side in RTL) */}
                                        <div className="flex-1">
                                            <Select
                                                value={mapping.systemField}
                                                onChange={(val) => handleMappingChange(idx, val as any)}
                                                options={systemFields}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 'resolution' && (
                        <div className="space-y-6 p-4 md:p-6">
                            <div className="bg-yellow-50 p-4 rounded-lg flex gap-3 text-yellow-800 text-sm">
                                <AlertCircle size={20} className="flex-shrink-0" />
                                <p>נמצאו נתונים בקובץ שלא קיימים במערכת. אנא בחר כיצד לטפל בהם.</p>
                            </div>

                            {resolutions.map((res, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            {res.type === 'person' ? (
                                                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 font-bold">
                                                    כפילות מזוהה ({res.matchReason})
                                                </span>
                                            ) : (
                                                <span className={`text-xs px-2 py-1 rounded ${res.type === 'team' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'} font-bold`}>
                                                    {res.type === 'team' ? 'צוות לא מוכר' : 'תפקיד לא מוכר'}
                                                </span>
                                            )}
                                            <h3 className="font-bold text-slate-800 mt-2 text-lg">{res.originalName}</h3>
                                        </div>
                                    </div>

                                    {res.type === 'person' ? (
                                        <div className="space-y-2">
                                            <label className={`flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer ${res.action === 'merge' ? 'bg-blue-50 border-blue-200' : ''}`}>
                                                <input
                                                    type="radio"
                                                    name={`res-${idx}`}
                                                    checked={res.action === 'merge'}
                                                    onChange={() => handleResolutionChange(idx, { action: 'merge' })}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight size={16} className="text-blue-600" />
                                                    <div>
                                                        <span className="font-bold text-slate-700">מזג לתוך הקיים</span>
                                                        <p className="text-xs text-slate-500">יעדכן את הרשומה הקיימת עם המידע מהאקסל (מזהה ID נשמר)</p>
                                                    </div>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`res-${idx}`}
                                                    checked={res.action === 'create'}
                                                    onChange={() => handleResolutionChange(idx, { action: 'create' })}
                                                    className="text-green-600 focus:ring-green-500"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <Plus size={16} className="text-green-600" />
                                                    <span>צור כחדש (כפילות)</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`res-${idx}`}
                                                    checked={res.action === 'ignore'}
                                                    onChange={() => handleResolutionChange(idx, { action: 'ignore' })}
                                                    className="text-slate-400 focus:ring-slate-500"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400">התעלם (אל תייבא)</span>
                                                </div>
                                            </label>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`res-${idx}`}
                                                    checked={res.action === 'create'}
                                                    onChange={() => handleResolutionChange(idx, { action: 'create' })}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <Plus size={16} className="text-green-600" />
                                                    <span>צור כחדש במערכת</span>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`res-${idx}`}
                                                    checked={res.action === 'map'}
                                                    onChange={() => handleResolutionChange(idx, { action: 'map', targetId: res.type === 'team' ? teams[0]?.id : roles[0]?.id })}
                                                />
                                                <div className="flex-1 flex items-center gap-2">
                                                    <ArrowUpRight size={16} className="text-blue-600" />
                                                    <span className="shrink-0 text-sm">מפה לקיים:</span>
                                                    <div className="flex-1 mr-2">
                                                        <Select
                                                            disabled={res.action !== 'map'}
                                                            value={res.targetId || ''}
                                                            onChange={(val) => handleResolutionChange(idx, { targetId: val })}
                                                            options={res.type === 'team'
                                                                ? teams.map(t => ({ value: t.id, label: t.name }))
                                                                : roles.map(r => ({ value: r.id, label: r.name }))
                                                            }
                                                            placeholder="בחר..."
                                                            className="w-full text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            </label>

                                            <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-slate-50 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name={`res-${idx}`}
                                                    checked={res.action === 'ignore'}
                                                    onChange={() => handleResolutionChange(idx, { action: 'ignore' })}
                                                />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400">התעלם (השאר ריק)</span>
                                                </div>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="p-4 md:p-6">
                            <div className="bg-green-50 p-4 rounded-lg flex gap-3 text-green-800 text-sm mb-4">
                                <Check size={20} className="flex-shrink-0" />
                                <p>נמצאו {previewData.length} רשומות לייבוא. הנתונים יוצגו כך:</p>
                            </div>

                            <div className="overflow-x-auto border border-slate-200 rounded-lg">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="p-3">שם</th>
                                            <th className="p-3">צוות</th>
                                            <th className="p-3">תפקידים</th>
                                            <th className="p-3">טלפון</th>
                                            <th className="p-3">אימייל</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {previewData.slice(0, 10).map((person, i) => {
                                            // Helper to find name even if temp
                                            const getTeamName = (id: string) => {
                                                if (id.startsWith('temp-team-')) return id.replace('temp-team-', '') + ' (חדש)';
                                                return teams.find(t => t.id === id)?.name || '-';
                                            };
                                            const getRoleName = (id: string) => {
                                                if (id.startsWith('temp-role-')) return id.replace('temp-role-', '') + ' (חדש)';
                                                return roles.find(r => r.id === id)?.name;
                                            };

                                            const teamName = getTeamName(person.teamId);
                                            const roleNames = (person.roleIds || [])
                                                .map(getRoleName)
                                                .filter(Boolean)
                                                .join(', ');

                                            return (
                                                <tr key={person.id} className="hover:bg-slate-50">
                                                    <td className="p-3 font-medium">{person.name}</td>
                                                    <td className="p-3">{teamName}</td>
                                                    <td className="p-3">{roleNames || '-'}</td>
                                                    <td className="p-3 text-slate-500" dir="ltr">{person.phone}</td>
                                                    <td className="p-3 text-slate-500">{person.email}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {previewData.length > 10 && (
                                    <div className="p-3 text-center text-slate-500 text-xs bg-slate-50 border-t border-slate-200">
                                        ועוד {previewData.length - 10} רשומות...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between" dir="rtl">
                    {step !== 'upload' ? (
                        <Button
                            onClick={() => {
                                const isOnboarding = teams.length === 0 && roles.length === 0;
                                if (step === 'preview') {
                                    // If onboarding (skipped resolution) OR no conflicts -> Go to mapping
                                    // But actually, if distinct "resolution" step was shown (resolutions.length > 0 && !isOnboarding), go there.
                                    if (isOnboarding) {
                                        setStep('mapping');
                                    } else {
                                        setStep(resolutions.length > 0 ? 'resolution' : 'mapping');
                                    }
                                }
                                else if (step === 'resolution') setStep('mapping');
                                else setStep('upload');
                            }}
                            variant="secondary"
                        >
                            חזור
                        </Button>
                    ) : (
                        <div></div>
                    )}

                    {step === 'mapping' && (
                        <Button
                            onClick={analyzeConflicts}
                            variant="primary"
                            className="bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                        >
                            המשך <ArrowLeft size={16} />
                        </Button>
                    )}

                    {step === 'resolution' && (
                        <Button
                            onClick={() => generatePreview(resolutions)}
                            className="bg-blue-600 hover:bg-blue-700 text-white border-transparent"
                        >
                            המשך <ArrowLeft size={16} />
                        </Button>
                    )}

                    {step === 'preview' && (
                        <Button
                            onClick={handleFinalImport}
                            className="bg-green-600 hover:bg-green-700 text-white border-transparent disabled:opacity-70"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin ml-2"></div>
                                    מוסיף...
                                </>
                            ) : (
                                <>
                                    הוסף {previewData.length} חיילים <Check size={16} />
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
