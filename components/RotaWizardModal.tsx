import React, { useState } from 'react';
import { Person, Team, TaskTemplate, OrganizationSettings, TeamRotation, SchedulingConstraint, DailyPresence } from '../types';
import { generateRoster, RosterGenerationResult } from '../utils/rotaGenerator';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Wand2, Calendar, AlertTriangle, CheckCircle, Save, X, Filter, ArrowLeft, Download, Sparkles, ArrowRight, Users, ChevronDown, Clock } from 'lucide-react';
import { Input } from './ui/Input';
import { MultiSelect, MultiSelectOption } from './ui/MultiSelect';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../services/supabaseClient';
import { mapShiftToDB } from '../services/supabaseClient';

interface RotaWizardModalProps {
    isOpen: boolean;
    onClose: () => void;
    people: Person[];
    teams: Team[];
    tasks: TaskTemplate[];
    settings: OrganizationSettings | null;
    teamRotations: TeamRotation[];
    constraints: SchedulingConstraint[];
    onSaveRoster?: (data: DailyPresence[]) => void;
}

export const RotaWizardModal: React.FC<RotaWizardModalProps> = ({
    isOpen, onClose, people, teams, tasks, settings, teamRotations, constraints, onSaveRoster
}) => {
    const { showToast } = useToast();
    // Default to Today -> One Month Ahead
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`; // Today
    });

    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1); // Exact same day next month
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    });

    const [generating, setGenerating] = useState(false);
    const [step, setStep] = useState<'config' | 'preview'>('config');
    const [result, setResult] = useState<RosterGenerationResult | null>(null);
    const [saving, setSaving] = useState(false);
    const [selectedPreviewDate, setSelectedPreviewDate] = useState<string | null>(null);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
    // Config State
    const [targetTeamIds, setTargetTeamIds] = useState<string[]>([]); // Empty = All (or handle explicit 'all')
    const [customMinStaff, setCustomMinStaff] = useState(() => Math.floor(people.length / 2) || 5);
    const [daysBase, setDaysBase] = useState(11);
    const [daysHome, setDaysHome] = useState(3);
    const [userArrivalHour, setUserArrivalHour] = useState('10:00'); // Default
    const [userDepartureHour, setUserDepartureHour] = useState('14:00'); // Default

    const handleTeamChange = (newTeamIds: string[]) => {
        setTargetTeamIds(newTeamIds);

        let relevantPeople = people;
        if (newTeamIds.length > 0) {
            relevantPeople = people.filter(p => newTeamIds.includes(p.teamId));
        }
        const suggested = Math.floor(relevantPeople.length / 2) || 2;
        setCustomMinStaff(suggested);
    };

    const handleGenerate = () => {
        console.log('--- Wizard: Starting Generation ---');
        console.log('Inputs:', {
            startDate, endDate,
            settings,
            tasksCount: tasks.length,
            peopleCount: people.length
        });

        if (!settings) {
            showToast('חסרות הגדרות ארגון (ימי סבב וכו\')', 'error');
            return;
        }
        if (tasks.length === 0) {
            showToast('לא הוגדרו משימות לשיבוץ', 'error');
            return;
        }

        setGenerating(true);
        try {
            console.log('Calling generateRoster...');

            // Filter people if specific teams are selected
            const effectivePeople = targetTeamIds.length === 0
                ? people
                : people.filter(p => targetTeamIds.includes(p.teamId));

            const res = generateRoster({
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                people: effectivePeople,
                teams,
                settings,
                teamRotations,
                constraints,
                customMinStaff,
                customRotation: { daysBase, daysHome }
            });
            console.log('Generation Result:', res);
            setResult(res);
            setStep('preview');
        } catch (e) {
            console.error('Wizard Error:', e);
            showToast('שגיאה בחישוב השיבוץ', 'error');
        } finally {
            setGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!result || result.roster.length === 0) return;
        setSaving(true);
        try {
            // Bulk insert into daily_presence
            // Algorithm doesn't generate Arrival/Departure statuses, only Base/Home
            // So we must Post-Process here to assign times based on inputs
            const payload: any[] = [];

            // Group by person to find edges
            const personMap = new Map<string, typeof result.roster>();
            result.roster.forEach(r => {
                if (!personMap.has(r.person_id)) personMap.set(r.person_id, []);
                personMap.get(r.person_id)?.push(r);
            });

            personMap.forEach((rosterItems) => {
                // Sort by date must be guaranteed
                rosterItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                rosterItems.forEach((r, idx) => {
                    let startTime = '00:00';
                    let endTime = '00:00';

                    if (r.status === 'base') {
                        // Check neighbors within the generated batch
                        const prev = rosterItems[idx - 1];
                        const next = rosterItems[idx + 1];

                        let isPrevBase = prev && prev.status === 'base';
                        let isNextBase = next && next.status === 'base';

                        // --- Boundary Handling: Look up history/future in existing data if not in batch ---
                        const person = people.find(p => p.id === r.person_id);
                        const currentDate = new Date(r.date);

                        if (!prev && person) {
                            // Start of batch: Check Previous Day in existing availability
                            const prevDate = new Date(currentDate);
                            prevDate.setDate(prevDate.getDate() - 1);
                            const prevKey = prevDate.toLocaleDateString('en-CA');
                            const prevAvail = person.dailyAvailability?.[prevKey];
                            if (prevAvail) {
                                // Map availability to status 'base' if available (or explicit status)
                                // If status exists (arrival/departure/base), use it. Converting 'arrival'/'departure' to 'base' for contiguity check.
                                // If plain 'isAvailable=true', treat as base.
                                const status = (prevAvail as any).status || (prevAvail.isAvailable ? 'base' : 'home');
                                if (status === 'base' || status === 'arrival' || status === 'departure') isPrevBase = true;
                            }
                        }

                        if (!next && person) {
                            // End of batch: Check Next Day in existing availability
                            const nextDate = new Date(currentDate);
                            nextDate.setDate(nextDate.getDate() + 1);
                            const nextKey = nextDate.toLocaleDateString('en-CA');
                            const nextAvail = person.dailyAvailability?.[nextKey];
                            if (nextAvail) {
                                const status = (nextAvail as any).status || (nextAvail.isAvailable ? 'base' : 'home');
                                if (status === 'base' || status === 'arrival' || status === 'departure') isNextBase = true;
                            }
                        }
                        // ---------------------------------------------------------------------------------

                        if (!isPrevBase && isNextBase) {
                            // Arrival
                            startTime = userArrivalHour;
                            endTime = '23:59';
                        } else if (isPrevBase && !isNextBase) {
                            // Departure
                            startTime = '00:00';
                            endTime = userDepartureHour;
                        } else if (!isPrevBase && !isNextBase) {
                            // Single Day (Arrival -> Departure)
                            startTime = userArrivalHour;
                            endTime = userDepartureHour;
                        } else {
                            // Full base
                            startTime = '00:00';
                            endTime = '23:59';
                        }
                    }

                    // Log times for debugging
                    // console.log(`Processing ${r.person_id} for ${r.date}: status=${r.status}, times=${startTime}-${endTime}`);

                    payload.push({
                        date: r.date,
                        person_id: r.person_id,
                        organization_id: r.organization_id,
                        status: r.status,
                        source: 'algorithm',
                        start_time: startTime, // NOW using correct variable
                        end_time: endTime     // NOW using correct variable
                    } as DailyPresence);
                });
            });

            // We might want to upsert? For now insert. 
            // Note: unique constraint might fail if re-running same day. upsert is safer.
            const { error } = await supabase.from('daily_presence').upsert(payload, { onConflict: 'date,person_id,organization_id' });

            if (error) throw error;

            if (onSaveRoster) onSaveRoster(result.roster);
            showToast(`נוצרו ${result.roster.length} רשומות נוכחות בהצלחה`, 'success');
            onClose();
        } catch (e) {
            console.error(e);
            showToast('שגיאה בשמירת הלוח', 'error');
        } finally {
            setSaving(false);
        }
    };

    const previewFooter = (
        <div className="flex flex-col-reverse gap-4 sm:flex-row sm:justify-between sm:items-center w-full">
            <Button variant="ghost" onClick={() => setStep('config')} icon={ArrowRight} className="w-full sm:w-auto justify-center sm:justify-start">חזור להגדרות</Button>
            <div className="flex gap-2 w-full sm:w-auto">
                <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none justify-center">ביטול</Button>
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    className="bg-green-600 text-white hover:bg-green-700 shadow-md flex-1 sm:flex-none justify-center"
                >
                    שמור וסיים
                </Button>
            </div>
        </div>
    );

    const handleExport = () => {
        if (!result) return;

        // 1. Headers
        const headers = ['שם', 'צוות'];
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dateKeys: string[] = [];

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toLocaleDateString('en-CA');
            dateKeys.push(dateKey);
            headers.push(d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }));
        }

        // 2. Rows
        const rows = people
            .filter(p => selectedTeamId === 'all' || String(p.teamId) === String(selectedTeamId))
            .map(p => {
                const teamName = teams.find(t => t.id === p.teamId)?.name || 'ללא';
                const rowData = [p.name, teamName];

                dateKeys.forEach((dateKey, idx) => {
                    const status = result.personStatuses?.[dateKey]?.[p.id];
                    let cellVal = 'בבסיס';
                    if (status === 'home') cellVal = 'בית';
                    else if (status === 'unavailable') cellVal = 'בית (אילוץ)';
                    else if (status === 'base') {
                        // Check neighbors for arrival/departure
                        // This logic mirrors the preview rendering
                        const prevKey = idx > 0 ? dateKeys[idx - 1] : null; // In-export neighbor
                        const nextKey = idx < dateKeys.length - 1 ? dateKeys[idx + 1] : null;

                        const prevStatus = prevKey ? result.personStatuses?.[prevKey]?.[p.id] : null; // (Simplified: only looking inside export range)
                        const nextStatus = nextKey ? result.personStatuses?.[nextKey]?.[p.id] : null;

                        // Logic: If prev was not base, it's arrival. If next is not base, it's departure.
                        // Note: This is an approximation for the CSV since we don't look outside the range.
                        const isPrevBase = prevStatus === 'base';
                        const isNextBase = nextStatus === 'base';

                        if (!isPrevBase && isNextBase) cellVal = `הגעה (${userArrivalHour})`;
                        else if (isPrevBase && !isNextBase) cellVal = `יציאה (${userDepartureHour})`;
                        else if (!isPrevBase && !isNextBase) cellVal = `יום בודד (${userArrivalHour}-${userDepartureHour})`;
                    }

                    rowData.push(cellVal);
                });
                return rowData;
            });

        // 3. Generate CSV Content
        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        // 4. Download
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `rota_export_${startDate}_${endDate}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        showToast('הקובץ ירד בהצלחה', 'success');
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="מחולל הסבבים האוטומטי"
            size={step === 'preview' ? '2xl' : 'lg'}
            scrollableContent={step === 'config'}
            footer={step === 'preview' ? previewFooter : undefined}
        >
            <div className={`flex flex-col h-full ${step === 'preview' ? 'h-[65vh] shrink min-h-0' : ''}`}>
                {step === 'config' ? (
                    <>


                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                            <Sparkles className="text-blue-600 shrink-0" size={20} />
                            <div className="text-sm text-blue-900 leading-tight">
                                <span className="font-bold">מחולל סבבים אוטומטי: </span>
                                המערכת תייצר לוח נוכחות אופטימלי בהתבסס על מחזורי יציאות, אילוצים אישיים ושמירה על סד״כ מינימלי בבסיס.
                            </div>
                        </div>

                        <div className="mt-4">
                            <MultiSelect
                                label="עבור צוותים"
                                value={targetTeamIds}
                                onChange={setTargetTeamIds}
                                options={teams.map(t => ({ value: t.id, label: t.name }))}
                                placeholder="כל הצוותים (כלל הארגון)"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3 mt-6">
                            <Input
                                type="date"
                                label="מתאריך"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                            />
                            <Input
                                type="date"
                                label="עד תאריך"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                            />
                        </div>

                        <div className="mt-4">
                            <Input
                                type="number"
                                label="מינימום חיילים בבסיס (סד״כ)"
                                min="0"
                                value={customMinStaff}
                                onChange={e => setCustomMinStaff(Number(e.target.value))}
                                icon={Users}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <Input
                                type="time"
                                label="שעת הגעה"
                                value={userArrivalHour}
                                onChange={(e) => setUserArrivalHour(e.target.value)}
                            />
                            <Input
                                type="time"
                                label="שעת יציאה"
                                value={userDepartureHour}
                                onChange={(e) => setUserDepartureHour(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            <Input
                                type="number"
                                label="ימי בסיס (סבב)"
                                min="1"
                                value={daysBase}
                                onChange={e => setDaysBase(Number(e.target.value))}
                            />
                            <Input
                                type="number"
                                label="ימי בית (סבב)"
                                min="1"
                                value={daysHome}
                                onChange={e => setDaysHome(Number(e.target.value))}
                            />
                        </div>

                        <div className="flex flex-col-reverse gap-3 pt-4 mt-auto sm:flex-row sm:justify-end">
                            <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto">ביטול</Button>
                            <Button
                                onClick={handleGenerate}
                                isLoading={generating}
                                icon={Sparkles}
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md hover:shadow-lg w-full sm:w-auto justify-center"
                            >
                                צור הצעה לשיבוץ
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Filters & Actions */}
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExport}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-200"
                                    title="ייצוא לאקסל"
                                >
                                    <Download size={20} />
                                </button>
                                <div className="h-6 w-px bg-slate-200 mx-2"></div>
                                <Filter size={16} className="text-slate-400" />
                                <select
                                    className="text-sm border-slate-200 rounded-lg py-1.5 pl-8 pr-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                >
                                    <option value="all">כל הצוותים</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-red-100 rounded border border-red-200"></div>
                                    <span>בית</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <div className="w-3 h-3 bg-green-100 rounded border border-green-200"></div>
                                    <span>בבסיס</span>
                                </div>
                            </div>
                        </div>

                        {/* Matrix View Wrapper - Flex 1 to take remaining space */}
                        <div className="flex-1 min-h-0 border rounded-xl bg-white shadow-sm overflow-hidden relative">
                            <style>{`
                                .force-scrolling {
                                    scrollbar-width: auto;
                                    scrollbar-color: #64748b #f1f5f9;
                                }
                                .force-scrolling::-webkit-scrollbar {
                                    width: 16px;
                                    height: 16px;
                                }
                                .force-scrolling::-webkit-scrollbar-track {
                                    background: #f1f5f9;
                                }
                                .force-scrolling::-webkit-scrollbar-thumb {
                                    background-color: #64748b;
                                    border: 4px solid transparent;
                                    background-clip: content-box;
                                    border-radius: 99px;
                                }
                                .force-scrolling::-webkit-scrollbar-thumb:hover {
                                    background-color: #475569;
                                }
                                .force-scrolling::-webkit-scrollbar-corner {
                                    background: transparent;
                                }
                            `}</style>
                            <div className="absolute inset-0 overflow-scroll force-scrolling" dir="rtl">
                                <div className="min-w-max">
                                    {/* Summary Header */}
                                    <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
                                        {/* Date Header Row */}
                                        <div className="flex h-10">
                                            <div className="w-48 shrink-0 p-2 font-bold bg-slate-50 border-l sticky right-0 z-40 flex items-center border-b border-slate-200">
                                                תאריך
                                            </div>
                                            <div className="flex">
                                                {(() => {
                                                    const start = new Date(startDate);
                                                    const end = new Date(endDate);
                                                    const headers = [];
                                                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                        const dateKey = d.toLocaleDateString('en-CA');
                                                        headers.push(
                                                            <div key={dateKey} className="shrink-0 w-24 p-2 text-center border-l border-slate-100 bg-slate-50">
                                                                <div className="text-xs font-bold text-slate-700">
                                                                    {d.toLocaleDateString('he-IL')}
                                                                </div>
                                                                <div className="text-[10px] text-slate-500">
                                                                    {d.toLocaleDateString('he-IL', { weekday: 'short' })}
                                                                </div>
                                                            </div>
                                                        );
                                                    }
                                                    // Summary Column Header
                                                    headers.push(
                                                        <div key="summary-header" className="shrink-0 w-24 p-2 text-center border-l border-slate-100 bg-slate-50 flex items-center justify-center">
                                                            <div className="text-xs font-bold text-slate-700">סיכום</div>
                                                        </div>
                                                    );
                                                    return headers;
                                                })()}
                                            </div>
                                        </div>

                                        {/* Total Assigned Row */}
                                        <div className="flex h-8 bg-indigo-50 border-b border-indigo-100">
                                            <div className="w-48 shrink-0 px-3 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 border-l border-indigo-200 sticky right-0 z-40 flex items-center shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]">
                                                סה״כ מאוישים
                                            </div>
                                            <div className="flex">
                                                {(() => {
                                                    const start = new Date(startDate);
                                                    const end = new Date(endDate);
                                                    const cells = [];
                                                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                        const dateKey = d.toLocaleDateString('en-CA');

                                                        // Calculate Total Present (Base)
                                                        // Anyone NOT 'home' and NOT 'unavailable'
                                                        // Respect targetTeamId filter
                                                        let relevantPeople = people;
                                                        if (targetTeamIds.length > 0) {
                                                            relevantPeople = people.filter(p => targetTeamIds.includes(p.teamId));
                                                        }

                                                        let presentCount = 0;
                                                        relevantPeople.forEach(p => {
                                                            const status = result?.personStatuses?.[dateKey]?.[p.id];
                                                            if (status !== 'home' && status !== 'unavailable') {
                                                                presentCount++;
                                                            }
                                                        });

                                                        // If single team selected, maybe use customMinStaff? 
                                                        // But really, "Total Possible" is relevantPeople.length.
                                                        // The user wants "Present / Total".

                                                        const minStaff = customMinStaff; // The threshold set in config
                                                        const isUnderstaffed = presentCount < minStaff;

                                                        cells.push(
                                                            <div key={`total-${dateKey}`} className={`shrink-0 w-24 flex items-center justify-center border-l border-indigo-100 text-xs font-bold ${isUnderstaffed ? 'text-amber-600 bg-amber-50' : 'text-indigo-600'}`}>
                                                                {relevantPeople.length} / {presentCount}
                                                            </div>
                                                        );
                                                    }
                                                    return cells;
                                                })()}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table Body */}
                                    <div>
                                        {people
                                            .filter(p => targetTeamIds.length === 0 || targetTeamIds.includes(p.teamId))
                                            .filter(p => selectedTeamId === 'all' || String(p.teamId) === String(selectedTeamId))
                                            .map((person, idx) => (
                                                <div key={person.id} className={`flex border-b border-slate-50 hover:bg-slate-50 transition-colors h-14 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                    {/* Sticky Name Column */}
                                                    <div className={`w-48 shrink-0 p-2 border-l sticky right-0 z-20 flex items-center gap-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                                        <div
                                                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-sm"
                                                            style={{ backgroundColor: teams.find(t => t.id === person.teamId)?.color || '#94a3b8' }}
                                                        >
                                                            {person.name.charAt(0)}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="text-sm font-bold text-slate-700 truncate">{person.name}</div>
                                                            <div className="text-[10px] text-slate-400 truncate">{teams.find(t => t.id === person.teamId)?.name || 'ללא צוות'}</div>
                                                        </div>
                                                    </div>

                                                    {/* Days Cells */}
                                                    <div className="flex">
                                                        {(() => {
                                                            const start = new Date(startDate);
                                                            const end = new Date(endDate);
                                                            const cells = [];
                                                            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                                const dateKey = d.toLocaleDateString('en-CA');
                                                                const status = result?.personStatuses?.[dateKey]?.[person.id];

                                                                // Look back for Departure definition: Current=Home && Prev=Base
                                                                const prevDate = new Date(d);
                                                                prevDate.setDate(prevDate.getDate() - 1);
                                                                const prevDateKey = prevDate.toLocaleDateString('en-CA');

                                                                const nextDate = new Date(d);
                                                                nextDate.setDate(nextDate.getDate() + 1);
                                                                const nextDateKey = nextDate.toLocaleDateString('en-CA');

                                                                // Helper to resolve status (Result > Existing DB)
                                                                const resolveStatus = (key: string) => {
                                                                    const resStatus = result?.personStatuses?.[key]?.[person.id];
                                                                    if (resStatus) return resStatus;
                                                                    const dbAvail = person.dailyAvailability?.[key];
                                                                    if (dbAvail) {
                                                                        if (dbAvail.status) return dbAvail.status;
                                                                        return dbAvail.isAvailable ? 'base' : 'home';
                                                                    }
                                                                    return undefined;
                                                                };

                                                                const prevStatus = resolveStatus(prevDateKey);
                                                                const nextStatus = resolveStatus(nextDateKey);

                                                                let content = null;
                                                                let cellClass = "bg-white";

                                                                if (status === 'home' || status === 'unavailable') {
                                                                    // Standard Home Day
                                                                    cellClass = "bg-red-100 text-red-800 border-l border-slate-100";
                                                                    const isConstraint = status === 'unavailable';
                                                                    content = (
                                                                        <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold leading-tight">
                                                                            <span>בית</span>
                                                                            {isConstraint && <span className="text-[8px] font-normal">(אילוץ)</span>}
                                                                        </div>
                                                                    );
                                                                } else if (status === 'base') {
                                                                    // Base Day - Check for edges
                                                                    const isArrival = prevStatus !== 'base';
                                                                    const isDeparture = nextStatus !== 'base';

                                                                    if (isArrival && isDeparture) {
                                                                        // Single Day
                                                                        cellClass = "bg-green-100 text-green-800 border-l border-slate-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                <span className="font-bold">יום בודד</span>
                                                                                <span className="text-[9px] mt-0.5">{userArrivalHour}-{userDepartureHour}</span>
                                                                            </div>
                                                                        );
                                                                    } else if (isArrival) {
                                                                        cellClass = "bg-emerald-50 text-emerald-800 border-l border-emerald-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                <span className="font-bold mb-0.5">הגעה</span>
                                                                                <span className="text-[9px]">{userArrivalHour}</span>
                                                                            </div>
                                                                        );
                                                                    } else if (isDeparture) {
                                                                        cellClass = "bg-amber-50 text-amber-900 border-l border-amber-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                <span className="font-bold mb-0.5">יציאה</span>
                                                                                <span className="text-[9px]">{userDepartureHour}</span>
                                                                            </div>
                                                                        );
                                                                    } else {
                                                                        // Full Base
                                                                        cellClass = "bg-green-100 text-green-800 border-l border-slate-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold">
                                                                                בבסיס
                                                                            </div>
                                                                        );
                                                                    }
                                                                }

                                                                cells.push(
                                                                    <div key={`${person.id}-${dateKey}`} className={`w-24 shrink-0 p-1 border-l border-slate-100 h-12 flex items-center justify-center transition-colors ${cellClass}`}>
                                                                        {content}
                                                                    </div>
                                                                );
                                                            }

                                                            // Calculate Summary for this person
                                                            let homeCount = 0;
                                                            let baseCount = 0;
                                                            const startD = new Date(startDate);
                                                            const endD = new Date(endDate);
                                                            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                                                                const k = d.toLocaleDateString('en-CA');
                                                                const status = result?.personStatuses?.[k]?.[person.id];
                                                                let resolved = status;
                                                                if (!resolved) {
                                                                    const dbAvail = person.dailyAvailability?.[k];
                                                                    if (dbAvail) resolved = dbAvail.isAvailable ? 'base' : 'home';
                                                                    else resolved = 'base';
                                                                }
                                                                if (resolved === 'home' || resolved === 'unavailable') homeCount++;
                                                                else baseCount++;
                                                            }

                                                            cells.push(
                                                                <div key="summary-cell" className="shrink-0 w-24 border-l border-slate-100 p-2 flex flex-col items-center justify-center bg-slate-50/50">
                                                                    <div className="text-[10px] font-bold text-slate-600">
                                                                        בסיס: <span className="text-green-600 text-xs">{baseCount}</span>
                                                                    </div>
                                                                    <div className="text-[10px] font-bold text-slate-600">
                                                                        בית: <span className="text-orange-600 text-xs">{homeCount}</span>
                                                                    </div>
                                                                </div>
                                                            );

                                                            return cells;
                                                        })()}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};
