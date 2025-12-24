import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertCircle, Plus, ArrowUpRight, Download, X, AlertTriangle } from 'lucide-react';
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

            const getCellValue = (idx: number) => {
                if (idx === -1) return '';
                const val = row[idx];
                return (val !== null && val !== undefined) ? String(val).trim() : '';
            };

            // Check Person Duplicates
            let name = getCellValue(nameColIdx);

            if (!name && fNameIdx !== -1 && lNameIdx !== -1) {
                const fName = getCellValue(fNameIdx);
                const lName = getCellValue(lNameIdx);
                if (fName || lName) {
                    name = `${fName} ${lName}`.trim();
                }
            }

            const phone = getCellValue(phoneColIdx);
            const email = getCellValue(emailColIdx).toLowerCase();

            // Normalize for matching
            const normPhone = phone.replace(/\D/g, '');

            if (name || normPhone || email) {
                const match = (people || []).find(p => {
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
        // onClose(); // Let parent handle navigation
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-end md:justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

            {/* Main Sheet */}
            <div className="relative w-full h-full md:h-[85vh] md:max-w-2xl bg-slate-50 md:rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300 md:duration-200 md:zoom-in-95">

                {/* Standard Header (Matched to PersonnelManager) */}
                <div className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 z-20">
                    <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                    <div className="text-center">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
                            <FileSpreadsheet className="text-green-600" size={20} />
                            ייבוא אקסל
                        </h2>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                            {teams.length === 0 && roles.length === 0 ? (
                                <>
                                    {step === 'upload' && 'שלב 1/3: העלאת קובץ'}
                                    {step === 'mapping' && 'שלב 2/3: מיפוי עמודות'}
                                    {step === 'preview' && 'שלב 3/3: אישור סופי'}
                                </>
                            ) : (
                                <>
                                    {step === 'upload' && 'שלב 1/4: העלאת קובץ'}
                                    {step === 'mapping' && 'שלב 2/4: מיפוי עמודות'}
                                    {step === 'resolution' && 'שלב 3/4: פתרון בעיות'}
                                    {step === 'preview' && 'שלב 4/4: אישור סופי'}
                                </>
                            )}
                        </p>
                    </div>
                    <div className="w-10" /> {/* Spacer */}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-24 bg-slate-50" dir="rtl">

                    {/* -- STEP 1: UPLOAD -- */}
                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 md:space-y-8 py-8">
                            <div className="w-20 h-20 bg-green-50 rounded-2xl flex items-center justify-center border border-green-100 shadow-sm">
                                <FileSpreadsheet size={40} className="text-green-600" />
                            </div>

                            <div className="text-center space-y-2 max-w-xs mx-auto">
                                <h3 className="text-lg font-bold text-slate-800">ייבוא נתונים מקובץ</h3>
                                <p className="text-slate-500 text-sm">
                                    בחר קובץ אקסל המכיל את רשימת החיילים, הצוותים והתפקידים לייבוא מהיר.
                                </p>
                            </div>

                            <div className="w-full max-w-sm space-y-4">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept=".xlsx, .xls, .csv"
                                    className="hidden"
                                    id="file-upload"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-md active:scale-95 transition-all text-base font-bold flex items-center justify-center gap-2"
                                >
                                    <Upload size={18} />
                                    בחר קובץ
                                </button>

                                <button
                                    onClick={downloadTemplate}
                                    className="w-full py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-all text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    <Download size={16} />
                                    הורד תבנית אקסל לדוגמה
                                </button>
                            </div>
                        </div>
                    )}

                    {/* -- STEP 2: MAPPING -- */}
                    {step === 'mapping' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-100 p-3.5 rounded-xl flex gap-3 text-blue-800 text-sm items-start">
                                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                <p>המערכת מבצעת התאמה אוטומטית. אנא ודא שהשדות משויכים נכון לפני ההמשך.</p>
                            </div>

                            <div className="space-y-3">
                                {mappings.map((mapping, idx) => {
                                    const isMapped = mapping.systemField !== 'ignore';
                                    return (
                                        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                                                    <FileSpreadsheet size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">עמודה בקובץ</div>
                                                    <div className="font-bold text-slate-800 truncate text-sm" title={mapping.excelColumn}>
                                                        {mapping.excelColumn}
                                                    </div>
                                                </div>
                                                {isMapped ? (
                                                    <div className="bg-green-100 text-green-700 p-1 rounded-full"><Check size={14} /></div>
                                                ) : (
                                                    <div className="bg-slate-100 text-slate-400 p-1 rounded-full"><X size={14} /></div>
                                                )}
                                            </div>

                                            <Select
                                                value={mapping.systemField}
                                                onChange={(val) => handleMappingChange(idx, val as any)}
                                                options={systemFields}
                                                className="w-full text-sm"
                                                placeholder="בחר שדה..."
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* -- STEP 3: RESOLUTION -- */}
                    {step === 'resolution' && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl flex gap-3 text-amber-800 text-sm items-start">
                                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                                <p>נמצאו נתונים הדורשים את תשומת ליבך. בחר כיצד לטפל בהם.</p>
                            </div>

                            <div className="space-y-3">
                                {resolutions.map((res, idx) => (
                                    <div key={idx} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                        <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
                                            <div>
                                                <h3 className="font-bold text-slate-800 text-sm">{res.originalName}</h3>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${res.type === 'person' ? 'bg-blue-100 text-blue-700' :
                                                    res.type === 'team' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                                                    }`}>
                                                    {res.type === 'person' ? 'כפילות' : (res.type === 'team' ? 'צוות חדש' : 'תפקיד חדש')}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-3 space-y-2">
                                            {res.type === 'person' ? (
                                                <div className="grid grid-cols-1 gap-2">
                                                    <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${res.action === 'merge' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                        <input
                                                            type="radio"
                                                            name={`res-${idx}`}
                                                            checked={res.action === 'merge'}
                                                            onChange={() => handleResolutionChange(idx, { action: 'merge' })}
                                                            className="w-4 h-4 text-blue-600"
                                                        />
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">עדכון קיים (מיזוג)</div>
                                                            <div className="text-xs text-slate-500">עדכון פרטים בלבד לחייל הקיים</div>
                                                        </div>
                                                    </label>
                                                    <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${res.action === 'create' ? 'bg-green-50 border-green-200 ring-1 ring-green-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                        <input
                                                            type="radio"
                                                            name={`res-${idx}`}
                                                            checked={res.action === 'create'}
                                                            onChange={() => handleResolutionChange(idx, { action: 'create' })}
                                                            className="w-4 h-4 text-green-600"
                                                        />
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">יצירה כחדש</div>
                                                            <div className="text-xs text-slate-500">שמירה כחייל נוסף במערכת</div>
                                                        </div>
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    <label className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${res.action === 'create' ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                        <input
                                                            type="radio"
                                                            name={`res-${idx}`}
                                                            checked={res.action === 'create'}
                                                            onChange={() => handleResolutionChange(idx, { action: 'create' })}
                                                            className="w-4 h-4 text-indigo-600"
                                                        />
                                                        <span className="text-sm font-bold text-slate-800">צור {res.type === 'team' ? 'צוות' : 'תפקיד'} חדש</span>
                                                    </label>

                                                    <label className={`flex flex-col gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${res.action === 'map' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'}`}>
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="radio"
                                                                name={`res-${idx}`}
                                                                checked={res.action === 'map'}
                                                                onChange={() => handleResolutionChange(idx, { action: 'map', targetId: res.targetId || (res.type === 'team' ? teams[0]?.id : roles[0]?.id) })}
                                                                className="w-4 h-4 text-blue-600"
                                                            />
                                                            <span className="text-sm font-bold text-slate-800">מפה לקיים</span>
                                                        </div>
                                                        {res.action === 'map' && (
                                                            <div className="pr-7 pl-1">
                                                                <Select
                                                                    value={res.targetId || ''}
                                                                    onChange={(val) => handleResolutionChange(idx, { targetId: val })}
                                                                    options={res.type === 'team' ? teams.map(t => ({ value: t.id, label: t.name })) : roles.map(r => ({ value: r.id, label: r.name }))}
                                                                    className="w-full text-sm bg-white"
                                                                    placeholder="בחר..."
                                                                />
                                                            </div>
                                                        )}
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* -- STEP 4: PREVIEW -- */}
                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-100 p-3.5 rounded-xl flex gap-3 text-green-800 text-sm items-start">
                                <Check size={18} className="shrink-0 mt-0.5" />
                                <p>הכל נראה מצוין! {previewData.length} רשומות מוכנות לייבוא.</p>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-right whitespace-nowrap">
                                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="p-3 w-10">#</th>
                                                <th className="p-3">שם</th>
                                                <th className="p-3">צוות</th>
                                                <th className="p-3">תפקיד</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-600">
                                            {previewData.slice(0, 50).map((person, i) => {
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
                                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                        <td className="p-3 text-slate-400 text-xs">{i + 1}</td>
                                                        <td className="p-3 font-medium text-slate-900">{person.name}</td>
                                                        <td className="p-3">{teamName}</td>
                                                        <td className="p-3 max-w-[150px] truncate">{roleNames || '-'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {previewData.length > 50 && (
                                    <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 border-t border-slate-200 font-medium">
                                        ועוד {previewData.length - 50} רשומות...
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer - Navigation */}
                <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-lg shrink-0 z-20" dir="rtl">
                    {step !== 'upload' && (
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (step === 'mapping') setStep('upload');
                                else if (step === 'resolution') setStep('mapping');
                                else if (step === 'preview') setStep(resolutions.length > 0 ? 'resolution' : 'mapping');
                            }}
                            className="w-1/3"
                        >
                            חזור
                        </Button>
                    )}

                    {step === 'upload' && (
                        <div className="flex-1" /> // Spacer
                    )}

                    {step === 'mapping' && (
                        <Button
                            onClick={analyzeConflicts}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                        >
                            המשך
                        </Button>
                    )}

                    {step === 'resolution' && (
                        <Button
                            onClick={() => generatePreview(resolutions)}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                        >
                            סקירה
                        </Button>
                    )}

                    {step === 'preview' && (
                        <Button
                            onClick={handleFinalImport}
                            disabled={isSaving}
                            className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold"
                        >
                            {isSaving ? 'מייבא...' : 'אשר וייבא'}
                        </Button>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
