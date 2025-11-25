import React, { useState, useMemo } from 'react';
import { Person, Shift, TaskTemplate, Role, Team } from '../types';
import { Calendar, Download, Copy, Filter, X, Check } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface ShiftReportProps {
    shifts: Shift[];
    people: Person[];
    tasks: TaskTemplate[];
    roles: Role[];
    teams: Team[];
}

export const ShiftReport: React.FC<ShiftReportProps> = ({ shifts, people, tasks, roles, teams }) => {
    const { showToast } = useToast();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [startDate, setStartDate] = useState(today.toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState((() => {
        const end = new Date(today);
        end.setDate(end.getDate() + 7);
        return end.toISOString().split('T')[0];
    })());
    const [startTime, setStartTime] = useState('07:00'); // חדש ברירת מחדל 07:00
    const [endTime, setEndTime] = useState('23:59');

    const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    // Filtered Shifts
    const filteredShifts = useMemo(() => {
        const [sH, sM] = startTime.split(':').map(Number);
        const [eH, eM] = endTime.split(':').map(Number);

        const start = new Date(startDate);
        start.setHours(sH, sM, 0, 0);
        const end = new Date(endDate);
        end.setHours(eH, eM, 59, 999);

        return shifts.filter(s => {
            const shiftStart = new Date(s.startTime);
            if (shiftStart < start || shiftStart > end) return false;
            if (selectedTasks.length > 0 && !selectedTasks.includes(s.taskId)) return false;
            if (selectedTeams.length > 0) {
                const hasTeamMember = s.assignedPersonIds.some(pid => {
                    const person = people.find(p => p.id === pid);
                    return person && selectedTeams.includes(person.teamId);
                });
                if (!hasTeamMember) return false;
            }
            return true;
        }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }, [shifts, startDate, endDate, startTime, endTime, selectedTasks, selectedTeams, people]);

    // Export to CSV (Excel-compatible)
    const handleExportToExcel = () => {
        let csv = 'מתאריך,עד תאריך,שעת התחלה (טווח),שעת סיום (טווח),תאריך משמרת,יום,שעת התחלה,שעת סיום,משימה,משובצים,צוות\n';

        filteredShifts.forEach(shift => {
            const task = tasks.find(t => t.id === shift.taskId);
            const start = new Date(shift.startTime);
            const end = new Date(shift.endTime);

            const date = start.toLocaleDateString('he-IL');
            const day = start.toLocaleDateString('he-IL', { weekday: 'long' });
            const startTimeStr = start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
            const endTimeStr = end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

            const assignedNames = shift.assignedPersonIds
                .map(id => people.find(p => p.id === id)?.name)
                .filter(Boolean)
                .join(' | ');

            const teamNames = [...new Set(
                shift.assignedPersonIds
                    .map(id => {
                        const person = people.find(p => p.id === id);
                        return person ? teams.find(t => t.id === person.teamId)?.name : undefined;
                    })
                    .filter(Boolean)
            )].join(' | ');

            csv += `${startDate} ${startTime},${endDate} ${endTime},${startTime},${endTime},${date},${day},${startTimeStr},${endTimeStr},"${task?.name || 'לא ידוע'}","${assignedNames}","${teamNames}"\n`;
        });

        // Create downloadable file
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `shift_report_${startDate}_to_${endDate}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Copy to Clipboard
    const handleCopyToClipboard = async () => {
        let output = `📊 דוח משמרות\n`;
        output += `⏱ טווח: ${new Date(startDate).toLocaleDateString('he-IL')} ${startTime} → ${new Date(endDate).toLocaleDateString('he-IL')} ${endTime}\n`;
        output += `${'='.repeat(80)}\n\n`;

        // Group by date
        const groupedByDate = new Map<string, Shift[]>();
        filteredShifts.forEach(shift => {
            const dateKey = new Date(shift.startTime).toLocaleDateString('en-CA');
            const existing = groupedByDate.get(dateKey) || [];
            groupedByDate.set(dateKey, [...existing, shift]);
        });

        groupedByDate.forEach((dayShifts, dateKey) => {
            const date = new Date(dateKey);
            output += `📅 ${date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}\n`;
            output += `${'-'.repeat(80)}\n`;

            dayShifts.forEach(shift => {
                const task = tasks.find(t => t.id === shift.taskId);
                const start = new Date(shift.startTime);
                const end = new Date(shift.endTime);

                const assignedNames = shift.assignedPersonIds
                    .map(id => people.find(p => p.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');

                output += `  🕐 ${start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}\n`;
                output += `     📋 ${task?.name || 'לא ידוע'}\n`;
                output += `     👥 ${assignedNames || 'לא שובץ'}\n\n`;
            });

            output += `\n`;
        });

        output += `${'='.repeat(80)}\n`;
        output += `📊 סיכום:\n`;
        output += `   • סה"כ משמרות: ${filteredShifts.length}\n`;
        output += `   • משמרות מאוישות: ${filteredShifts.filter(s => s.assignedPersonIds.length > 0).length}\n`;

        try {
            await navigator.clipboard.writeText(output);
            showToast('הדוח הועתק ללוח ההדבקה', 'success');
        } catch (err) {
            console.error('Failed to copy:', err);
            showToast('שגיאה בהעתקה ללוח ההדבקה', 'error');
        }
    };

    return (
        <div className="space-y-4 md:space-y-6">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-portal p-4 md:p-6">
                <div className="flex flex-col gap-4 mb-4 md:mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2 md:gap-3">
                                <Calendar className="text-blue-600" size={24} />
                                דוח משמרות
                            </h2>
                            <p className="text-slate-500 text-sm md:text-base mt-1">סינון וייצוא נתונים</p>
                        </div>

                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-lg font-medium transition-all text-sm md:text-base ${showFilters ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                        >
                            <Filter size={16} />
                            סינונים {(selectedTasks.length + selectedTeams.length > 0) && `(${selectedTasks.length + selectedTeams.length})`}
                        </button>
                    </div>
                </div>

                {/* Date + Time Range Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4">
                    <div>
                        <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">מתאריך</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full px-3 md:px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm md:text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">משעה</label>
                        <input
                            type="time"
                            value={startTime}
                            onChange={e => setStartTime(e.target.value)}
                            className="w-full px-3 md:px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm md:text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">עד תאריך</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-3 md:px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm md:text-base"
                        />
                    </div>
                    <div>
                        <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">עד שעה</label>
                        <input
                            type="time"
                            value={endTime}
                            onChange={e => setEndTime(e.target.value)}
                            className="w-full px-3 md:px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-blue-400 focus:outline-none text-sm md:text-base"
                        />
                    </div>
                </div>

                {/* Filters Panel */}
                {showFilters && (
                    <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-200 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {/* Task Filter */}
                            <div>
                                <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">סינון לפי משימה</label>
                                <div className="space-y-1.5 md:space-y-2 max-h-48 overflow-y-auto">
                                    {tasks.map(task => (
                                        <label key={task.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded text-sm md:text-base">
                                            <input
                                                type="checkbox"
                                                checked={selectedTasks.includes(task.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedTasks([...selectedTasks, task.id]);
                                                    } else {
                                                        setSelectedTasks(selectedTasks.filter(id => id !== task.id));
                                                    }
                                                }}
                                                className="rounded"
                                            />
                                            <span className="text-slate-700">{task.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Team Filter */}
                            <div>
                                <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">סינון לפי צוות</label>
                                <div className="space-y-1.5 md:space-y-2 max-h-48 overflow-y-auto">
                                    {teams.map(team => (
                                        <label key={team.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-2 rounded text-sm md:text-base">
                                            <input
                                                type="checkbox"
                                                checked={selectedTeams.includes(team.id)}
                                                onChange={e => {
                                                    if (e.target.checked) {
                                                        setSelectedTeams([...selectedTeams, team.id]);
                                                    } else {
                                                        setSelectedTeams(selectedTeams.filter(id => id !== team.id));
                                                    }
                                                }}
                                                className="rounded"
                                            />
                                            <span className="text-slate-700">{team.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Clear Filters */}
                        {(selectedTasks.length > 0 || selectedTeams.length > 0) && (
                            <button
                                onClick={() => {
                                    setSelectedTasks([]);
                                    setSelectedTeams([]);
                                }}
                                className="mt-3 md:mt-4 text-red-600 hover:text-red-800 text-xs md:text-sm font-medium flex items-center gap-1"
                            >
                                <X size={14} />
                                נקה סינונים
                            </button>
                        )}
                    </div>
                )}

                {/* Export Actions */}
                <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-4 md:mt-6">
                    <button
                        onClick={handleExportToExcel}
                        className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base"
                    >
                        <Download size={18} />
                        ייצא ל-Excel
                    </button>
                    <button
                        onClick={handleCopyToClipboard}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold transition-colors shadow-sm text-sm md:text-base"
                    >
                        <Copy size={18} />
                        העתק ללוח
                    </button>
                </div>
            </div>



            {/* Results Summary */}
            <div className="bg-white rounded-xl shadow-portal p-4 md:p-6">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-3 md:mb-4">
                    תוצאות ({filteredShifts.length} משמרות)
                    <span className="block sm:inline text-xs md:text-sm text-slate-600 mt-1 sm:mt-0 sm:mr-2 font-normal">
                        טווח: {new Date(startDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} {startTime} → {new Date(endDate).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} {endTime}
                    </span>
                </h3>

                {filteredShifts.length === 0 ? (
                    <div className="text-center py-8 md:py-12">
                        <p className="text-slate-400 text-base md:text-lg">לא נמצאו משמרות בטווח שנבחר</p>
                    </div>
                ) : (
                    <>
                        {/* Mobile Card View */}
                        <div className="block md:hidden space-y-3">
                            {filteredShifts.map(shift => {
                                const task = tasks.find(t => t.id === shift.taskId);
                                const start = new Date(shift.startTime);
                                const end = new Date(shift.endTime);
                                const isFull = task && shift.assignedPersonIds.length >= task.requiredPeople;

                                return (
                                    <div key={shift.id} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-800 text-sm mb-1">{task?.name}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                                    <span>{start.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span dir="ltr">
                                                        {start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                            {isFull ? (
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">מלא</span>
                                            ) : (
                                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">חסר</span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {shift.assignedPersonIds.map(pid => {
                                                const person = people.find(p => p.id === pid);
                                                return person ? (
                                                    <span key={pid} className="text-xs bg-white border border-slate-200 px-2 py-1 rounded">
                                                        {person.name}
                                                    </span>
                                                ) : null;
                                            })}
                                            {shift.assignedPersonIds.length === 0 && (
                                                <span className="text-xs text-slate-400 italic">לא שובץ</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="text-right py-3 px-4 font-bold text-slate-700">תאריך</th>
                                        <th className="text-right py-3 px-4 font-bold text-slate-700">שעות</th>
                                        <th className="text-right py-3 px-4 font-bold text-slate-700">משימה</th>
                                        <th className="text-right py-3 px-4 font-bold text-slate-700">משובצים</th>
                                        <th className="text-right py-3 px-4 font-bold text-slate-700">סטטוס</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredShifts.map(shift => {
                                        const task = tasks.find(t => t.id === shift.taskId);
                                        const start = new Date(shift.startTime);
                                        const end = new Date(shift.endTime);
                                        const isFull = task && shift.assignedPersonIds.length >= task.requiredPeople;

                                        return (
                                            <tr key={shift.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                <td className="py-3 px-4 text-slate-700">
                                                    {start.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                                                </td>
                                                <td className="py-3 px-4 text-slate-700" dir="ltr">
                                                    {start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-medium text-slate-800">{task?.name}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {shift.assignedPersonIds.map(pid => {
                                                            const person = people.find(p => p.id === pid);
                                                            return person ? (
                                                                <span key={pid} className="text-xs bg-slate-100 px-2 py-1 rounded">
                                                                    {person.name}
                                                                </span>
                                                            ) : null;
                                                        })}
                                                        {shift.assignedPersonIds.length === 0 && (
                                                            <span className="text-xs text-slate-400 italic">לא שובץ</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {isFull ? (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">מלא</span>
                                                    ) : (
                                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium">חסר</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
