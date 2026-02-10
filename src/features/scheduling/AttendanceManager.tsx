
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import ExcelJS from 'exceljs';
import { Person, Team, Role, TeamRotation, TaskTemplate, SchedulingConstraint, OrganizationSettings, Shift, DailyPresence, Absence, Organization } from '@/types';
import { supabase } from '@/lib/supabase';
import { CalendarBlank as Calendar, CheckCircle as CheckCircle2, XCircle, CaretRight as ChevronRight, CaretLeft as ChevronLeft, MagnifyingGlass as Search, Gear as Settings, Calendar as CalendarDays, CaretDown as ChevronDown, ArrowLeft, ArrowRight, CheckSquare, ListChecks, X, MagicWand as Wand2, Sparkle as Sparkles, Users, DotsThreeVertical, DownloadSimple as Download, ChartBar, WarningCircle as AlertCircle, FileXls } from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'framer-motion';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { PersonalAttendanceCalendar } from './PersonalAttendanceCalendar';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { GlobalTeamCalendar } from './GlobalTeamCalendar';
import { RotationEditor } from './RotationEditor';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { logger } from '../../services/loggingService';
import { AuditLog, fetchAttendanceLogs, subscribeToAuditLogs } from '@/services/auditService';
import { ActivityFeed } from '../../components/ui/ActivityFeed';
import { ClockCounterClockwise } from '@phosphor-icons/react';
import { AttendanceTable } from './AttendanceTable';
import { BulkAttendanceModal } from './BulkAttendanceModal';
import { useToast } from '@/contexts/ToastContext';
import { RotaWizardModal } from './RotaWizardModal';
import { AttendanceStatsModal } from './AttendanceStatsModal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { PageInfo } from '@/components/ui/PageInfo';
import { useAuth } from '@/features/auth/AuthContext';
import { schedulingService } from '@/services/schedulingService';
import { ExportButton } from '../../components/ui/ExportButton';
import { ActionBar, ActionListItem } from '@/components/ui/ActionBar';
import { generateAttendanceExcel } from '@/utils/attendanceExport';
import { attendanceService } from '@/services/attendanceService';
import { ExcelV2ImportModal } from './ExcelV2ImportModal';
import { ImportAttendanceModal } from './ImportAttendanceModal';


