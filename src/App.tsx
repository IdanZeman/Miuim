import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Lazy Load Pages
const ScheduleBoard = lazyWithRetry(() => import('./features/scheduling/ScheduleBoard').then(module => ({ default: module.ScheduleBoard })));
const PersonnelManager = lazyWithRetry(() => import('./features/personnel/PersonnelManager').then(module => ({ default: module.PersonnelManager })));
const AttendanceManager = lazyWithRetry(() => import('./features/scheduling/AttendanceManager').then(module => ({ default: module.AttendanceManager })));
const TaskManager = lazyWithRetry(() => import('./features/tasks/TaskManager').then(module => ({ default: module.TaskManager })));
const StatsDashboard = lazyWithRetry(() => import('./features/stats/StatsDashboard').then(module => ({ default: module.StatsDashboard })));
const OrganizationSettingsComponent = lazyWithRetry(() => import('./features/admin/OrganizationSettings').then(module => ({ default: module.OrganizationSettings })));
const BattalionDashboard = lazyWithRetry(() => import('./features/battalion/BattalionDashboard').then(module => ({ default: module.BattalionDashboard })));
const BattalionPersonnelTable = lazyWithRetry(() => import('./features/battalion/BattalionPersonnelTable').then(module => ({ default: module.BattalionPersonnelTable })));
const BattalionSettings = lazyWithRetry(() => import('./features/battalion/BattalionSettings').then(module => ({ default: module.BattalionSettings })));
const BattalionAttendanceManager = lazyWithRetry(() => import('./features/battalion/BattalionAttendanceManager').then(module => ({ default: module.BattalionAttendanceManager })));

const AdminLogsViewer = lazyWithRetry(() => import('./features/admin/AdminLogsViewer').then(module => ({ default: module.AdminLogsViewer })));
const OrganizationLogsViewer = lazyWithRetry(() => import('./features/admin/OrganizationLogsViewer').then(module => ({ default: module.OrganizationLogsViewer })));
const Lottery = lazyWithRetry(() => import('./features/lottery/Lottery').then(module => ({ default: module.Lottery })));
const ConstraintsManager = lazyWithRetry(() => import('./features/scheduling/ConstraintsManager').then(module => ({ default: module.ConstraintsManager })));
const AbsenceManager = lazyWithRetry(() => import('./features/scheduling/AbsenceManager').then(module => ({ default: module.AbsenceManager })));
const FAQPage = lazyWithRetry(() => import('./features/core/FAQPage').then(module => ({ default: module.FAQPage })));
const EquipmentManager = lazyWithRetry(() => import('./features/equipment/EquipmentManager'));
const ContactPage = lazyWithRetry(() => import('./features/core/ContactPage').then(module => ({ default: module.ContactPage })));
const SystemManagementPage = lazyWithRetry(() => import('./pages/SystemManagementPage').then(module => ({ default: module.SystemManagementPage })));
const AccessibilityStatement = lazyWithRetry(() => import('./features/core/AccessibilityStatement').then(module => ({ default: module.AccessibilityStatement })));
const GateDashboard = lazyWithRetry(() => import('./components/GateControl/GateDashboard').then(module => ({ default: module.GateDashboard })));



import { HomePage } from './features/core/HomePage';
import { LandingPage } from './features/core/LandingPage';
import { Onboarding } from './features/auth/Onboarding';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { useToast } from './contexts/ToastContext';
import { logger } from './services/loggingService';
import { Person, Shift, TaskTemplate, Role, Team, SchedulingConstraint, Absence, Equipment, ViewMode, Organization } from './types';
import { WarClock } from './features/scheduling/WarClock';
import { supabase } from './services/supabaseClient';
import {
    mapShiftFromDB, mapShiftToDB,
    mapPersonFromDB, mapPersonToDB,
    mapTeamFromDB, mapTeamToDB,
    mapRoleFromDB, mapRoleToDB,
    mapTaskFromDB, mapTaskToDB,
    mapConstraintFromDB, mapConstraintToDB,
    mapRotationFromDB, mapRotationToDB,
    mapAbsenceFromDB, mapAbsenceToDB, // Added imports
    mapEquipmentFromDB, mapEquipmentToDB
} from './services/supabaseClient';
import { solveSchedule, SchedulingSuggestion, SchedulingResult } from './services/scheduler';
import { fetchUserHistory, calculateHistoricalLoad } from './services/historyService';
import { FloatingActionButton } from './components/ui/FloatingActionButton';
import { MagicWandIcon as Wand2, SparkleIcon as Sparkles, ShieldIcon, XIcon as X, CalendarBlankIcon as Calendar, WarningCircleIcon as AlertCircle, CircleNotchIcon as Loader2, UsersIcon as Users } from '@phosphor-icons/react';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsForTask } from './utils/shiftUtils';
import JoinPage from './features/auth/JoinPage';
import { initGA, trackPageView } from './services/analytics';
import { usePageTracking } from './hooks/usePageTracking';
import { useQueryClient } from '@tanstack/react-query';
import { useOrganizationData } from './hooks/useOrganizationData';
import { DashboardSkeleton } from './components/ui/DashboardSkeleton'; // Import Skeleton
import { ClaimProfile } from './features/auth/ClaimProfile';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NewLandingPage } from './features/landing/NewLandingPage';
import { ContactUsPage } from './features/landing/ContactUsPage';
import { GlobalClickTracker } from './features/core/GlobalClickTracker';
import { AutoScheduleModal } from './features/scheduling/AutoScheduleModal';
import { EmptyStateGuide } from './components/ui/EmptyStateGuide';
import { ToastProvider } from './contexts/ToastContext';
import { BackgroundPrefetcher } from './components/core/BackgroundPrefetcher';



// Disable console logs in production (non-localhost)
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    const noop = () => { };
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    console.error = noop;
    console.debug = noop;
    console.table = noop;
}

