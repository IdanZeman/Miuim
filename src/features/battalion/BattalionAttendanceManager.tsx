import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useBattalionData } from '../../hooks/useBattalionData';
import { Person } from '@/types';
import { CalendarBlank as Calendar, ListChecks, Users, CircleNotch as Loader2, DownloadSimple as Download, MagnifyingGlass as Search, DotsThreeVertical as MoreVertical, X } from '@phosphor-icons/react';
import { DateNavigator } from '../../components/ui/DateNavigator';
import { GlobalTeamCalendar } from '../scheduling/GlobalTeamCalendar';
import { AttendanceTable } from '../scheduling/AttendanceTable';
import { PersonalAttendanceCalendar } from '../scheduling/PersonalAttendanceCalendar';
import { PageInfo } from '@/components/ui/PageInfo';

export const BattalionAttendanceManager: React.FC = () => {
    const { organization } = useAuth();
    const [viewMode, setViewMode] = useState<'calendar' | 'table' | 'day_detail'>('calendar');
    const [calendarViewType, setCalendarViewType] = useState<'grid' | 'table'>('grid');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [selectedPersonForCalendar, setSelectedPersonForCalendar] = useState<Person | null>(null);

    // Fetch battalion data using the new optimized hook
    const {
        companies = [],
        people = [],
        teams = [],
        teamRotations = [],
        absences = [],
        hourlyBlockages = [],
        presenceSummary = [],
        isLoading
    } = useBattalionData(organization?.battalion_id);

    const handleDateClick = (date: Date) => {
        setSelectedDate(date);
        setViewMode('day_detail');
    };

    const handleExport = () => {
        if (viewMode === 'calendar' || viewMode === 'table') {
            // Export monthly battalion report
            const year = viewDate.getFullYear();
            const month = viewDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            let csvContent = `דוח נוכחות גדודי חודשי - ${viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}\n`;
            csvContent += 'תאריך,פלוגה,שם מלא,צוות,סטטוס,הערות\n';

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month, d);
                const dateStr = date.toLocaleDateString('he-IL');

                people.forEach(person => {
                    const company = companies.find(c => c.id === person.organization_id);
                    const team = teams.find(t => t.id === person.teamId);
                    const presence = presenceSummary.find(p => p.person_id === person.id);

                    const status = presence?.status === 'base' ? 'בבסיס' : presence?.status === 'home' ? 'בבית' : 'לא הוזן';

                    csvContent += `${dateStr},"${company?.name || '-'}","${person.name}","${team?.name || '-'}",${status},-\n`;
                });
            }

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `battalion_attendance_${month + 1}_${year}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            // Export daily battalion report
            const dateStr = selectedDate.toLocaleDateString('he-IL');
            let csvContent = `דוח נוכחות גדודי ליום ${dateStr}\n`;
            csvContent += 'פלוגה,שם מלא,צוות,סטטוס,הערות\n';

            people.forEach(person => {
                const company = companies.find(c => c.id === person.organization_id);
                const team = teams.find(t => t.id === person.teamId);
                const presence = presenceSummary.find(p => p.person_id === person.id);

                const status = presence?.status === 'base' ? 'בבסיס' : presence?.status === 'home' ? 'בבית' : 'לא הוזן';

                csvContent += `"${company?.name || '-'}","${person.name}","${team?.name || '-'}",${status},-\n`;
            });

            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `battalion_attendance_${selectedDate.toLocaleDateString('en-CA')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone && p.phone.includes(searchTerm))
    );

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
                <p className="text-slate-500 font-bold">טוען יומן נוכחות גדודי...</p>
            </div>
        );
    }

    if (!organization?.battalion_id) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Calendar className="text-slate-300 mb-4" size={64} />
                <p className="text-slate-500 font-bold">ארגון זה אינו משויך לגדוד</p>
                <p className="text-slate-400 text-sm">
                    {organization?.is_hq
                        ? 'ארגון HQ חייב להיות משויך לגדוד דרך הגדרות הגדוד'
                        : 'רק ארגוני HQ יכולים לצפות ביומן נוכחות גדודי'
                    }
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] relative overflow-hidden">
            {/* Mobile View */}
            <div className="flex-1 flex flex-col md:hidden relative isolate z-10 overflow-hidden">
                {/* Mobile Header */}
                <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/50 sticky top-0 z-50 px-3 py-3 flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        {/* View Mode Selector */}
                        <div className="flex-1 flex items-center p-1 bg-slate-100/80 rounded-xl border border-slate-200/50 h-9">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'calendar' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <Calendar size={14} weight="duotone" />
                                <span className="text-xs">חודשי</span>
                            </button>
                            <button
                                onClick={() => { setViewMode('day_detail'); setSelectedDate(new Date()); }}
                                className={`flex-1 flex items-center justify-center gap-1.5 h-full rounded-lg transition-all duration-300 ${viewMode === 'day_detail' ? 'bg-white text-blue-600 shadow-sm font-black' : 'text-slate-500 font-bold'}`}
                            >
                                <ListChecks size={14} weight="duotone" />
                                <span className="text-xs">יומי</span>
                            </button>
                        </div>
                        <button
                            onClick={handleExport}
                            className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-600 rounded-xl border border-slate-100 active:scale-95 transition-all shrink-0"
                        >
                            <Download size={18} weight="duotone" />
                        </button>
                    </div>

                    {/* Date Navigator */}
                    <div className="bg-slate-50/50 rounded-xl border border-slate-100 p-0.5">
                        <DateNavigator
                            date={viewMode === 'calendar' ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={viewMode === 'calendar' ? 'month' : 'day'}
                            className="w-full justify-between border-none bg-transparent h-9"
                            showTodayButton={true}
                        />
                    </div>
                </div>

                {/* Mobile Content */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col">
                            {/* Search Bar */}
                            <div className="px-4 py-3 bg-white/50 backdrop-blur-sm border-b border-slate-100">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600 text-slate-400">
                                        <Search size={16} weight="duotone" />
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="חיפוש לוחם..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="block w-full h-10 pr-10 pl-4 bg-slate-100/50 border-none rounded-2xl text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500/20 transition-all font-bold text-sm"
                                    />
                                </div>
                            </div>
                            <AttendanceTable
                                teams={teams}
                                people={filteredPeople}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                currentDate={selectedDate}
                                onDateChange={setSelectedDate}
                                onSelectPerson={(p) => setSelectedPersonForCalendar(p)}
                                className="h-full"
                                isViewer={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Desktop View */}
            <div className="hidden md:flex flex-col flex-1 overflow-hidden">
                {/* Desktop Header */}
                <div className="bg-white/50 backdrop-blur-sm border-b border-slate-100 p-4 justify-between items-center shrink-0 z-20 relative flex gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <Calendar className="text-blue-600" size={24} weight="duotone" />
                            יומן נוכחות גדודי
                            <PageInfo
                                title="יומן נוכחות גדודי"
                                description={
                                    <>
                                        <p className="mb-2">מבט מרוכז על נוכחות כל הלוחמים בגדוד.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>תצוגת לוח שנה:</b> מבט חודשי על כל הפלוגות.</li>
                                            <li><b>תצוגת טבלה:</b> טבלה חודשית מפורטת.</li>
                                            <li><b>תצוגת רשימה:</b> פירוט יומי לפי פלוגות.</li>
                                        </ul>
                                        <p className="text-sm bg-blue-50 p-2 rounded text-blue-800">
                                            יומן זה הוא לצפייה בלבד. עריכת נוכחות מתבצעת ברמת הפלוגה.
                                        </p>
                                    </>
                                }
                            />
                        </h2>

                        <div className="h-6 w-px bg-slate-200 mx-2" />

                        {/* View Mode Selector */}
                        <div className="flex bg-slate-100/80 rounded-xl p-1 border border-slate-200/50">
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Calendar size={14} weight="duotone" />
                                לוח שנה
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'table' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <ListChecks size={14} weight="duotone" />
                                טבלה חודשית
                            </button>
                            <button
                                onClick={() => setViewMode('day_detail')}
                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-2 h-7 ${viewMode === 'day_detail' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <Users size={14} weight="duotone" />
                                רשימה יומית
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        {viewMode !== 'calendar' && (
                            <div className={`relative transition-all duration-300 ease-in-out ${isSearchExpanded || searchTerm ? 'w-48' : 'w-9'}`}>
                                {isSearchExpanded || searchTerm ? (
                                    <div className="relative w-full">
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} weight="duotone" />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="חיפוש..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            onBlur={() => { if (!searchTerm) setIsSearchExpanded(false); }}
                                            className="w-full h-9 pr-9 pl-8 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-sm placeholder:font-medium"
                                        />
                                        <button
                                            onClick={() => { setSearchTerm(''); setIsSearchExpanded(false); }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <X size={12} weight="bold" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setIsSearchExpanded(true)}
                                        className="w-9 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-slate-500 transition-colors"
                                    >
                                        <Search size={16} weight="duotone" />
                                    </button>
                                )}
                            </div>
                        )}

                        <DateNavigator
                            date={(viewMode === 'calendar' || viewMode === 'table') ? viewDate : selectedDate}
                            onDateChange={(d) => {
                                if (viewMode === 'calendar' || viewMode === 'table') setViewDate(d);
                                else setSelectedDate(d);
                            }}
                            mode={(viewMode === 'calendar' || viewMode === 'table') ? 'month' : 'day'}
                        />

                        {/* More Actions */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMoreActions(!showMoreActions)}
                                className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border ${showMoreActions ? 'bg-slate-100 border-slate-300 text-slate-800' : 'bg-white border-transparent hover:bg-slate-50 text-slate-500'}`}
                            >
                                <MoreVertical size={18} weight="duotone" />
                            </button>

                            {showMoreActions && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
                                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-100 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-left">
                                        <button
                                            onClick={() => { handleExport(); setShowMoreActions(false); }}
                                            className="w-full text-right px-4 py-2.5 text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                                        >
                                            <Download size={14} className="text-slate-400" weight="duotone" />
                                            ייצוא לאקסל
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Desktop Content */}
                <div className="flex-1 overflow-hidden flex flex-col isolate z-10">
                    {viewMode === 'calendar' ? (
                        <div className="h-full flex flex-col bg-white overflow-hidden">
                            <GlobalTeamCalendar
                                teams={teams}
                                people={people}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                onDateClick={handleDateClick}
                                currentDate={viewDate}
                                onDateChange={setViewDate}
                                viewType={calendarViewType}
                                onViewTypeChange={setCalendarViewType}
                            />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200">
                            <AttendanceTable
                                teams={teams}
                                people={filteredPeople}
                                teamRotations={teamRotations}
                                absences={absences}
                                hourlyBlockages={hourlyBlockages}
                                currentDate={selectedDate}
                                onDateChange={setSelectedDate}
                                viewMode={viewMode === 'day_detail' ? 'daily' : 'monthly'}
                                onSelectPerson={(p) => setSelectedPersonForCalendar(p)}
                                className="h-full"
                                isViewer={true}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Person Details Modal */}
            {selectedPersonForCalendar && (
                <PersonalAttendanceCalendar
                    person={selectedPersonForCalendar}
                    teamRotations={teamRotations}
                    absences={absences}
                    onClose={() => setSelectedPersonForCalendar(null)}
                    onUpdatePerson={() => { }}
                    isViewer={true}
                />
            )}
        </div>
    );
};
