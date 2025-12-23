import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Person, Team, TaskTemplate, OrganizationSettings, TeamRotation, SchedulingConstraint, DailyPresence, Absence } from '../types';
import { generateRoster, RosterGenerationResult, PersonHistory } from '../utils/rotaGenerator';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Wand2, Calendar, AlertTriangle, CheckCircle, Save, X, Filter, ArrowLeft, Download, Sparkles, ArrowRight, Users, ChevronDown, ChevronUp, XCircle, Clock, Calculator } from 'lucide-react';
import { Input } from './ui/Input';
import { MultiSelect, MultiSelectOption } from './ui/MultiSelect';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../services/supabaseClient';
import { mapShiftToDB } from '../services/supabaseClient';
import { Select } from './ui/Select';
import { StaffingAnalysis } from './StaffingAnalysis';

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
    const [showAnalysis, setShowAnalysis] = useState(false);
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
    const [showConstraints, setShowConstraints] = useState(false);
    const [editingCell, setEditingCell] = useState<{ personId: string; date: string; position: { top: number; left: number }; isMobile?: boolean } | null>(null);

    // Temp state for custom hours in popup
    const [customStart, setCustomStart] = useState('08:00');
    const [customEnd, setCustomEnd] = useState('17:00');
    const [customType, setCustomType] = useState<null | 'arrival' | 'departure' | 'custom'>(null); // NEW

    const handleCellClick = (e: React.MouseEvent, personId: string, date: string) => {
        e.stopPropagation(); // Prevent modal close or other clicks
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            setEditingCell({
                personId,
                date,
                position: { top: 0, left: 0 },
                isMobile: true
            });
        } else {
            // Desktop: Position relative to cell center
            const popoverW = 280;
            const popoverH = 420; // Slightly larger for safety

            const cellCenterY = rect.top + (rect.height / 2);
            const cellCenterX = rect.left + (rect.width / 2);

            let top = cellCenterY - (popoverH / 2); // Center vertically? No, user said "Above or Below"
            // Let's try "Above" by default
            top = rect.top - popoverH - 5;

            // If not enough space above, put below
            if (top < 10) {
                top = rect.bottom + 5;
            }

            // Center Horizontally
            let left = cellCenterX - (popoverW / 2);

            // Horizontal Safety
            if (left + popoverW > window.innerWidth) {
                left = window.innerWidth - popoverW - 10;
            }
            if (left < 10) left = 10;

            // Vertical Safety (if Below is also OOB?)
            if (top + popoverH > window.innerHeight) {
                // If both Above and Below fail, Center vertically?
                // Or force Top if space allows better?
                // Stick to "Below" if it fits better, or clamp.
                if (top < 10) top = 10;
            }

            setEditingCell({
                personId,
                date,
                position: { top, left },
                isMobile: false
            });
        }

        setCustomType(null); // Reset view
        // Set defaults based on user settings
        setCustomStart(userArrivalHour);
        setCustomEnd(userDepartureHour);
    };

    const applyOverride = (status: string, customTimes?: { start?: string, end?: string }) => {
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
        } else if (status === 'arrival') {
            // Status IS arrival. Time is start->23:59
            override.startTime = customTimes?.start || userArrivalHour;
            override.endTime = '23:59';
        } else if (status === 'departure') {
            // Status IS departure. Time is 00:00->end
            override.startTime = '00:00';
            override.endTime = customTimes?.end || userDepartureHour;
        } else if (status === 'custom' && customTimes) {
            override.status = 'base'; // DB status is base (custom hours)
            override.startTime = customTimes.start || '08:00';
            override.endTime = customTimes.end || '17:00';
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

        // 0. Algorithm Warnings (Critical)
        if (result?.warnings && result.warnings.length > 0) {
            result.warnings.forEach(w => issues.push(`אזהרת מערכת: ${w}`));
        }

        const relevantPeople = targetTeamIds.length === 0 ? people : people.filter(p => targetTeamIds.includes(p.teamId));

        // Calculate Task Demand
        // Calculate Task Demand (Peak concurrent requirement)
        const dailyRequirements = new Array(7).fill(0);
        tasks.forEach(t => {
            t.segments?.forEach(seg => {
                if (seg.frequency === 'daily' || seg.isRepeat) {
                    for (let i = 0; i < 7; i++) dailyRequirements[i] += seg.requiredPeople;
                } else if (seg.frequency === 'weekly' && seg.daysOfWeek) {
                    const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
                    seg.daysOfWeek.forEach(d => {
                        const idx = days.indexOf(d.toLowerCase());
                        if (idx !== -1) dailyRequirements[idx] += seg.requiredPeople;
                    });
                }
            });
        });
        const totalTaskDemand = Math.max(...dailyRequirements);

        // Track stats per day
        const dailyStaffCounts: Record<string, number> = {};

        // Helper: Get Effective Status
        const getEffectiveStatus = (pid: string, dateKey: string) => {
            const override = manualOverrides[`${pid}-${dateKey}`];
            if (override) return override.status;
            // Fallback to result or Availability
            const resStatus = result?.personStatuses?.[dateKey]?.[pid];
            if (resStatus) return resStatus;
            return 'base'; // Default
        };

        // 1. Min Staff & Task Coverage Check
        let minStaffViolations = 0;
        let taskCoverageViolations = 0;

        dateRange.forEach(dateKey => {
            let dailyStaff = 0;
            relevantPeople.forEach(p => {
                const s = getEffectiveStatus(p.id, dateKey);
                // "Base presence" logic: Base, Arrival, Departure (partial), or logic says Departure is Home? 
                // Usually Departure is leaving, so partially there. Arrival is arriving, partially there.
                // Let's count them for now as staff present.
                if (s === 'base' || s === 'arrival') dailyStaff++;
            });
            dailyStaffCounts[dateKey] = dailyStaff;

            // Min Staff Warning
            if (customMinStaff > 0 && dailyStaff < customMinStaff) {
                minStaffViolations++;
                if (minStaffViolations <= 5) {
                    const dispDate = new Date(dateKey).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                    issues.push(`בתאריך ${dispDate}: ${dailyStaff} חיילים (מינימום נדרש: ${customMinStaff})`);
                }
            }

            // Task Coverage Warning
            if (dailyStaff < totalTaskDemand) {
                taskCoverageViolations++;
                if (taskCoverageViolations <= 5) {
                    const dispDate = new Date(dateKey).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
                    issues.push(`בתאריך ${dispDate}: ${dailyStaff} חיילים (נדרשים למשימות: ${totalTaskDemand})`);
                }
            }
        });

        if (minStaffViolations > 5) issues.push(`...ועוד ${minStaffViolations - 5} ימים עם חריגת סד״כ מינימלי`);
        if (taskCoverageViolations > 5) issues.push(`...ועוד ${taskCoverageViolations - 5} ימים עם חוסר כוח אדם למשימות`);

        // 2. Ratio Check
        // Only if we are optimizing for Ratio
        if (optimizationMode === 'ratio') {
            const targetRatioStr = getArmyRatio(daysBase, daysHome);

            relevantPeople.forEach(p => {
                let baseCount = 0;
                let homeCount = 0;

                dateRange.forEach((dateKey, idx) => {
                    const status = getEffectiveStatus(p.id, dateKey);
                    if (status === 'home' || status === 'unavailable') {
                        homeCount++;
                    } else {
                        // Check Departure Logic for Counting
                        const nextKey = idx < dateRange.length - 1 ? dateRange[idx + 1] : null;
                        const nextStatus = nextKey ? getEffectiveStatus(p.id, nextKey) : 'base';

                        // Is Departure?
                        if (nextStatus !== 'base' && nextStatus !== 'arrival') {
                            homeCount++;
                        } else {
                            baseCount++;
                        }
                    }
                });

                const currentRatio = getArmyRatio(baseCount, homeCount);

                if (currentRatio !== targetRatioStr) {
                    issues.push(`${p.name}: יחס היציאות השתנה ל-${currentRatio} (יעד: ${targetRatioStr})`);
                }
            });
        }

        // Cap ratio warnings if too many
        // (Hard to do with simple push array, but UI handles scroll)

        // 3. Manual Overrides Count
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
                history,
                tasks // NEW: Pass tasks for 'tasks' mode calculation
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
                        r.status = override.status as any; // Temporary override for sorting/logic

                        if (override.status === 'base') {
                            startTime = '00:00';
                            endTime = '23:59';
                            if (override.startTime) startTime = override.startTime;
                            if (override.endTime) endTime = override.endTime;
                        } else if (override.status === 'home' || override.status === 'unavailable') {
                            startTime = '00:00';
                            endTime = '00:00';
                        } else if (override.status === 'arrival') {
                            r.status = 'base'; // DB status is base
                            startTime = override.startTime || userArrivalHour;
                            endTime = '23:59';
                        } else if (override.status === 'departure') {
                            r.status = 'base'; // DB status is base
                            startTime = '00:00';
                            endTime = override.endTime || userDepartureHour;
                        } else if (override.status === 'custom') {
                            // Should be caught by 'base' usually, but just in case
                            r.status = 'base';
                            startTime = override.startTime || '00:00';
                            endTime = override.endTime || '23:59';
                        }
                    }

                    if (!override) {
                        // LOGIC:
                        // 1. Base Days:
                        //    - If Prev is NOT Base -> Arrival (Start: ArrivalHour, End: 23:59)
                        //    - Otherwise -> Full Base (Start: 00:00, End: 23:59)
                        //    - WE DO NOT INFER DEPARTURE ON BASE DAYS ANYMORE.
                        //
                        // 2. Home/Unavailable Days:
                        //    - If Prev IS Base -> Departure (Status: Base, Start: 00:00, End: DepartureHour)
                        //    - Otherwise -> Full Home (Status: Home, Start: 00:00, End: 00:00)

                        const prev = rosterItems[idx - 1];
                        let isPrevBase = prev && prev.status === 'base';

                        // Look up history if start of batch
                        if (!prev) {
                            const person = people.find(p => p.id === r.person_id);
                            if (person) {
                                const currentDate = new Date(r.date);
                                const prevDate = new Date(currentDate);
                                prevDate.setDate(prevDate.getDate() - 1);
                                const prevKey = prevDate.toLocaleDateString('en-CA');
                                const prevAvail = person.dailyAvailability?.[prevKey];
                                if (prevAvail && (prevAvail.status === 'base' || prevAvail.status === 'arrival' || prevAvail.status === 'departure' || prevAvail.isAvailable)) {
                                    isPrevBase = true;
                                }
                            }
                        }

                        if (r.status === 'base') {
                            // Full Base (No Arrival/Departure inference)
                            startTime = '00:00';
                            endTime = '23:59';
                        } else if (r.status === 'home' || r.status === 'unavailable') {
                            if (isPrevBase) {
                                // Departure (The first day of "Home" is actually the Departure day)
                                // CHANGE STATUS TO BASE for DB
                                r.status = 'base';
                                startTime = '00:00';
                                endTime = userDepartureHour;
                            }
                            // Else remains Home/Unavailable details (00:00)
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

    const configFooter = (
        <div className="flex flex-row gap-3 w-full">
            <Button variant="ghost" onClick={onClose} className="flex-1 justify-center">ביטול</Button>
            <Button
                onClick={handleGenerate}
                isLoading={generating}
                icon={Sparkles}
                className="bg-[#7cbd52] hover:bg-[#6aa845] text-white shadow-md hover:shadow-lg flex-[2] h-12 md:h-10 justify-center text-base md:text-sm font-black"
            >
                צור הצעה
            </Button>
        </div>
    );

    const previewFooter = (
        <div className="flex flex-col w-full gap-4">
            {/* Constraint Stats */}
            {result && result.stats.constraintStats && (
                <div className={`flex flex-col gap-2 rounded-lg border p-3 ${result.stats.constraintStats.percentage === 100 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {result.stats.constraintStats.percentage === 100 ? (
                                <CheckCircle size={18} className="text-green-600" />
                            ) : (
                                <AlertTriangle size={18} className="text-amber-600" />
                            )}
                            <span className="font-bold text-slate-800 text-sm">
                                {result.stats.constraintStats.percentage === 100
                                    ? 'כל האילוצים נענו בהצלחה!'
                                    : `נענו ${result.stats.constraintStats.met} מתוך ${result.stats.constraintStats.total} אילוצים (${result.stats.constraintStats.percentage}%)`}
                            </span>
                        </div>
                        {result.unfulfilledConstraints && result.unfulfilledConstraints.length > 0 && (
                            <button
                                onClick={() => setShowConstraints(!showConstraints)}
                                className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1"
                            >
                                {showConstraints ? 'הסתר פירוט' : 'הצג פירוט'}
                                {showConstraints ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                        )}
                    </div>

                    {showConstraints && result.unfulfilledConstraints && (
                        <div className="mt-2 pt-2 border-t border-amber-200/50 flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {result.unfulfilledConstraints.map((c, idx) => {
                                const p = people.find(p => p.id === c.personId);
                                return (
                                    <div key={idx} className="text-xs text-amber-800 flex items-start gap-1.5 bg-white/50 p-1.5 rounded">
                                        <XCircle size={12} className="mt-0.5 shrink-0 text-amber-600" />
                                        <span>
                                            <span className="font-bold">{p?.name || 'משתמש'}:</span> {c.reason} ({new Date(c.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })})
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Stats Summary */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] md:text-sm shadow-sm">
                <div className="font-black text-slate-700">ממוצע ללוחם:</div>
                <div className="flex items-center gap-3">
                    <span className="text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                        בסיס: <span className="font-black text-emerald-600">{rosterStats.avgBase}</span>
                    </span>
                    <span className="text-slate-600 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm">
                        בית: <span className="font-black text-rose-600">{rosterStats.avgHome}</span>
                    </span>
                    <div className="w-px h-3 bg-slate-200" />
                    <span className="text-slate-600">
                        יחס: <span dir="ltr" className="font-black text-blue-600">{getArmyRatio(Number(rosterStats.avgBase), Number(rosterStats.avgHome))}</span>
                    </span>
                </div>
            </div>

            <div className="flex flex-row gap-2 w-full">
                <Button variant="ghost" onClick={() => setStep('config')} className="flex-1 justify-center px-1">
                    <ArrowRight size={18} className="md:ml-2 ml-0" />
                    <span className="hidden md:inline">חזרה</span>
                </Button>
                <Button variant="ghost" onClick={onClose} className="flex-1 justify-center px-1">ביטול</Button>
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    className="bg-green-600 text-white hover:bg-green-700 shadow-md flex-[2] justify-center font-black h-12 md:h-10"
                >
                    שמור
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
                    const override = manualOverrides[`${p.id}-${dateKey}`];
                    let cellVal = 'בבסיס';
                    let status = result.personStatuses?.[dateKey]?.[p.id] || 'base';
                    // Re-resolve status if override exists (similar to preview)
                    if (override) {
                        if (override.status === 'arrival') {
                            cellVal = `הגעה (${override.startTime || userArrivalHour})`;
                            rowData.push(cellVal);
                            return;
                        }
                        if (override.status === 'departure') {
                            cellVal = `יציאה (${override.endTime || userDepartureHour})`;
                            rowData.push(cellVal);
                            return;
                        }
                        status = override.status;
                    }

                    // Standard Logic (Override or Algorithm)
                    if (status === 'home') {
                        // Check if it's implicitly Departure (Home following Base)
                        // ONLY if NOT overridden? No, if manually set to Home, it IS Home.
                        // If manually set to Base/Arrival/Departure, we handled it above.
                        // If manually set to Home, we want explicit Home.
                        // If Algorithm Home, we apply inference.

                        if (override) {
                            cellVal = 'בית';
                        } else {
                            const prevKey = idx > 0 ? dateKeys[idx - 1] : null;
                            // Need effective prev status
                            let prevStatus = 'base';
                            if (prevKey) {
                                const prevOv = manualOverrides[`${p.id}-${prevKey}`];
                                if (prevOv) prevStatus = prevOv.status === 'arrival' || prevOv.status === 'departure' ? 'base' : prevOv.status;
                                else prevStatus = result.personStatuses?.[prevKey]?.[p.id] || 'base';
                            }

                            if (prevStatus === 'base') cellVal = `יציאה (${userDepartureHour})`;
                            else cellVal = 'בית';
                        }
                    } else if (status === 'unavailable') {
                        if (override) {
                            cellVal = 'בית (אילוץ)';
                        } else {
                            const prevKey = idx > 0 ? dateKeys[idx - 1] : null;
                            // Need effective prev status
                            let prevStatus = 'base';
                            if (prevKey) {
                                const prevOv = manualOverrides[`${p.id}-${prevKey}`];
                                if (prevOv) prevStatus = prevOv.status === 'arrival' || prevOv.status === 'departure' ? 'base' : prevOv.status;
                                else prevStatus = result.personStatuses?.[prevKey]?.[p.id] || 'base';
                            }

                            if (prevStatus === 'base') cellVal = `יציאה (${userDepartureHour})`;
                            else cellVal = 'בית (אילוץ)';
                        }
                    } else if (status === 'base') {
                        // Check Arrival
                        if (override) {
                            // If base override, checks custom times
                            if (override.startTime && override.startTime !== '00:00' && override.startTime !== '23:59') {
                                // Maybe custom?
                                cellVal = `בבסיס (${override.startTime}-${override.endTime})`;
                            } else {
                                cellVal = 'בבסיס';
                            }
                        } else {
                            // Standard Base (Full Day)
                            cellVal = 'בבסיס';
                        }
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
                title={
                    <div className="flex flex-col">
                        <span className="text-lg md:text-2xl font-black text-slate-800">מחולל סבבים</span>
                        <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Automated Roster Generator</span>
                    </div>
                }
                size="full" // Full screen on mobile for better space usage
                scrollableContent={step === 'config'}
                footer={step === 'preview' ? previewFooter : configFooter}
            >
                <div className={`flex flex-col h-full ${step === 'preview' ? 'h-[80vh] md:h-[75vh] shrink min-h-0' : ''}`}>
                    {step === 'config' ? (
                        <>
                            <div className="flex justify-between items-center mb-4 px-1">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Configuration</span>
                                <button
                                    onClick={() => setShowAnalysis(!showAnalysis)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${showAnalysis ? 'bg-slate-200 text-slate-700' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                                >
                                    <Calculator size={14} />
                                    {showAnalysis ? 'חזרה להגדרות' : 'ניתוח נגזרות משימה'}
                                </button>
                            </div>

                            {showAnalysis ? (
                                <StaffingAnalysis tasks={tasks} totalPeople={people.length} />
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-300">
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-6">
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
                                        <div className="flex flex-col sm:flex-row bg-slate-100 p-1 rounded-lg gap-1">
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
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
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

                                    {optimizationMode === 'tasks' && (
                                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <Users size={16} />
                                                <span className="text-sm font-bold">דרישת סד״כ מחושבת:</span>
                                                <span className="text-sm bg-white px-2 py-0.5 rounded border border-blue-200">
                                                    {(() => {
                                                        // Simplified version of the generator logic for UI feedback
                                                        let totalDailyHours = 0;
                                                        tasks.forEach(t => {
                                                            t.segments?.forEach(seg => {
                                                                if (seg.frequency === 'daily' || seg.isRepeat) {
                                                                    totalDailyHours += seg.isRepeat ? 24 : (seg.durationHours * seg.requiredPeople);
                                                                }
                                                            });
                                                        });
                                                        // Assuming ~8h capacity avg for shorthand UI display
                                                        return Math.ceil(totalDailyHours / 8);
                                                    })()} חיילים
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-blue-600 mt-1 mr-6">המערכת תחשב את הסד״כ המדויק לכל יום בנפרד במהלך יצירת השיבוץ.</p>
                                        </div>
                                    )}
                                </div>
                            )}
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
                                    <Select
                                        value={selectedTeamId}
                                        onChange={(val) => setSelectedTeamId(val)}
                                        options={[{ value: 'all', label: 'כל הצוותים' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                                        placeholder="סינון לפי צוות"
                                        className="py-1.5 pl-3 pr-9 text-sm w-[150px]"
                                        icon={Filter}
                                        triggerMode="default"
                                    />
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
                                        <div className="sticky top-0 z-30 bg-white border-b border-slate-200">
                                            {/* Date Header Row */}
                                            <div className="flex h-10">
                                                <div className="w-32 shrink-0 p-2 font-bold bg-slate-50 border-l sticky right-0 z-40 flex items-center border-b border-slate-200">
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
                                                <div className="w-32 shrink-0 px-3 py-1 text-xs font-bold text-indigo-800 bg-indigo-50 border-l border-indigo-200 sticky right-0 z-40 flex items-center">
                                                    סה״כ מאוישים
                                                </div>
                                                <div className="flex">
                                                    {(() => {
                                                        const start = new Date(startDate);
                                                        const end = new Date(endDate);
                                                        const relevantPeople = targetTeamIds.length > 0 ? people.filter(p => targetTeamIds.includes(p.teamId)) : people;
                                                        const cells = [];
                                                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                            const dateKey = d.toLocaleDateString('en-CA');
                                                            let presentCount = 0;
                                                            relevantPeople.forEach(p => {
                                                                // Check for Override
                                                                const override = manualOverrides[`${p.id}-${dateKey}`];
                                                                let status = 'base';

                                                                if (override) {
                                                                    status = override.status;
                                                                } else {
                                                                    status = result?.personStatuses?.[dateKey]?.[p.id] || 'base';
                                                                }

                                                                // Count as present if Base, Arrival, or Departure
                                                                // (Departure is leaving, so was present part of day. Arrival is arriving, so present part.)
                                                                // "Home" and "Unavailable" are absent.
                                                                if (status === 'base' || status === 'arrival') {
                                                                    presentCount++;
                                                                }
                                                            });

                                                            const minStaff = customMinStaff;
                                                            const isUnderstaffed = customMinStaff > 0 && presentCount < minStaff;

                                                            cells.push(
                                                                <div key={`total-${dateKey}`} className={`shrink-0 w-24 flex items-center justify-center border-l border-indigo-100 text-xs font-bold ${isUnderstaffed ? 'text-amber-600 bg-amber-50' : 'text-indigo-600'}`}>
                                                                    {relevantPeople.length} / {presentCount}
                                                                </div>
                                                            );
                                                        }
                                                        cells.push(<div key="total-summary-pad" className="shrink-0 w-24 bg-indigo-50 border-l border-indigo-100"></div>);
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
                                                        <div className={`w-32 shrink-0 p-2 border-l sticky right-0 z-20 flex items-center gap-2 border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                                            <div
                                                                className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-slate-200 text-slate-700"
                                                                style={{
                                                                    backgroundColor: teams.find(t => t.id === person.teamId)?.color || '#f1f5f9'
                                                                }}
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

                                                                        // Check for Implicit Departure (Home day following Base)
                                                                        // ONLY if not explicitly overridden to Home/Unavailable
                                                                        const isOverridden = manualOverrides[`${person.id}-${dateKey}`];

                                                                        if (!isOverridden && prevStatus === 'base' && status !== 'unavailable') {
                                                                            // DEPARTURE (Home day following Base)
                                                                            cellClass = "bg-amber-50 text-amber-900 border-l border-amber-100";
                                                                            content = (
                                                                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                    <span className="font-bold mb-0.5">יציאה</span>
                                                                                    <span className="text-[9px]">{userDepartureHour}</span>
                                                                                </div>
                                                                            );
                                                                        } else {
                                                                            // Standard Home Day (Explicit or Middle of Home Block)
                                                                            cellClass = "bg-red-100 text-red-800 border-l border-slate-100";

                                                                            const isConstraint = status === 'unavailable';
                                                                            // Show '(אילוץ)' if unavailable, otherwise standard 'בית'

                                                                            content = (
                                                                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold leading-tight">
                                                                                    <span>{isConstraint ? 'לא זמין' : 'בית'}</span>
                                                                                    {isConstraint && <span className="text-[8px] font-normal">(אילוץ)</span>}
                                                                                </div>
                                                                            );
                                                                        }
                                                                    } else if (status === 'arrival') {
                                                                        // Explicit Arrival
                                                                        const ov = manualOverrides[`${person.id}-${dateKey}`];
                                                                        const time = ov?.startTime || userArrivalHour;

                                                                        cellClass = "bg-emerald-50 text-emerald-800 border-l border-emerald-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                <span className="font-bold mb-0.5">הגעה</span>
                                                                                <span className="text-[9px]">{time}</span>
                                                                            </div>
                                                                        );
                                                                    } else if (status === 'departure') {
                                                                        // Explicit Departure
                                                                        const ov = manualOverrides[`${person.id}-${dateKey}`];
                                                                        const time = ov?.endTime || userDepartureHour;

                                                                        cellClass = "bg-amber-50 text-amber-900 border-l border-amber-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                <span className="font-bold mb-0.5">יציאה</span>
                                                                                <span className="text-[9px]">{time}</span>
                                                                            </div>
                                                                        );
                                                                    } else if (status === 'base') {
                                                                        // Base Day 
                                                                        // User requested NO automatic Arrival inference.
                                                                        // Always Full Base unless overridden with custom times.

                                                                        // Check for Custom Times override
                                                                        const overrideKey = `${person.id}-${dateKey}`;
                                                                        const override = manualOverrides[overrideKey];

                                                                        let label = "בבסיס";
                                                                        let subLabel = "";

                                                                        if (override && override.status === 'base' && override.startTime && override.endTime) {
                                                                            if (override.startTime !== '00:00' || override.endTime !== '23:59') {
                                                                                // Maybe custom?
                                                                                subLabel = `${override.startTime}-${override.endTime}`;
                                                                            }
                                                                        }

                                                                        cellClass = "bg-green-100 text-green-800 border-l border-slate-100";
                                                                        content = (
                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] items-center">
                                                                                <span className="font-bold">{label}</span>
                                                                                {subLabel && <span className="text-[9px] font-mono">{subLabel}</span>}
                                                                            </div>
                                                                        );
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
            </Modal>

            {/* Manual Edit Popover */}
            {editingCell && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex cursor-default bg-black/5" // Dim background slightly? No, keeping transparent as before or maybe just handling click.
                    onClick={() => setEditingCell(null)}
                >
                    <div
                        className={`bg-white shadow-2xl flex flex-col gap-1 transition-all duration-300 ${editingCell.isMobile
                            ? 'fixed bottom-0 left-0 right-0 rounded-t-[2rem] p-6 animate-in slide-in-from-bottom duration-300 ease-out z-[10000]' // Bottom Sheet Mobile 
                            : 'absolute rounded-lg shadow-xl border border-slate-200 p-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-100 z-[10000]' // Desktop
                            }`}
                        style={editingCell.isMobile ? {} : {
                            top: editingCell.position.top,
                            left: editingCell.position.left
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-xs font-black text-slate-400 px-1 pb-3 border-b border-slate-100 mb-2 flex justify-between items-center uppercase tracking-widest">
                            <span>ערוך סטטוס • {editingCell.date}</span>
                            <button onClick={() => setEditingCell(null)} className="hover:bg-slate-100 rounded-full p-1 transition-colors"><X size={16} /></button>
                        </div>

                        {!customType ? (
                            <>
                                <button onClick={() => applyOverride('base')} className="flex items-center gap-2 px-2 py-2 hover:bg-green-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> בבסיס (מלא)
                                </button>
                                <button onClick={() => applyOverride('home')} className="flex items-center gap-2 px-2 py-2 hover:bg-red-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm" /> בבית (מלא)
                                </button>

                                <div className="flex gap-1 mt-1">
                                    <button onClick={() => setCustomType('departure')} className="flex-1 flex items-center justify-center gap-1 px-1 py-2 hover:bg-amber-50 rounded text-xs text-slate-700 border border-slate-100 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-amber-400" /> יציאה...
                                    </button>
                                    <button onClick={() => setCustomType('arrival')} className="flex-1 flex items-center justify-center gap-1 px-1 py-2 hover:bg-teal-50 rounded text-xs text-slate-700 border border-slate-100 transition-colors">
                                        <div className="w-2 h-2 rounded-full bg-teal-400" /> הגעה...
                                    </button>
                                </div>

                                <button onClick={() => setCustomType('custom')} className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 rounded text-xs text-slate-700 w-full text-right transition-colors mt-1">
                                    <Clock size={12} className="text-blue-500" /> שעות מותאמות...
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-col gap-2 p-1">
                                {customType === 'departure' && (
                                    <div className="flex flex-col">
                                        <label className="text-[9px] text-slate-400 mb-1">שעת יציאה:</label>
                                        <input type="time" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-slate-50 border rounded px-1 py-1 text-sm w-full text-center" />
                                    </div>
                                )}

                                {customType === 'arrival' && (
                                    <div className="flex flex-col">
                                        <label className="text-[9px] text-slate-400 mb-1">שעת הגעה:</label>
                                        <input type="time" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-slate-50 border rounded px-1 py-1 text-sm w-full text-center" />
                                    </div>
                                )}

                                {customType === 'custom' && (
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
                                )}

                                <div className="flex gap-2 mt-1">
                                    <button onClick={() => setCustomType(null)} className="flex-1 bg-slate-100 text-slate-600 text-[10px] py-1 rounded hover:bg-slate-200">ביטול</button>
                                    <button onClick={() => applyOverride(customType, { start: customStart, end: customEnd })} className="flex-1 bg-blue-600 text-white text-[10px] py-1 rounded hover:bg-blue-700 font-medium">שמור</button>
                                </div>
                            </div>
                        )}
                        {editingCell.isMobile && <div className="h-6" />} {/* Extra space for mobile thumb */}
                    </div>
                </div>,
                document.body
            )}

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
