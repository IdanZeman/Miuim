import React, { useState, useRef } from 'react';
import ExcelJS from 'exceljs';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { Person, V2State, V2SubState } from '@/types';
import { FileArrowUp, CheckCircle, XCircle, Users, Warning, ArrowRight, MagnifyingGlass, UserCircleGear, Calendar } from '@phosphor-icons/react';
import { logger } from '@/services/loggingService';
import { useToast } from '@/contexts/ToastContext';
import { cn } from '@/lib/utils';
import { attendanceService } from '@/services/attendanceService';
import { useAuth } from '@/features/auth/AuthContext';

interface ExcelV2ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    people: Person[];
}

interface ExcelRowData {
    excelName: string;
    matchedPersonId: string | null;
    attendance: Record<string, {
        v2_state: V2State;
        v2_sub_state: V2SubState;
        start_time: string;
        end_time: string;
        home_status_type?: import('@/types').HomeStatusType;
        raw_val?: string;
    }>;
    team?: string;
    rowKey: string;
}

export const ExcelV2ImportModal: React.FC<ExcelV2ImportModalProps> = ({ isOpen, onClose, people }) => {
    const { showToast } = useToast();
    const { profile } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [step, setStep] = useState<'upload' | 'match' | 'preview'>('upload');
    const [importData, setImportData] = useState<ExcelRowData[]>([]);
    const [datesFound, setDatesFound] = useState<string[]>([]);
    const [manualMapping, setManualMapping] = useState<Record<string, string>>({}); // excelName -> personId

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

    const mapStatusToV2 = (val: string): { v2_state: V2State; v2_sub_state: V2SubState; start_time: string; end_time: string; home_status_type?: import('@/types').HomeStatusType } | null => {
        const v = val.trim().toLowerCase();

        // 1. Home Statuses (Specific)
        if (v.includes('חופשה בשמפ') || v.includes('חופש בשמפ') || v === 'חופש') {
            return { v2_state: 'home', v2_sub_state: 'vacation', start_time: '00:00', end_time: '00:00', home_status_type: 'leave_shamp' };
        }
        if (v.includes('גימל') || v === 'ג' || v === "ג'") {
            return { v2_state: 'home', v2_sub_state: 'gimel', start_time: '00:00', end_time: '00:00', home_status_type: 'gimel' };
        }
        if (v.includes('נפקד')) {
            return { v2_state: 'home', v2_sub_state: 'absent', start_time: '00:00', end_time: '00:00', home_status_type: 'absent' };
        }
        if (v.includes('התארגנות')) {
            return { v2_state: 'home', v2_sub_state: 'org_days', start_time: '00:00', end_time: '00:00', home_status_type: 'organization_days' };
        }
        if (v.includes('לא בשמ"פ') || v.includes('לא בשמפ')) {
            return { v2_state: 'home', v2_sub_state: 'not_in_shamp', start_time: '00:00', end_time: '00:00', home_status_type: 'not_in_shamp' };
        }

        // Generic Home / Vacation
        if (v.includes('בית') || v.includes('אלת') || v.includes('שמפ') || v.includes('בקשה') || v === 'x') {
            return { v2_state: 'home', v2_sub_state: 'vacation', start_time: '00:00', end_time: '00:00', home_status_type: 'leave_shamp' };
        }

        // 2. Base / Present
        if (v.includes('בסיס') || v.includes('נמצא') || v === 'v' || v === 'נוכח' || v === '✓' || v.includes('v')) {
            return { v2_state: 'base', v2_sub_state: 'full_day', start_time: '00:00', end_time: '23:59' };
        }

        // Arrival
        if (v.includes('הגעה') || v.includes('מגיע')) {
            return { v2_state: 'base', v2_sub_state: 'arrival', start_time: '12:00', end_time: '23:59' };
        }

        // Departure
        if (v.includes('יציאה') || v.includes('יוצא')) {
            return { v2_state: 'base', v2_sub_state: 'departure', start_time: '00:00', end_time: '12:00' };
        }

        return null;
    };

    const getCellValue = (cell: ExcelJS.Cell): string => {
        if (cell.value === null || cell.value === undefined) return "";
        if (typeof cell.value === 'object') {
            if ('richText' in cell.value) {
                return (cell.value as any).richText.map((rt: any) => rt.text).join("");
            }
            if (cell.type === ExcelJS.ValueType.Date) {
                return (cell.value as Date).toLocaleDateString('en-CA');
            }
            if (typeof cell.value === 'object' && cell.value !== null) {
                // Handle result objects from formulas
                const valObj = cell.value as any;
                if ('result' in valObj) return valObj.result?.toString() || "";
                if ('text' in valObj) return valObj.text?.toString() || "";
            }
            return String(cell.value);
        }
        return cell.value.toString();
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

            let sheetIndex = 0;
            let totalNamesFoundCount = 0;
            const dateRegex = /(\d{1,4})[\.\/\-](\d{1,4})/;

            workbook.eachSheet((worksheet) => {
                const sheetColToDate: Record<number, string> = {};

                // 1. Identify best header row (most dates)
                let bestHeaderRow = -1;
                let maxDatesCount = 0;

                for (let r = 1; r <= Math.min(200, worksheet.rowCount); r++) {
                    const row = worksheet.getRow(r);
                    let datesCount = 0;
                    row.eachCell({ includeEmpty: false }, (cell) => {
                        const val = getCellValue(cell).trim();
                        if (dateRegex.test(val) || cell.type === ExcelJS.ValueType.Date) datesCount++;
                    });
                    if (datesCount > maxDatesCount) {
                        maxDatesCount = datesCount;
                        bestHeaderRow = r;
                    }
                }

                if (bestHeaderRow === -1) bestHeaderRow = 1;

                // 2. Map dates for this row
                const dRow = worksheet.getRow(bestHeaderRow);
                dRow.eachCell({ includeEmpty: false }, (cell, colNum) => {
                    let date: Date | null = null;
                    const val = getCellValue(cell).trim();
                    if (cell.type === ExcelJS.ValueType.Date) {
                        date = cell.value as Date;
                    } else {
                        const match = val.match(dateRegex);
                        if (match) {
                            const p1 = Number(match[1]);
                            const p2 = Number(match[2]);
                            const year = new Date().getFullYear();
                            if (p1 > 1900) date = new Date(p1, p2 - 1, 1);
                            else date = new Date(year, p2 - 1, p1);
                        }
                    }
                    if (date && !isNaN(date.getTime())) {
                        const dateKey = date.toLocaleDateString('en-CA');
                        sheetColToDate[colNum] = dateKey;
                        allDatesSet.add(dateKey);
                    }
                });

                // 3. Columns mapping (Strict as per user request)
                const nameCol = 1;
                const teamCol = 2;

                console.log(`[ImportV2] Sheet "${worksheet.name}": HeaderRow=${bestHeaderRow}, DatesFound=${Object.keys(sheetColToDate).length}`);

                // 4. Extraction
                worksheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
                    if (rowNum <= bestHeaderRow) return;

                    const rawName = getCellValue(row.getCell(nameCol)).trim();
                    const rawTeam = getCellValue(row.getCell(teamCol)).trim();

                    if (!rawName || rawName.length < 2) return;

                    // Skip headers if repeated in data
                    const skipKeywords = ['סך הכל', 'פלוגה', 'שם מלא', 'שם הלוחם', 'סה"כ', 'מפקד', 'חתימה'];
                    if (skipKeywords.some(k => rawName.includes(k))) return;

                    const nameNormalized = cleanName(rawName);
                    const teamNormalized = cleanName(rawTeam || '');

                    // IMPORTANT: Composite key to prevent merging different soldiers with same name in different teams
                    const compositeKey = `${nameNormalized}_${teamNormalized}`;

                    if (!aggregatedData[compositeKey]) {
                        aggregatedData[compositeKey] = {
                            excelName: rawName,
                            matchedPersonId: findMatch(rawName),
                            attendance: {},
                            team: rawTeam,
                            rowKey: compositeKey
                        };
                        totalNamesFoundCount++;
                    }

                    Object.entries(sheetColToDate).forEach(([colStr, dateKey]) => {
                        const colNum = parseInt(colStr);
                        const cell = row.getCell(colNum);
                        const val = getCellValue(cell).trim();
                        if (val) {
                            const mapped = mapStatusToV2(val);
                            if (mapped) {
                                aggregatedData[compositeKey].attendance[dateKey] = { ...mapped, raw_val: val };
                            }
                        }
                    });
                });
                sheetIndex++;
            });
            console.log(`[ImportV2] Final Count: ${totalNamesFoundCount} unique names found.`);

            const rows = Object.values(aggregatedData);
            const dates = Array.from(allDatesSet).sort();

            setDatesFound(dates);
            setImportData(rows);
            setStep('match');

            logger.info('IMPORT_DATA', `Parsed V2 Excel with ${rows.length} rows and ${dates.length} dates.`);
        } catch (error) {
            console.error("Excel parse error:", error);
            showToast('שגיאה בקריאת הקובץ. וודא שהקובץ בפורמט תקין.', 'error');
        } finally {
            setIsParsing(false);
        }
    };

    const handleApply = async () => {
        if (!profile?.organization_id) {
            console.error('[ImportV2] No organization_id found in profile');
            return;
        }

        setIsSaving(true);
        const updates: any[] = [];

        console.log(`[ImportV2] Starting Apply. ImportData Rows: ${importData.length}`);

        importData.forEach((row, idx) => {
            const personId = manualMapping[row.rowKey] || row.matchedPersonId;
            if (!personId) {
                console.warn(`[ImportV2] Row ${idx} (${row.excelName}, ${row.team}) skipped: No personId matched`);
                return;
            }

            const attendanceEntries = Object.entries(row.attendance);
            console.log(`[ImportV2] Row ${idx} (${row.excelName}): Found ${attendanceEntries.length} attendance dates to update.`);

            attendanceEntries.forEach(([dateKey, data]) => {
                updates.push({
                    person_id: personId,
                    date: dateKey,
                    organization_id: profile.organization_id,
                    status: data.v2_state === 'home' ? 'home' : 'base',
                    v2_state: data.v2_state,
                    v2_sub_state: data.v2_sub_state,
                    home_status_type: data.home_status_type,
                    start_time: data.start_time,
                    end_time: data.end_time,
                    source: 'manual',
                    updated_at: new Date().toISOString()
                });
            });
        });

        console.log(`[ImportV2] Finalizing ${updates.length} updates for system...`);

        try {
            if (updates.length > 0) {
                // STEP 1: Save all records to DB
                await attendanceService.upsertDailyPresence(updates);

                // STEP 2: Log each update to audit_logs table
                updates.forEach(update => {
                    const person = people.find(p => p.id === update.person_id);
                    logger.logUpdate(
                        'attendance',
                        update.person_id,
                        person?.name || 'Unknown',
                        null, // oldData - we don't have it
                        {
                            date: update.date,
                            v2_state: update.v2_state,
                            v2_sub_state: update.v2_sub_state,
                            start_time: update.start_time,
                            end_time: update.end_time,
                            home_status_type: update.home_status_type,
                            source: 'excel_import'
                        }
                    );
                });

                console.log(`[ImportV2] Successfully saved ${updates.length} records.`);
                showToast(`עודכנו ${updates.length} רשומות נוכחות`, 'success');
            } else {
                showToast('לא נמצאו רשומות לעדכון', 'warning');
            }
            onClose();
        } catch (error) {
            console.error(`[ImportV2] SAVE ERROR:`, error);
            logger.error('SAVE', 'Failed to save imported attendance', error);
            showToast('שגיאה בשמירת הנתונים', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const unmatchedCount = importData.filter(r => !r.matchedPersonId && !manualMapping[r.excelName]).length;

    const getStatusStyles = (v2_state: V2State, v2_sub_state: V2SubState) => {
        if (v2_state === 'base') {
            if (v2_sub_state === 'arrival') return 'bg-amber-100 text-amber-600 border-amber-200';
            if (v2_sub_state === 'departure') return 'bg-blue-100 text-blue-600 border-blue-200';
            return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        }
        if (v2_state === 'home') {
            if (v2_sub_state === 'gimel') return 'bg-purple-100 text-purple-600 border-purple-200';
            return 'bg-idf-pink text-red-600 border-idf-pink-border'; // Use system pink for vacation
        }
        return 'bg-slate-50 text-slate-300 border-slate-100';
    };

    const getStatusLabel = (v2_state: V2State, v2_sub_state: V2SubState, home_status_type?: string) => {
        if (v2_state === 'base') {
            if (v2_sub_state === 'arrival') return 'הגעה';
            if (v2_sub_state === 'departure') return 'יציאה';
            return 'בסיס';
        }
        if (v2_state === 'home') {
            if (home_status_type === 'leave_shamp' || v2_sub_state === 'vacation') return 'חופשה שמ"פ';
            if (home_status_type === 'gimel' || v2_sub_state === 'gimel') return 'גימלים';
            if (home_status_type === 'absent' || v2_sub_state === 'absent') return 'נפקד';
            if (home_status_type === 'organization_days' || v2_sub_state === 'org_days') return 'התארגנות';
            return 'חופש';
        }
        return '-';
    };

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex flex-col gap-0.5">
                    <h3 className="text-xl font-black text-slate-800">ייבוא נוכחות V2</h3>
                    <p className="text-xs text-slate-500 font-bold">טעינת קובץ והתאמה למנוע החדש</p>
                </div>
            }
            size={step === 'upload' ? 'sm' : 'xl'}
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="flex-1" disabled={isSaving}>ביטול</Button>
                    {step === 'match' && (
                        <Button
                            className="flex-1 bg-blue-600 text-white"
                            onClick={() => setStep('preview')}
                            disabled={unmatchedCount > 0}
                        >
                            {unmatchedCount > 0 ? `נותרו ${unmatchedCount} שמות ללא התאמה` : 'המשך לתצוגה מקדימה'}
                        </Button>
                    )}
                    {step === 'preview' && (
                        <Button
                            className="flex-1 bg-emerald-600 text-white flex items-center justify-center gap-2"
                            onClick={handleApply}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    שומר נתונים...
                                </>
                            ) : (
                                'אישור והחלה במערכת'
                            )}
                        </Button>
                    )}
                </div>
            }
        >
            <div className="py-2">
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".xlsx"
                            className="hidden"
                        />
                        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                            <FileArrowUp size={32} weight="bold" />
                        </div>
                        <h4 className="font-black text-slate-800 mb-1">לחץ להעלאת קובץ אקסל</h4>
                        <p className="text-sm text-slate-500">Row 1: תאריכים, Col A/B: שמות</p>
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
                                אנא וודא שכל השמות הותאמו נכון לחיילים במערכת.
                            </div>
                        </div>

                        <div className="max-h-[400px] overflow-y-auto pr-2 flex flex-col gap-2">
                            {importData.map((row, idx) => {
                                const matchedId = manualMapping[row.rowKey] || row.matchedPersonId;
                                const matchedPerson = people.find(p => p.id === matchedId);

                                return (
                                    <div key={idx} className={cn(
                                        "p-3 rounded-xl border flex items-center justify-between transition-all",
                                        matchedId ? "bg-white border-slate-200" : "bg-red-50 border-red-100"
                                    )}>
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">שם באקסל</span>
                                                    {row.team && (
                                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                                                            צוות: {row.team}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="font-bold text-slate-700">{row.excelName}</span>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-300" />
                                            <div className="flex flex-col">
                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">חייל במערכת</span>
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

                                        <select
                                            className="h-9 px-3 bg-slate-100 border-none rounded-lg text-xs font-bold focus:ring-2 focus:ring-blue-500"
                                            value={matchedId || ""}
                                            onChange={(e) => setManualMapping(prev => ({ ...prev, [row.rowKey]: e.target.value }))}
                                        >
                                            <option value="">בחר לוחם...</option>
                                            {people.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {step === 'preview' && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3">
                            <Calendar size={20} className="text-emerald-500 shrink-0 mt-0.5" weight="bold" />
                            <div className="text-sm text-emerald-900 leading-relaxed">
                                <strong>תצוגה מקדימה של השינויים:</strong><br />
                                כך ייראו השינויים ביומן הנוכחות לאחר האישור.
                            </div>
                        </div>

                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm h-[500px] flex flex-col">
                            <div className="overflow-auto flex-1 isolate">
                                <table className="w-full text-right text-xs border-separate border-spacing-0 min-w-max">
                                    <thead className="sticky top-0 z-40">
                                        <tr className="bg-slate-50">
                                            <th className="p-4 font-black text-slate-700 border-b border-l border-slate-200 sticky right-0 top-0 bg-slate-50 z-50 min-w-[140px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                                                שם הלוחם
                                            </th>
                                            {datesFound.map(d => {
                                                const dateObj = new Date(d);
                                                const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;
                                                return (
                                                    <th key={d} className={cn(
                                                        "p-3 font-black border-b border-l border-slate-200 min-w-[65px] text-center z-10",
                                                        isWeekend ? "bg-slate-100 text-slate-600" : "bg-slate-50 text-slate-500"
                                                    )}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[10px] opacity-70">
                                                                {dateObj.toLocaleDateString('he-IL', { weekday: 'short' })}
                                                            </span>
                                                            <span className="text-sm">
                                                                {dateObj.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importData.map((row, idx) => {
                                            const personId = manualMapping[row.rowKey] || row.matchedPersonId;
                                            const person = people.find(p => p.id === personId);
                                            if (!person) return null;

                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/80 group transition-colors">
                                                    <td className="p-3 font-bold text-slate-700 border-b border-l border-slate-100 sticky right-0 bg-white group-hover:bg-slate-50 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                                        {person.name}
                                                    </td>
                                                    {datesFound.map(d => {
                                                        const data = row.attendance[d];
                                                        const dateObj = new Date(d);
                                                        const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;

                                                        if (!data) return (
                                                            <td key={d} className={cn(
                                                                "p-2 border-b border-l border-slate-100 text-center text-slate-200",
                                                                isWeekend && "bg-slate-50/30"
                                                            )}>
                                                                -
                                                            </td>
                                                        );

                                                        return (
                                                            <td key={d} className={cn(
                                                                "p-1.5 border-b border-l border-slate-100 text-center",
                                                                isWeekend && "bg-slate-50/30"
                                                            )}>
                                                                <div className={cn(
                                                                    "h-9 min-w-[55px] rounded-xl border flex flex-col items-center justify-center font-black text-[10px] transition-all shadow-sm",
                                                                    getStatusStyles(data.v2_state, data.v2_sub_state)
                                                                )}>
                                                                    {getStatusLabel(data.v2_state, data.v2_sub_state, data.home_status_type)}
                                                                </div>
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
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
