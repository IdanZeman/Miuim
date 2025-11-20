import React from 'react';
import { Person, Shift, TaskTemplate } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Activity, Users, CalendarCheck } from 'lucide-react';

interface StatsDashboardProps {
  people: Person[];
  shifts: Shift[];
  tasks: TaskTemplate[];
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ people, shifts, tasks }) => {
  
  const loadData = people.map(person => {
    const personShifts = shifts.filter(s => s.assignedPersonIds.includes(person.id));
    const totalHours = personShifts.reduce((acc, shift) => {
      const task = tasks.find(t => t.id === shift.taskId);
      return acc + (task?.durationHours || 0);
    }, 0);

    return {
      name: person.name.split(' ')[0],
      hours: totalHours,
      max: person.maxHoursPerWeek,
    };
  });

  const totalSlots = shifts.reduce((acc, s) => {
      const task = tasks.find(t => t.id === s.taskId);
      return acc + (task?.requiredPeople || 1);
  }, 0);
  const filledSlots = shifts.reduce((acc, s) => acc + s.assignedPersonIds.length, 0);
  
  const coverageData = [
    { name: 'מאויש', value: filledSlots, color: '#34d399' }, 
    { name: 'חסר', value: Math.max(0, totalSlots - filledSlots), color: '#fcd34d' }, 
  ];

  return (
    <div className="space-y-8">
       {/* Top Stats Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-portal p-6 flex items-center justify-between border-b-4 border-green-400">
             <div>
                 <p className="text-slate-500 font-medium text-sm mb-1">אחוז איוש כולל</p>
                 <h3 className="text-3xl font-bold text-slate-800">{Math.round((filledSlots / (totalSlots || 1)) * 100)}%</h3>
             </div>
             <div className="bg-green-50 p-3 rounded-full text-green-500"><Activity size={24}/></div>
          </div>
          <div className="bg-white rounded-xl shadow-portal p-6 flex items-center justify-between border-b-4 border-blue-400">
             <div>
                 <p className="text-slate-500 font-medium text-sm mb-1">כוח אדם זמין</p>
                 <h3 className="text-3xl font-bold text-slate-800">{people.length}</h3>
             </div>
             <div className="bg-blue-50 p-3 rounded-full text-blue-500"><Users size={24}/></div>
          </div>
          <div className="bg-white rounded-xl shadow-portal p-6 flex items-center justify-between border-b-4 border-purple-400">
             <div>
                 <p className="text-slate-500 font-medium text-sm mb-1">משמרות פעילות</p>
                 <h3 className="text-3xl font-bold text-slate-800">{shifts.length}</h3>
             </div>
             <div className="bg-purple-50 p-3 rounded-full text-purple-500"><CalendarCheck size={24}/></div>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-xl shadow-portal">
             <h3 className="text-lg font-bold text-slate-800 mb-6">עומס שעות שבועי</h3>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={loadData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}/>
                      <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} name="שעות בפועל" />
                      <Bar dataKey="max" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="תקרה" />
                   </BarChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-portal flex flex-col">
             <h3 className="text-lg font-bold text-slate-800 mb-6">סטטוס איוש</h3>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                        data={coverageData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {coverageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}} />
                   </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="flex justify-center gap-6 mt-4">
                 {coverageData.map(d => (
                     <div key={d.name} className="flex items-center gap-2">
                         <div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}}></div>
                         <span className="text-sm text-slate-600 font-bold">{d.name} ({d.value})</span>
                     </div>
                 ))}
             </div>
          </div>
       </div>
    </div>
  );
};