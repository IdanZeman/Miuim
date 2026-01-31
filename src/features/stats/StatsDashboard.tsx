import React, { useState } from 'react';
import { Person, Shift, TaskTemplate, Role, Team, OrganizationSettings, Absence, HourlyBlockage } from '../../types';
import { Users, ClipboardText as ClipboardList, MapPin, ChartBar as BarChart3, ListChecks, MagicWand as Wand, Warning, IdentificationCard } from '@phosphor-icons/react';
import { LocationReport } from './LocationReport';
import { TaskReports } from './TaskReports';
import { ManpowerReports } from './ManpowerReports';
import { CustomFieldsReport } from './CustomFieldsReport';
import { DailyAttendanceReport } from './DailyAttendanceReport';
import { ComplianceReport } from './ComplianceReport';
import { useAuth } from '../../features/auth/AuthContext';
import { PageInfo } from '../../components/ui/PageInfo';

interface StatsDashboardProps {
   people: Person[];
   shifts: Shift[];
   tasks: TaskTemplate[];
   roles: Role[];
   teams: Team[];
   teamRotations?: any[];
   absences?: Absence[];
   hourlyBlockages?: HourlyBlockage[];
   settings?: OrganizationSettings | null;
   isViewer?: boolean;
   currentUserEmail?: string;
   currentUserName?: string;
   initialTab?: ReportType;
   onClearNavigationAction?: () => void;
}