interface AttendanceManagerProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    teamRotations?: TeamRotation[];
    tasks?: TaskTemplate[]; // NEW
    constraints?: SchedulingConstraint[]; // NEW
    absences?: Absence[]; // NEW
    hourlyBlockages?: import('@/types').HourlyBlockage[]; // NEW
    settings?: OrganizationSettings | null; // NEW
    organization?: Organization; // NEW: For V2 engine_version check
    companies?: Organization[]; // NEW
    onUpdatePerson: (p: Person) => Promise<void> | void;
    onUpdatePeople?: (people: Person[]) => void;
    onAddRotation?: (r: TeamRotation) => void;
    onUpdateRotation?: (r: TeamRotation) => void;
    onDeleteRotation?: (id: string) => void;
    onAddShifts?: (shifts: Shift[]) => void; // NEW
    shifts?: Shift[]; // NEW
    isViewer?: boolean;
    initialOpenRotaWizard?: boolean;
    onDidConsumeInitialAction?: () => void;
    onRefresh?: () => void; // NEW
    initialPersonId?: string;
    onClearNavigationAction?: () => void;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({
    people, teams, roles, teamRotations = [],
    tasks = [], constraints = [], absences = [], hourlyBlockages = [], settings = null,
    organization,
    companies = [],
    shifts = [],
    onUpdatePerson, onUpdatePeople,
    onAddRotation, onUpdateRotation, onDeleteRotation, onAddShifts,
    isViewer = false, initialOpenRotaWizard = false, onDidConsumeInitialAction, onRefresh,
    initialPersonId, onClearNavigationAction
}) => {
    const historyEntityTypes = useMemo(() => ['attendance', 'people', 'person', 'daily_presence', 'daily_presence_v2'], []);

    const { profile, user } = useAuth(); // Destructure user for linking
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    // --- SCOPE FILTERING LOGIC ---
    // 1. Identify the current user's Person record
    const myPerson = React.useMemo(() => {
        if (!user || !people) return null;
        return people.find(p => p.userId === user?.id);
    }, [people, user]);

    // 2. Determine Data Scope
    const dataScope = profile?.permissions?.dataScope || 'organization';

    // 3. Filter People based on Scope
    const scopedPeople = React.useMemo(() => {
        const active = people.filter(p => p.isActive !== false);

        if (dataScope === 'personal') {
            // Personal: Show ONLY the user
            return myPerson ? active.filter(p => p.id === myPerson.id) : [];
        }

        if (dataScope === 'team' || dataScope === 'my_team') {
            // Team: Show ONLY the user's team members
            if (!myPerson?.teamId) return myPerson ? [myPerson] : []; // Fallback if no team assigned
            return active.filter(p => p.teamId === myPerson.teamId);
        }

        // Organization/Battalion: Show ALL
        return active;
    }, [people, dataScope, myPerson]);

    // 4. Filter Teams based on Scope (Optional but cleaner UI)
    const scopedTeams = React.useMemo(() => {
        if (dataScope === 'personal') {
            // For personal view, we still need the team object for the header to render correctly
            if (!myPerson?.teamId) return [];
            return teams.filter(t => t.id === myPerson.teamId);
        }

        if (dataScope === 'team' || dataScope === 'my_team') {
            if (!myPerson?.teamId) return [];
            return teams.filter(t => t.id === myPerson.teamId);
        }

        return teams;
    }, [teams, dataScope, myPerson]);

    // Use scoped data for the rest of the component
    const activePeople = scopedPeople;
    const visibleTeams = scopedTeams; // Need to replace usage of 'teams' with 'visibleTeams' where appropriate

    const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'day_detail'>('calendar');
    const [calendarViewType, setCalendarViewType] = useState<'grid' | 'table'>('grid'); // NEW: sub-view for calendar
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date()); // Lifted state for calendar view
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(() => new Set(visibleTeams.map(t => t.id)));
    const [searchTerm, setSearchTerm] = useState('');
    const [showRotationSettings, setShowRotationSettings] = useState<string | null>(null);
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);
    const [editingPersonalRotation, setEditingPersonalRotation] = useState<Person | null>(null);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Bulk Mode State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [showRequiredDetails, setShowRequiredDetails] = useState(false); // New State
    const [selectedPersonIds, setSelectedPersonIds] = useState<Set<string>>(new Set());
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [showRotaWizard, setShowRotaWizard] = useState(initialOpenRotaWizard); // Initialize from prop
    const [showStatistics, setShowStatistics] = useState(false);
    const [statsEntity, setStatsEntity] = useState<{ person?: Person, team?: Team } | null>(null);
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [confirmationState, setConfirmationState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText?: string;
        type?: 'warning' | 'danger' | 'info';
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [externalEditingCell, setExternalEditingCell] = useState<{ personId: string; dates: string[] } | null>(null);
    const [exportStartDate, setExportStartDate] = useState('');
    const [exportEndDate, setExportEndDate] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [historyFilters, setHistoryFilters] = useState<import('@/services/auditService').LogFilters | undefined>(undefined);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
    const [showV2Import, setShowV2Import] = useState(false);
    const [showExcelImport, setShowExcelImport] = useState(false);

    useEffect(() => {
        if (initialOpenRotaWizard && onDidConsumeInitialAction) {
            onDidConsumeInitialAction();
        }
    }, [initialOpenRotaWizard, onDidConsumeInitialAction]);

    // Lifted Activity Feed Loading & Subscription


    // Handle initial person selection
    useEffect(() => {
        if (initialPersonId) {
            const person = people.find(p => p.id === initialPersonId);
            if (person) {
                setSelectedPersonForCalendar(person);
                setViewMode('calendar');
                onClearNavigationAction?.();
            }
        }
    }, [initialPersonId, people, onClearNavigationAction]);

    const getPersonAvailability = (person: Person) => {
        return getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages, organization?.engine_version);
    };

    const toggleTeamCollapse = (teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    };

    // ... (rest of code) ...


    const dateKey = selectedDate.toLocaleDateString('en-CA');

    const handleTogglePresence = (person: Person) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        const newIsAvailable = !currentData.isAvailable;
        let newData = {
            isAvailable: newIsAvailable,
            startHour: '00:00',
            endHour: '23:59',
            source: 'manual'
        };

        if (!newIsAvailable) {
            newData.startHour = '00:00';
            newData.endHour = '00:00';
        }

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: newData
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const handleTimeChange = (person: Person, field: 'startHour' | 'endHour', value: string) => {
        if (isViewer) return;
        const currentData = getPersonAvailability(person);

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...person.dailyAvailability,
                [dateKey]: {
                    ...currentData,
                    isAvailable: true,
                    [field]: value,
                    source: 'manual'
                }
            }
        };
        onUpdatePerson(updatedPerson);
    };

    const filteredPeople = activePeople.filter(p => p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm)));

    let peopleByTeam = visibleTeams.map(team => ({
        team,
        members: filteredPeople
            .filter(p => p.teamId === team.id)
            .sort((a, b) => {
                // Stable sort by name only
                return a.name.localeCompare(b.name);
            })
    }));

    const noTeamMembers = filteredPeople.filter(p => !p.teamId || !visibleTeams.find(t => t.id === p.teamId));
    if (noTeamMembers.length > 0) {
        peopleByTeam.push({
            team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' },
            members: noTeamMembers
        });
    }

    peopleByTeam.sort((a, b) => b.members.length - a.members.length);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setViewMode('day_detail');
    };

    const handleBackToCalendar = () => {
        setViewMode('calendar');
        setIsBulkMode(false);
        setSelectedPersonIds(new Set());
    };

    // Bulk Actions
    const handleToggleSelectPerson = (id: string) => {
        const next = new Set(selectedPersonIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedPersonIds(next);
    };

    const handleSelectAll = () => {
        if (selectedPersonIds.size === filteredPeople.length) {
            setSelectedPersonIds(new Set());
        } else {
            setSelectedPersonIds(new Set(filteredPeople.map(p => p.id)));
        }
    };

    const handleBulkApply = async (data: { startDate: string; endDate: string; isAvailable: boolean; startHour: string; endHour: string; reason?: string }) => {
        const dateRange: string[] = [];
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        const current = new Date(start);

        while (current <= end) {
            dateRange.push(current.toLocaleDateString('en-CA'));
            current.setDate(current.getDate() + 1);
        }

        const promises: Promise<any>[] = [];
        const status = data.isAvailable ? 'base' : 'home';
        const customTimes = { start: data.startHour, end: data.endHour };

        activePeople.forEach(person => {
            if (selectedPersonIds.has(person.id)) {
                // Call handleUpdateAvailability for each person to ensure individual audit logs
                promises.push(handleUpdateAvailability(
                    person.id,
                    dateRange,
                    status,
                    customTimes,
                    undefined,
                    undefined,
                    undefined,
                    true, // forceConfirm
                    true  // silent
                ));
            }
        });

        await Promise.all(promises);
        showToast(`${promises.length} לוחמים עודכנו בהצלחה`, 'success');
        setIsBulkMode(false);
        setSelectedPersonIds(new Set());
    };

    const handleQuickBulkUpdate = (isAvailable: boolean) => {
        const dateStr = selectedDate.toLocaleDateString('en-CA');
        handleBulkApply({
            startDate: dateStr,
            endDate: dateStr,
            isAvailable,
            startHour: isAvailable ? '00:00' : '00:00',
            endHour: isAvailable ? '23:59' : '00:00'
        });
    };

    const handleUpdatePersonalRotation = (rotationSettings: any) => {
        if (!editingPersonalRotation) return;
        const updatedPerson = {
            ...editingPersonalRotation,
            personalRotation: rotationSettings
        };
        onUpdatePerson(updatedPerson);
        setEditingPersonalRotation(null);
        showToast('הגדרות סבב אישי עודכנו', 'success');
    };

    const handleUpdateAvailability = async (personId: string, dateOrDates: string | string[], status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }, newUnavailableBlocks?: { id: string, start: string, end: string, reason?: string, type?: string }[], homeStatusType?: import('@/types').HomeStatusType, actualTimes?: { arrival?: string, departure?: string }, forceConfirm = false, silent = false) => {
        if (isViewer) return;

        const person = people.find(p => p.id === personId);
        if (!person) return;

        const dates = Array.isArray(dateOrDates) ? dateOrDates : [dateOrDates];
        const oldAvail = getPersonAvailability(person); // Capture old status

        // NEW: Check for conflicts if changing to home/unavailable
        if (!forceConfirm && (status === 'home' || status === 'unavailable')) {
            const conflictingShifts = shifts.filter(s => {
                if (!s.assignedPersonIds.includes(personId) || s.isCancelled) return false;

                const shiftStart = new Date(s.startTime);
                const shiftEnd = new Date(s.endTime);

                return dates.some(dateStr => {
                    const dayStart = new Date(dateStr);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(dateStr);
                    dayEnd.setHours(24, 0, 0, 0);

                    return shiftStart < dayEnd && shiftEnd > dayStart;
                });
            });

            if (conflictingShifts.length > 0) {
                const shiftDescriptions = conflictingShifts.map(s => {
                    const task = tasks.find(t => t.id === s.taskId);
                    const time = `${s.startTime.split('T')[1].slice(0, 5)} - ${s.endTime.split('T')[1].slice(0, 5)}`;
                    return `${task?.name || 'משימה'} (${time}) בתאריך ${s.startTime.split('T')[0]}`;
                }).join('\n');

                setConfirmationState({
                    isOpen: true,
                    title: 'נמצאו שיבוצים פעילים',
                    message: `שים לב, לחייל ${person.name} ישנם שיבוצים פעילים בתאריכים שנבחרו:\n\n${shiftDescriptions}\n\nהאם אתה בטוח שברצונך לשנות את הסטטוס ל"בית"? (יהיה עלייך להחליף אותו ידנית בלוח השיבוצים)`,
                    confirmText: 'כן, שנה סטטוס',
                    type: 'warning',
                    onConfirm: () => {
                        setConfirmationState(prev => ({ ...prev, isOpen: false }));
                        handleUpdateAvailability(personId, dateOrDates, status, customTimes, newUnavailableBlocks, homeStatusType, actualTimes, true);
                    }
                });
                return;
            }
        }

        let updatedAvailability = { ...person.dailyAvailability };

        const blockAddPromises: Promise<any>[] = [];
        const blockUpdatePromises: Promise<any>[] = [];
        const blockDeleteIds: string[] = [];
        const otherPromises: Promise<any>[] = [];

        for (const date of dates) {
            const currentData = updatedAvailability[date] || {
                isAvailable: true,
                startHour: '00:00',
                endHour: '23:59',
                source: 'manual',
                unavailableBlocks: []
            };

            // 1. Sync Hourly Blockages (NEW TABLE)
            if (newUnavailableBlocks) {
                const dateKey = new Date(date).toISOString().split('T')[0]; // Ensure 'YYYY-MM-DD'
                const existingBlocks = hourlyBlockages.filter(b => b.person_id === personId && b.date === dateKey);
                const incomingBlocks = newUnavailableBlocks.filter(b => b.type !== 'absence'); // Only manual blocks

                // A. DELETE blocks that are no longer present
                const incomingIds = incomingBlocks.map(b => b.id);
                const toDelete = existingBlocks.filter(b => !incomingIds.includes(b.id));
                toDelete.forEach(b => {
                    blockDeleteIds.push(b.id);
                    otherPromises.push(schedulingService.deleteHourlyBlockage(b.id));
                });

                // B. UPSERT (Add or Update) incoming
                for (const mb of incomingBlocks) {
                    const existing = existingBlocks.find(b => b.id === mb.id);
                    // Check if changed
                    if (!existing || existing.start_time !== mb.start || existing.end_time !== mb.end || existing.reason !== mb.reason) {
                        if (existing) {
                            blockUpdatePromises.push(schedulingService.updateHourlyBlockage({
                                id: mb.id, // Use existing ID if matched
                                person_id: personId,
                                organization_id: profile.organization_id,
                                date: dateKey,
                                start_time: mb.start,
                                end_time: mb.end,
                                reason: mb.reason || ''
                            }));
                        } else {
                            // New
                            blockAddPromises.push(schedulingService.addHourlyBlockage({
                                person_id: personId,
                                organization_id: profile.organization_id, // Fix
                                date: dateKey,
                                start_time: mb.start,
                                end_time: mb.end,
                                reason: mb.reason || ''
                            }));
                        }
                    }
                }
            }

            // 2. Conflict Resolution - Auto-Reject Approved Absences
            if (status === 'base') {
                const dateKey = new Date(date).toISOString().split('T')[0];
                const conflictingAbsence = absences.find(a =>
                    a.person_id === personId &&
                    a.status === 'approved' &&
                    dateKey >= a.start_date &&
                    dateKey <= a.end_date
                );

                if (conflictingAbsence) {
                    try {
                        otherPromises.push(schedulingService.updateAbsence({ ...conflictingAbsence, status: 'rejected' }));
                        logger.info('UPDATE', `Auto-rejected conflicting absence for ${person.name}`, {
                            personId,
                            absenceId: conflictingAbsence.id,
                            date: dateKey,
                            action: 'conflict_resolution'
                        });
                        if (!silent) showToast('היעדרות מאושרת לחפיפה זו בוטלה (נדחתה) עקב שינוי ידני לבסיס', 'info');
                    } catch (e) {
                        // Error logging moved to catch block of Promise.all
                    }
                }
            }

            // 3. Prepare New Data
            let newData: any = {
                ...currentData,
                source: 'manual',
                status: status,
                unavailableBlocks: [] // Cleared as they are now in a separate table
            };


            if (status === 'base') {
                newData.isAvailable = true;
                if (customTimes) {
                    newData.startHour = customTimes.start;
                    newData.endHour = customTimes.end;
                } else {
                    newData.startHour = '00:00';
                    newData.endHour = '23:59';
                }
                newData.homeStatusType = undefined;
            } else if (status === 'home') {
                newData.isAvailable = false;
                newData.startHour = '00:00';
                newData.endHour = '00:00';
                newData.homeStatusType = homeStatusType;
            } else if (status === 'unavailable') {
                newData.isAvailable = false;
                newData.startHour = '00:00';
                newData.endHour = '00:00';
                newData.reason = 'אילוץ / לא זמין';
                newData.homeStatusType = undefined;
            }

            // --- Actual Arrival/Departure Sync ---
            if (actualTimes) {
                if (actualTimes.arrival) {
                    newData.actual_arrival_at = new Date(`${date}T${actualTimes.arrival}`).toISOString();
                } else if (actualTimes.arrival === undefined) {
                    newData.actual_arrival_at = null;
                }

                if (actualTimes.departure) {
                    newData.actual_departure_at = new Date(`${date}T${actualTimes.departure}`).toISOString();
                } else if (actualTimes.departure === undefined) {
                    newData.actual_departure_at = null;
                }
            }

            updatedAvailability[date] = newData;
        }

        // --- SMART ATTENDANCE SYNC REMOVED ---
        // Logic for automatically converting previous/next days to 'home' when moving arrival/departure 
        // has been removed to prevent overwriting user history. 
        // Updates now only affect the explicitly selected date(s).

        // Execute side effects (DB updates)
        if (blockAddPromises.length > 0 || blockUpdatePromises.length > 0 || otherPromises.length > 0) {
            try {
                // ... existing block promises ... 
                const [addedBlocks, updatedBlocks] = await Promise.all([
                    Promise.all(blockAddPromises),
                    Promise.all(blockUpdatePromises),
                    Promise.all(otherPromises)
                ]);

                // ... cache update logic ...
                // Manually update cache to reflect block changes immediately
                const queryKey = ['organizationData', profile.organization_id, profile.id];
                queryClient.setQueriesData({ queryKey }, (old: any) => {
                    if (!old || !old.hourlyBlockages) return old;

                    let newBlockages = [...old.hourlyBlockages];

                    // 1. Remove deleted
                    if (blockDeleteIds.length > 0) {
                        newBlockages = newBlockages.filter(b => !blockDeleteIds.includes(b.id));
                    }

                    // 2. Update existing
                    updatedBlocks.forEach((b: any) => {
                        if (b) newBlockages = newBlockages.map(exist => exist.id === b.id ? b : exist);
                    });

                    // 3. Add new
                    addedBlocks.forEach((b: any) => {
                        if (b && !newBlockages.find(exist => exist.id === b.id)) {
                            newBlockages.push(b);
                        }
                    });

                    return { ...old, hourlyBlockages: newBlockages };
                });

                if (onRefresh) onRefresh();
            } catch (err) {
                logger.error('ERROR', 'Failed to sync blocks/absences', err);
                showToast('שגיאה בשמירת נתונים נלווים', 'error');
            }
        }

        // --- V2 ENGINE CHECK: Use Edge Function, Simplified SQL or V1 Logic ---
        const isV2Engine = organization?.engine_version === 'v2_write_based';
        const isV2Simplified = organization?.engine_version === 'v2_simplified';

        if (isV2Simplified) {
            // ===== V2 SIMPLIFIED LOGIC =====
            const v2SubStateMap: Record<string, import('@/types').V2SubState> = {
                'leave_shamp': 'vacation',
                'gimel': 'gimel',
                'absent': 'absent',
                'organization_days': 'org_days',
                'not_in_shamp': 'not_in_shamp'
            };

            const presenceUpdates = dates.map(dateKey => {
                let v2_sub_state: import('@/types').V2SubState = 'full_day';
                if (status === 'base') {
                    if (customTimes) {
                        if (customTimes.start !== '00:00' && customTimes.end === '23:59') v2_sub_state = 'arrival';
                        else if (customTimes.start === '00:00' && customTimes.end !== '23:59') v2_sub_state = 'departure';
                        else if (customTimes.start !== '00:00' || customTimes.end !== '23:59') v2_sub_state = 'single_day';
                    }
                } else if (status === 'home') {
                    v2_sub_state = (homeStatusType && v2SubStateMap[homeStatusType]) || 'vacation';
                }

                const payload: any = {
                    person_id: person.id,
                    date: dateKey,
                    organization_id: profile.organization_id,
                    updated_at: new Date().toISOString(),
                    v2_state: status === 'unavailable' ? 'home' : status as any,
                    v2_sub_state: v2_sub_state,
                    // Compatible fields for legacy views
                    status: status === 'unavailable' ? 'home' : status,
                    source: 'manual',
                    start_time: customTimes?.start || '00:00',
                    end_time: customTimes?.end || '23:59',
                    home_status_type: homeStatusType
                };

                if (actualTimes) {
                    if (actualTimes.arrival !== undefined) payload.actual_arrival_at = actualTimes.arrival ? new Date(`${dateKey}T${actualTimes.arrival}`).toISOString() : null;
                    if (actualTimes.departure !== undefined) payload.actual_departure_at = actualTimes.departure ? new Date(`${dateKey}T${actualTimes.departure}`).toISOString() : null;
                }

                return payload;
            });

            try {
                // STEP 1: Save all records to DB FIRST
                await attendanceService.upsertDailyPresence(presenceUpdates);

                // STEP 2: Log each update to audit_logs (including before_data for comparison)
                presenceUpdates.forEach(update => {
                    const oldState = person.dailyAvailability?.[update.date];
                    logger.logUpdate(
                        'attendance',
                        update.person_id,
                        person.name,
                        oldState ? {
                            date: update.date,
                            v2_state: oldState.v2_state || (oldState.isAvailable ? 'base' : 'home'),
                            v2_sub_state: oldState.v2_sub_state,
                            start_time: oldState.startHour || '00:00',
                            end_time: oldState.endHour || '23:59',
                            home_status_type: oldState.homeStatusType
                        } : null,
                        {
                            date: update.date,
                            v2_state: update.v2_state,
                            v2_sub_state: update.v2_sub_state,
                            start_time: update.start_time,
                            end_time: update.end_time,
                            home_status_type: update.home_status_type
                        }
                    );
                });

                // STEP 3: Optimistic UI update
                queryClient.setQueryData(['organizationData', profile.organization_id, profile.id], (old: any) => {
                    if (!old || !old.people) return old;
                    const updatedPeople = old.people.map((p: any) => {
                        if (p.id !== person.id) return p;
                        const newAvailability = { ...p.dailyAvailability };
                        presenceUpdates.forEach(upd => {
                            newAvailability[upd.date] = {
                                ...newAvailability[upd.date],
                                isAvailable: upd.v2_state === 'base',
                                startHour: upd.start_time,
                                endHour: upd.end_time,
                                source: 'manual',
                                v2_state: upd.v2_state,
                                v2_sub_state: upd.v2_sub_state,
                                homeStatusType: upd.home_status_type
                            };
                        });
                        return { ...p, dailyAvailability: newAvailability };
                    });
                    return { ...old, people: updatedPeople };
                });

                // STEP 4: Show success message
                if (!silent) showToast(dates.length > 1 ? `${dates.length} ימים עודכנו (V2 Simplified)` : 'הסטטוס עודכן (V2 Simplified)', 'success');

                // STEP 5: NO REFRESH NEEDED - Optimistic UI update already updated the screen!
                // onRefresh() calls get_org_data_bundle_v3 which loads 120 days and causes UI freeze
                // The queryClient.setQueryData above already updated the UI, so we're done!
            } catch (err) {
                console.error("V2 Simplified update failed", err);
                showToast('שגיאה בעדכון נוכחות', 'error');

            }
        } else if (isV2Engine) {
            // ===== V2 WRITE-BASED LOGIC =====
            // Call the update-availability-v2 Edge Function
            try {
                const endDate = dates.length > 0 ? dates[dates.length - 1] : undefined;
                const isOpenLoop = false; // Forced closed loop to prevent accidental future overwrites

                const { data, error } = await supabase.functions.invoke('update-availability-v2', {
                    body: {
                        person_id: person.id,
                        organization_id: profile.organization_id,
                        start_date: dates[0],
                        end_date: endDate,
                        status: status === 'unavailable' ? 'home' : status,
                        home_status_type: status === 'home' ? homeStatusType : undefined,
                        editor_id: user?.id || profile.id
                    }
                });

                if (error) {
                    logger.error('ERROR', 'V2 Edge Function failed', error);
                    showToast('שגיאה בעדכון נוכחות (V2)', 'error');
                    return;
                }

                // Show warning for Open Loop (45 day cap)
                if (isOpenLoop && !silent) {
                    showToast('⚠️ סטטוס ללא תאריך סיום - הוגבל ל-45 ימים קדימה', 'warning');
                }

                logger.info('UPDATE', `V2 Engine: Updated status for ${person.name}`, {
                    personId: person.id,
                    dates: dates.length,
                    date: dates[0], // Inclusion for better filtering
                    status,
                    start: customTimes?.start || '00:00',
                    end: customTimes?.end || '23:59',
                    isOpenLoop,
                    recordsWritten: data?.recordsWritten,
                    entityType: 'attendance'
                });

                // Refresh data to reflect Edge Function changes
                if (onRefresh) onRefresh();
                if (!silent) showToast(dates.length > 1 ? `${dates.length} ימים עודכנו בהצלחה (V2)` : 'הסטטוס עודכן בהצלחה (V2)', 'success');
            } catch (err) {
                logger.error('ERROR', 'V2 Edge Function exception', err);
                if (!silent) showToast('שגיאה בעדכון נוכחות (V2)', 'error');
            }
        } else {
            // ===== V1 LEGACY LOGIC =====
            // Persist to Daily Presence table (ALWAYS, not just when actualTimes exist)
            if (dates.length > 0) {
                const presenceUpdates = dates.map(dateKey => {
                    const availabilityData: any = updatedAvailability[dateKey] || {};

                    // Construct new daily presence object with fallback for required fields
                    const payload: any = {
                        person_id: person.id,
                        date: dateKey,
                        organization_id: profile.organization_id,
                        updated_at: new Date().toISOString(),
                        // Mirror the fields we just set in the JSON logic
                        status: availabilityData.status || 'base',
                        source: availabilityData.source || 'manual',
                        start_time: availabilityData.startHour || '00:00',
                        end_time: availabilityData.endHour || '23:59',
                        home_status_type: availabilityData.homeStatusType
                    };

                    // Include actual times if provided
                    if (actualTimes) {
                        if (actualTimes.arrival !== undefined) payload.actual_arrival_at = actualTimes.arrival ? new Date(`${dateKey}T${actualTimes.arrival}`).toISOString() : null;
                        if (actualTimes.departure !== undefined) payload.actual_departure_at = actualTimes.departure ? new Date(`${dateKey}T${actualTimes.departure}`).toISOString() : null;
                    }

                    return payload;
                });

                try {
                    // STEP 1: Save all records to DB FIRST
                    const result = await attendanceService.upsertDailyPresence(presenceUpdates);

                    // STEP 2: Log each update to audit_logs table (including before_data for comparison)
                    presenceUpdates.forEach(update => {
                        const oldState = person.dailyAvailability?.[update.date];
                        logger.logUpdate(
                            'attendance',
                            update.person_id,
                            person.name,
                            oldState ? {
                                date: update.date,
                                status: oldState.status || (oldState.isAvailable ? 'base' : 'home'),
                                start_time: oldState.startHour || '00:00',
                                end_time: oldState.endHour || '23:59',
                                home_status_type: oldState.homeStatusType
                            } : null,
                            {
                                date: update.date,
                                status: update.status,
                                start_time: update.start_time,
                                end_time: update.end_time,
                                home_status_type: update.home_status_type
                            }
                        );
                    });

                    // STEP 3: Optimistic update: merge the saved presence data back into people
                    queryClient.setQueryData(['organizationData', profile.organization_id, profile.id], (old: any) => {
                        if (!old || !old.people) return old;

                        const updatedPeople = old.people.map((p: any) => {
                            const personUpdates = presenceUpdates.filter((u: any) => u.person_id === p.id);
                            if (personUpdates.length === 0) return p;

                            const updatedAvailability = { ...p.dailyAvailability };
                            personUpdates.forEach((update: any) => {
                                if (!updatedAvailability[update.date]) {
                                    updatedAvailability[update.date] = {};
                                }
                                updatedAvailability[update.date] = {
                                    ...updatedAvailability[update.date],
                                    status: update.status,
                                    startHour: update.start_time,
                                    endHour: update.end_time,
                                    source: update.source,
                                    isAvailable: update.status !== 'unavailable',
                                    homeStatusType: update.home_status_type
                                };
                            });

                            return { ...p, dailyAvailability: updatedAvailability };
                        });

                        return { ...old, people: updatedPeople };
                    });
                } catch (err) {
                    console.error("Failed to update daily_presence", err);
                }
            }

            const updatedPerson = {
                ...person,
                dailyAvailability: updatedAvailability,
                lastManualStatus: {
                    status: status === 'unavailable' ? 'home' : status,
                    homeStatusType: status === 'home' ? homeStatusType : undefined,
                    date: dates[dates.length - 1] // Last date in range
                }
            };

            // NOTE: onUpdatePerson call removed as AttendanceManager handles optimistic UI via queryClient
            // and this call triggers a redundant 'person' audit log.
            // if (onUpdatePerson) onUpdatePerson(updatedPerson);

            const logDate = dates.length > 1 ? `${dates[0]} - ${dates[dates.length - 1]} (${dates.length} days)` : dates[0];

            // V1: Skip people table update - daily_presence is source of truth
            // The optimistic update above already updated the UI with correct data
            // Don't refetch because RLS may prevent reading the data we just wrote
            console.log('⏭️ [AttendanceManager] Skipping onUpdatePerson for V1 - daily_presence is source of truth');
            console.log('✅ [AttendanceManager] V1 save completed successfully (using optimistic update)');
            if (!silent) showToast(dates.length > 1 ? `${dates.length} ימים עודכנו בהצלחה` : 'הסטטוס עודכן בהצלחה', 'success');
        }
    };

    const handleLogClick = (log: import('@/services/auditService').AuditLog) => {
        if (!log.metadata?.date) return;

        // Robust Lookup: Use UUID if available in metadata or entity_id
        const personId = log.metadata?.personId || (log.entity_id?.length === 36 ? log.entity_id : null);

        // Resilient find with trimming and multiple fallbacks
        const person = people.find(p => {
            const pId = p.id;
            const pName = p.name.trim();

            // Check UUID match
            if (personId && pId === personId) return true;
            if (log.entity_id && pId === log.entity_id) return true;

            // Check Name match (trimmed)
            const logEntityName = (log.entity_name || '').trim();
            const logEntityIdAsName = (log.entity_id || '').trim();
            const logMetaName = (log.metadata?.personName || '').trim();

            if (logEntityName && pName === logEntityName) return true;
            if (logEntityIdAsName && pName === logEntityIdAsName) return true;
            if (logMetaName && pName === logMetaName) return true;

            return false;
        });

        if (!person) {
            showToast('החייל לא נמצא במערכת', 'error');
            return;
        }

        let dateStr = log.metadata?.date || (log.metadata?.startTime ? log.metadata.startTime.split('T')[0] : null);


        if (!dateStr) {
            showToast('חסר תאריך ברשומה', 'error');
            return;
        }

        // Handle erroneously stored Hebrew date strings (e.g. "יום ראשון, 11 בינואר")
        if (dateStr.includes('ב')) {
            // Very basic heuristic mapping for the current/previous year if needed, 
            // but ideally we should prevent storing this.
            // For now, let's try to parse or alert.
        }

        let date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            // 2nd Try: If string is Hebrew (e.g., "11 בינואר"), try to map month name manually 
            // This is a patch for legacy bad data.
            const heMonths: Record<string, string> = {
                'בינואר': '01', 'בפברואר': '02', 'במרץ': '03', 'באפריל': '04', 'במאי': '05', 'ביוני': '06',
                'ביולי': '07', 'באוגוסט': '08', 'בספטמבר': '09', 'באוקטובר': '10', 'בנובמבר': '11', 'בדצמבר': '12'
            };

            // Extract day and month simple regex 
            const parts = dateStr.match(/(\d{1,2}) (ב[א-ת]+)/);
            if (parts) {
                const day = parts[1].padStart(2, '0');
                const monthHeb = parts[2];
                const monthNum = heMonths[monthHeb];
                if (monthNum) {
                    // Guess current year or derived year? Default to current year for now
                    const currentYear = new Date().getFullYear();
                    const fixedIso = `${currentYear}-${monthNum}-${day}`;
                    date = new Date(fixedIso);
                }
            }

            if (isNaN(date.getTime())) {
                console.error('❌ Calculated Invalid Date:', dateStr);
                showToast('תאריך לא תקין', 'error');
                return;
            }
        }

        // Switch view to table or day_detail depending on preference
        if (viewMode === 'calendar') setViewMode('table');

        setViewDate(date);
        setSelectedDate(date);

        // Trigger modal open via external cell selection
        setExternalEditingCell({
            personId: person.id,
            dates: [log.metadata.date]
        });

        showToast(`פותח עריכה עבור ${person.name}`, 'info');

        // Close history panel
        setShowHistory(false);
        setHistoryFilters(undefined);
    };

    const handleViewHistory = (personId: string, date: string) => {
        console.log('[AttendanceManager] handleViewHistory:', { personId, date });
        setHistoryFilters({
            personId,
            date: date, // Single day filter is more precise and avoids logs with null dates
            limit: 50,
            entityTypes: ['attendance', 'people', 'person', 'daily_presence', 'daily_presence_v2']
        });
        setShowHistory(true);
        showToast('טוען היסטוריית שינויים...', 'info');
    };

    const handleOpenExportModal = () => {
        if (isViewer) {
            showToast('אין לך הרשאה לייצא נתונים', 'error');
            return;
        }

        // Default dates based on view mode
        if (viewMode === 'day_detail') {
            const dateStr = selectedDate.toLocaleDateString('en-CA');
            setExportStartDate(dateStr);
            setExportEndDate(dateStr);
        } else {
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);

            setExportStartDate(firstDay.toLocaleDateString('en-CA'));
            setExportEndDate(lastDay.toLocaleDateString('en-CA'));
        }
        setShowExportModal(true);
    };

    const handleExport = async () => {
        if (isViewer) return; // Should be blocked by UI but double check

        // Ensure dates are valid
        if (!exportStartDate || !exportEndDate) {
            showToast('נא לבחור טווח תאריכים תקין', 'error');
            return;
        }

        const start = new Date(exportStartDate);
        const end = new Date(exportEndDate);

        if (start > end) {
            showToast('תאריך התחלה לא יכול להיות אחרי תאריך סיום', 'error');
            return;
        }

        try {
            const fileName = `attendance_report_${exportStartDate}_to_${exportEndDate}.xlsx`;

            await generateAttendanceExcel({
                people: activePeople,
                teams: visibleTeams,
                absences,
                rotations: teamRotations,
                blockages: hourlyBlockages,
                startDate: start,
                endDate: end,
                fileName,
                organizationSettings: settings
            });
            showToast('הקובץ נוצר בהצלחה', 'success');
            setShowExportModal(false);
        } catch (error) {
            console.error('Export failed', error);
            showToast('שגיאה ביצירת הקובץ', 'error');
        }
    };


    const handleDownload = async () => {
        // Implementation of handleDownload if needed, or just remove if not used elsewhere
    };


    return (
        <div ref={containerRef} className="h-[calc(100dvh-70px)] md:h-[calc(100vh-90px)] relative" dir="rtl">
            {/* Main Content Portal - Full Width */}
            <div className="w-full h-full bg-white rounded-[2.5rem] shadow-xl md:shadow-portal border border-slate-100 overflow-hidden relative z-10 flex flex-col">
                {/* --- GREEN HEADER (Mobile & Desktop Unified or Mobile Only?) --- */}

                {/* --- UNIFIED MOBILE CONTAINER --- */}
                <div className={`
                flex-1 flex flex-col md:hidden
                relative isolate z-10 overflow-hidden
            `}>
                    {/* Mobile Header - Premium Design */}
                    <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-3 py-1.5 flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                            {/* Compact Segmented Control */}
                            <div className="flex-1 flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50">
                                <button
                                    onClick={() => setViewMode('calendar')}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all duration-300 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                                >
                                    <CalendarDays size={16} weight="bold" />
                                    <span className="text-sm">חודשי</span>
                                </button>
                                <button
                                    onClick={() => { setViewMode('day_detail'); setSelectedDate(new Date()); }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg transition-all duration-300 ${viewMode === 'day_detail' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                                >
                                    <ListChecks size={16} weight="bold" />
                                    <span className="text-sm">יומי</span>
                                </button>
                            </div>

                            {/* Mobile More Actions Menu */}
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className="w-10 h-10 flex items-center justify-center bg-white text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all shrink-0 shadow-sm"
                            >
                                <DotsThreeVertical size={20} weight="bold" />
                            </button>

                            {/* Mobile Actions Modal */}
                            <GenericModal
                                isOpen={isMobileMenuOpen}
                                onClose={() => setIsMobileMenuOpen(false)}
                                title="פעולות נוספות"
                                size="sm"
                            >
                                <div className="space-y-2 py-2">
                                    {!isViewer && (
                                        <ActionListItem
                                            icon={Sparkles}
                                            label="מחולל סבבים"
                                            description="יצירת סבבים אוטומטית"
                                            color="bg-blue-50 text-blue-600"
                                            onClick={() => { setShowRotaWizard(true); setIsMobileMenuOpen(false); }}
                                        />
                                    )}
                                    {!isViewer && (
                                        <ActionListItem
                                            label="ייבוא מאקסל (V2)"
                                            icon={FileXls}
                                            color="bg-blue-50 text-blue-600"
                                            onClick={() => setShowV2Import(true)}
                                            description="טעינת נתוני נוכחות לקובץ V2"
                                        />
                                    )}
                                    {!isViewer && (
                                        <ActionListItem
                                            icon={FileXls}
                                            label="ייצוא לאקסל"
                                            description="הורדת נתוני נוכחות"
                                            color="bg-green-50 text-green-600"
                                            onClick={() => { handleOpenExportModal(); setIsMobileMenuOpen(false); }}
                                        />
                                    )}

                                    {!isViewer && (
                                        <ActionListItem
                                            icon={ClockCounterClockwise}
                                            label="היסטוריית שינויים"
                                            description="צפייה בלוג פעולות"
                                            color={showHistory ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}
                                            onClick={() => { setShowHistory(!showHistory); setIsMobileMenuOpen(false); }}
                                        />
                                    )}
                                </div>
                            </GenericModal>
                        </div>

                        {/* Date Navigator - Optimized for Mobile */}
                        <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-0.5">
                            <DateNavigator
                                date={viewMode === 'calendar' ? viewDate : selectedDate}
                                onDateChange={(d) => {
                                    if (viewMode === 'calendar') setViewDate(d);
                                    else setSelectedDate(d);
                                }}
                                mode={viewMode === 'calendar' ? 'month' : 'day'}
                                className="w-full justify-between border-none bg-transparent h-8.5"
                                showTodayButton={true}
                                maxDate={isViewer ? (() => {
                                    const days = settings?.viewer_schedule_days || 7;
                                    const d = new Date();
                                    d.setHours(0, 0, 0, 0);
                                    d.setDate(d.getDate() + (days - 1));
                                    return d;
                                })() : undefined}
                            />
                        </div>
                    </div>

                    {/* Content Render (Mobile) */}
                    <div className="flex-1 overflow-hidden flex flex-col">
                        {viewMode === 'calendar' ? (
                            <div className="h-full flex flex-col">
                                <GlobalTeamCalendar
                                    teams={visibleTeams}
                                    people={people}
                                    teamRotations={teamRotations}
                                    absences={absences}
                                    hourlyBlockages={hourlyBlockages}
                                    onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                                    onDateClick={handleDateClick}
                                    currentDate={viewDate}
                                    onDateChange={setViewDate}
                                    viewType={calendarViewType}
                                    onViewTypeChange={setCalendarViewType}
                                    organizationName={(settings as any)?.organization_name}
                                    engineVersion={settings?.engine_version}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col">
                                {/* Search Bar - Premium Mobile Design */}
                                <div className="px-3 py-2.5 bg-white/50 backdrop-blur-sm border-b border-slate-100">
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                            <Search size={16} weight="bold" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="חיפוש לוחם..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="block w-full h-10 pr-10 pl-4 bg-slate-100/50 border-none rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-sm"
                                        />
                                    </div>
                                </div>
                                <AttendanceTable
                                    teams={visibleTeams}
                                    people={filteredPeople}
                                    teamRotations={teamRotations}
                                    absences={absences}
                                    hourlyBlockages={hourlyBlockages}
                                    currentDate={selectedDate}
                                    onDateChange={setSelectedDate}
                                    onSelectPerson={(p) => {
                                        if (isBulkMode) handleToggleSelectPerson(p.id);
                                        else setSelectedPersonForCalendar(p);
                                    }}
                                    onUpdateAvailability={handleUpdateAvailability}
                                    onViewHistory={handleViewHistory}
                                    className="h-full"
                                    isViewer={isViewer}
                                    isAttendanceReportingEnabled={settings?.attendance_reporting_enabled ?? true}
                                    isMultiSelectMode={isMultiSelectMode}
                                    setIsMultiSelectMode={setIsMultiSelectMode}
                                    defaultEngineVersion={settings?.engine_version}
                                    companies={companies}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* --- DESKTOP VIEW CONTAINER --- */}
                <div className="hidden md:flex flex-col flex-1 overflow-hidden">
                    <ActionBar
                        searchTerm={viewMode !== 'calendar' ? searchTerm : ''}
                        onSearchChange={setSearchTerm}
                        isSearchHidden={viewMode === 'calendar'}
                        isSearchExpanded={isSearchExpanded}
                        onSearchExpandedChange={setIsSearchExpanded}
                        onExport={!isViewer ? async () => handleOpenExportModal() : undefined}
                        variant="unified"
                        className="p-3"
                        isMultiSelectMode={isMultiSelectMode}
                        onMultiSelectToggle={viewMode === 'table' ? () => setIsMultiSelectMode(!isMultiSelectMode) : undefined}
                        leftActions={
                            <div className="flex items-center gap-4">
                                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                    <Calendar className="text-blue-600" size={24} weight="bold" />
                                    <span className={isSearchExpanded ? 'hidden lg:inline' : 'inline'}>יומן נוכחות</span>
                                    <PageInfo
                                        title="יומן נוכחות"
                                        description={
                                            <>
                                                <p className="mb-2">כאן ניתן לראות ולנהל את זמינות הלוחמים.</p>
                                                <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                    <li><b>תצוגת לוח שנה:</b> מבט חודשי גלובלי על הסבבים והנוכחות.</li>
                                                    <li><b>תצוגת רשימה (טבלה):</b> ניהול מפורט של זמינות.
                                                        <ul className="list-inside list-disc mr-4 text-slate-600 mt-1 space-y-0.5">
                                                            <li>לחיצה רגילה לעריכת יום בודד.</li>
                                                            <li><b>Ctrl + לחיצה:</b> לבחירת מספר ימים בודדים.</li>
                                                            <li><b>Shift + לחיצה:</b> לבחירת טווח תאריכים.</li>
                                                        </ul>
                                                    </li>
                                                    <li><b>רשימה יומית:</b> פירוט מלא של הנוכחים והנעדרים ליום ספציפי.</li>
                                                    <li><b>סבבים:</b> הגדרת סבבי יציאות (11/3, חצאים וכו') לניהול מהיר.</li>
                                                </ul>
                                                <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                                    הנתונים כאן משפיעים ישירות על יכולת השיבוץ של המערכת.
                                                </p>
                                            </>
                                        }
                                    />
                                </h2>
                            </div>
                        }
                        centerActions={
                            <div className="bg-slate-100/80 p-0.5 rounded-xl flex items-center gap-0.5">
                                {[
                                    { id: 'calendar', label: 'לוח שנה', icon: CalendarDays },
                                    { id: 'table', label: 'טבלה חודשית', icon: ListChecks },
                                    { id: 'day_detail', label: 'רשימה יומית', icon: Users }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setViewMode(tab.id as any)}
                                        className={`px-3 lg:px-5 py-2 rounded-xl text-xs font-black transition-all duration-300 flex items-center gap-2 ${viewMode === tab.id
                                            ? 'bg-white text-blue-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700'
                                            }`}
                                        title={tab.label}
                                    >
                                        <tab.icon size={16} weight="bold" />
                                        <span className={(isSearchExpanded || searchTerm) ? 'hidden' : viewMode === tab.id ? 'inline' : 'hidden xl:inline'}>{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                        }
                        rightActions={
                            <>
                                <DateNavigator
                                    date={(viewMode === 'calendar' || viewMode === 'table') ? viewDate : selectedDate}
                                    onDateChange={(d) => {
                                        if (viewMode === 'calendar' || viewMode === 'table') setViewDate(d);
                                        else setSelectedDate(d);
                                    }}
                                    mode={(viewMode === 'calendar' || viewMode === 'table') ? 'month' : 'day'}
                                    maxDate={isViewer ? (() => {
                                        const days = settings?.viewer_schedule_days || 7;
                                        const d = new Date();
                                        d.setHours(0, 0, 0, 0);
                                        d.setDate(d.getDate() + (days - 1));
                                        return d;
                                    })() : undefined}
                                    className="h-9 border-none bg-transparent shadow-none"
                                />

                                <div className="w-px h-5 bg-slate-200 mx-1 hidden xl:block" />

                                <div className="flex items-center gap-1">
                                    {viewMode === 'table' && (
                                        <>
                                            {!isViewer && (
                                                <>
                                                    <button
                                                        onClick={() => setShowStatistics(!showStatistics)}
                                                        className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${showStatistics ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}
                                                        title={showStatistics ? 'הסתר סטטיסטיקה' : 'הצג סטטיסטיקה'}
                                                    >
                                                        <ChartBar size={20} weight="bold" />
                                                    </button>
                                                    <button
                                                        onClick={() => setShowRequiredDetails(!showRequiredDetails)}
                                                        className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${showRequiredDetails ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}
                                                        title={showRequiredDetails ? 'הסתר שורת תקן' : 'הצג שורת תקן'}
                                                    >
                                                        <AlertCircle size={18} weight="bold" />
                                                    </button>
                                                </>
                                            )}
                                            {!isViewer && (
                                                <button
                                                    onClick={() => setShowHistory(!showHistory)}
                                                    className={`h-9 w-9 flex items-center justify-center rounded-xl transition-all ${showHistory ? 'bg-idf-yellow text-slate-900 shadow-idf' : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'}`}
                                                    title="היסטוריית שינויים"
                                                >
                                                    <ClockCounterClockwise size={20} weight="bold" />
                                                </button>
                                            )}
                                        </>
                                    )}

                                    {(profile?.permissions?.canManageRotaWizard || profile?.is_super_admin) && (
                                        <button
                                            onClick={() => setShowRotaWizard(true)}
                                            data-testid="open-rota-wizard-btn"
                                            className="h-9 w-9 flex items-center justify-center text-slate-500 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all"
                                            title="מחולל סבבים"
                                        >
                                            <Sparkles size={18} weight="bold" className="group-hover:text-blue-600 transition-colors" />
                                        </button>
                                    )}

                                    {!isViewer && (
                                        <button
                                            onClick={() => setShowV2Import(true)}
                                            className="h-9 w-9 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                            title="ייבוא מאקסל (V2)"
                                        >
                                            <FileXls size={18} weight="bold" />
                                        </button>
                                    )}
                                </div>
                            </>
                        }
                    />

                    <div className="flex-1 overflow-hidden flex flex-col isolate z-10">
                        {/* Content Render (Desktop) */}
                        {viewMode === 'calendar' ? (
                            <div className="h-full flex flex-col bg-white overflow-hidden">
                                <GlobalTeamCalendar
                                    teams={visibleTeams}
                                    people={people}
                                    teamRotations={teamRotations}
                                    absences={absences}
                                    hourlyBlockages={hourlyBlockages}
                                    onManageTeam={(teamId) => setShowRotationSettings(teamId)}
                                    onDateClick={handleDateClick}
                                    currentDate={viewDate}
                                    onDateChange={setViewDate}
                                    viewType={calendarViewType}
                                    onViewTypeChange={setCalendarViewType}
                                    organizationName={(settings as any)?.organization_name}
                                />
                            </div>
                        ) : (
                            <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
                                <AttendanceTable
                                    teams={visibleTeams}
                                    people={filteredPeople}
                                    teamRotations={teamRotations}
                                    absences={absences}
                                    hourlyBlockages={hourlyBlockages}
                                    currentDate={viewMode === 'table' ? viewDate : selectedDate}
                                    onDateChange={viewMode === 'table' ? setViewDate : setSelectedDate}
                                    viewMode={viewMode === 'day_detail' ? 'daily' : 'monthly'}
                                    onSelectPerson={(p) => {
                                        if (isBulkMode) handleToggleSelectPerson(p.id);
                                        else setSelectedPersonForCalendar(p);
                                    }}
                                    onUpdateAvailability={isViewer ? undefined : handleUpdateAvailability}
                                    onViewHistory={handleViewHistory}
                                    className="h-full"
                                    isViewer={isViewer}
                                    showRequiredDetails={!isViewer && showRequiredDetails}
                                    showStatistics={!isViewer && showStatistics}
                                    onShowPersonStats={(p) => setStatsEntity({ person: p })}
                                    onShowTeamStats={(t) => setStatsEntity({ team: t })}
                                    tasks={tasks}
                                    externalEditingCell={externalEditingCell}
                                    isMultiSelectMode={isMultiSelectMode}
                                    setIsMultiSelectMode={setIsMultiSelectMode}
                                    onClearExternalEdit={() => setExternalEditingCell(null)}
                                    isAttendanceReportingEnabled={settings?.attendance_reporting_enabled ?? true}
                                    defaultEngineVersion={organization?.engine_version}
                                    companies={companies}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Modals & Overlays (Outside sheet flow or global) */}
                {
                    showRotationSettings && (() => {
                        const team = visibleTeams.find(t => t.id === showRotationSettings);
                        if (!team) return null;
                        return (
                            <RotationEditor
                                team={team}
                                existing={teamRotations.find(r => r.team_id === team.id)}
                                onClose={() => setShowRotationSettings(null)}
                                onAddRotation={onAddRotation}
                                onUpdateRotation={onUpdateRotation}
                                onDeleteRotation={onDeleteRotation}
                            />
                        );
                    })()
                }

                {
                    selectedPersonForCalendar && !isBulkMode && (
                        <PersonalAttendanceCalendar
                            person={selectedPersonForCalendar}
                            teamRotations={teamRotations}
                            absences={absences}
                            hourlyBlockages={hourlyBlockages}
                            onClose={() => setSelectedPersonForCalendar(null)}
                            onUpdatePerson={onUpdatePerson}
                            isViewer={isViewer}
                            people={activePeople}
                            onShowStats={(p) => setStatsEntity({ person: p })}
                            onViewHistory={handleViewHistory}
                            isAttendanceReportingEnabled={settings?.attendance_reporting_enabled ?? true}
                        />
                    )
                }

                {
                    editingPersonalRotation && !isBulkMode && (
                        <PersonalRotationEditor
                            person={editingPersonalRotation}
                            isOpen={true}
                            onClose={() => setEditingPersonalRotation(null)}
                            onSave={handleUpdatePersonalRotation}
                        />
                    )
                }

                <BulkAttendanceModal
                    isOpen={showBulkModal}
                    onClose={() => setShowBulkModal(false)}
                    onApply={handleBulkApply}
                    selectedCount={selectedPersonIds.size}
                />

                {
                    showRotaWizard && (
                        <RotaWizardModal
                            isOpen={showRotaWizard}
                            onClose={() => setShowRotaWizard(false)}
                            people={activePeople}
                            teams={visibleTeams}
                            roles={roles}
                            tasks={tasks}
                            constraints={constraints}
                            absences={absences}
                            settings={settings}
                            teamRotations={teamRotations}
                            hourlyBlockages={hourlyBlockages}
                            onSaveRoster={(roster: DailyPresence[]) => { }}
                        />
                    )
                }

                {
                    statsEntity && (
                        <AttendanceStatsModal
                            person={statsEntity.person}
                            team={statsEntity.team}
                            people={activePeople}
                            teams={visibleTeams}
                            teamRotations={teamRotations}
                            absences={absences}
                            hourlyBlockages={hourlyBlockages}
                            dates={(() => {
                                const year = viewDate.getFullYear();
                                const month = viewDate.getMonth();
                                const daysInMonth = new Date(year, month + 1, 0).getDate();
                                const dates = [];
                                for (let d = 1; d <= daysInMonth; d++) {
                                    dates.push(new Date(year, month, d));
                                }
                                return dates;
                            })()}
                            onClose={() => setStatsEntity(null)}
                        />
                    )
                }

                {/* Confirmation Modal for Availability Conflicts */}
                <ConfirmationModal
                    isOpen={confirmationState.isOpen}
                    title={confirmationState.title}
                    message={confirmationState.message}
                    onConfirm={confirmationState.onConfirm}
                    onCancel={() => setConfirmationState(prev => ({ ...prev, isOpen: false }))}
                    confirmText={confirmationState.confirmText}
                    cancelText="ביטול"
                    type={confirmationState.type}
                />

                {/* Export Date Range Modal */}
                <GenericModal
                    isOpen={showExportModal}
                    onClose={() => setShowExportModal(false)}
                    title="ייצוא נתוני נוכחות"
                    size="sm"
                    footer={
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="secondary"
                                onClick={() => setShowExportModal(false)}
                            >
                                ביטול
                            </Button>
                            <ExportButton
                                onExport={handleExport}
                                disabled={!exportStartDate || !exportEndDate}
                                label="ייצוא לאקסל"
                                variant="premium"
                                className="h-10 px-6"
                            />
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <p className="text-slate-600">
                            אנא בחר את טווח התאריכים עבורו תרצה להפיק את הדוח.
                        </p>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700">מתאריך</label>
                                <input
                                    type="date"
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                    value={exportStartDate}
                                    onChange={(e) => setExportStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-slate-700">עד תאריך</label>
                                <input
                                    type="date"
                                    className="w-full h-10 px-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                                    value={exportEndDate}
                                    onChange={(e) => setExportEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </GenericModal>
            </div>

            {/* History Sidebar - Floating Overlay */}
            {showHistory && (
                <ActivityFeed
                    onClose={() => {
                        setShowHistory(false);
                        setHistoryFilters(undefined);
                    }}
                    organizationId={profile.organization_id}
                    onLogClick={handleLogClick}
                    people={activePeople}
                    tasks={tasks}
                    teams={visibleTeams}
                    entityTypes={historyEntityTypes}
                    initialFilters={historyFilters}
                />
            )}
            {showV2Import && (
                <ExcelV2ImportModal
                    isOpen={showV2Import}
                    onClose={() => setShowV2Import(false)}
                    people={people}
                />
            )}
            {showExcelImport && (
                <ImportAttendanceModal
                    isOpen={showExcelImport}
                    onClose={() => setShowExcelImport(false)}
                    people={people}
                    onUpdatePeople={onUpdatePeople || (() => { })}
                />
            )}
        </div>
    );
};
