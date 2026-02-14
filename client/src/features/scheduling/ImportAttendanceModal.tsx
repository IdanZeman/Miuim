import React, { useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { Person } from '@/types';
import { FileArrowUp, CheckCircle, XCircle, Users, Warning, ArrowRight, MagnifyingGlass, UserCircleGear } from '@phosphor-icons/react';
import { logger } from '@/services/loggingService';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';

interface ImportAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    people: Person[];
    onUpdatePeople: (people: Person[]) => void;
}

interface ExcelRowData {
    excelName: string;
    matchedPersonId: string | null;
    attendance: Record<string, boolean | string>; // dateKey -> isAvailable (or raw value if unknown)
}

export const ImportAttendanceModal: React.FC<ImportAttendanceModalProps> = ({ isOpen, onClose, people, onUpdatePeople }) => {
    const { showToast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [step, setStep] = useState<'upload' | 'map_values' | 'match' | 'preview'>('upload');
    const [importData, setImportData] = useState<ExcelRowData[]>([]);
    const [datesFound, setDatesFound] = useState<string[]>([]);
    const [manualMapping, setManualMapping] = useState<Record<string, string>>({}); // excelName -> personId
    const [unknownValues, setUnknownValues] = useState<string[]>([]);
    const [valueMappings, setValueMappings] = useState<Record<string, boolean | 'ignore'>>({}); // rawValue -> mappedBoolean

    const cleanName = (name: string) => {
        if (!name) return "";
        return name.replace(/[\s\t\n\r]/g, '').trim();
    };

    const findMatch = (excelName: string) => {
        const cleanedExcel = cleanName(excelName);
        if (!cleanedExcel) return null;

        // Try exact match (cleaned)
        const exact = people.find(p => cleanName(p.name) === cleanedExcel);
        if (exact) return exact.id;

        // Try partial match
        const partial = people.find(p =>
            cleanName(p.name).includes(cleanedExcel) ||
            cleanedExcel.includes(cleanName(p.name))
        );
        if (partial) return partial.id;

        // Try match by last part of name if it's "First Last"
        const parts = excelName.trim().split(/\s+/);
        if (parts.length > 1) {
            const lastPart = cleanName(parts[parts.length - 1]);
            const firstPart = cleanName(parts[0]);
            const match = people.find(p =>
                (cleanName(p.name).includes(lastPart) && cleanName(p.name).includes(firstPart))
            );
            if (match) return match.id;
        }

        return null;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            const aggregatedData: Record<string, ExcelRowData> = {};
            const allDatesSet = new Set<string>();

            workbook.eachSheet((worksheet) => {
                let dateRowIndex = -1;
                let startColIndex = -1;
                const colToDateKey: Record<number, string> = {};

                // 1. Detect Header/Date Row
                worksheet.eachRow((row, rowNum) => {
                    if (rowNum > 10 || dateRowIndex !== -1) return; // Check first 10 rows

                    row.eachCell((cell, colNum) => {
                        if (dateRowIndex !== -1) return;

                        // Check if it's a date object
                        if (cell.type === ExcelJS.ValueType.Date) {
                            dateRowIndex = rowNum;
                            startColIndex = colNum;
                            return;
                        }

                        // Check if it's a date string
                        const val = cell.value?.toString() || "";
                        if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(val.trim())) {
                            dateRowIndex = rowNum;
                            startColIndex = colNum;
                        }
                    });
                });

                if (dateRowIndex === -1) return;

                // 2. Map Columns to Dates
                const dateRow = worksheet.getRow(dateRowIndex);
                dateRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
                    if (colNum >= startColIndex) {
                        let date: Date | null = null;
                        if (cell.type === ExcelJS.ValueType.Date) {
                            date = cell.value as Date;
                        } else {
                            const str = cell.value?.toString();
                            if (str) {
                                const parts = str.split('/');
                                if (parts.length === 3) {
                                    const [d, m, y] = parts.map(Number);
                                    date = new Date(y < 100 ? 2000 + y : y, m - 1, d);
                                }
                            }
                        }

                        if (date && !isNaN(date.getTime())) {
                            const dateKey = date.toLocaleDateString('en-CA');
                            colToDateKey[colNum] = dateKey;
                            allDatesSet.add(dateKey);
                        }
                    }
                });

                // 3. Extract Soldier Data
                worksheet.eachRow((row, rowNum) => {
                    if (rowNum <= dateRowIndex) return;

                    // Get First Name (Col 1) and Last Name (Col 2)
                    const firstName = row.getCell(1).value?.toString()?.trim() || "";
                    const lastName = row.getCell(2).value?.toString()?.trim() || "";

                    // Specific check for labels we want to skip
                    if (!firstName || firstName.includes('סך') || firstName.includes('שם') || (firstName.length < 2 && !lastName)) return;

                    const excelName = `${firstName} ${lastName}`.trim();
                    const nameKey = cleanName(excelName);

                    if (!nameKey) return;

                    if (!aggregatedData[nameKey]) {
                        aggregatedData[nameKey] = {
                            excelName,
                            matchedPersonId: findMatch(excelName),
                            attendance: {}
                        };
                    }

                    // Scan columns for V / X or background color
                    Object.keys(colToDateKey).forEach((colStr) => {
                        const colNum = parseInt(colStr);
                        const dateKey = colToDateKey[colNum];
                        const cell = row.getCell(colNum);
                        const rawVal = cell.value?.toString()?.trim() || "";
                        const valUpper = rawVal.toUpperCase();

                        const presentKeywords = ['V', '✓', 'נוכח', 'בבסיס', 'כן', 'PRESENT']; // typo protection
                        const absentKeywords = ['X', '✗', 'בית', 'בבית', 'חופשה', 'גימלים', "ג'", 'נפקד', 'לא', 'לא נוכח'];

                        const isPresent = presentKeywords.some(k => valUpper.includes(k.toUpperCase()) || rawVal.includes(k));
                        const isAbsent = absentKeywords.some(k => valUpper.includes(k.toUpperCase()) || rawVal.includes(k)) || (rawVal === "" && cell.fill);

                        if (isPresent) {
                            aggregatedData[nameKey].attendance[dateKey] = true;
                        } else if (isAbsent) {
                            aggregatedData[nameKey].attendance[dateKey] = false;
                        } else if (rawVal && rawVal.length > 0) {
                            // Collect unknown values
                            aggregatedData[nameKey].attendance[dateKey] = rawVal;
                        }
                    });
                });
            });

            const rows = Object.values(aggregatedData);
            const dates = Array.from(allDatesSet).sort();

            // Find all unique unknown values
            const unknownSet = new Set<string>();
            rows.forEach(r => {
                Object.values(r.attendance).forEach(val => {
                    if (typeof val === 'string') unknownSet.add(val);
                });
            });

            setDatesFound(dates);
            setImportData(rows);

            if (unknownSet.size > 0) {
                setUnknownValues(Array.from(unknownSet));
                setStep('map_values');
            } else {
                setStep('match');
            }

            logger.info('IMPORT_DATA', `Parsed Excel with ${rows.length} unique names and ${dates.length} total dates across all tabs. Unknown values: ${unknownSet.size}`);
        } catch (error) {
            console.error("Excel parse error:", error);
            showToast('שגיאה בקריאת הקובץ. וודא שהקובץ בפורמט תקין.', 'error');
        } finally {
            setIsParsing(false);
        }
    };

    const handleApply = () => {
        const updates: Person[] = [];

        importData.forEach(row => {
            const personId = manualMapping[row.excelName] || row.matchedPersonId;
            if (!personId) return;

            const person = people.find(p => p.id === personId);
            if (!person) return;

            const updatedPerson = { ...person };
            updatedPerson.dailyAvailability = { ...person.dailyAvailability };

            Object.entries(row.attendance).forEach(([dateKey, value]) => {
                let isAvailable: boolean;

                if (typeof value === 'boolean') {
                    isAvailable = value;
                } else {
                    const mapped = valueMappings[value];
                    if (mapped === 'ignore' || mapped === undefined) return;
                    isAvailable = mapped;
                }

                updatedPerson.dailyAvailability[dateKey] = {
                    isAvailable,
                    status: isAvailable ? 'base' : 'home',
                    startHour: isAvailable ? '00:00' : '00:00',
                    endHour: isAvailable ? '23:59' : '00:00',
                    source: 'manual'
                };
            });

            updates.push(updatedPerson);
        });

        onUpdatePeople(updates);
        showToast(`עודכנו ${updates.length} לוחמים`, 'success');
        onClose();
    };

    const unmatchedCount = importData.filter(r => !r.matchedPersonId && !manualMapping[r.excelName]).length;

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-xl font-black text-slate-800">ייבוא נוכחות מאקסל</h3>
                    <p className="text-xs text-slate-500 font-bold">טעינת קובץ והתאמת שמות אוטומטית</p>
                </div>
            }
            size={step === 'upload' ? 'sm' : 'lg'}
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="flex-1">ביטול</Button>
                    {step === 'map_values' && (
                        <Button
                            className="flex-1 bg-blue-600 text-white"
                            onClick={() => setStep('match')}
                            disabled={unknownValues.some(v => valueMappings[v] === undefined)}
                        >
                            המשך להתאמת שמות
                        </Button>
                    )}
                    {step === 'match' && (
                        <Button
                            className="flex-1 bg-blue-600 text-white"
                            onClick={() => setStep('preview')}
                            disabled={unmatchedCount > 0}
                        >
                            {unmatchedCount > 0 ? `נותרו ${unmatchedCount} שמות ללא התאמה` : 'המשך לסקירה'}
                        </Button>
                    )}
                    {step === 'preview' && (
                        <Button className="flex-1 bg-emerald-600 text-white" onClick={handleApply}>
                            אישור והחלה במערכת
                        </Button>
                    )}
                </div>
            }
        >
            <div className="py-2">
                {step === 'map_values' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                            <UserCircleGear size={20} className="text-blue-500 shrink-0 mt-0.5" weight="bold" />
                            <div className="text-sm text-blue-900 leading-relaxed">
                                <strong>מצאנו ערכים לא מוכרים באקסל.</strong><br />
                                אנא הגדר עבור כל ערך אם הוא מסמל "נוכח" (בבסיס) או "לא נוכח" (בבית). ערכים שתבחר להתעלם מהם לא יטענו.
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            {unknownValues.map((val) => (
                                <div key={val} className="p-4 bg-white border border-slate-200 rounded-2xl flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ערך באקסל</span>
                                        <span className="text-lg font-black text-slate-800">{val}</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setValueMappings(prev => ({ ...prev, [val]: true }))}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-black transition-all border",
                                                valueMappings[val] === true ? "bg-emerald-500 text-white border-emerald-600 shadow-lg shadow-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-white"
                                            )}
                                        >
                                            נוכח (V)
                                        </button>
                                        <button
                                            onClick={() => setValueMappings(prev => ({ ...prev, [val]: false }))}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-black transition-all border",
                                                valueMappings[val] === false ? "bg-red-500 text-white border-red-600 shadow-lg shadow-red-100" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-white"
                                            )}
                                        >
                                            בית (X)
                                        </button>
                                        <button
                                            onClick={() => setValueMappings(prev => ({ ...prev, [val]: 'ignore' }))}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-black transition-all border",
                                                valueMappings[val] === 'ignore' ? "bg-slate-800 text-white border-slate-900" : "bg-slate-50 text-slate-500 border-slate-100 hover:bg-white"
                                            )}
                                        >
                                            התעלם
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xlsx, .csv"
                            className="hidden"
                        />
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <FileArrowUp size={32} weight="bold" />
                        </div>
                        <h4 className="font-black text-slate-800 mb-1">לחץ להעלאת קובץ</h4>
                        <p className="text-sm text-slate-500">תומך ב-Excel (.xlsx) בלבד</p>
                        {isParsing && (
                            <div className="mt-6 flex items-center gap-2 text-blue-600 font-bold animate-pulse">
                                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                מעבד נתונים...
                            </div>
                        )}
                    </div>
                )}

                {step === 'match' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                            <Warning size={20} className="text-amber-500 shrink-0 mt-0.5" weight="bold" />
                            <div className="text-sm text-amber-900 leading-relaxed">
                                <strong>זיהינו {importData.length} לוחמים באקסל.</strong><br />
                                שמות שלא זוהו אוטומטית יש לסמן ידנית כדי שנוכל לחבר אותם למסד הנתונים.
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto pr-2 flex flex-col gap-2">
                            {[...importData]
                                .sort((a, b) => {
                                    const aMatched = !!(manualMapping[a.excelName] || a.matchedPersonId);
                                    const bMatched = !!(manualMapping[b.excelName] || b.matchedPersonId);
                                    if (!aMatched && bMatched) return -1;
                                    if (aMatched && !bMatched) return 1;
                                    return a.excelName.localeCompare(b.excelName);
                                })
                                .map((row, idx) => {
                                    const matchedId = manualMapping[row.excelName] || row.matchedPersonId;
                                    const matchedPerson = people.find(p => p.id === matchedId);

                                    return (
                                        <div key={idx} className={cn(
                                            "p-3 rounded-xl border flex items-center justify-between transition-all",
                                            matchedId ? "bg-white border-slate-200" : "bg-red-50 border-red-100"
                                        )}>
                                            <div className="flex items-center gap-3">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">שם באקסל</span>
                                                    <span className="font-bold text-slate-700">{row.excelName}</span>
                                                </div>
                                                <ArrowRight size={16} className="text-slate-300" />
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">התאמה למערכת</span>
                                                    {matchedPerson ? (
                                                        <div className="flex items-center gap-1.5 text-blue-600 font-black">
                                                            <CheckCircle size={14} weight="fill" />
                                                            {matchedPerson.name}
                                                        </div>
                                                    ) : (
                                                        <span className="text-red-500 font-black">לא נמצאה התאמה</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <select
                                                    className="h-9 px-3 bg-slate-100 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                                                    value={matchedId || ""}
                                                    onChange={(e) => setManualMapping(prev => ({ ...prev, [row.excelName]: e.target.value }))}
                                                >
                                                    <option value="">בחר לוחם...</option>
                                                    {people
                                                        .sort((a, b) => a.name.localeCompare(b.name))
                                                        .map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                            <CheckCircle size={20} className="text-emerald-500 shrink-0 mt-0.5" weight="bold" />
                            <div className="text-sm text-emerald-900 leading-relaxed">
                                <strong>הכל מוכן!</strong> נמצאו נתוני נוכחות עבור {datesFound.length} ימים.
                                לחיצה על אישור תעדכן את הסטטוסים במערכת.
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-auto border border-slate-100 rounded-2xl">
                            <table className="w-full text-right text-xs border-collapse min-w-max">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3 font-black text-slate-500 border-b sticky right-0 bg-slate-50 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">לוחם</th>
                                        {datesFound.map(d => (
                                            <th key={d} className="p-3 font-black text-slate-500 border-b border-r border-slate-100 min-w-[60px] text-center">
                                                {d.split('-').slice(1).reverse().join('/')}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {importData.map((row, idx) => {
                                        const personId = manualMapping[row.excelName] || row.matchedPersonId;
                                        const person = people.find(p => p.id === personId);
                                        if (!person) return null;

                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="p-3 font-bold border-b border-slate-50 sticky right-0 bg-white shadow-[2px_0_5px_rgba(0,0,0,0.02)]">{person.name}</td>
                                                {datesFound.map(d => {
                                                    const val = row.attendance[d];
                                                    let isAvailable: boolean | null = null;
                                                    let rawLabel: string | null = null;

                                                    if (typeof val === 'boolean') {
                                                        isAvailable = val;
                                                    } else if (typeof val === 'string') {
                                                        const mapped = valueMappings[val];
                                                        if (mapped === true || mapped === false) {
                                                            isAvailable = mapped;
                                                        } else {
                                                            rawLabel = val;
                                                        }
                                                    }

                                                    return (
                                                        <td key={d} className="p-3 border-b border-r border-slate-50">
                                                            {isAvailable === true ? (
                                                                <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-md flex items-center justify-center mx-auto font-black">V</div>
                                                            ) : isAvailable === false ? (
                                                                <div className="w-6 h-6 bg-red-100 text-red-600 rounded-md flex items-center justify-center mx-auto font-black">X</div>
                                                            ) : rawLabel ? (
                                                                <div className="px-2 py-1 bg-slate-100 text-slate-400 rounded-md flex items-center justify-center mx-auto font-bold text-[8px] whitespace-nowrap overflow-hidden">{rawLabel}</div>
                                                            ) : (
                                                                <div className="w-6 h-6 bg-slate-50 text-slate-300 rounded-md flex items-center justify-center mx-auto">-</div>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </GenericModal>
    );
}; 
