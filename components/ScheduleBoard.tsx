
import React, { useState, useMemo } from 'react';
import { Shift, Person, TaskTemplate, Role, Team } from '../types';
import { generateAssignmentExplanation } from '../services/geminiService';
import { ChevronLeft, ChevronRight, Plus, X, Check, BrainCircuit, AlertTriangle, Sparkles, Clock, User, MapPin, Calendar as CalendarIcon, Pencil, Save, Trash2 } from 'lucide-react';

interface ScheduleBoardProps {
  shifts: Shift[];
  people: Person[];
  tasks: TaskTemplate[];
  roles: Role[];
  teams: Team[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onAssign: (shiftId: string, personId: string) => void;
  onUnassign: (shiftId: string, personId: string) => void;
  onAddShift: (task: TaskTemplate, start: Date) => void;
  onUpdateShift: (shift: Shift) => void;
  onDeleteShift: (shiftId: string) => void;
  onClearDay: () => void;
}

// Helper component for Shift Card
const ShiftCard: React.FC<{
  shift: Shift;
  compact?: boolean;
  tasks: TaskTemplate[];
  people: Person[];
  onSelect: (shift: Shift) => void;
  onDelete: (shiftId: string) => void;
}> = ({ shift, compact = false, tasks, people, onSelect, onDelete }) => {
  const task = tasks.find(t => t.id === shift.taskId);
  if (!task) return null;
  const isFull = shift.assignedPersonIds.length >= task.requiredPeople;
  
  const assigned = shift.assignedPersonIds
    .map(id => people.find(p => p.id === id))
    .filter(Boolean) as Person[];
  
  return (
    <div 
        onClick={() => onSelect(shift)}
        className={`bg-white p-3 rounded-xl shadow-sm border border-slate-100 cursor-pointer hover:shadow-md transition-all mb-3 group relative overflow-hidden`}
    >
        {/* Color Indicator Strip */}
        <div className={`absolute top-0 right-0 w-1 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>
        
        {/* Delete Action (Visible on Hover) - NO CONFIRM */}
        <button 
            onClick={(e) => {
                e.stopPropagation();
                onDelete(shift.id);
            }}
            className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full bg-white/80 transition-all z-20"
        >
            <Trash2 size={14} />
        </button>

        <div className="flex justify-between items-start mb-2 pr-2">
            <div>
                <div className="font-bold text-sm text-slate-800 leading-tight">{task.name}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                   <Clock size={10}/>
                   <span dir="ltr" className="flex items-center gap-1">
                       {new Date(shift.startTime).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}
                       <span>-</span>
                       {new Date(shift.endTime).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}
                   </span>
                </div>
            </div>
            {isFull 
                ? <div className="bg-green-50 text-green-600 p-1 rounded-full"><Check size={12} /></div> 
                : <div className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md">
                    {shift.assignedPersonIds.length}/{task.requiredPeople}
                  </div>
            }
        </div>

        <div className="space-y-1.5 pr-2">
            {assigned.length === 0 ? (
                 <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-50 p-1.5 rounded-lg border border-slate-100 border-dashed">
                     <User size={12} />
                     <span>טרם שובצו</span>
                 </div>
            ) : (
                assigned.map(p => (
                    <div key={p.id} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm ${p.color}`}>
                            {p.name.charAt(0)}
                        </div>
                        <span className="text-xs text-slate-700 font-bold truncate">{p.name}</span>
                    </div>
                ))
            )}
             {/* Warning if understaffed and has assignments but not enough */}
             {(!isFull && assigned.length > 0) && (
                 <div className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
                     <AlertTriangle size={10}/>
                     <span>חסרים {task.requiredPeople - assigned.length}</span>
                 </div>
             )}
        </div>
    </div>
  );
};

