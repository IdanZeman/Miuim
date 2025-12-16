
import React, { useState } from 'react';
import { Person, Shift, TaskTemplate, Role, Team } from '../types';
import { FileBarChart, Users, ClipboardList } from 'lucide-react';
import { LocationReport } from './LocationReport';
import { TaskReports } from './TaskReports';
import { ManpowerReports } from './ManpowerReports';
import { MapPin } from 'lucide-react';

interface StatsDashboardProps {
   people: Person[];
   shifts: Shift[];
   tasks: TaskTemplate[];
   roles: Role[];
   teams: Team[];
   teamRotations?: any[];
   isViewer?: boolean;
   currentUserEmail?: string;
   currentUserName?: string;
}

type ReportType = 'manpower' | 'tasks' | 'location';

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
   people, shifts, tasks, roles, teams, teamRotations = [],
   isViewer = false, currentUserEmail, currentUserName
}) => {
   const [reportType, setReportType] = useState<ReportType>('manpower');

   return (
      <div className="space-y-6">
         {/* Top Navigation / Report Type Switcher */}
         {!isViewer && (
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm inline-flex flex-wrap gap-2">
               <button
                  onClick={() => setReportType('manpower')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'manpower'
                     ? 'bg-blue-600 text-white shadow-md'
                     : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                     }`}
               >
                  <Users size={18} />
                  דוחות כוח אדם
               </button>
               <div className="w-px bg-slate-200 my-1 mx-1 hidden md:block"></div>
               <button
                  onClick={() => setReportType('tasks')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'tasks'
                     ? 'bg-blue-600 text-white shadow-md'
                     : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                     }`}
               >
                  <ClipboardList size={18} />
                  דוחות שיבוץ משימות
               </button>
               <div className="w-px bg-slate-200 my-1 mx-1 hidden md:block"></div>
               <button
                  onClick={() => setReportType('location')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${reportType === 'location'
                     ? 'bg-blue-600 text-white shadow-md'
                     : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                     }`}
               >
                  <MapPin size={18} />
                  דוח מיקום
               </button>
            </div>
         )}

         {/* Content Area */}
         <div className="min-h-[500px]">
            {reportType === 'manpower' && (
               <ManpowerReports
                  people={people}
                  teams={teams}
                  roles={roles}
               />
            )}

            {reportType === 'tasks' && (
               <TaskReports
                  people={people}
                  shifts={shifts}
                  tasks={tasks}
                  roles={roles}
                  isViewer={isViewer}
                  currentUserEmail={currentUserEmail}
                  currentUserName={currentUserName}
               />
            )}

            {reportType === 'location' && (
               <LocationReport
                  people={people}
                  shifts={shifts}
                  taskTemplates={tasks}
                  teamRotations={teamRotations}
               />
            )}
         </div>
      </div>
   );
};
