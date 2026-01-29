import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, Person, TaskTemplate, Role, Team, TeamRotation, SchedulingConstraint, InterPersonConstraint } from '../../types';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import {
    X, Plus, MagnifyingGlass as Search, MagicWand as Wand2, ArrowCounterClockwise as RotateCcw, Sparkle as Sparkles, WarningCircle,
    CalendarBlank as CalendarIcon, CheckCircle, Users, PencilSimple as Pencil, Warning as AlertTriangle, ArrowLeft,
    ClockAfternoon, ClockCounterClockwise, Info, IdentificationCard, House, Prohibit,
    BatteryEmpty, BatteryLow, BatteryMedium, BatteryHigh, BatteryFull,
    CaretDown, CaretUp, Funnel, Crown, Phone, Envelope, WhatsappLogo, Shield
} from '@phosphor-icons/react';
import { ROLE_ICONS } from '../../constants';
import { Tooltip } from '../../components/ui/Tooltip';
import { getEffectiveAvailability } from '../../utils/attendanceUtils';
import { getPersonInitials } from '../../utils/nameUtils';
import { getWhatsAppLink } from '../../utils/phoneUtils';
import { TimePicker } from '../../components/ui/DatePicker';
import { useToast } from '../../contexts/ToastContext';
import { formatIsraelDate } from '@/utils/dateUtils';
import { logger } from '@/services/loggingService';
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
    onAssign: (shiftId: string, personId: string, taskName?: string, force?: boolean, metadataOverride?: any) => void;
    onUnassign: (shiftId: string, personId: string, taskName?: string, metadataOverride?: any) => void;
    onUpdateShift: (shift: Shift) => void;
    onToggleCancelShift: (shiftId: string) => void;
    constraints: SchedulingConstraint[];
    interPersonConstraints?: InterPersonConstraint[];
    settings?: OrganizationSettings | null;
    absences?: import('../../types').Absence[];
    hourlyBlockages?: import('../../types').HourlyBlockage[];
    taskTemplates?: TaskTemplate[];
    onNavigate?: (view: any) => void;
    onViewHistory?: (filters: any) => void;
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
    taskTemplates = [],
    onNavigate,
    onViewHistory
}) => {
    // -------------------------------------------------------------------------
    // 1. STATE & HOOKS (Preserved Logic)
    // -------------------------------------------------------------------------
    if (!task) return null;



    const { showToast } = useToast();

    // Defined here for cross-component access (validation + UI)
    const taskMinRest = useMemo(() => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        return segment?.minRestHoursAfter || 8;
    }, [task, selectedShift]);
    const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
    const [suggestionIndex, setSuggestionIndex] = useState(0);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [isWarningDismissed, setIsWarningDismissed] = useState(false);

    const [activeMobileTab, setActiveMobileTab] = useState<'available' | 'assigned'>('assigned');
    const [selectedPersonForInfo, setSelectedPersonForInfo] = useState<Person | null>(null);
    const [showDetailedMetrics, setShowDetailedMetrics] = useState(true);

    // Time Editing State
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
    const [isRolesExpanded, setIsRolesExpanded] = useState(false);
    const [isTeamsExpanded, setIsTeamsExpanded] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    const [optimisticUnassignedIds, setOptimisticUnassignedIds] = useState<Set<string>>(new Set());

    // Reset optimistic state when shift or people change
    useEffect(() => {
        setOptimisticUnassignedIds(new Set());
    }, [selectedShift.id, selectedShift.assignedPersonIds.length]);

    // Optimistic Commander State
    const [optimisticCommanderId, setOptimisticCommanderId] = useState<string | undefined>(selectedShift.metadata?.commanderId);

    // Sync with prop if it changes externally
    useEffect(() => {
        setOptimisticCommanderId(selectedShift.metadata?.commanderId);
    }, [selectedShift.metadata?.commanderId, selectedShift.id]);

    // Role Assignment State
    const [optimisticRoleAssignments, setOptimisticRoleAssignments] = useState<Record<string, string>>(selectedShift.metadata?.roleAssignments || {});

    // Sync with prop if it changes externally
    useEffect(() => {
        setOptimisticRoleAssignments(selectedShift.metadata?.roleAssignments || {});
    }, [selectedShift.metadata?.roleAssignments, selectedShift.id]);

    // Helper to auto-assign roles based on segment requirements
    const autoAssignRoles = (peopleIds: string[], currentAssignments: Record<string, string>) => {
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        if (!segment?.roleComposition) return currentAssignments;

        const nextAssignments = { ...currentAssignments };
        const unassignedPeople = peopleIds.filter(pid => !nextAssignments[pid]);

        // Count currently filled roles
        const filledRolesCount: Record<string, number> = {};
        Object.values(nextAssignments).forEach(rid => {
            filledRolesCount[rid] = (filledRolesCount[rid] || 0) + 1;
        });

        unassignedPeople.forEach(pid => {
            const person = people.find(p => p.id === pid);
            if (!person) return;

            // Find a role requirement that this person can fulfill and is not yet filled
            const possibleRole = segment.roleComposition!.find(req => {
                const isQualified = (person.roleIds || [person.roleId]).includes(req.roleId);
                const isUnderLimit = (filledRolesCount[req.roleId] || 0) < req.count;
                return isQualified && isUnderLimit;
            });

            if (possibleRole) {
                nextAssignments[pid] = possibleRole.roleId;
                filledRolesCount[possibleRole.roleId] = (filledRolesCount[possibleRole.roleId] || 0) + 1;
            }
        });

        return nextAssignments;
    };


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
                .filter(id => !optimisticUnassignedIds.has(id))
                .map(id => people.find(p => p.id === id))
                .filter(Boolean)
                .sort((a, b) => a!.name.localeCompare(b!.name, 'he')) as Person[]
            : []
        , [selectedShift, people, optimisticUnassignedIds]);

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
                    // Only consider blocks that are approved or partially approved
                    if (block.status && block.status !== 'approved' && block.status !== 'partially_approved') {
                        return false;
                    }

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

            // 4. Check for Overlapping Shifts
            const pShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id) && !s.isCancelled && s.id !== selectedShift.id);
            const hasOverlap = pShifts.some(s => {
                const sStart = new Date(s.startTime);
                const sEnd = new Date(s.endTime);
                return sStart < shiftEnd && sEnd > shiftStart;
            });

            if (hasOverlap) {
                conflicts.push({ person: p, reason: 'חפיפת זמנים עם משימה אחרת' });
                return;
            }

            // 5. Check for Insufficient Rest (from previous shift)
            const lastShift = pShifts
                .filter(s => new Date(s.endTime) <= shiftStart)
                .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

            if (lastShift) {
                const restGap = (shiftStart.getTime() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60);
                const minRest = lastShift.requirements?.minRest || 8;
                if (restGap < minRest) {
                    conflicts.push({ person: p, reason: `חוסר מנוחה (נח ${parseFloat(restGap.toFixed(1))} מתוך ${minRest})` });
                    return;
                }
            }
        });

        return conflicts;
    }, [assignedPeople, selectedDate, teamRotations, absences, hourlyBlockages, selectedShift, shifts]);

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

            // Scheduling Constraints (NEW: Check for 'never_assign' and 'always_assign')
            const isNeverAssign = constraints.some(c =>
                c.type === 'never_assign' &&
                c.taskId === task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );

            const isPinnedToDifferentTask = constraints.some(c =>
                c.type === 'always_assign' &&
                c.taskId !== task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );

            const shiftStartAt = new Date(selectedShift.startTime);
            const shiftEndAt = new Date(selectedShift.endTime);
            const isTimeBlocked = constraints.some(c => {
                if (c.type !== 'time_block' || !c.startTime || !c.endTime) return false;
                if (c.personId && c.personId !== p.id) return false;
                if (c.teamId && c.teamId !== p.teamId) return false;
                if (c.roleId && !(p.roleIds || [p.roleId]).includes(c.roleId)) return false;
                const bs = new Date(c.startTime);
                const be = new Date(c.endTime);
                return bs < shiftEndAt && be > shiftStartAt;
            });

            if ((isNeverAssign || isPinnedToDifferentTask || isTimeBlocked) && !searchTerm) return false;

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
                    // Only consider blocks that are approved or partially approved
                    if (block.status && block.status !== 'approved' && block.status !== 'partially_approved') {
                        return false;
                    }

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

            // NEW: Check for constraints
            const isNeverAssign = constraints.some(c =>
                c.type === 'never_assign' &&
                c.taskId === task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );

            const pinnedConstraints = constraints.filter(c =>
                c.type === 'always_assign' &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );

            const isPinnedToThisTask = pinnedConstraints.some(c => c.taskId === task.id);
            const isPinnedToOtherTasksOnly = pinnedConstraints.length > 0 && !isPinnedToThisTask;

            const shiftStartAt = new Date(selectedShift.startTime);
            const shiftEndAt = new Date(selectedShift.endTime);
            const isTimeBlocked = constraints.some(c => {
                if (c.type !== 'time_block' || !c.startTime || !c.endTime) return false;
                if (c.personId && c.personId !== p.id) return false;
                if (c.teamId && c.teamId !== p.teamId) return false;
                if (c.roleId && !(p.roleIds || [p.roleId]).includes(c.roleId)) return false;
                const bs = new Date(c.startTime);
                const be = new Date(c.endTime);
                return bs < shiftEndAt && be > shiftStartAt;
            });

            const blockReasons: string[] = [];
            if (isNeverAssign) {
                isAvailable = false;
                isBlocked = true;
                const c = constraints.find(c =>
                    c.type === 'never_assign' &&
                    c.taskId === task.id &&
                    (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
                );
                const source = c?.personId ? 'חייל' : c?.teamId ? 'צוות' : c?.roleId ? 'תפקיד' : '';
                blockReasons.push(`אילוץ ${source} "לא לשבץ"`);
            }
            if (isPinnedToOtherTasksOnly) {
                isAvailable = false;
                isBlocked = true;
                const otherTaskNames = pinnedConstraints
                    .map(c => taskTemplates.find(tt => tt.id === c.taskId)?.name)
                    .filter(Boolean)
                    .join(', ');

                const c = pinnedConstraints[0];
                const source = c?.personId ? 'חייל' : c?.teamId ? 'צוות' : c?.roleId ? 'תפקיד' : '';
                blockReasons.push(`מיועד ${source} ל: ${otherTaskNames || 'משימות אחרות'}`);
            }
            if (isTimeBlocked) {
                isAvailable = false;
                isBlocked = true;
                blockReasons.push('חסימת זמן מוגדרת');
            }

            if (availability.status === 'home') {
                isAvailable = false;
                isHome = true;
                if (availability.source === 'absence') {
                    const block = availability.unavailableBlocks?.find(b => b.type === 'absence' && b.status === 'approved');
                    blockReasons.push(`בבית (${block?.reason || 'היעדרות'})`);
                } else if (availability.source === 'rotation') {
                    blockReasons.push('בבית (סבב צוותי)');
                } else if (availability.source === 'personal_rotation') {
                    blockReasons.push('בבית (סבב אישי)');
                } else {
                    blockReasons.push('נמצא בבית');
                }
            } else if (availability.source === 'manual') {
                if (!availability.isAvailable) {
                    isAvailable = false;
                    blockReasons.push('לא זמין (עדכון ידני)');
                }
            } else if (!availability.isAvailable) {
                isAvailable = false;
                blockReasons.push('לא זמין');
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
                    if (relevantShiftStart < availStart) {
                        isAvailable = false;
                        isBlocked = true;
                        blockReasons.push(`טרם הגיע (זמין מ-${availability.startHour})`);
                    } else if (!isEndOfDay && relevantShiftEnd > availEnd) {
                        isAvailable = false;
                        isBlocked = true;
                        blockReasons.push(`יוצא (זמין עד ${availability.endHour})`);
                    }
                }
            }

            // Hourly Blockages
            if (isAvailable && availability.unavailableBlocks && availability.unavailableBlocks.length > 0) {
                const shiftStart = new Date(selectedShift.startTime);
                const shiftEnd = new Date(selectedShift.endTime);
                const overlappingBlock = availability.unavailableBlocks.find(block => {
                    // Only consider blocks that are approved or partially approved
                    if (block.status && block.status !== 'approved' && block.status !== 'partially_approved') {
                        return false;
                    }

                    const [bh, bm] = block.start.split(':').map(Number);
                    const [eh, em] = block.end.split(':').map(Number);
                    const bs = new Date(shiftStart); bs.setHours(bh, bm, 0, 0);
                    const be = new Date(shiftStart); be.setHours(eh, em, 0, 0);
                    if (be < bs) be.setDate(be.getDate() + 1);
                    return bs < shiftEnd && be > shiftStart;
                });
                if (overlappingBlock) {
                    isAvailable = false;
                    isBlocked = true;
                    blockReasons.push(`חסימה שעתית (${overlappingBlock.reason || 'מושבת'})`);
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

            const now = Date.now();
            const dayAgo = now - (24 * 60 * 60 * 1000);
            const hoursInLast24ForTask = personShifts.reduce((total, s) => {
                if (s.taskId !== task.id) return total;
                const sStart = new Date(s.startTime).getTime();
                const sEnd = new Date(s.endTime).getTime();
                const overlapStart = Math.max(sStart, dayAgo);
                const overlapEnd = Math.min(sEnd, now);
                if (overlapStart < overlapEnd) {
                    return total + ((overlapEnd - overlapStart) / (1000 * 60 * 60));
                }
                return total;
            }, 0);

            const hasOverlap = overlappingShifts.some(s => s.assignedPersonIds.includes(p.id));

            const hoursSinceLast = lastShift ? (thisStart.getTime() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60) : Infinity;
            const hoursUntilNext = nextShift ? (new Date(nextShift.startTime).getTime() - thisEnd.getTime()) / (1000 * 60 * 60) : Infinity;
            const requiredRest = lastShift?.requirements?.minRest || 8;

            // Scoring Logic
            let score = 0;
            if (isPinnedToThisTask && isAvailable && !hasOverlap) {
                score = 100;
            } else if (isAvailable && !hasOverlap) {
                const isTightPrev = hoursSinceLast < requiredRest;
                const isTightNext = hoursUntilNext < taskMinRest;

                if (isTightPrev) {
                    score = hoursSinceLast <= 0.5 ? 5 : 20;
                } else if (isTightNext) {
                    score = hoursUntilNext <= 0.5 ? 5 : 20;
                } else {
                    const cappedRestBefore = Math.min(hoursSinceLast === Infinity ? 48 : hoursSinceLast, 48);
                    const cappedRestAfter = Math.min(hoursUntilNext === Infinity ? 24 : hoursUntilNext, 24);
                    const restScore = (cappedRestBefore * 1.5) + (cappedRestAfter * 0.5);
                    const loadPenalty = dailyLoad * 1.0;
                    score = Math.min(Math.max(30 + restScore - loadPenalty, 25), 99);
                }
            }

            return {
                person: p,
                metrics: {
                    lastShift,
                    nextShift,
                    dailyLoad,
                    hoursInLast24ForTask,
                    hasOverlap,
                    isAvailable,
                    isHome,
                    isBlocked,
                    isNeverAssign,
                    isPinnedToDifferentTask: isPinnedToOtherTasksOnly,
                    isPinnedToThisTask,
                    isTimeBlocked,
                    blockReason: blockReasons.length > 0 ? blockReasons.join(' | ') : null,
                    availabilityStatus: availability.status,
                    hoursSinceLast,
                    liveHoursSinceLast: lastShift ? (Date.now() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60) : Infinity,
                    hoursUntilNext,
                    requiredRest,
                    isRestSufficient: lastShift ? hoursSinceLast >= requiredRest : true,
                    score
                }
            };
        }); // This closes the `filtered.map` call.

        return withMetrics.sort((a, b) => {
            if (a.metrics.score !== b.metrics.score) {
                return b.metrics.score - a.metrics.score;
            }
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

        const shiftStart = new Date(selectedShift.startTime);
        const shiftEnd = new Date(selectedShift.endTime);

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

            // NEW: Check for never_assign constraint
            const isNeverAssign = constraints.some(c =>
                c.type === 'never_assign' &&
                c.taskId === task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );
            if (isNeverAssign) {
                score -= 100000; // Critical penalty
                reasons.push('אילוץ: לעולם לא לשבץ');
            }

            const isPinnedToDifferentTask = constraints.some(c =>
                c.type === 'always_assign' &&
                c.taskId !== task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );
            if (isPinnedToDifferentTask) {
                const otherTaskName = taskTemplates.find(tt => tt.id === constraints.find(c => c.type === 'always_assign' && c.taskId !== task.id && (c.personId === p.id || (c.teamId && p.teamId === c.teamId)))?.taskId)?.name || 'משימה אחרת';
                score -= 100000;
                reasons.push(`מיועד ל: ${otherTaskName}`);
            }

            const isPinnedToThisTask = constraints.some(c =>
                c.type === 'always_assign' &&
                c.taskId === task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );
            if (isPinnedToThisTask) {
                score += 50000;
                reasons.push('העדפה: שבץ רק לזה');
            }

            // NEW: Time Block checking in suggestions
            const isTimeBlocked = constraints.some(c => {
                if (c.type !== 'time_block' || !c.startTime || !c.endTime) return false;
                if (c.personId && c.personId !== p.id) return false;
                if (c.teamId && c.teamId !== p.teamId) return false;
                if (c.roleId && !(p.roleIds || [p.roleId]).includes(c.roleId)) return false;
                const bs = new Date(c.startTime);
                const be = new Date(c.endTime);
                return bs < shiftEnd && be > shiftStart;
            });
            if (isTimeBlocked) {
                score -= 100000;
                reasons.push('אילוץ: חסימת זמן');
            }

            // NEW: Preferred Together scoring in suggestions
            const prefTogether = (interPersonConstraints || []).filter(ipc => ipc.type === 'preferred_together');
            prefTogether.forEach(ipc => {
                const matchesA = p.customFields?.[ipc.fieldA] === ipc.valueA;
                const matchesB = p.customFields?.[ipc.fieldB] === ipc.valueB;
                if (matchesA || matchesB) {
                    const alreadyAssignedMatchesOther = assignedPeople.some(ap => {
                        const apMatchesA = ap.customFields?.[ipc.fieldA] === ipc.valueA;
                        const apMatchesB = ap.customFields?.[ipc.fieldB] === ipc.valueB;
                        return (matchesA && apMatchesB) || (matchesB && apMatchesA);
                    });
                    if (alreadyAssignedMatchesOther) {
                        score += 5000;
                        reasons.push('העדפה: עדיפות לשיבוץ יחד');
                    }
                }
            });

            // Strict Availability Check (Same as list)
            const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);
            if (availability.status === 'home') score -= 20000;
            if (availability.source === 'manual') {
                if (!availability.isAvailable) score -= 20000;
            } else if (!availability.isAvailable) {
                score -= 20000;
            }

            // Strict Time Window Check

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
                    // Only consider blocks that are approved or partially approved
                    if (block.status && block.status !== 'approved' && block.status !== 'partially_approved') {
                        return false;
                    }

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
            if (hasOverlap) { score -= 20000; reasons.push('חפיפה'); }

            // Check Previous Shift Gap
            const lastShift = personShifts
                .filter(s => new Date(s.endTime) <= thisStart)
                .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

            if (lastShift) {
                const lastEnd = new Date(lastShift.endTime);
                const gapMs = thisStart.getTime() - lastEnd.getTime();
                const gapHours = gapMs / (1000 * 60 * 60);
                const prevRequiredRest = lastShift.requirements?.minRest || 8;

                if (gapHours <= 0.1) {
                    score -= 50000; // Critical: Back-to-back from previous
                    reasons.push('צמוד למשימה קודמת');
                } else if (gapHours < prevRequiredRest) {
                    score -= 3000;
                    reasons.push(`מנוחה קצרה לפני (${gapHours.toFixed(1)})`);
                }
            }

            const nextShift = personShifts
                .filter(s => new Date(s.startTime) >= thisEnd)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

            if (nextShift) {
                const nextStart = new Date(nextShift.startTime);
                const gapMs = nextStart.getTime() - thisEnd.getTime();
                const gapHours = gapMs / (1000 * 60 * 60);

                if (gapHours <= 0.1) {
                    score -= 50000; // Critical penalty for continuous back-to-back
                    reasons.push('צמוד למשימה הבאה');
                } else if (gapHours < requiredRest) {
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

        onUpdateShift({ ...selectedShift, startTime: s.toISOString(), endTime: e.toISOString(), metadata: selectedShift.metadata });
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
                // Only consider blocks that are approved or partially approved
                if (block.status && block.status !== 'approved' && block.status !== 'partially_approved') {
                    return false;
                }

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

            // NEW: Final Assignment Enforcement check for never_assign
            const isNeverAssign = constraints.some(c =>
                c.type === 'never_assign' &&
                c.taskId === task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );
            if (isNeverAssign) {
                isCurrentlyAvailable = false;
                unavailReason = 'קיים אילוץ "לעולם לא לשבץ" למשימה זו';
            }

            const isPinnedToDifferentTask = constraints.some(c =>
                c.type === 'always_assign' &&
                c.taskId !== task.id &&
                (c.personId === p.id || (c.teamId && p.teamId === c.teamId) || (c.roleId && (p.roleIds || [p.roleId]).includes(c.roleId)))
            );
            if (isPinnedToDifferentTask) {
                const otherTask = taskTemplates.find(tt => tt.id === constraints.find(c => c.type === 'always_assign' && c.taskId !== task.id && (c.personId === p.id || (c.teamId && p.teamId === c.teamId)))?.taskId);
                isCurrentlyAvailable = false;
                unavailReason = `מיועד בלעדית למשימה: ${otherTask?.name || 'אחרת'}`;
            }
        }

        if (!isCurrentlyAvailable) {
            showToast(`${p.name} ${unavailReason} ולא ניתן לשבצו`, 'error');
            return;
        }

        checkOverlapAndAssign(p);
    };

    const checkOverlapAndAssign = (p: Person) => {
        const pShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id) && !s.isCancelled && s.id !== selectedShift.id);
        const thisStart = new Date(selectedShift.startTime);
        const thisEnd = new Date(selectedShift.endTime);

        const overlapping = pShifts.find(s => {
            const sStart = new Date(s.startTime);
            const sEnd = new Date(s.endTime);
            return sStart < thisEnd && sEnd > thisStart;
        });

        if (overlapping) {
            const otherTask = taskTemplates.find(t => t.id === overlapping.taskId);
            setConfirmationState({
                isOpen: true,
                title: 'התראת כפל שיבוץ',
                message: `חייל זה כבר משובץ למשימה "${otherTask?.name || 'אחרת'}" באותו הזמן. לשבץ בכל זאת?`,
                confirmText: "שבץ בכל זאת",
                type: "danger",
                onConfirm: () => {
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                    performCapacityChecks(p);
                }
            });
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
        const thisEnd = new Date(selectedShift.endTime);

        // 1. Check Previous Shift Gap
        const lastShift = personShifts
            .filter(s => new Date(s.endTime) <= thisStart)
            .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

        if (lastShift) {
            const lastEnd = new Date(lastShift.endTime);
            const gapMs = thisStart.getTime() - lastEnd.getTime();
            const gapHours = gapMs / (1000 * 60 * 60);
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
                        checkRestBetweenNext(p, personShifts, thisEnd);
                    }
                });
                return;
            }
        }

        checkRestBetweenNext(p, personShifts, thisEnd);
    };

    const checkRestBetweenNext = (p: Person, personShifts: Shift[], thisEnd: Date) => {
        // 2. Check Next Shift Gap
        const nextShift = personShifts
            .filter(s => new Date(s.startTime) >= thisEnd)
            .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

        if (nextShift) {
            const nextStart = new Date(nextShift.startTime);
            const gapMs = nextStart.getTime() - thisEnd.getTime();
            const gapHours = gapMs / (1000 * 60 * 60);

            if (gapHours < taskMinRest) {
                setConfirmationState({
                    isOpen: true,
                    title: 'התראת רצף משמרות',
                    message: gapHours < 0.1
                        ? `שים לב: לחייל יש משמרת נוספת מיד בסיום משמרת זו (אי-הקפדה על זמן מנוחה). לשבץ בכל זאת?`
                        : `לחייל יש משמרת נוספת בעוד ${gapHours.toFixed(1)} שעות (נדרש מנוחה של ${taskMinRest}). לשבץ בכל זאת?`,
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
        const executeAssign = () => {
            const newAssignments = autoAssignRoles([...selectedShift.assignedPersonIds, p.id], optimisticRoleAssignments);
            setOptimisticRoleAssignments(newAssignments);

            onAssign(selectedShift.id, p.id, task.name, false, {
                ...(selectedShift.metadata || {}),
                roleAssignments: newAssignments
            });
            setSuggestedCandidates([]);
        };

        if (task.assignedTeamId && p.teamId !== task.assignedTeamId) {
            setConfirmationState({
                isOpen: true,
                title: 'שיבוץ מחוץ לצוות',
                message: `חייל זה אינו שייך לצוות המשויך למשימה. המשך?`,
                confirmText: "שבץ",
                type: "warning",
                onConfirm: () => {
                    executeAssign();
                    setConfirmationState(prev => ({ ...prev, isOpen: false }));
                }
            });
            return;
        }
        executeAssign();
    };

    const currentSuggestion = suggestedCandidates[suggestionIndex];

    // -------------------------------------------------------------------------
    // 4. UI COMPONENTS (NEW DENSE LAYOUT)
    // -------------------------------------------------------------------------

    // --- UNIFIED MODAL UTILS ---
    const modalTitle = (
        <div className="flex flex-col gap-0.5 pr-2 min-w-0 flex-1">
            <h2 className="text-xl font-black text-slate-800 leading-tight truncate">{task.name}</h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500 font-bold">
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarIcon size={14} weight="bold" />
                        <span>{new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</span>
                    </div>
                    <span className="text-slate-200">|</span>
                    {!isEditingTime ? (
                        <button
                            onClick={() => !isViewer && setIsEditingTime(true)}
                            className={`flex items-center gap-1.5 font-mono text-xs ${!isViewer ? 'hover:text-blue-600 cursor-pointer active:scale-95 transition-transform' : ''}`}
                        >
                            <span dir="ltr">
                                {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                -
                                {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {!isViewer && <Pencil size={11} className="opacity-50" weight="bold" />}
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <TimePicker
                                label=""
                                value={newStart}
                                onChange={(val) => setNewStart(val)}
                                className="w-20"
                            />
                            <span>-</span>
                            <TimePicker
                                label=""
                                value={newEnd}
                                onChange={(val) => setNewEnd(val)}
                                className="w-20"
                            />
                            <button onClick={handleSaveTime} className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors"><CheckCircle size={18} weight="bold" /></button>
                            <button onClick={() => setIsEditingTime(false)} className="p-1.5 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"><X size={18} weight="bold" /></button>
                        </div>
                    )}
                </div>

                {/* Role Requirements Aligned with Date/Time */}
                <div className="hidden lg:flex items-center gap-3 border-r border-slate-200 pr-3 mr-1">
                    {roleComposition.map((rc) => {
                        const taken = allocationMap.get(rc.roleId) || 0;
                        const total = rc.count;
                        const roleName = roles.find(r => r.id === rc.roleId)?.name || 'תפקיד';
                        return (
                            <div key={rc.roleId} className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-black uppercase tracking-tight ${taken >= total ? 'text-emerald-600' : 'text-slate-400'}`}>{roleName}</span>
                                <div className="flex gap-0.5">
                                    {Array.from({ length: total }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`w-2.5 h-3.5 rounded-[2px] border ${i < taken
                                                ? 'bg-emerald-500 border-emerald-600 shadow-xs'
                                                : 'bg-slate-50 border-slate-200 border-dashed'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const modalHeaderActions = !isViewer && (
        <div className="flex items-center gap-2">
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

            {onViewHistory && (
                <button
                    onClick={() => {
                        onViewHistory({
                            taskId: selectedShift.taskId,
                            date: formatIsraelDate(selectedShift.startTime),
                            startTime: selectedShift.startTime,
                            entityId: selectedShift.id,
                            entityTypes: ['shift']
                        });
                        onClose();
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-50 text-slate-700 text-[10px] md:text-xs font-black rounded-full hover:bg-slate-100 transition-all active:scale-95 shadow-sm border border-slate-200 uppercase tracking-wider"
                    title="צפה בהיסטוריית שינויים"
                >
                    <ClockCounterClockwise size={16} weight="bold" />
                    <span className="hidden sm:inline">היסטוריה</span>
                </button>
            )}
        </div>
    );

    const modalFooter = (
        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
            {/* Mobile Tab Switcher */}
            {!isViewer && (
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
            )}

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



            {/* Attendance Conflict Alert - Compact Version */}
            {assignedConflicts.length > 0 && !isWarningDismissed && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5 text-red-900 shadow-sm animate-in slide-in-from-top-4 mb-2 mx-1 mt-1 shrink-0 overflow-hidden">
                    <div className="flex items-center gap-2 shrink-0">
                        <AlertTriangle size={16} className="text-red-600" weight="bold" />
                        <div className="flex flex-col">
                            <span className="text-[10px] md:text-xs font-black leading-none">התראות ({assignedConflicts.length})</span>
                        </div>
                    </div>

                    <div className="flex-1 flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        {assignedConflicts.map((c, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 bg-white border border-red-100 px-2 py-1 rounded-lg shadow-sm shrink-0">
                                <span className="text-[10px] font-black text-red-900">{c.person.name}</span>
                                <div className="w-[1px] h-3 bg-red-100" />
                                <span className="text-[9px] font-bold text-red-600 flex items-center gap-1">
                                    {c.reason}
                                </span>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setIsWarningDismissed(true)}
                        className="p-1.5 hover:bg-red-100 text-red-400 hover:text-red-700 rounded-lg transition-colors shrink-0"
                    >
                        <X size={16} weight="bold" />
                    </button>
                </div>
            )}

            {/* Suggestion Alert (Inline) - Compact Version */}
            {currentSuggestion && (
                <div className="flex items-center gap-3 bg-blue-600 border border-blue-500 rounded-xl px-3 py-1.5 text-white shadow-md animate-in slide-in-from-top-4 mx-1 mb-2 mt-1 shrink-0 relative z-50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                            <Sparkles size={16} className="text-white" weight="bold" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black truncate">{currentSuggestion.person.name}</span>
                                <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded uppercase font-bold tracking-widest leading-none shrink-0">המלצה</span>
                            </div>
                            <span className="text-[10px] text-blue-100 font-bold truncate">{currentSuggestion.reason}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => handleAttemptAssign(currentSuggestion.person.id)}
                            className="px-4 py-1.5 bg-white text-blue-600 rounded-lg hover:bg-blue-50 font-black text-xs active:scale-95 transition-all shadow-sm"
                        >
                            שבץ המלצה
                        </button>
                        <div className="flex items-center gap-1 border-r border-white/20 pr-1 mr-1">
                            <button onClick={handleNextSuggestion} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="הצעה הבאה"><RotateCcw size={16} weight="bold" /></button>
                            <button onClick={() => setSuggestedCandidates([])} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors" title="סגור הצעה"><X size={16} weight="bold" /></button>
                        </div>
                    </div>
                </div>
            )}


            {/* --- MAIN BODY (3-Column Layout) --- */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">

                {/* 1. LEFT COLUMN: FILTERS (Desktop: 20%, Mobile: Top Search Bar) */}
                {!isViewer && (
                    <div className={`${isMobile ? (activeMobileTab === 'available' ? 'w-full p-2 border-b' : 'hidden') : 'md:w-[20%] md:min-w-[180px] md:border-l p-3 md:p-3 md:overflow-y-auto shrink-0'} bg-slate-50 border-slate-200 flex flex-col gap-3 md:gap-2 z-30`}>

                        {/* Search & Mobile Filter Toggle */}
                        <div className="flex items-center gap-2 w-full">
                            <div className="relative flex-1">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} weight="bold" />
                                <input
                                    type="text"
                                    placeholder="חפש חייל..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-3 pr-10 py-2.5 md:py-1.5 text-sm md:text-xs border border-slate-200 rounded-xl focus:border-blue-500 focus:outline-none shadow-sm"
                                />
                            </div>
                            {isMobile && (
                                <button
                                    onClick={() => setShowMobileFilters(true)}
                                    className={`p-2.5 rounded-xl border-2 transition-all flex items-center justify-center relative ${selectedRoleFilter || selectedTeamFilter ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-500'}`}
                                >
                                    <Funnel size={20} weight="bold" />
                                    {(selectedRoleFilter || selectedTeamFilter) && <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-white"></div>}
                                </button>
                            )}
                        </div>

                        {/* Desktop-only detailed filters */}
                        {!isMobile && (
                            <div className="flex flex-col gap-3 md:gap-1.5 overflow-visible">
                                {/* ROLES SECTION */}
                                <div
                                    onClick={() => setIsRolesExpanded(!isRolesExpanded)}
                                    className="flex items-center justify-between cursor-pointer group/header hidden md:flex mt-2 mb-1 p-2.5 rounded-xl border-2 border-slate-100 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all shadow-sm active:scale-[0.98] select-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <IdentificationCard size={16} className="text-blue-500" weight="fill" />
                                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest group-hover/header:text-blue-600 transition-colors">תפקידים</div>
                                    </div>
                                    <div className={`transition-transform duration-300 ${isRolesExpanded ? 'rotate-180' : ''}`}>
                                        <CaretDown size={14} className="text-slate-400 group-hover/header:text-blue-600" />
                                    </div>
                                </div>

                                {isRolesExpanded && (
                                    <div className="flex flex-col md:gap-1 pl-1 pr-1 md:animate-in md:fade-in md:slide-in-from-top-1">
                                        <button
                                            onClick={() => setSelectedRoleFilter('')}
                                            className={`whitespace-nowrap px-4 py-2 md:px-2.5 md:py-1.5 rounded-xl md:rounded-lg text-sm md:text-xs font-black transition-all active:scale-95 ${!selectedRoleFilter ? 'bg-blue-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            כל התפקידים
                                        </button>
                                        {roles.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => setSelectedRoleFilter(selectedRoleFilter === r.id ? '' : r.id)}
                                                className={`whitespace-nowrap px-4 py-2 md:px-2.5 md:py-1.5 rounded-xl md:rounded-lg text-sm md:text-xs font-black transition-all active:scale-95 ${selectedRoleFilter === r.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                {r.name}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* TEAMS SECTION */}
                                <div
                                    onClick={() => setIsTeamsExpanded(!isTeamsExpanded)}
                                    className="flex items-center justify-between cursor-pointer group/header hidden md:flex mt-4 mb-1 p-2.5 rounded-xl border-2 border-slate-100 bg-white hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm active:scale-[0.98] select-none"
                                >
                                    <div className="flex items-center gap-2">
                                        <Users size={16} className="text-indigo-500" weight="fill" />
                                        <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest group-hover/header:text-indigo-600 transition-colors">צוותים</div>
                                    </div>
                                    <div className={`transition-transform duration-300 ${isTeamsExpanded ? 'rotate-180' : ''}`}>
                                        <CaretDown size={14} className="text-slate-400 group-hover/header:text-indigo-600" />
                                    </div>
                                </div>

                                {isTeamsExpanded && (
                                    <div className="flex flex-col md:gap-1 pl-1 pr-1 md:animate-in md:fade-in md:slide-in-from-top-1">
                                        <button
                                            onClick={() => setSelectedTeamFilter('')}
                                            className={`whitespace-nowrap px-4 py-2 md:px-2.5 md:py-1.5 rounded-xl md:rounded-lg text-sm md:text-xs font-black transition-all active:scale-95 ${!selectedTeamFilter ? 'bg-indigo-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            כל הצוותים
                                        </button>
                                        {teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => setSelectedTeamFilter(selectedTeamFilter === t.id ? '' : t.id)}
                                                className={`whitespace-nowrap px-4 py-2 md:px-2.5 md:py-1.5 rounded-xl md:rounded-lg text-sm md:text-xs font-black transition-all active:scale-95 flex items-center justify-between gap-3 ${selectedTeamFilter === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white md:bg-transparent border border-slate-200 md:border-none text-slate-600 hover:bg-slate-100'}`}
                                            >
                                                <span>{t.name}</span>
                                                <div className={`w-2 h-2 rounded-full border border-white/20 ${t.color?.replace('border-', 'bg-') || 'bg-slate-300'}`}></div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. MIDDLE COLUMN: POOL */}
                {!isViewer && (
                    <div className={`flex-1 bg-white flex flex-col min-h-0 overflow-hidden relative ${activeMobileTab === 'available' ? 'flex' : 'hidden md:flex'}`}>
                        <div className="p-3 md:p-2 border-b border-slate-100 flex justify-between items-center text-sm md:text-xs bg-white sticky top-0 z-20">
                            <div className="flex items-center gap-2">
                                <span className="font-black text-slate-900 tracking-tight">מאגר זמין ({availablePeopleWithMetrics.length})</span>
                                <Tooltip content={
                                    <div className="text-right space-y-1">
                                        <div className="font-bold border-b border-slate-500/30 pb-1 mb-1">סדר המיון (מהגבוה לנמוך):</div>
                                        <div>1. זמינות (ללא הרחקות/חסימות)</div>
                                        <div>2. ללא חפיפת זמנים</div>
                                        <div>3. עומס יומי נמוך</div>
                                        <div>4. מרווח זמן מקסימלי לפני המשימה הבאה</div>
                                    </div>
                                }>
                                    <Info size={14} className="text-slate-400 cursor-help hover:text-blue-500 transition-colors" weight="bold" />
                                </Tooltip>
                            </div>
                            <button
                                onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all ${showDetailedMetrics ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                {showDetailedMetrics ? <ArrowLeft size={14} weight="bold" /> : <Info size={14} weight="bold" />}
                                <span>{showDetailedMetrics ? 'תצוגה מצומצמת' : 'הצג פירוט'}</span>
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-3 md:p-2 space-y-3 md:space-y-1">
                            {availablePeopleWithMetrics.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-3 border-2 border-dashed border-slate-100 rounded-3xl mt-4">
                                    <Users size={48} weight="thin" />
                                    <div className="text-center">
                                        <div className="font-black text-slate-600">לא נמצאו התאמות</div>
                                        <div className="text-xs">נסה לשנות את הסינון או את החיפוש</div>
                                    </div>
                                </div>
                            ) : (
                                availablePeopleWithMetrics.map(({ person: p, metrics }, idx) => {
                                    const availability = getEffectiveAvailability(p, selectedDate, teamRotations, absences, hourlyBlockages);

                                    // Visual Capacity Calc
                                    const capacityPercent = Math.min((metrics.dailyLoad / 8) * 100, 100);
                                    const capacityColor = metrics.dailyLoad > 10 ? 'bg-red-500' : metrics.dailyLoad > 7 ? 'bg-amber-500' : 'bg-blue-500';

                                    return (
                                        <div
                                            key={p.id}
                                            onClick={() => handleAttemptAssign(p.id)}
                                            className={`group flex flex-col p-3 rounded-2xl md:rounded-xl border shadow-sm transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden ${!metrics.isAvailable
                                                ? (metrics.isHome || metrics.isBlocked ? 'border-red-100 bg-red-50/20 opacity-75' : 'border-amber-100 bg-amber-50/20 opacity-75')
                                                : metrics.hasOverlap
                                                    ? 'border-red-200 bg-red-50/30'
                                                    : metrics.score > 80
                                                        ? 'border-emerald-200 bg-emerald-50/10'
                                                        : 'border-slate-100 bg-white hover:border-blue-300 hover:shadow-md'
                                                }`}
                                        >
                                            {/* Row 1: Identity & Match */}
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <div
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedPersonForInfo(p);
                                                            }}
                                                            className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[10px] font-black shadow-sm ${p.color} cursor-help hover:scale-110 transition-all`}
                                                        >
                                                            {getPersonInitials(p.name)}
                                                        </div>
                                                        {metrics.isAvailable && (
                                                            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedPersonForInfo(p);
                                                                }}
                                                                className="text-sm font-black text-slate-800 truncate hover:text-blue-600 hover:underline cursor-pointer pb-0.5"
                                                            >
                                                                {p.name}
                                                            </span>
                                                            {metrics.hasOverlap && (
                                                                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-black border border-red-200">
                                                                    <WarningCircle size={10} weight="fill" />
                                                                    <span>חפיפה</span>
                                                                </div>
                                                            )}
                                                            {metrics.isHome && (
                                                                <Tooltip content={metrics.blockReason || 'בבית'}>
                                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-black border border-purple-200 cursor-help max-w-[120px]">
                                                                        <House size={10} weight="fill" />
                                                                        <span className="truncate">{metrics.blockReason || 'בבית'}</span>
                                                                    </div>
                                                                </Tooltip>
                                                            )}
                                                            {(metrics.isBlocked || metrics.isTimeBlocked) && (
                                                                <Tooltip content={metrics.blockReason || 'חסימת לו״ז'}>
                                                                    <div
                                                                        onClick={(e) => {
                                                                            if (onNavigate && (metrics.isPinnedToDifferentTask || metrics.isNeverAssign || metrics.isTimeBlocked)) {
                                                                                e.stopPropagation();
                                                                                onClose();
                                                                                onNavigate('constraints');
                                                                            }
                                                                        }}
                                                                        className={`flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[9px] font-black border border-slate-200 ${onNavigate ? 'cursor-pointer hover:bg-slate-200' : 'cursor-help'} max-w-[120px] transition-colors`}
                                                                    >
                                                                        <Prohibit size={10} weight="bold" />
                                                                        <span className="truncate">{metrics.blockReason || 'חסימה'}</span>
                                                                    </div>
                                                                </Tooltip>
                                                            )}
                                                            {metrics.isNeverAssign && (
                                                                <Tooltip content={metrics.blockReason || 'אילוץ שיבוץ'}>
                                                                    <div
                                                                        onClick={(e) => {
                                                                            if (onNavigate) {
                                                                                e.stopPropagation();
                                                                                onClose();
                                                                                onNavigate('constraints');
                                                                            }
                                                                        }}
                                                                        className={`flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[9px] font-black border border-red-200 ${onNavigate ? 'cursor-pointer hover:bg-red-200' : 'cursor-help'} max-w-[120px] transition-colors`}
                                                                    >
                                                                        <Prohibit size={10} weight="bold" />
                                                                        <span className="truncate">{metrics.blockReason || 'אילוץ'}</span>
                                                                    </div>
                                                                </Tooltip>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                                            {teams.find(t => t.id === p.teamId)?.name || 'ללא צוות'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <Tooltip content="Match Score: דירוג התאמה">
                                                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${metrics.hasOverlap ? 'bg-red-100 text-red-600 border border-red-200' :
                                                            metrics.score > 80 ? 'bg-emerald-100 text-emerald-700' :
                                                                metrics.score > 50 ? 'bg-blue-100 text-blue-700' :
                                                                    'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            <Sparkles size={11} weight="fill" />
                                                            {metrics.score}%
                                                        </div>
                                                    </Tooltip>
                                                    <Plus size={16} className="text-blue-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity" weight="bold" />
                                                </div>
                                            </div>

                                            {/* Row 2: Status & Load */}

                                            {/* Row 3: Temporal Context Dashboard */}
                                            {showDetailedMetrics && (
                                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                                    {/* Last Task */}
                                                    <div className="flex flex-col p-2 rounded-lg bg-red-50/20 border border-red-100/50">
                                                        <div className="flex items-center gap-1 text-[8px] font-black text-red-400 uppercase tracking-tighter mb-1">
                                                            <ClockCounterClockwise size={10} weight="bold" />
                                                            <span>משימה אחרונה</span>
                                                        </div>
                                                        {metrics.lastShift ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-700 leading-tight truncate">
                                                                    {taskTemplates?.find(t => t.id === metrics.lastShift?.taskId)?.name || 'משימה'}
                                                                </span>
                                                                <span className={`text-[9px] font-bold ${metrics.isRestSufficient ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                    {Math.floor(metrics.hoursSinceLast) === 0 ? 'צמוד' : `לפני ${Math.floor(metrics.hoursSinceLast)}ש׳`}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 italic">אין מידע</span>
                                                        )}
                                                    </div>

                                                    {/* Next Task */}
                                                    <div className={`flex flex-col p-2 rounded-lg border ${metrics.hoursUntilNext < taskMinRest ? 'bg-red-50/50 border-red-200' : 'bg-blue-50/20 border-blue-100/50'}`}>
                                                        <div className={`flex items-center gap-1 text-[8px] font-black uppercase tracking-tighter mb-1 ${metrics.hoursUntilNext < taskMinRest ? 'text-red-500' : 'text-blue-400'}`}>
                                                            <ClockAfternoon size={10} weight="bold" />
                                                            <span>משימה הבאה</span>
                                                        </div>
                                                        {metrics.nextShift ? (
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] font-black text-slate-700 leading-tight truncate">
                                                                    {taskTemplates?.find(t => t.id === metrics.nextShift?.taskId)?.name || 'משימה'}
                                                                </span>
                                                                <span className={`text-[9px] font-bold ${metrics.hoursUntilNext < taskMinRest ? 'text-red-600' : 'text-blue-600'}`}>
                                                                    {metrics.hoursUntilNext < 0.1 ? 'צמוד (0 זמן מנוחה)' : `בעוד ${Math.floor(metrics.hoursUntilNext)}ש׳`}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-slate-300 italic">אין מידע</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                }))}
                        </div>
                    </div>
                )}

                {/* 3. RIGHT COLUMN: ASSIGNED */}
                <div className={`${isViewer ? 'w-full flex flex-col flex-1 overflow-hidden relative' : `md:w-[30%] bg-slate-50/50 border-r border-slate-200 flex flex-col overflow-hidden relative ${activeMobileTab === 'assigned' ? 'flex flex-1' : 'hidden md:flex'}`}`}>
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
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-black ${p.color} cursor-help hover:scale-110 transition-all ${hasConflict ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' : ''} ${optimisticCommanderId === p.id ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                                            >
                                                {getPersonInitials(p.name)}
                                                {optimisticCommanderId === p.id && (
                                                    <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-[1.5px] border border-white">
                                                        <Crown size={8} weight="fill" />
                                                    </div>
                                                )}
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
                                                    {optimisticCommanderId === p.id && (
                                                        <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded flex items-center gap-0.5 border border-amber-100">
                                                            <Crown size={10} weight="fill" />
                                                            מפקד
                                                        </span>
                                                    )}
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

                                    {/* Phone Number - Moved to Left Side & Bigger */}
                                    {p.phone && (
                                        <div className="mr-auto pl-1">
                                            <Tooltip content={`שלח WhatsApp ל: ${p.phone}`}>
                                                <a
                                                    href={getWhatsAppLink(p.phone)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-600 rounded-xl border border-green-100 hover:bg-green-500 hover:text-white hover:shadow-lg hover:shadow-green-200 transition-all group/wa shrink-0"
                                                >
                                                    <WhatsappLogo size={18} weight="fill" className="group-hover/wa:scale-110 transition-transform" />
                                                </a>
                                            </Tooltip>
                                        </div>
                                    )}

                                    {!isViewer && (
                                        <div className={`flex items-center gap-1 ${!p.phone ? 'mr-auto' : ''}`}>
                                            {/* Role Icon Picker */}
                                            <div className="relative group/role">
                                                {(() => {
                                                    const assignedRoleId = optimisticRoleAssignments[p.id];
                                                    const role = roles.find(r => r.id === assignedRoleId);
                                                    const Icon = (role?.icon && ROLE_ICONS[role.icon]) ? ROLE_ICONS[role.icon] : Shield;

                                                    return (
                                                        <Tooltip content={role ? `תפקיד מוגדר: ${role.name}` : "הגדר תפקיד לשיבוץ"}>
                                                            <div className="relative">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Basic implementation: cycle through person's roles or show a small menu
                                                                        // For now, let's just show the icon. We'll add a picker if needed.
                                                                    }}
                                                                    className={`p-2 transition-all rounded-lg ${assignedRoleId ? 'text-indigo-600 bg-indigo-50 shadow-sm' : 'text-slate-300 hover:text-indigo-500 hover:bg-slate-50'}`}
                                                                >
                                                                    <Icon size={18} weight={assignedRoleId ? "fill" : "bold"} />
                                                                </button>

                                                                {/* Simple Dropdown for Role Selection */}
                                                                <div className="absolute left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 hidden group-hover/role:block min-w-[120px] p-1">
                                                                    <div className="text-[9px] font-black text-slate-400 px-2 py-1 uppercase tracking-tighter border-b border-slate-50 mb-1">שנה תפקיד</div>
                                                                    {roleComposition.map(rc => {
                                                                        const r = roles.find(role => role.id === rc.roleId);
                                                                        if (!r) return null;
                                                                        return (
                                                                            <button
                                                                                key={r.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    const nextAssignments = { ...optimisticRoleAssignments, [p.id]: r.id };
                                                                                    setOptimisticRoleAssignments(nextAssignments);
                                                                                    onUpdateShift({
                                                                                        ...selectedShift,
                                                                                        metadata: {
                                                                                            ...(selectedShift.metadata || {}),
                                                                                            roleAssignments: nextAssignments
                                                                                        }
                                                                                    });
                                                                                }}
                                                                                className={`w-full text-right px-2 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between gap-2 ${optimisticRoleAssignments[p.id] === r.id ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                                                                            >
                                                                                <span>{r.name}</span>
                                                                                {(() => {
                                                                                    const RI = (r.icon && ROLE_ICONS[r.icon]) ? ROLE_ICONS[r.icon] : Shield;
                                                                                    return <RI size={14} weight={optimisticRoleAssignments[p.id] === r.id ? "fill" : "bold"} />;
                                                                                })()}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                    {/* Option to clear */}
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const nextAssignments = { ...optimisticRoleAssignments };
                                                                            delete nextAssignments[p.id];
                                                                            setOptimisticRoleAssignments(nextAssignments);
                                                                            onUpdateShift({
                                                                                ...selectedShift,
                                                                                metadata: {
                                                                                    ...(selectedShift.metadata || {}),
                                                                                    roleAssignments: nextAssignments
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="w-full text-right px-2 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors border-t border-slate-50 mt-1"
                                                                    >
                                                                        נקה הגדרה
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </Tooltip>
                                                    );
                                                })()}
                                            </div>

                                            <Tooltip content={optimisticCommanderId === p.id ? "הסר מינוי מפקד" : "מנה למפקד משימה"}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const isCommander = optimisticCommanderId === p.id;
                                                        const nextId = isCommander ? undefined : p.id;
                                                        setOptimisticCommanderId(nextId);

                                                        const newMetadata = {
                                                            ...(selectedShift.metadata || {}),
                                                            commanderId: nextId
                                                        };
                                                        onUpdateShift({ ...selectedShift, metadata: newMetadata });
                                                    }}
                                                    className={`p-2 transition-all rounded-lg ${optimisticCommanderId === p.id ? 'text-amber-500 bg-amber-50 shadow-sm' : 'text-slate-300 hover:text-amber-500 hover:bg-slate-50'}`}
                                                >
                                                    <Crown size={18} weight={optimisticCommanderId === p.id ? "fill" : "bold"} />
                                                </button>
                                            </Tooltip>
                                            <button
                                                onClick={() => {
                                                    setOptimisticUnassignedIds(prev => new Set(prev).add(p.id));

                                                    // Also clear role assignment when unassigning
                                                    const nextAssignments = { ...optimisticRoleAssignments };
                                                    delete nextAssignments[p.id];
                                                    setOptimisticRoleAssignments(nextAssignments);

                                                    onUnassign(selectedShift.id, p.id, task.name, {
                                                        ...(selectedShift.metadata || {}),
                                                        roleAssignments: nextAssignments
                                                    });
                                                }}
                                                className={`p-2 transition-colors ${hasConflict ? 'text-red-500 hover:bg-red-50' : 'text-slate-300 hover:text-red-500'} rounded-lg`}
                                            >
                                                <X size={18} weight="bold" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div className="h-4 md:h-2" />
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
                        potentialShift={selectedShift} // Pass the potential shift
                        potentialTask={task}           // Pass the potential task context
                        taskTemplates={taskTemplates}
                    />
                )
            }
            {/* Mobile Filters Modal */}
            {isMobile && showMobileFilters && (
                <div className="fixed inset-0 z-[100] flex flex-col bg-white animate-in slide-in-from-bottom duration-300">
                    <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                            <Funnel size={20} className="text-blue-600" weight="bold" />
                            <h3 className="font-black text-lg">סינון חיילים</h3>
                        </div>
                        <button onClick={() => setShowMobileFilters(false)} className="p-2 bg-slate-100 rounded-full">
                            <X size={20} weight="bold" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        {/* Roles */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <IdentificationCard size={18} className="text-blue-500" weight="fill" />
                                <span className="font-black text-sm uppercase tracking-wider text-slate-500">תפקידים</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedRoleFilter('')}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${!selectedRoleFilter ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    כל התפקידים
                                </button>
                                {roles.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => setSelectedRoleFilter(selectedRoleFilter === r.id ? '' : r.id)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${selectedRoleFilter === r.id ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        {r.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Teams */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Users size={18} className="text-indigo-500" weight="fill" />
                                <span className="font-black text-sm uppercase tracking-wider text-slate-500">צוותים</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    onClick={() => setSelectedTeamFilter('')}
                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${!selectedTeamFilter ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                                >
                                    כל הצוותים
                                </button>
                                {teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'he')).map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setSelectedTeamFilter(selectedTeamFilter === t.id ? '' : t.id)}
                                        className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${selectedTeamFilter === t.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        <span>{t.name}</span>
                                        <div className={`w-2 h-2 rounded-full ${t.color?.replace('border-', 'bg-') || 'bg-slate-300'}`}></div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t sticky bottom-0 bg-white">
                        <Button variant="primary" onClick={() => setShowMobileFilters(false)} className="w-full font-bold py-3">אישור וסגירה</Button>
                    </div>
                </div>
            )}
        </GenericModal >
    );
};
