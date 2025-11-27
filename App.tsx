import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ScheduleBoard } from './components/ScheduleBoard';
import { TaskManager } from './components/TaskManager';
import { StatsDashboard } from './components/StatsDashboard';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { Onboarding } from './components/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useToast } from './contexts/ToastContext';
import { Person, Shift, TaskTemplate, Role, Team } from './types';
import { supabase } from './services/supabaseClient';
import {
    mapShiftFromDB, mapShiftToDB,
    mapPersonFromDB, mapPersonToDB,
    mapTeamFromDB, mapTeamToDB,
    mapRoleFromDB, mapRoleToDB,
    mapTaskFromDB, mapTaskToDB
} from './services/supabaseClient';
import { solveSchedule } from './services/scheduler';
import { fetchUserHistory, calculateHistoricalLoad } from './services/historyService';
import { Wand2, Loader2, Sparkles } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsForTask } from './utils/shiftUtils';
import { PersonnelManager } from './components/PersonnelManager';
import { AttendanceManager } from './components/AttendanceManager';
import { OrganizationSettings } from './components/OrganizationSettings';
import { ShiftReport } from './components/ShiftReport';
import { logger } from './services/loggingService';
import { AdminLogsViewer } from './components/AdminLogsViewer';
import JoinPage from './components/JoinPage';
import { initGA, trackPageView } from './services/analytics';
import { usePageTracking } from './hooks/usePageTracking';

import { ClaimProfile } from './components/ClaimProfile';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AutoScheduleModal } from './components/AutoScheduleModal';
import { Lottery } from './components/Lottery';
import { ToastProvider } from './contexts/ToastContext';

