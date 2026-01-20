import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, SchedulingConstraint, InterPersonConstraint } from '../../types';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import {
    X, Plus, MagnifyingGlass as Search, MagicWand as Wand2, ArrowCounterClockwise as RotateCcw, Sparkle as Sparkles, WarningCircle,
    CalendarBlank as CalendarIcon, CheckCircle, Users, PencilSimple as Pencil, Warning as AlertTriangle, ArrowLeft,
    ClockAfternoon, ClockCounterClockwise, Info, IdentificationCard, House, Prohibit
} from '@phosphor-icons/react';
import { Tooltip } from '../../components/ui/Tooltip';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { getPersonInitials } from '../../utils/nameUtils';
import { TimePicker } from '../../components/ui/DatePicker';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';
import { PersonInfoModal } from './PersonInfoModal';
import { OrganizationSettings } from '../../types';

interface AssignmentModalProps {
    selectedShift: Shift;
    task: TaskTemplate;
    people: Person[];
    roles: Role[];
    teams: Team[];
    shifts: Shift[];
    selectedDate: Date;
    teamRotations: TeamRotation[];
    isViewer: boolean;
    onClose: () => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onUpdateShift: (shift: Shift) => void;
    onToggleCancelShift: (shiftId: string) => void;
    constraints: SchedulingConstraint[];
    interPersonConstraints?: InterPersonConstraint[];
    settings?: OrganizationSettings | null;
    absences?: import('../../types').Absence[];
    hourlyBlockages?: import('../../types').HourlyBlockage[];
    taskTemplates?: TaskTemplate[];
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
    selectedShift,
    task,
    people,
    roles,
    teams,
    shifts,
    selectedDate,
    teamRotations,
    isViewer,
    onClose,
    onAssign,
    onUnassign,
    onUpdateShift,
    onToggleCancelShift,
    constraints,
    interPersonConstraints = [],
    settings,
    absences = [],
    hourlyBlockages = [],
    taskTemplates = []
}) => {
    // -------------------------------------------------------------------------
    // 1. STATE & HOOKS (Preserved Logic)
    // -------------------------------------------------------------------------
    if (!task) return null;

    const { showToast } = useToast();
    const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());

    const [activeMobileTab, setActiveMobileTab] = useState<'available' | 'assigned'>('assigned');
    const [selectedPersonForInfo, setSelectedPersonForInfo] = useState<Person | null>(null);
    const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

    // Time Editing State
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');

    // Confirmation State
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        confirmText?: string;
        type?: 'danger' | 'warning' | 'info';
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Initialize Time
    useEffect(() => {
        if (selectedShift) {
            try {
                setNewStart(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
                setNewEnd(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
            } catch (e) {
                console.error("Invalid time format", e);
            }
        }
    }, [selectedShift]);

    // -------------------------------------------------------------------------
    // 2. DATA PROCESSING (Preserved Logic)
    // -------------------------------------------------------------------------
    const toggleTeam = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    const assignedPeople = useMemo(() =>
        selectedShift
            ? selectedShift.assignedPersonIds
                .map(id => people.find(p => p.id === id))
                .filter(Boolean)
                .sort((a, b) => a!.name.localeCompare(b!.name, 'he')) as Person[]
            : []
        , [selectedShift, people]);

    // Check for attendance conflicts among already assigned people (with reasons)
    const assignedConflicts = useMemo(() => {
        if (!selectedShift || !assignedPeople.length) return [];

        const conflicts: { person: Person; reason: string }[] = [];

        assignedPeople.forEach(p => {
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);
            const shiftStart = new Date(selectedShift.startTime);
            const shiftEnd = new Date(selectedShift.endTime);
            const dayStart = new Date(selectedDate);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const relevantShiftStart = new Date(Math.max(shiftStart.getTime(), dayStart.getTime()));
            const relevantShiftEnd = new Date(Math.min(shiftEnd.getTime(), dayEnd.getTime()));

            // 1. Check if status is home
            if (availability.status === 'home' || (availability.source === 'manual' && !availability.isAvailable)) {
                let reason = 'לא זמין';
                if (availability.source === 'absence') {
                    const block = availability.unavailableBlocks?.find(b => b.type === 'absence' && b.status === 'approved');
                    reason = `בבית (${block?.reason || 'היעדרות'})`;
                } else if (availability.source === 'rotation') {
                    reason = 'בבית (סבב צוותי)';
                } else if (availability.source === 'personal_rotation') {
                    reason = 'בבית (סבב אישי)';
                } else if (availability.source === 'manual' || availability.source === 'last_manual') {
                    reason = 'בבית (עדכון ידני)';
                }
                conflicts.push({ person: p, reason });
                return;
            }

            // 2. Check for daily window (arrival/departure)
            if (availability.startHour || availability.endHour) {
                const [startH, startM] = (availability.startHour || '00:00').split(':').map(Number);
                const [endH, endM] = (availability.endHour || '23:59').split(':').map(Number);

                const availStart = new Date(dayStart);
                availStart.setHours(startH, startM, 0, 0);
                const availEnd = new Date(dayStart);
                availEnd.setHours(endH, endM, 0, 0);
                if (endH === 0 && endM === 0) availEnd.setDate(availEnd.getDate() + 1);
                else if (availEnd < availStart) availEnd.setDate(availEnd.getDate() + 1);

                if (relevantShiftStart < relevantShiftEnd) {
                    const isEndOfDay = (endH === 23 && endM === 59) || (endH === 0 && endM === 0);
                    if (relevantShiftStart < availStart) {
                        conflicts.push({ person: p, reason: `טרם הגיע (צפוי ב-${availability.startHour})` });
                        return;
                    } else if (!isEndOfDay && relevantShiftEnd > availEnd) {
                        conflicts.push({ person: p, reason: `יציאה (יוצא ב-${availability.endHour})` });
                        return;
                    }
                }
            }

            // 3. Check for hourly blockages overlap
            if (availability.unavailableBlocks && availability.unavailableBlocks.length > 0) {
                const overlappingBlock = availability.unavailableBlocks.find(block => {
                    const [bh, bm] = block.start.split(':').map(Number);
                    const [eh, em] = block.end.split(':').map(Number);
                    const bs = new Date(shiftStart); bs.setHours(bh, bm, 0, 0);
                    const be = new Date(shiftStart); be.setHours(eh, em, 0, 0);
                    if (be < bs) be.setDate(be.getDate() + 1);
                    return bs < shiftEnd && be > shiftStart;
                });

                if (overlappingBlock) {
                    conflicts.push({ person: p, reason: `חסימה שעתית (${overlappingBlock.reason || 'מושבת'})` });
                    return;
                }
            }
        });

        return conflicts;
    }, [assignedPeople, selectedDate, teamRotations, absences, hourlyBlockages, selectedShift]);

    const overlappingShifts = useMemo(() => {
        if (!selectedShift) return [];
        const thisStart = new Date(selectedShift.startTime);
        const thisEnd = new Date(selectedShift.endTime);

        return shifts.filter(s => {
            if (s.id === selectedShift.id) return false;
            if (s.isCancelled) return false;
            const sStart = new Date(s.startTime);
            const sEnd = new Date(s.endTime);
            return sStart < thisEnd && sEnd > thisStart;
        });
    }, [shifts, selectedShift]);

    const availablePeopleWithMetrics = useMemo(() => {
        if (!selectedShift || !task) return [];

        const filtered = people.filter(p => {
            if (p.isActive === false) return false;
            if (selectedShift.assignedPersonIds.includes(p.id)) return false;

            // Search Filter (Search is KING)
            const searchMatch = !searchTerm ||
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.phone && p.phone.includes(searchTerm));
            if (!searchMatch) return false;

            // Basic Filters (Role/Team)
            if (selectedRoleFilter) {
                const currentRoleIds = p.roleIds || [p.roleId];
                if (!currentRoleIds.includes(selectedRoleFilter)) return false;
            }
            if (selectedTeamFilter) {
                if (p.teamId !== selectedTeamFilter) return false;
            }

            // Availability Check
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);

            let isAvailable = true;
            if (availability.status === 'home') isAvailable = false;
            else if (availability.source === 'manual') {
                if (!availability.isAvailable) isAvailable = false;
            } else if (!availability.isAvailable) {
                isAvailable = false;
            }

            // Strict Time Window Check
            if (isAvailable && (availability.startHour || availability.endHour)) {
                const [startH, startM] = (availability.startHour || '00:00').split(':').map(Number);
                const [endH, endM] = (availability.endHour || '23:59').split(':').map(Number);
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);
                const availStart = new Date(dayStart);
                availStart.setHours(startH, startM, 0, 0);
                const availEnd = new Date(dayStart);
                availEnd.setHours(endH, endM, 0, 0);
                if (endH === 0 && endM === 0) availEnd.setDate(availEnd.getDate() + 1);
                else if (availEnd < availStart) availEnd.setDate(availEnd.getDate() + 1);

                const shiftStart = new Date(selectedShift.startTime);
                const shiftEnd = new Date(selectedShift.endTime);
                const relevantShiftStart = new Date(Math.max(shiftStart.getTime(), dayStart.getTime()));
                const relevantShiftEnd = new Date(Math.min(shiftEnd.getTime(), dayEnd.getTime()));

                if (relevantShiftStart < relevantShiftEnd) {
                    const isEndOfDay = (endH === 23 && endM === 59) || (endH === 0 && endM === 0);
                    if (relevantShiftStart < availStart) isAvailable = false;
                    else if (!isEndOfDay && relevantShiftEnd > availEnd) isAvailable = false;
                }
            }

            // Hourly Blockages
            if (isAvailable && availability.unavailableBlocks && availability.unavailableBlocks.length > 0) {
                const shiftStart = new Date(selectedShift.startTime);
                const shiftEnd = new Date(selectedShift.endTime);
                const hasBlockageOverlap = availability.unavailableBlocks.some(block => {
                    const [blockStartHour, blockStartMin] = block.start.split(':').map(Number);
                    const [blockEndHour, blockEndMin] = block.end.split(':').map(Number);
                    const blockStart = new Date(shiftStart);
                    blockStart.setHours(blockStartHour, blockStartMin, 0, 0);
                    const blockEnd = new Date(shiftStart);
                    blockEnd.setHours(blockEndHour, blockEndMin, 0, 0);
                    if (blockEnd < blockStart) blockEnd.setDate(blockEnd.getDate() + 1);
                    return blockStart < shiftEnd && blockEnd > shiftStart;
                });
                if (hasBlockageOverlap) isAvailable = false;
            }

            // CRITICAL: If searching, show even if unavailable.
            // If NOT searching, only show available.
            if (!isAvailable && !searchTerm) return false;

            return true;
        });

        const thisStart = new Date(selectedShift.startTime);
        const thisEnd = new Date(selectedShift.endTime);
        const targetDateKey = selectedDate.toLocaleDateString('en-CA');

        const withMetrics = filtered.map(p => {
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);
            let isAvailable = true;
            let isHome = false;
            let isBlocked = false;

            if (availability.status === 'home' || availability.status === 'undefined') {
                isAvailable = false;
                isHome = true;
            } else if (availability.source === 'manual') {
                if (!availability.isAvailable) isAvailable = false;
            } else if (!availability.isAvailable) {
                isAvailable = false;
            }

            // Strict Time Window Check
            if (isAvailable && (availability.startHour || availability.endHour)) {
                const [startH, startM] = (availability.startHour || '00:00').split(':').map(Number);
                const [endH, endM] = (availability.endHour || '23:59').split(':').map(Number);
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);
                const availStart = new Date(dayStart);
                availStart.setHours(startH, startM, 0, 0);
                const availEnd = new Date(dayStart);
                availEnd.setHours(endH, endM, 0, 0);
                if (endH === 0 && endM === 0) availEnd.setDate(availEnd.getDate() + 1);
                else if (availEnd < availStart) availEnd.setDate(availEnd.getDate() + 1);

                const shiftStart = new Date(selectedShift.startTime);
                const shiftEnd = new Date(selectedShift.endTime);
                const relevantShiftStart = new Date(Math.max(shiftStart.getTime(), dayStart.getTime()));
                const relevantShiftEnd = new Date(Math.min(shiftEnd.getTime(), dayEnd.getTime()));

                if (relevantShiftStart < relevantShiftEnd) {
                    const isEndOfDay = (endH === 23 && endM === 59) || (endH === 0 && endM === 0);
                    if (relevantShiftStart < availStart || (!isEndOfDay && relevantShiftEnd > availEnd)) {
                        isAvailable = false;
                        isBlocked = true;
                    }
                }
            }

            // Hourly Blockages
            if (isAvailable && availability.unavailableBlocks && availability.unavailableBlocks.length > 0) {
                const shiftStart = new Date(selectedShift.startTime);
                const shiftEnd = new Date(selectedShift.endTime);
                const hasBlockageOverlap = availability.unavailableBlocks.some(block => {
                    const [bh, bm] = block.start.split(':').map(Number);
                    const [eh, em] = block.end.split(':').map(Number);
                    const bs = new Date(shiftStart); bs.setHours(bh, bm, 0, 0);
                    const be = new Date(shiftStart); be.setHours(eh, em, 0, 0);
                    if (be < bs) be.setDate(be.getDate() + 1);
                    return bs < shiftEnd && be > shiftStart;
                });
                if (hasBlockageOverlap) {
                    isAvailable = false;
                    isBlocked = true;
                }
            }

            const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id) && !s.isCancelled);

            const lastShift = personShifts
                .filter(s => new Date(s.endTime) <= thisStart)
                .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

            const nextShift = personShifts
                .filter(s => new Date(s.startTime) >= thisEnd)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

            const dailyLoad = personShifts.reduce((total, s) => {
                if (new Date(s.startTime).toLocaleDateString('en-CA') === targetDateKey) {
                    const durationInMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
                    return total + (durationInMs / (1000 * 60 * 60));
                }
                return total;
            }, 0);

            const hasOverlap = overlappingShifts.some(s => s.assignedPersonIds.includes(p.id));

            return {
                person: p,
                metrics: {
                    lastShift,
                    nextShift,
                    dailyLoad,
                    hasOverlap,
                    isAvailable,
                    isHome,
                    isBlocked,
                    availabilityStatus: availability.status,
                    hoursSinceLast: lastShift ? (thisStart.getTime() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60) : Infinity,
                    liveHoursSinceLast: lastShift ? (Date.now() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60) : Infinity,
                    hoursUntilNext: nextShift ? (new Date(nextShift.startTime).getTime() - thisEnd.getTime()) / (1000 * 60 * 60) : Infinity,
                    requiredRest: lastShift?.requirements?.minRest || 8,
                    isRestSufficient: lastShift
                        ? ((thisStart.getTime() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60)) >= (lastShift.requirements?.minRest || 8)
                        : true
                }
            };
        });

        return withMetrics.sort((a, b) => {
            // Priority 0: Available first (if not searching specifically)
            if (a.metrics.isAvailable !== b.metrics.isAvailable) {
                return a.metrics.isAvailable ? -1 : 1;
            }

            // Priority 1: No Overlap first
            if (a.metrics.hasOverlap !== b.metrics.hasOverlap) {
                return a.metrics.hasOverlap ? 1 : -1;
            }

            // 2. Lower Daily Load first
            if (a.metrics.dailyLoad !== b.metrics.dailyLoad) {
                return a.metrics.dailyLoad - b.metrics.dailyLoad;
            }

            // 3. More free time before next task first
            if (a.metrics.hoursUntilNext !== b.metrics.hoursUntilNext) {
                return b.metrics.hoursUntilNext - a.metrics.hoursUntilNext;
            }

            // 4. Fallback to name
            return a.person.name.localeCompare(b.person.name, 'he');
        });
    }, [people, selectedShift, selectedDate, searchTerm, task, overlappingShifts, selectedRoleFilter, selectedTeamFilter, teamRotations, constraints, absences, hourlyBlockages, shifts]);

    const { roleComposition, allocationMap, totalRequired } = useMemo(() => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const totalRequired = roleComposition.reduce((sum, rc) => sum + rc.count, 0) || selectedShift.requirements?.requiredPeople || segment?.requiredPeople || 1;

        const map = new Map<string, number>();
        if (roleComposition.length > 0) {
            const pool = [...assignedPeople];
            const prioritizedReqs = [...roleComposition].sort((a, b) => a.count - b.count);

            prioritizedReqs.forEach(rc => {
                const needed = rc.count;
                let taken = 0;
                const candidates = pool.filter(p => (p.roleIds || [p.roleId]).includes(rc.roleId));
                const toTake = candidates.slice(0, needed);
                toTake.forEach(p => {
                    const idx = pool.findIndex(x => x.id === p.id);
                    if (idx !== -1) pool.splice(idx, 1);
                    taken++;
                });
                map.set(rc.roleId, (map.get(rc.roleId) || 0) + taken);
            });

            pool.forEach(p => {
                const match = roleComposition.find(rc => (p.roleIds || [p.roleId]).includes(rc.roleId));
                if (match) {
                    map.set(match.roleId, (map.get(match.roleId) || 0) + 1);
                }
            });
        }
        return { roleComposition, allocationMap: map, totalRequired };
    }, [task, selectedShift, assignedPeople]);

    // -------------------------------------------------------------------------
    // 3. ACTION HANDLERS (Preserved)
    // -------------------------------------------------------------------------
    const handleSuggestBest = () => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const currentAssigned = assignedPeople;
        const requiredRest = segment?.minRestHoursAfter || 8;

        const missingRoleIds = roleComposition.filter(rc => {
            const currentCount = currentAssigned.filter(p => {
                const rIds = p.roleIds || [p.roleId];
                return rIds.includes(rc.roleId);
            }).length;
            return currentCount < rc.count;
        }).map(rc => rc.roleId);

        const candidates = people.map(p => {
            let score = 0;
            const reasons: string[] = [];

            if (p.isActive === false) score -= 20000;
            if (selectedShift.assignedPersonIds.includes(p.id)) score -= 10000;

            // Strict Availability Check (Same as list)
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);
            if (availability.status === 'home') score -= 20000;
            if (availability.source === 'manual' && availability.isAvailable) {
                if (!availability.isAvailable) score -= 20000;
            } else if (!availability.isAvailable) {
                score -= 20000;
            }

            // Strict Time Window Check
            const shiftStart = new Date(selectedShift.startTime);
            const shiftEnd = new Date(selectedShift.endTime);

            if (availability.startHour || availability.endHour) {
                const [startH, startM] = (availability.startHour || '00:00').split(':').map(Number);
                const [endH, endM] = (availability.endHour || '23:59').split(':').map(Number);

                // Construct avail times RELATIVE TO THE SELECTED DATE (View Context)
                const dayStart = new Date(selectedDate);
                dayStart.setHours(0, 0, 0, 0);

                const dayEnd = new Date(dayStart);
                dayEnd.setHours(23, 59, 59, 999);

                const availStart = new Date(dayStart);
                availStart.setHours(startH, startM, 0, 0);

                const availEnd = new Date(dayStart);
                availEnd.setHours(endH, endM, 0, 0);

                if (endH === 0 && endM === 0) {
                    availEnd.setDate(availEnd.getDate() + 1);
                } else if (availEnd < availStart) {
                    availEnd.setDate(availEnd.getDate() + 1);
                }

                const isEndOfDay = (endH === 23 && endM === 59) || (endH === 0 && endM === 0);

                // Calculate the "Relevant Shift Window" for THIS DAY
                const relevantShiftStart = new Date(Math.max(shiftStart.getTime(), dayStart.getTime()));
                const relevantShiftEnd = new Date(Math.min(shiftEnd.getTime(), dayEnd.getTime()));

                // If shift is entirely outside this day, skip strict check
                if (relevantShiftStart < relevantShiftEnd) {
                    if (relevantShiftStart < availStart) {
                        score -= 20000;
                        reasons.push('מחוץ לשעות זמינות');
                    } else if (!isEndOfDay && relevantShiftEnd > availEnd) {
                        score -= 20000;
                        reasons.push('מחוץ לשעות זמינות');
                    }
                }
            }

            // Hourly Blockages
            if (availability.unavailableBlocks && availability.unavailableBlocks.length > 0) {
                const hasBlockageOverlap = availability.unavailableBlocks.some(block => {
                    const [blockStartHour, blockStartMin] = block.start.split(':').map(Number);
                    const [blockEndHour, blockEndMin] = block.end.split(':').map(Number);
                    const blockStart = new Date(shiftStart);
                    blockStart.setHours(blockStartHour, blockStartMin, 0, 0);
                    const blockEnd = new Date(shiftStart);
                    blockEnd.setHours(blockEndHour, blockEndMin, 0, 0);

                    if (blockEnd < blockStart) blockEnd.setDate(blockEnd.getDate() + 1);
                    return blockStart < shiftEnd && blockEnd > shiftStart;
                });
                if (hasBlockageOverlap) {
                    score -= 20000;
                    reasons.push('חסימה');
                }
            }

            const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id) && !s.isCancelled);
            const thisStart = new Date(selectedShift.startTime);
            const thisEnd = new Date(selectedShift.endTime);

            const hasOverlap = personShifts.some(s => {
                const sStart = new Date(s.startTime);
                const sEnd = new Date(s.endTime);
                return sStart < thisEnd && sEnd > thisStart;
            });
            if (hasOverlap) { score -= 5000; reasons.push('חפיפה'); }

            const nextShift = personShifts
                .filter(s => new Date(s.startTime) >= thisEnd)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

            if (nextShift) {
                const nextStart = new Date(nextShift.startTime);
                const gapMs = nextStart.getTime() - thisEnd.getTime();
                const gapHours = gapMs / (1000 * 60 * 60);

                if (gapHours < requiredRest) {
                    score -= 3000; reasons.push(`מנוחה קצרה (${gapHours.toFixed(1)})`);
                } else if (gapHours < requiredRest + 4) {
                    score -= 500; reasons.push(`מנוחה גבולית`);
                }
            }

            if (missingRoleIds.length > 0) {
                const fillsMissingRole = (p.roleIds || [p.roleId]).some(rid => missingRoleIds.includes(rid));
                if (fillsMissingRole) { score += 500; reasons.push('מתאים לתפקיד'); }
            }

            if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
                score -= 2000; reasons.push('צוות לא תואם');
            }

            return { person: p, score, reasons };
        });

        const validCandidates = candidates
            .filter(c => c.score > -6000)
            .sort((a, b) => b.score - a.score)
            .map(c => ({
                person: c.person,
                reason: c.reasons.length > 0 ? c.reasons.join(', ') : 'זמינות אופטימלית'
            }));

        if (validCandidates.length > 0) {
            setSuggestedCandidates(validCandidates);
            setSuggestionIndex(0);
            return true;
        } else {
            showToast('לא נמצאו מועמדים מתאימים', 'error');
            return false;
        }
    };

    const handleNextSuggestion = () => {
        setSuggestionIndex(prev => (prev + 1) % suggestedCandidates.length);
    };

    const handleSaveTime = () => {
        if (!newStart || !newEnd) return;
        const [sh, sm] = newStart.split(':').map(Number);
        const [eh, em] = newEnd.split(':').map(Number);

        const s = new Date(selectedShift.startTime);
        s.setHours(sh, sm);
        const e = new Date(selectedShift.endTime);
        e.setHours(eh, em);

        if (e.getTime() < s.getTime()) { e.setDate(e.getDate() + 1); }
        else if (e.getDate() !== s.getDate()) {
            const diff = new Date(selectedShift.endTime).getDate() - new Date(selectedShift.startTime).getDate();
            if (diff > 0) e.setDate(s.getDate() + diff);
            else e.setDate(s.getDate());
        }

        onUpdateShift({ ...selectedShift, startTime: s.toISOString(), endTime: e.toISOString() });
        setIsEditingTime(false);
    };

    const handleAttemptAssign = (personId: string) => {
        if (isViewer) return;
        const p = people.find(x => x.id === personId);
        if (!p) return;

        const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);
        let isCurrentlyAvailable = true;
        let unavailReason = '';

        if (availability.status === 'home') {
            isCurrentlyAvailable = false;
            unavailReason = 'נמצא בבית';
        } else if (!availability.isAvailable) {
            isCurrentlyAvailable = false;
            unavailReason = 'לא זמין';
        } else {
            // Check for specific task window blockage
            const shiftStart = new Date(selectedShift.startTime);
            const shiftEnd = new Date(selectedShift.endTime);
            if (availability.unavailableBlocks?.some(block => {
                const [bh, bm] = block.start.split(':').map(Number);
                const [eh, em] = block.end.split(':').map(Number);
                const bs = new Date(shiftStart); bs.setHours(bh, bm, 0, 0);
                const be = new Date(shiftStart); be.setHours(eh, em, 0, 0);
                if (be < bs) be.setDate(be.getDate() + 1);
                return bs < shiftEnd && be > shiftStart;
            })) {
                isCurrentlyAvailable = false;
                unavailReason = 'חסימה בלו״ז';
            }
        }

        if (!isCurrentlyAvailable) {
            showToast(`${p.name} ${unavailReason} ולא ניתן לשבצו`, 'error');
            return;
        }

        performCapacityChecks(p);
    };

    const performCapacityChecks = (p: Person) => {
        if (assignedPeople.length >= totalRequired) {
            setConfirmationState({
                isOpen: true,
                title: 'חריגה מהתקן',
                message: `המשמרת מלאה (${assignedPeople.length}/${totalRequired}). הוסף בכל זאת?`,
                confirmText: "הוסף",
                type: "warning",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    checkTeamAndAssign(p);
                }
            });
            return;
        }

        const userRoleIds = p.roleIds || [p.roleId];
        const openMatchingRoles = roleComposition.filter(rc =>
            userRoleIds.includes(rc.roleId) && (allocationMap.get(rc.roleId) || 0) < rc.count
        );

        if (openMatchingRoles.length === 0 && userRoleIds.some(rid => roleComposition.some(rc => rc.roleId === rid))) {
            setConfirmationState({
                isOpen: true,
                title: 'חריגה מתקן תפקיד',
                message: `תפקיד זה כבר מלא. לשבץ בכל זאת?`,
                confirmText: "שבץ",
                type: "warning",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    checkRestAndAssign(p);
                }
            });
            return;
        }
        checkRestAndAssign(p);
    };

    const checkRestAndAssign = (p: Person) => {
        // Check for insufficient rest from PREVIOUS shift
        const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id) && !s.isCancelled && s.id !== selectedShift.id);
        const thisStart = new Date(selectedShift.startTime);

        // Find the last shift that ended before this one starts
        const lastShift = personShifts
            .filter(s => new Date(s.endTime) <= thisStart)
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

        if (lastShift) {
            const lastEnd = new Date(lastShift.endTime);
            const gapMs = thisStart.getTime() - lastEnd.getTime();
            const gapHours = gapMs / (1000 * 60 * 60);

            // Use the previous shift's defined rest requirement, or default to 8 hours
            const requiredRest = lastShift.requirements?.minRest || 8;

            if (gapHours < requiredRest) {
                setConfirmationState({
                    isOpen: true,
                    title: 'התראת מנוחה לא מספקת',
                    message: `החייל סיים משמרת קודמת לפני ${Math.floor(gapHours)} שעות (נדרש: ${requiredRest}). לשבץ בכל זאת?`,
                    confirmText: "שבץ בכל זאת",
                    type: "danger",
                    onConfirm: () => {
                        setConfirmationState(prev => ({ ...prev, isOpen: false }));
                        checkInterPersonAndAssign(p);
                    }
                });
                return;
            }
        }

        checkInterPersonAndAssign(p);
    };

    const checkInterPersonAndAssign = (p: Person) => {
        // Find if this assignment violates any inter-person constraints in organization settings
        const violations = (interPersonConstraints || []).filter(ipc => {
            if (ipc.type !== 'forbidden_together') return false;

            // Check if current person matches condition A or B
            const matchesA = p.customFields?.[ipc.fieldA] === ipc.valueA;
            const matchesB = p.customFields?.[ipc.fieldB] === ipc.valueB;

            if (matchesA || matchesB) {
                // Check if any ALREADY ASSIGNED person in THIS SHIFT matches the other condition
                const assignedPeople = selectedShift.assignedPersonIds.map(id => people.find(ap => ap.id === id)).filter(Boolean);

                return assignedPeople.some(ap => {
                    const assignedMatchesA = ap?.customFields?.[ipc.fieldA] === ipc.valueA;
                    const assignedMatchesB = ap?.customFields?.[ipc.fieldB] === ipc.valueB;

                    if (matchesA && assignedMatchesB) return true;
                    if (matchesB && assignedMatchesA) return true;
                    return false;
                });
            }
            return false;
        });

        if (violations.length > 0) {
            const violationDesc = violations[0].description || "אילוץ בין-אישי";
            setConfirmationState({
                isOpen: true,
                title: 'סתירה באילוץ בין-אישי',
                message: `שיבוץ זה סותר את האילוץ: "${violationDesc}". האם ברצונך לשבץ בכל זאת?`,
                confirmText: "שבץ בכל זאת",
                type: "danger",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    checkTeamAndAssign(p);
                }
            });
            return;
        }

        checkTeamAndAssign(p);
    };

    const checkTeamAndAssign = (p: Person) => {
        if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
            setConfirmationState({
                isOpen: true,
                title: 'שיבוץ מחוץ לצוות',
                message: `חייל זה אינו שייך לצוות המשויך למשימה. המשך?`,
                confirmText: "שבץ",
                type: "warning",
                onConfirm: () => {
                    onAssign(selectedShift.id, p.id);
                    setSuggestedCandidates([]);
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                }
            });
            return;
        }
        onAssign(selectedShift.id, p.id);
        setSuggestedCandidates([]);
    };

    const currentSuggestion = suggestedCandidates[suggestionIndex];

    // -------------------------------------------------------------------------
    // 4. UI COMPONENTS (NEW DENSE LAYOUT)
    // -------------------------------------------------------------------------

    // --- UNIFIED MODAL UTILS ---
    const modalTitle = (
        <div className="flex flex-col gap-1 pr-2">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{task.name}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-500 font-bold">
                <div className="flex items-center gap-1.5 shrink-0">
                    <CalendarIcon size={14} className="text-slate-400" weight="bold" />
                    <span>{new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</span>
                </div>
                <span className="text-slate-300">|</span>
                {!isEditingTime ? (
                    <button
                        onClick={() => !isViewer && setIsEditingTime(true)}
                        className={`flex items-center gap-1.5 font-mono ${!isViewer ? 'hover:text-blue-600 cursor-pointer active:scale-95 transition-transform' : ''}`}
                    >
                        <span dir="ltr">
                            {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            -
                            {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isViewer && <Pencil size={12} className="opacity-50" weight="bold" />}
                    </button>
                ) : (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                        <TimePicker
                            label=""
                            value={newStart}
                            onChange={(val) => setNewStart(val)}
                            className="w-24"
                        />
                        <span>-</span>
                        <TimePicker
                            label=""
                            value={newEnd}
                            onChange={(val) => setNewEnd(val)}
                            className="w-24"
                        />
                        <button onClick={handleSaveTime} className="p-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors h-10 w-10 flex items-center justify-center"><CheckCircle size={20} weight="bold" /></button>
                        <button onClick={() => setIsEditingTime(false)} className="p-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors h-10 w-10 flex items-center justify-center"><X size={20} weight="bold" /></button>
                    </div>
                )}
            </div>
        </div>
    );

    const modalHeaderActions = !isViewer && (
        <button
            onClick={() => {
                const found = handleSuggestBest();
                if (found) showToast('נמצא שיבוץ מומלץ', 'success');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-[10px] md:text-xs font-black rounded-full hover:bg-blue-100 transition-all active:scale-95 shadow-sm border border-blue-100 uppercase tracking-wider"
        >
            <Wand2 size={16} weight="bold" />
            <span className="hidden sm:inline">הצעה חכמה</span>
        </button>
    );

    const modalFooter = (
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
            {/* Mobile Tab Switcher */}
            <div className="md:hidden flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 w-full mb-1">
                <button
                    onClick={() => setActiveMobileTab('available')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${activeMobileTab === 'available' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                >
                    <Search size={16} weight="bold" />
                    <span>מאגר פנוי</span>
                    <span className="bg-slate-200 text-slate-600 text-[10px] px-1.5 rounded-full ml-1">{availablePeopleWithMetrics.length}</span>
                </button>
                <button
                    onClick={() => setActiveMobileTab('assigned')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${activeMobileTab === 'assigned' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                >
                    <Users size={16} weight="bold" />
                    <span>משובצים</span>
                    <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 rounded-full ml-1">{assignedPeople.length}</span>
                </button>
            </div>

            <div className="flex items-center justify-between md:justify-end w-full gap-3">
                <span className="hidden md:inline text-sm font-bold text-slate-400">
                    {assignedPeople.length}/{totalRequired} משובצים
                </span>
                <Button
                    variant="primary"
                    onClick={onClose}
                    className="font-bold px-8 shadow-md shadow-blue-200"
                >
                    סיום וסגירה
                </Button>
            </div>
        </div>
    );

    return (
        <GenericModal
            isOpen={true}
            onClose={onClose}
            title={modalTitle}
            headerActions={modalHeaderActions}
            footer={modalFooter}
            size="2xl"
            scrollableContent={false}
            className="p-0 overflow-hidden flex flex-col h-[90vh] md:h-[85vh] md:max-h-[85vh]"
        >
            {/* --- CONFIRMATION MODAL --- */}
            <ConfirmationModal
                isOpen={confirmationState.isOpen}
                title={confirmationState.title}
                message={confirmationState.message}
                confirmText={confirmationState.confirmText}
                type={confirmationState.type as any || 'warning'}
                onConfirm={confirmationState.onConfirm}
                onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Requirements Slots */}
            {roleComposition.length > 0 && (
                <div className="flex flex-wrap gap-x-6 gap-y-3 mt-1">
                    {roleComposition.map((rc) => {
                        const taken = allocationMap.get(rc.roleId) || 0;
                        const total = rc.count;
                        const roleName = roles.find(r => r.id === rc.roleId)?.name || 'תפקיד';

                        return (
                            <div key={rc.roleId} className="flex items-center gap-3 md:gap-2 text-sm md:text-xs">
                                <span className={`font-black tracking-tight ${taken >= total ? 'text-emerald-600' : 'text-slate-500'}`}>{roleName}</span>
                                <div className="flex gap-1.5 md:gap-1">
                                    {Array.from({ length: total }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-4 h-5 md:w-3 md:h-4 rounded-md md:rounded-sm border-2 md:border ${i < taken
                                                ? 'bg-emerald-500 border-emerald-600 shadow-sm'
                                                : 'bg-slate-50 border-slate-300 border-dashed'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Attendance Conflict Alert */}
            {assignedConflicts.length > 0 && (
                <div className="flex flex-col gap-2 bg-red-600 border border-red-500 rounded-2xl p-3 md:p-2 text-white shadow-lg animate-in slide-in-from-top-4 mb-2 mx-1 mt-1 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <WarningCircle size={16} className="text-white" weight="bold" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white">התראת נוכחות</span>
                                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest leading-none">קריטי</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 pr-11">
                        {assignedConflicts.map((c, idx) => (
                            <div key={idx} className="text-xs font-bold bg-white/10 px-2 py-1 rounded flex items-center justify-between gap-2">
                                <span className="font-black text-white">{c.person.name}</span>
                                <span className="text-red-100 flex items-center gap-1">
                                    <X size={10} weight="bold" />
                                    {c.reason}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Suggestion Alert (Inline) */}
            {currentSuggestion && (
                <div className="flex items-center justify-between bg-blue-600 border border-blue-500 rounded-2xl p-3 md:p-2 text-white shadow-lg animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Sparkles size={16} className="text-white" weight="bold" />
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black">{currentSuggestion.person.name}</span>
                                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest leading-none">המלצה</span>
                            </div>
                            <span className="text-xs text-blue-100 font-bold truncate max-w-[180px] md:max-w-xs">{currentSuggestion.reason}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => handleAttemptAssign(currentSuggestion.person.id)} className="px-4 py-2 bg-white text-blue-600 rounded-xl hover:bg-blue-50 font-black text-sm active:scale-95 transition-all shadow-sm">שבץ</button>
                        <button onClick={handleNextSuggestion} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><RotateCcw size={20} className="md:w-3.5 md:h-3.5" weight="bold" /></button>
                        <button onClick={() => setSuggestedCandidates([])} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X size={20} className="md:w-3.5 md:h-3.5" weight="bold" /></button>
                    </div>
                </div>
            )}


            {/* --- MAIN BODY (3-Column Layout) --- */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">

                {/* 1. LEFT COLUMN: FILTERS (Desktop: 20%, Mobile: Horizontal Bar) */}
                <div className="md:w-[20%] md:min-w-[180px] bg-slate-50 md:border-l border-b md:border-b-0 border-slate-200 p-3 md:p-3 flex md:flex-col gap-3 md:gap-2 md:overflow-y-auto shrink-0 z-30 overflow-hidden">
                    {/* Search */}
                    <div className="relative w-[45%] md:w-auto shrink-0 touch-none">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} weight="bold" />
                        <input
                            type="text"
                            placeholder="חפש חייל..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-3 pr-10 py-3 md:py-1.5 text-sm md:text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none shadow-sm md:shadow-none"
                        />
                    </div>

                    {/* Filters (Desktop Vertical, Mobile Horizontal Scroll) */}
                    <div className="flex md:flex-col gap-2 md:gap-1.5 overflow-x-auto md:overflow-visible no-scrollbar pb-1 md:pb-0">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block mt-2 mb-1">תפקידים</div>
                        <button
                            onClick={() => setSelectedRoleFilter('')}
                            className={`whitespace-nowrap px-4 py-2.5 md:px-2.5 md:py-1 rounded-xl md:rounded-md text-sm md:text-xs font-black text-right transition-all active:scale-95 ${!selectedRoleFilter ? 'bg-blue-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600'}`}
                        >
                            הכל
                        </button>
                        {roles.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(r => (
                            <button
                                key={r.id}
                                onClick={() => setSelectedRoleFilter(selectedRoleFilter === r.id ? '' : r.id)}
                                className={`whitespace-nowrap px-4 py-2.5 md:px-2.5 md:py-1 rounded-xl md:rounded-md text-sm md:text-xs font-black text-right transition-all active:scale-95 ${selectedRoleFilter === r.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600'}`}
                            >
                                {r.name}
                            </button>
                        ))}

                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block mt-4 mb-1">צוותים</div>
                        {teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(t => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedTeamFilter(selectedTeamFilter === t.id ? '' : t.id)}
                                className={`whitespace-nowrap px-4 py-2.5 md:px-2.5 md:py-1 rounded-xl md:rounded-md text-sm md:text-xs font-black text-right transition-all active:scale-95 flex items-center justify-between gap-3 ${selectedTeamFilter === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600'}`}
                            >
                                <span>{t.name}</span>
                                <div className={`w-2 h-2 rounded-full border border-white/20 ${t.color?.replace('border-', 'bg-') || 'bg-slate-300'}`}></div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 2. MIDDLE COLUMN: POOL */}
                <div className={`flex-1 bg-white flex flex-col min-h-0 overflow-hidden relative ${activeMobileTab === 'available' ? 'flex' : 'hidden md:flex'}`}>
                    <div className="p-3 md:p-2 border-b border-slate-100 flex justify-between items-center text-sm md:text-xs bg-white sticky top-0 z-20">
                        <span className="font-black text-slate-900 tracking-tight">מאגר זמין ({availablePeopleWithMetrics.length})</span>
                        <button
                            onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${showDetailedMetrics ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                        >
                            <Info size={14} weight={showDetailedMetrics ? 'fill' : 'bold'} />
                            <span>{showDetailedMetrics ? 'תצוגה מצומצמת' : 'הצג פירוט'}</span>
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-1 p-3 md:p-2 space-y-3 md:space-y-1">
                        {availablePeopleWithMetrics.map(({ person: p, metrics }) => {
                            const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => handleAttemptAssign(p.id)}
                                    className={`group flex flex-col p-4 md:p-2 rounded-2xl md:rounded-lg border ${!metrics.isAvailable ? (metrics.isHome || metrics.isBlocked ? 'border-red-200 bg-red-50/20 shadow-inner cursor-not-allowed' : 'border-amber-200 bg-amber-50/20 cursor-not-allowed') : metrics.hasOverlap ? 'border-red-200 bg-red-50/30 opacity-80' : metrics.dailyLoad === 0 ? 'border-blue-200 bg-blue-50/20 shadow-sm' : 'border-slate-100 bg-white'} hover:border-blue-300 hover:bg-blue-50/50 transition-all active:scale-[0.97] md:shadow-none relative overflow-hidden`}
                                >
                                    <div className="flex items-center justify-between gap-4 md:gap-2">
                                        <div className="flex items-center gap-3 md:gap-2 min-w-0">
                                            <Tooltip content="צפה בפרטי חייל וסטטיסטיקה">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPersonForInfo(p);
                                                    }}
                                                    className={`w-10 h-10 md:w-7 md:h-7 rounded-full flex items-center justify-center text-white text-xs md:text-[9px] font-black shadow-sm ${p.color} shrink-0 cursor-help hover:scale-110 active:scale-95 transition-all`}
                                                >
                                                    {getPersonInitials(p.name)}
                                                </div>
                                            </Tooltip>
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <Tooltip content="לחץ לצפייה בדוח חייל מפורט">
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedPersonForInfo(p);
                                                            }}
                                                            className="flex items-center gap-1 group/info cursor-pointer"
                                                        >
                                                            <span className="text-sm md:text-xs font-black text-slate-900 leading-tight group-hover/info:text-blue-600 group-hover/info:underline truncate transition-colors">
                                                                {p.name}
                                                            </span>
                                                            <IdentificationCard size={12} weight="bold" className="text-slate-300 group-hover/info:text-blue-500 transition-colors shrink-0" />
                                                        </div>
                                                    </Tooltip>
                                                    <span className="text-[9px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 whitespace-nowrap">
                                                        {teams.find(t => t.id === p.teamId)?.name}
                                                    </span>
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0 ${!metrics.isAvailable ? (metrics.isHome || metrics.isBlocked ? 'bg-red-600 text-white shadow-md ring-2 ring-red-100' : 'bg-amber-500 text-white shadow-sm') : metrics.hasOverlap ? 'bg-red-500 text-white shadow-sm' : metrics.dailyLoad === 0 ? 'bg-blue-600 text-white shadow-md' : metrics.dailyLoad > 8 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600'}`}>
                                                        {!metrics.isAvailable ? (metrics.isHome ? <House size={10} weight="fill" /> : metrics.isBlocked ? <Prohibit size={10} weight="fill" /> : <WarningCircle size={10} weight="fill" />) : metrics.hasOverlap ? <WarningCircle size={10} weight="fill" /> : metrics.dailyLoad === 0 && <Sparkles size={10} weight="fill" />}
                                                        {!metrics.isAvailable ? (metrics.isHome ? 'בבית' : metrics.isBlocked ? 'חסימה בלו״ז' : 'לא זמין') : metrics.hasOverlap ? 'חפיפת זמנים' : metrics.dailyLoad === 0 ? 'לא שובץ היום' : `שובץ ${metrics.dailyLoad.toFixed(1)} ש׳`}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="md:opacity-0 md:group-hover:opacity-100 shrink-0"><Plus size={18} className="text-blue-600" weight="bold" /></div>
                                    </div>

                                    {/* Metrics Footer */}
                                    {showDetailedMetrics && (
                                        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 md:mt-1 pt-1.5 border-t border-slate-50/50">
                                            {/* Last Task */}
                                            <div className="flex flex-col gap-0 min-w-0">
                                                <div className="flex items-center gap-1 text-[8px] font-bold text-red-400 uppercase tracking-tighter">
                                                    <ClockCounterClockwise size={9} weight="bold" className="text-red-400" />
                                                    <span>משימה אחרונה</span>
                                                </div>
                                                {metrics.lastShift ? (
                                                    <div className="text-[9px] font-black text-slate-600 truncate flex items-center gap-1">
                                                        <span className="truncate">{taskTemplates?.find(t => t.id === metrics.lastShift?.taskId)?.name || 'משימה'}</span>
                                                        <span className={`font-bold px-1.5 rounded-full shrink-0 border ${metrics.isRestSufficient
                                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                            : 'bg-orange-50 text-orange-600 border-orange-100'
                                                            }`}>
                                                            {metrics.hoursSinceLast < 0.1
                                                                ? 'רציף'
                                                                : metrics.hoursSinceLast < 1
                                                                    ? 'ממש עכשיו'
                                                                    : `${Math.floor(metrics.liveHoursSinceLast)} ש׳`
                                                            }
                                                            {!metrics.isRestSufficient && <span className="mr-1 opacity-70">(חוסר מנוחה)</span>}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-300 italic">אין מידע</span>
                                                )}
                                            </div>

                                            {/* Next Task */}
                                            <div className="flex flex-col gap-0 min-w-0">
                                                <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-500 uppercase tracking-tighter">
                                                    <ClockAfternoon size={9} weight="bold" className="text-emerald-500" />
                                                    <span>משימה הבאה</span>
                                                </div>
                                                {metrics.nextShift ? (
                                                    <div className="text-[9px] font-black text-blue-600 truncate flex items-center gap-1">
                                                        <span className="truncate">{taskTemplates?.find(t => t.id === metrics.nextShift?.taskId)?.name || 'משימה'}</span>
                                                        <span className="text-blue-400 font-bold bg-blue-50 px-1 rounded shrink-0">בעוד {Math.floor(metrics.hoursUntilNext)}ש</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-[9px] font-bold text-slate-300 italic">אין מידע</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* 3. RIGHT COLUMN: ASSIGNED */}
                <div className={`md:w-[30%] bg-slate-50/50 border-r border-slate-200 flex flex-col overflow-hidden relative ${activeMobileTab === 'assigned' ? 'flex flex-1' : 'hidden md:flex'}`}>
                    <div className="p-4 md:p-2 border-b border-slate-100 bg-slate-100/30 sticky top-0 z-10 flex justify-between items-center">
                        <h4 className="font-black text-slate-700 text-sm uppercase tracking-widest">משובצים ({assignedPeople.length})</h4>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-2">
                        {assignedPeople.map(p => {
                            const conflict = assignedConflicts.find(c => c.person.id === p.id);
                            const hasConflict = !!conflict;
                            return (
                                <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl bg-white border ${hasConflict ? 'border-red-300 bg-red-50/30' : 'border-slate-100'} shadow-sm transition-all`}>
                                    <div className="flex items-center gap-3">
                                        <Tooltip content={hasConflict ? `בעיית נוכחות: ${conflict.reason}` : "צפה בפרטי חייל"}>
                                            <div
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedPersonForInfo(p);
                                                }}
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black ${p.color} cursor-help hover:scale-110 transition-all ${hasConflict ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' : ''}`}
                                            >
                                                {getPersonInitials(p.name)}
                                            </div>
                                        </Tooltip>
                                        <div className="flex flex-col leading-tight">
                                            <Tooltip content="לחץ לצפייה בדוח חייל">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedPersonForInfo(p);
                                                    }}
                                                    className="flex items-center gap-1 group/info cursor-pointer"
                                                >
                                                    <span className={`text-sm font-black ${hasConflict ? 'text-red-600' : 'text-slate-800'} group-hover/info:text-blue-600 group-hover/info:underline transition-colors`}>
                                                        {p.name}
                                                    </span>
                                                    <IdentificationCard size={12} weight="bold" className={`${hasConflict ? 'text-red-400' : 'text-slate-300'} group-hover/info:text-blue-500 transition-colors shrink-0`} />
                                                </div>
                                            </Tooltip>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400 font-bold">{roles.find(r => (p.roleIds || [p.roleId]).includes(r.id))?.name}</span>
                                                {hasConflict && (
                                                    <span className="text-[9px] text-red-500 font-black bg-white px-1 rounded flex items-center gap-0.5 border border-red-100">
                                                        <WarningCircle size={10} weight="fill" />
                                                        {conflict.reason}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {!isViewer && (
                                        <button onClick={() => onUnassign(selectedShift.id, p.id)} className={`p-2 transition-colors ${hasConflict ? 'text-red-500 hover:bg-red-50' : 'text-slate-300 hover:text-red-500'} rounded-lg`}><X size={18} weight="bold" /></button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {
                selectedPersonForInfo && (
                    <PersonInfoModal
                        isOpen={!!selectedPersonForInfo}
                        onClose={() => setSelectedPersonForInfo(null)}
                        person={selectedPersonForInfo}
                        roles={roles}
                        teams={teams}
                        settings={settings}
                        shifts={shifts}
                        selectedDate={selectedDate}
                        taskTemplates={taskTemplates}
                    />
                )
            }
        </GenericModal >
    );
};
