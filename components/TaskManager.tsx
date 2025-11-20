
import React, { useState } from 'react';
import { TaskTemplate, Role, SchedulingType } from '../types';
import { Clock, Users, AlertCircle, CheckSquare, Plus, Pencil, Trash2, X, Check, Repeat, Calendar } from 'lucide-react';

interface TaskManagerProps {
  tasks: TaskTemplate[];
  roles: Role[];
  onAddTask: (t: TaskTemplate) => void;
  onUpdateTask: (t: TaskTemplate) => void;
  onDeleteTask: (id: string) => void;
}

const COLORS = [
    'border-l-blue-500', 'border-l-red-500', 'border-l-green-500', 
    'border-l-yellow-500', 'border-l-purple-500', 'border-l-pink-500',
    'border-l-indigo-500', 'border-l-teal-500', 'border-l-orange-500'
];

export const TaskManager: React.FC<TaskManagerProps> = ({ 
    tasks, 
    roles, 
    onAddTask, 
    onUpdateTask, 
    onDeleteTask 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [duration, setDuration] = useState(4);
  const [requiredPeople, setRequiredPeople] = useState(2);
  const [minRest, setMinRest] = useState(8);
  const [difficulty, setDifficulty] = useState(3);
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [schedulingType, setSchedulingType] = useState<SchedulingType>('continuous');
  const [startTime, setStartTime] = useState('08:00');
  const [specificDate, setSpecificDate] = useState('');

  const resetForm = () => {
      setName('');
      setDuration(4);
      setRequiredPeople(2);
      setMinRest(8);
      setDifficulty(3);
      setSelectedRoleIds([]);
      setSelectedColor(COLORS[0]);
      setSchedulingType('continuous');
      setStartTime('08:00');
      setSpecificDate('');
      setIsEditing(false);
      setEditId(null);
  };

  const handleEditClick = (task: TaskTemplate) => {
      setName(task.name);
      setDuration(task.durationHours);
      setRequiredPeople(task.requiredPeople);
      setMinRest(task.minRestHoursBefore);
      setDifficulty(task.difficulty);
      setSelectedRoleIds(task.requiredRoleIds);
      setSelectedColor(task.color);
      setSchedulingType(task.schedulingType);
      setStartTime(task.defaultStartTime || '08:00');
      setSpecificDate(task.specificDate || '');
      setEditId(task.id);
      setIsEditing(true);
  };

  const handleSubmit = () => {
      if (!name) return;
      
      const taskData: TaskTemplate = {
          id: editId || `task-${Date.now()}`,
          name,
          durationHours: Number(duration),
          requiredPeople: Number(requiredPeople),
          minRestHoursBefore: Number(minRest),
          difficulty: Number(difficulty),
          requiredRoleIds: selectedRoleIds,
          color: selectedColor,
          schedulingType,
          defaultStartTime: startTime, // Always save start time (cycle start or event time)
          specificDate: (schedulingType === 'one-time' && specificDate) ? specificDate : undefined
      };

      if (editId) {
          onUpdateTask(taskData);
      } else {
          onAddTask(taskData);
      }
      resetForm();
  };

  const toggleRole = (id: string) => {
      if (selectedRoleIds.includes(id)) setSelectedRoleIds(prev => prev.filter(x => x !== id));
      else setSelectedRoleIds(prev => [...prev, id]);
  };

  return (
    <div className="bg-white rounded-xl shadow-portal p-6 min-h-[600px]">
       <div className="flex flex-col md:flex-row justify-between items-center mb-8 pb-4 border-b border-slate-100 gap-4">
        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <span className="bg-blue-50 p-2 rounded-lg text-blue-600"><CheckSquare size={24} /></span>
            בנק משימות
        </h2>
        {!isEditing && (
            <button onClick={() => setIsEditing(true)} className="bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover px-5 py-2.5 rounded-full font-bold shadow-sm text-sm flex items-center gap-2 transition-transform hover:scale-105">
                <Plus size={18} /> הוסף משימה
            </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isEditing && (
          <div className="mb-8 bg-slate-50 p-6 rounded-xl border border-slate-200 animate-fadeIn max-w-3xl mx-auto">
              <h3 className="font-bold text-slate-800 mb-4 text-lg border-b border-slate-200 pb-2">
                  {editId ? 'עריכת משימה' : 'הוספת משימה חדשה'}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">שם המשימה</label>
                      <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none" placeholder="לדוגמה: סיור בוקר" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">משך (שעות)</label>
                          <input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none" min="1" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">לוחמים נדרשים</label>
                          <input type="number" value={requiredPeople} onChange={e => setRequiredPeople(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none" min="1" />
                      </div>
                  </div>
                  
                  <div className="col-span-1 md:col-span-2">
                       <label className="block text-xs font-bold text-slate-500 mb-2">סוג תזמון</label>
                       <div className="flex flex-col sm:flex-row gap-4">
                           <div className="flex gap-2">
                               <button 
                                   onClick={() => setSchedulingType('continuous')}
                                   className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${schedulingType === 'continuous' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300 text-slate-600'}`}
                               >
                                   <Repeat size={16} />
                                   רציף (24/7)
                               </button>
                               <button 
                                   onClick={() => setSchedulingType('one-time')}
                                   className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${schedulingType === 'one-time' ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'bg-white border-slate-300 text-slate-600'}`}
                               >
                                   <Calendar size={16} />
                                   משימה בודדת
                               </button>
                           </div>
                           
                           <div className="flex-1 animate-fadeIn flex gap-2">
                               <div className="flex-1">
                                   <label className="block text-xs font-bold text-slate-500 mb-1">
                                       {schedulingType === 'continuous' ? 'שעת התחלת סבב' : 'שעת המשימה'}
                                   </label>
                                   <input 
                                       type="time" 
                                       value={startTime} 
                                       onChange={e => setStartTime(e.target.value)} 
                                       className="p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none w-full"
                                   />
                               </div>
                               {schedulingType === 'one-time' && (
                                   <div className="flex-1 animate-fadeIn">
                                       <label className="block text-xs font-bold text-slate-500 mb-1">תאריך (אופציונלי)</label>
                                       <input 
                                           type="date" 
                                           value={specificDate} 
                                           onChange={e => setSpecificDate(e.target.value)} 
                                           className="p-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none w-full"
                                       />
                                   </div>
                               )}
                           </div>
                       </div>
                       <p className="text-xs text-slate-400 mt-1">
                           {schedulingType === 'continuous' 
                             ? `המערכת תייצר סבב משמרות רציף שמתחיל ב-${startTime} וחוזר על עצמו.` 
                             : 'המשימה תשובץ בשעה שנבחרה. אם נבחר תאריך, השיבוץ יהיה חד פעמי לתאריך זה בלבד.'}
                       </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">מנוחה לפני (שעות)</label>
                          <input type="number" value={minRest} onChange={e => setMinRest(Number(e.target.value))} className="w-full p-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-idf-yellow outline-none" min="0" />
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">רמת קושי (1-5)</label>
                          <input type="range" value={difficulty} onChange={e => setDifficulty(Number(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-3 accent-idf-yellow" min="1" max="5" />
                          <div className="text-xs text-center text-slate-500 font-medium">{difficulty}</div>
                      </div>
                  </div>
                  <div>
                       <label className="block text-xs font-bold text-slate-500 mb-2">צבע מזהה</label>
                       <div className="flex gap-2">
                           {COLORS.map(c => (
                               <button 
                                 key={c} 
                                 onClick={() => setSelectedColor(c)}
                                 className={`w-6 h-6 rounded-full ${c.replace('border-l-', 'bg-')} ${selectedColor === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                               />
                           ))}
                       </div>
                  </div>
              </div>

              <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 mb-2">תפקידים נדרשים (אופציונלי)</label>
                  <div className="flex flex-wrap gap-2">
                      {roles.map(r => (
                          <button 
                              key={r.id} 
                              onClick={() => toggleRole(r.id)} 
                              className={`px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1 ${selectedRoleIds.includes(r.id) ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                          >
                              {r.name} {selectedRoleIds.includes(r.id) && <Check size={12} />}
                          </button>
                      ))}
                  </div>
              </div>

              <div className="flex justify-end gap-2">
                  <button onClick={() => { /* Swap logic implemented */ handleSubmit(); }} className="px-6 py-2 bg-idf-yellow text-slate-900 rounded-lg font-bold shadow-sm hover:bg-idf-yellow-hover transition-colors">
                      {editId ? 'עדכן משימה' : 'שמור משימה'}
                  </button>
                  <button onClick={resetForm} className="px-5 py-2 text-slate-500 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">ביטול</button>
              </div>
          </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {tasks.map(task => (
          <div key={task.id} className="bg-white rounded-xl p-6 border border-idf-card-border hover:shadow-md transition-all group relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-1.5 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>
            
            {/* Actions Overlay - NO CONFIRM */}
            <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEditClick(task)} className="p-2 bg-slate-100 hover:bg-blue-100 text-slate-500 hover:text-blue-600 rounded-full transition-colors">
                    <Pencil size={16} />
                </button>
                <button onClick={() => onDeleteTask(task.id)} className="p-2 bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 rounded-full transition-colors">
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex justify-between items-start mb-4 pr-4">
              <div>
                  <h3 className="text-xl font-bold text-slate-900">{task.name}</h3>
                  <div className="flex flex-col gap-1 mt-1">
                     {task.schedulingType === 'continuous' ? 
                         <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">
                             <Repeat size={10}/> 24/7 רציף (החל מ-{task.defaultStartTime})
                         </span> 
                         : 
                         <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Calendar size={10}/> {task.defaultStartTime ? `בשעה ${task.defaultStartTime}` : 'משימה בודדת'}</span>
                     }
                     {task.specificDate && (
                         <span className="bg-purple-100 text-purple-700 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Calendar size={10}/> {new Date(task.specificDate).toLocaleDateString('he-IL')} בלבד</span>
                     )}
                  </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                task.difficulty >= 4 ? 'bg-red-50 text-red-700' : 
                task.difficulty >= 2 ? 'bg-orange-50 text-orange-700' : 
                'bg-green-50 text-green-700'
              }`}>
                רמת קושי {task.difficulty}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 mb-6 pr-4">
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                <span className="font-medium">{task.durationHours} שעות</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={16} className="text-slate-400" />
                <span className="font-medium">{task.requiredPeople} לוחמים</span>
              </div>
              <div className="flex items-center gap-2 col-span-2 text-slate-500">
                <AlertCircle size={16} />
                <span>מנוחה נדרשת: {task.minRestHoursBefore} שעות</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 pr-4">
              <p className="text-xs font-bold text-slate-500 mb-3">תפקידים נדרשים:</p>
              <div className="flex flex-wrap gap-2">
                {task.requiredRoleIds.length > 0 ? task.requiredRoleIds.map(rid => {
                   const r = roles.find(role => role.id === rid);
                   return r ? (
                     <span key={rid} className="text-xs px-3 py-1 rounded-full border border-slate-200 font-medium text-slate-600 bg-slate-50">
                       {r.name}
                     </span>
                   ) : null;
                }) : <span className="text-xs text-slate-400 italic">אין דרישות מיוחדות</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
