import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
// Lazy Load Pages
const ScheduleBoard = React.lazy(() => import('./components/ScheduleBoard').then(module => ({ default: module.ScheduleBoard })));
const PersonnelManager = React.lazy(() => import('./components/PersonnelManager').then(module => ({ default: module.PersonnelManager })));
const AttendanceManager = React.lazy(() => import('./components/AttendanceManager').then(module => ({ default: module.AttendanceManager })));
const TaskManager = React.lazy(() => import('./components/TaskManager').then(module => ({ default: module.TaskManager })));
const StatsDashboard = React.lazy(() => import('./components/StatsDashboard').then(module => ({ default: module.StatsDashboard })));
const OrganizationSettingsComponent = React.lazy(() => import('./components/OrganizationSettings').then(module => ({ default: module.OrganizationSettings })));

const AdminLogsViewer = React.lazy(() => import('./components/AdminLogsViewer'));
const Lottery = React.lazy(() => import('./components/Lottery').then(module => ({ default: module.Lottery })));
const ConstraintsManager = React.lazy(() => import('./components/ConstraintsManager').then(module => ({ default: module.ConstraintsManager })));
const AbsenceManager = React.lazy(() => import('./components/AbsenceManager').then(module => ({ default: module.AbsenceManager })));
const EquipmentManager = React.lazy(() => import('./components/EquipmentManager').then(m => ({ default: m.EquipmentManager })));
const ContactPage = React.lazy(() => import('./pages/ContactPage').then(module => ({ default: module.ContactPage })));
const SystemManagementPage = React.lazy(() => import('./pages/SystemManagementPage').then(module => ({ default: module.SystemManagementPage })));