export const ScheduleBoard: React.FC<ScheduleBoardProps> = ({
  shifts,
  people,
  tasks,
  roles,
  teams,
  selectedDate,
  onDateChange,
  onAssign,
  onUnassign,
  onAddShift,
  onUpdateShift,
  onDeleteShift,
  onClearDay
}) => {
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleExplain = async (shift: Shift, person: Person) => {
    setLoadingAi(true);
    setAiExplanation(null);
    const task = tasks.find(t => t.id === shift.taskId);
    if (task) {
      const explanation = await generateAssignmentExplanation(shift, person, task, people, roles);
      setAiExplanation(explanation);
    }
    setLoadingAi(false);
  };

  // Portal Style Card for "Current/Next" Shift
  const renderFeaturedCard = () => {
    const now = new Date();
    const upcoming = shifts.find(s => new Date(s.startTime) > now);
    if (!upcoming) return null;
    const task = tasks.find(t => t.id === upcoming.taskId);
    if (!task) return null;

    const isAssigned = upcoming.assignedPersonIds.length >= task.requiredPeople;

    return (
      <div className="bg-white rounded-xl shadow-portal p-0 overflow-hidden mb-8">
          <div className="flex flex-col md:flex-row">
              <div className="p-6 md:p-8 flex-1">
                  <div className="flex items-center gap-2 mb-3">
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                          <Clock size={12} /> משמרת קרובה
                      </span>
                      <span className="text-green-600 text-sm font-bold flex items-center gap-1">
                          <Check size={14} /> {isAssigned ? 'מאוישת' : 'נדרש איוש'}
                      </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">{task.name}</h2>
                  <div className="flex flex-wrap gap-4 text-slate-500 text-sm mb-6">
                      <div className="flex items-center gap-1.5">
                          <CalendarIcon size={16} />
                          <span>{new Date(upcoming.startTime).toLocaleDateString('he-IL')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <Clock size={16} />
                          <span dir="ltr">
                            {new Date(upcoming.startTime).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})} - {new Date(upcoming.endTime).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}
                          </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                          <MapPin size={16} />
                          <span>מחנה נחשונים</span>
                      </div>
                  </div>
                  <div className="flex gap-3">
                      <button 
                        onClick={() => setSelectedShift(upcoming)}
                        className="bg-idf-yellow hover:bg-idf-yellow-hover text-slate-900 px-6 py-2.5 rounded-full font-bold shadow-sm transition-colors"
                      >
                          נהל משמרת
                      </button>
                      <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-full font-bold transition-colors">
                          בקשות מיוחדות
                      </button>
                  </div>
              </div>
              <div className="bg-slate-50 p-6 md:w-72 border-r border-slate-100 flex flex-col justify-center">
                  <h4 className="font-bold text-slate-700 mb-3">צוות משובץ:</h4>
                  <div className="flex -space-x-3 space-x-reverse">
                      {upcoming.assignedPersonIds.length === 0 && <span className="text-slate-400 text-sm">טרם שובצו</span>}
                      {upcoming.assignedPersonIds.map(pid => {
                          const p = people.find(x => x.id === pid);
                          return p ? (
                             <div key={pid} title={p.name} className={`w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-white font-bold shadow-sm ${p.color}`}>
                                {p.name.charAt(0)}
                             </div>
                          ) : null;
                      })}
                  </div>
                  {upcoming.assignedPersonIds.length < task.requiredPeople && (
                      <div className="mt-3 text-xs text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={12} />
                          חסרים {task.requiredPeople - upcoming.assignedPersonIds.length} לוחמים
                      </div>
                  )}
              </div>
          </div>
      </div>
    );
  };

  const Modal = () => {
    if (!selectedShift) return null;
    const task = tasks.find(t => t.id === selectedShift.taskId);
    if (!task) return null;
    
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [newStart, setNewStart] = useState(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}));
    const [newEnd, setNewEnd] = useState(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'}));

    const assignedPeople = selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
    const availablePeople = people.filter(p => !selectedShift.assignedPersonIds.includes(p.id));

    const handleSaveTime = () => {
        const [sh, sm] = newStart.split(':').map(Number);
        const [eh, em] = newEnd.split(':').map(Number);
        
        const s = new Date(selectedShift.startTime);
        s.setHours(sh, sm);
        const e = new Date(selectedShift.endTime);
        e.setHours(eh, em);
        
        if (e.getTime() < s.getTime()) {
             e.setDate(e.getDate() + 1);
        } else if (e.getDate() !== s.getDate()) {
             const diff = new Date(selectedShift.endTime).getDate() - new Date(selectedShift.startTime).getDate();
             if(diff > 0) e.setDate(s.getDate() + diff);
             else e.setDate(s.getDate());
        }

        onUpdateShift({
            ...selectedShift,
            startTime: s.toISOString(),
            endTime: e.toISOString()
        });
        setIsEditingTime(false);
    };

    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
             <div>
                <h3 className="text-xl font-bold text-slate-900">{task.name} - ניהול שיבוץ</h3>
                <div className="flex items-center gap-2 mt-0.5">
                    {!isEditingTime ? (
                        <div className="flex items-center gap-2">
                            <p className="text-slate-500 text-sm flex items-center gap-2">
                                {new Date(selectedShift.startTime).toLocaleDateString('he-IL')}
                                <span className="text-slate-300">|</span>
                                <span dir="ltr">
                                    {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})} - {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', {hour:'2-digit', minute:'2-digit'})}
                                </span>
                            </p>
                            <button onClick={() => setIsEditingTime(true)} className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded-full transition-colors" title="ערוך שעות">
                                <Pencil size={12} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 animate-fadeIn">
                             <input 
                                type="time" 
                                value={newStart} 
                                onChange={e => setNewStart(e.target.value)}
                                className="text-sm p-1 rounded border border-slate-300"
                             />
                             <span>-</span>
                             <input 
                                type="time" 
                                value={newEnd} 
                                onChange={e => setNewEnd(e.target.value)}
                                className="text-sm p-1 rounded border border-slate-300"
                             />
                             <button onClick={handleSaveTime} className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded-full transition-colors"><Save size={14}/></button>
                             <button onClick={() => setIsEditingTime(false)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-full transition-colors"><X size={14}/></button>
                        </div>
                    )}
                </div>
             </div>
             <div className="flex items-center gap-2">
                 <button 
                    onClick={() => {
                        // NO CONFIRM
                        onDeleteShift(selectedShift.id);
                        setSelectedShift(null);
                    }}
                    className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors"
                    title="מחק משמרת"
                 >
                    <Trash2 size={20} />
                 </button>
                 <button onClick={() => setSelectedShift(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                     <X size={24} />
                 </button>
             </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col md:flex-row bg-white">
             <div className="flex-1 p-6 overflow-y-auto border-l border-slate-100">
                <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">משובצים ({assignedPeople.length}/{task.requiredPeople})</h4>
                <div className="space-y-3">
                    {assignedPeople.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-xl">
                             <div className="flex items-center gap-3">
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${p.color}`}>{p.name.charAt(0)}</div>
                                 <span className="font-bold text-slate-800 text-sm">{p.name}</span>
                             </div>
                             <div className="flex items-center gap-1">
                                 <button onClick={() => handleExplain(selectedShift, p)} className="text-purple-600 p-1.5 hover:bg-purple-100 rounded-lg" title="AI Explain"><Sparkles size={16}/></button>
                                 <button onClick={() => onUnassign(selectedShift.id, p.id)} className="text-red-500 p-1.5 hover:bg-red-100 rounded-lg"><X size={16}/></button>
                             </div>
                        </div>
                    ))}
                    {assignedPeople.length === 0 && <p className="text-slate-400 text-sm text-center py-4">לא שובצו לוחמים</p>}
                </div>
                
                {(loadingAi || aiExplanation) && (
                    <div className="mt-6 p-4 bg-purple-50 rounded-xl border border-purple-100 text-sm">
                         {loadingAi ? <div className="flex items-center gap-2 text-purple-700"><BrainCircuit className="animate-spin" size={16}/> מעבד נתונים...</div> : 
                         <div className="text-slate-700"><span className="font-bold text-purple-800 block mb-1">ניתוח AI:</span>{aiExplanation}</div>}
                    </div>
                )}
             </div>
             
             <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
                 <h4 className="font-bold text-slate-800 mb-4 text-sm uppercase tracking-wider">מאגר זמין</h4>
                 <div className="space-y-2">
                     {availablePeople.map(p => {
                         const hasRole = task.requiredRoleIds.length === 0 || task.requiredRoleIds.some(req => p.roleIds.includes(req));
                         return (
                            <div key={p.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${hasRole ? 'bg-white border-slate-200 hover:border-blue-300' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${p.color}`}>{p.name.charAt(0)}</div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-700 text-sm">{p.name}</span>
                                        {!hasRole && <span className="text-[10px] text-red-500">אין התאמה</span>}
                                    </div>
                                </div>
                                <button onClick={() => onAssign(selectedShift.id, p.id)} disabled={!hasRole} className={`px-3 py-1 rounded-full text-xs font-bold ${hasRole ? 'bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover' : 'bg-slate-200 text-slate-400'}`}>שבץ</button>
                            </div>
                         );
                     })}
                 </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper to filter visible tasks for the daily view
  const visibleTasks = useMemo(() => {
      // Use local date string (YYYY-MM-DD) for accurate daily matching
      const dateKey = selectedDate.toLocaleDateString('en-CA');
      return tasks.filter(task => {
          if (task.schedulingType === 'one-time' && task.specificDate) {
              return task.specificDate === dateKey;
          }
          return true;
      });
  }, [tasks, selectedDate]);

  return (
    <div className="flex flex-col gap-8">
      {renderFeaturedCard()}
      {selectedShift && <Modal />}

      {/* Calendar Board Container */}
      <div className="bg-white rounded-xl shadow-portal p-6">
          
          {/* Controls Header */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
             <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-slate-800">
                   מבט יומי
                </h3>
             </div>

             <div className="flex items-center gap-2">
                 <button 
                    onClick={onClearDay}
                    className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-full font-bold text-sm transition-colors"
                 >
                    <Trash2 size={16} />
                    נקה יום
                 </button>
                 
                 <div className="flex items-center bg-slate-100 rounded-full p-1">
                     <button onClick={() => {
                         const d = new Date(selectedDate);
                         d.setDate(d.getDate() + 1);
                         onDateChange(d);
                     }} className="p-2 hover:bg-white rounded-full shadow-sm transition-all"><ChevronRight size={16}/></button>
                     
                     <span className="px-4 text-sm font-bold text-slate-600 min-w-[140px] text-center">
                         {selectedDate.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
                     </span>
                     
                     <button onClick={() => {
                         const d = new Date(selectedDate);
                         d.setDate(d.getDate() - 1);
                         onDateChange(d);
                     }} className="p-2 hover:bg-white rounded-full shadow-sm transition-all"><ChevronLeft size={16}/></button>
                 </div>
             </div>
          </div>
          
          <div className="overflow-x-auto pb-4">
             {/* DAILY VIEW COLUMNS (KANBAN) */}
             <div className="flex gap-4 min-w-[1000px]">
                 {visibleTasks.length > 0 ? visibleTasks.map(task => {
                     // Safe filter for local dates
                     const dateKey = selectedDate.toLocaleDateString('en-CA');
                     const taskShifts = shifts.filter(s => {
                         if (s.taskId !== task.id) return false;
                         // Check if shift starts on this local date
                         const shiftDate = new Date(s.startTime).toLocaleDateString('en-CA');
                         return shiftDate === dateKey;
                     }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                     return (
                         <div key={task.id} className="flex-1 min-w-[250px] bg-slate-50 rounded-xl p-3">
                             <div className={`border-b-2 pb-2 mb-3 ${task.color.replace('border-l-', 'border-')}`}>
                                 <h4 className="font-bold text-slate-800">{task.name}</h4>
                                 <div className="flex justify-between text-xs text-slate-500 mt-1">
                                     <span>{task.schedulingType === 'continuous' ? '24/7 רציף' : 'משימה בודדת'}</span>
                                     <span>{taskShifts.length} משמרות</span>
                                 </div>
                             </div>
                             <div className="space-y-2">
                                 {taskShifts.map(shift => <ShiftCard key={shift.id} shift={shift} tasks={tasks} people={people} onSelect={setSelectedShift} onDelete={onDeleteShift} />)}
                                 {taskShifts.length === 0 && <div className="text-center py-10 text-slate-400 text-sm italic">אין משמרות ליום זה</div>}
                             </div>
                         </div>
                     );
                 }) : <div className="w-full text-center py-20 text-slate-400 font-medium">אין משימות המוגדרות לתאריך זה</div>}
             </div>
          </div>
      </div>
    </div>
  );
};
