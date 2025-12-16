import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertCircle, Plus, ArrowUpRight } from 'lucide-react';
import { Person, Team, Role } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Select } from './ui/Select';
import { Button } from './ui/Button';

interface ExcelImportWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (people: Person[]) => void;
    teams: Team[];
    roles: Role[];
    onAddTeam: (t: Team) => void;
    onAddRole: (r: Role) => void;
}

type Step = 'upload' | 'mapping' | 'resolution' | 'preview';

interface ColumnMapping {
    excelColumn: string;
    systemField: 'name' | 'first_name' | 'last_name' | 'team' | 'role' | 'phone' | 'email' | 'ignore';
}

interface ParsedData {
    headers: string[];
    rows: any[];
}

interface ResolutionItem {
    originalName: string;
    type: 'team' | 'role';
    action: 'create' | 'map' | 'ignore';
    targetId?: string; // If mapping, which ID to use
}

export const ExcelImportWizard: React.FC<ExcelImportWizardProps> = ({
    isOpen,
    onClose,
    onImport,
    teams,
    roles,
    onAddTeam,
    onAddRole
}) => {
    const { showToast } = useToast();
    const [step, setStep] = useState<Step>('upload');
    const [parsedData, setParsedData] = useState<ParsedData | null>(null);
    const [mappings, setMappings] = useState<ColumnMapping[]>([]);
    const [previewData, setPreviewData] = useState<Person[]>([]);
    const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const systemFields = [
        { value: 'name', label: 'שם מלא' },
        { value: 'first_name', label: 'שם פרטי' },
        { value: 'last_name', label: 'שם משפחה' },
        { value: 'team', label: 'צוות' },
        { value: 'role', label: 'תפקיד' },
        { value: 'email', label: 'אימייל' },
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
                    else if (h.includes('טלפון') || h.includes('נייד')) field = 'phone';
                    else if (h.includes('מייל') || h.includes('דוא')) field = 'email';

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

        // Find relevant columns
        const teamColIdx = mappings.findIndex(m => m.systemField === 'team');
        const roleColIdx = mappings.findIndex(m => m.systemField === 'role');

        parsedData.rows.forEach((row: any) => {
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
        });

        if (unknownTeams.size === 0 && unknownRoles.size === 0) {
            generatePreview([]); // No conflicts
        } else {
            // Initialize resolutions
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
                }))
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
                const resolution = currentResolutions.find(r => r.type === 'team' && r.originalName === rawTeam);

                if (resolution) {
                    if (resolution.action === 'map' && resolution.targetId) teamId = resolution.targetId;
                    else if (resolution.action === 'create') teamId = `temp-team-${rawTeam}`;
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
                    const resolution = currentResolutions.find(r => r.type === 'role' && r.originalName === rawRole);
                    if (resolution) {
                        if (resolution.action === 'map' && resolution.targetId) return resolution.targetId;
                        else if (resolution.action === 'create') return `temp-role-${rawRole}`;
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

            return {
                id: `imported-${Date.now()}-${idx}`,
                name: fullName,
                teamId: teamId,
                roleIds: roleIds,
                email: rowData.email || '',
                maxHoursPerWeek: 40,
                unavailableDates: [],
                preferences: { preferNight: false, avoidWeekends: false },
                color: color
            };
        }).filter(Boolean) as Person[];

        setPreviewData(newPeople);
        setStep('preview');
    };

    const handleFinalImport = () => {
        // 1. Create real items for conflicts marked as 'create'
        const resolutionMap = new Map<string, string>(); // entries: 'type-name' -> 'real-id'

        resolutions.forEach(res => {
            if (res.action === 'create') {
                const newId = `${res.type}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
                if (res.type === 'team') {
                    onAddTeam({ id: newId, name: res.originalName, color: 'border-slate-500' });
                } else {
                    onAddRole({ id: newId, name: res.originalName, color: 'bg-slate-200' });
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
                    finalTeamId = ''; // Should be mapped already or ignored, but fallback
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

        onImport(finalPeople);
        onClose();

        // Cleanup
        setStep('upload');
        setParsedData(null);
        setMappings([]);
        setResolutions([]);
        setPreviewData([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <FileSpreadsheet className="text-green-600" />
                            אשף ייבוא מאקסל
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            {step === 'upload' && 'שלב 1/4: העלאת קובץ'}
                            {step === 'mapping' && 'שלב 2/4: מיפוי עמודות'}
                            {step === 'resolution' && 'שלב 3/4: פתרון התנגשויות'}
                            {step === 'preview' && 'שלב 4/4: בדיקה ואישור'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 text-right" dir="rtl">

                    {step === 'upload' && (
                        <div className="flex flex-col items-center justify-center h-full py-10 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
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
                            <p className="text-slate-500 text-sm">תומך בקבצי .xlsx, .xls, .csv</p>
                        </div>
                    )}

                    {step === 'mapping' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 p-4 rounded-lg flex gap-3 text-blue-800 text-sm">
                                <AlertCircle size={20} className="flex-shrink-0" />
                                <p>המערכת זיהתה את העמודות הבאות. אנא התאם כל עמודה באקסל לשדה המתאים במערכת.</p>
                            </div>

                            {/* Header Row */}
                            <div className="flex items-center gap-4 px-4 text-xs font-bold text-slate-400">
                                <div className="w-1/3 flex items-center gap-1">
                                    <FileSpreadsheet size={14} />
                                    עמודה באקסל (מקור)
                                </div>
                                <div className="w-8"></div>
                                <div className="flex-1">שדה במערכת (יעד)</div>
                            </div>

                            <div className="grid gap-3">
                                {mappings.map((mapping, idx) => (
                                    <div key={idx} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-md transition-shadow">

                                        {/* Excel Source (Right side in RTL) */}
                                        <div className="w-1/3 flex items-center gap-2 overflow-hidden bg-slate-50 px-3 py-2 rounded-md border border-slate-200 group">
                                            <FileSpreadsheet size={16} className="text-green-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                                            <div className="font-bold text-slate-700 truncate" title={mapping.excelColumn}>
                                                {mapping.excelColumn}
                                            </div>
                                        </div>

                                        {/* Arrow (Pointing Left in RTL) */}
                                        <ArrowLeft size={20} className="text-slate-300" />

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
                        <div className="space-y-6">
                            <div className="bg-yellow-50 p-4 rounded-lg flex gap-3 text-yellow-800 text-sm">
                                <AlertCircle size={20} className="flex-shrink-0" />
                                <p>נמצאו נתונים בקובץ שלא קיימים במערכת. אנא בחר כיצד לטפל בהם.</p>
                            </div>

                            {resolutions.map((res, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className={`text-xs px-2 py-1 rounded ${res.type === 'team' ? 'bg-indigo-100 text-indigo-700' : 'bg-purple-100 text-purple-700'} font-bold`}>
                                                {res.type === 'team' ? 'צוות לא מוכר' : 'תפקיד לא מוכר'}
                                            </span>
                                            <h3 className="font-bold text-slate-800 mt-2 text-lg">{res.originalName}</h3>
                                        </div>
                                    </div>

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
                                </div>
                            ))}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div>
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
                                if (step === 'preview') setStep(resolutions.length > 0 ? 'resolution' : 'mapping');
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
                            className="bg-green-600 hover:bg-green-700 text-white border-transparent"
                        >
                            הוסף {previewData.length} חיילים <Check size={16} />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};
