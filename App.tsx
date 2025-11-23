import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { ScheduleBoard } from './components/ScheduleBoard';
import { TaskManager } from './components/TaskManager';
import { StatsDashboard } from './components/StatsDashboard';
import { Login } from './components/Login';
import { LandingPage } from './components/LandingPage';
import { Onboarding } from './components/Onboarding';
import { AuthProvider, useAuth } from './contexts/AuthContext';
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
import { analyzeScheduleHealth } from './services/geminiService';
import { fetchUserHistory, calculateHistoricalLoad } from './services/historyService';
import { Wand2, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateShiftsForTask } from './utils/shiftUtils';
import { PersonnelManager } from './components/PersonnelManager';
import { AttendanceManager } from './components/AttendanceManager';
import { OrganizationSettings } from './components/OrganizationSettings';

// --- Main App Content (Authenticated) ---
const MainApp: React.FC = () => {
    const { organization, user, profile } = useAuth();
    const [view, setView] = useState<'dashboard' | 'personnel' | 'attendance' | 'tasks' | 'stats'>('dashboard');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [aiHealthMsg, setAiHealthMsg] = useState<string | null>(null);

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

    useEffect(() => {
        if (!organization) return;
        fetchData();

        // Realtime subscription
        const channel = supabase.channel('db-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'people', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `organization_id=eq.${organization.id}` }, () => fetchData())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [organization]);

    const fetchData = async () => {
        if (!organization) return;
        setIsLoading(true);

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
        setIsLoading(false);
    };

    // --- Person Handlers ---

    const handleAddPerson = async (p: Person) => {
        if (!organization) return;
        const personWithOrg = { ...p, organization_id: organization.id };
        try {
            const { error } = await supabase.from('people').insert(mapPersonToDB(personWithOrg));
            if (error) throw error;
            setState(prev => ({ ...prev, people: [...prev.people, p] }));
        } catch (e) {
            console.warn("DB Insert Failed, updating local only:", e);
            setState(prev => ({ ...prev, people: [...prev.people, p] }));
        }
    };

    const handleUpdatePerson = async (p: Person) => {
        try {
            const { error } = await supabase.from('people').update(mapPersonToDB(p)).eq('id', p.id);
            if (error) throw error;
        } catch (e) { console.warn("DB Update Failed", e); }

        setState(prev => ({
            ...prev,
            people: prev.people.map(person => person.id === p.id ? p : person)
        }));
    };

    const handleDeletePerson = async (id: string) => {
        try {
            await supabase.from('people').delete().eq('id', id);
        } catch (e) { console.warn("DB Delete Failed", e); }

        setState(prev => ({
            ...prev,
            people: prev.people.filter(p => p.id !== id),
            shifts: prev.shifts.map(s => ({
                ...s,
                assignedPersonIds: s.assignedPersonIds.filter(pid => pid !== id)
            }))
        }));
    };

    const handleAddTeam = async (t: Team) => {
        if (!organization) return;
        const teamWithOrg = { ...t, organization_id: organization.id };
        try {
            const { error } = await supabase.from('teams').insert(mapTeamToDB(teamWithOrg));
            if (error) throw error;
            setState(prev => ({ ...prev, teams: [...prev.teams, t] }));
        } catch (e) {
            console.warn("DB Insert Failed, updating local only:", e);
            setState(prev => ({ ...prev, teams: [...prev.teams, t] }));
        }
    };

    const handleUpdateTeam = async (t: Team) => {
        try {
            const { error } = await supabase.from('teams').update(mapTeamToDB(t)).eq('id', t.id);
            if (error) throw error;
        } catch (e) { console.warn("DB Update Failed, updating local only", e); }

        setState(prev => ({
            ...prev,
            teams: prev.teams.map(team => team.id === t.id ? t : team)
        }));
    };

    const handleDeleteTeam = async (id: string) => {
        try {
            await supabase.from('teams').delete().eq('id', id);
        } catch (e) { console.warn("DB Delete Failed", e); }
        setState(prev => ({ ...prev, teams: prev.teams.filter(t => t.id !== id) }));
    };

    const handleAddRole = async (r: Role) => {
        if (!organization) return;
        const roleWithOrg = { ...r, organization_id: organization.id };
        try {
            const { error } = await supabase.from('roles').insert(mapRoleToDB(roleWithOrg));
            if (error) throw error;
            setState(prev => ({ ...prev, roles: [...prev.roles, r] }));
        } catch (e) {
            console.warn("DB Insert Failed, updating local only:", e);
            setState(prev => ({ ...prev, roles: [...prev.roles, r] }));
        }
    };

    const handleUpdateRole = async (r: Role) => {
        try {
            const { error } = await supabase.from('roles').update(mapRoleToDB(r)).eq('id', r.id);
            if (error) throw error;
        } catch (e) { console.warn("DB Update Failed", e); }

        setState(prev => ({
            ...prev,
            roles: prev.roles.map(role => role.id === r.id ? r : role)
        }));
    };

    const handleDeleteRole = async (id: string) => {
        try {
            await supabase.from('roles').delete().eq('id', id);
        } catch (e) { console.warn("DB Delete Failed", e); }
        setState(prev => ({ ...prev, roles: prev.roles.filter(r => r.id !== id) }));
    };

    // --- Task Handlers ---

    const handleAddTask = async (t: TaskTemplate) => {
        if (!organization) return;
        const taskWithOrg = { ...t, organization_id: organization.id };
        console.log("Creating task:", taskWithOrg);

        try {
            const { error } = await supabase.from('task_templates').insert(mapTaskToDB(taskWithOrg));
            if (error) throw error;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Generate for the next 30 days starting today
            console.log("Generating shifts for task starting from:", today);
            const newShifts = generateShiftsForTask(taskWithOrg, today);
            const shiftsWithOrg = newShifts.map(s => ({ ...s, organization_id: organization.id }));

            console.log("Generated shifts:", shiftsWithOrg);

            if (shiftsWithOrg.length > 0) {
                const { error: shiftError } = await supabase.from('shifts').insert(shiftsWithOrg.map(mapShiftToDB));
                if (shiftError) {
                    console.error("Error inserting auto-generated shifts:", shiftError);
                    throw shiftError;
                }
            }

            setState(prev => ({
                ...prev,
                taskTemplates: [...prev.taskTemplates, t],
                shifts: [...prev.shifts, ...newShifts]
            }));
        } catch (e) {
            console.warn("DB Task Error, using local:", e);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - today.getDay());
            const newShifts = generateShiftsForTask(taskWithOrg, startOfWeek);
            setState(prev => ({
                ...prev,
                taskTemplates: [...prev.taskTemplates, t],
                shifts: [...prev.shifts, ...newShifts]
            }));
        }
    };

    const handleUpdateTask = async (t: TaskTemplate) => {
        if (!organization) return;
        const oldTask = state.taskTemplates.find(task => task.id === t.id);
        let updatedShifts = state.shifts;
        const schedulingChanged =
            oldTask?.defaultStartTime !== t.defaultStartTime ||
            oldTask?.durationHours !== t.durationHours ||
            oldTask?.schedulingType !== t.schedulingType ||
            oldTask?.specificDate !== t.specificDate;

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
        }

        try {
            await supabase.from('task_templates').update(mapTaskToDB(t)).eq('id', t.id);
        } catch (e) { console.warn(e); }

        setState(prev => ({
            ...prev,
            taskTemplates: prev.taskTemplates.map(task => task.id === t.id ? t : task),
            shifts: updatedShifts
        }));
    };

    const handleDeleteTask = async (id: string) => {
        if (!organization) return;
        try {
            await supabase.from('task_templates').delete().eq('id', id).eq('organization_id', organization.id);
            await supabase.from('shifts').delete().eq('task_id', id).eq('organization_id', organization.id);
        } catch (e) { console.warn(e); }
        setState(prev => ({
            ...prev,
            taskTemplates: prev.taskTemplates.filter(t => t.id !== id),
            shifts: prev.shifts.filter(s => s.taskId !== id)
        }));
    };

    // --- Shift Handlers ---

    const handleAssign = async (shiftId: string, personId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const newAssignments = [...shift.assignedPersonIds, personId];

        try {
            await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId);
        } catch (e) { console.warn(e); }

        setState(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => {
                if (s.id === shiftId) {
                    return { ...s, assignedPersonIds: newAssignments };
                }
                return s;
            })
        }));
    };

    const handleUnassign = async (shiftId: string, personId: string) => {
        const shift = state.shifts.find(s => s.id === shiftId);
        if (!shift) return;

        const newAssignments = shift.assignedPersonIds.filter(pid => pid !== personId);

        try {
            await supabase.from('shifts').update({ assigned_person_ids: newAssignments }).eq('id', shiftId);
        } catch (e) { console.warn(e); }

        setState(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => {
                if (s.id === shiftId) {
                    return { ...s, assignedPersonIds: newAssignments };
                }
                return s;
            })
        }));
    };

    const handleUpdateShift = async (updatedShift: Shift) => {
        try {
            await supabase.from('shifts').update(mapShiftToDB(updatedShift)).eq('id', updatedShift.id);
        } catch (e) { console.warn(e); }
        setState(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => s.id === updatedShift.id ? updatedShift : s)
        }));
    };

    const handleDeleteShift = async (shiftId: string) => {
        try {
            await supabase.from('shifts').delete().eq('id', shiftId);
        } catch (e) { console.warn(e); }
        setState(prev => ({
            ...prev,
            shifts: prev.shifts.filter(s => s.id !== shiftId)
        }));
    };

    const handleAddShift = async (task: TaskTemplate, date: Date) => {
        if (!organization) return;
        const start = new Date(date);
        if (task.defaultStartTime) {
            const [h, m] = task.defaultStartTime.split(':').map(Number);
            start.setHours(h, m, 0, 0);
        } else {
            start.setHours(12, 0, 0);
        }

        const end = new Date(start);
        end.setHours(start.getHours() + task.durationHours);
        const newShift: Shift = {
            id: uuidv4(),
            taskId: task.id,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            assignedPersonIds: [],
            isLocked: false,
            organization_id: organization.id
        };

        try {
            await supabase.from('shifts').insert(mapShiftToDB(newShift));
        } catch (e) { console.warn(e); }
        setState(prev => ({ ...prev, shifts: [...prev.shifts, newShift] }));
    };

    const handleAutoSchedule = async () => {
        if (!organization) return;
        // Define the specific 24-hour window for the selected date
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        // Run the solver ONLY for this specific day range
        // PRE-STEP: Clear existing assignments for this day to allow the "Big Rocks" algorithm to work on a clean slate

        // 1. Fetch History (Last 30 days)
        const historyShifts = await fetchUserHistory(startDate, 30);
        const historyScores = calculateHistoricalLoad(historyShifts, state.taskTemplates, state.people.map(p => p.id));

        const solvedShifts = solveSchedule(state, startDate, endDate, historyScores);

        // Ensure solved shifts have org id
        const shiftsToSave = solvedShifts.map(s => ({ ...s, organization_id: organization.id }));

        try {
            const updates = shiftsToSave.map(s => mapShiftToDB(s));
            await supabase.from('shifts').upsert(updates);
        } catch (e) { console.warn(e); }

        // Update state: Replace only the solved shifts in the state, keep others
        const solvedIds = shiftsToSave.map(s => s.id);
        setState(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => solvedIds.includes(s.id) ? shiftsToSave.find(sol => sol.id === s.id)! : s)
        }));

        const feedback = await analyzeScheduleHealth(shiftsToSave, state.people, state.taskTemplates);
        setAiHealthMsg(feedback);
    };

    const handleClearDay = async () => {
        if (!organization) return;
        // REMOVED WINDOW.CONFIRM due to sandbox blocking. Action is now immediate.
        // Using toLocaleDateString('en-CA') ensures strict YYYY-MM-DD matching regardless of timezones
        const selectedDateKey = selectedDate.toLocaleDateString('en-CA');

        // Identify shifts that START on this day
        const targetShifts = state.shifts.filter(s => {
            const shiftDateKey = new Date(s.startTime).toLocaleDateString('en-CA');
            return shiftDateKey === selectedDateKey;
        });

        if (targetShifts.length === 0) return;

        const ids = targetShifts.map(s => s.id);
        console.log("Clearing assignments for shifts:", ids);

        // DB Update: Set assigned_person_ids to empty array
        try {
            await supabase.from('shifts')
                .update({ assigned_person_ids: [] })
                .in('id', ids)
                .eq('organization_id', organization.id);
        } catch (e) { console.warn(e); }

        // Local State Update
        setState(prev => ({
            ...prev,
            shifts: prev.shifts.map(s => ids.includes(s.id) ? { ...s, assignedPersonIds: [] } : s)
        }));
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <Loader2 className="w-12 h-12 text-idf-yellow animate-spin mb-4" />
                    <p className="text-slate-500 font-medium">טוען נתונים...</p>
                </div>
            );
        }

        switch (view) {
            case 'personnel':
                return <PersonnelManager
                    people={state.people} teams={state.teams} roles={state.roles}
                    onAddPerson={handleAddPerson} onDeletePerson={handleDeletePerson} onUpdatePerson={handleUpdatePerson}
                    onAddTeam={handleAddTeam} onUpdateTeam={handleUpdateTeam} onDeleteTeam={handleDeleteTeam}
                    onAddRole={handleAddRole} onDeleteRole={handleDeleteRole} onUpdateRole={handleUpdateRole}
                />;
            case 'attendance':
                return <AttendanceManager people={state.people} teams={state.teams} onUpdatePerson={handleUpdatePerson} />;
            case 'tasks':
                return <TaskManager
                    tasks={state.taskTemplates}
                    roles={state.roles}
                    onAddTask={handleAddTask}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                />;
            case 'stats':
                return <StatsDashboard
                    people={state.people}
                    shifts={state.shifts}
                    tasks={state.taskTemplates}
                    roles={state.roles}
                    isViewer={profile?.role === 'viewer'}
                    currentUserEmail={profile?.email || user?.email}
                    currentUserName={profile?.full_name}
                />;
            case 'settings':
                return <OrganizationSettings />;
            case 'dashboard':
            default:
                return (
                    <div className="space-y-6">
                        {profile?.role !== 'viewer' && (
                            <div className="fixed bottom-8 left-8 z-50">
                                <button
                                    onClick={handleAutoSchedule}
                                    className="bg-[#82d682] hover:bg-[#6cc16c] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 transition-all hover:scale-105 font-bold"
                                >
                                    <Wand2 size={20} />
                                    <span>שיבוץ אוטומטי</span>
                                </button>
                            </div>
                        )}

                        {aiHealthMsg && (
                            <div className="bg-white border-r-4 border-idf-yellow p-6 rounded-xl shadow-portal animate-fadeIn flex gap-4 items-start mb-6">
                                <div className="bg-amber-100 p-2 rounded-full text-amber-600 mt-1"><Wand2 size={20} /></div>
                                <div>
                                    <h4 className="font-bold text-slate-800 text-lg">דוח אופטימיזציה AI</h4>
                                    <p className="text-slate-600 mt-2 leading-relaxed">{aiHealthMsg}</p>
                                </div>
                            </div>
                        )}

                        <ScheduleBoard
                            shifts={state.shifts}
                            people={state.people}
                            tasks={state.taskTemplates}
                            roles={state.roles}
                            teams={state.teams}
                            selectedDate={selectedDate} // Pass down controlled date
                            onDateChange={setSelectedDate} // Pass down handler
                            onAssign={handleAssign}
                            onUnassign={handleUnassign}
                            onAddShift={handleAddShift}
                            onUpdateShift={handleUpdateShift}
                            onDeleteShift={handleDeleteShift}
                            onClearDay={handleClearDay}
                        />
                    </div>
                );
        }
    };

    return (
        <Layout currentView={view} setView={setView}>
            {renderContent()}
        </Layout>
    );
};

// --- App Wrapper with Auth Logic ---
const AppContent: React.FC = () => {
    const { session, loading, organization } = useAuth();
    const [showLanding, setShowLanding] = useState(!session);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
                <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            </div>
        );
    }

    if (!session) {
        if (showLanding) {
            return <LandingPage onGetStarted={() => setShowLanding(false)} />;
        }
        return <Login onBack={() => setShowLanding(true)} />;
    }

    if (!organization) {
        return <Onboarding />;
    }

    return <MainApp />;
};

const App: React.FC = () => {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
};

export default App;