type ReportType = 'manpower' | 'tasks' | 'location' | 'customFields' | 'dailyAttendance' | 'compliance';

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
   people, shifts, tasks, roles, teams, teamRotations = [],
   absences = [], hourlyBlockages = [],
   settings = null, isViewer = false, currentUserEmail, currentUserName,
   initialTab, onClearNavigationAction
}) => {
   const { profile } = useAuth();
   const activePeople = people.filter(p => p.isActive !== false);

   // Determine if user has strictly personal scope (and not super admin)
   const isPersonalScope = profile?.permissions?.dataScope === 'personal' && !profile?.is_super_admin;
   const defaultTab = (isViewer || isPersonalScope) ? 'tasks' : 'manpower';

   const [reportType, setReportType] = useState<ReportType>(initialTab || defaultTab);

   React.useEffect(() => {
      if (initialTab) {
         setReportType(initialTab);
         onClearNavigationAction?.();
      }
   }, [initialTab]);

   return (
      <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-hidden p-3 md:p-8">

         {/* Header & Navigation Combined */}
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-4">
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 shrink-0">
               <BarChart3 className="text-blue-600 md:w-7 md:h-7" size={24} weight="bold" />
               דוחות ונתונים
               <PageInfo
                  title="דוחות ונתונים"
                  description={
                     <>
                        <p className="mb-2">מרכז הנתונים והסטטיסטיקות של הארגון.</p>
                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                           <li><b>כוח אדם:</b> התפלגות אנשים לפי תפקידים, צוותים וזמינות.</li>
                           <li><b>שיבוץ:</b> ניתוח עומסים, הוגנות בשיבוץ (Fairness Score), ומעקב אחר ביצוע משימות.</li>
                           <li><b>מיקום:</b> מצבת לוחמים בזמן אמת.</li>
                        </ul>
                        <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                           דשבורד זה נועד לסייע בקבלת החלטות מבוססות נתונים.
                        </p>
                     </>
                  }
               />
            </h2>

            {/* Top Navigation - Segmented Control Style */}
            {!isViewer && !isPersonalScope && (
               <div
                  className="bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200 shadow-sm flex w-full md:w-auto md:min-w-[320px]"
                  role="tablist"
                  aria-label="סוגי דוחות"
               >
                  <button
                     onClick={() => setReportType('manpower')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 md:px-4 rounded-lg text-sm font-bold transition-all ${reportType === 'manpower'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                     role="tab"
                     aria-selected={reportType === 'manpower'}
                     aria-controls="report-content"
                     id="tab-manpower"
                  >
                     <Users size={18} aria-hidden="true" weight="bold" />
                     <span className={reportType === 'manpower' ? 'whitespace-nowrap' : 'hidden md:inline whitespace-nowrap'}>כוח אדם</span>
                  </button>
                  <button
                     onClick={() => setReportType('tasks')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 md:px-4 rounded-lg text-sm font-bold transition-all ${reportType === 'tasks'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                     role="tab"
                     aria-selected={reportType === 'tasks'}
                     aria-controls="report-content"
                     id="tab-tasks"
                  >
                     <ClipboardList size={18} aria-hidden="true" weight="bold" />
                     <span className={reportType === 'tasks' ? 'whitespace-nowrap' : 'hidden md:inline whitespace-nowrap'}>שיבוץ</span>
                  </button>
                  <button
                     onClick={() => setReportType('location')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 md:px-4 rounded-lg text-sm font-bold transition-all ${reportType === 'location'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                     role="tab"
                     aria-selected={reportType === 'location'}
                     aria-controls="report-content"
                     id="tab-location"
                  >
                     <MapPin size={18} aria-hidden="true" weight="bold" />
                     <span className={reportType === 'location' ? 'whitespace-nowrap' : 'hidden md:inline whitespace-nowrap'}>מיקום</span>
                  </button>
                  <button
                     onClick={() => setReportType('customFields')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 md:px-4 rounded-lg text-sm font-bold transition-all ${reportType === 'customFields'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                     role="tab"
                     aria-selected={reportType === 'customFields'}
                     aria-controls="report-content"
                     id="tab-customFields"
                  >
                     <ListChecks size={18} aria-hidden="true" weight="bold" />
                     <span className={reportType === 'customFields' ? 'whitespace-nowrap' : 'hidden md:inline whitespace-nowrap'}>שדות מותאמים</span>
                  </button>
                  <button
                     onClick={() => setReportType('dailyAttendance')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 md:px-4 rounded-lg text-sm font-bold transition-all ${reportType === 'dailyAttendance'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                     role="tab"
                     aria-selected={reportType === 'dailyAttendance'}
                     aria-controls="report-content"
                     id="tab-dailyAttendance"
                  >
                     <IdentificationCard size={18} aria-hidden="true" weight="bold" />
                     <span className={reportType === 'dailyAttendance' ? 'whitespace-nowrap' : 'hidden md:inline whitespace-nowrap'}>דוח 1</span>
                  </button>
                  <button
                     onClick={() => setReportType('compliance')}
                     className={`flex-1 flex items-center justify-center gap-2 py-2 px-2 md:px-4 rounded-lg text-sm font-bold transition-all ${reportType === 'compliance'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                     role="tab"
                     aria-selected={reportType === 'compliance'}
                     aria-controls="report-content"
                     id="tab-compliance"
                  >
                     <Warning size={18} aria-hidden="true" weight="bold" />
                     <span className={reportType === 'compliance' ? 'whitespace-nowrap' : 'hidden md:inline whitespace-nowrap'}>חריגות</span>
                  </button>
               </div>
            )}
         </div>

         {/* Content Area */}
         <div className="min-h-[500px]" id="report-content" role="tabpanel" aria-labelledby={`tab-${reportType}`}>
            {reportType === 'manpower' && (
               <ManpowerReports
                  people={activePeople}
                  teams={teams}
                  roles={roles}
                  teamRotations={teamRotations}
                  settings={settings}
                  absences={absences}
                  hourlyBlockages={hourlyBlockages}
               />
            )}

            {reportType === 'tasks' && (
               <TaskReports
                  people={activePeople}
                  shifts={shifts}
                  tasks={tasks}
                  roles={roles}
                  teams={teams} // Added teams
                  isViewer={isViewer}
                  currentUserEmail={currentUserEmail}
                  currentUserName={currentUserName}
               />
            )}

            {reportType === 'location' && (
               <LocationReport
                  people={activePeople}
                  shifts={shifts}
                  taskTemplates={tasks}
                  teamRotations={teamRotations}
                  teams={teams}
                  settings={settings}
                  absences={absences}
                  hourlyBlockages={hourlyBlockages}
               />
            )}

            {reportType === 'customFields' && (
               <CustomFieldsReport
                  people={activePeople}
                  teams={teams}
                  roles={roles}
               />
            )}

            {reportType === 'dailyAttendance' && (
               <DailyAttendanceReport
                  people={activePeople}
                  teams={teams}
                  roles={roles}
                  absences={absences}
                  teamRotations={teamRotations}
                  settings={settings}
                  hourlyBlockages={hourlyBlockages}
               />
            )}

            {reportType === 'compliance' && (
               <ComplianceReport
                  people={activePeople}
                  shifts={shifts}
                  tasks={tasks}
                  roles={roles}
                  absences={absences}
                  hourlyBlockages={hourlyBlockages}
               />
            )}
         </div>
      </div>
   );
};
