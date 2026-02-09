import React, { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { lazyWithRetry } from './utils/lazyWithRetry';
import { Switch } from '@/components/ui/Switch'; // Assuming we have a Switch component, or use a checkbox
import { formatIsraelDate } from './utils/dateUtils';
import { getEffectiveAvailability, isStatusPresent } from './utils/attendanceUtils';
import { validateAssignment } from './utils/assignmentValidation';

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
const AnalyticsDashboard = lazyWithRetry(() => import('./features/admin/analytics/AnalyticsDashboard').then(module => ({ default: module.AnalyticsDashboard })));
const AdminCenter = lazyWithRetry(() => import('./features/admin/AdminCenter').then(module => ({ default: module.AdminCenter })));



import { HomePage } from './features/core/HomePage';
import { LandingPage } from './features/core/LandingPage';
import { Onboarding } from './features/auth/Onboarding';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { useToast } from './contexts/ToastContext';
import { logger } from './services/loggingService';
import { Person, Shift, TaskTemplate, Role, Team, SchedulingConstraint, Absence, Equipment, ViewMode, Organization, NavigationAction, Battalion } from './types';
import { WarClock } from './features/scheduling/WarClock';
import { shiftService } from './services/shiftService';
import { authService } from './services/authService';
import { personnelService } from './services/personnelService';
import { attendanceService } from './services/attendanceService';
import { organizationService } from './services/organizationService';
import { taskService } from './services/taskService';
import { schedulingService } from './services/schedulingService';
import { equipmentService } from './services/equipmentService';
import { snapshotService } from './services/snapshotService';
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
import { BattalionMorningReport } from './features/battalion/reports/BattalionMorningReport';
import { ClaimProfile } from './features/auth/ClaimProfile';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NewLandingPage } from './features/landing/NewLandingPage';
import { ContactUsPage } from './features/landing/ContactUsPage';
import { GlobalClickTracker } from './features/core/GlobalClickTracker';
import { AutoScheduleModal } from './features/scheduling/AutoScheduleModal';
import { EmptyStateGuide } from './components/ui/EmptyStateGuide';
import { ToastProvider } from './contexts/ToastContext';
import { BackgroundPrefetcher } from './components/core/BackgroundPrefetcher';
import { CommandPalette } from './components/ui/CommandPalette';
import { ProcessingProvider, useProcessing } from './contexts/ProcessingContext';
import { GlobalProcessingIndicator } from './components/ui/GlobalProcessingIndicator';



