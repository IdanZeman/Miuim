
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { PersonnelManager } from './components/PersonnelManager';
import { TaskManager } from './components/TaskManager';
import { ScheduleBoard } from './components/ScheduleBoard';
import { StatsDashboard } from './components/StatsDashboard';
import { AttendanceManager } from './components/AttendanceManager';
import { ViewMode, AppState, Person, TaskTemplate, Shift, Team, Role } from './types';
import { solveSchedule } from './services/scheduler';
import { analyzeScheduleHealth } from './services/geminiService';
import { Wand2, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { INITIAL_STATE } from './constants';
import { 
    supabase, 
    mapPersonFromDB, mapPersonToDB, 
    mapTeamFromDB, mapTeamToDB,
    mapRoleFromDB, mapRoleToDB,
    mapTaskFromDB, mapTaskToDB,
    mapShiftFromDB, mapShiftToDB
} from './services/supabaseClient';

// Helper function to generate shifts for a specific task
const generateShiftsForTask = (task: TaskTemplate, baseDate: Date): Shift[] => {
    const newShifts: Shift[] = [];
    
    // 1. Handle Specific Date Tasks (One-time)
    if (task.schedulingType === 'one-time' && task.specificDate) {
        const [year, month, day] = task.specificDate.split('-').map(Number);
        const [h, m] = (task.defaultStartTime || '00:00').split(':').map(Number);
        
        const start = new Date(year, month - 1, day, h, m, 0, 0);
        const end = new Date(start);
        end.setHours(start.getHours() + task.durationHours);
        end.setMinutes(start.getMinutes());

        newShifts.push({
            id: uuidv4(),
            taskId: task.id,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            assignedPersonIds: [],
            isLocked: false
        });
        
        return newShifts;
    }

    // 2. Handle Continuous / Recurring Tasks
    const startDate = new Date(baseDate);
    startDate.setHours(0, 0, 0, 0);
    
    // Generate for 7 days window
    for(let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        if (task.schedulingType === 'continuous') {
            const [startH, startM] = (task.defaultStartTime || '00:00').split(':').map(Number);
            const anchor = new Date(currentDate);
            anchor.setHours(startH, startM, 0, 0);

            const potentialStarts: Date[] = [];
            potentialStarts.push(new Date(anchor));

            // Forward
            let next = new Date(anchor);
            while (true) {
                next.setHours(next.getHours() + task.durationHours);
                if (next.getDate() === currentDate.getDate()) {
                    potentialStarts.push(new Date(next));
                } else {
                    break;
                }
            }

            // Backward
            let prev = new Date(anchor);
            while (true) {
                prev.setHours(prev.getHours() - task.durationHours);
                if (prev.getDate() === currentDate.getDate()) {
                    potentialStarts.push(new Date(prev));
                } else {
                    break;
                }
            }

            potentialStarts.sort((a,b) => a.getTime() - b.getTime());

            potentialStarts.forEach(startTime => {
                const endTime = new Date(startTime);
                endTime.setHours(startTime.getHours() + task.durationHours);
                
                newShifts.push({
                    id: uuidv4(),
                    taskId: task.id,
                    startTime: startTime.toISOString(),
                    endTime: endTime.toISOString(),
                    assignedPersonIds: [],
                    isLocked: false
                });
            });

        } else {
            const start = new Date(currentDate);
            if (task.defaultStartTime) {
                const [h, m] = task.defaultStartTime.split(':').map(Number);
                start.setHours(h || 0, m || 0, 0, 0);
            } else {
                start.setHours(22, 0, 0, 0); 
            }
            
            const end = new Date(start);
            end.setHours(start.getHours() + task.durationHours);
            end.setMinutes(start.getMinutes());

            newShifts.push({
                id: uuidv4(),
                taskId: task.id,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
                assignedPersonIds: [],
                isLocked: false
            });
        }
    }
    return newShifts;
};

const App = () => {
  const [view, setView] = useState<ViewMode>('dashboard');
  const [state, setState] = useState<AppState>({
      people: [],
      teams: [],
      roles: [],
      taskTemplates: [],
      shifts: []
  });
  const [aiHealthMsg, setAiHealthMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Fetch Initial Data from Supabase (or Fallback to Mock)
  useEffect(() => {
      const fetchData = async () => {
          setIsLoading(true);
          try {
              const [rolesRes, teamsRes, peopleRes, tasksRes, shiftsRes] = await Promise.all([
                  supabase.from('roles').select('*'),
                  supabase.from('teams').select('*'),
                  supabase.from('people').select('*'),
                  supabase.from('task_templates').select('*'),
                  supabase.from('shifts').select('*')
              ]);

              if (rolesRes.error) throw rolesRes.error;
              if (teamsRes.error) throw teamsRes.error;
              if (peopleRes.error) throw peopleRes.error;
              if (tasksRes.error) throw tasksRes.error;
              if (shiftsRes.error) throw shiftsRes.error;

              setState({
                  roles: rolesRes.data.map(mapRoleFromDB),
                  teams: teamsRes.data.map(mapTeamFromDB),
                  people: peopleRes.data.map(mapPersonFromDB),
                  taskTemplates: tasksRes.data.map(mapTaskFromDB),
                  shifts: shiftsRes.data.map(mapShiftFromDB)
              });

          } catch (error) {
              console.warn("Supabase Error (Falling back to local data):", error);
              setState(INITIAL_STATE);
          } finally {
              setIsLoading(false);
          }
      };

      fetchData();
  }, []);

  // --- Personnel Handlers ---

  const handleAddPerson = async (p: Person) => {
    try {
        const { error } = await supabase.from('people').insert(mapPersonToDB(p));
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
      try {
          const { error } = await supabase.from('teams').insert(mapTeamToDB(t));
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
      try {
          const { error } = await supabase.from('roles').insert(mapRoleToDB(r));
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
      try {
          const { error } = await supabase.from('task_templates').insert(mapTaskToDB(t));
          if (error) throw error;

          const today = new Date();
          today.setHours(0,0,0,0);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          
          const newShifts = generateShiftsForTask(t, startOfWeek);
          
          if (newShifts.length > 0) {
              await supabase.from('shifts').insert(newShifts.map(mapShiftToDB));
          }

          setState(prev => ({ 
              ...prev, 
              taskTemplates: [...prev.taskTemplates, t],
              shifts: [...prev.shifts, ...newShifts]
          }));
      } catch (e) { 
          console.warn("DB Task Error, using local:", e);
          const today = new Date();
          today.setHours(0,0,0,0);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const newShifts = generateShiftsForTask(t, startOfWeek);
          setState(prev => ({ 
              ...prev, 
              taskTemplates: [...prev.taskTemplates, t],
              shifts: [...prev.shifts, ...newShifts]
          }));
      }
  };
  
  const handleUpdateTask = async (t: TaskTemplate) => {
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
          today.setHours(0,0,0,0);
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay());
          const newShifts = generateShiftsForTask(t, startOfWeek);
          updatedShifts = [...updatedShifts, ...newShifts];

          try {
            await supabase.from('shifts').delete().eq('task_id', t.id);
            if(newShifts.length > 0) await supabase.from('shifts').insert(newShifts.map(mapShiftToDB));
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
      try {
          await supabase.from('task_templates').delete().eq('id', id);
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
          isLocked: false
      };

      try {
          await supabase.from('shifts').insert(mapShiftToDB(newShift));
      } catch (e) { console.warn(e); }
      setState(prev => ({ ...prev, shifts: [...prev.shifts, newShift] }));
  };

  const handleAutoSchedule = async () => {
    // Define the specific 24-hour window for the selected date
    const startDate = new Date(selectedDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(selectedDate);
    endDate.setHours(23, 59, 59, 999);

    // Run the solver ONLY for this specific day range
    // PRE-STEP: Clear existing assignments for this day to allow the "Big Rocks" algorithm to work on a clean slate
    // This prevents it from fighting with partial assignments
    
    const solvedShifts = solveSchedule(state, startDate, endDate);
    
    try {
        const updates = solvedShifts.map(s => mapShiftToDB(s));
        await supabase.from('shifts').upsert(updates);
    } catch (e) { console.warn(e); }

    // Update state: Replace only the solved shifts in the state, keep others
    const solvedIds = solvedShifts.map(s => s.id);
    setState(prev => ({ 
        ...prev, 
        shifts: prev.shifts.map(s => solvedIds.includes(s.id) ? solvedShifts.find(sol => sol.id === s.id)! : s) 
    }));
    
    const feedback = await analyzeScheduleHealth(solvedShifts, state.people, state.taskTemplates);
    setAiHealthMsg(feedback);
  };

  const handleClearDay = async () => {
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
            .in('id', ids);
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
        return <StatsDashboard people={state.people} shifts={state.shifts} tasks={state.taskTemplates} />;
      case 'dashboard':
      default:
        return (
            <div className="space-y-6">
                <div className="fixed bottom-8 left-8 z-50">
                    <button 
                        onClick={handleAutoSchedule}
                        className="bg-[#82d682] hover:bg-[#6cc16c] text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 transition-all hover:scale-105 font-bold"
                    >
                        <Wand2 size={20} />
                        <span>שיבוץ אוטומטי</span>
                    </button>
                </div>

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

export default App;
