
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
   const [reportType, setReportType] = useState<ReportType>(isViewer ? 'tasks' : 'manpower');

   return (
      <div className="space-y-6">
         {/* Top Navigation - Segmented Control Style */}
         {!isViewer && (
            <div className="flex justify-center mb-6">
               <div className="bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200 shadow-sm flex w-full max-w-md">
                  <button
                     onClick={() => setReportType('manpower')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${reportType === 'manpower'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                  >
                     <Users size={18} />
                     <span>כוח אדם</span>
                  </button>
                  <button
                     onClick={() => setReportType('tasks')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${reportType === 'tasks'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                  >
                     <ClipboardList size={18} />
                     <span>שיבוץ</span>
                  </button>
                  <button
                     onClick={() => setReportType('location')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${reportType === 'location'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                  >
                     <MapPin size={18} />
                     <span>מיקום</span>
                  </button>
               </div>
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