import { ConfirmationModal } from './components/ui/ConfirmationModal';
import { FeatureTour, TourStep } from './components/ui/FeatureTour';


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
    const { startProcessing, updateProgress, stopProcessing } = useProcessing();
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

    const [activeOrgId, setActiveOrgId] = useState<string | null>(null);

    // Sync activeOrgId with profile/organization on mount and changes
    useEffect(() => {
        if (!activeOrgId && profile?.organization_id) {
            setActiveOrgId(profile.organization_id);
        } else if (!activeOrgId && organization?.id) {
            setActiveOrgId(organization.id);
        }
    }, [profile?.organization_id, organization?.id, activeOrgId]);

    const handleOrgChange = async (newOrgId: string) => {
        if (!user) return;
        try {
            await authService.updateProfile(user.id, { organization_id: newOrgId });
            window.location.reload();
        } catch (err) {
            console.error('Failed to update organization', err);
            showToast('שגיאה בהחלפת פלוגה', 'error');
        }
    };

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
    const [battalion, setBattalion] = useState<Battalion | null>(null);

    const effectiveBattalionId = useMemo(() => {
        if (organization?.battalion_id) return organization.battalion_id;
        // Only fall back to profile battalion when user has no org assigned (e.g., battalion commander)
        if (!profile?.organization_id && profile?.battalion_id) return profile.battalion_id;
        return null;
    }, [organization?.battalion_id, profile?.organization_id, profile?.battalion_id]);

    // Determines if the company switcher UI should be visible
    const isCompanySwitcherEnabled = useMemo(() => {
        // Must be in a battalion
        if (!effectiveBattalionId) return false;

        // Enabled if:
        // 1. Battalion settings allow it AND user has explicit profile flag
        // 2. OR user is a Super Admin
        // 3. OR user is a "Battalion User" (has battalion_id on profile or in HQ org)
        const isBattalionUser = profile?.is_super_admin ||
            !!profile?.battalion_id ||
            organization?.org_type === 'battalion' ||
            organization?.is_hq;

        const enabled = !!battalion?.is_company_switcher_enabled && (!!profile?.can_switch_companies || isBattalionUser);


        return enabled;
    }, [effectiveBattalionId, profile?.can_switch_companies, profile?.is_super_admin, profile?.battalion_id, organization?.org_type, organization?.is_hq, battalion?.is_company_switcher_enabled]);

    // Fetch battalion data if user is in battalion
    useEffect(() => {
        if (!effectiveBattalionId) {
            setBattalionCompanies([]);
            setBattalion(null);
            return;
        }


        import('./services/battalionService').then(m => {
            // Fetch companies
            m.fetchBattalionCompanies(effectiveBattalionId)
                .then(companies => {

                    setBattalionCompanies(companies);
                })
                .catch(err => console.error('❌ [Battalion] Failed to fetch battalion companies', err));

            // Fetch battalion settings
            m.fetchBattalion(effectiveBattalionId)
                .then(setBattalion)
                .catch(err => console.error('Failed to fetch battalion settings', err));
        });
    }, [effectiveBattalionId]);

    // Auto-select first company ONLY if user has no assigned organization (e.g., battalion commander)
    // and no activeOrgId has been manually set yet.
    useEffect(() => {
        if (battalionCompanies.length > 0 && !activeOrgId && !profile?.organization_id) {

            setActiveOrgId(battalionCompanies[0].id);
        }
    }, [activeOrgId, profile?.organization_id, battalionCompanies]);
    const [schedulingSuggestions, setSchedulingSuggestions] = useState<SchedulingSuggestion[]>([]);
    const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
    const [deletionPending, setDeletionPending] = useState<{
        ids: string[];
        personName?: string;
        impactItems: string[];
        totalRecords: number;
        isLoadingImpact?: boolean;
    } | null>(null);

    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
    const [navigationAction, setNavigationAction] = useState<NavigationAction>(null);
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 1024 : false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024); // lg breakpoint is 1024 in Tailwind by default, checking Navbar usage
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handlePaletteNavigate = (view: ViewMode, action?: NavigationAction) => {
        setNavigationAction(action || null);
        setView(view);
        setIsCommandPaletteOpen(false);
    };

    // Command Palette Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

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
            showToast("שגיאה בטעינת הנתונים - נסה לרענן", 'error', 4000, orgError);
        }
    }, [orgError]);

    // DB Mutation Handlers (Now just wrapper around Supabase + Refetch/Invalidate)
    // For V1 Performance: We simply invalidate the query to refetch fresh data
    const queryClient = useQueryClient();
    const refreshData = () => {
        return queryClient.invalidateQueries({ queryKey: ['organizationData', activeOrgId, user?.id] });
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

    const handleAddPerson = async (p: Person, options?: { skipDb?: boolean }) => {
        if (!orgIdForActions) return;
        const personWithOrg = { ...p, organization_id: orgIdForActions };
        const dbPayload = mapPersonToDB(personWithOrg);

        try {
            if (options?.skipDb) {
                queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        people: [...old.people, p],
                        allPeople: [...(old.allPeople || []), p]
                    };
                });
                await logger.logCreate('person', p.id, p.name, p);
                showToast('החייל נוסף בהצלחה', 'success');
                // refreshData(); // Removed redundant refresh
                return;
            }

            const newPerson = await personnelService.addPerson(p);
            await logger.logCreate('person', newPerson.id, p.name, p);
            showToast('החייל נוסף בהצלחה', 'success');
            refreshData();
        } catch (e: any) {
            showToast(e.message || 'שגיאה בהוספת חייל', 'error');
            throw e;
        }
    };

    const handleAddPeople = async (newPeople: Person[]) => {
        if (!orgIdForActions) return;

        try {
            await personnelService.addPeople(newPeople);

            await logger.log({
                action: 'CREATE',
                entityId: 'bulk',
                category: 'data',
                metadata: { details: `Imported ${newPeople.length} people` }
            });

            refreshData();
        } catch (e: any) {
            showToast(e.message || 'שגיאה בהוספת אנשים', 'error');
            throw e;
        }
    };

    const handleUpdatePerson = async (p: Person, options?: { skipDb?: boolean }) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                people: old.people.map((person: Person) => person.id === p.id ? p : person),
                allPeople: (old.allPeople || []).map((person: Person) => person.id === p.id ? p : person)
            };
        });

        try {
            if (options?.skipDb) {
                await logger.logUpdate('person', p.id, p.name, state.people.find(person => person.id === p.id), p);
                // refreshData(); // Removed redundant refresh
                return;
            }

            await personnelService.updatePerson(p);
            await logger.logUpdate('person', p.id, p.name, state.people.find(person => person.id === p.id), p);
            // Don't refresh immediately - causes read-after-write issues
            // The optimistic update above already updated the cache
            // refreshData();
        } catch (e: any) {
            console.warn("DB Update Failed:", e);
            refreshData(); // Revert
            throw e;
        }
    };

    const handleUpdatePeople = async (peopleToUpdate: Person[]) => {
        try {
            await personnelService.upsertPeople(peopleToUpdate);

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
        const person = state.people.find(p => p.id === id);

        // Open modal IMMEDIATELY
        setDeletionPending({
            ids: [id],
            personName: person?.name,
            impactItems: [],
            totalRecords: 0,
            isLoadingImpact: true
        });

        // Background: preview what will be deleted
        try {
            const preview = await personnelService.previewPersonDeletion(id);

            // Build detailed data for modal
            const impactItems = preview
                ?.filter((item: any) => item.count > 0)
                .map((item: any) => `• ${item.description}: ${item.count} `) || [];

            const totalRecords = preview?.reduce((sum: number, item: any) => sum + item.count, 0) || 0;

            setDeletionPending(prev => prev ? {
                ...prev,
                impactItems,
                totalRecords,
                isLoadingImpact: false
            } : null);

        } catch (previewErr) {
            console.warn("Preview failed, proceeding with standard confirmation:", previewErr);
            setDeletionPending(prev => prev ? {
                ...prev,
                isLoadingImpact: false
            } : null);
        }
    };

    const handleDeletePeople = async (ids: string[]) => {
        // Open modal IMMEDIATELY
        setDeletionPending({
            ids,
            impactItems: [],
            totalRecords: 0,
            isLoadingImpact: true
        });

        // Preview deletion impact for all selected people in background
        try {
            const previewPromises = ids.map(id => personnelService.previewPersonDeletion(id));

            const results = await Promise.all(previewPromises);

            // Aggregate counts across all people
            const aggregated: Record<string, { count: number; description: string; category: string }> = {};

            results.forEach(result => {
                if (result) {
                    result.forEach((item: any) => {
                        if (!aggregated[item.category]) {
                            aggregated[item.category] = { count: 0, description: item.description, category: item.category };
                        }
                        aggregated[item.category].count += item.count;
                    });
                }
            });

            // Build detailed data
            const impactItems = Object.values(aggregated)
                .filter(item => item.count > 0)
                .map(item => `• ${item.description}: ${item.count} `);

            const totalRecords = Object.values(aggregated).reduce((sum, item) => sum + item.count, 0);

            setDeletionPending(prev => prev ? {
                ...prev,
                impactItems,
                totalRecords,
                isLoadingImpact: false
            } : null);

        } catch (previewErr) {
            console.warn("Preview failed, proceeding with standard confirmation:", previewErr);
            setDeletionPending(prev => prev ? {
                ...prev,
                isLoadingImpact: false
            } : null);
        }
    };

    const confirmExecuteDeletion = async () => {
        if (!deletionPending) return;
        const { ids, personName } = deletionPending;
        const isBatch = ids.length > 1;

        setDeletionPending(null); // Close modal

        // --- OPTIMISTIC UPDATE ---
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                people: old.people.filter((p: any) => !ids.includes(p.id)),
                allPeople: old.allPeople.filter((p: any) => !ids.includes(p.id))
            };
        });

        try {
            if (isBatch) {
                // Archive all selection before deletion
                await personnelService.archivePeopleBeforeDelete(ids, user!.id, `Batch deletion of ${ids.length} people via UI`);

                // Cascade delete
                await personnelService.deletePeopleCascade(ids);

                await logger.log({
                    action: 'DELETE',
                    entityId: 'bulk',
                    category: 'data',
                    metadata: { details: `Bulk deleted ${ids.length} people` }
                });
                showToast(`${ids.length} חיילים נמחקו לצמיתות`, 'success');
            } else {
                const id = ids[0];
                // Archive before deletion
                await personnelService.archivePersonBeforeDelete(id, user!.id, 'Manual deletion via UI');

                // Secure delete
                await personnelService.deletePersonSecure(id);

                await logger.logDelete('person', id, personName || 'אדם', {});
                showToast('החייל נמחק לצמיתות', 'success');
            }
            refreshData();
        } catch (e: any) {
            console.warn("Delete failed, rollback and fallback:", e);
            refreshData(); // Sync back
            if (e.code === '23503' || e.code === '409' || e.message?.includes('violates foreign key constraint')) {
                try {
                    if (isBatch) {
                        await personnelService.updatePeople(ids.map(id => ({ id, isActive: false } as Person)));
                        showToast(`החיילים הועברו לארכיון(${ids.length}) בגלל אילוצי מסד נתונים`, 'info');
                    } else {
                        await personnelService.updatePerson({ id: ids[0], isActive: false } as Person);
                        showToast('החייל הועבר לארכיון בגלל אילוצי מסד נתונים', 'info');
                    }
                    refreshData();
                } catch (softErr) {
                    showToast("שגיאה בארכוב חייל", 'error');
                }
            } else {
                showToast("שגיאה במחיקת חייל", 'error');
            }
        }
    };

    const handleAddTeam = async (t: Team, options?: { skipDb?: boolean }): Promise<Team | undefined> => {
        if (!orgIdForActions) return;
        const dbPayload = mapTeamToDB({ ...t, organization_id: orgIdForActions });

        if (dbPayload.id && (dbPayload.id.startsWith('team-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        // Optimistic update - add to local state immediately
        const newTeam = mapTeamFromDB(dbPayload);
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            const exists = old.teams?.some((team: Team) => team.id === newTeam.id);
            return {
                ...old,
                teams: exists
                    ? old.teams.map((team: Team) => team.id === newTeam.id ? newTeam : team)
                    : [...old.teams, newTeam]
            };
        });

        if (options?.skipDb) {
            // refreshData(); // Removed redundant refresh
            return newTeam;
        }

        try {
            const newTeam = await personnelService.addTeam(t);
            await logger.logCreate('team', newTeam.id, t.name, t);
            showToast('הצוות נוסף בהצלחה', 'success');
            refreshData();
            return newTeam;
        } catch (e: any) {
            showToast('שגיאה בהוספת צוות', 'error');
            throw e;
        }
    };

    const handleAddTeams = async (newTeams: Team[]): Promise<Team[]> => {
        if (!orgIdForActions || newTeams.length === 0) return [];

        const payloads = newTeams.map(t => {
            const payload = mapTeamToDB({ ...t, organization_id: orgIdForActions });
            if (payload.id && (payload.id.startsWith('team-') || payload.id.startsWith('temp-'))) {
                payload.id = uuidv4();
            }
            return payload;
        });

        try {
            await personnelService.addTeams(newTeams);
            await refreshData();
            return newTeams; // Note: original returned mapped from payload, but newTeams from caller might lack real IDs. 
            // Actually personnelService.addTeams doesn't return anything. 
            // For now I'll just refresh and return input.
        } catch (e: any) {
            showToast('שגיאה בהוספת הצוותים', 'error');
            throw e;
        }
    };

    const handleUpdateTeam = async (t: Team, options?: { skipDb?: boolean }) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                teams: old.teams.map((team: Team) => team.id === t.id ? t : team)
            };
        });

        try {
            if (options?.skipDb) {
                // refreshData(); // Removed redundant refresh
                return;
            }
            await personnelService.updateTeam(t);
            refreshData();
        } catch (e: any) {
            showToast('שגיאה בעדכון צוות', 'error');
        }
    };

    const handleDeleteTeam = async (id: string) => {
        // --- OPTIMISTIC UPDATE ---
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                teams: old.teams.filter((t: any) => t.id !== id)
            };
        });

        try {
            await personnelService.deleteTeam(id, orgIdForActions!);
            await refreshData();
            showToast('הצוות נמחק בהצלחה', 'success');
        } catch (e: any) {
            console.error('Delete Team Error:', e);
            refreshData(); // Sync back
            if (e.code === '23503') {
                showToast('לא ניתן למחוק את הצוות כיוון שיש לו תלויות נוספות (למשל סבבים או משימות)', 'error');
            } else {
                showToast('שגיאה במחיקת צוות', 'error');
            }
        }
    };

    const handleAddRole = async (r: Role, options?: { skipDb?: boolean }): Promise<Role | undefined> => {
        if (!orgIdForActions) return;
        const dbPayload = mapRoleToDB({ ...r, organization_id: orgIdForActions });

        if (dbPayload.id && (dbPayload.id.startsWith('role-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        // Optimistic update - add to local state immediately
        const newRole = mapRoleFromDB(dbPayload);
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                roles: [...old.roles, newRole]
            };
        });

        try {
            if (options?.skipDb) {
                // refreshData(); // Removed redundant refresh
                return newRole;
            }

            await personnelService.addRole(r);
            showToast('התפקיד נוסף בהצלחה', 'success');
            refreshData(); // Sync with DB in background
            return newRole;
        } catch (e: any) {
            // Rollback on error
            queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    roles: old.roles.filter((role: Role) => role.id !== dbPayload.id)
                };
            });
            showToast('שגיאה בהוספת תפקיד', 'error');
            throw e;
        }
    };

    const handleAddRoles = async (newRoles: Role[]): Promise<Role[]> => {
        if (!orgIdForActions || newRoles.length === 0) return [];

        const payloads = newRoles.map(r => {
            const payload = mapRoleToDB({ ...r, organization_id: orgIdForActions });
            if (payload.id && (payload.id.startsWith('role-') || payload.id.startsWith('temp-'))) {
                payload.id = uuidv4();
            }
            return payload;
        });

        try {
            const addedRoles = await personnelService.addRoles(newRoles);

            await refreshData();
            return addedRoles;
        } catch (e: any) {
            showToast('שגיאה בהוספת התפקידים', 'error');
            throw e;
        }
    };

    const handleUpdateRole = async (r: Role, options?: { skipDb?: boolean }) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                roles: old.roles.map((role: Role) => role.id === r.id ? r : role)
            };
        });

        try {
            if (options?.skipDb) {
                // refreshData(); // Removed redundant refresh
                return;
            }

            await personnelService.updateRole(r);
            refreshData();
        } catch (e: any) {
            showToast('שגיאה בעדכון תפקיד', 'error');
        }
    };

    const handleDeleteRole = async (id: string) => {
        // --- OPTIMISTIC UPDATE ---
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                roles: old.roles.filter((r: any) => r.id !== id),
                people: old.people.map((p: any) => ({
                    ...p,
                    roleIds: (p.roleIds || []).filter((rid: string) => rid !== id)
                })),
                taskTemplates: (old.taskTemplates || []).map((t: any) => ({
                    ...t,
                    segments: (t.segments || []).map((s: any) => {
                        const newComposition = (s.roleComposition || []).filter((rc: any) => rc.roleId !== id);
                        return {
                            ...s,
                            roleComposition: newComposition,
                            requiredPeople: newComposition.reduce((sum: number, rc: any) => sum + rc.count, 0)
                        };
                    })
                })),
                shifts: (old.shifts || []).map((s: any) => {
                    if (!s.requirements?.roleComposition) return s;
                    const newComp = s.requirements.roleComposition.filter((rc: any) => rc.roleId !== id);
                    return {
                        ...s,
                        requirements: {
                            ...s.requirements,
                            roleComposition: newComp,
                            requiredPeople: newComp.reduce((sum: number, rc: any) => sum + rc.count, 0)
                        }
                    };
                })
            };
        });

        try {
            // 1. Context-aware cleanup
            const cleanupTasks: Promise<any>[] = [
                // Delete constraints related to this role
                schedulingService.deleteConstraintsByRole(id, orgIdForActions!)
            ];

            // 2. Update People
            const peopleWithRole = state.people.filter(p => p.roleIds?.includes(id));
            if (peopleWithRole.length > 0) {
                const updates = peopleWithRole.map(p => ({
                    ...p,
                    roleIds: p.roleIds.filter(rid => rid !== id)
                }));
                cleanupTasks.push(personnelService.updatePeople(updates));
            }

            // 3. Update Task Templates (JSONB segments)
            const tasksWithRole = state.taskTemplates.filter(t =>
                t.segments?.some(s => s.roleComposition.some(rc => rc.roleId === id))
            );
            if (tasksWithRole.length > 0) {
                for (const t of tasksWithRole) {
                    const updatedSegments = t.segments.map(s => {
                        const newComp = s.roleComposition.filter(rc => rc.roleId !== id);
                        return {
                            ...s,
                            roleComposition: newComp,
                            requiredPeople: newComp.reduce((sum, rc) => sum + rc.count, 0)
                        };
                    });
                    cleanupTasks.push(taskService.updateTaskSegments(t.id, updatedSegments));
                }
            }

            // 4. Update Future Shifts (Requirements snapshot)
            const now = new Date().toISOString();
            const futureShiftsWithRole = state.shifts.filter(s =>
                s.startTime >= now &&
                s.requirements?.roleComposition.some(rc => rc.roleId === id)
            );
            if (futureShiftsWithRole.length > 0) {
                const shiftUpdates: Shift[] = futureShiftsWithRole.map(s => {
                    const newComp = s.requirements!.roleComposition.filter(rc => rc.roleId !== id);
                    return {
                        ...s,
                        requirements: {
                            ...s.requirements,
                            roleComposition: newComp,
                            requiredPeople: newComp.reduce((sum, rc) => sum + rc.count, 0)
                        }
                    };
                });
                cleanupTasks.push(shiftService.upsertShifts(shiftUpdates));
            }

            await Promise.all(cleanupTasks);

            // 5. Finally delete the role
            await personnelService.deleteRole(id, orgIdForActions!);

            await refreshData();
            showToast('התפקיד נמחק והוגדר מחדש בבשימושים הקיימים', 'success');
        } catch (e: any) {
            console.error('Delete Role Error:', e);
            refreshData(); // Sync back
            if (e.code === '23503') {
                showToast('לא ניתן למחוק את התפקיד כיוון שהוא מוגדר כחובה במשימות קיימות', 'error');
            } else {
                showToast('שגיאה במחיקת תפקיד', 'error');
            }
        }
    };

    const handleAddTask = async (t: TaskTemplate) => {
        if (!orgIdForActions) return;
        const dbPayload = mapTaskToDB({ ...t, organization_id: orgIdForActions });

        if (dbPayload.id && (dbPayload.id.startsWith('task-') || dbPayload.id.startsWith('temp-'))) {
            dbPayload.id = uuidv4();
        }

        // Optimistic update - add to local state immediately
        const newTask = mapTaskFromDB(dbPayload);
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                taskTemplates: [...old.taskTemplates, newTask]
            };
        });

        try {
            const newTaskFromDB = await taskService.addTask({ ...t, organization_id: orgIdForActions });

            // Update local state with the REAL task from server (replacing optimistic one if needed)
            queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
                if (!old) return old;
                // Filter out the optimistic task (by temp ID or just replace) and add the real one
                const currentTasks = old.taskTemplates.filter((task: TaskTemplate) => task.id !== dbPayload.id);
                return {
                    ...old,
                    taskTemplates: [...currentTasks, newTaskFromDB]
                };
            });

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newShifts = generateShiftsForTask({ ...t, id: newTaskFromDB.id, organization_id: orgIdForActions }, today);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: orgIdForActions }));
            if (shiftsWithOrg.length > 0) {
                await shiftService.upsertShifts(shiftsWithOrg);
            }
            await logger.logCreate('task', newTaskFromDB.id, t.name, t);
            showToast('המשימה נוצרה בהצלחה', 'success');
            // NO refreshData() here - we trust the state update above. 
            // We can do it silently if absolutely needed, but better to avoid UI flicker.
        } catch (e: any) {
            // Rollback on error
            queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
                if (!old) return old;
                return {
                    ...old,
                    taskTemplates: old.taskTemplates.filter((task: TaskTemplate) => task.id !== dbPayload.id)
                };
            });
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
            try {
                startProcessing(`מעדכן משימה "${t.name}"...`);
                updateProgress(10, 'יוצר גיבוי בטיחות...');

                // 1. Create safety snapshot before operation
                try {
                    await snapshotService.createAutoSnapshot(
                        orgIdForActions!,
                        user!.id,
                        `עדכון משימה "${t.name}" שגורר שינוי משמרות`
                    );
                } catch (snapshotErr) {
                    console.warn("Auto-snapshot failed, proceeding anyway:", snapshotErr);
                }

                updateProgress(30, 'מנתח שינויים ומחשב משמרות חדשות...');
                // 2. Get current time to differentiate past/future
                const now = new Date();

                // 3. Fetch current shifts for this task to preserve assignments
                const currentShifts = await shiftService.fetchShifts(orgIdForActions!, { taskId: t.id });
                const existingShifts: Shift[] = currentShifts;

                // 4. Separate past/active shifts from future shifts
                const futureShiftsToReplace = existingShifts.filter(s => new Date(s.startTime) >= now);

                // 5. Generate new shifts starting from today
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());

                const generatedShifts = generateShiftsForTask(t, startOfWeek);
                const newFutureShifts = generatedShifts
                    .map(s => ({ ...s, organization_id: orgIdForActions }))
                    .filter(s => new Date(s.startTime) >= now);

                updateProgress(50, 'מבצע הגירה של שיבוצים קיימים...');
                // 6. Migrate assignments from old future shifts to new ones (Improved matching)
                const matchedNewShifts = newFutureShifts.map(newShift => {
                    const newShiftTime = new Date(newShift.startTime).getTime();
                    const newShiftDate = new Date(newShift.startTime).toISOString().split('T')[0];

                    // PRECISE MATCH: Same segment and same start time
                    let match = futureShiftsToReplace.find(oldShift => {
                        const oldShiftTime = new Date(oldShift.startTime).getTime();
                        return oldShiftTime === newShiftTime && oldShift.segmentId === newShift.segmentId;
                    });

                    // FUZZY MATCH: Same segment and same day (handles shifted hours)
                    if (!match) {
                        const sameDaySameSegment = futureShiftsToReplace.filter(oldShift => {
                            const oldShiftDate = new Date(oldShift.startTime).toISOString().split('T')[0];
                            return oldShiftDate === newShiftDate && oldShift.segmentId === newShift.segmentId;
                        });

                        if (sameDaySameSegment.length === 1) {
                            match = sameDaySameSegment[0];
                        } else if (sameDaySameSegment.length > 1) {
                            // If multiple, pick the one with closest relative time offset 
                            // (or just the first one if unsure)
                            match = sameDaySameSegment[0];
                        }
                    }

                    // FALLBACK: Match by time alone (if segmentId changed but time stayed)
                    if (!match) {
                        match = futureShiftsToReplace.find(oldShift => {
                            const oldShiftTime = new Date(oldShift.startTime).getTime();
                            return Math.abs(oldShiftTime - newShiftTime) < 1000;
                        });
                    }

                    if (match) {
                        return {
                            ...newShift,
                            assignedPersonIds: match.assignedPersonIds || [],
                            isLocked: !!match.isLocked,
                            isCancelled: !!match.isCancelled
                        };
                    }
                    return newShift;
                });

                // 7. Update task template
                await taskService.updateTask(t);

                updateProgress(80, 'מעדכן מסד נתונים...');
                // 8. Perform the actual shift swap for future shifts
                const isoNow = now.toISOString();
                await shiftService.deleteFutureShiftsByTask(t.id, orgIdForActions!, isoNow);

                if (matchedNewShifts.length > 0) {
                    await shiftService.upsertShifts(matchedNewShifts);
                }

                updateProgress(100, 'הושלם בהצלחה!');
                await logger.logUpdate('task', t.id, t.name, oldTask, t);
                await refreshData();
                showToast('המשימה והמשמרות העתידיות עודכנו בהצלחה. גיבוי אוטומטי נוצר.', 'success');

            } catch (e: any) {
                console.error(e);
                showToast(`שגיאה בעדכון משימה: ${e.message} `, 'error');
            } finally {
                stopProcessing();
            }
        } else {
            try {
                await taskService.updateTask(t);
                await logger.logUpdate('task', t.id, t.name, oldTask, t);
                await refreshData();
                showToast('המשימה עודכנה בהצלחה', 'success');
            } catch (e: any) {
                console.error('Task Update Error:', e);
                showToast(`שגיאה בעדכון: ${e.message} `, 'error');
            }
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!orgIdForActions) return;

        const task = state.taskTemplates.find(t => t.id === id);

        // Optimistic update - remove from local state immediately
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                taskTemplates: old.taskTemplates.filter((t: TaskTemplate) => t.id !== id)
            };
        });

        try {
            await taskService.deleteTask(id, orgIdForActions!);
            await shiftService.deleteShiftsByTask(id, orgIdForActions!);
            await logger.logDelete('task', id, task?.name || 'משימה', task);
            showToast('המשימה נמחקה בהצלחה', 'success');
            await refreshData(); // Sync with DB in background
        } catch (e: any) {
            // Rollback on error
            if (task) {
                queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
                    if (!old) return old;
                    return {
                        ...old,
                        taskTemplates: [...old.taskTemplates, task]
                    };
                });
            }
            showToast('שגיאה במחיקת משימה', 'error');
        }
    };

    const handleAddConstraint = async (c: Omit<SchedulingConstraint, 'id'>, silent = false) => {
        if (!orgIdForActions) return;
        try {
            await schedulingService.addConstraint({ ...c, organization_id: orgIdForActions });
            refreshData();
            if (!silent) showToast('אילוץ נשמר בהצלחה', 'success');
        } catch (e) {
            console.warn(e);
            showToast('שגיאה בשמירת אילוץ', 'error');
        }
    };

    const handleDeleteConstraint = async (id: string, silent = false) => {
        try {
            await schedulingService.deleteConstraint(id);
            await refreshData();
            if (!silent) showToast('אילוץ נמחק בהצלחה', 'success');
        } catch (e: any) {
            console.error('Delete Constraint Error:', e);
            if (!silent) showToast('שגיאה במחיקת אילוץ', 'error');
        }
    };

    const handleUpdateInterPersonConstraints = async (newConstraints: import('./types').InterPersonConstraint[]) => {
        if (!organization?.id) return;
        try {
            await organizationService.updateInterPersonConstraints(organization.id, newConstraints);
            await refetchOrgData();
            showToast('אילוצים עודכנו בהצלחה', 'success');
        } catch (e) {
            console.error('Update InterPerson Constraints Error:', e);
            showToast('שגיאה בעדכון אילוצים', 'error');
        }
    };

    const handleUpdateConstraint = async (c: SchedulingConstraint) => {
        try {
            await schedulingService.updateConstraint(c);
            await refreshData();
        } catch (e) { console.warn(e); }
    };

    const handleAddRotation = async (r: import('./types').TeamRotation) => {
        if (!orgIdForActions) return;
        try {
            await schedulingService.addRotation({ ...r, organization_id: orgIdForActions });
            await refreshData();
            showToast('סבב נוסף בהצלחה', 'success');
        } catch (e: any) {
            console.error('Add Rotation Error:', e);
            showToast('שגיאה בהוספת סבב', 'error');
        }
    };

    const handleUpdateRotation = async (r: import('./types').TeamRotation) => {
        try {
            await schedulingService.updateRotation(r);
            await refreshData();
            showToast('הסבב עודכן בהצלחה', 'success');
        } catch (e: any) {
            console.error('Update Rotation Error:', e);
            showToast('שגיאה בעדכון סבב', 'error');
        }
    };

    const handleDeleteRotation = async (id: string) => {
        try {
            await schedulingService.deleteRotation(id);
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
        if (!orgIdForActions) return;

        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                absences: [a, ...old.absences]
            };
        });

        try {
            await schedulingService.addAbsence({ ...a, organization_id: orgIdForActions });
            await refreshData();
            await logger.logCreate('absence', a.id, 'בקשת יציאה - סנכרון', a);
        } catch (e: any) {
            logger.error('ERROR', 'Failed to add absence', e);
            console.warn(e);
            showToast('שגיאה בשמירת בקשת יציאה', 'error');
        }
    };

    const handleUpdateAbsence = async (a: Absence, presenceUpdates?: any[]) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                absences: old.absences.map((abs: Absence) => abs.id === a.id ? a : abs)
            };
        });

        try {
            await schedulingService.updateAbsence(a);

            if (presenceUpdates && presenceUpdates.length > 0) {
                await attendanceService.upsertDailyPresence(presenceUpdates);
            }

            await refreshData();
        } catch (e: any) {
            console.warn("DB Update Failed:", e);
            showToast("שגיאה בעדכון בקשת יציאה", 'error');
        }
    };

    const handleDeleteAbsence = async (id: string, presenceUpdates?: any[]) => {
        // Optimistic Update (Absence removal is already handled by common flow, 
        // but person sync might have happened via handleUpdatePerson call before this)
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                absences: old.absences.filter((abs: Absence) => abs.id !== id)
            };
        });

        try {
            await schedulingService.deleteAbsence(id);

            if (presenceUpdates && presenceUpdates.length > 0) {
                await attendanceService.upsertDailyPresence(presenceUpdates);
            }

            refreshData();
        } catch (e) {
            console.warn("DB Delete Failed", e);
            showToast("שגיאה במחיקת היעדרות", 'error');
            refreshData(); // Revert
        }
    };

    const handleAddEquipment = async (e: Equipment) => {
        if (!orgIdForActions) return;
        const dbPayload = mapEquipmentToDB({ ...e, organization_id: orgIdForActions, created_by: profile?.id });

        // Handle non-UUID temp IDs from frontend
        if (dbPayload.id && !dbPayload.id.includes('-') && dbPayload.id.length < 32) {
            dbPayload.id = uuidv4();
        }

        try {
            await equipmentService.addEquipment({ ...e, organization_id: orgIdForActions, created_by: profile?.id });
            await refreshData();
            showToast('הציוד נוסף בהצלחה', 'success');
        } catch (e: any) {
            console.error('Add Equipment Error:', e);
            showToast('שגיאה בהוספת ציוד', 'error');
        }
    };

    const handleUpdateEquipment = async (e: Equipment) => {
        try {
            await equipmentService.updateEquipment(e);
            await refreshData();
            showToast('הציוד עודכן בהצלחה', 'success');
        } catch (e: any) {
            console.error('Update Equipment Error:', e);
            showToast(`שגיאה בעדכון ציוד: ${e.message} `, 'error');
        }
    };

    const handleDeleteEquipment = async (id: string) => {
        try {
            await equipmentService.deleteEquipment(id);
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
            await equipmentService.upsertDailyCheck(check);
            console.log('[Equipment Check] Success');
            await refreshData();
        } catch (e: any) {
        }
    };

    const handleAssign = async (shiftId: string, personId: string, taskName?: string, forceAssignment = false, metadataOverride?: any) => {
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

        // --- Validation: Check Constraints (Skipped if Forced) ---
        // --- Validation: Centralized Check (Skipped if Forced) ---
        if (!forceAssignment) {
            const person = state.people.find(p => p.id === personId);
            if (person) {
                const validation = validateAssignment({
                    shift,
                    person,
                    // We don't enforce overlap/rest in App.tsx strict checks yet, 
                    // or we assume frontend handles warnings. Pass empty array for allShifts to skip operational checks if desired,
                    // OR pass state.shifts if we want to enforce overlap strictly?
                    // Existing code did NOT check overlap in App.tsx. Let's keep it loose for now.
                    allShifts: [],
                    constraints: state.constraints,
                    teamRotations: state.teamRotations,
                    absences: state.absences,
                    hourlyBlockages: state.hourlyBlockages
                });

                if (validation.isHardConstraintViolation) {
                    showToast(`לא ניתן לשבץ: ${validation.hardConstraintReason}`, 'error');
                    return;
                }

                if (validation.isAttendanceViolation) {
                    showToast(`לא ניתן לשבץ: ${validation.attendanceReason}`, 'error');
                    return;
                }
            }
        }
        // --- End Validation ---

        const newAssignments = [...originalAssignments, personId];

        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                shifts: old.shifts.map((s: Shift) => s.id === shiftId ? {
                    ...s,
                    assignedPersonIds: newAssignments,
                    ...(metadataOverride ? { metadata: metadataOverride } : {})
                } : s)
            };
        });

        try {
            await shiftService.updateShiftAssignments(shiftId, newAssignments, metadataOverride);
            await logger.logAssign(shiftId, personId, state.people.find(p => p.id === personId)?.name || 'אדם', {
                taskId: shift.taskId,
                taskName: taskName || task?.name,
                startTime: shift.startTime,
                endTime: shift.endTime,
                date: shift.startTime.split('T')[0]
            });
            refreshData(); // Sync in background
        } catch (e: any) {
            logger.error('ASSIGN', 'Failed to assign person to shift', e);
            console.warn("Assignment failed, reverting:", e);
            showToast('שגיאה בשיבוץ, אנא נסה שוב', 'error');
            refreshData(); // Revert to server state
        }
    };

    const handleUnassign = async (shiftId: string, personId: string, taskName?: string, metadataOverride?: any) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const task = state.taskTemplates.find(t => t.id === shift.taskId); // Fetch task for logging

        const newAssignments = shift.assignedPersonIds.filter(pid => pid !== personId);

        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                shifts: old.shifts.map((s: Shift) => s.id === shiftId ? {
                    ...s,
                    assignedPersonIds: newAssignments,
                    ...(metadataOverride ? { metadata: metadataOverride } : {})
                } : s)
            };
        });

        try {
            await shiftService.updateShiftAssignments(shiftId, newAssignments, metadataOverride);
            await logger.logUnassign(shiftId, personId, state.people.find(p => p.id === personId)?.name || 'אדם', {
                taskId: shift.taskId,
                taskName: taskName || task?.name,
                startTime: shift.startTime,
                endTime: shift.endTime,
                date: shift.startTime.split('T')[0]
            });
            refreshData();
        } catch (e: any) {
            logger.error('UNASSIGN', 'Failed to unassign person from shift', e);
            console.warn(e);
            showToast('שגיאה בהסרת שיבוץ', 'error');
            refreshData();
        }
    };

    const handleUpdateShift = async (updatedShift: Shift) => {
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                shifts: old.shifts.map((s: Shift) => s.id === updatedShift.id ? updatedShift : s)
            };
        });

        try {
            await shiftService.updateShift(updatedShift);
            const task = state.taskTemplates.find(t => t.id === updatedShift.taskId);
            await logger.log({
                action: 'UPDATE',
                entityType: 'shift',
                entityId: updatedShift.id,
                actionDescription: 'Updated shift details',
                metadata: {
                    taskId: updatedShift.taskId,
                    taskName: task?.name,
                    startTime: updatedShift.startTime,
                    endTime: updatedShift.endTime,
                    date: formatIsraelDate(updatedShift.startTime)
                }
            });
            await refreshData();
        } catch (e) { console.warn(e); }
    };

    const handleBulkUpdateShifts = async (updatedShifts: Shift[]) => {
        if (!orgIdForActions || updatedShifts.length === 0) return;
        try {
            await shiftService.upsertShifts(updatedShifts);

            await logger.log({
                action: 'UPDATE',
                entityId: 'bulk-shifts',
                category: 'data',
                metadata: { details: `Bulk updated ${updatedShifts.length} shifts from Draft Mode` }
            });

            await refreshData();
            showToast('כל השינויים פורסמו בהצלחה', 'success');
        } catch (e: any) {
            console.error('Bulk Update Error:', e);
            showToast(`שגיאה בפרסום השינויים: ${e.message} `, 'error');
            throw e;
        }
    };

    const handleDeleteShift = async (shiftId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        const task = shift ? state.taskTemplates.find(t => t.id === shift.taskId) : undefined;
        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                shifts: old.shifts.filter((s: Shift) => s.id !== shiftId)
            };
        });

        try {
            await shiftService.deleteShift(shiftId);
            if (shift) {
                await logger.log({
                    action: 'DELETE',
                    entityType: 'shift',
                    entityId: shiftId,
                    actionDescription: 'Deleted shift',
                    metadata: {
                        taskId: shift.taskId,
                        taskName: task?.name,
                        startTime: shift.startTime,
                        endTime: shift.endTime,
                        date: formatIsraelDate(shift.startTime)
                    }
                });
            }
            refreshData();
        } catch (e) {
            console.warn("Error deleting shift:", e);
            refreshData();
        }
    };

    const handleToggleCancelShift = async (shiftId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const newCancelledState = !shift.isCancelled;

        // Optimistic Update
        queryClient.setQueryData(['organizationData', activeOrgId, user?.id], (old: any) => {
            if (!old) return old;
            return {
                ...old,
                shifts: old.shifts.map((s: Shift) => s.id === shiftId ? { ...s, isCancelled: newCancelledState } : s)
            };
        });

        try {
            await shiftService.toggleShiftCancellation(shiftId, newCancelledState);
            const task = state.taskTemplates.find(t => t.id === shift.taskId);
            await logger.log({
                action: 'UPDATE',
                entityType: 'shift',
                entityId: shiftId,
                actionDescription: newCancelledState ? 'Cancelled shift' : 'Restored shift',
                metadata: {
                    taskId: shift.taskId,
                    taskName: task?.name,
                    startTime: shift.startTime,
                    endTime: shift.endTime,
                    isCancelled: newCancelledState,
                    date: formatIsraelDate(shift.startTime)
                }
            });
            refreshData();
        } catch (e) {
            console.warn("Error toggling cancel state:", e);
            refreshData();
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
            await shiftService.addShift(newShift);
            await logger.log({
                action: 'CREATE',
                entityType: 'shift',
                entityId: newShift.id,
                actionDescription: 'Created new shift',
                metadata: {
                    taskId: newShift.taskId,
                    taskName: task.name,
                    startTime: newShift.startTime,
                    endTime: newShift.endTime,
                    date: formatIsraelDate(newShift.startTime)
                }
            });
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

                    const futureAssignments = await shiftService.fetchShifts(orgIdForActions!, {
                        startDate: futureStart.toISOString(),
                        endDate: futureEndLimit.toISOString()
                    });

                    // 3. Filter tasks to schedule (Now handled inside solveSchedule)
                    // We pass the FULL state so the solver knows about all tasks for constraints

                    // 4. Determine shifts to solve (Start Today OR Overlap from Yesterday)
                    const targetDateKey = dateStart.toLocaleDateString('en-CA');
                    const dayStartMs = dateStart.getTime();

                    // A. Shifts starting today (and match task filter)
                    let shiftsToSchedule = state.shifts.filter(s => {
                        const sDate = new Date(s.startTime).toLocaleDateString('en-CA');
                        const matchesTask = !selectedTaskIds || selectedTaskIds.includes(s.taskId);
                        return sDate === targetDateKey && !s.isLocked && !s.isCancelled && matchesTask;
                    });

                    // B. Unassigned shifts starting BEFORE today but ending AFTER today begins (Spillover)
                    // e.g. 23:00 Yesterday -> 07:00 Today.
                    const overlapShifts = state.shifts.filter(s => {
                        const sStart = new Date(s.startTime).getTime();
                        const sEnd = new Date(s.endTime).getTime();
                        const matchesTask = !selectedTaskIds || selectedTaskIds.includes(s.taskId);

                        // Condition: Starts BEFORE today, Ends IN today (or later), Unassigned, Not Locked, Not Cancelled
                        return matchesTask && !s.isLocked && !s.isCancelled &&
                            sStart < dayStartMs &&
                            sEnd > dayStartMs &&
                            s.assignedPersonIds.length === 0;
                    });

                    if (overlapShifts.length > 0) {
                        console.log(`[AutoSchedule] Found ${overlapShifts.length} unassigned overlap shifts from previous day.Including them.`);
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
                        await shiftService.upsertShifts(shiftsToSave);

                        // Wait for one batch to complete, but we will refresh data only once at the end ideally, 
                        // or after each day if we want incremental feedback. 
                        // For now we rely on final refresh or refresh after loop?
                        // Actually, refreshData inside loop is bad for perf. 
                        // We should count success and refresh ONCE at end.
                        successCount++;
                    }
                } catch (err) {
                    console.error(`Error scheduling for ${currentDate.toISOString()}: `, err);
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

    const handleClearDay = async ({ startDate, endDate, taskIds }: { startDate: Date; endDate: Date; taskIds?: string[] }) => {
        if (!orgIdForActions) return;
        if (!checkAccess('dashboard', 'edit')) {
            showToast('אין לך הרשאה לבצע פעולה זו', 'error');
            return;
        }

        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            const data = await shiftService.clearAssignmentsInRange(orgIdForActions, start.toISOString(), end.toISOString(), taskIds);

            const clearedCount = data?.length || 0;
            await refreshData();

            if (clearedCount > 0) {
                showToast(`נוקו ${clearedCount} שיבוצים בהצלחה`, 'success');
            } else {
                showToast('לא נמצאו שיבוצים לניקוי בטווח שנבחר', 'info');
            }

            logger.info('DELETE', `Cleared assignments for range ${start.toLocaleDateString('he-IL')} - ${end.toLocaleDateString('he-IL')} `, {
                startDate: start.toISOString(),
                endDate: end.toISOString(),
                taskCount: taskIds?.length,
                category: 'scheduling',
                action: 'CLEAR_RANGE'
            });
        } catch (e: any) {
            console.warn(e);
            showToast('שגיאה בניקוי השיבוצים', 'error');
        }
    };

    const handleNavigate = (newView: 'personnel' | 'tasks' | 'dashboard' | string, payload?: any) => {
        setView(newView as ViewMode);
        if (newView === 'personnel' && typeof payload === 'string') {
            setPersonnelTab(payload as 'people' | 'teams' | 'roles');
        }
        if (newView === 'dashboard' && payload instanceof Date) {
            setSelectedDate(payload);
        }
    };

    return {
        view, setView, activeOrgId, setActiveOrgId, handleOrgChange, battalionCompanies, hasBattalion, isLinkedToPerson,
        isCompanySwitcherEnabled,
        state, selectedDate, setSelectedDate, showScheduleModal, setShowScheduleModal, handleAutoSchedule,
        scheduleStartDate, isScheduling, handleClearDay, handleNavigate, handleAssign, handleUnassign,
        handleAddShift, handleUpdateShift, handleDeleteShift, handleToggleCancelShift, refetchOrgData, myPerson, personnelTab,
        autoOpenRotaWizard, setAutoOpenRotaWizard, schedulingSuggestions, showSuggestionsModal,
        setShowSuggestionsModal, isGlobalLoading, checkAccess, handleBulkUpdateShifts,
        handleAddPeople, deletionPending, setDeletionPending, confirmExecuteDeletion,
        isCommandPaletteOpen, setIsCommandPaletteOpen, navigationAction, setNavigationAction, handlePaletteNavigate,
        isMobile, setPersonnelTab, handleAddTask, handleDeleteTask, handleUpdateTask, handleUpdatePerson, handleUpdatePeople, handleAddRotation, handleUpdateRotation, handleDeleteRotation, handleAddPerson, handleDeletePerson, handleDeletePeople, handleAddTeam, handleAddTeams, handleUpdateTeam, handleDeleteTeam, handleAddRole, handleAddRoles, handleDeleteRole, handleUpdateRole, handleAddConstraint, handleDeleteConstraint, handleUpdateInterPersonConstraints, handleAddEquipment, handleUpdateEquipment, handleDeleteEquipment, handleUpsertEquipmentCheck, handleAddAbsence, handleUpdateAbsence, handleDeleteAbsence,
        profile, organization, orgIdForActions
    };
};