// --- Main App Content (Authenticated) ---
// Track view changes
const MainApp: React.FC = () => {
    const { organization, user, profile } = useAuth();
    const { showToast } = useToast();
    const [view, setView] = useState<'dashboard' | 'personnel' | 'attendance' | 'tasks' | 'stats' | 'settings' | 'reports' | 'logs'>('dashboard');
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
    }>({
        people: [],
        shifts: [],
        taskTemplates: [],
        roles: [],
        teams: []
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organization]);

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

            setState({
                people: (peopleData || []).map(mapPersonFromDB),
                shifts: (shiftsData || []).map(mapShiftFromDB),
                taskTemplates: (tasksData || []).map(mapTaskFromDB),
                roles: (rolesData || []).map(mapRoleFromDB),
                teams: (teamsData || []).map(mapTeamFromDB)
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
        try {
            await supabase.from('people').insert(mapPersonToDB(personWithOrg));
            setState(prev => ({ ...prev, people: [...prev.people, p] }));
            await logger.logCreate('person', p.id, p.name, p);
        } catch (e) {
            console.warn("DB Insert Failed", e);
            setState(prev => ({ ...prev, people: [...prev.people, p] }));
        }
    };

    const handleUpdatePerson = async (p: Person) => {
        try {
            await supabase.from('people').update(mapPersonToDB(p)).eq('id', p.id);
            await logger.logUpdate('person', p.id, p.name, state.people.find(person => person.id === p.id), p);
        } catch (e) { console.warn("DB Update Failed", e); }
        setState(prev => ({ ...prev, people: prev.people.map(person => person.id === p.id ? p : person) }));
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
            await supabase.from('task_templates').insert(mapTaskToDB({ ...t, organization_id: organization.id }));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const newShifts = generateShiftsForTask({ ...t, organization_id: organization.id }, today);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: organization.id }));
            if (shiftsWithOrg.length > 0) await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
            setState(prev => ({ ...prev, taskTemplates: [...prev.taskTemplates, t], shifts: [...prev.shifts, ...newShifts] }));
        } catch (e) { console.warn(e); setState(prev => ({ ...prev, taskTemplates: [...prev.taskTemplates, t] })); }
    };

    const handleUpdateTask = async (t: TaskTemplate) => {
        if (!organization) return;
        const oldTask = state.taskTemplates.find(task => task.id === t.id);
        let updatedShifts = state.shifts;
        const schedulingChanged = oldTask?.defaultStartTime !== t.defaultStartTime || oldTask?.durationHours !== t.durationHours || oldTask?.schedulingType !== t.schedulingType || oldTask?.specificDate !== t.specificDate;

        if (schedulingChanged) {
            updatedShifts = updatedShifts.filter(s => s.taskId !== t.id);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const newShifts = generateShiftsForTask(t, startOfWeek);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: organization.id }));
            try {
                await supabase.from('shifts').delete().eq('task_id', t.id).eq('organization_id', organization.id);
                if (shiftsWithOrg.length > 0) await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
            } catch (e) { console.warn(e); }
            setState(prev => ({ ...prev, taskTemplates: prev.taskTemplates.map(task => task.id === t.id ? t : task), shifts: [...updatedShifts, ...newShifts] }));
        } else {
            try { await supabase.from('task_templates').update(mapTaskToDB(t)).eq('id', t.id); } catch (e) { console.warn(e); }
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

    const handleAssign = async (shiftId: string, personId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        const newAssignments = [...shift.assignedPersonIds, personId];
        try {
            await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId);
            await logger.logAssign(shiftId, personId, state.people.find(p => p.id === personId)?.name || 'אדם');
        } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: prev.shifts.map(s => s.id === shiftId ? { ...s, assignedPersonIds: newAssignments } : s) }));
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
        try { await supabase.from('shifts').delete().eq('id', shiftId); } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: prev.shifts.filter(s => s.id !== shiftId) }));
    };

    const handleAddShift = async (task: TaskTemplate, date: Date) => {
        if (!organization) return;
        const start = new Date(date);
        if (task.defaultStartTime) {
            const [h, m] = task.defaultStartTime.split(':').map(Number);
            start.setHours(h, m, 0, 0);
        } else { start.setHours(12, 0, 0); }
        const end = new Date(start);
        end.setHours(start.getHours() + task.durationHours);
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
        switch (view) {
            case 'personnel': return <PersonnelManager people={state.people} teams={state.teams} roles={state.roles} onAddPerson={handleAddPerson} onDeletePerson={handleDeletePerson} onUpdatePerson={handleUpdatePerson} onAddTeam={handleAddTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam} onAddRole={handleAddRole} onDeleteRole={handleDeleteRole} onUpdateRole={handleUpdateRole} initialTab={personnelTab} />;
            case 'attendance': return <AttendanceManager people={state.people} teams={state.teams} onUpdatePerson={handleUpdatePerson} />;
            case 'tasks': return <TaskManager tasks={state.taskTemplates} roles={state.roles} onAddTask={handleAddTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} />;
            case 'stats': return <StatsDashboard people={state.people} shifts={state.shifts} tasks={state.taskTemplates} roles={state.roles} isViewer={profile?.role === 'viewer'} currentUserEmail={profile?.email} currentUserName={profile?.full_name} />;
            case 'settings': return <OrganizationSettings />;



            case 'reports': return <ShiftReport shifts={state.shifts} people={state.people} tasks={state.taskTemplates} roles={state.roles} teams={state.teams} />;
            case 'logs': return <AdminLogsViewer />;
            case 'lottery': return <Lottery people={state.people} teams={state.teams} roles={state.roles} />;
            default: return (
                <div className="space-y-6">
                    {profile?.role !== 'viewer' && (
                        <div className="fixed bottom-20 md:bottom-8 left-4 md:left-8 z-50">
                            <button onClick={() => setShowScheduleModal(true)} className="bg-blue-600 text-white p-3 md:px-5 md:py-3 rounded-full shadow-xl flex items-center justify-center gap-0 md:gap-2 font-bold hover:scale-105 transition-all">
                                <Sparkles size={20} className="md:w-5 md:h-5" />
                                <span className="hidden md:inline whitespace-nowrap text-base">שיבוץ אוטומטי</span>
                            </button>
                        </div>
                    )}
                    <AutoScheduleModal
                        isOpen={showScheduleModal}
                        onClose={() => setShowScheduleModal(false)}
                        onSchedule={handleAutoSchedule}
                        tasks={state.taskTemplates}
                        initialDate={selectedDate}
                        isScheduling={isScheduling}
                    />
                    <ScheduleBoard shifts={state.shifts} people={state.people} selectedDate={selectedDate} onDateChange={setSelectedDate} onAssign={handleAssign} onUnassign={handleUnassign} onAddShift={handleAddShift} onUpdateShift={handleUpdateShift} onDeleteShift={handleDeleteShift} onClearDay={handleClearDay} teams={state.teams} roles={state.roles} taskTemplates={state.taskTemplates} onNavigate={handleNavigate} />
                </div>
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
            {renderContent()}
        </Layout>
    );
};

// --- App Wrapper with Auth Logic ---
const AppContent: React.FC = () => {
    const { user, profile, organization, loading } = useAuth();
    const [isProcessingInvite, setIsProcessingInvite] = useState(true);

    // Check for pending invite after login
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

        if (!loading) {
            if (user) {
                checkPendingInvite();
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