import { HomePage } from './components/HomePage';
import { LandingPage } from './components/LandingPage';
import { Onboarding } from './components/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { Person, Shift, TaskTemplate, Role, Team, SchedulingConstraint, Absence, Equipment } from './types'; // Updated imports
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
import { solveSchedule } from './services/scheduler';
import { fetchUserHistory, calculateHistoricalLoad } from './services/historyService';
import { Wand2, Loader2, Sparkles, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsForTask } from './utils/shiftUtils';
import { logger } from './services/loggingService';
import JoinPage from './components/JoinPage';
import { initGA, trackPageView } from './services/analytics';
import { usePageTracking } from './hooks/usePageTracking';
import { ClaimProfile } from './components/ClaimProfile';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AutoScheduleModal } from './components/AutoScheduleModal';
import { EmptyStateGuide } from './components/EmptyStateGuide';
import { ToastProvider } from './contexts/ToastContext';



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
const MainApp: React.FC = () => {
    const { organization, user, profile, checkAccess } = useAuth();
    const { showToast } = useToast();
    const [view, setView] = useState<'home' | 'dashboard' | 'personnel' | 'attendance' | 'tasks' | 'stats' | 'settings' | 'reports' | 'logs' | 'lottery' | 'contact' | 'constraints' | 'tickets' | 'system' | 'planner' | 'absences' | 'equipment'>(() => {
        // Always start at home, but check for import wizard flag
        if (typeof window !== 'undefined') {
            const shouldOpenImport = localStorage.getItem('open_import_wizard');
            if (shouldOpenImport) {
                return 'personnel';
            }
        }
        return 'home';
    });

    // Persistence & Scroll to Top Effect
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Only persist view changes, don't restore on mount
            localStorage.setItem('miuim_active_view', view);
            window.scrollTo(0, 0);
        }
    }, [view]);
    const [personnelTab, setPersonnelTab] = useState<'people' | 'teams' | 'roles'>('people');
    const [isLoading, setIsLoading] = useState(true);
    const [isScheduling, setIsScheduling] = useState(false);
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [scheduleStartDate, setScheduleStartDate] = useState<Date>(new Date());
    const [scheduleEndDate, setScheduleEndDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 7)));
    const [selectedDateKey, setSelectedDateKey] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [scheduleMode, setScheduleMode] = useState<'single' | 'range'>('single');

    const [state, setState] = useState<{
        people: Person[];
        shifts: Shift[];
        taskTemplates: TaskTemplate[];
        roles: Role[];
        teams: Team[];
        constraints: SchedulingConstraint[];
        teamRotations: import('./types').TeamRotation[]; // NEW
        absences: Absence[]; // NEW
        equipment: Equipment[]; // NEW
    }>({
        people: [],
        shifts: [],
        taskTemplates: [],
        roles: [],
        teams: [],
        constraints: [],
        teamRotations: [], // NEW
        absences: [], // NEW
        equipment: [] // NEW
    });

    const isLinkedToPerson = React.useMemo(() => {
        if (!user || state.people.length === 0) return true;
        return state.people.some(p => p.userId === user.id);
    }, [user, state.people]);

    useEffect(() => {
        if (!organization) return;
        fetchData();

        const channel = supabase.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'people', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduling_constraints', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_rotations', filter: `organization_id=eq.${organization.id}` }, () => fetchData()) // NEW
            .on('postgres_changes', { event: '*', schema: 'public', table: 'absences', filter: `organization_id=eq.${organization.id}` }, () => fetchData()) // NEW subscription
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment', filter: `organization_id=eq.${organization.id}` }, () => fetchData()) // NEW subscription
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_settings', filter: `organization_id=eq.${organization.id}` }, () => fetchData()) // NEW
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_presence', filter: `organization_id=eq.${organization.id}` }, () => fetchData()) // NEW subscription
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organization, profile]);

    useEffect(() => {
        logger.setContext(
            organization?.id || null,
            user?.id || null,
            profile?.email || user?.email || null,
            profile?.full_name || null
        );
    }, [organization, user, profile]);

    const fetchData = async () => {
        if (!organization) return;
        setIsLoading(true);
        try {
            const { data: peopleData } = await supabase.from('people').select('*').eq('organization_id', organization.id);
            const { data: shiftsData } = await supabase.from('shifts').select('*').eq('organization_id', organization.id);
            const { data: tasksData } = await supabase.from('task_templates').select('*').eq('organization_id', organization.id);
            const { data: rolesData } = await supabase.from('roles').select('*').eq('organization_id', organization.id);
            const { data: teamsData } = await supabase.from('teams').select('*').eq('organization_id', organization.id);
            const { data: constraintsData } = await supabase.from('scheduling_constraints').select('*').eq('organization_id', organization.id);
            const { data: rotationsData } = await supabase.from('team_rotations').select('*').eq('organization_id', organization.id); // NEW
            const { data: absencesData } = await supabase.from('absences').select('*').eq('organization_id', organization.id); // NEW
            const { data: equipmentData } = await supabase.from('equipment').select('*').eq('organization_id', organization.id); // NEW
            const { data: settingsData } = await supabase.from('organization_settings').select('*').eq('organization_id', organization.id).maybeSingle(); // NEW
            const { data: presenceData } = await supabase.from('daily_presence').select('*').eq('organization_id', organization.id); // NEW Fetch Presence

            let mappedPeople = (peopleData || []).map(mapPersonFromDB);
            let mappedShifts = (shiftsData || []).map(mapShiftFromDB);
            let mappedTeams = (teamsData || []).map(mapTeamFromDB);

            // --- Merge Daily Presence into People ---
            // Overlay the new "Truth Table" (daily_presence) onto the dailyAvailability map
            // --- Merge Daily Presence into People ---
            // Scaled Up: Smart Inference of Arrival/Departure based on Timeline
            if (presenceData) {
                // 1. Group by Person for timeline analysis
                const presenceByPerson: Record<string, any[]> = {};
                presenceData.forEach((pd: any) => {
                    if (!presenceByPerson[pd.person_id]) presenceByPerson[pd.person_id] = [];
                    presenceByPerson[pd.person_id].push(pd);
                });

                // 2. Process each person's timeline
                Object.keys(presenceByPerson).forEach(personId => {
                    const person = mappedPeople.find(p => p.id === personId);
                    if (!person) return;

                    // Sort chronologically
                    const timeline = presenceByPerson[personId].sort((a, b) =>
                        new Date(a.date).getTime() - new Date(b.date).getTime()
                    );

                    timeline.forEach((pd, index) => {
                        const dateKey = pd.date;
                        const isBase = pd.status === 'base';

                        // Infer detailed status (Arrival/Departure/Full)
                        let detailedStatus = pd.status;

                        if (isBase) {
                            // Check Neighbors
                            // console.log(`[StatusInference] Checking ${pd.person_id} on ${dateKey}. Prev: ${timeline[index - 1]?.status}, Next: ${timeline[index + 1]?.status}`);
                            const prevRec = timeline[index - 1];
                            const nextRec = timeline[index + 1];

                            const d = new Date(pd.date);
                            const prevD = prevRec ? new Date(prevRec.date) : null;
                            const nextD = nextRec ? new Date(nextRec.date) : null;

                            const isPrevContiguous = prevD && (d.getTime() - prevD.getTime() === 86400000);
                            const isNextContiguous = nextD && (nextD.getTime() - d.getTime() === 86400000);

                            const prevIsBase = isPrevContiguous && prevRec.status === 'base';
                            const nextIsBase = isNextContiguous && nextRec.status === 'base';


                            if (!prevIsBase && nextIsBase) detailedStatus = 'arrival';
                            else if (prevIsBase && !nextIsBase) detailedStatus = 'departure';
                            else if (!prevIsBase && !nextIsBase) detailedStatus = 'arrival';
                            else detailedStatus = 'full';
                        }

                        // Set Hours based on Status
                        let startHour = '00:00';
                        let endHour = '00:00';

                        if (isBase) {
                            // Normalize DB times to "HH:MM" for comparison
                            const dbStart = pd.start_time ? pd.start_time.slice(0, 5) : null;
                            const dbEnd = pd.end_time ? pd.end_time.slice(0, 5) : null;

                            if (dbStart && dbEnd && dbStart !== '00:00' && dbEnd !== '00:00') {
                                // Prioritize DB-stored times (IF they are not the default 00:00)
                                startHour = dbStart;
                                endHour = dbEnd;
                            } else {
                                // Fallback: Smart Inference (Uses defaults: 10:00 Arrival, 14:00 Departure)
                                if (detailedStatus === 'arrival') { startHour = '10:00'; endHour = '23:59'; }
                                else if (detailedStatus === 'departure') { startHour = '00:00'; endHour = '14:00'; }
                                else { startHour = '00:00'; endHour = '23:59'; } // Full Base Day
                            }
                        }

                        // Create updated entry
                        person.dailyAvailability = {
                            ...person.dailyAvailability,
                            [dateKey]: {
                                ...(person.dailyAvailability?.[dateKey] || {}),
                                isAvailable: isBase,
                                startHour,
                                endHour,
                                status: detailedStatus,
                                source: pd.source || 'algorithm'
                            }
                        };
                    });
                });
            }

            // ----------------------------------------

            // --- Data Scoping Logic ---
            const dataScope = profile?.permissions?.dataScope || 'organization';
            const allowedTeamIds = profile?.permissions?.allowedTeamIds || [];

            if (dataScope === 'team') {
                // Filter people: only those in allowed teams + current user
                mappedPeople = mappedPeople.filter(p =>
                    (p.teamId && allowedTeamIds.includes(p.teamId)) ||
                    p.userId === user?.id ||
                    (p as any).email === user?.email
                );

                // Filter shifts: only those assigned to visible people (or unassigned/open shifts? maybe all for visibility)
                // Stigmergy: typically you want to see your team's shifts.
                const visiblePersonIds = mappedPeople.map(p => p.id);
                mappedShifts = mappedShifts.filter(s =>
                    s.assignedPersonIds.some(pid => visiblePersonIds.includes(pid)) ||
                    s.assignedPersonIds.length === 0 // Show open shifts?
                );
            } else if (dataScope === 'personal') {
                // Filter people: only current user
                const myPerson = mappedPeople.find(p => p.userId === user?.id || (p as any).email === user?.email);
                if (myPerson) {
                    mappedPeople = [myPerson];
                    // Filter shifts: only assigned to me
                    mappedShifts = mappedShifts.filter(s => s.assignedPersonIds.includes(myPerson.id));
                } else {
                    // Not linked? Show all people temporarily so they can Claim Profile?
                    // If we filter to empty, ClaimProfile might fail or not show list.
                    // Let's keep all people if not linked, to allow linking.
                    if (isLinkedToPerson) {
                        mappedPeople = []; // Fallback if linked but not found (weird)
                    }
                }
            }
            // --------------------------

            setState({
                people: mappedPeople,
                shifts: mappedShifts,
                taskTemplates: (tasksData || []).map(mapTaskFromDB),
                roles: (rolesData || []).map(mapRoleFromDB),
                teams: mappedTeams,
                constraints: (constraintsData || []).map(mapConstraintFromDB),
                teamRotations: (rotationsData || []).map(mapRotationFromDB),
                absences: (absencesData || []).map(mapAbsenceFromDB), // NEW
                equipment: (equipmentData || []).map(mapEquipmentFromDB), // NEW
                settings: (settingsData as any) || null
            });
        } catch (error) {
            console.error("Error fetching data:", error);
            showToast("שגיאה בטעינת הנתונים", 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPerson = async (p: Person) => {
        if (!organization) return;
        const personWithOrg = { ...p, organization_id: organization.id };

        // Prepare payload, ensuring valid UUID
        const dbPayload = mapPersonToDB(personWithOrg);
        if (dbPayload.id && (dbPayload.id.startsWith('person-') || dbPayload.id.startsWith('imported-'))) {
            // Generate UUID on client side since DB column has no default
            dbPayload.id = self.crypto && self.crypto.randomUUID ? self.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        }

        try {
            // Insert and RETURN the new record with the real ID
            const { data, error } = await supabase.from('people').insert(dbPayload).select().single();
            if (error) throw error;

            const newPerson = mapPersonFromDB(data);
            setState(prev => ({ ...prev, people: [...prev.people, newPerson] }));
            await logger.logCreate('person', newPerson.id, newPerson.name, newPerson);
        } catch (e: any) {
            console.warn("DB Insert Failed", e);
            if (e.code === '23505') {
                throw new Error('שגיאה: משתמש עם נתונים זהים (שם/טלפון/אימייל) כבר קיים במערכת.');
            }
            throw e;
        }
    };

    const handleUpdatePerson = async (p: Person) => {
        try {
            const { error } = await supabase.from('people').update(mapPersonToDB(p)).eq('id', p.id);
            if (error) throw error;
            await logger.logUpdate('person', p.id, p.name, state.people.find(person => person.id === p.id), p);
            setState(prev => ({ ...prev, people: prev.people.map(person => person.id === p.id ? p : person) }));
        } catch (e: any) {
            console.warn("DB Update Failed:", e);
            if (e.code === '23505') {
                throw new Error('שגיאה בעדכון: משתמש עם נתונים זהים (שם/טלפון/אימייל) כבר קיים.');
            }
            throw e;
        }
    };

    const handleUpdatePeople = async (peopleToUpdate: Person[]) => {
        // Optimistic update
        setState(prev => ({
            ...prev,
            people: prev.people.map(p => {
                const updated = peopleToUpdate.find(u => u.id === p.id);
                return updated || p;
            })
        }));

        try {
            const mapped = peopleToUpdate.map(mapPersonToDB);
            const { error } = await supabase.from('people').upsert(mapped);
            if (error) throw error;
            // No strict need to log bulk updates individually to avoid spam, or log a generic bulk action
            await logger.log({
                action: 'UPDATE',
                entityId: 'bulk',
                category: 'data',
                metadata: { details: `Updated ${peopleToUpdate.length} people` }
            });

        } catch (e) {
            console.warn("Bulk DB Update Failed", e);
            showToast("שגיאה בעדכון קבוצתי", 'error');
            // Revert on failure? Ideally yes, but keeping it simple for now as we trust optimistic
        }
    };

    const handleDeletePerson = async (id: string) => {
        try {
            await supabase.from('people').delete().eq('id', id);
            await logger.logDelete('person', id, state.people.find(p => p.id === id)?.name || 'אדם', state.people.find(p => p.id === id));
        } catch (e) { console.warn("DB Delete Failed", e); }
        setState(prev => ({
            ...prev,
            people: prev.people.filter(p => p.id !== id),
            shifts: prev.shifts.map(s => ({ ...s, assignedPersonIds: s.assignedPersonIds.filter(pid => pid !== id) }))
        }));
    };

    const handleAddTeam = async (t: Team) => {
        if (!organization) return;
        try {
            await supabase.from('teams').insert(mapTeamToDB({ ...t, organization_id: organization.id }));
            setState(prev => ({ ...prev, teams: [...prev.teams, t] }));
        } catch (e) { console.warn(e); setState(prev => ({ ...prev, teams: [...prev.teams, t] })); }
    };

    const handleUpdateTeam = async (t: Team) => {
        try { await supabase.from('teams').update(mapTeamToDB(t)).eq('id', t.id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, teams: prev.teams.map(team => team.id === t.id ? t : team) }));
    };

    const handleDeleteTeam = async (id: string) => {
        try { await supabase.from('teams').delete().eq('id', id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, teams: prev.teams.filter(t => t.id !== id) }));
    };

    const handleAddRole = async (r: Role) => {
        if (!organization) return;
        try {
            await supabase.from('roles').insert(mapRoleToDB({ ...r, organization_id: organization.id }));
            setState(prev => ({ ...prev, roles: [...prev.roles, r] }));
        } catch (e) { console.warn(e); setState(prev => ({ ...prev, roles: [...prev.roles, r] })); }
    };

    const handleUpdateRole = async (r: Role) => {
        try { await supabase.from('roles').update(mapRoleToDB(r)).eq('id', r.id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, roles: prev.roles.map(role => role.id === r.id ? r : role) }));
    };

    const handleDeleteRole = async (id: string) => {
        try { await supabase.from('roles').delete().eq('id', id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, roles: prev.roles.filter(r => r.id !== id) }));
    };

    const handleAddTask = async (t: TaskTemplate) => {
        if (!organization) return;
        try {
            const { error } = await supabase.from('task_templates').insert(mapTaskToDB({ ...t, organization_id: organization.id }));
            if (error) throw error; // Re-throw to catch below

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newShifts = generateShiftsForTask({ ...t, organization_id: organization.id }, today);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: organization.id }));
            if (shiftsWithOrg.length > 0) {
                const { error: shiftsError } = await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
                if (shiftsError) console.error('Error saving shifts:', shiftsError);
            }
            setState(prev => ({ ...prev, taskTemplates: [...prev.taskTemplates, t], shifts: [...prev.shifts, ...newShifts] }));
            showToast('המשימה נוצרה בהצלחה', 'success');
        } catch (e: any) {
            console.error('Add Task Failed:', e);
            showToast(`שגיאה ביצירת משימה: ${e.message}`, 'error');
            // Optimistic update rollback (if we had done one, but here we update state only on success mostly)
        }
    };

    const handleUpdateTask = async (t: TaskTemplate) => {
        if (!organization) return;
        const oldTask = state.taskTemplates.find(task => task.id === t.id);
        let updatedShifts = state.shifts;

        // Check if segments changed (naive check by length or deep comparison)
        const oldSegmentsJSON = JSON.stringify(oldTask?.segments || []);
        const newSegmentsJSON = JSON.stringify(t.segments || []);
        const schedulingChanged = oldSegmentsJSON !== newSegmentsJSON ||
            oldTask?.startDate !== t.startDate ||
            oldTask?.endDate !== t.endDate;

        if (schedulingChanged) {
            updatedShifts = updatedShifts.filter(s => s.taskId !== t.id);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const newShifts = generateShiftsForTask(t, startOfWeek);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: organization.id }));
            try {
                // Fix: Save the updated task template (with new segments) to DB FIRST!
                const { error: taskError } = await supabase.from('task_templates').update(mapTaskToDB(t)).eq('id', t.id);
                if (taskError) {
                    throw new Error(`Task Update Failed: ${taskError.message}`);
                }

                // Delete future/unlocked shifts for this task?
                await supabase.from('shifts').delete().eq('task_id', t.id).eq('organization_id', organization.id);

                if (shiftsWithOrg.length > 0) {
                    const { error: shiftsError } = await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
                    if (shiftsError) console.error('Shifts insert error:', shiftsError);
                }

                setState(prev => ({ ...prev, taskTemplates: prev.taskTemplates.map(task => task.id === t.id ? t : task), shifts: [...updatedShifts, ...newShifts] }));
                showToast('המשימה והמשמרות עודכנו בהצלחה', 'success');

            } catch (e: any) {
                console.error(e);
                showToast(`שגיאה בעדכון משימה: ${e.message}`, 'error');
            }
        } else {
            try {
                const { error } = await supabase.from('task_templates').update(mapTaskToDB(t)).eq('id', t.id);
                if (error) {
                    console.error('Task Update Failed:', error);
                    showToast(`שגיאה בשמירה: ${error.message} (${error.details || ''})`, 'error');
                }
            } catch (e: any) {
                console.error('Task Update Exception:', e);
                showToast(`שגיאה לא צפויה: ${e.message}`, 'error');
            }
            setState(prev => ({ ...prev, taskTemplates: prev.taskTemplates.map(task => task.id === t.id ? t : task) }));
        }
    };

    const handleDeleteTask = async (id: string) => {
        if (!organization) return;
        try {
            await supabase.from('task_templates').delete().eq('id', id).eq('organization_id', organization.id);
            await supabase.from('shifts').delete().eq('task_id', id).eq('organization_id', organization.id);
        } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, taskTemplates: prev.taskTemplates.filter(t => t.id !== id), shifts: prev.shifts.filter(s => s.taskId !== id) }));
    };

    const handleAddConstraint = async (c: Omit<SchedulingConstraint, 'id'>, silent = false) => {
        if (!organization) return;
        try {
            const newConstraint = await import('./services/supabaseClient').then(m => m.addConstraint({ ...c, organization_id: organization.id }));
            setState(prev => ({ ...prev, constraints: [...prev.constraints, newConstraint] }));
            if (!silent) showToast('אילוץ נשמר בהצלחה', 'success');
        } catch (e) {
            console.warn(e);
            showToast('שגיאה בשמירת אילוץ', 'error');
        }
    };

    const handleDeleteConstraint = async (id: string, silent = false) => {
        try {
            await import('./services/supabaseClient').then(m => m.deleteConstraint(id));
            setState(prev => ({ ...prev, constraints: prev.constraints.filter(c => c.id !== id) }));
            if (!silent) showToast('אילוץ נמחק בהצלחה', 'success');
        } catch (e) {
            console.warn(e);
            showToast('שגיאה במחיקת אילוץ', 'error');
        }
    };

    const handleUpdateConstraint = async (c: SchedulingConstraint) => {
        try { await supabase.from('scheduling_constraints').update(mapConstraintToDB(c)).eq('id', c.id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, constraints: prev.constraints.map(constraint => constraint.id === c.id ? c : constraint) }));
    };

    // NEW ROTATION HANDLERS
    const handleAddRotation = async (r: import('./types').TeamRotation) => {
        if (!organization) return;
        try {
            await supabase.from('team_rotations').insert(mapRotationToDB({ ...r, organization_id: organization.id }));
            setState(prev => ({ ...prev, teamRotations: [...prev.teamRotations, r] }));
        } catch (e) { console.warn(e); }
    };

    const handleUpdateRotation = async (r: import('./types').TeamRotation) => {
        try { await supabase.from('team_rotations').update(mapRotationToDB(r)).eq('id', r.id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, teamRotations: prev.teamRotations.map(rot => rot.id === r.id ? r : rot) }));
    };

    const handleDeleteRotation = async (id: string) => {
        try { await supabase.from('team_rotations').delete().eq('id', id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, teamRotations: prev.teamRotations.filter(r => r.id !== id) }));
    };

    // ABSENCE HANDLERS
    const handleAddAbsence = async (a: Absence) => {
        setState(prev => ({ ...prev, absences: [...prev.absences, a] }));
    };

    const handleUpdateAbsence = async (a: Absence) => {
        setState(prev => ({ ...prev, absences: prev.absences.map(absence => absence.id === a.id ? a : absence) }));
    };

    const handleDeleteAbsence = async (id: string) => {
        setState(prev => ({ ...prev, absences: prev.absences.filter(a => a.id !== id) }));
    };

    const handleAddEquipment = async (e: Equipment) => {
        if (!organization) return;
        const itemWithOrg = { ...e, organization_id: organization.id };
        setState(prev => ({ ...prev, equipment: [...prev.equipment, itemWithOrg] }));
        try { await supabase.from('equipment').insert(itemWithOrg); } catch (e) { console.warn(e); }
    };

    const handleUpdateEquipment = async (e: Equipment) => {
        setState(prev => ({ ...prev, equipment: prev.equipment.map(item => item.id === e.id ? e : item) }));
        try { await supabase.from('equipment').update(e).eq('id', e.id); } catch (e) { console.warn(e); }
    };

    const handleDeleteEquipment = async (id: string) => {
        setState(prev => ({ ...prev, equipment: prev.equipment.filter(e => e.id !== id) }));
        try { await supabase.from('equipment').delete().eq('id', id); } catch (e) { console.warn(e); }
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

        if (shift.assignedPersonIds.length >= maxPeople) {
            showToast('לא ניתן לשבץ: המשמרת מלאה', 'error');
            return;
        }

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

        // Optimistic Update
        setState(prev => ({ ...prev, shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, assignedPersonIds: newAssignments } : s) }));

        try {
            const { error } = await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId);
            if (error) throw error;
            await logger.logAssign(shiftId, personId, state.people.find(p => p.id === personId)?.name || 'אדם');
        } catch (e) {
            console.warn("Assignment failed, reverting:", e);
            showToast('שגיאה בשיבוץ, אנא נסה שוב', 'error');
            // Revert
            setState(prev => ({ ...prev, shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, assignedPersonIds: originalAssignments } : s) }));
        }
    };

    const handleUnassign = async (shiftId: string, personId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        const newAssignments = shift.assignedPersonIds.filter(pid => pid !== personId);
        try { await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, assignedPersonIds: newAssignments } : s) }));
    };

    const handleUpdateShift = async (updatedShift: Shift) => {
        try { await supabase.from('shifts').update(mapShiftToDB(updatedShift)).eq('id', updatedShift.id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: prev.shifts.map(s => s.id === updatedShift.id ? updatedShift : s) }));
    };

    const handleDeleteShift = async (shiftId: string) => {
        // Optimistic update
        setState(prev => ({
            ...prev,
            shifts: prev.shifts.filter(s => s.id !== shiftId)
        }));

        try {
            await supabase.from('shifts').delete().eq('id', shiftId);
        } catch (e) {
            console.warn("Error deleting shift:", e);
            fetchData(); // Revert
        }
    };

    const handleToggleCancelShift = async (shiftId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const newCancelledState = !shift.isCancelled;

        // Optimistic update
        setState(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, isCancelled: newCancelledState } : s)
        }));

        try {
            await supabase.from('shifts').update({ is_cancelled: newCancelledState }).eq('id', shiftId);
        } catch (e) {
            console.warn("Error toggling cancel state:", e);
            // Revert
            setState(prev => ({
                ...prev,
                shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, isCancelled: !newCancelledState } : s)
            }));
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
        const newShift: Shift = { id: uuidv4(), taskId: task.id, startTime: start.toISOString(), endTime: end.toISOString(), assignedPersonIds: [], isLocked: false, organization_id: organization.id };
        try { await supabase.from('shifts').insert(mapShiftToDB(newShift)); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: [...prev.shifts, newShift] }));
    };

    const handleAutoSchedule = async (params: { startDate: Date; endDate: Date; selectedTaskIds: string[] }) => {
        setIsScheduling(true);
        const { startDate, endDate, selectedTaskIds } = params;

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
                    const historyShifts = await fetchUserHistory(dateStart, 30);
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
                        .eq('organization_id', organization!.id);

                    const futureAssignments = (futureData || []).map(mapShiftFromDB);

                    // 3. Filter tasks to schedule (Now handled inside solveSchedule)
                    // We pass the FULL state so the solver knows about all tasks for constraints

                    // 4. Solve schedule for this day
                    const solvedShifts = solveSchedule(state, dateStart, dateEnd, historyScores, futureAssignments, selectedTaskIds);

                    if (solvedShifts.length > 0) {
                        const shiftsToSave = solvedShifts.map(s => ({ ...s, organization_id: organization!.id }));

                        // Save to DB
                        const { error } = await supabase.from('shifts').upsert(shiftsToSave.map(mapShiftToDB));
                        if (error) throw error;

                        // Update local state
                        const solvedIds = shiftsToSave.map(s => s.id);
                        setState(prev => ({
                            ...prev,
                            shifts: [
                                ...prev.shifts.filter(s => !solvedIds.includes(s.id)), // Remove old versions if any
                                ...shiftsToSave
                            ]
                        }));
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
        if (!organization) return;
        if (!checkAccess('dashboard', 'edit')) {
            showToast('אין לך הרשאה לבצע פעולה זו', 'error');
            return;
        }
        const selectedDateKey = selectedDate.toLocaleDateString('en-CA');
        const targetShifts = state.shifts.filter(s => new Date(s.startTime).toLocaleDateString('en-CA') === selectedDateKey);
        if (targetShifts.length === 0) return;
        const ids = targetShifts.map(s => s.id);
        try { await supabase.from('shifts').update({ assigned_person_ids: [] }).in('id', ids).eq('organization_id', organization.id); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: prev.shifts.map(s => ids.includes(s.id) ? { ...s, assignedPersonIds: [] } : s) }));
    };

    const handleNavigate = (newView: 'personnel' | 'tasks', tab?: 'people' | 'teams' | 'roles') => {
        setView(newView);
        if (newView === 'personnel' && tab) {
            setPersonnelTab(tab);
        }
    };

    const renderContent = () => {
        if (isLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin" /></div>;

        // Permission Gate
        if (view !== 'contact' && !checkAccess(view)) {
            return (
                <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8">
                    <Shield size={64} className="text-slate-300 mb-4" />
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
            case 'home': return <HomePage shifts={state.shifts} tasks={state.taskTemplates} people={state.people} teams={state.teams} roles={state.roles} onNavigate={(view: any, date?: Date) => {
                if (date) setSelectedDate(date);
                setView(view);
            }} />;
            case 'personnel': return <PersonnelManager people={state.people} teams={state.teams} roles={state.roles} onAddPerson={handleAddPerson} onDeletePerson={handleDeletePerson} onUpdatePerson={handleUpdatePerson} onAddTeam={handleAddTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam} onAddRole={handleAddRole} onDeleteRole={handleDeleteRole} onUpdateRole={handleUpdateRole} initialTab={personnelTab} />;
            case 'attendance': return <AttendanceManager
                people={state.people}
                teams={state.teams}
                teamRotations={state.teamRotations}
                tasks={state.taskTemplates}
                constraints={state.constraints}
                absences={state.absences}
                settings={state.settings}
                onUpdatePerson={handleUpdatePerson}
                onUpdatePeople={handleUpdatePeople}
                onAddRotation={handleAddRotation}
                onUpdateRotation={handleUpdateRotation}
                onDeleteRotation={handleDeleteRotation}
                onAddShifts={(newShifts) => setState(prev => ({ ...prev, shifts: [...prev.shifts, ...newShifts] }))}
                isViewer={!checkAccess('attendance', 'edit')}
            />;
            case 'tasks': return <TaskManager tasks={state.taskTemplates} roles={state.roles} teams={state.teams} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} />;
            case 'stats': return <StatsDashboard people={state.people} shifts={state.shifts} tasks={state.taskTemplates} roles={state.roles} teams={state.teams} teamRotations={state.teamRotations} isViewer={!checkAccess('stats', 'edit')} currentUserEmail={profile?.email} currentUserName={profile?.full_name} />;
            case 'settings': return <OrganizationSettingsComponent organizationId={organization?.id || ''} teams={state.teams} />;



            case 'logs': return <AdminLogsViewer />;
            case 'lottery': return <Lottery people={state.people} teams={state.teams} roles={state.roles} />;
            case 'constraints': return <ConstraintsManager people={state.people} teams={state.teams} roles={state.roles} tasks={state.taskTemplates} constraints={state.constraints} onAddConstraint={handleAddConstraint} onDeleteConstraint={handleDeleteConstraint} isViewer={!checkAccess('constraints', 'edit')} organizationId={organization?.id || ''} />;
            case 'contact': return <ContactPage />;
            case 'tickets': return <SystemManagementPage />; // Redirect legacy tickets route
            case 'system': return <SystemManagementPage />; // NEW
            case 'equipment':
                return <EquipmentManager
                    people={state.people}
                    teams={state.teams}
                    equipment={state.equipment}
                    onAddEquipment={handleAddEquipment}
                    onUpdateEquipment={handleUpdateEquipment}
                    onDeleteEquipment={handleDeleteEquipment}
                />;
            case 'absences':
                return checkAccess('attendance') ? (
                    <AbsenceManager
                        people={state.people}
                        absences={state.absences}
                        onAddAbsence={handleAddAbsence}
                        onUpdateAbsence={handleUpdateAbsence}
                        onDeleteAbsence={handleDeleteAbsence}
                    />
                ) : <Navigate to="/" />;
            case 'planner':
                return <Navigate to="/dashboard" />; // Deprecated
            case 'home':
            default:
                return (
                    <div className="space-y-6">
                        {checkAccess('dashboard', 'edit') && (
                            state.taskTemplates.length === 0 && state.people.length === 0 && state.roles.length === 0 ? (
                                <EmptyStateGuide
                                    hasTasks={state.taskTemplates.length > 0}
                                    hasPeople={state.people.length > 0}
                                    hasRoles={state.roles.length > 0}
                                    onNavigate={setView}
                                    onImport={() => {
                                        localStorage.setItem('open_import_wizard', 'true');
                                        setView('personnel');
                                    }}
                                />
                            ) : (
                                <>
                                    {state.taskTemplates.length > 0 && (
                                        <div className="fixed bottom-20 md:bottom-8 left-4 md:left-8 z-50">
                                            <button onClick={() => setShowScheduleModal(true)} className="bg-blue-600 text-white p-3 md:px-5 md:py-3 rounded-full shadow-xl flex items-center justify-center gap-0 md:gap-2 font-bold hover:scale-105 transition-all">
                                                <Sparkles size={20} className="md:w-5 md:h-5" />
                                                <span className="hidden md:inline whitespace-nowrap text-base">שיבוץ אוטומטי</span>
                                            </button>
                                        </div>
                                    )}
                                    <ScheduleBoard
                                        shifts={state.shifts}
                                        people={state.people}
                                        taskTemplates={state.taskTemplates}
                                        roles={state.roles}
                                        teams={state.teams}
                                        constraints={state.constraints}
                                        selectedDate={selectedDate}
                                        onDateChange={setSelectedDate}
                                        onSelect={() => { }}
                                        onDelete={handleDeleteShift}
                                        isViewer={false}
                                        onClearDay={handleClearDay}
                                        onNavigate={handleNavigate}
                                        onAssign={handleAssign}
                                        onUnassign={handleUnassign}
                                        onAddShift={handleAddShift}
                                        onUpdateShift={handleUpdateShift}
                                        onToggleCancelShift={handleToggleCancelShift}
                                        teamRotations={state.teamRotations}
                                    />
                                </>
                            )
                        )}
                        <AutoScheduleModal
                            isOpen={showScheduleModal}
                            onClose={() => setShowScheduleModal(false)}
                            onSchedule={handleAutoSchedule}
                            tasks={state.taskTemplates}
                            people={state.people}
                            roles={state.roles}
                            startDate={scheduleStartDate}
                            endDate={scheduleEndDate}
                        />
                    </div >
                );
        }

    };

    useEffect(() => { initGA(); }, []);
    useEffect(() => { if (view) { trackPageView(`/${view}`); logger.logView(view); } }, [view]);
    usePageTracking(view);

    const hasSkippedLinking = localStorage.getItem('miuim_skip_linking') === 'true';
    if (!isLinkedToPerson && state.people.length > 0 && !hasSkippedLinking) return <ClaimProfile />;

    return (
        <Layout currentView={view} setView={setView}>
            <React.Suspense fallback={<div className="flex justify-center items-center h-[60vh]"><Loader2 className="animate-spin text-blue-500" /></div>}>
                {renderContent()}
            </React.Suspense>
        </Layout>
    );
};

