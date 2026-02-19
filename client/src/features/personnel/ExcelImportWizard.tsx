import React, { useState, useRef } from 'react';
import { logger } from '../../services/loggingService';
import * as XLSX from 'xlsx';
import { UploadSimple as Upload, FileXls as FileSpreadsheet, ArrowRight, ArrowLeft, Check, WarningCircle as AlertCircle, Plus, ArrowUpRight, X, Warning as AlertTriangle, ArrowDown, ArrowsLeftRight, Tag } from '@phosphor-icons/react';
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
    onAddTeam: (t: Team) => void | Promise<any>;
    onAddRole: (r: Role) => void | Promise<any>;
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

    // Helper function to get readable label for system field
    const getSystemFieldLabel = (systemField: string): string => {
        const fieldMap: Record<string, string> = {
            'name': 'שם מלא',
            'first_name': 'שם פרטי',
            'last_name': 'שם משפחה',
            'team': 'צוות',
            'role': 'תפקיד',
            'email': 'אימייל',
            'mobile': 'טלפון',
            'is_active': 'פעיל',
            'is_commander': 'מפקד'
        };

        if (systemField.startsWith('cf_')) {
            const customField = customFieldsSchema.find(f => `cf_${f.key}` === systemField);
            return customField ? customField.label : 'שדה מותאם';
        }

        if (systemField === 'new_custom_field') {
            return 'שדה חדש';
        }

        return fieldMap[systemField] || systemField;
    };

    // Fuzzy matching helper for custom fields
    const fuzzyMatchCustomField = (excelHeader: string): string | null => {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/[^\u0590-\u05FFa-z0-9]/g, '');
        const h = normalize(excelHeader);

        if (!h) return null; // Empty after normalization

        for (const field of customFieldsSchema) {
            const label = normalize(field.label);

            // Exact match
            if (h === label) return field.key;

            // Partial match (one contains the other)
            if (h.includes(label) || label.includes(h)) {
                const minLen = Math.min(h.length, label.length);
                const maxLen = Math.max(h.length, label.length);
                // Require 70% overlap
                if (minLen / maxLen > 0.7) {
                    return field.key;
                }
            }
        }

        return null;
    };

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
                const allData = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                if (allData.length === 0) {
                    showToast('הקובץ ריק', 'error');
                    return;
                }

                // --- AUTO DETECT HEADER ROW ---
                let detectedHeaderIndex = -1;
                let maxMatches = 0;
                const headerKeywords = [
                    'שם', 'פרטי', 'משפחה', 'צוות', 'מחלק', 'תפקיד', 'טלפון', 'נייד', 'מייל', 'אימייל', 'פעיל', 'ת.ז', 'מזהה', 'מספר', 'דרגה', 'אישי', 'הערות', 'סטטוס',
                    'name', 'first', 'last', 'team', 'role', 'phone', 'mobile', 'email', 'active', 'id', 'serial', 'rank', 'personal', 'note', 'status'
                ];

                // Check first 30 rows to find which one looks most like a header row
                for (let i = 0; i < Math.min(allData.length, 30); i++) {
                    const row = allData[i];
                    if (!Array.isArray(row)) continue;

                    let matches = 0;
                    row.forEach(cell => {
                        if (cell && typeof cell === 'string') {
                            const val = cell.toLowerCase().trim();
                            if (headerKeywords.some(k => val.includes(k))) matches++;
                        }
                    });

                    // We give weight to rows that have more recognized keywords
                    if (matches > maxMatches) {
                        maxMatches = matches;
                        detectedHeaderIndex = i;
                    }
                }

                // Fallback: If no keywords were matched, try to find the first row that has at least 3 non-empty cells
                if (detectedHeaderIndex === -1) {
                    for (let i = 0; i < Math.min(allData.length, 30); i++) {
                        const row = allData[i];
                        if (Array.isArray(row)) {
                            const contentCount = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
                            if (contentCount >= 3) {
                                detectedHeaderIndex = i;
                                break;
                            }
                        }
                    }
                }

                // Final check - if we still haven't found a plausible header
                if (detectedHeaderIndex === -1) {
                    showToast('לא נמצאה טבלה בקובץ. אנא ודא שהטבלה מתחילה בפינה העליונה (תא A1) או שהכותרות ברורות (שם, טלפון וכו\')', 'error');
                    return;
                }

                const headerRowIndex = detectedHeaderIndex;
                const headers = Array.from(allData[headerRowIndex] || []).map(h => String(h || '').trim());
                const rows = allData.slice(headerRowIndex + 1).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

                if (headers.length === 0 || headers.every(h => !h)) {
                    showToast('לא נמצאו כותרות תקינות בקובץ. אנא הצמד את הטבלה לראש הגיליון', 'error');
                    return;
                }

                setParsedData({ headers, rows });

                if (maxMatches > 0 && headerRowIndex > 0) {
                    showToast(`זוהתה שורת כותרות בשורה ${headerRowIndex + 1}`, 'info');
                } else if (maxMatches === 0) {
                    showToast('שורת הכותרות לא זוהתה בוודאות. ייתכן שתצטרך למפות את השדות ידנית', 'warning');
                }

                // Initialize mappings - try to auto-guess
                const initialMappings = headers.map(header => {
                    let field: any = 'new_custom_field';
                    const h = header.toLowerCase().trim();

                    // 1. Try system fields first - Priority to Name (Mmore inclusive)
                    if (
                        h === 'שם' ||
                        h === 'שם מלא' ||
                        h === 'name' ||
                        h === 'full name' ||
                        h === 'חייל' ||
                        h === 'שם החייל' ||
                        h === 'שם לוחם' ||
                        h === 'לוחם' ||
                        h === 'שם ומשפחה' ||
                        h === 'שם פרטי ומשפחה' ||
                        h.includes('שם המשתמש') ||
                        h.includes('שם ומשפחה') ||
                        h.includes('שם ומש') ||
                        (h.includes('שם') && !h.includes('תפקיד') && !h.includes('צוות') && !h.includes('מחלקה') && !h.includes('תיאור')) ||
                        h === 'person' ||
                        h === 'user' ||
                        h === 'member'
                    ) {
                        field = 'name';
                    }
                    else if (h.includes('פרטי') || h === 'first name' || h === 'שם פרטי') field = 'first_name';
                    else if (h.includes('משפחה') || h === 'last_name' || h === 'שם משפחה') field = 'last_name';
                    else if ((h.includes('צוות') || h.includes('מחלק')) && !h.includes('שם')) field = 'team';
                    else if (
                        (h.includes('תפקיד') || h === 'role' || h === 'תפקידים') &&
                        !h.includes('שם') && // Avoid "Name of Role"
                        !h.includes('חייל') &&
                        !h.includes('לוחם')
                    ) {
                        field = 'role';
                    }
                    else if (h.includes('טלפון') || h.includes('נייד') || h === 'phone' || h === 'mobile' || h === 'סלולרי') field = 'mobile';
                    else if (h.includes('מייל') || h.includes('דוא') || h === 'email') field = 'email';
                    else if (h.includes('פעיל') || h.includes('active') || h === 'סטטוס') field = 'is_active';
                    else if (h.includes('custom') || h.includes('מותאם') || h.includes('fields')) field = 'custom_fields';

                    // 2. If not a system field, try fuzzy match against existing custom fields
                    else {
                        const matchedKey = fuzzyMatchCustomField(header);
                        if (matchedKey) {
                            field = `cf_${matchedKey}`;
                        }
                    }

                    return { excelColumn: header, systemField: field };
                });

                // Post-mapping validation and clever fallbacks
                const hasNameMapping = initialMappings.some(m => m && (m.systemField === 'name' || m.systemField === 'first_name'));
                const roleMapping = initialMappings.find(m => m && m.systemField === 'role');

                if (!hasNameMapping) {
                    // Try to find ANY field that might be a name if we missed it
                    const potentialName = initialMappings.find(m => {
                        if (!m) return false;
                        const h = m.excelColumn.toLowerCase();
                        return h.includes('נמען') || h.includes('משתמש') || h.includes('שם') || h.includes('לוחם');
                    });
                    if (potentialName) {
                        potentialName.systemField = 'name';
                        showToast(`זיהינו את "${potentialName.excelColumn}" כעמודת השם`, 'info');
                    }
                }

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

    // Fuzzy matching helpers - OPTIMIZED
    const levenshteinDistance = (str1: string, str2: string, maxDistance: number = Infinity): number => {
        // Early exit if length difference is too large
        if (Math.abs(str1.length - str2.length) > maxDistance) {
            return maxDistance + 1;
        }

        const matrix: number[][] = [];

        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= str2.length; i++) {
            let minInRow = Infinity;
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
                minInRow = Math.min(minInRow, matrix[i][j]);
            }
            // Early termination if this row exceeds max distance
            if (minInRow > maxDistance) {
                return maxDistance + 1;
            }
        }

        return matrix[str2.length][str1.length];
    };

    const calculateNameSimilarity = (name1: string, name2: string): number => {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
        const n1 = normalize(name1);
        const n2 = normalize(name2);

        if (!n1 || !n2) return 0;
        if (n1 === n2) return 1.0; // Exact match

        // Quick length check - if too different, skip expensive calculation
        const lengthDiff = Math.abs(n1.length - n2.length);
        const maxLen = Math.max(n1.length, n2.length);
        if (lengthDiff / maxLen > 0.5) return 0; // More than 50% length difference

        // Check if one contains the other (partial match)
        if (n1.includes(n2) || n2.includes(n1)) return 0.85;

        // Levenshtein distance with early termination
        const maxAllowedDistance = Math.ceil(maxLen * 0.25); // Allow 25% difference
        const distance = levenshteinDistance(n1, n2, maxAllowedDistance);

        if (distance > maxAllowedDistance) return 0;

        const similarity = 1 - (distance / maxLen);
        return similarity;
    };

    const analyzeConflicts = () => {
        const getCellValue = (idx: number, rowData: any) => {
            if (idx === -1) return '';
            const val = rowData[idx];
            return (val !== null && val !== undefined) ? String(val).trim() : '';
        };

        console.log('[Import Debug] Starting analyzeConflicts');

        const hasFullName = mappings.some(m => m && m.systemField === 'name');
        const hasSplitName = mappings.some(m => m && m.systemField === 'first_name') &&
            mappings.some(m => m && m.systemField === 'last_name');

        if (!hasFullName && !hasSplitName) {
            showToast('חובה למפות עמודת "שם מלא" או "שם פרטי" + "שם משפחה"', 'error');
            return;
        }

        const unknownTeams = new Set<string>();
        const unknownRoles = new Set<string>();
        const personConflicts: ResolutionItem[] = [];

        // Find ALL indices for each field
        const getIndices = (field: string) => mappings.reduce((acc, m, i) => (m && m.systemField === field ? [...acc, i] : acc), [] as number[]);

        const teamIndices = getIndices('team');
        const roleIndices = getIndices('role');
        const nameIndices = getIndices('name');
        const fNameIndices = getIndices('first_name');
        const lNameIndices = getIndices('last_name');
        const phoneIndices = getIndices('mobile');
        const emailIndices = getIndices('email');

        // Index existing people for fast lookups
        const phoneMap = new Map<string, Person>();
        const emailMap = new Map<string, Person>();
        const nameMap = new Map<string, Person>();

        people.forEach(p => {
            if (p.phone) phoneMap.set(p.phone.replace(/\D/g, ''), p);
            if (p.email) emailMap.set(p.email.trim().toLowerCase(), p);
            if (p.name) nameMap.set(p.name.trim().toLowerCase(), p);
        });

        parsedData.rows.forEach((row: any, rowIndex: number) => {
            const shouldLog = rowIndex < 20;

            // 1. Accumulate Roles & Teams
            teamIndices.forEach(idx => {
                const teamName = (row[idx] || '').toString().trim();
                if (teamName && !teams.some(t => t.name.trim().toLowerCase() === teamName.toLowerCase())) {
                    unknownTeams.add(teamName);
                }
            });

            roleIndices.forEach(idx => {
                const roleRaw = (row[idx] || '').toString().trim();
                const normalizeAggr = (s: string) => (s || '').trim().replace(/[\s\u00A0]+/g, '').replace(/["'״׳]/g, '').toLowerCase();

                if (roleRaw) {
                    const rawCandidates = roleRaw.split(/[,;]/).map((s: string) => s.trim());
                    rawCandidates.forEach((rn: string) => {
                        if (!rn || rn.length < 2) return;

                        // SAFEGUARD: Check if candidate role is actually a name
                        const nameVal = nameIndices.length > 0 ? getCellValue(nameIndices[0], row) : '';
                        const normInput = normalizeAggr(rn);
                        const normName = normalizeAggr(nameVal);

                        if (normName && (normInput === normName || normInput.includes(normName) || normName.includes(normInput))) {
                            if (shouldLog) console.log(`[Import Debug] 🔥 BLOCKED: Candidate role "${rn}" is a name at row ${rowIndex}`);
                            return;
                        }

                        const match = roles.find(r => normalizeAggr(r.name) === normInput);
                        if (!match) unknownRoles.add(rn);
                    });
                }
            });

            // 2. Person Duplicates
            let personName = '';
            if (nameIndices.length > 0) personName = getCellValue(nameIndices[0], row);
            else if (fNameIndices.length > 0 && lNameIndices.length > 0) {
                personName = `${getCellValue(fNameIndices[0], row)} ${getCellValue(lNameIndices[0], row)}`.trim();
            }

            if (!personName) return;

            const phone = phoneIndices.length > 0 ? getCellValue(phoneIndices[0], row).replace(/\D/g, '') : '';
            const email = emailIndices.length > 0 ? getCellValue(emailIndices[0], row).toLowerCase() : '';

            let match: Person | undefined;
            let reason = '';

            if (phone && phone.length >= 7) {
                match = phoneMap.get(phone);
                if (match) reason = 'טלפון זהה';
            }
            if (!match && email) {
                match = emailMap.get(email);
                if (match) reason = 'אימייל זהה';
            }
            if (!match && personName) {
                match = nameMap.get(personName.toLowerCase());
                if (match) reason = 'שם זהה';
            }

            if (match) {
                personConflicts.push({
                    originalName: personName,
                    type: 'person',
                    action: 'merge',
                    targetId: match.id,
                    matchReason: reason,
                    excelRowIndex: rowIndex
                });
            }
        });

        const newResolutions: ResolutionItem[] = [
            ...Array.from(unknownTeams).map(name => ({ originalName: name, type: 'team' as const, action: 'create' as const })),
            ...Array.from(unknownRoles).map(name => ({ originalName: name, type: 'role' as const, action: 'create' as const })),
            ...personConflicts
        ];

        if (newResolutions.length === 0) generatePreview([]);
        else {
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

        // --- OPTIMIZATION: Index resolutions by rowIndex ---
        const resolutionIdxMap = new Map<number, ResolutionItem>();
        const teamResMap = new Map<string, ResolutionItem>();
        const roleResMap = new Map<string, ResolutionItem>();

        currentResolutions.forEach(res => {
            if (res.type === 'person' && res.excelRowIndex !== undefined) {
                resolutionIdxMap.set(res.excelRowIndex, res);
            } else if (res.type === 'team') {
                teamResMap.set(res.originalName, res);
            } else if (res.type === 'role') {
                roleResMap.set(res.originalName, res);
            }

            if (res.action === 'create') {
                if (res.type === 'team') {
                    tempTeams.push({ id: `temp-team-${res.originalName}`, name: res.originalName, color: 'border-slate-500' });
                } else if (res.type === 'role') {
                    tempRoles.push({ id: `temp-role-${res.originalName}`, name: res.originalName, color: 'border-slate-500' });
                }
            }
        });

        // Optimization: Index temp resources for faster matching in the loop
        const teamNameMap = new Map(tempTeams.map(t => [t.name.trim().toLowerCase(), t.id]));
        const roleNameMap = new Map(tempRoles.map(r => [r.name.trim().toLowerCase(), r.id]));

        const newPeople: Person[] = parsedData.rows.map((row: any, idx) => {
            // Check Resolution first
            const resolution = resolutionIdxMap.get(idx);
            if (resolution && resolution.action === 'ignore') return null;

            const rowData: any = {};
            mappings.forEach((map, colIndex) => {
                if (map && map.systemField !== 'ignore') {
                    rowData[map.systemField] = row[colIndex];
                }
            });

            // Construct full name
            let fullName = '';
            mappings.forEach((m, colIdx) => {
                if (!m) return;
                if (m.systemField === 'name') fullName = row[colIdx];
                else if (m.systemField === 'first_name' && !fullName) {
                    const lNameMap = mappings.find(mm => mm && mm.systemField === 'last_name');
                    fullName = `${row[colIdx]} ${lNameMap ? row[mappings.indexOf(lNameMap)] : ''}`.trim();
                }
            });

            if (!fullName) return null;

            // Resolve Team
            let teamId = '';
            mappings.forEach((m, colIdx) => {
                if (m && m.systemField === 'team' && row[colIdx]) {
                    const rawTeam = row[colIdx].toString().trim();
                    const teamRes = teamResMap.get(rawTeam);
                    if (teamRes) {
                        if (teamRes.action === 'map' && teamRes.targetId) teamId = teamRes.targetId;
                        else if (teamRes.action === 'create') teamId = `temp-team-${rawTeam}`;
                    } else {
                        const match = tempTeams.find(t => t.name.trim().toLowerCase() === rawTeam.toLowerCase());
                        if (match) teamId = match.id;
                    }
                }
            });

            // Resolve Roles - ACCUMULATE FROM ALL MAPPED COLUMNS
            let roleIds: string[] = [];
            mappings.forEach((m, colIdx) => {
                if (m && m.systemField === 'role' && row[colIdx]) {
                    const rawRoles = row[colIdx].toString().split(/[,;]/).map((s: string) => s.trim());
                    rawRoles.forEach(rawRole => {
                        if (!rawRole) return;

                        // Check if this "role" is actually a name (double check during generate)
                        const normInput = rawRole.trim().toLowerCase().replace(/\s+/g, '');
                        const normName = fullName.trim().toLowerCase().replace(/\s+/g, '');
                        if (normName && (normInput === normName || normInput.includes(normName) || normName.includes(normInput))) return;

                        const roleRes = roleResMap.get(rawRole);
                        if (roleRes) {
                            if (roleRes.action === 'map' && roleRes.targetId) roleIds.push(roleRes.targetId);
                            else if (roleRes.action === 'create') roleIds.push(`temp-role-${rawRole}`);
                        } else {
                            const match = tempRoles.find(r => r.name.trim().toLowerCase() === rawRole.toLowerCase());
                            if (match) roleIds.push(match.id);
                        }
                    });
                }
            });
            roleIds = Array.from(new Set(roleIds)); // Unique IDs only

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
                    let cf = { ...(basePerson.customFields || {}) };

                    // Add mapped custom fields
                    mappings.forEach((map, colIndex) => {
                        if (map && (map.systemField === 'new_custom_field' || map.systemField.startsWith('cf_'))) {
                            const key = map.systemField === 'new_custom_field'
                                ? map.excelColumn.toLowerCase().replace(/\s+/g, '_').replace(/[^\u0590-\u05FFa-z0-9_]/g, '') || `field_${Date.now()}`
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
            if (map && map.systemField === 'new_custom_field') {
                // Use original Excel column name as label
                const label = map.excelColumn;

                // Generate key from label (handle Hebrew properly)
                let slug = label.toLowerCase()
                    .replace(/\s+/g, '_')                          // spaces to underscores
                    .replace(/[^\u0590-\u05FFa-z0-9_]/g, '');     // keep Hebrew, latin, numbers, underscores

                // If no valid chars (e.g., only symbols), use timestamp
                if (!slug || slug.length === 0) {
                    slug = `field_${Date.now()}`;
                }

                const key = slug; // e.g., "מא" or "מספר_אישי"

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
                        label,  // Use original Excel column name
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
                    const r = { id: newId, name: res.originalName, color: 'border-slate-500' };
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
        onClose();
    };

    if (!isOpen) return null;

    const modalTitle = (
        <div className="flex flex-col">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
                <FileSpreadsheet className="text-green-600" size={24} weight="bold" />
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
                            <FileSpreadsheet size={48} className="text-green-600" weight="bold" />
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
                                <AlertCircle size={20} weight="bold" />
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
                                <AlertTriangle size={20} weight="bold" />
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
                                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wide inline-block ${res.type === 'person' ? (
                                                            res.action === 'merge' && res.targetId ? 'bg-blue-100 text-blue-700' :
                                                                res.action === 'create' ? 'bg-green-100 text-green-700' :
                                                                    'bg-slate-100 text-slate-500'
                                                        ) :
                                                            res.type === 'team' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {res.type === 'person' ? (
                                                                res.action === 'merge' && res.targetId ? 'קיים במערכת' :
                                                                    res.action === 'create' ? 'חדש' :
                                                                        'חייל'
                                                            ) : (res.type === 'team' ? 'צוות חדש' : 'תפקיד חדש')}
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
                                                        {res.action === 'merge' && (() => {
                                                            // Sort people: new ones (from resolutions with action='create') first
                                                            const newPersonIds = new Set(
                                                                resolutions
                                                                    .filter(r => r.type === 'person' && r.action === 'create')
                                                                    .map(r => r.targetId)
                                                                    .filter(Boolean)
                                                            );

                                                            const sortedPeople = [...people].sort((a, b) => {
                                                                const aIsNew = newPersonIds.has(a.id);
                                                                const bIsNew = newPersonIds.has(b.id);
                                                                if (aIsNew && !bIsNew) return -1;
                                                                if (!aIsNew && bIsNew) return 1;
                                                                return a.name.localeCompare(b.name, 'he');
                                                            });

                                                            return (
                                                                <Select
                                                                    value={res.targetId || ''}
                                                                    onChange={(val) => handleResolutionChange(idx, { targetId: val })}
                                                                    options={sortedPeople.map(p => ({ value: p.id, label: p.name }))}
                                                                    className="w-full text-[11px] font-bold bg-white"
                                                                    placeholder="בחר חייל מהמערכת..."
                                                                    searchable={true}
                                                                />
                                                            );
                                                        })()}
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
                    <div className="space-y-4 animate-in zoom-in-95 duration-300">
                        {/* Warning Panel for Unmapped Fields */}
                        {(() => {
                            const unmappedFields = mappings.filter(m => m && m.systemField === 'new_custom_field');
                            const hasConflicts = resolutions.length > 0;

                            if (unmappedFields.length === 0 && !hasConflicts) return null;

                            return (
                                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl">
                                    <div className="flex items-start gap-3">
                                        <div className="bg-amber-100 p-1.5 rounded-lg shrink-0">
                                            <AlertTriangle size={20} weight="bold" className="text-amber-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-amber-900 mb-2">נדרשת תשומת לב</h4>
                                            {unmappedFields.length > 0 && (
                                                <div className="mb-2">
                                                    <p className="text-xs font-bold text-amber-800 mb-2">
                                                        שדות שלא זוהו אוטומטית ויוגדרו כשדות מותאמים אישית:
                                                    </p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {unmappedFields.map(m => (
                                                            <span key={m.excelColumn} className="inline-flex items-center gap-1 px-2 py-1 bg-white/60 border border-amber-200 rounded-lg text-xs font-black text-amber-700">
                                                                <Tag size={12} weight="bold" />
                                                                {m.excelColumn}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {hasConflicts && (
                                                <p className="text-xs font-bold text-amber-800">
                                                    {resolutions.filter(r => r.type === 'person').length} חיילים דורשים החלטה (מיזוג/יצירה חדשה)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

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
                                            {mappings.filter(m => m && m.systemField !== 'ignore').map(m => (
                                                <th key={m.excelColumn} className="p-3 px-4">
                                                    <div className="flex flex-col gap-0.5 items-center">
                                                        <span className="text-slate-700 font-black text-sm">{m.excelColumn}</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                            {getSystemFieldLabel(m.systemField)}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-600">
                                        {previewData.slice(0, 100).map((person, i) => {
                                            const isSelected = selectedIndices.has(i);
                                            const res = resolutions.find(r => r.type === 'person' && r.targetId === person.id);
                                            const isUpdate = !!res && res.action === 'merge';

                                            // Helper to get value for a specific mapping
                                            const getValueForMapping = (mapping: ColumnMapping, excelRow: any[]) => {
                                                const colIdx = mappings.indexOf(mapping);
                                                const { systemField } = mapping;

                                                // Direct field mappings
                                                if (systemField === 'name' || systemField === 'first_name' || systemField === 'last_name') return person.name;
                                                if (systemField === 'team') return person.teamId;
                                                if (systemField === 'role') return person.roleIds;
                                                if (systemField === 'email') return person.email;
                                                if (systemField === 'mobile') return person.phone;
                                                if (systemField === 'is_active') return person.isActive;

                                                // Custom fields
                                                if (systemField.startsWith('cf_') || systemField === 'new_custom_field') {
                                                    const key = systemField === 'new_custom_field'
                                                        ? mapping.excelColumn.toLowerCase().replace(/[^a-z0-9_]/g, '_')
                                                        : systemField.replace('cf_', '');
                                                    return person.customFields?.[key];
                                                }

                                                // Fallback to raw Excel data
                                                return excelRow[colIdx];
                                            };

                                            // Helper to render cell value
                                            const renderCellValue = (value: any, systemField: string) => {
                                                if (value === null || value === undefined || value === '') {
                                                    return <span className="text-slate-300 italic text-xs">-</span>;
                                                }

                                                // Team rendering
                                                if (systemField === 'team') {
                                                    const teamId = value as string;
                                                    const teamName = teamId.startsWith('temp-team-')
                                                        ? teamId.replace('temp-team-', '')
                                                        : teams.find(t => t.id === teamId)?.name || '-';
                                                    return (
                                                        <span className={`font-bold ${teamId.startsWith('temp-') ? 'text-indigo-600' : 'text-slate-700'}`}>
                                                            {teamName}
                                                        </span>
                                                    );
                                                }

                                                // Role rendering
                                                if (systemField === 'role') {
                                                    const roleIds = value as string[];
                                                    const roleNames = roleIds.map(id => {
                                                        if (id.startsWith('temp-role-')) return id.replace('temp-role-', '');
                                                        return roles.find(r => r.id === id)?.name;
                                                    }).filter(Boolean).join(', ');
                                                    return <span className="text-slate-600">{roleNames || '-'}</span>;
                                                }

                                                // Name rendering with merge indicator
                                                if (systemField === 'name' || systemField === 'first_name' || systemField === 'last_name') {
                                                    // Extract the appropriate part of the name
                                                    let displayValue = String(value);

                                                    if (systemField === 'first_name' && value === person.name) {
                                                        // If this is first_name column but we have full name, extract first part
                                                        displayValue = person.name.split(' ')[0] || person.name;
                                                    } else if (systemField === 'last_name' && value === person.name) {
                                                        // If this is last_name column but we have full name, extract last part
                                                        const parts = person.name.split(' ');
                                                        displayValue = parts.length > 1 ? parts.slice(1).join(' ') : '';
                                                    }

                                                    return (
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-800">{displayValue}</span>
                                                            {isUpdate && systemField === 'name' && <span className="text-[10px] text-slate-400 font-bold">מתמזג עם חייל קיים</span>}
                                                        </div>
                                                    );
                                                }

                                                // Boolean rendering
                                                if (systemField === 'is_active' || systemField === 'is_commander') {
                                                    return (
                                                        <span className={`text-xs font-bold ${value ? 'text-green-600' : 'text-red-500'}`}>
                                                            {value ? 'כן' : 'לא'}
                                                        </span>
                                                    );
                                                }

                                                // Default text rendering
                                                return <span className="text-slate-700 font-medium text-sm">{String(value)}</span>;
                                            };

                                            const excelRow = parsedData?.rows[i] || [];

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
                                                    {/* Dynamic cells matching the mapped columns */}
                                                    {mappings.filter(m => m && m.systemField !== 'ignore').map((m) => {
                                                        const value = getValueForMapping(m, excelRow);
                                                        return (
                                                            <td key={`${i}-${m.excelColumn}`} className="p-3 px-4">
                                                                {renderCellValue(value, m.systemField)}
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

            {/* Loading Overlay */}
            {isSaving && (
                <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex items-center justify-center rounded-2xl">
                    <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                        {/* Spinner */}
                        <div className="relative">
                            <div className="w-20 h-20 border-4 border-green-100 border-t-green-600 rounded-full animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <FileSpreadsheet size={32} className="text-green-600" weight="bold" />
                            </div>
                        </div>

                        {/* Message */}
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-black text-slate-800">מייבא נתונים...</h3>
                            <p className="text-sm text-slate-500 font-medium">אנא המתן, התהליך עשוי לקחת מספר שניות</p>
                        </div>
                    </div>
                </div>
            )}
        </GenericModal >
    );
};