// --- Main App Content (Authenticated) ---
// Track view changes
// Custom hook to manage the massive state of the main application
const useMainAppState = () => {
    const { organization, user, profile, checkAccess } = useAuth();
    const hasBattalion = !!organization?.battalion_id;
    const { showToast } = useToast();
    const [view, setView] = useState<ViewMode>(() => {
        // Always start at home, but check for import wizard flag
        if (typeof window !== 'undefined') {
            const shouldOpenImport = localStorage.getItem('open_import_wizard');
            if (shouldOpenImport) {
                return 'personnel';
            }
        }
        return 'home';
    });

    const [activeOrgId, setActiveOrgId] = useState<string | null>(() => {
        // Default to user's assigned organization
        if (profile?.organization_id) return profile.organization_id;

        // For battalion commanders without a specific organization, 
        // they will select one from the battalion's companies (handled later)
        return null;
    });

    // Handle initial activeOrgId setting when profile loads
    useEffect(() => {
        if (profile?.organization_id && !activeOrgId) {
            setActiveOrgId(profile.organization_id);
        }
    }, [profile, activeOrgId]);


    // Persistence & Scroll to Top Effect
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Only persist view changes, don't restore on mount
            localStorage.setItem('miuim_active_view', view);
            window.scrollTo(0, 0);

            // Log navigation for internal audit
            logger.logView(view);
        }
    }, [view]);

    useEffect(() => {
        logger.info('APP_LAUNCH', 'Main Application Mounted');
    }, []);
    const [personnelTab, setPersonnelTab] = useState<'people' | 'teams' | 'roles'>('people');
    // const [isLoading, setIsLoading] = useState(true); // REMOVED: Using React Query isOrgLoading instead
    const [isScheduling, setIsScheduling] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleStartDate, setScheduleStartDate] = useState<Date>(new Date());
    const [scheduleEndDate, setScheduleEndDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 7)));
    const [selectedDateKey, setSelectedDateKey] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [scheduleMode, setScheduleMode] = useState<'single' | 'range'>('single');
    const [autoOpenRotaWizard, setAutoOpenRotaWizard] = useState(false);
    const [battalionCompanies, setBattalionCompanies] = useState<Organization[]>([]);

    // Fetch battalion companies if user is in battalion
    useEffect(() => {
        const bid = organization?.battalion_id;
        if (bid) {
            import('./services/battalionService').then(m => m.fetchBattalionCompanies(bid))
                .then(setBattalionCompanies)
                .catch(err => console.error('Failed to fetch battalion companies', err));
        }
    }, [organization?.battalion_id]);

    // Auto-select first company ONLY if user has no assigned organization (e.g., battalion commander)
    // Regular users should stay in their assigned organization
    useEffect(() => {
        // Only auto-select if:
        // 1. No active org is set
        // 2. User has no assigned organization (profile.organization_id is null)
        // 3. Battalion companies are available
        if (!activeOrgId && !profile?.organization_id && battalionCompanies.length > 0) {
            setActiveOrgId(battalionCompanies[0].id);
        }
    }, [activeOrgId, profile?.organization_id, battalionCompanies]);
    const [schedulingSuggestions, setSchedulingSuggestions] = useState<SchedulingSuggestion[]>([]);
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);

    const {
        people,
        allPeople,
        shifts,
        taskTemplates,
        roles,
        teams,
        settings,
        constraints,
        teamRotations,
        absences,
        missionReports,
        equipment,
        equipmentDailyChecks,
        hourlyBlockages,
        isLoading: isOrgLoading,
        error: orgError,
        refetch: refetchOrgData
    } = useOrganizationData(activeOrgId || organization?.id, profile?.permissions, user?.id);

    const orgIdForActions = activeOrgId || organization?.id;

    // Map the new hook data to the old 'state' structure
    const state = {
        people: people || [],
        allPeople: allPeople || [],
        shifts: shifts || [],
        taskTemplates: taskTemplates || [],
        roles: roles || [],
        teams: teams || [],
        constraints: constraints || [],
        teamRotations: teamRotations || [],
        absences: absences || [],
        missionReports: missionReports || [],
        equipment: equipment || [],
        equipmentDailyChecks: equipmentDailyChecks || [],
        settings: settings || null,
        hourlyBlockages: hourlyBlockages || []
    };

    // Combined Loading Logic
    // If we are auth-loading OR org-data-loading, show skeleton/loader
    const isGlobalLoading = isOrgLoading;

    // Error Handling
    useEffect(() => {
        if (orgError) {
            console.error("Error fetching organization data:", orgError);
            showToast("שגיאה בטעינת הנתונים - נסה לרענן", 'error');
        }
    }, [orgError]);

    // DB Mutation Handlers (Now just wrapper around Supabase + Refetch/Invalidate)
    // For V1 Performance: We simply invalidate the query to refetch fresh data
    const queryClient = useQueryClient();
    const refreshData = () => {
        return queryClient.invalidateQueries({ queryKey: ['organizationData', activeOrgId] });
    };

    const myPerson = React.useMemo(() => {
        if (!user || state.people.length === 0) return null;
        return state.people.find(p => p.userId === user.id) || null;
    }, [user, state.people]);

    const isLinkedToPerson = !!myPerson || !user || state.people.length === 0;

    useEffect(() => {
        logger.setContext(
            activeOrgId || organization?.id || null,
            user?.id || null,
            profile?.email || user?.email || null,
            profile?.full_name || null
        );
    }, [activeOrgId, organization, user, profile]);



    const processPresence = (people: Person[], presenceData: any[]) => {
        if (!presenceData || presenceData.length === 0) return people;

        const presenceByPerson: Record<string, any[]> = {};
        presenceData.forEach((pd: any) => {
            if (!presenceByPerson[pd.person_id]) presenceByPerson[pd.person_id] = [];
            presenceByPerson[pd.person_id].push(pd);
        });

        return people.map(person => {
            const timeline = presenceByPerson[person.id];
            if (!timeline) return person;

            // Sort chronologically
            timeline.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const newAvailability = { ...person.dailyAvailability };

            timeline.forEach((pd, index) => {
                const dateKey = pd.date;
                const isBase = pd.status === 'base';
                let detailedStatus = pd.status;

                if (isBase) {
                    const prevRec = timeline[index - 1];
                    const nextRec = timeline[index + 1];
                    const d = new Date(pd.date);
                    const prevD = prevRec ? new Date(prevRec.date) : null;
                    const nextD = nextRec ? new Date(nextRec.date) : null;

                    const isPrevContiguous = prevD && (d.getTime() - prevD.getTime() === 86400000);
                    const isNextContiguous = nextD && (nextD.getTime() - d.getTime() === 86400000);

                    // Refined check: A 'home' record that ends before midnight means an arrival happened yesterday
                    const prevWasPartialReturn = prevRec?.status === 'home' && prevRec.end_time && prevRec.end_time !== '23:59' && prevRec.end_time !== '00:00';
                    const nextWasPartialDeparture = nextRec?.status === 'home' && nextRec.start_time && nextRec.start_time !== '00:00';

                    const prevIsBase = isPrevContiguous && (prevRec.status === 'base' || prevWasPartialReturn);
                    const nextIsBase = isNextContiguous && (nextRec.status === 'base' || nextWasPartialDeparture);

                    if (!prevIsBase && nextIsBase) detailedStatus = 'arrival';
                    else if (prevIsBase && !nextIsBase) detailedStatus = 'departure';
                    else if (!prevIsBase && !nextIsBase) detailedStatus = 'arrival'; // Single day default
                    else detailedStatus = 'full';
                }

                let startHour = '00:00';
                let endHour = '00:00';

                if (isBase) {
                    const dbStart = pd.start_time ? pd.start_time.slice(0, 5) : null;
                    const dbEnd = pd.end_time ? pd.end_time.slice(0, 5) : null;

                    if (dbStart && dbEnd && (dbStart !== '00:00' || dbEnd !== '23:59' || dbEnd !== '00:00')) {
                        startHour = dbStart;
                        endHour = dbEnd;
                    } else {
                        if (detailedStatus === 'arrival') { startHour = '10:00'; endHour = '23:59'; }
                        else if (detailedStatus === 'departure') { startHour = '00:00'; endHour = '14:00'; }
                        else { startHour = '00:00'; endHour = '23:59'; }
                    }
                }

                newAvailability[dateKey] = {
                    ...(newAvailability[dateKey] || {}),
                    isAvailable: isBase,
                    startHour,
                    endHour,
                    status: detailedStatus,
                    source: pd.source || 'algorithm'
                };
            });

            return { ...person, dailyAvailability: newAvailability };
        });
    };

    const handleAddPerson = async (p: Person) => {
        if (!orgIdForActions) return;
        const personWithOrg = { ...p, organization_id: orgIdForActions };
        const dbPayload = mapPersonToDB(personWithOrg);

        if (dbPayload.id && (dbPayload.id.startsWith('person-') || dbPayload.id.startsWith('imported-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        try {
            const { error } = await supabase.from('people').insert(dbPayload);
            if (error) throw error;
            await logger.logCreate('person', dbPayload.id, p.name, p);
            refreshData(); // Re-fetch in background
            showToast('החייל נוסף בהצלחה', 'success');
        } catch (e: any) {
            console.error("Add Person Error", e);
            showToast(e.message || 'שגיאה בהוספת חייל', 'error');
            throw e;
        }
    };

    const handleUpdatePerson = async (p: Person) => {
        try {
            const { error } = await supabase.from('people').update(mapPersonToDB(p)).eq('id', p.id);
            if (error) throw error;
            await logger.logUpdate('person', p.id, p.name, state.people.find(person => person.id === p.id), p);
            refreshData(); // Re-fetch in background
        } catch (e: any) {
            console.warn("DB Update Failed:", e);
            throw e;
        }
    };

    const handleUpdatePeople = async (peopleToUpdate: Person[]) => {
        try {
            const mapped = peopleToUpdate.map(mapPersonToDB);
            const { error } = await supabase.from('people').upsert(mapped);
            if (error) throw error;

            await logger.log({
                action: 'UPDATE',
                entityId: 'bulk',
                category: 'data',
                metadata: { details: `Updated ${peopleToUpdate.length} people` }
            });
            refreshData();
        } catch (e) {
            console.warn("Bulk DB Update Failed", e);
            showToast("שגיאה בעדכון קבוצתי", 'error');
        }
    };

    const handleDeletePerson = async (id: string) => {
        try {
            await supabase.from('people').delete().eq('id', id);
            await logger.logDelete('person', id, state.people.find(p => p.id === id)?.name || 'אדם', state.people.find(p => p.id === id));
            refreshData();
        } catch (e) { console.warn("DB Delete Failed", e); }
    };

    const handleDeletePeople = async (ids: string[]) => {
        try {
            await supabase.from('people').delete().in('id', ids);
            refreshData();
        } catch (e) { console.warn("Bulk DB Delete Failed", e); }
    };

    const handleAddTeam = async (t: Team) => {
        if (!orgIdForActions) return;
        const dbPayload = mapTeamToDB({ ...t, organization_id: orgIdForActions });

        if (dbPayload.id && (dbPayload.id.startsWith('team-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        try {
            const { error } = await supabase.from('teams').insert(dbPayload);
            if (error) throw error;
            await logger.logCreate('team', dbPayload.id, t.name, t);
            showToast('הצוות נוסף בהצלחה', 'success');
            await refreshData();
        } catch (e: any) {
            console.error('Add Team Error:', e);
            showToast('שגיאה בהוספת צוות', 'error');
            throw e;
        }
    };

    const handleUpdateTeam = async (t: Team) => {
        try {
            const { error } = await supabase.from('teams').update(mapTeamToDB(t)).eq('id', t.id);
            if (error) throw error;
            await refreshData();
        } catch (e: any) {
            console.error('Update Team Error:', e);
            showToast('שגיאה בעדכון צוות', 'error');
        }
    };

    const handleDeleteTeam = async (id: string) => {
        try {
            const { error } = await supabase.from('teams').delete().eq('id', id);
            if (error) throw error;
            await refreshData();
        } catch (e: any) {
            console.error('Delete Team Error:', e);
            showToast('שגיאה במחיקת צוות', 'error');
        }
    };

    const handleAddRole = async (r: Role) => {
        if (!orgIdForActions) return;
        const dbPayload = mapRoleToDB({ ...r, organization_id: orgIdForActions });

        if (dbPayload.id && (dbPayload.id.startsWith('role-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        try {
            const { error } = await supabase.from('roles').insert(dbPayload);
            if (error) throw error;
            showToast('התפקיד נוסף בהצלחה', 'success');
            await refreshData();
        } catch (e: any) {
            console.error('Add Role Error:', e);
            showToast('שגיאה בהוספת תפקיד', 'error');
            throw e;
        }
    };

    const handleUpdateRole = async (r: Role) => {
        try {
            const { error } = await supabase.from('roles').update(mapRoleToDB(r)).eq('id', r.id);
            if (error) throw error;
            await refreshData();
        } catch (e: any) {
            console.error('Update Role Error:', e);
            showToast('שגיאה בעדכון תפקיד', 'error');
        }
    };

    const handleDeleteRole = async (id: string) => {
        try {
            const { error } = await supabase.from('roles').delete().eq('id', id);
            if (error) throw error;
            await refreshData();
        } catch (e: any) {
            console.error('Delete Role Error:', e);
            showToast('שגיאה במחיקת תפקיד', 'error');
        }
    };

    const handleAddTask = async (t: TaskTemplate) => {
        if (!orgIdForActions) return;
        const dbPayload = mapTaskToDB({ ...t, organization_id: orgIdForActions });

        if (dbPayload.id && (dbPayload.id.startsWith('task-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        try {
            const { error } = await supabase.from('task_templates').insert(dbPayload);
            if (error) throw error;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newShifts = generateShiftsForTask({ ...t, id: dbPayload.id, organization_id: orgIdForActions }, today);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: orgIdForActions }));
            if (shiftsWithOrg.length > 0) {
                const { error: shiftsError } = await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
                if (shiftsError) console.error('Error saving shifts:', shiftsError);
            }
            await logger.logCreate('task', dbPayload.id, t.name, t);
            showToast('המשימה נוצרה בהצלחה', 'success');
            await refreshData();
        } catch (e: any) {
            console.error('Add Task Error:', e);
            showToast('שגיאה בהוספת משימה', 'error');
            throw e;
        }
    };

    const handleUpdateTask = async (t: TaskTemplate) => {
        if (!orgIdForActions) return;
        const oldTask = state.taskTemplates.find(task => task.id === t.id);

        // Check if segments changed
        const oldSegmentsJSON = JSON.stringify(oldTask?.segments || []);
        const newSegmentsJSON = JSON.stringify(t.segments || []);
        const schedulingChanged = oldSegmentsJSON !== newSegmentsJSON ||
            oldTask?.startDate !== t.startDate ||
            oldTask?.endDate !== t.endDate;

        if (schedulingChanged) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const newShifts = generateShiftsForTask(t, startOfWeek);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: orgIdForActions }));
            try {
                await supabase.from('task_templates').update(mapTaskToDB(t)).eq('id', t.id);

                await supabase.from('shifts').delete().eq('task_id', t.id).eq('organization_id', orgIdForActions);
                if (shiftsWithOrg.length > 0) {
                    const { error: shiftsError } = await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
                    if (shiftsError) console.error('Shifts insert error:', shiftsError);
                }

                await logger.logUpdate('task', t.id, t.name, oldTask, t);
                await refreshData();
                showToast('המשימה והמשמרות עודכנו בהצלחה', 'success');

            } catch (e: any) {
                console.error(e);
                showToast(`שגיאה בעדכון משימה: ${e.message}`, 'error');
            }
        } else {
            try {
                const { error } = await supabase.from('task_templates').update(mapTaskToDB(t)).eq('id', t.id);
                if (error) throw error;
                await logger.logUpdate('task', t.id, t.name, oldTask, t);
                await refreshData();
                showToast('המשימה עודכנה בהצלחה', 'success');
            } catch (e: any) {
                console.error('Task Update Error:', e);
                showToast(`שגיאה בעדכון: ${e.message}`, 'error');
            }
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!orgIdForActions) return;
        try {
            const task = state.taskTemplates.find(t => t.id === id);
            await supabase.from('task_templates').delete().eq('id', id).eq('organization_id', orgIdForActions);
            await supabase.from('shifts').delete().eq('task_id', id).eq('organization_id', orgIdForActions);
            await logger.logDelete('task', id, task?.name || 'משימה', task);
            await refreshData();
            showToast('המשימה נמחקה בהצלחה', 'success');
        } catch (e: any) {
            console.error('Delete Task Error:', e);
            showToast('שגיאה במחיקת משימה', 'error');
        }
    };

    const handleAddConstraint = async (c: Omit<SchedulingConstraint, 'id'>, silent = false) => {
        if (!orgIdForActions) return;
        try {
            await import('./services/supabaseClient').then(m => m.addConstraint({ ...c, organization_id: orgIdForActions }));
            refreshData();
            if (!silent) showToast('אילוץ נשמר בהצלחה', 'success');
        } catch (e) {
            console.warn(e);
            showToast('שגיאה בשמירת אילוץ', 'error');
        }
    };

    const handleDeleteConstraint = async (id: string, silent = false) => {
        try {
            await import('./services/supabaseClient').then(m => m.deleteConstraint(id));
            await refreshData();
            if (!silent) showToast('אילוץ נמחק בהצלחה', 'success');
        } catch (e: any) {
            console.error('Delete Constraint Error:', e);
            if (!silent) showToast('שגיאה במחיקת אילוץ', 'error');
        }
    };

    const handleUpdateConstraint = async (c: SchedulingConstraint) => {
        try {
            await supabase.from('scheduling_constraints').update(mapConstraintToDB(c)).eq('id', c.id);
            await refreshData();
        } catch (e) { console.warn(e); }
    };

    const handleAddRotation = async (r: import('./types').TeamRotation) => {
        if (!orgIdForActions) return;
        try {
            const { error } = await supabase.from('team_rotations').insert(mapRotationToDB({ ...r, organization_id: orgIdForActions }));
            if (error) throw error;
            await refreshData();
            showToast('סבב נוסף בהצלחה', 'success');
        } catch (e: any) {
            console.error('Add Rotation Error:', e);
            showToast('שגיאה בהוספת סבב', 'error');
        }
    };

    const handleUpdateRotation = async (r: import('./types').TeamRotation) => {
        try {
            const { error } = await supabase.from('team_rotations').update(mapRotationToDB(r)).eq('id', r.id);
            if (error) throw error;
            await refreshData();
            showToast('הסבב עודכן בהצלחה', 'success');
        } catch (e: any) {
            console.error('Update Rotation Error:', e);
            showToast('שגיאה בעדכון סבב', 'error');
        }
    };

    const handleDeleteRotation = async (id: string) => {
        try {
            const { error } = await supabase.from('team_rotations').delete().eq('id', id);
            if (error) throw error;
            await refreshData();
            showToast('הסבב נמחק בהצלחה', 'success');
        } catch (e: any) {
            console.error('Delete Rotation Error:', e);
            showToast('שגיאה במחיקת סבב', 'error');
        }
    };

    // ABSENCE HANDLERS (Missing DB Implementation in original? Assuming state only or need DB)
    // For now, since state is read-only, we MUST save to DB or it won't work.
    // I will assume absences table exists and was used (it was in fetched data).

    const handleAddAbsence = async (a: Absence) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                absences: [a, ...old.absences]
            };
        });

        try {
            await refreshData();
            await logger.logCreate('absence', a.id, 'בקשת יציאה - סנכרון', a);
        } catch (e: any) {
            logger.error('ERROR', 'Failed to refresh after adding absence', e);
            console.warn(e);
        }
    };

    const handleUpdateAbsence = async (a: Absence) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                absences: old.absences.map((abs: Absence) => abs.id === a.id ? a : abs)
            };
        });

        await refreshData();
    };

    const handleDeleteAbsence = async (id: string) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                absences: old.absences.filter((abs: Absence) => abs.id !== id)
            };
        });

        try {
            await supabase.from('absences').delete().eq('id', id);
            await refreshData();
        } catch (e) {
            console.warn("DB Delete Failed", e);
            showToast("שגיאה במחיקת היעדרות", 'error');
        }
    };

    const handleAddEquipment = async (e: Equipment) => {
        if (!orgIdForActions) return;
        const dbPayload = mapEquipmentToDB({ ...e, organization_id: orgIdForActions });

        // Handle non-UUID temp IDs from frontend
        if (dbPayload.id && !dbPayload.id.includes('-') && dbPayload.id.length < 32) {
            dbPayload.id = uuidv4();
        }

        try {
            const { error } = await supabase.from('equipment').insert(dbPayload);
            if (error) throw error;
            await refreshData();
            showToast('הציוד נוסף בהצלחה', 'success');
        } catch (e: any) {
            console.error('Add Equipment Error:', e);
            showToast('שגיאה בהוספת ציוד', 'error');
        }
    };

    const handleUpdateEquipment = async (e: Equipment) => {
        try {
            const { error } = await supabase.from('equipment').update(mapEquipmentToDB(e)).eq('id', e.id);
            if (error) throw error;
            await refreshData();
            showToast('הציוד עודכן בהצלחה', 'success');
        } catch (e: any) {
            console.error('Update Equipment Error:', e);
            showToast(`שגיאה בעדכון ציוד: ${e.message}`, 'error');
        }
    };

    const handleDeleteEquipment = async (id: string) => {
        try {
            const { error } = await supabase.from('equipment').delete().eq('id', id);
            if (error) throw error;
            await refreshData();
            showToast('הציוד נמחק בהצלחה', 'success');
        } catch (e: any) {
            console.error('Delete Equipment Error:', e);
            showToast('שגיאה במחיקת ציוד', 'error');
        }
    };

    // Equipment Daily Check Handlers
    const handleUpsertEquipmentCheck = async (check: import('./types').EquipmentDailyCheck) => {
        try {
            console.log('[Equipment Check] Upserting check:', check);
            const { data, error } = await supabase
                .from('equipment_daily_checks')
                .upsert(check, { onConflict: 'equipment_id,check_date' });

            if (error) {
                console.error('[Equipment Check] Supabase error:', error);
                throw error;
            }
            console.log('[Equipment Check] Success:', data);
            await refreshData();
        } catch (e: any) {
            console.error('[Equipment Check] Failed:', e);
            showToast(`שגיאה בשמירת בדיקה: ${e.message}`, 'error');
        }
    };

    const handleAssign = async (shiftId: string, personId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const originalAssignments = shift.assignedPersonIds;

        // --- Validation: Check Capacity ---
        const task = state.taskTemplates.find(t => t.id === shift.taskId);

        // Resolve Requirements
        let maxPeople = 1;
        if (shift.requirements) maxPeople = shift.requirements.requiredPeople;
        else if (task && shift.segmentId) {
            const seg = task.segments?.find(s => s.id === shift.segmentId);
            if (seg) maxPeople = seg.requiredPeople;
        } else if (task) {
            // Fallback to first segment or 1
            maxPeople = task.segments?.[0]?.requiredPeople || 1;
        }

        // if (shift.assignedPersonIds.length >= maxPeople) {
        //     showToast('לא ניתן לשבץ: המשמרת מלאה', 'error');
        //     return;
        // }

        // --- Validation: Check Constraints ---
        const userConstraints = state.constraints.filter(c => c.personId === personId);
        const shiftStart = new Date(shift.startTime).getTime();
        const shiftEnd = new Date(shift.endTime).getTime();

        // 1. Never Assign
        if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === shift.taskId)) {
            showToast('לא ניתן לשבץ: קיים אילוץ "לעולם לא לשבץ" למשימה זו', 'error');
            return;
        }

        // 2. Time Block
        const hasTimeBlock = userConstraints.some(c => {
            if (c.type === 'time_block' && c.startTime && c.endTime) {
                const blockStart = new Date(c.startTime).getTime();
                const blockEnd = new Date(c.endTime).getTime();
                return shiftStart < blockEnd && shiftEnd > blockStart;
            }
            return false;
        });

        if (hasTimeBlock) {
            showToast('לא ניתן לשבץ: החייל חסום בשעות אלו', 'error');
            return;
        }

        // 3. Always Assign (Exclusivity)
        const exclusiveConstraint = userConstraints.find(c => c.type === 'always_assign');
        if (exclusiveConstraint && exclusiveConstraint.taskId !== shift.taskId) {
            showToast('לא ניתן לשבץ: החייל מוגדר כבלעדי למשימה אחרת', 'error');
            return;
        }
        // --- End Validation ---

        const newAssignments = [...originalAssignments, personId];

        try {
            const { error } = await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId);
            if (error) throw error;
            await logger.logAssign(shiftId, personId, state.people.find(p => p.id === personId)?.name || 'אדם');
            await refreshData();
        } catch (e: any) {
            logger.error('ASSIGN', 'Failed to assign person to shift', e);
            console.warn("Assignment failed, reverting:", e);
            showToast('שגיאה בשיבוץ, אנא נסה שוב', 'error');
        }
    };

    const handleUnassign = async (shiftId: string, personId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        const newAssignments = shift.assignedPersonIds.filter(pid => pid !== personId);
        try {
            const { error } = await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId);
            if (error) throw error;
            await logger.logUnassign(shiftId, personId, state.people.find(p => p.id === personId)?.name || 'אדם');
            await refreshData();
        } catch (e: any) {
            logger.error('UNASSIGN', 'Failed to unassign person from shift', e);
            console.warn(e);
            showToast('שגיאה בהסרת שיבוץ', 'error');
        }
    };

    const handleUpdateShift = async (updatedShift: Shift) => {
        try {
            await supabase.from('shifts').update(mapShiftToDB(updatedShift)).eq('id', updatedShift.id);
            await refreshData();
        } catch (e) { console.warn(e); }
    };

    const handleDeleteShift = async (shiftId: string) => {
        try {
            await supabase.from('shifts').delete().eq('id', shiftId);
            await refreshData();
        } catch (e) {
            console.warn("Error deleting shift:", e);
        }
    };

    const handleToggleCancelShift = async (shiftId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const newCancelledState = !shift.isCancelled;

        try {
            await supabase.from('shifts').update({ is_cancelled: newCancelledState }).eq('id', shiftId);
            await refreshData();
        } catch (e) {
            console.warn("Error toggling cancel state:", e);
        }
    };

    const handleAddShift = async (task: TaskTemplate, date: Date) => {
        if (!organization) return;
        const start = new Date(date);

        // Default to first segment or 08:00
        let duration = 4;
        if (task.segments && task.segments.length > 0) {
            const seg = task.segments[0];
            const [h, m] = seg.startTime.split(':').map(Number);
            start.setHours(h, m, 0, 0);
            duration = seg.durationHours;
        } else {
            start.setHours(8, 0, 0);
        }

        const end = new Date(start);
        end.setHours(start.getHours() + duration);
        const newShift: Shift = { id: uuidv4(), taskId: task.id, startTime: start.toISOString(), endTime: end.toISOString(), assignedPersonIds: [], isLocked: false, organization_id: orgIdForActions };
        try {
            await supabase.from('shifts').insert(mapShiftToDB(newShift));
            await refreshData();
        } catch (e) { console.warn(e); }
    };

    const handleAutoSchedule = async ({ startDate, endDate, selectedTaskIds, prioritizeTeamOrganic }: { startDate: Date; endDate: Date; selectedTaskIds?: string[]; prioritizeTeamOrganic?: boolean }) => {
        if (!organization) return;
        setIsScheduling(true);
        setSchedulingSuggestions([]); // Clear previous
        const start = new Date(startDate);
        const end = new Date(endDate);

        try {
            // Loop through each day in the range
            const currentDate = new Date(startDate);
            const end = new Date(endDate);

            // Ensure we don't go into infinite loop
            if (currentDate > end) {
                showToast('תאריך התחלה חייב להיות לפני תאריך סיום', 'error');
                setIsScheduling(false);
                return;
            }

            let successCount = 0;
            let failCount = 0;

            while (currentDate <= end) {
                const dateStart = new Date(currentDate);
                dateStart.setHours(0, 0, 0, 0);
                const dateEnd = new Date(currentDate);
                dateEnd.setHours(23, 59, 59, 999);

                try {
                    // 1. Fetch history for load calculation
                    const historyShifts = await fetchUserHistory(orgIdForActions, dateStart, 30);
                    const historyScores = calculateHistoricalLoad(historyShifts, state.taskTemplates, state.people.map(p => p.id));

                    // 2. Fetch future assignments (to avoid conflicts)
                    const futureStart = new Date(dateEnd);
                    const futureEndLimit = new Date(futureStart);
                    futureEndLimit.setHours(futureEndLimit.getHours() + 48);

                    const { data: futureData } = await supabase
                        .from('shifts')
                        .select('*')
                        .gte('start_time', futureStart.toISOString())
                        .lte('start_time', futureEndLimit.toISOString())
                        .eq('organization_id', orgIdForActions);

                    const futureAssignments = (futureData || []).map(mapShiftFromDB);

                    // 3. Filter tasks to schedule (Now handled inside solveSchedule)
                    // We pass the FULL state so the solver knows about all tasks for constraints

                    // 4. Determine shifts to solve (Start Today OR Overlap from Yesterday)
                    const targetDateKey = dateStart.toLocaleDateString('en-CA');
                    const dayStartMs = dateStart.getTime();

                    // A. Shifts starting today (and match task filter)
                    let shiftsToSchedule = state.shifts.filter(s => {
                        const sDate = new Date(s.startTime).toLocaleDateString('en-CA');
                        const matchesTask = !selectedTaskIds || selectedTaskIds.includes(s.taskId);
                        return sDate === targetDateKey && !s.isLocked && matchesTask;
                    });

                    // B. Unassigned shifts starting BEFORE today but ending AFTER today begins (Spillover)
                    // e.g. 23:00 Yesterday -> 07:00 Today.
                    const overlapShifts = state.shifts.filter(s => {
                        const sStart = new Date(s.startTime).getTime();
                        const sEnd = new Date(s.endTime).getTime();
                        const matchesTask = !selectedTaskIds || selectedTaskIds.includes(s.taskId);

                        // Condition: Starts BEFORE today, Ends IN today (or later), Unassigned, Not Locked
                        return matchesTask && !s.isLocked &&
                            sStart < dayStartMs &&
                            sEnd > dayStartMs &&
                            s.assignedPersonIds.length === 0;
                    });

                    if (overlapShifts.length > 0) {
                        console.log(`[AutoSchedule] Found ${overlapShifts.length} unassigned overlap shifts from previous day. Including them.`);
                        shiftsToSchedule = [...shiftsToSchedule, ...overlapShifts];
                    }

                    // 5. Solve schedule for this day
                    const { shifts: solvedShifts, suggestions: daySuggestions } = solveSchedule(state, dateStart, dateEnd, historyScores, futureAssignments, selectedTaskIds, shiftsToSchedule, prioritizeTeamOrganic);

                    if (daySuggestions?.length > 0) {
                        setSchedulingSuggestions(prev => [...prev, ...daySuggestions]);
                    }

                    if (solvedShifts.length > 0) {
                        const shiftsToSave = solvedShifts.map(s => ({ ...s, organization_id: orgIdForActions }));

                        // Save to DB
                        const { error } = await supabase.from('shifts').upsert(shiftsToSave.map(mapShiftToDB));
                        if (error) throw error;

                        // Wait for one batch to complete, but we will refresh data only once at the end ideally, 
                        // or after each day if we want incremental feedback. 
                        // For now we rely on final refresh or refresh after loop?
                        // Actually, refreshData inside loop is bad for perf. 
                        // We should count success and refresh ONCE at end.
                        successCount++;
                    }
                } catch (err) {
                    console.error(`Error scheduling for ${currentDate.toISOString()}:`, err);
                    failCount++;
                }

                // Move to next day
                currentDate.setDate(currentDate.getDate() + 1);
            }

            if (successCount > 0) {
                showToast(`✅ שיבוץ הושלם עבור ${successCount} ימים`, 'success');
                await refreshData();
                if (schedulingSuggestions.length > 0) {
                    setShowSuggestionsModal(true);
                }
            } else if (failCount > 0) {
                showToast('שגיאה בשיבוץ', 'error');
            } else {
                showToast('לא נמצאו שיבוצים אפשריים', 'info');
            }

            setShowScheduleModal(false);
        } catch (e) {
            console.error(e);
            showToast('שגיאה כללית בשיבוץ', 'error');
        } finally {
            setIsScheduling(false);
        }
    };

    const handleClearDay = async () => {
        if (!orgIdForActions) return;
        if (!checkAccess('dashboard', 'edit')) {
            showToast('אין לך הרשאה לבצע פעולה זו', 'error');
            return;
        }
        const selectedDateKey = selectedDate.toLocaleDateString('en-CA');
        const targetShifts = state.shifts.filter(s => new Date(s.startTime).toLocaleDateString('en-CA') === selectedDateKey);
        if (targetShifts.length === 0) return;
        const ids = targetShifts.map(s => s.id);
        try {
            await supabase.from('shifts').update({ assigned_person_ids: [] }).in('id', ids).eq('organization_id', orgIdForActions);
            await refreshData();
        } catch (e) { console.warn(e); }
    };

    const handleNavigate = (newView: 'personnel' | 'tasks', tab?: 'people' | 'teams' | 'roles') => {
        setView(newView);
        if (newView === 'personnel' && tab) {
            setPersonnelTab(tab);
        }
    };

    const renderContent = () => {
        if (isGlobalLoading) return <DashboardSkeleton />;

        const orgIdForActions = activeOrgId || organization?.id;

        // Permission Gate
        if (view !== 'contact' && !checkAccess(view)) {
            return (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                    <ShieldIcon size={64} className="text-slate-300 mb-4" weight="duotone" />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">אין לך הרשאה לצפות בעמוד זה</h2>
                    <p className="text-slate-500 mb-6">אנא פנה למנהל הארגון לקבלת הרשאות מתאימות.</p>
                    <button
                        onClick={() => setView('dashboard')}
                        className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 transition-colors"
                    >
                        חזור ללוח השיבוצים
                    </button>
                </div>
            );
        }

        switch (view) {
            case 'home':
                return (
                    <div className="space-y-6">
                        <HomePage
                            shifts={state.shifts}
                            tasks={state.taskTemplates}
                            people={state.people}
                            teams={state.teams}
                            roles={state.roles}
                            onNavigate={(view: any) => handleNavigate(view as any)}
                        />
                    </div>
                );

            case 'dashboard':
                return (
                    <div className="space-y-6">
                        <ScheduleBoard
                            shifts={state.shifts}
                            missionReports={state.missionReports}
                            people={state.people}
                            taskTemplates={state.taskTemplates}
                            roles={state.roles}
                            teams={state.teams}
                            constraints={state.constraints}
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                            onSelect={() => { }}
                            onDelete={handleDeleteShift}
                            isViewer={!checkAccess('dashboard', 'edit')}
                            onClearDay={handleClearDay}
                            onNavigate={handleNavigate}
                            onAssign={handleAssign}
                            onUnassign={handleUnassign}
                            onAddShift={handleAddShift}
                            onUpdateShift={handleUpdateShift}
                            onToggleCancelShift={handleToggleCancelShift}
                            teamRotations={state.teamRotations}
                            absences={state.absences}
                            hourlyBlockages={state.hourlyBlockages}
                            settings={state.settings}
                            onRefreshData={refetchOrgData}
                        />

                        <AutoScheduleModal
                            isOpen={showScheduleModal}
                            onClose={() => setShowScheduleModal(false)}
                            onSchedule={handleAutoSchedule}
                            tasks={state.taskTemplates}
                            initialDate={scheduleStartDate}
                            isScheduling={isScheduling}
                        />
                    </div>
                );
            case 'attendance': return <AttendanceManager
                people={state.people}
                teams={state.teams}
                roles={state.roles}
                teamRotations={state.teamRotations}
                tasks={state.taskTemplates}
                constraints={state.constraints}
                absences={state.absences}
                hourlyBlockages={state.hourlyBlockages}
                settings={state.settings}
                onUpdatePerson={handleUpdatePerson}
                onUpdatePeople={handleUpdatePeople}
                onAddRotation={handleAddRotation}
                onUpdateRotation={handleUpdateRotation}
                onDeleteRotation={handleDeleteRotation}
                onAddShifts={async (newShifts) => {
                    try {
                        const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: orgIdForActions }));
                        await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
                        refreshData();
                    } catch (e) { console.warn(e); }
                }}
                onRefresh={refetchOrgData}
                isViewer={!checkAccess('attendance', 'edit')}
                initialOpenRotaWizard={autoOpenRotaWizard}
                onDidConsumeInitialAction={() => setAutoOpenRotaWizard(false)}
            />;
            case 'battalion-home': return <BattalionDashboard setView={setView} />;
            case 'battalion-personnel': return <BattalionPersonnelTable />;
            case 'battalion-attendance': return <BattalionAttendanceManager />;
            case 'battalion-settings': return <BattalionSettings />;
            case 'personnel': return <PersonnelManager people={state.people} teams={state.teams} roles={state.roles} onAddPerson={handleAddPerson} onDeletePerson={handleDeletePerson} onDeletePeople={handleDeletePeople} onUpdatePerson={handleUpdatePerson} onUpdatePeople={handleUpdatePeople} onAddTeam={handleAddTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam} onAddRole={handleAddRole} onDeleteRole={handleDeleteRole} onUpdateRole={handleUpdateRole} initialTab={personnelTab} isViewer={!checkAccess('personnel', 'edit')} organizationId={orgIdForActions} />;
            case 'tasks': return <TaskManager tasks={state.taskTemplates} roles={state.roles} teams={state.teams} onDeleteTask={handleDeleteTask} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} isViewer={!checkAccess('tasks', 'edit')} />;
            case 'stats': return <StatsDashboard people={state.people} shifts={state.shifts} tasks={state.taskTemplates} roles={state.roles} teams={state.teams} teamRotations={state.teamRotations} isViewer={!checkAccess('stats', 'edit')} currentUserEmail={profile?.email} currentUserName={profile?.full_name} />;
            case 'settings': return checkAccess('settings', 'edit') ? <OrganizationSettingsComponent teams={state.teams} /> : <Navigate to="/" />;
            case 'logs': return profile?.is_super_admin ? <AdminLogsViewer /> : <Navigate to="/" />;
            case 'org-logs': return checkAccess('org-logs', 'view') ? <OrganizationLogsViewer limit={100} /> : <Navigate to="/" />;
            case 'lottery': return <Lottery
                people={state.allPeople || state.people}
                teams={state.teams}
                roles={state.roles}
                shifts={state.shifts}
                absences={state.absences}
                tasks={state.taskTemplates}
            />;
            case 'constraints': return <ConstraintsManager people={state.people} teams={state.teams} roles={state.roles} tasks={state.taskTemplates} constraints={state.constraints} onAddConstraint={handleAddConstraint} onDeleteConstraint={handleDeleteConstraint} isViewer={!checkAccess('constraints', 'edit')} organizationId={orgIdForActions || ''} />;
            case 'faq': return <FAQPage onNavigate={setView} />;
            case 'contact': return <ContactPage />;
            case 'system': return profile?.is_super_admin ? <SystemManagementPage /> : <Navigate to="/" />;
            case 'equipment':
                return <EquipmentManager
                    people={state.people}
                    teams={state.teams}
                    equipment={state.equipment}
                    equipmentDailyChecks={state.equipmentDailyChecks}
                    onAddEquipment={handleAddEquipment}
                    onUpdateEquipment={handleUpdateEquipment}
                    onDeleteEquipment={handleDeleteEquipment}
                    onUpsertEquipmentCheck={handleUpsertEquipmentCheck}
                    isViewer={!checkAccess('equipment', 'edit')}
                    currentPerson={myPerson}
                />;
            case 'absences':
                return checkAccess('absences') ? (
                    <AbsenceManager
                        people={state.people}
                        absences={state.absences}
                        onAddAbsence={handleAddAbsence}
                        onUpdateAbsence={handleUpdateAbsence}
                        onDeleteAbsence={handleDeleteAbsence}
                        onUpdatePerson={handleUpdatePerson}
                        isViewer={!checkAccess('absences', 'edit')}
                        shifts={state.shifts}
                        tasks={state.taskTemplates}
                        teams={state.teams}
                        onNavigateToAttendance={() => { setAutoOpenRotaWizard(true); setView('attendance'); }}
                    />
                ) : <Navigate to="/" />;
            case 'gate':
                return <GateDashboard />;
            default:
                return (
                    <div className="p-8">
                        <DashboardSkeleton />
                        <div className="flex flex-col items-center justify-center h-[20vh] text-center">
                            <h2 className="text-xl font-bold text-slate-400">העמוד בטעינה or לא נמצא...</h2>
                            <button onClick={() => setView('home')} className="mt-4 text-blue-500 hover:underline">חזרה לדף הבית</button>
                        </div>
                    </div>
                );
        }
    };

    useEffect(() => { initGA(); }, []);
    useEffect(() => { if (view) { trackPageView(`/${view}`); logger.logView(view); } }, [view]);
    usePageTracking(view);

    return {
        view, setView, activeOrgId, setActiveOrgId, battalionCompanies, hasBattalion, isLinkedToPerson,
        state, selectedDate, setSelectedDate, showScheduleModal, setShowScheduleModal, handleAutoSchedule,
        scheduleStartDate, isScheduling, handleClearDay, handleNavigate, handleAssign, handleUnassign,
        handleAddShift, handleUpdateShift, handleToggleCancelShift, refetchOrgData, myPerson, personnelTab,
        autoOpenRotaWizard, setAutoOpenRotaWizard, schedulingSuggestions, showSuggestionsModal,
        setShowSuggestionsModal, isGlobalLoading, checkAccess, renderContent
    };
};