const MainApp: React.FC = () => {
    const {
        view, setView, activeOrgId, setActiveOrgId, handleOrgChange, battalionCompanies, hasBattalion, isLinkedToPerson,
        isCompanySwitcherEnabled,
        state, selectedDate, setSelectedDate, showScheduleModal, setShowScheduleModal,
        scheduleStartDate, isScheduling, refetchOrgData, myPerson,
        schedulingSuggestions, showSuggestionsModal, setShowSuggestionsModal,
        handleAddPeople, deletionPending, setDeletionPending, confirmExecuteDeletion,
        isCommandPaletteOpen, setIsCommandPaletteOpen, navigationAction, setNavigationAction, handlePaletteNavigate,
        checkAccess, handleBulkUpdateShifts, isMobile, orgIdForActions, isGlobalLoading,
        handleAutoSchedule, handleClearDay, handleNavigate, handleAssign, handleUnassign,
        handleAddShift, handleUpdateShift, handleDeleteShift, handleToggleCancelShift,
        handleUpdatePerson, handleUpdatePeople, handleAddRotation, handleUpdateRotation, handleDeleteRotation,
        handleDeleteTask, handleAddTask, handleUpdateTask,
        handleAddPerson, handleDeletePerson, handleDeletePeople, handleAddTeam, handleAddTeams, handleUpdateTeam, handleDeleteTeam,
        handleAddRole, handleAddRoles, handleDeleteRole, handleUpdateRole,
        handleAddConstraint, handleDeleteConstraint, handleUpdateInterPersonConstraints,
        handleAddEquipment, handleUpdateEquipment, handleDeleteEquipment, handleUpsertEquipmentCheck,
        handleAddAbsence, handleUpdateAbsence, handleDeleteAbsence,
        personnelTab, setPersonnelTab, autoOpenRotaWizard, setAutoOpenRotaWizard, profile, organization
    } = useMainAppState();

    const sampleSoldier = useMemo(() => state.allPeople.find(p => p.isActive !== false) || state.allPeople[0], [state.allPeople]);

    const searchSteps: TourStep[] = useMemo(() => [
        {
            targetId: isMobile ? '#tour-search-trigger-mobile' : '#tour-search-trigger',
            title: 'חיפוש מהיר וחדש!',
            content: 'הכירו את ה-חיפוש המהיר. מכאן תוכלו להגיע לכל מקום במערכת בשניות. נסו ללחוץ כאן.',
            position: 'bottom'
        },
        {
            targetId: '#tour-search-input',
            title: 'מה מחפשים?',
            content: `הקלידו שם של דף, משימה או חייל. לדוגמה, נסו לחפש את "${sampleSoldier?.name || 'ישראל ישראלי'}" כדי לראות את כל הפעולות שניתן לבצע עבורו.`,
            position: 'bottom'
        },
        {
            targetId: '#command-list',
            title: 'ניווט מהיר',
            content: 'השתמשו בחצים במקלדת כדי לעבור בין התוצאות וב-Enter כדי לבחור. זה כל כך מהיר שלא תאמינו איך הסתדרתם בלי זה!',
            position: 'bottom'
        }
    ], [isMobile, sampleSoldier]);

    const hasSkippedLinking = localStorage.getItem('miuim_skip_linking') === 'true';
    if (!isLinkedToPerson && state.people.length > 0 && !hasSkippedLinking) return <ClaimProfile />;

    const overlays = (
        <>
            {/* Command Palette */}
            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                people={state.allPeople}
                roles={state.roles}
                teams={state.teams}
                onNavigate={handlePaletteNavigate}
                checkAccess={checkAccess}
            />

            {/* Quick Search Feature Tour */}
            <FeatureTour
                steps={searchSteps}
                tourId={isMobile ? "universal_search_v1_mobile" : "universal_search_v1"}
                onStepChange={(index: number) => {
                    if (index === 1 && !isCommandPaletteOpen) {
                        setIsCommandPaletteOpen(true);
                    }
                }}
            />

            {/* Delete Confirmation Modal */}
            {deletionPending && (
                <ConfirmationModal
                    isOpen={true}
                    title={deletionPending.ids.length > 1 ? `מחיקת ${deletionPending.ids.length} חיילים` : `מחיקת ${deletionPending.personName || 'חייל'}`}
                    type="danger"
                    confirmText="מחק לצמיתות"
                    onConfirm={confirmExecuteDeletion}
                    onCancel={() => setDeletionPending(null)}
                >
                    <div className="space-y-4 text-right" dir="rtl">
                        <p className="font-bold text-slate-800">פעולה זו תמחק לצמיתות את המידע הבא:</p>

                        {deletionPending.isLoadingImpact ? (
                            <div className="flex flex-col items-center justify-center py-6 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                <Loader2 size={32} className="text-indigo-500 animate-spin" weight="bold" />
                                <p className="text-sm font-bold text-slate-500">מנתח את השפעת המחיקה...</p>
                            </div>
                        ) : deletionPending.impactItems.length > 0 ? (
                            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 space-y-2">
                                {deletionPending.impactItems.map((item, idx) => (
                                    <p key={idx} className="text-rose-700 text-sm font-medium">{item}</p>
                                ))}
                            </div>
                        ) : (
                            <p className="text-slate-500 italic text-sm">אין נתונים מקושרים משמעותיים שימחקו.</p>
                        )}

                        {deletionPending.totalRecords > 0 && (
                            <p className="text-sm text-slate-600">
                                סה"כ <span className="font-black text-rose-600">{deletionPending.totalRecords}</span> רשומות ימחקו לצמיתות ולא יהיה ניתן לשחזרן (אלא אם הורדת גיבוי).
                            </p>
                        )}

                        <p className="text-xs text-slate-400 mt-2">האם אתה בטוח שברצונך להמשיך?</p>
                    </div>
                </ConfirmationModal>
            )}

            {/* Suggestions Modal */}
            {showSuggestionsModal && schedulingSuggestions.length > 0 && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white rounded-t-2xl">
                            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                <Sparkles className="text-idf-yellow" size={24} weight="bold" />
                                הצעות להשלמת שיבוץ
                            </h2>
                            <button onClick={() => setShowSuggestionsModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} weight="bold" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-6 space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-right" dir="rtl">
                                <div className="bg-blue-100 p-2 rounded-lg h-fit text-blue-600">
                                    <ShieldIcon size={20} weight="bold" />
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
                                                    <Calendar size={14} weight="bold" />
                                                    <span>{new Date(sug.startTime).toLocaleDateString('he-IL')}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{new Date(sug.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <div className="bg-rose-50 text-rose-600 text-xs px-3 py-1.5 rounded-full font-bold border border-rose-100 flex items-center gap-1.5 direction-ltr">
                                                <AlertCircle size={14} weight="bold" />
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
        </>
    );

    if (isGlobalLoading) return (
        <>
            <Layout
                activeOrgId={activeOrgId}
                onOrgChange={setActiveOrgId}
                battalionCompanies={battalionCompanies}
                onSearchOpen={() => setIsCommandPaletteOpen(true)}
                isCompanySwitcherEnabled={isCompanySwitcherEnabled}
            >
                <DashboardSkeleton />
            </Layout>
            {overlays}
        </>
    );

    return (
        <>
            <Layout
                activeOrgId={activeOrgId}
                onOrgChange={handleOrgChange}
                battalionCompanies={battalionCompanies}
                onSearchOpen={() => setIsCommandPaletteOpen(true)}
                isCompanySwitcherEnabled={isCompanySwitcherEnabled}
            >
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 pt-0 md:pt-6 pb-6 transition-all duration-300">
                    <ErrorBoundary>
                        <React.Suspense fallback={<div className="flex justify-center items-center h-[60vh]"><DashboardSkeleton /></div>}>
                            <Routes>
                                <Route index element={
                                    <HomePage
                                        shifts={state.shifts}
                                        tasks={state.taskTemplates}
                                        people={state.people}
                                        teams={state.teams}
                                        roles={state.roles}
                                        absences={state.absences}
                                        teamRotations={state.teamRotations}
                                        hourlyBlockages={state.hourlyBlockages}
                                        onNavigate={handleNavigate}
                                        settings={state.settings}
                                        onRefreshData={refetchOrgData}
                                    />
                                } />
                                <Route path="home" element={<Navigate to="/" replace />} />
                                <Route path="dashboard" element={
                                    checkAccess('dashboard') ? (
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
                                                onBulkUpdateShifts={handleBulkUpdateShifts}
                                                onAutoSchedule={() => setShowScheduleModal(true)}
                                                initialPersonFilterId={navigationAction?.type === 'filter_schedule' ? navigationAction.personId : undefined}
                                                onClearNavigationAction={() => setNavigationAction(null)}
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
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="attendance" element={
                                    checkAccess('attendance') ? (
                                        <AttendanceManager
                                            people={state.people}
                                            teams={state.teams}
                                            roles={state.roles}
                                            teamRotations={state.teamRotations}
                                            tasks={state.taskTemplates}
                                            constraints={state.constraints}
                                            absences={state.absences}
                                            hourlyBlockages={state.hourlyBlockages}
                                            shifts={state.shifts}
                                            settings={state.settings}
                                            organization={organization}
                                            onUpdatePerson={handleUpdatePerson}
                                            onUpdatePeople={handleUpdatePeople}
                                            onAddRotation={handleAddRotation}
                                            onUpdateRotation={handleUpdateRotation}
                                            onDeleteRotation={handleDeleteRotation}
                                            onAddShifts={async (newShifts) => {
                                                try {
                                                    const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: orgIdForActions }));
                                                    await shiftService.upsertShifts(shiftsWithOrg);
                                                    refetchOrgData();
                                                } catch (e) { console.warn(e); }
                                            }}
                                            onRefresh={refetchOrgData}
                                            isViewer={!checkAccess('attendance', 'edit')}
                                            initialOpenRotaWizard={autoOpenRotaWizard}
                                            onDidConsumeInitialAction={() => setAutoOpenRotaWizard(false)}
                                            initialPersonId={navigationAction?.type === 'filter_attendance' ? navigationAction.personId : undefined}
                                            onClearNavigationAction={() => setNavigationAction(null)}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="personnel" element={
                                    checkAccess('personnel') ? (
                                        <PersonnelManager
                                            people={state.people}
                                            teams={state.teams}
                                            roles={state.roles}
                                            onAddPerson={handleAddPerson}
                                            onAddPeople={handleAddPeople}
                                            onDeletePerson={handleDeletePerson}
                                            onDeletePeople={handleDeletePeople}
                                            onUpdatePerson={handleUpdatePerson}
                                            onUpdatePeople={handleUpdatePeople}
                                            onAddTeam={handleAddTeam}
                                            onAddTeams={handleAddTeams}
                                            onUpdateTeam={handleUpdateTeam}
                                            onDeleteTeam={handleDeleteTeam}
                                            onAddRole={handleAddRole}
                                            onAddRoles={handleAddRoles}
                                            onDeleteRole={handleDeleteRole}
                                            onUpdateRole={handleUpdateRole}
                                            initialTab={navigationAction?.type === 'select_tab' ? navigationAction.tabId as any : personnelTab}
                                            onTabChange={setPersonnelTab}
                                            isViewer={!checkAccess('personnel', 'edit')}
                                            organizationId={orgIdForActions}
                                            initialAction={navigationAction?.type === 'edit_person' ? navigationAction : undefined}
                                            onClearNavigationAction={() => setNavigationAction(null)}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="tasks" element={
                                    checkAccess('tasks') ? (
                                        <TaskManager
                                            tasks={state.taskTemplates}
                                            roles={state.roles}
                                            teams={state.teams}
                                            onDeleteTask={handleDeleteTask}
                                            onAddTask={handleAddTask}
                                            onUpdateTask={handleUpdateTask}
                                            isViewer={!checkAccess('tasks', 'edit')}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="stats" element={
                                    checkAccess('stats') ? (
                                        <StatsDashboard
                                            people={state.people}
                                            shifts={state.shifts}
                                            tasks={state.taskTemplates}
                                            roles={state.roles}
                                            teams={state.teams}
                                            teamRotations={state.teamRotations}
                                            absences={state.absences}
                                            hourlyBlockages={state.hourlyBlockages}
                                            settings={state.settings}
                                            isViewer={!checkAccess('stats', 'edit')}
                                            currentUserEmail={profile?.email}
                                            currentUserName={profile?.full_name}
                                            initialTab={navigationAction?.type === 'select_tab' ? navigationAction.tabId as any : undefined}
                                            onClearNavigationAction={() => setNavigationAction(null)}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="settings" element={
                                    checkAccess('settings', 'edit') ? (
                                        <OrganizationSettingsComponent
                                            teams={state.teams}
                                            initialTab={navigationAction?.type === 'select_tab' ? navigationAction.tabId as any : undefined}
                                            onClearNavigationAction={() => setNavigationAction(null)}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="absences" element={
                                    checkAccess('absences') ? (
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
                                            onNavigateToAttendance={() => { setAutoOpenRotaWizard(true); }}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="equipment" element={
                                    checkAccess('equipment') ? (
                                        <EquipmentManager
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
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="lottery" element={
                                    checkAccess('lottery') ? (
                                        <Lottery
                                            people={state.allPeople || state.people}
                                            teams={state.teams}
                                            roles={state.roles}
                                            shifts={state.shifts}
                                            absences={state.absences}
                                            tasks={state.taskTemplates}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="constraints" element={
                                    checkAccess('constraints') ? (
                                        <ConstraintsManager
                                            people={state.people}
                                            teams={state.teams}
                                            roles={state.roles}
                                            tasks={state.taskTemplates}
                                            constraints={state.constraints}
                                            interPersonConstraints={state.settings?.interPersonConstraints || []}
                                            customFieldsSchema={state.settings?.customFieldsSchema || []}
                                            onAddConstraint={handleAddConstraint}
                                            onDeleteConstraint={handleDeleteConstraint}
                                            onUpdateInterPersonConstraints={handleUpdateInterPersonConstraints}
                                            isViewer={!checkAccess('constraints', 'edit')}
                                            organizationId={orgIdForActions || ''}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="gate" element={
                                    checkAccess('gate') ? <GateDashboard /> : <Navigate to="/" replace />
                                } />
                                <Route path="battalion-home" element={
                                    (organization?.battalion_id && checkAccess('battalion')) ? <BattalionDashboard setView={(v) => { }} /> : <Navigate to="/" replace />
                                } />
                                <Route path="battalion-personnel" element={
                                    (organization?.battalion_id && checkAccess('battalion')) ? <BattalionPersonnelTable /> : <Navigate to="/" replace />
                                } />
                                <Route path="battalion-attendance" element={
                                    (organization?.battalion_id && checkAccess('battalion')) ? <BattalionAttendanceManager /> : <Navigate to="/" replace />
                                } />
                                <Route path="battalion-settings" element={<Navigate to="/settings?tab=battalion" replace />} />
                                <Route path="reports" element={
                                    (organization?.battalion_id && checkAccess('battalion')) ? <BattalionMorningReport battalionId={organization?.battalion_id || ''} /> : <Navigate to="/" replace />
                                } />
                                <Route path="faq" element={<FAQPage onNavigate={(v) => { }} />} />
                                <Route path="contact" element={<ContactPage />} />
                                <Route path="logs" element={profile?.is_super_admin ? <AdminLogsViewer /> : <Navigate to="/" replace />} />
                                <Route path="system" element={profile?.is_super_admin ? <SystemManagementPage /> : <Navigate to="/" replace />} />
                                <Route path="admin-center" element={
                                    (checkAccess('settings', 'edit') || profile?.is_super_admin) ? (
                                        <AdminCenter
                                            initialTab={navigationAction?.type === 'select_tab' ? navigationAction.tabId as any : undefined}
                                            onClearNavigationAction={() => setNavigationAction(null)}
                                        />
                                    ) : <Navigate to="/" replace />
                                } />
                                <Route path="*" element={
                                    <div className="p-8">
                                        <DashboardSkeleton />
                                        <div className="flex flex-col items-center justify-center h-[20vh] text-center">
                                            <h2 className="text-xl font-bold text-slate-400">העמוד לא נמצא...</h2>
                                            <Navigate to="/" replace />
                                        </div>
                                    </div>
                                } />
                            </Routes>
                        </React.Suspense>
                    </ErrorBoundary>
                </div>
            </Layout>

            {overlays}
        </>
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
    const { showToast } = useToast();
    const [isProcessingInvite, setIsProcessingInvite] = useState(true);

    // Initial check for OAuth errors in the URL
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const error = params.get('error');
            const errorDescription = params.get('error_description');

            if (error) {
                console.error('❌ Auth Error from URL:', error, errorDescription);
                logger.error('AUTH', `Redirect error: ${error} `, { description: errorDescription });
                showToast(`שגיאה בהתחברות: ${errorDescription || error} `, 'error');

                // Clear the error from the URL without refreshing
                const newUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
            }

            // Also check hash (Supabase sometimes puts it there)
            if (window.location.hash.includes('error=')) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const hashError = hashParams.get('error');
                const hashErrorDesc = hashParams.get('error_description');

                if (hashError) {
                    showToast(`שגיאה בהתחברות: ${hashErrorDesc || hashError} `, 'error');
                    const newUrl = window.location.origin + window.location.pathname;
                    window.history.replaceState({}, document.title, newUrl);
                }
            }
        }
    }, []);

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
                    const success = await organizationService.joinOrganizationByToken(pendingToken);
                    if (success) {
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
                await authService.acceptTerms(user.id, timestamp);
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
                        {isProcessingInvite ? 'מצטרף לפלוגה...' : 'טוען נתונים...'}
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
                <ToastProvider>
                    <AuthProvider>
                        <ProcessingProvider>
                            <GlobalProcessingIndicator />
                            <GlobalClickTracker />
                            <AppContent />
                        </ProcessingProvider>
                    </AuthProvider>
                </ToastProvider>
            </Router>
        </ErrorBoundary>
    );
}
