
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
            <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm grid grid-cols-3 md:inline-flex gap-2 text-center md:text-right">
               <button
                  onClick={() => setReportType('manpower')}
                  className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${reportType === 'manpower'
                     ? 'bg-blue-600 text-white shadow-md'
                     : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                     }`}
               >
                  <Users size={18} />
                  <span className="md:hidden">כוח אדם</span>
                  <span className="hidden md:inline">דוחות כוח אדם</span>
               </button>
               <div className="w-px bg-slate-200 my-1 mx-1 hidden md:block"></div>
               <button
                  onClick={() => setReportType('tasks')}
                  className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${reportType === 'tasks'
                     ? 'bg-blue-600 text-white shadow-md'
                     : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                     }`}
               >
                  <ClipboardList size={18} />
                  <span className="md:hidden">שיבוץ</span>
                  <span className="hidden md:inline">דוחות שיבוץ משימות</span>
               </button>
               <div className="w-px bg-slate-200 my-1 mx-1 hidden md:block"></div>
               <button
                  onClick={() => setReportType('location')}
                  className={`flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition-all ${reportType === 'location'
                     ? 'bg-blue-600 text-white shadow-md'
                     : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                     }`}
               >
                  <MapPin size={18} />
                  <span className="md:hidden">מיקום</span>
                  <span className="hidden md:inline">דוח מיקום</span>
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
                  teams={teams}
               />
            )}
         </div>
      </div>
   );
};