// --- App Wrapper with Auth Logic ---
const AppContent: React.FC = () => {
    const { user, profile, organization, loading } = useAuth();
    const [isProcessingInvite, setIsProcessingInvite] = useState(true);

    // Check for pending invite after login
    // Check for pending invite and terms acceptance after login
    useEffect(() => {
        const checkPendingInvite = async () => {
            const pendingToken = localStorage.getItem('pending_invite_token');
            console.log('🔍 [App] Checking pending invite. User:', user?.id, 'Token:', pendingToken);

            if (user && pendingToken) {
                console.log('🚀 [App] Found pending invite token, executing join logic...');
                try {
                    console.log('📡 [App] Calling join_organization_by_token RPC...');
                    const { data, error } = await supabase.rpc('join_organization_by_token', { token: pendingToken });

                    console.log('✅ [App] RPC Result:', { data, error });

                    if (error) throw error;

                    if (data) {
                        console.log('🎉 [App] Join successful! Clearing token and refreshing profile.');
                        localStorage.removeItem('pending_invite_token');
                        // Force reload to ensure fresh state and avoid race conditions
                        window.location.reload();
                        return;
                    } else {
                        console.warn('⚠️ [App] Join returned false (likely invalid token or already member).');
                    }
                } catch (error) {
                    console.error('❌ [App] Error joining org from pending token:', error);
                    localStorage.removeItem('pending_invite_token');
                    console.log('🏁 [App] Finished processing invite.');
                    setIsProcessingInvite(false);
                }
            } else {
                console.log('ℹ️ [App] No pending invite or no user. Skipping.');
                setIsProcessingInvite(false);
            }
        };

        const checkTerms = async () => {
            const timestamp = localStorage.getItem('terms_accepted_timestamp');
            if (user && timestamp) {
                console.log("📝 App: Saving terms acceptance...", timestamp);
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
    }, [user, loading]);

    // Safety timeout for invite processing
    useEffect(() => {
        if (isProcessingInvite) {
            const timer = setTimeout(() => {
                console.warn('Invite processing timed out, forcing reset.');
                setIsProcessingInvite(false);
            }, 10000); // 10 seconds max
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
            <Routes>
                <Route path="/join/:token" element={<JoinPage />} />
                <Route path="*" element={<MainRoute user={user} profile={profile} organization={organization} />} />
            </Routes>
        </ErrorBoundary>
    );
};

// Helper component for main route logic
const MainRoute: React.FC<{ user: any, profile: any, organization: any }> = ({ user, profile, organization }) => {
    // If user exists but NO profile → Show Onboarding
    if (user && !profile) {
        return <Onboarding />;
    }

    // If not logged in → Show Landing Page
    if (!user) {
        return <LandingPage />;
    }

    // If profile has organization_id but organization is not loaded yet -> Show Loading
    if (profile?.organization_id && !organization) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-slate-600 font-medium">
                        טוען נתוני ארגון...
                    </p>
                </div>
            </div>
        );
    }

    // If profile exists but NO organization → Show Create Organization
    if (profile && !organization) {
        return <Onboarding />;
    }

    // User is logged in, has profile, and has organization → Show Main App
    return <MainApp />;
};



const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <ToastProvider>
                    <AppContent />
                </ToastProvider>
            </AuthProvider>
        </Router>
    );
};

export default App;

