import React, { useState, useRef } from 'react';
import { logger } from '../../services/loggingService';
import * as XLSX from 'xlsx';
import { UploadSimple as Upload, FileXls as FileSpreadsheet, ArrowRight, ArrowLeft, Check, WarningCircle as AlertCircle, Plus, ArrowUpRight, X, Warning as AlertTriangle } from '@phosphor-icons/react';
import { Person, Team, Role, CustomFieldDefinition } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { GenericModal } from '../../components/ui/GenericModal';
import { ExportButton } from '../../components/ui/ExportButton';
import { formatPhoneNumber } from '../../utils/nameUtils';

interface ExcelImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (people: Person[], newTeams?: Team[], newRoles?: Role[], newCustomFields?: CustomFieldDefinition[]) => Promise<void>;
    teams: Team[];
    roles: Role[];
    people: Person[]; // NEW: Existing people for conflict check
    customFieldsSchema?: CustomFieldDefinition[]; // NEW
    onAddTeam: (t: Team) => void;
    onAddRole: (r: Role) => void;
    isSaving?: boolean;
}

type Step = 'upload' | 'mapping' | 'resolution' | 'preview';

interface ColumnMapping {
    excelColumn: string;
    systemField: 'name' | 'first_name' | 'last_name' | 'team' | 'role' | 'mobile' | 'email' | 'is_commander' | 'is_active' | 'ignore' | 'new_custom_field' | string;
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
    customFieldsSchema = [],
    onAddTeam,
    onAddRole,
    isSaving = false // Default to false
}) => {
    const { showToast } = useToast();
    const [step, setStep] = useState<Step>('upload');
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [previewData, setPreviewData] = useState<Person[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
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
        { value: 'is_active', label: 'פעיל (כן/לא)' },
        { value: 'new_custom_field', label: 'הוסף כשדה מותאם אישית (חדש)' },
        ...customFieldsSchema.map(f => ({ value: `cf_${f.key}`, label: `שדה: ${f.label}` })),
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
                    else if (h.includes('פעיל') || h.includes('active')) field = 'is_active';
                    else if (h.includes('custom') || h.includes('מותאם') || h.includes('fields')) field = 'custom_fields';

                    return { excelColumn: header, systemField: field };
                });

                setMappings(initialMappings);
                setStep('mapping');
            } catch (error: any) {
                console.error("Error reading excel:", error);
                showToast('שגיאה בקריאת הקובץ', 'error');
                logger.error('ERROR', "Failed to read excel file during import", error);
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
                return str === 'כן' || str === 'yes' || str === 'true' || str === '1' || str === 'v' || str === 'פעיל';
            };

            return {
                ...basePerson, // Start with existing data
                id: id,
                name: fullName || basePerson.name || '',
                teamId: teamId || basePerson.teamId || '',
                roleIds: roleIds.length > 0 ? roleIds : (basePerson.roleIds || []),
                email: rowData.email || basePerson.email || '',
                phone: formatPhoneNumber(rowData.mobile) || basePerson.phone || '',
                isActive: rowData.is_active !== undefined ? parseBoolean(rowData.is_active) : (basePerson.isActive ?? true),
                maxShiftsPerWeek: basePerson.maxShiftsPerWeek || 7,

                preferences: basePerson.preferences || { preferNight: false, avoidWeekends: false },
                color: color !== 'bg-slate-500' ? color : (basePerson.color || 'bg-slate-500'),
                customFields: (() => {
                    let cf = basePerson.customFields || {};

                    // Add mapped custom fields
                    mappings.forEach((map, colIndex) => {
                        if (map.systemField === 'new_custom_field' || map.systemField.startsWith('cf_')) {
                            const key = map.systemField === 'new_custom_field'
                                ? map.excelColumn.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                : map.systemField.replace('cf_', '');

                            const val = row[colIndex];
                            if (val !== undefined && val !== null && val !== "") {
                                cf[key] = val;
                            }
                        }
                    });

                    if (rowData.custom_fields) {
                        try {
                            const parsed = typeof rowData.custom_fields === 'string'
                                ? JSON.parse(rowData.custom_fields)
                                : rowData.custom_fields;
                            cf = { ...cf, ...parsed };
                        } catch (e) {
                            console.warn('Failed to parse custom_fields JSON', rowData.custom_fields);
                        }
                    }
                    return cf;
                })()
            } as Person;
        }).filter(Boolean) as Person[];

        setPreviewData(newPeople);
        setSelectedIndices(new Set(newPeople.map((_, i) => i)));
        setStep('preview');
    };

    const handleFinalImport = async () => {
        // 1. Create real items for conflicts marked as 'create'
        const resolutionMap = new Map<string, string>(); // entries: 'type-name' -> 'real-id'

        const teamsToCreate: Team[] = [];
        const rolesToCreate: Role[] = [];
        const customFieldsToCreate: CustomFieldDefinition[] = [];

        mappings.forEach((map, colIdx) => {
            if (map.systemField === 'new_custom_field') {
                const slug = map.excelColumn.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
                const key = slug && /^[a-z]/.test(slug) ? `cf_${slug}` : `cf_${Math.random().toString(36).substr(2, 9)}`;
                // Check if already exists in schema
                if (!customFieldsSchema.some(f => f.key === key)) {
                    // Analyze column data to guess type
                    const columnValues = parsedData.rows.map(row => row[colIdx]).filter(v => v !== undefined && v !== null && v !== "");

                    let detectedType: any = 'text';
                    let options: string[] = [];

                    if (columnValues.length > 0) {
                        const booleanTerms = ['כן', 'לא', 'v', 'x', 'yes', 'no', 'true', 'false', 'פעיל', 'לא פעיל'];
                        const isBoolean = columnValues.every(v => booleanTerms.includes(String(v).trim().toLowerCase()));

                        if (isBoolean) {
                            detectedType = 'boolean';
                        } else {
                            // Phone number check - avoid converting to 'number' type
                            const looksLikePhone = columnValues.some(v => /^[0-9+()-\s]{7,15}$/.test(String(v).trim()) && String(v).trim().startsWith('0'));

                            if (!looksLikePhone) {
                                // Split values by comma for multi-select check
                                const allTerms = columnValues.flatMap(v => String(v).split(',').map(s => s.trim()));
                                const uniqueTerms = Array.from(new Set(allTerms)).filter(Boolean);

                                // Threshold for select: low unique cardinarity
                                if (uniqueTerms.length > 1 && uniqueTerms.length <= Math.min(12, columnValues.length * 0.3)) {
                                    const hasCommas = columnValues.some(v => String(v).includes(','));
                                    detectedType = hasCommas ? 'multiselect' : 'select';
                                    options = uniqueTerms;
                                }
                            }
                        }
                    }

                    customFieldsToCreate.push({
                        id: `cf-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        key,
                        label: map.excelColumn,
                        type: detectedType,
                        options: options.length > 0 ? options : undefined,
                        order: customFieldsSchema.length + customFieldsToCreate.length
                    });
                }
            }
        });

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
        const finalPeople = previewData.filter((_, i) => selectedIndices.has(i)).map(p => {
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

        // Log Import
        logger.info('IMPORT_DATA', 'Bulk Imported Excel Data', {
            peopleCount: finalPeople.length,
            newTeamsCount: teamsToCreate.length,
            newRolesCount: rolesToCreate.length,
            newCustomFieldsCount: customFieldsToCreate.length
        });

        await onImport(finalPeople, teamsToCreate, rolesToCreate, customFieldsToCreate);
        // onClose(); // Let parent handle navigation
    };

    if (!isOpen) return null;

    const modalTitle = (
        <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                <FileSpreadsheet className="text-green-600" size={24} weight="duotone" />
                ייבוא אקסל
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
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
    );

    const modalFooter = (
        <div className="flex gap-3 w-full" dir="rtl">
            {step !== 'upload' && (
                <Button
                    variant="outline"
                    onClick={() => {
                        if (step === 'mapping') setStep('upload');
                        else if (step === 'resolution') setStep('mapping');
                        else if (step === 'preview') setStep(resolutions.length > 0 ? 'resolution' : 'mapping');
                    }}
                    className="flex-1 max-w-[150px] font-bold h-12 rounded-xl"
                >
                    חזור
                </Button>
            )}

            <div className="flex-1"></div>

            {step === 'upload' && (
                <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 h-12 rounded-xl">
                    ביטול
                </Button>
            )}

            {step === 'mapping' && (
                <Button
                    onClick={analyzeConflicts}
                    className="flex-1 max-w-[200px] h-12 font-black rounded-xl bg-slate-900 text-white shadow-lg active:scale-95 transition-all"
                >
                    המשך לשלב הבא
                    <ArrowLeft className="mr-2" weight="bold" />
                </Button>
            )}

            {step === 'resolution' && (
                <Button
                    onClick={() => generatePreview(resolutions)}
                    className="flex-1 max-w-[200px] h-12 font-black rounded-xl bg-slate-900 text-white shadow-lg active:scale-95 transition-all"
                >
                    הצג תצוגה מקדימה
                    <ArrowLeft className="mr-2" weight="bold" />
                </Button>
            )}

            {step === 'preview' && (
                <Button
                    onClick={handleFinalImport}
                    disabled={isSaving || selectedIndices.size === 0}
                    className="flex-[2] h-12 font-black rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-green-200 shadow-xl active:scale-95 transition-all disabled:opacity-50"
                >
                    {isSaving ? 'מייבא נתונים...' : `אישור וייבוא ${selectedIndices.size} רשומות`}
                    {!isSaving && <Check className="mr-2" weight="bold" />}
                </Button>
            )}
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            footer={modalFooter}
            size="2xl"
            className="md:h-[85vh] h-full"
        >
            <div className="h-full flex flex-col" dir="rtl">

                {/* -- STEP 1: UPLOAD -- */}
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 md:space-y-8 py-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-24 h-24 bg-green-50 rounded-[2rem] flex items-center justify-center border border-green-100 shadow-sm rotate-3">
                            <FileSpreadsheet size={48} className="text-green-600" weight="duotone" />
                        </div>

                        <div className="text-center space-y-2 max-w-sm mx-auto">
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">ייבוא נתונים מקובץ</h3>
                            <p className="text-slate-500 text-base leading-relaxed font-medium">
                                בחר קובץ אקסל המכיל את רשימת החיילים, הצוותים והתפקידים לייבוא מהיר למערכת.
                            </p>
                        </div>

                        <div className="w-full max-w-sm space-y-4 pt-4">
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
                                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-xl shadow-slate-200 active:scale-95 transition-all text-lg font-black flex items-center justify-center gap-3"
                            >
                                <ArrowUpRight size={24} weight="bold" />
                                בחר קובץ מהמחשב
                            </button>

                            <ExportButton
                                onExport={async () => {
                                    downloadTemplate();
                                }}
                                label="הורד תבנית אקסל לדוגמה"
                                variant="secondary"
                                className="w-full py-4 text-sm"
                            />
                        </div>
                    </div>
                )}

                {/* -- STEP 2: MAPPING -- */}
                {step === 'mapping' && (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 text-blue-800 text-sm items-start">
                            <div className="bg-blue-100 p-1 rounded-lg shrink-0">
                                <AlertCircle size={20} weight="duotone" />
                            </div>
                            <div className="pt-0.5 font-medium leading-relaxed">
                                המערכת ביצעה התאמה אוטומטית לעמודות הקובץ.
                                <br />אנא עבור על הרשימה וודא שהשדות משויכים נכון לפני ההמשך.
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-right border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                        <tr>
                                            <th className="p-3 w-10"></th>
                                            <th className="p-3 w-12 text-center text-[10px] uppercase">ייבוא?</th>
                                            <th className="p-3">עמודה באקסל</th>
                                            <th className="p-3">שיוך לשדה מערכת</th>
                                            <th className="p-3">דוגמאות מהקובץ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {mappings.map((mapping, idx) => {
                                            const isIgnored = mapping.systemField === 'ignore';
                                            const examples = parsedData.rows.slice(0, 3).map(r => r[idx]).filter(Boolean).join(', ');

                                            return (
                                                <tr key={idx} className={`hover:bg-slate-50/50 transition-colors ${isIgnored ? 'bg-slate-50/30' : ''}`}>
                                                    <td className="p-3 text-[10px] font-black text-slate-300 text-center">{idx + 1}</td>
                                                    <td className="p-3 text-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleMappingChange(idx, isIgnored ? (systemFields.find(f => f.value !== 'ignore')?.value || 'ignore') : 'ignore');
                                                            }}
                                                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${!isIgnored ? 'bg-green-100 text-green-700 shadow-sm border border-green-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}
                                                        >
                                                            {isIgnored ? <X size={14} weight="bold" /> : <Check size={14} weight="bold" />}
                                                        </button>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className={`font-bold transition-all ${isIgnored ? 'text-slate-400' : 'text-slate-800'}`}>
                                                            {mapping.excelColumn}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 w-64">
                                                        <Select
                                                            value={mapping.systemField}
                                                            onChange={(val) => handleMappingChange(idx, val as any)}
                                                            options={systemFields}
                                                            className={`w-full text-xs font-bold ${isIgnored ? 'opacity-50' : ''}`}
                                                            placeholder="שייך ל..."
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="text-[11px] text-slate-400 truncate max-w-xs font-medium" title={examples}>
                                                            {examples || <span className="text-slate-200 italic">ריק</span>}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* -- STEP 3: RESOLUTION -- */}
                {step === 'resolution' && (
                    <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 text-amber-800 text-sm items-start">
                            <div className="bg-amber-100 p-1 rounded-lg shrink-0">
                                <AlertTriangle size={20} weight="duotone" />
                            </div>
                            <div className="pt-0.5 font-medium leading-relaxed">
                                נמצאו נתונים חדשים או כפולים הדורשים את החלטתך.
                                <br /> עבור רשומות חדשות (צוותים/תפקידים), באפשרותך ליצור אותם או למפות אותם לקיים.
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
                                <table className="w-full text-sm text-right border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3">מידע מהאקסל (שם)</th>
                                            <th className="p-3">סיווג</th>
                                            <th className="p-3">פעולה</th>
                                            <th className="p-3">בחירת יעד</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {resolutions.map((res, idx) => {
                                            const isPerson = res.type === 'person';
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="p-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-800">{res.originalName}</span>
                                                            {res.matchReason && <span className="text-[10px] text-slate-400 font-bold">{res.matchReason}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wide inline-block ${res.type === 'person' ? 'bg-blue-100 text-blue-700' :
                                                            res.type === 'team' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {res.type === 'person' ? 'קיים במערכת' : (res.type === 'team' ? 'צוות חדש' : 'תפקיד חדש')}
                                                        </span>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex bg-slate-100 p-0.5 rounded-lg w-fit">
                                                            {(isPerson ? ['merge', 'create', 'ignore'] : ['create', 'map', 'ignore']).map(action => (
                                                                <button
                                                                    key={action}
                                                                    onClick={() => handleResolutionChange(idx, { action: action as any })}
                                                                    className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${res.action === action
                                                                        ? 'bg-white text-slate-900 shadow-sm'
                                                                        : 'text-slate-400 hover:text-slate-600'
                                                                        }`}
                                                                >
                                                                    {action === 'merge' ? 'עדכן קיים' :
                                                                        action === 'create' ? 'צור חדש' :
                                                                            action === 'map' ? 'מפה לקיים' : 'התעלם'}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 w-64">
                                                        {res.action === 'map' && (
                                                            <Select
                                                                value={res.targetId || ''}
                                                                onChange={(val) => handleResolutionChange(idx, { targetId: val })}
                                                                options={res.type === 'team' ? teams.map(t => ({ value: t.id, label: t.name })) : roles.map(r => ({ value: r.id, label: r.name }))}
                                                                className="w-full text-[11px] font-bold bg-white"
                                                                placeholder="בחר צוות/תפקיד..."
                                                            />
                                                        )}
                                                        {res.action === 'merge' && (
                                                            <div className="text-[11px] text-blue-600 font-bold bg-blue-50/50 px-2 py-1 rounded-lg border border-blue-100 truncate">
                                                                מתמזג עם: {people.find(p => p.id === res.targetId)?.name || 'לא נמצא'}
                                                            </div>
                                                        )}
                                                        {res.action === 'create' && <span className="text-[10px] text-slate-400 font-bold">ייווצר כפריט חדש</span>}
                                                        {res.action === 'ignore' && <span className="text-[10px] text-red-400 font-bold italic">לא יופעל שינוי</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* -- STEP 4: PREVIEW -- */}
                {step === 'preview' && (
                    <div className="space-y-6 animate-in zoom-in-95 duration-300">
                        <div className="bg-green-50 border border-green-100 p-4 rounded-2xl flex gap-3 text-green-800 text-sm items-start">
                            <div className="bg-green-100 p-1 rounded-lg shrink-0">
                                <Check size={20} weight="bold" />
                            </div>
                            <div className="pt-0.5 font-bold text-lg">
                                הכל מוכן! {previewData.length} רשומות יובאו למערכת.
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                                <table className="w-full text-sm text-right whitespace-nowrap border-collapse">
                                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-20">
                                        <tr>
                                            <th className="p-3 w-10">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndices.size === previewData.length}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedIndices(new Set(previewData.map((_, i) => i)));
                                                        else setSelectedIndices(new Set());
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                                />
                                            </th>
                                            <th className="p-3 text-xs">סטטוס</th>
                                            <th className="p-3">חייל</th>
                                            <th className="p-3">צוות</th>
                                            <th className="p-3">תפקיד</th>
                                            {/* Show mapped custom fields headers */}
                                            {mappings.filter(m => m.systemField !== 'ignore' && ['name', 'team', 'role', 'first_name', 'last_name'].indexOf(m.systemField) === -1).map(m => (
                                                <th key={m.excelColumn} className="p-3 text-slate-400 font-normal">{m.excelColumn}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-600">
                                        {previewData.slice(0, 100).map((person, i) => {
                                            const isSelected = selectedIndices.has(i);
                                            const resolution = resolutions.find(r => r.type === 'person' && r.excelRowIndex === (parsedData?.rows.indexOf(parsedData?.rows[i]))); // Actually resolution index is better
                                            // Find resolution by matching person ID if it's merge
                                            const res = resolutions.find(r => r.type === 'person' && r.targetId === person.id);
                                            const isUpdate = !!res && res.action === 'merge';

                                            const getTeamName = (id: string) => {
                                                if (id.startsWith('temp-team-')) return id.replace('temp-team-', '');
                                                return teams.find(t => t.id === id)?.name || '-';
                                            };
                                            const getRoleName = (id: string) => {
                                                if (id.startsWith('temp-role-')) return id.replace('temp-role-', '');
                                                return roles.find(r => r.id === id)?.name;
                                            };

                                            const teamName = getTeamName(person.teamId);
                                            const roleNames = (person.roleIds || []).map(getRoleName).filter(Boolean).join(', ');

                                            return (
                                                <tr key={i} className={`hover:bg-slate-50 transition-colors ${!isSelected ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                                                    <td className="p-3">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                const newSet = new Set(selectedIndices);
                                                                if (newSet.has(i)) newSet.delete(i);
                                                                else newSet.add(i);
                                                                setSelectedIndices(newSet);
                                                            }}
                                                            className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-500"
                                                        />
                                                    </td>
                                                    <td className="p-3">
                                                        {isUpdate ? (
                                                            <div className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-[10px] font-black w-fit">
                                                                <ArrowUpRight size={12} />
                                                                עדכון
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-0.5 rounded-full text-[10px] font-black w-fit">
                                                                <Plus size={12} />
                                                                חדש
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-800">{person.name}</span>
                                                            {isUpdate && <span className="text-[10px] text-slate-400 font-bold">מתמזג עם חייל קיים</span>}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`font-bold ${person.teamId.startsWith('temp-') ? 'text-indigo-600' : ''}`}>
                                                            {teamName}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 max-w-[150px] truncate">
                                                        <span className="text-slate-500">{roleNames || '-'}</span>
                                                    </td>
                                                    {/* Custom Data Cells */}
                                                    {mappings.filter(m => m.systemField !== 'ignore' && ['name', 'team', 'role', 'first_name', 'last_name'].indexOf(m.systemField) === -1).map(m => {
                                                        const key = m.systemField === 'new_custom_field'
                                                            ? m.excelColumn.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                                            : m.systemField.replace('cf_', '');
                                                        const val = person.customFields?.[key];
                                                        return (
                                                            <td key={m.excelColumn} className="p-3 text-xs text-slate-400">
                                                                {val ? String(val) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {previewData.length > 100 && (
                                <div className="p-3 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100 font-black uppercase tracking-widest">
                                    מציג 100 רשומות ראשונות מתוך {previewData.length}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </GenericModal >
    );
};