const MainApp: React.FC = () => {
    const {
        view, setView, activeOrgId, setActiveOrgId, battalionCompanies, hasBattalion, isLinkedToPerson,
        state, selectedDate, setSelectedDate, showScheduleModal, setShowScheduleModal,
        scheduleStartDate, isScheduling, refetchOrgData, myPerson,
        schedulingSuggestions, showSuggestionsModal, setShowSuggestionsModal, renderContent
    } = useMainAppState();

    const hasSkippedLinking = localStorage.getItem('miuim_skip_linking') === 'true';
    if (!isLinkedToPerson && state.people.length > 0 && !hasSkippedLinking) return <ClaimProfile />;

    return (
        <Layout
            currentView={view}
            setView={setView}
            activeOrgId={activeOrgId}
            onOrgChange={setActiveOrgId}
            battalionCompanies={battalionCompanies}
        >
            <div className="relative min-h-screen bg-transparent pb-20 md:pb-0">
                <ErrorBoundary>
                    <main className="max-w-[1600px] mx-auto transition-all duration-300">
                        <React.Suspense fallback={<div className="flex justify-center items-center h-[60vh]"><DashboardSkeleton /></div>}>
                            {renderContent()}
                        </React.Suspense>
                    </main>
                </ErrorBoundary>

                {/* Suggestions Modal */}
                {showSuggestionsModal && schedulingSuggestions.length > 0 && (
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-2xl">
                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <Sparkles className="text-idf-yellow" size={24} weight="duotone" />
                                    הצעות להשלמת שיבוץ
                                </h2>
                                <button onClick={() => setShowSuggestionsModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} weight="bold" />
                                </button>
                            </div>
                            <div className="overflow-y-auto p-6 space-y-6">
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-right" dir="rtl">
                                    <div className="bg-blue-100 p-2 rounded-lg h-fit text-blue-600">
                                        <ShieldIcon size={20} weight="duotone" />
                                    </div>
                                    <p className="text-blue-900 text-sm leading-relaxed">
                                        השיבוץ בוצע במצב <strong>"אורגניות צוות"</strong> קשיח. המשימות הבאות לא הושלמו במלואן כדי שלא לערבב צוותים, אך נמצאו אנשים מצוותים אחרים שיכולים להתאים:
                                    </p>
                                </div>
                                <div className="space-y-4" dir="rtl">
                                    {schedulingSuggestions.map((sug, idx) => (
                                        <div key={idx} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-idf-yellow/30 transition-colors text-right">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="font-bold text-slate-900 text-lg">{sug.taskName}</h3>
                                                    <div className="flex items-center gap-2 mt-1 text-slate-500 text-sm">
                                                        <Calendar size={14} weight="duotone" />
                                                        <span>{new Date(sug.startTime).toLocaleDateString('he-IL')}</span>
                                                        <span className="text-slate-300">•</span>
                                                        <span>{new Date(sug.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                                    </div>
                                                </div>
                                                <div className="bg-rose-50 text-rose-600 text-xs px-3 py-1.5 rounded-full font-bold border border-rose-100 flex items-center gap-1.5 direction-ltr">
                                                    <AlertCircle size={14} weight="duotone" />
                                                    חסרים {sug.missingCount}
                                                </div>
                                            </div>
                                            <div className="space-y-2.5">
                                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">אלטרנטיבות מצוותים אחרים</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {sug.alternatives.map((alt, aidx) => (
                                                        <div key={aidx} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                                            <span className="font-bold text-slate-700 text-sm">{alt.name}</span>
                                                            <span className="text-slate-400 text-xs font-medium">
                                                                {state.teams.find(t => t.id === alt.teamId)?.name || 'ללא צוות'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
                                <button
                                    onClick={() => setShowSuggestionsModal(false)}
                                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-[0.98]"
                                >
                                    הבנתי, תודה
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

// --- App Wrapper with Auth Logic ---
const MainRoute: React.FC<{ user: any; profile: any; organization: any }> = ({ user, profile, organization }) => {

    // If user exists but NO profile data is loaded yet -> Show Loading
    if (user && !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">טוען פרופיל משתמש...</p>
                </div>
            </div>
        );
    }

    // If not logged in → Show New Landing Page
    if (!user) {
        return <NewLandingPage />;
    }

    // If profile has organization_id but organization data is not loaded yet -> Show Loading
    if (profile?.organization_id && !organization) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">טוען נתוני ארגון...</p>
                </div>
            </div>
        );
    }

    // If profile exists but NO organization_id AND NO battalion_id → Show Onboarding
    if (profile && !profile.organization_id && !profile.battalion_id) {
        return <Onboarding />;
    }

    return <MainApp />;
};

// --- App Wrapper with Auth Logic ---
const AppContent: React.FC = () => {
    const { user, profile, organization, loading } = useAuth();
    const [isProcessingInvite, setIsProcessingInvite] = useState(true);

    useEffect(() => {
        const checkPendingInvite = async () => {
            const pendingToken = localStorage.getItem('pending_invite_token');
            const hasOrg = !!profile?.organization_id;

            if (user && pendingToken) {
                if (hasOrg) {
                    localStorage.removeItem('pending_invite_token');
                    setIsProcessingInvite(false);
                    return;
                }
                try {
                    const { data, error } = await supabase.rpc('join_organization_by_token', { p_token: pendingToken });
                    if (!error && data) {
                        localStorage.removeItem('pending_invite_token');
                        window.location.reload();
                        return;
                    }
                    localStorage.removeItem('pending_invite_token');
                } catch (error) {
                    console.error('❌ Join Error:', error);
                }
            }
            setIsProcessingInvite(false);
        };

        const checkTerms = async () => {
            const timestamp = localStorage.getItem('terms_accepted_timestamp');
            if (user && timestamp) {
                await supabase.from('profiles').update({ terms_accepted_at: timestamp }).eq('id', user.id);
                localStorage.removeItem('terms_accepted_timestamp');
            }
        };

        if (!loading) {
            if (user) {
                checkPendingInvite();
                checkTerms();
            } else {
                setIsProcessingInvite(false);
            }
        }
    }, [user, loading, profile]);

    useEffect(() => {
        if (isProcessingInvite) {
            const timer = setTimeout(() => setIsProcessingInvite(false), 10000);
            return () => clearTimeout(timer);
        }
    }, [isProcessingInvite]);

    if (loading || isProcessingInvite) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">
                        {isProcessingInvite ? 'מצטרף לארגון...' : 'טוען נתונים...'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ErrorBoundary>
            {user && <BackgroundPrefetcher />}
            <Routes>
                <Route path="/join/:token" element={<JoinPage />} />
                <Route path="/accessibility" element={<AccessibilityStatement />} />
                <Route path="/landing-v2" element={<NewLandingPage />} />
                <Route path="/contact" element={<ContactUsPage />} />
                <Route path="*" element={<MainRoute user={user} profile={profile} organization={organization} />} />
            </Routes>
        </ErrorBoundary>
    );
};

export default function App() {
    return (
        <ErrorBoundary>
            <Router>
                <AuthProvider>
                    <ToastProvider>
                        <GlobalClickTracker />
                        <AppContent />
                    </ToastProvider>
                </AuthProvider>
            </Router>
        </ErrorBoundary>
    );
}
