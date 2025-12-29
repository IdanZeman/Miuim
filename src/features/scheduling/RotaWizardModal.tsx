import { handleAppError } from '../../utils/errorUtils';
import { logger } from '../../lib/logger';
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { Person, Team, TaskTemplate, OrganizationSettings, TeamRotation, SchedulingConstraint, DailyPresence, Absence } from '@/types';
import { generateRoster, RosterGenerationResult, PersonHistory } from '@/utils/rotaGenerator';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Wand2, Calendar, AlertTriangle, CheckCircle, Save, X, Filter, ArrowLeft, Download, Search, ArrowRight, Users, ChevronDown, ChevronUp, XCircle, Clock, Calculator, Info, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { MultiSelect, MultiSelectOption } from '@/components/ui/MultiSelect';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/services/supabaseClient';
import { mapShiftToDB } from '@/services/supabaseClient';
import { Select } from '@/components/ui/Select';
import { StaffingAnalysis } from '@/features/stats/StaffingAnalysis';
import { StatusEditModal } from './StatusEditModal';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';

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
    hourlyBlockages: import('@/types').HourlyBlockage[]; // NEW
    onSaveRoster?: (data: DailyPresence[]) => void;
}


export const RotaWizardModal: React.FC<RotaWizardModalProps> = ({
    isOpen, onClose, people, teams, tasks, settings, teamRotations, constraints, absences, hourlyBlockages, onSaveRoster
}) => {
    const queryClient = useQueryClient();
    const activePeople = people.filter(p => p.isActive !== false);
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
    const [showTaskAnalysis, setShowTaskAnalysis] = useState(false);
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
    const [customType, setCustomType] = useState<null | 'arrival' | 'departure' | 'custom'>(null);
    const [searchQuery, setSearchQuery] = useState(''); // NEW: Search for matrix view
    const [showConstraintDetails, setShowConstraintDetails] = useState(false);
    const [showStatsDetails, setShowStatsDetails] = useState(false);

    // Feature: Collapsible Teams
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const handleToggleAllTeams = () => {
        const visibleTeamIdsWithMembers = teams.filter(team => {
            const teamMembers = activePeople
                .filter(p => p.teamId === team.id)
                .filter(p => targetTeamIds.length === 0 || targetTeamIds.includes(p.teamId))
                .filter(p => selectedTeamId === 'all' || String(p.teamId) === String(selectedTeamId))
                .filter(p => !searchQuery || p.name.includes(searchQuery));
            return teamMembers.length > 0;
        }).map(t => t.id);

        const allCollapsed = visibleTeamIdsWithMembers.every(id => collapsedTeams.has(id));

        if (allCollapsed) {
            setCollapsedTeams(prev => {
                const next = new Set(prev);
                visibleTeamIdsWithMembers.forEach(id => next.delete(id));
                return next;
            });
        } else {
            setCollapsedTeams(prev => {
                const next = new Set(prev);
                visibleTeamIdsWithMembers.forEach(id => next.add(id));
                return next;
            });
        }
    };

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
        logger.info('UPDATE', `Applied manual override in wizard for ${editingCell.personId} on ${editingCell.date}`, {
            personId: editingCell.personId,
            date: editingCell.date,
            status,
            times: `${override.startTime}-${override.endTime}`
        });
        setEditingCell(null);
    };

    // Helper to normalize ratio for display (Hoisted)
    const getArmyRatio = (base: number, home: number): string => {
        // Safe division handle
        if (home === 0) return "מלא"; // Or closest high ratio? User said "Abandon edges". But 11-3 is max.
        if (base === 0) return "יומיות";

        const ratio = base / home;

        // Standard Cycle Candidates (Sum = 14)
        const candidates = [
            { b: 7, h: 7 },  // 7-7 (1.0)
            { b: 8, h: 6 },  // 8-6 (1.33)
            { b: 9, h: 5 },  // 9-5 (1.8)
            { b: 10, h: 4 }, // 10-4 (2.5)
            { b: 11, h: 3 }, // 11-3 (3.66)
            { b: 12, h: 2 }  // 12-2 (6.0)
        ];

        let best = candidates[0];
        let minDiff = Math.abs(ratio - (best.b / best.h));

        for (const c of candidates) {
            const cRatio = c.b / c.h;
            const diff = Math.abs(ratio - cRatio);
            if (diff < minDiff) {
                minDiff = diff;
                best = c;
            }
        }

        // Debug Log
        // console.log(`[RatioDebug] In(${base}/${home} = ${ratio.toFixed(2)}) -> Matched ${best.b}-${best.h} (Ratio ${best.b/best.h}) with diff ${minDiff}`);

        return `${best.b} - ${best.h}`;
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
        // Helper: Get Effective Status
        const getEffectiveStatus = (pid: string, dateKey: string) => {
            const override = manualOverrides[`${pid}-${dateKey}`];
            if (override) return override.status;
            // Fallback to result or Availability
            const resStatus = result?.personStatuses?.[dateKey]?.[pid];
            if (resStatus) return resStatus;

            // Fallback to DB Availability (Sync with Table Logic)
            const person = people.find(p => p.id === pid);
            const dbAvail = person?.dailyAvailability?.[dateKey];
            if (dbAvail) return dbAvail.isAvailable ? 'base' : 'home';

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
        // 2. Ratio Check
        // Only if we are optimizing for Ratio
        if (optimizationMode === 'ratio') {
            const targetRatioStr = getArmyRatio(daysBase, daysHome);

            relevantPeople.forEach(p => {
                let baseCount = 0;
                let homeCount = 0;

                dateRange.forEach((dateKey, idx) => {
                    const status = getEffectiveStatus(p.id, dateKey);
                    if (status === 'home' || status === 'unavailable' || status === 'departure') {
                        homeCount++;
                    } else {
                        baseCount++;
                    }
                });

                // console.log(`[Validation] ${p.name}: Range=${dateRange.length}, Base=${baseCount}, Home=${homeCount}`);

                const currentRatio = getArmyRatio(baseCount, homeCount);

                if (currentRatio !== targetRatioStr) {
                    issues.push(`${p.name}: חריגה בימי בית - יחס קרוב ל-${currentRatio} (יעד: ${targetRatioStr})`);
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
        const startTime = performance.now();
        logger.info('AUTO_SCHEDULE', 'Started roster generation', {
            startDate,
            endDate,
            optimizationMode,
            peopleCount: activePeople.length,
            tasksCount: tasks.length
        });

        console.log('--- Wizard: Starting Generation ---');
        console.log('Inputs:', {
            startDate, endDate,
            settings,
            tasksCount: tasks.length,
            peopleCount: activePeople.length
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
                ? activePeople
                : activePeople.filter(p => targetTeamIds.includes(p.teamId));

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
                tasks, // NEW: Pass tasks for 'tasks' mode calculation
                hourlyBlockages // NEW
            });
            console.log('Generation Result:', res);
            setResult(res);
            setStep('preview');

            const duration = performance.now() - startTime;
            logger.info('AUTO_SCHEDULE', 'Completed roster generation', {
                durationMs: duration,
                performanceMs: duration, // Dedicated field
                warningsCount: res.warnings?.length || 0,
                rosterSize: res.roster?.length || 0
            });

        } catch (e) {
            console.error('Wizard Error:', e);
            logger.error('AUTO_SCHEDULE', 'Failed roster generation', e);
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
        const startTime = performance.now();
        setSaving(true);
        setWarningModal(prev => ({ ...prev, isOpen: false })); // Close warning

        // Log start of save
        const overrideCount = Object.keys(manualOverrides).length;
        if (overrideCount > 0) {
            logger.info('UPDATE', 'Saving roster with manual overrides', { count: overrideCount });
        } else {
            logger.info('UPDATE', 'Saving auto-generated roster', { optimizations: optimizationMode });
        }

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
                            if (!isPrevBase) {
                                // Arrival Day (First day of Base streak)
                                startTime = userArrivalHour;
                                endTime = '23:59';
                            } else {
                                // Full Base
                                startTime = '00:00';
                                endTime = '23:59';
                            }
                        } else if (r.status === 'home' || r.status === 'unavailable') {
                            /* 
                               REMOVED DEPARTURE INFERENCE: 
                               The Generator now handles "Exit Day" logic or the UI shows it.
                               Converting the first Home day to Base (Departure) causes the "Missing Home Day" bug.
                               We will simply save it as Home (00:00-00:00).
                            */
                            // if (isPrevBase) {
                            //     // Departure (The first day of "Home" is actually the Departure day)
                            //     // CHANGE STATUS TO BASE for DB
                            //     r.status = 'base';
                            //     startTime = '00:00';
                            //     endTime = userDepartureHour;
                            // }

                            // Keep as Home
                            startTime = '00:00';
                            endTime = '00:00';
                        }
                    }

                    // Log times for debugging
                    // console.log(`Processing ${r.person_id} for ${r.date}: status=${r.status}, times=${startTime}-${endTime}`);

                    // Update the roster item reference so the JSON update loop uses the correct calculated times
                    r.start_time = startTime;
                    r.end_time = endTime;

                    payload.push({
                        date: r.date,
                        person_id: r.person_id,
                        organization_id: settings.organization_id,
                        status: r.status === 'base' ? 'base' : (r.status === 'unavailable' ? 'unavailable' : 'home'),
                        source: override ? 'override' : 'algorithm',
                        start_time: startTime,
                        end_time: endTime
                    } as DailyPresence);
                });
            });

            // 1. Bulk Upsert into daily_presence (History)
            const { error } = await supabase.from('daily_presence').upsert(payload, { onConflict: 'date,person_id,organization_id' });

            if (error) throw error;

            // Optimized: Use Batched Parallel Updates to improve speed while avoiding rate limits
            const entries = Array.from(personMap.entries());
            let successCount = 0;
            const BATCH_SIZE = 10;

            for (let i = 0; i < entries.length; i += BATCH_SIZE) {
                const batch = entries.slice(i, i + BATCH_SIZE);

                await Promise.all(batch.map(async ([personId, rosterItems]) => {
                    const person = people.find(p => p.id === personId);
                    if (!person) return;

                    const newAvailability = { ...(person.dailyAvailability || {}) };

                    rosterItems.forEach(r => {
                        const dateKey = r.date;
                        let startTime = r.start_time || '00:00';
                        let endTime = r.end_time || '23:59';

                        // Check if this date was manually overridden in the wizard (Exit Request)
                        const overrideKey = `${personId}-${dateKey}`;
                        const override = manualOverrides[overrideKey];
                        let unavailableBlocks = (person.dailyAvailability?.[dateKey]?.unavailableBlocks || []).slice();

                        if (override && (override.status === 'home' || override.status === 'unavailable')) {
                            // This date was 'locked' by the user in the wizard
                            // Ensure we have a block for it so the UI shows the "Exit Request" Text
                            const hasConstraintBlock = unavailableBlocks.some(b => b.reason === 'אילוץ מחולל');
                            if (!hasConstraintBlock) {
                                unavailableBlocks.push({
                                    id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                                    start: '00:00',
                                    end: '23:59',
                                    reason: 'אילוץ מחולל'
                                });
                            }
                        }

                        const val = {
                            status: r.status as any,
                            isAvailable: r.status === 'base',
                            startHour: startTime,
                            endHour: endTime,
                            source: 'algorithm',
                            unavailableBlocks: unavailableBlocks.length > 0 ? unavailableBlocks : undefined
                        };
                        newAvailability[dateKey] = val;
                    });

                    // Update DB - Batched Parallel
                    const { error } = await supabase.from('people')
                        .update({ daily_availability: newAvailability })
                        .eq('id', personId);

                    if (!error) {
                        successCount++;
                    }
                }));
            }

            console.log(`[RotaSave] Completed. Success: ${successCount}/${entries.length}`);

            // Invalidate Cache to force UI refresh
            await queryClient.invalidateQueries({ queryKey: ['organizationData'] });
            console.log('[RotaSave] Cache invalidated');

            if (onSaveRoster) onSaveRoster(result.roster);
            const duration = performance.now() - startTime;
            logger.info('GENERATE', 'Successfully saved generated roster to database', {
                performanceMs: duration,
                peopleCount: entries.length,
                totalRecords: payload.length
            });
            showToast('השיבוץ נשמר בהצלחה', 'success');
            onClose();
        } catch (e) {
            const msg = handleAppError(e, 'Save Roster Failed');
            logger.error('ERROR', 'Failed to save roster', e); // Error log
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    const rosterStats = React.useMemo(() => {
        if (!result) return { avgBase: "0.0", avgHome: "0.0", ratioStr: "0 - 0" };

        const relevantPeople = people
            .filter(p => targetTeamIds.length === 0 || targetTeamIds.includes(p.teamId))
            .filter(p => selectedTeamId === 'all' || String(p.teamId) === String(selectedTeamId));

        let sumBase = 0;
        let sumHome = 0;

        const startD = new Date(startDate);
        const endD = new Date(endDate);
        const dateRange: string[] = [];
        for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
            dateRange.push(d.toLocaleDateString('en-CA'));
        }

        relevantPeople.forEach(person => {
            dateRange.forEach(k => {
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

                // Normalise for Stats
                if (status === 'home' || status === 'unavailable' || status === 'departure') {
                    sumHome++;
                } else {
                    sumBase++;
                }
            });
        });

        const count = relevantPeople.length || 1;
        const avgB = sumBase / count;
        const avgH = sumHome / count;

        // Ratio based on Averages
        const ratioStr = getArmyRatio(avgB, avgH);

        return {
            avgBase: avgB.toFixed(1),
            avgHome: avgH.toFixed(1),
            ratioStr
        };
    }, [result, people, targetTeamIds, selectedTeamId, startDate, endDate, manualOverrides]);

    // Optimization: Pre-calculate absence map for quick lookup in render
    const absenceLookup = React.useMemo(() => {
        const map = new Map<string, string>(); // Key: personId-date, Value: Reason or ''
        const start = new Date(startDate);
        const end = new Date(endDate);

        absences.forEach(a => {
            if (a.status !== 'approved' && a.status !== 'pending') return;

            const aStart = new Date(a.start_date);
            const aEnd = new Date(a.end_date);

            // Intersection with range
            const effectiveStart = aStart < start ? start : aStart;
            const effectiveEnd = aEnd > end ? end : aEnd;

            for (let d = new Date(effectiveStart); d <= effectiveEnd; d.setDate(d.getDate() + 1)) {
                const key = `${a.person_id}-${d.toLocaleDateString('en-CA')}`;
                // Prefer existing reason if multiple (or simply overwrite)
                // Use explicit reason if available, else marker that implies default
                map.set(key, a.reason || 'EMPTY_REASON');
            }
        });
        return map;
    }, [absences, startDate, endDate]);

    const configFooter = (
        <div className="flex gap-3 w-full justify-between">
            <Button variant="ghost" onClick={onClose} className="w-32 justify-center">ביטול</Button>
            <Button
                onClick={handleGenerate}
                disabled={generating}
                isLoading={generating}
                className="w-40 justify-center font-bold"
            >
                {generating ? 'מייצר סבב...' : 'צור סבב יציאות'}
            </Button>
        </div>
    );



    const previewFooter = (
        <div className="flex gap-2 w-full justify-between items-center select-none">
            {/* Left Side: Buttons */}
            <div className="flex gap-2 items-center flex-1">
                <Button variant="ghost" onClick={() => setStep('config')} className="h-10 px-0 md:px-4 text-slate-400">
                    <ArrowRight size={20} />
                </Button>

                {/* Info Buttons (Mobile Optimized) */}
                <div className="flex items-center gap-2">
                    {/* Stats Info Button - Updated Label */}
                    <button
                        onClick={() => setShowStatsDetails(true)}
                        className="h-9 px-3 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-600 active:bg-slate-100 text-xs font-bold gap-2 whitespace-nowrap"
                    >
                        <span>ממוצע ללוחם - לחץ לפירוט</span>
                    </button>

                    {/* Constraints Status Button */}
                    {result && result.stats.constraintStats && (
                        <button
                            onClick={() => setShowConstraintDetails(true)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all ${result.stats.constraintStats.percentage === 100
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-amber-50 border-amber-200 text-amber-700'
                                }`}
                        >
                            {result.stats.constraintStats.percentage === 100 ? (
                                <CheckCircle size={14} className="shrink-0" />
                            ) : (
                                <AlertTriangle size={14} className="shrink-0" />
                            )}
                            <span className="truncate max-w-[80px] hidden md:inline">
                                {result.stats.constraintStats.percentage === 100 ? 'הכל תקין' : 'יש חריגות'}
                            </span>
                            <span className="md:hidden">
                                {result.stats.constraintStats.met}/{result.stats.constraintStats.total}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Right Side: Actions */}
            <div className="flex gap-2 items-center">
                <Button variant="ghost" onClick={onClose} className="h-10 text-xs md:text-sm px-2 text-slate-500">ביטול</Button>
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    data-testid="rota-wizard-save-btn"
                    className="bg-green-600 text-white hover:bg-green-700 shadow-md h-10 px-4 text-xs md:text-sm font-black whitespace-nowrap"
                >
                    שמור שיבוץ
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
                    </div>
                }
                size={step === 'preview' ? 'full' : 'xl'} // tight for config, full for preview
                scrollableContent={step === 'config'}
                footer={step === 'preview' ? previewFooter : configFooter}
            >
                <div className={`flex flex-col h-full ${step === 'preview' ? 'h-[80vh] md:h-[75vh] shrink min-h-0' : ''}`}>
                    {step === 'config' ? (
                        <>
                            <div className="flex justify-between items-center mb-4 px-1">
                                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">הגדרה</span>
                            </div>

                            {showAnalysis ? (
                                <StaffingAnalysis tasks={tasks} totalPeople={people.length} />
                            ) : (
                                <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl mx-auto w-full">
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
                                        <DatePicker label="תאריך התחלה" value={startDate} onChange={setStartDate} />
                                        <DatePicker label="תאריך סיום" value={endDate} onChange={setEndDate} />
                                    </div>

                                    <div className="mt-6">
                                        <label className="text-sm font-bold text-slate-700 block mb-3">מטרת השיבוץ (בחר אחת)</label>
                                        <div className="grid grid-cols-3 gap-3">
                                            <button
                                                onClick={() => setOptimizationMode('ratio')}
                                                className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 ${optimizationMode === 'ratio'
                                                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm'
                                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {optimizationMode === 'ratio' && (
                                                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                                                )}
                                                <span className="text-sm font-bold">שמירה על יחס יציאות</span>
                                                <span className="text-[10px] opacity-80 leading-tight">חלוקה הוגנת (11-3)</span>
                                            </button>

                                            <button
                                                onClick={() => setOptimizationMode('min_staff')}
                                                className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 ${optimizationMode === 'min_staff'
                                                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm'
                                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {optimizationMode === 'min_staff' && (
                                                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                                                )}
                                                <span className="text-sm font-bold">סד״כ מינימלי</span>
                                                <span className="text-[10px] opacity-80 leading-tight">מקסימום בבית</span>
                                            </button>

                                            <button
                                                onClick={() => setOptimizationMode('tasks')}
                                                className={`relative p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 text-center outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-400 ${optimizationMode === 'tasks'
                                                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-sm'
                                                    : 'bg-white border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}
                                            >
                                                {optimizationMode === 'tasks' && (
                                                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-600" />
                                                )}
                                                <div className="flex items-center gap-1.5 z-10">
                                                    <span className="text-sm font-bold">נגזרת משימות</span>
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowTaskAnalysis(true);
                                                        }}
                                                        className="flex items-center justify-center bg-slate-800 text-white rounded-full w-4 h-4 hover:bg-black transition-colors shadow-sm cursor-help"
                                                        title="לחץ לצפייה בפירוט המשימות"
                                                    >
                                                        <span className="font-serif italic font-bold text-[9px] leading-none">i</span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] opacity-80 leading-tight">איוש כל המשימות</span>
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

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <TimePicker label="שעת הגעה" value={userArrivalHour} onChange={setUserArrivalHour} />
                                        <TimePicker label="שעת יציאה" value={userDepartureHour} onChange={setUserDepartureHour} />
                                    </div>

                                    {optimizationMode === 'tasks' && (
                                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="flex items-center gap-2 text-blue-800">
                                                <Users size={16} />
                                                <span className="text-sm font-bold">דרישת סד״כ מחושבת:</span>
                                                <span className="text-sm bg-white px-2 py-0.5 rounded border border-blue-200">
                                                    {(() => {
                                                        let maxDaily = 0;
                                                        const start = new Date(startDate);
                                                        const end = new Date(endDate);
                                                        const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

                                                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                            let dailySum = 0;
                                                            const checkDate = d.toLocaleDateString('en-CA'); // YYYY-MM-DD

                                                            tasks.forEach(t => {
                                                                // Check Task Validity Range
                                                                const tStart = t.startDate ? t.startDate : '1900-01-01';
                                                                const tEnd = t.endDate ? t.endDate : '2100-01-01';

                                                                if (checkDate >= tStart && checkDate <= tEnd) {
                                                                    t.segments?.forEach(seg => {
                                                                        let isActive = false;
                                                                        if (seg.frequency === 'daily') {
                                                                            isActive = true;
                                                                        } else if (seg.frequency === 'specific_date') {
                                                                            if (seg.specificDate === checkDate) isActive = true;
                                                                        } else if (seg.frequency === 'weekly') {
                                                                            const dayName = dayMap[d.getDay()];
                                                                            if (seg.daysOfWeek?.includes(dayName)) isActive = true;
                                                                        }

                                                                        if (isActive) {
                                                                            dailySum += seg.requiredPeople;
                                                                        }
                                                                    });
                                                                }
                                                            });
                                                            if (dailySum > maxDaily) maxDaily = dailySum;
                                                        }

                                                        return `עד ${maxDaily}`;
                                                    })()} חיילים (משתנה)
                                                </span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowTaskAnalysis(true);
                                                    }}
                                                    className="p-1 hover:bg-white rounded-full transition-colors text-blue-500 hover:text-blue-700"
                                                    title="פירוט משימות יומי"
                                                >
                                                    <Info size={16} />
                                                </button>
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
                                    <button
                                        onClick={handleToggleAllTeams}
                                        className="p-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200 flex items-center gap-2"
                                        title="כיווץ/הרחבת הכל"
                                    >
                                        <div className={`transition-transform duration-300 ${Array.from(collapsedTeams).some(id => teams.some(t => t.id === id)) ? 'rotate-180' : 'rotate-0'}`}>
                                            <ChevronDown size={20} />
                                        </div>
                                        <span className="text-xs font-bold hidden md:inline">כיווץ/הרחבה</span>
                                    </button>
                                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                                    <Select
                                        value={selectedTeamId}
                                        onChange={(val) => setSelectedTeamId(val)}
                                        options={[{ value: 'all', label: 'כל הצוותים' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                                        placeholder="סינון לפי צוות"
                                        className="py-1.5 pl-3 pr-9 text-sm w-[180px]" // Increased width
                                        icon={Filter}
                                        triggerMode="default"
                                    />
                                    {/* Search Input */}
                                    <div className="relative">
                                        <input
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            placeholder="חיפוש..."
                                            className="h-9 pr-9 pl-3 text-sm border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 w-[140px] transition-all focus:w-[180px]"
                                        />
                                        <div className="absolute top-0 bottom-0 right-3 flex items-center pointer-events-none text-slate-400">
                                            <Search size={14} />
                                        </div>
                                    </div>
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
                                        <div className="sticky top-0 z-50 bg-white border-b border-slate-200">
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
                                                            <div key="summary-header" className="shrink-0 w-24 p-2 text-center border-l border-slate-100 bg-slate-50 flex items-center justify-center sticky left-0 z-50 shadow-sm">
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
                                                        const relevantPeople = targetTeamIds.length > 0 ? activePeople.filter(p => targetTeamIds.includes(p.teamId)) : activePeople;
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
                                                        cells.push(<div key="total-summary-pad" className="shrink-0 w-24 bg-indigo-50 border-l border-indigo-100 flex items-center justify-center text-indigo-300 text-[10px] sticky left-0 z-40">-</div>);
                                                        return cells;
                                                    })()}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Table Body */}
                                        <div>
                                            {teams.map(team => {
                                                // Filter members for this team
                                                const teamMembers = activePeople
                                                    .filter(p => p.teamId === team.id)
                                                    .filter(p => targetTeamIds.length === 0 || targetTeamIds.includes(p.teamId)) // Config filter
                                                    .filter(p => selectedTeamId === 'all' || String(p.teamId) === String(selectedTeamId)) // Dropdown filter
                                                    .filter(p => !searchQuery || p.name.includes(searchQuery)); // Search filter

                                                if (teamMembers.length === 0) return null;

                                                const isCollapsed = collapsedTeams.has(team.id);

                                                return (
                                                    <div key={team.id}>
                                                        {/* Team Header */}
                                                        {/* Team Header */}
                                                        <div
                                                            className="flex items-center h-8 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors"
                                                            onClick={() => toggleTeam(team.id)}
                                                        >
                                                            <div className="w-32 shrink-0 sticky right-0 bg-slate-50 border-l border-slate-200 z-20 flex items-center px-2 py-1 gap-1">
                                                                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: team.color || '#cbd5e1' }} />
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="font-bold text-xs text-slate-600 truncate max-w-[80px]">{team.name}</div>
                                                                        <div className="text-[10px] text-slate-400 font-medium">({teamMembers.length})</div>
                                                                    </div>
                                                                </div>
                                                                <div className={`text-slate-400 transition-transform ${isCollapsed ? 'rotate-[-90deg]' : 'rotate-0'}`}>
                                                                    <ChevronDown size={14} />
                                                                </div>
                                                            </div>

                                                            {/* Daily Stats Cells */}
                                                            <div className="flex">
                                                                {(() => {
                                                                    const start = new Date(startDate);
                                                                    const end = new Date(endDate);
                                                                    const cells = [];
                                                                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                                                                        const dateKey = d.toLocaleDateString('en-CA');
                                                                        let presentCount = 0;
                                                                        teamMembers.forEach(p => {
                                                                            const override = manualOverrides[`${p.id}-${dateKey}`];
                                                                            let status = 'base';
                                                                            if (override) {
                                                                                status = override.status;
                                                                            } else {
                                                                                status = result?.personStatuses?.[dateKey]?.[p.id] || 'base';
                                                                            }
                                                                            if (status === 'base' || status === 'arrival' || status === 'departure') {
                                                                                presentCount++;
                                                                            }
                                                                        });

                                                                        const isFull = presentCount === teamMembers.length;
                                                                        const isEmpty = presentCount === 0;

                                                                        cells.push(
                                                                            <div key={`team-${team.id}-${dateKey}`} className={`shrink-0 w-24 flex items-center justify-center border-l border-slate-100 text-[10px] font-bold ${isFull ? 'text-green-600' : isEmpty ? 'text-red-400' : 'text-slate-600'}`}>
                                                                                {teamMembers.length} / {presentCount}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    // Summary Column Placeholder
                                                                    cells.push(
                                                                        <div key={`team-${team.id}-summary`} className="shrink-0 w-24 bg-slate-50 border-l border-slate-100 sticky left-0 z-10" />
                                                                    );
                                                                    return cells;
                                                                })()}
                                                            </div>
                                                        </div>

                                                        {/* Team Members */}
                                                        <div className={`${isCollapsed ? 'hidden' : 'block'}`}>
                                                            {teamMembers.map((person, idx) => (
                                                                <div key={person.id} className={`flex border-b border-slate-50 hover:bg-slate-50 transition-colors h-14 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                                                                    {/* Sticky Name Column */}
                                                                    <div className={`w-32 shrink-0 p-2 border-l sticky right-0 z-20 flex items-center gap-2 border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                                                        <div
                                                                            className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-xs font-bold shrink-0 shadow-sm border border-slate-200 text-slate-700"
                                                                            style={{
                                                                                backgroundColor: team.color || '#f1f5f9'
                                                                            }}
                                                                        >
                                                                            {person.name.charAt(0)}
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="text-sm font-bold text-slate-700 truncate">{person.name}</div>
                                                                            <div className="text-[10px] text-slate-400 truncate">{team.name}</div>
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
                                                                                    const absenceReason = absenceLookup.get(`${person.id}-${dateKey}`);

                                                                                    if (!isOverridden && prevStatus === 'base' && status !== 'unavailable' && !absenceReason) {
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
                                                                                        const isConstraint = status === 'unavailable' || !!absenceReason;

                                                                                        content = (
                                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] font-bold leading-tight">
                                                                                                <span className="text-red-900">בית</span>
                                                                                                {isConstraint && (
                                                                                                    <span className="text-[9px] font-bold truncate max-w-full px-0.5" title={absenceReason || 'בקשת יציאה'}>
                                                                                                        {absenceReason
                                                                                                            ? (absenceReason === 'EMPTY_REASON' ? 'בקשת יציאה' : absenceReason)
                                                                                                            : 'בקשת יציאה'
                                                                                                        }
                                                                                                    </span>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                } else if (status === 'arrival') {
                                                                                    // Explicit Arrival
                                                                                    const ov = manualOverrides[`${person.id}-${dateKey}`];
                                                                                    const time = ov?.startTime || userArrivalHour;
                                                                                    const absenceReason = absenceLookup.get(`${person.id}-${dateKey}`);

                                                                                    cellClass = "bg-emerald-50 text-emerald-800 border-l border-emerald-100";
                                                                                    content = (
                                                                                        <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                            <span className="font-bold mb-0.5">הגעה</span>
                                                                                            <span className="text-[9px]">{time}</span>
                                                                                            {absenceReason && (
                                                                                                <span className="text-[9px] font-bold truncate max-w-full px-0.5 mt-0.5 block opacity-100" title={absenceReason}>
                                                                                                    {absenceReason === 'EMPTY_REASON' ? 'בקשת יציאה' : absenceReason}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                } else if (status === 'departure') {
                                                                                    // Explicit Departure
                                                                                    const ov = manualOverrides[`${person.id}-${dateKey}`];
                                                                                    const time = ov?.endTime || userDepartureHour;
                                                                                    const absenceReason = absenceLookup.get(`${person.id}-${dateKey}`);

                                                                                    cellClass = "bg-amber-50 text-amber-900 border-l border-amber-100";
                                                                                    content = (
                                                                                        <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                            <span className="font-bold mb-0.5">יציאה</span>
                                                                                            <span className="text-[9px]">{time}</span>
                                                                                            {absenceReason && (
                                                                                                <span className="text-[9px] font-bold truncate max-w-full px-0.5 mt-0.5 block opacity-100" title={absenceReason}>
                                                                                                    {absenceReason === 'EMPTY_REASON' ? 'בקשת יציאה' : absenceReason}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                } else if (status === 'base') {
                                                                                    // Base Day 
                                                                                    // Check for Implicit Arrival (Base day following Home/Unavailable)
                                                                                    const isOverridden = manualOverrides[`${person.id}-${dateKey}`];
                                                                                    const isPrevHome = prevStatus === 'home' || prevStatus === 'unavailable';
                                                                                    const absenceReason = absenceLookup.get(`${person.id}-${dateKey}`);

                                                                                    if (!isOverridden && isPrevHome && !absenceReason) {
                                                                                        // ARRIVAL (Base day following Home)
                                                                                        cellClass = "bg-emerald-50 text-emerald-800 border-l border-emerald-100";
                                                                                        content = (
                                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] leading-none">
                                                                                                <span className="font-bold mb-0.5">הגעה</span>
                                                                                                <span className="text-[9px]">{userArrivalHour}</span>
                                                                                            </div>
                                                                                        );
                                                                                    } else {
                                                                                        // Full Base
                                                                                        // Check for Custom Times override
                                                                                        let label = "בבסיס";
                                                                                        let subLabel = "";

                                                                                        if (isOverridden && isOverridden.status === 'base' && isOverridden.startTime && isOverridden.endTime) {
                                                                                            if (isOverridden.startTime !== '00:00' || isOverridden.endTime !== '23:59') {
                                                                                                subLabel = `${isOverridden.startTime}-${isOverridden.endTime}`;
                                                                                            }
                                                                                        }

                                                                                        cellClass = "bg-green-100 text-green-800 border-l border-slate-100";
                                                                                        content = (
                                                                                            <div className="w-full h-full flex flex-col items-center justify-center text-[10px] items-center relative">
                                                                                                {absenceReason && (
                                                                                                    <div className="absolute top-[1px] left-[1px] text-red-600 animate-pulse">
                                                                                                        <AlertTriangle size={10} strokeWidth={3} />
                                                                                                    </div>
                                                                                                )}
                                                                                                <span className="font-bold">{label}</span>
                                                                                                {subLabel && <span className="text-[9px] font-mono">{subLabel}</span>}
                                                                                                {absenceReason && (
                                                                                                    <span className="text-[9px] font-bold truncate max-w-full px-0.5 mt-0.5 block text-green-900" title={absenceReason}>
                                                                                                        {absenceReason === 'EMPTY_REASON' ? 'בקשת יציאה' : absenceReason}
                                                                                                    </span>
                                                                                                )}
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

                                                                            // Create Range array
                                                                            const dateRange: string[] = [];
                                                                            for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
                                                                                dateRange.push(d.toLocaleDateString('en-CA'));
                                                                            }

                                                                            // Helper to resolve status for any date
                                                                            const getStatusForDate = (dateKey: string) => {
                                                                                // Check overrides first
                                                                                // Check overrides first
                                                                                if (manualOverrides[`${person.id}-${dateKey}`]) return manualOverrides[`${person.id}-${dateKey}`].status;
                                                                                const resStatus = result?.personStatuses?.[dateKey]?.[person.id];
                                                                                if (resStatus) return resStatus;
                                                                                const dbAvail = person.dailyAvailability?.[dateKey];
                                                                                if (dbAvail) return dbAvail.isAvailable ? 'base' : 'home';
                                                                                return 'base'; // Default
                                                                            };

                                                                            // Use full dateRange (No Trimming)
                                                                            // Use full dateRange (No Trimming)
                                                                            dateRange.forEach(k => {
                                                                                const currentStatus = getStatusForDate(k);
                                                                                if (currentStatus === 'home' || currentStatus === 'unavailable' || currentStatus === 'departure') {
                                                                                    homeCount++;
                                                                                } else {
                                                                                    baseCount++;
                                                                                }
                                                                            });

                                                                            const ratioStr = getArmyRatio(baseCount, homeCount);
                                                                            cells.push(
                                                                                <div key="summary-cell" className={`shrink-0 w-24 border-l border-slate-100 flex flex-col items-center justify-center sticky left-0 z-30 border-r border-slate-200/50 shadow-[1px_0_3px_rgba(0,0,0,0.05)] h-14 overflow-hidden border-b border-slate-300 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                                                                                    <div className="text-[10px] font-bold text-slate-600 leading-tight">
                                                                                        בסיס: <span className="text-green-600">{baseCount}</span>
                                                                                    </div>
                                                                                    <div className="text-[10px] font-bold text-slate-600 leading-tight">
                                                                                        בית: <span className="text-orange-600">{homeCount}</span>
                                                                                    </div>
                                                                                    <div className="text-[10px] font-bold text-slate-600 border-t border-slate-200/50 w-full text-center mt-0.5 pt-0.5 leading-tight">
                                                                                        יחס: <span dir="ltr" className="text-blue-600">{ratioStr}</span>
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
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            {/* Manual Edit Popover */}
            {/* Status Edit Modal (Replaces old Popover) */}
            {editingCell && (
                <StatusEditModal
                    isOpen={!!editingCell}
                    onClose={() => setEditingCell(null)}
                    date={editingCell.date}
                    personName={people.find(p => p.id === editingCell.personId)?.name}
                    defaultArrivalHour={userArrivalHour}
                    defaultDepartureHour={userDepartureHour}
                    disableJournal={true}
                    currentAvailability={(() => {
                        const pid = editingCell.personId;
                        const date = editingCell.date;
                        // 1. Check Manual Overrides
                        const ov = manualOverrides[`${pid}-${date}`];
                        if (ov) {
                            // Fix: Ensure we only pass 'base' | 'home' to the modal prop
                            const rawStatus = ov.status;
                            const isBaseOrArrival = rawStatus === 'base' || rawStatus === 'arrival' || rawStatus === 'departure';
                            return {
                                date,
                                status: isBaseOrArrival ? 'base' : 'home',
                                isAvailable: isBaseOrArrival,
                                startHour: ov.startTime,
                                endHour: ov.endTime
                            };
                        }

                        // 2. Check Result (Generated Status)
                        // If generated status exists, we might want to respect it as initial state
                        const resStatus = result?.personStatuses?.[date]?.[pid];
                        if (resStatus) {
                            const isBase = resStatus === 'base' || resStatus === 'arrival';
                            return {
                                date,
                                status: isBase ? 'base' : 'home',
                                isAvailable: isBase,
                                startHour: '00:00', // We don't track exact times in simple result string unless we dive deeper
                                endHour: '23:59'
                            };
                        }

                        // 3. Check DB Availability
                        const p = people.find(x => x.id === pid);
                        const dbAvail = p?.dailyAvailability?.[date];
                        if (dbAvail) return dbAvail;

                        // Default Base
                        return { date, isAvailable: true, status: 'base' };
                    })()}
                    onApply={(status, times, blocks) => {
                        if (!editingCell) return;
                        let finalStatus = status as string;

                        // Logic to infer 'arrival'/'departure' from time overrides
                        if (status === 'base') {
                            if (times && times.start !== '00:00' && times.start !== '10:00') {
                                finalStatus = 'arrival';
                            }
                            if (times && times.end !== '23:59') {
                                finalStatus = 'departure';
                            }
                        }

                        // Strict time checks
                        if (times && times.start > '00:00' && times.end === '23:59') finalStatus = 'arrival';
                        if (times && times.end < '23:59' && times.start === '00:00') finalStatus = 'departure';

                        const override = {
                            status: finalStatus,
                            startTime: times?.start || '00:00',
                            endTime: times?.end || '23:59'
                        };

                        const key = `${editingCell.personId}-${editingCell.date}`;
                        setManualOverrides(prev => ({
                            ...prev,
                            [key]: override
                        }));
                        setEditingCell(null);
                    }}
                />
            )}

            {/* Staffing Analysis Modal */}
            <Modal
                isOpen={showTaskAnalysis}
                onClose={() => setShowTaskAnalysis(false)}
                title={
                    <div className="flex items-center gap-2">
                        <Calculator size={20} className="text-blue-600" />
                        <span>ניתוח נגזרות משימה</span>
                    </div>
                }
                size="xl"
            >
                <div className="py-4">
                    <StaffingAnalysis
                        tasks={tasks}
                        totalPeople={people.length}
                        viewStartDate={new Date(startDate)}
                        viewEndDate={new Date(endDate)}
                    />
                </div>
            </Modal>

            {/* Warning Modal */}
            <Modal
                isOpen={warningModal.isOpen}
                onClose={() => setWarningModal(prev => ({ ...prev, isOpen: false }))}
                title="שים לב: חריגות בשיבוץ"
                size="md"
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="ghost" onClick={() => setWarningModal(prev => ({ ...prev, isOpen: false }))}>תקן שיבוץ</Button>
                        <Button onClick={performSave} className="bg-amber-600 hover:bg-amber-700 text-white">שמור למרות החריגות</Button>
                    </div>
                }
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
                </div>
            </Modal>

            {/* Constraints Details Modal */}
            <Modal
                isOpen={showConstraintDetails}
                onClose={() => setShowConstraintDetails(false)}
                title="פירוט אילוצים וחריגות"
                size="md"
                footer={<Button variant="ghost" className="w-full" onClick={() => setShowConstraintDetails(false)}>סגור</Button>}
            >
                <div className="p-4 space-y-4">
                    {result && result.stats.constraintStats && (
                        <div className={`p-4 rounded-xl border flex flex-col items-center text-center gap-2 ${result.stats.constraintStats.percentage === 100 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                            {result.stats.constraintStats.percentage === 100 ? (
                                <CheckCircle size={48} className="text-green-500 mb-2" />
                            ) : (
                                <AlertTriangle size={48} className="text-amber-500 mb-2" />
                            )}
                            <div className="text-2xl font-black">
                                {result.stats.constraintStats.percentage}%
                            </div>
                            <div className="text-slate-600 font-bold">
                                יעד עמידה באילוצים
                            </div>
                            <div className="text-sm text-slate-500">
                                המערכת הצליחה למלא {result.stats.constraintStats.met} מתוך {result.stats.constraintStats.total} אילוצים אישיים שדווחו.
                            </div>
                        </div>
                    )}

                    {result?.unfulfilledConstraints && result.unfulfilledConstraints.length > 0 ? (
                        <div className="space-y-2">
                            <h4 className="font-bold text-slate-800 text-sm">חריגות שנמצאו:</h4>
                            <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                                {result.unfulfilledConstraints.map((c, idx) => {
                                    const p = people.find(p => p.id === c.personId);
                                    return (
                                        <div key={idx} className="p-3 flex gap-3 bg-white">
                                            <div className="mt-1"><XCircle size={16} className="text-red-500" /></div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">{p?.name || 'לוחם לא ידוע'}</div>
                                                <div className="text-xs text-slate-500">{new Date(c.date).toLocaleDateString('he-IL')} • {c.reason}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8 text-slate-400">
                            לא נמצאו חריגות. כל הלוחמים שובצו בהתאם לאילוצים שלהם.
                        </div>
                    )}
                </div>
            </Modal>

            {/* Stats Details Modal */}
            <Modal
                isOpen={showStatsDetails}
                onClose={() => setShowStatsDetails(false)}
                title="סטטיסטיקות שיבוץ (ממוצע ללוחם)"
                size="sm"
                footer={<Button variant="ghost" className="w-full" onClick={() => setShowStatsDetails(false)}>סגור</Button>}
            >
                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center text-center gap-1">
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">ימים בבסיס</div>
                            <div className="text-3xl font-black text-emerald-600">{rosterStats.avgBase}</div>
                            <div className="text-[10px] text-emerald-800/60">ממוצע לתקופה</div>
                        </div>
                        <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex flex-col items-center text-center gap-1">
                            <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">ימים בבית</div>
                            <div className="text-3xl font-black text-rose-600">{rosterStats.avgHome}</div>
                            <div className="text-[10px] text-rose-800/60">ממוצע לתקופה</div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center text-center gap-2">
                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">יחס כולל (תקן)</div>
                        <div className="text-4xl font-black text-blue-600" dir="ltr">{rosterStats.ratioStr}</div>
                        <div className="text-xs text-blue-800/60 max-w-[200px]">
                            יחס זה מייצג את הממוצע הכולל של כלל הלוחמים בצוותים שנבחרו
                        </div>
                    </div>
                </div>
            </Modal>
        </>
    );
};
