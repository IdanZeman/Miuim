import React, { useState } from 'react';
import { Person, Team, TaskTemplate, OrganizationSettings, TeamRotation, SchedulingConstraint, DailyPresence, Absence } from '../types';
import { generateRoster, RosterGenerationResult, PersonHistory } from '../utils/rotaGenerator';
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
    absences: Absence[];
    onSaveRoster?: (data: DailyPresence[]) => void;
}

export const RotaWizardModal: React.FC<RotaWizardModalProps> = ({
    isOpen, onClose, people, teams, tasks, settings, teamRotations, constraints, absences, onSaveRoster
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

    // NEW: Save Warning State
    const [warningModal, setWarningModal] = useState<{ isOpen: boolean; title: string; issues: string[] }>({ isOpen: false, title: '', issues: [] });

    // NEW: Manual Overrides
    const [optimizationMode, setOptimizationMode] = useState<'ratio' | 'min_staff' | 'tasks'>('ratio');
    const [manualOverrides, setManualOverrides] = useState<Record<string, { status: string; startTime?: string; endTime?: string }>>({});
    const [editingCell, setEditingCell] = useState<{ personId: string; date: string; position: { top: number; left: number } } | null>(null);

    // Temp state for custom hours in popup
    const [customStart, setCustomStart] = useState('08:00');
    const [customEnd, setCustomEnd] = useState('17:00');
    const [showCustomHours, setShowCustomHours] = useState(false);

    const handleCellClick = (e: React.MouseEvent, personId: string, date: string) => {
        e.stopPropagation(); // Prevent modal close or other clicks
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();

        // Smart Positioning
        let top = rect.bottom + 5;
        let left = rect.left;

        // Check overflow
        if (top + 250 > window.innerHeight) top = rect.top - 250; // Flip up
        if (left + 200 > window.innerWidth) left = window.innerWidth - 210; // Shift left

        setEditingCell({
            personId,
            date,
            position: { top, left }
        });
        setShowCustomHours(false); // Reset view
    };

    const applyOverride = (status: string, customTimes?: { start: string, end: string }) => {
        if (!editingCell) return;
        const key = `${editingCell.personId}-${editingCell.date}`;

        let override = { status, startTime: '00:00', endTime: '23:59' };

        if (status === 'base') {
            // Full day base
            override.startTime = '00:00';
            override.endTime = '23:59';
        } else if (status === 'home' || status === 'unavailable') {
            override.startTime = '00:00';
            override.endTime = '00:00';
        } else if (status === 'custom' && customTimes) {
            override.status = 'base'; // DB status is base
            override.startTime = customTimes.start;
            override.endTime = customTimes.end;
        }

        setManualOverrides(prev => ({
            ...prev,
            [key]: override
        }));
        setEditingCell(null);
    };

    // Helper to normalize ratio for display (Hoisted)
    const getArmyRatio = (base: number, home: number): string => {
        if (home < 0.1) return "מלא";
        if (base < 0.1) return "יומיות";

        // Check for common ratios (Sum ~ 14)
        const total = base + home;

        // Try to normalize to 14 days cycle
        const factor14 = 14 / total;
        const b14 = Math.round(base * factor14);
        const h14 = Math.round(home * factor14);

        // If error is small, return normalized 14-day ratio
        const err14 = Math.abs((b14 / h14) - (base / home));
        if (err14 < 0.5) { // Threshold for "close enough"
            return `${b14} - ${h14}`;
        }

        // Try normalize to 7 days? ("5-9", "Week-Week")
        const factor7 = 7 / total;
        const b7 = Math.round(base * factor7);
        const h7 = Math.round(home * factor7);
        if (Math.abs((b7 / h7) - (base / home)) < 0.5) {
            return `${b7} - ${h7}`;
        }

        // Try normalize to 21 days? ("17-4")
        const factor21 = 21 / total;
        const b21 = Math.round(base * factor21);
        const h21 = Math.round(home * factor21);
        if (Math.abs((b21 / h21) - (base / home)) < 0.5) {
            return `${b21} - ${h21}`;
        }

        // Fallback: Just Round(Base) - Round(Home) 
        return `${Math.round(base)} - ${Math.round(home)}`;
    };

    const validateRosterBeforeSave = () => {
        const issues: string[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dateRange: string[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateRange.push(d.toLocaleDateString('en-CA'));
        }

        const relevantPeople = targetTeamIds.length === 0 ? people : people.filter(p => targetTeamIds.includes(p.teamId));

        // Helper: Get Effective Status
        const getEffectiveStatus = (pid: string, dateKey: string) => {
            const override = manualOverrides[`${pid}-${dateKey}`];
            if (override) return override.status;
            // Fallback to result or Availability
            const resStatus = result?.personStatuses?.[dateKey]?.[pid];
            if (resStatus) return resStatus;
            return 'base'; // Default
        };

        // 1. Min Staff Check (Relevant ONLY for 'min_staff' mode where input is visible)
        if (customMinStaff > 0 && optimizationMode === 'min_staff') {
            let minStaffViolations = 0;
            dateRange.forEach(dateKey => {
                let dailyStaff = 0;
                relevantPeople.forEach(p => {
                    const s = getEffectiveStatus(p.id, dateKey);
                    if (s === 'base' || s === 'arrival' || s === 'departure') dailyStaff++;
                });

                if (dailyStaff < customMinStaff) {
                    minStaffViolations++;
                    // Cap detailed listing to avoid spam
                    if (minStaffViolations <= 5) {
                        // Format date for display
                        const dispDate = new Date(dateKey).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                        issues.push(`בתאריך ${dispDate}: ${dailyStaff} חיילים (המינימום: ${customMinStaff})`);
                    }
                }
            });
            if (minStaffViolations > 5) {
                issues.push(`...ועוד ${minStaffViolations - 5} ימים עם חריגת סד״כ`);
            }
        }

        // 2. Ratio Check (Relevant for 'ratio' mode mostly, but user asked to see "If ratio changed")
        // If mode is Ratio, strict check. If others, maybe informative? User said "according to rules defined per tab".
        if (optimizationMode === 'ratio') {
            relevantPeople.forEach(p => {
                let baseCount = 0;
                let homeCount = 0;

                dateRange.forEach((dateKey, idx) => {
                    const status = getEffectiveStatus(p.id, dateKey);
                    if (status === 'home' || status === 'unavailable') {
                        homeCount++;
                    } else {
                        // Check for departure (Tomorrow is home/unavailable)
                        const nextKey = idx < dateRange.length - 1 ? dateRange[idx + 1] : null;
                        const nextStatus = nextKey ? getEffectiveStatus(p.id, nextKey) : 'base';
                        if (nextStatus !== 'base' && nextStatus !== 'arrival') {
                            homeCount++; // Departure counts as home in our logic?
                            // Wait, existing logic in previewFooter uses: if (isDeparture) homeCount++;
                            // Let's mirror that logic.
                            // isDeparture = nextStatus !== 'base'
                            // Logic in footer: 
                            // if current==base: if next!=base => Departure => HomeCount++ else BaseCount++
                            // Let's stick to this.
                        } else {
                            baseCount++;
                        }
                    }
                });

                const currentRatio = getArmyRatio(baseCount, homeCount);
                const targetRatio = `${daysBase} - ${daysHome}`;

                // Only flag if different AND manual overrides affected this person? 
                // Or just if different period (which might happen due to algorithm imperfections too)?
                // User said "show if 10-4 became 11-3... due to manual changes".
                // Let's filter to people who have at least one manual override OR were affected.
                // Actually, simple diff is safer.

                // Normalization check: getArmyRatio handles standardizing.
                if (currentRatio !== targetRatio) {
                    // Check if this person actually has an override?
                    const hasOverride = dateRange.some(d => manualOverrides[`${p.id}-${d}`]);
                    if (hasOverride) {
                        issues.push(`${p.name}: יחס היציאות השתנה ל-${currentRatio} (הוגדר: ${targetRatio})`);
                    }
                }
            });
        }

        // 3. Check for manual overrides (always relevant)
        const overrideCount = Object.keys(manualOverrides).length;
        if (overrideCount > 0) {
            issues.push(`בוצעו ${overrideCount} שינויים ידניים בלוח`);
        }

        return issues;
    };

    const handleTeamChange = (newTeamIds: string[]) => {
        setTargetTeamIds(newTeamIds);

        let relevantPeople = people;
        if (newTeamIds.length > 0) {
            relevantPeople = people.filter(p => newTeamIds.includes(p.teamId));
        }
        const suggested = Math.floor(relevantPeople.length / 2) || 2;
        setCustomMinStaff(suggested);
    };

    const handleGenerate = async () => {
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
            // 1. Fetch History to ensure per-user context
            const history = new Map<string, PersonHistory>();
            const startD = new Date(startDate);
            const lookback = new Date(startD);
            lookback.setDate(lookback.getDate() - 45); // Check 45 days back

            const { data: histData } = await supabase
                .from('daily_presence')
                .select('person_id, date, status')
                .eq('organization_id', settings.organization_id)
                .gte('date', lookback.toISOString())
                .lt('date', startDate)
                .order('date', { ascending: true });

            if (histData && histData.length > 0) {
                const byPerson: Record<string, any[]> = {};
                histData.forEach(r => {
                    if (!byPerson[r.person_id]) byPerson[r.person_id] = [];
                    byPerson[r.person_id].push(r);
                });

                Object.keys(byPerson).forEach(pid => {
                    const rows = byPerson[pid];
                    const lastRow = rows[rows.length - 1];
                    const lastDate = new Date(lastRow.date);
                    const daysDiff = (startD.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);

                    // If last record is recent (gap <= 3 days), use it to seed
                    if (daysDiff <= 3) {
                        let targetStatus = lastRow.status;
                        // Normalise
                        const norm = (s: string) => {
                            if (s === 'arrival') return 'base';
                            if (s === 'departure') return 'home';
                            if (s === 'unavailable') return 'home';
                            return s;
                        };
                        targetStatus = norm(targetStatus);

                        let count = 0;
                        for (let i = rows.length - 1; i >= 0; i--) {
                            const s = norm(rows[i].status);
                            if (s === targetStatus) count++;
                            else break;
                        }

                        if (targetStatus === 'base' || targetStatus === 'home') {
                            history.set(pid, {
                                lastStatus: targetStatus as 'base' | 'home',
                                consecutiveDays: count
                            });
                        }
                    }
                });
            }

            console.log('Calling generateRoster with history sizes:', history.size);

            const effectivePeople = targetTeamIds.length === 0
                ? people
                : people.filter(p => targetTeamIds.includes(p.teamId));

            const res = generateRoster({
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                people: effectivePeople,
                teams,
                settings: { ...settings, optimizationMode }, // Pass mode
                teamRotations,
                constraints,
                absences,
                customMinStaff: optimizationMode === 'min_staff' ? customMinStaff : 0, // Only enforce floor in 'min_staff' mode
                customRotation: { daysBase, daysHome },
                history
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

        const issues = validateRosterBeforeSave();

        if (issues.length > 0) {
            setWarningModal({
                isOpen: true,
                title: 'נמצאו חריגות בלוח השיבוץ',
                issues
            });
            return;
        }

        performSave();
    };

    const performSave = async () => {
        setSaving(true);
        setWarningModal(prev => ({ ...prev, isOpen: false })); // Close warning
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

                    // CHECK MANUAL OVERRIDE FIRST
                    const overrideKey = `${r.person_id}-${r.date}`;
                    const override = manualOverrides[overrideKey];

                    if (override) {
                        r.status = override.status as any; // Mutate for this scope or use local var? Mutating roster item safely as we are processing to payload
                        // Mapping for logic below (Base/Home)
                        // But wait, if override is 'arrival', we need to handle that.
                        // The logic below relies on 'status === base' to calculate times.
                        // Better to fully handle overrides here.

                        if (override.status === 'base') {
                            startTime = '00:00';
                            endTime = '23:59';
                            if (override.startTime) startTime = override.startTime;
                            if (override.endTime) endTime = override.endTime;
                        } else if (override.status === 'home' || override.status === 'unavailable') {
                            startTime = '00:00';
                            endTime = '00:00';
                        } else if (override.status === 'arrival') {
                            r.status = 'base'; // Treat as base for DB, time makes it arrival
                            startTime = override.startTime || userArrivalHour;
                            endTime = '23:59';
                        } else if (override.status === 'departure') {
                            r.status = 'base'; // Treat as base for DB, time makes it departure
                            startTime = '00:00';
                            endTime = override.endTime || userDepartureHour;
                        }
                    }

                    if (r.status === 'base' && !override) { // Only run auto-logic if NO override
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
                                if (prevAvail.status === 'base' || prevAvail.status === 'arrival' || prevAvail.status === 'departure' || prevAvail.isAvailable) {
                                    isPrevBase = true;
                                }
                            }
                        }

                        if (!next && person) {
                            // End of batch: Check Next Day in existing availability
                            const nextDate = new Date(currentDate);
                            nextDate.setDate(nextDate.getDate() + 1);
                            const nextKey = nextDate.toLocaleDateString('en-CA');
                            const nextAvail = person.dailyAvailability?.[nextKey];
                            if (nextAvail) {
                                if (nextAvail.status === 'base' || nextAvail.status === 'arrival' || nextAvail.status === 'departure' || nextAvail.isAvailable) {
                                    isNextBase = true;
                                }
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
                        organization_id: settings.organization_id,
                        status: r.status === 'base' ? 'base' : (r.status === 'unavailable' ? 'unavailable' : 'home'),
                        source: override ? 'override' : 'algorithm',
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
            showToast('השיבוץ נשמר בהצלחה', 'success');
            onClose();
        } catch (e) {
            console.error(e);
            showToast('שגיאה בשמירת הלוח', 'error');
        } finally {
            setSaving(false);
        }
    };

    const rosterStats = React.useMemo(() => {
        if (!result) return { avgBase: "0.0", avgHome: "0.0" };

        const relevantPeople = people
            .filter(p => targetTeamIds.length === 0 || targetTeamIds.includes(p.teamId))
            .filter(p => selectedTeamId === 'all' || String(p.teamId) === String(selectedTeamId));

        let sumBase = 0;
        let sumHome = 0;

        const startD = new Date(startDate);
        const endD = new Date(endDate);

        relevantPeople.forEach(person => {
            // Re-creating day loop to aggregate stats
            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                const k = d.toLocaleDateString('en-CA');

                let status = 'base';
                const override = manualOverrides[`${person.id}-${k}`];

                if (override) {
                    status = override.status;
                } else {
                    const resStatus = result.personStatuses?.[k]?.[person.id];
                    if (resStatus) {
                        status = resStatus;
                    } else {
                        const dbAvail = person.dailyAvailability?.[k];
                        if (dbAvail) status = dbAvail.isAvailable ? 'base' : 'home';
                        else status = 'base';
                    }
                }

                if (status === 'home' || status === 'unavailable') {
                    sumHome++;
                } else {
                    // Check Next Day for Departure logic
                    const nextDay = new Date(d);
                    nextDay.setDate(d.getDate() + 1);
                    const nextK = nextDay.toLocaleDateString('en-CA');

                    let nextStatus = 'base';
                    const nextOverride = manualOverrides[`${person.id}-${nextK}`];

                    if (nextOverride) {
                        nextStatus = nextOverride.status;
                    } else {
                        const nextResStatus = result.personStatuses?.[nextK]?.[person.id];
                        if (nextResStatus) {
                            nextStatus = nextResStatus;
                        } else {
                            const nextDbAvail = person.dailyAvailability?.[nextK];
                            if (nextDbAvail) nextStatus = nextDbAvail.isAvailable ? 'base' : 'home';
                            else nextStatus = 'base';
                        }
                    }

                    if (nextStatus !== 'base') {
                        // Departure counts as home for the ratio metric usually? 
                        // The user said "Avg ratio". 
                        // In the table logic (lines 864-867): `if (isDeparture) homeCount++; else baseCount++;`
                        // So I will mirror that logic.
                        sumHome++;
                    } else {
                        sumBase++;
                    }
                }
            }
        });

        const count = relevantPeople.length || 1;
        return {
            avgBase: (sumBase / count).toFixed(1),
            avgHome: (sumHome / count).toFixed(1)
        };
    }, [result, people, targetTeamIds, selectedTeamId, startDate, endDate, manualOverrides]);



    const previewFooter = (
        <div className="flex flex-col w-full gap-4">
            {/* Stats Summary */}
            <div className="flex flex-wrap items-center justify-center gap-4 bg-slate-50 p-2 rounded-lg border border-slate-200 text-sm shadow-sm">
                <div className="font-bold text-slate-700">ממוצע ללוחם:</div>
                <div className="flex items-center gap-4">
                    <span className="text-slate-600 bg-green-50 px-2 py-0.5 rounded border border-green-100">
                        ימי בסיס: <span className="font-bold text-green-700">{rosterStats.avgBase}</span>
                    </span>
                    <span className="text-slate-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                        ימי בית: <span className="font-bold text-red-700">{rosterStats.avgHome}</span>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-600">
                        יחס (בערך): <span className="font-bold text-blue-700" dir="ltr">{getArmyRatio(Number(rosterStats.avgBase), Number(rosterStats.avgHome))}</span>
                    </span>
                </div>
            </div>

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
        <>
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
                            {/* ... config content ... */}


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
                                <label className="text-sm font-bold text-slate-700 block mb-2">מטרת השיבוץ (אופטימיזציה)</label>
                                <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                                    <button
                                        onClick={() => setOptimizationMode('ratio')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex flex-col items-center gap-1 ${optimizationMode === 'ratio' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <span> שמירה על יחס</span>
                                        <span className="text-[10px] font-normal opacity-70 scale-90">חלוקה הוגנת (11-3)</span>
                                    </button>
                                    <button
                                        onClick={() => setOptimizationMode('min_staff')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex flex-col items-center gap-1 ${optimizationMode === 'min_staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <span>סד״כ מינימלי</span>
                                        <span className="text-[10px] font-normal opacity-70 scale-90">מקסימום בבית</span>
                                    </button>
                                    <button
                                        onClick={() => setOptimizationMode('tasks')}
                                        className={`flex-1 py-2 text-xs font-bold rounded-md transition-all flex flex-col items-center gap-1 ${optimizationMode === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <span>נגזרת משימות</span>
                                        <span className="text-[10px] font-normal opacity-70 scale-90">איוש כל המשימות</span>
                                    </button>
                                </div>
                            </div>

                            {optimizationMode === 'min_staff' && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <Input
                                        type="number"
                                        label="יעד סד״כ (כמה חיילים נדרשים בכל יום?)"
                                        min="0"
                                        value={customMinStaff}
                                        onChange={e => setCustomMinStaff(Number(e.target.value))}
                                        icon={Users}
                                        className="border-blue-300 ring-2 ring-blue-50"
                                    />
                                </div>
                            )}

                            {optimizationMode === 'ratio' && (
                                <div className="grid grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
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
                            )}

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

                                                                // Check if on base
                                                                if (status !== 'home' && status !== 'unavailable') {
                                                                    // It IS base (or undefined/null which defaults to base usually, but let's stick to explicit non-home)

                                                                    // Check for Departure (Base today, Home tomorrow)
                                                                    // If last day of roster, treat as FULL BASE (not departing)
                                                                    let isDeparture = false;

                                                                    if (d.getTime() < end.getTime()) {
                                                                        // We need to look up tomorrow's status
                                                                        const nextDay = new Date(d);
                                                                        nextDay.setDate(d.getDate() + 1);
                                                                        const nextKey = nextDay.toLocaleDateString('en-CA');
                                                                        const nextStatus = result?.personStatuses?.[nextKey]?.[p.id];

                                                                        // Also check DB availability for next day fallback if not in results
                                                                        let resolvedNextStatus = nextStatus;
                                                                        if (!resolvedNextStatus) {
                                                                            const dbAvail = p.dailyAvailability?.[nextKey];
                                                                            if (dbAvail) resolvedNextStatus = dbAvail.isAvailable ? 'base' : 'home';
                                                                            else resolvedNextStatus = 'base';
                                                                        }
                                                                        isDeparture = resolvedNextStatus === 'home' || resolvedNextStatus === 'unavailable';
                                                                    }

                                                                    if (!isDeparture) {
                                                                        presentCount++;
                                                                    }
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
                                                                    // const status = result?.personStatuses?.[dateKey]?.[person.id]; // Removed to avoid conflict

                                                                    // Look back for Departure definition: Current=Home && Prev=Base
                                                                    const prevDate = new Date(d);
                                                                    prevDate.setDate(prevDate.getDate() - 1);
                                                                    const prevDateKey = prevDate.toLocaleDateString('en-CA');

                                                                    const nextDate = new Date(d);
                                                                    nextDate.setDate(nextDate.getDate() + 1);
                                                                    const nextDateKey = nextDate.toLocaleDateString('en-CA');
                                                                    const overrideKey = `${person.id}-${dateKey}`;

                                                                    // Helper to resolve status (Override > Result > Existing DB)
                                                                    const resolveStatus = (key: string, pId: string = person.id) => {
                                                                        // Check for Manual Override FIRST
                                                                        const ov = manualOverrides[`${pId}-${key}`];
                                                                        if (ov) return ov.status;

                                                                        if (d.getTime() >= end.getTime() && key === nextDateKey) return 'base'; // End of roster = Base

                                                                        const resStatus = result?.personStatuses?.[key]?.[pId];
                                                                        if (resStatus) return resStatus;
                                                                        const dbAvail = person.dailyAvailability?.[key];
                                                                        if (dbAvail) {
                                                                            if (dbAvail.status) return dbAvail.status;
                                                                            return dbAvail.isAvailable ? 'base' : 'home';
                                                                        }
                                                                        return 'base'; // Default
                                                                    };

                                                                    // Current Status (Override aware)
                                                                    const status = resolveStatus(dateKey);
                                                                    const prevStatus = resolveStatus(prevDateKey);
                                                                    const nextStatus = resolveStatus(nextDateKey);

                                                                    let content = null;
                                                                    let cellClass = "bg-white";

                                                                    if (status === 'home' || status === 'unavailable') {
                                                                        // Standard Home Day
                                                                        cellClass = "bg-red-100 text-red-800 border-l border-slate-100";

                                                                        const isConstraint = status === 'unavailable';
                                                                        // Show '(אילוץ)' if unavailable, otherwise standard 'בית'

                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold leading-tight">
                                                                                <span>{isConstraint ? 'לא זמין' : 'בית'}</span>
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
                                                                            // Full Base OR Custom Times
                                                                            // If we have specific times (that aren't 00:00-23:59), show them
                                                                            const overrideKey = `${person.id}-${dateKey}`;
                                                                            const override = manualOverrides[overrideKey];

                                                                            let label = "בבסיס";
                                                                            let subLabel = "";

                                                                            // We can check resolution logic again or pass overrides down?
                                                                            // If it's a manual override with specific times, allow showing them
                                                                            if (override && override.status === 'base' && (override.startTime !== '00:00' || override.endTime !== '23:59')) {
                                                                                label = "בבסיס";
                                                                                subLabel = `${override.startTime}-${override.endTime}`;
                                                                            }


                                                                            cellClass = "bg-green-100 text-green-800 border-l border-slate-100";
                                                                            content = (
                                                                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] items-center">
                                                                                    <span className="font-bold">{label}</span>
                                                                                    {subLabel && <span className="text-[9px] font-mono">{subLabel}</span>}
                                                                                </div>
                                                                            );
                                                                        }
                                                                    }

                                                                    cells.push(
                                                                        <div
                                                                            key={`${person.id}-${dateKey}`}
                                                                            className={`w-24 shrink-0 p-1 border-l border-slate-100 h-12 flex items-center justify-center transition-colors cursor-pointer hover:ring-1 hover:ring-blue-300 ${cellClass}`}
                                                                            onClick={(e) => handleCellClick(e, person.id, dateKey)}
                                                                        >
                                                                            {content}
                                                                        </div>
                                                                    );
                                                                }

                                                                // Calculate Summary for this person
                                                                let homeCount = 0;
                                                                let baseCount = 0;
                                                                const startD = new Date(startDate);
                                                                const endD = new Date(endDate);

                                                                // Helper to resolve status for any date
                                                                const getStatusForDate = (dateObj: Date) => {
                                                                    const k = dateObj.toLocaleDateString('en-CA');
                                                                    // Check overrides first
                                                                    if (manualOverrides[`${person.id}-${k}`]) return manualOverrides[`${person.id}-${k}`].status;

                                                                    const resStatus = result?.personStatuses?.[k]?.[person.id];
                                                                    if (resStatus) return resStatus;
                                                                    const dbAvail = person.dailyAvailability?.[k];
                                                                    if (dbAvail) return dbAvail.isAvailable ? 'base' : 'home';
                                                                    return 'base'; // Default
                                                                };

                                                                for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                                                                    const currentStatus = getStatusForDate(d);

                                                                    if (currentStatus === 'home' || currentStatus === 'unavailable') {
                                                                        homeCount++;
                                                                    } else {
                                                                        // It IS base. Check if it's a departure (Tomorrow is home)
                                                                        const nextDay = new Date(d);
                                                                        nextDay.setDate(d.getDate() + 1);
                                                                        const nextStatus = getStatusForDate(nextDay);

                                                                        const isDeparture = nextStatus !== 'base';

                                                                        if (isDeparture) {
                                                                            homeCount++; // User wants Departure to count as Home
                                                                        } else {
                                                                            baseCount++;
                                                                        }
                                                                    }
                                                                }

                                                                const ratioStr = getArmyRatio(baseCount, homeCount);
                                                                cells.push(
                                                                    <div key="summary-cell" className="shrink-0 w-24 border-l border-slate-100 p-2 flex flex-col items-center justify-center bg-slate-50/50">
                                                                        <div className="text-[10px] font-bold text-slate-600">
                                                                            בסיס: <span className="text-green-600 text-xs">{baseCount}</span>
                                                                        </div>
                                                                        <div className="text-[10px] font-bold text-slate-600">
                                                                            בית: <span className="text-orange-600 text-xs">{homeCount}</span>
                                                                        </div>
                                                                        <div className="text-[10px] font-bold text-slate-600 mt-1 pt-1 border-t border-slate-200 w-full text-center">
                                                                            יחס: <span dir="ltr" className="text-blue-600 text-xs">{ratioStr}</span>
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
                {/* Manual Edit Popover */}
                {editingCell && (
                    <div
                        className="fixed inset-0 z-50 flex cursor-default"
                        onClick={() => setEditingCell(null)}
                    >
                        <div
                            className="absolute bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex flex-col gap-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                            style={{
                                top: editingCell.position.top,
                                left: editingCell.position.left
                            }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="text-[11px] font-bold text-slate-400 px-2 pb-2 border-b mb-1 flex justify-between items-center">
                                <span>ערוך סטטוס</span>
                                <button onClick={() => setEditingCell(null)} className="hover:bg-slate-100 rounded p-0.5"><X size={12} /></button>
                            </div>

                            {!showCustomHours ? (
                                <>
                                    <button onClick={() => applyOverride('base')} className="flex items-center gap-2 px-2 py-2 hover:bg-green-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> בבסיס (מלא)
                                    </button>
                                    <button onClick={() => applyOverride('home')} className="flex items-center gap-2 px-2 py-2 hover:bg-red-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm" /> בבית
                                    </button>
                                    <button onClick={() => setShowCustomHours(true)} className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                                        <Clock size={12} className="text-blue-500" /> שעות מסוימות...
                                    </button>
                                    <button onClick={() => applyOverride('unavailable')} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-100 rounded text-xs text-slate-700 w-full text-right border-t mt-1 pt-2 transition-colors">
                                        אילוץ / לא זמין
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col gap-2 p-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex flex-col">
                                            <label className="text-[9px] text-slate-400">התחלה</label>
                                            <input type="time" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-slate-50 border rounded px-1 py-0.5 text-xs w-16 text-center" />
                                        </div>
                                        <div className="flex flex-col">
                                            <label className="text-[9px] text-slate-400">סיום</label>
                                            <input type="time" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-slate-50 border rounded px-1 py-0.5 text-xs w-16 text-center" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-1">
                                        <button onClick={() => setShowCustomHours(false)} className="flex-1 bg-slate-100 text-slate-600 text-[10px] py-1 rounded hover:bg-slate-200">ביטול</button>
                                        <button onClick={() => applyOverride('custom', { start: customStart, end: customEnd })} className="flex-1 bg-blue-600 text-white text-[10px] py-1 rounded hover:bg-blue-700 font-medium">שמור</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </Modal>

            {/* Warning Modal */}
            <Modal
                isOpen={warningModal.isOpen}
                onClose={() => setWarningModal(prev => ({ ...prev, isOpen: false }))}
                title="שים לב: חריגות בשיבוץ"
                size="md"
            >
                <div className="p-4 space-y-4">
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 text-amber-900 text-sm">
                        <p className="font-bold mb-2 flex items-center gap-2">
                            ⚠️ נמצאו חריגות בתנאים שהוגדרו:
                        </p>
                        <ul className="list-disc list-inside space-y-1">
                            {warningModal.issues.map((issue, idx) => (
                                <li key={idx}>{issue}</li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-sm text-slate-500">
                        האם ברצונך לשמור את הלוח כפי שהוא, או לחזור ולתקן את החריגות?
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setWarningModal(prev => ({ ...prev, isOpen: false }))}>תקן שיבוץ</Button>
                        <Button onClick={performSave} className="bg-amber-600 hover:bg-amber-700 text-white">שמור למרות החריגות</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
};
