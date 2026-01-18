import React, { useState } from 'react';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Shift, Person, TaskTemplate } from '../../types';
import { DownloadSimple as Download, FileArrowDown as FileDown } from '@phosphor-icons/react';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';

interface ExportScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    shifts: Shift[];
    people: Person[];
    tasks: TaskTemplate[];
}

export const ExportScheduleModal: React.FC<ExportScheduleModalProps> = ({
    isOpen,
    onClose,
    shifts,
    people,
    tasks
}) => {
    const { showToast } = useToast();
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]); // Empty = All

    const handleExport = () => {
        try {
            // Filter Shifts
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            if (end < start) {
                showToast('תאריך סיום חייב להיות אחרי תאריך התחלה', 'error');
                return;
            }

            const filteredShifts = shifts.filter(s => {
                const sDate = new Date(s.startTime);
                // Date Range Check
                if (sDate < start || sDate > end) return false;

                // Task Filter Check
                if (selectedTasks.length > 0 && !selectedTasks.includes(s.taskId)) return false;

                return true;
            });

            if (filteredShifts.length === 0) {
                showToast('לא נמצאו משמרות לטווח הנבחר', 'error');
                return;
            }

            // Generate CSV
            const headers = ['תאריך', 'יום', 'שעת התחלה', 'שעת סיום', 'משימה', 'משובצים', 'הערות'];
            const rows = filteredShifts.map(s => {
                const sDate = new Date(s.startTime);
                const eDate = new Date(s.endTime);

                const taskName = tasks.find(t => t.id === s.taskId)?.name || 'לא ידוע';
                const now = new Date();
                const activePeople = people.filter(p => p.isActive !== false);
                const assigneeNames = s.assignedPersonIds
                    .map(id => activePeople.find(p => p.id === id)?.name)
                    .filter(Boolean)
                    .join(', ');

                return [
                    sDate.toLocaleDateString('he-IL'),
                    sDate.toLocaleDateString('he-IL', { weekday: 'long' }),
                    sDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                    eDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                    `"${taskName}"`, // Quote to handle commas
                    `"${assigneeNames}"`,
                    s.isCancelled ? 'מבוטל' : ''
                ];
            });

            const csvContent = [
                headers.join(','),
                ...rows.map(r => r.join(','))
            ].join('\n');

            // Download Logic
            const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Hebrew Excel
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `schedule_export_${startDate}_${endDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            logger.info('EXPORT', `Exported schedule to CSV (${startDate} to ${endDate})`, {
                startDate,
                endDate,
                itemCount: filteredShifts.length,
                taskCount: selectedTasks.length || tasks.length,
                category: 'data'
            });

            showToast('הקובץ נוצר בהצלחה', 'success');
            onClose();

        } catch (error) {
            console.error('Export error:', error);
            showToast('שגיאה ביצירת הקובץ', 'error');
        }
    };

    const toggleTask = (taskId: string) => {
        if (selectedTasks.includes(taskId)) {
            setSelectedTasks(prev => prev.filter(id => id !== taskId));
        } else {
            setSelectedTasks(prev => [...prev, taskId]);
        }
    };

    const modalTitle = (
        <div className="flex flex-col gap-0.5">
            <h3 className="text-xl font-black text-slate-800 leading-tight flex items-center gap-2">
                <FileDown className="text-blue-500" size={20} weight="duotone" />
                <span>ייצוא נתוני שיבוץ</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <Download size={12} className="text-blue-500" weight="duotone" />
                <span>הפקת קובץ CSV לניתוח באקסל</span>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex gap-3 w-full">
            <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-bold"
            >
                ביטול
            </Button>
            <Button
                onClick={handleExport}
                icon={FileDown}
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
            >
                ייצוא לאקסל
            </Button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="sm"
            footer={modalFooter}
        >
            <div className="flex flex-col gap-6 py-2">
                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                    <DatePicker
                        label="מתאריך"
                        value={startDate}
                        onChange={setStartDate}
                    />
                    <DatePicker
                        label="עד תאריך"
                        value={endDate}
                        onChange={setEndDate}
                    />
                </div>

                {/* Task Selection */}
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center px-1">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-wider">סינון משימות</span>
                        <button
                            onClick={() => setSelectedTasks([])}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                            בחר הכל (דיפולט)
                        </button>
                    </div>

                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                        {tasks.map(task => (
                            <label
                                key={task.id}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer group hover:shadow-md ${selectedTasks.length === 0 || selectedTasks.includes(task.id) ? 'bg-white border-blue-100 ring-1 ring-blue-50/30' : 'bg-slate-50 border-slate-100 opacity-60 grayscale'}`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedTasks.length === 0 || selectedTasks.includes(task.id)}
                                    onChange={() => toggleTask(task.id)}
                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 transition-all cursor-pointer"
                                />
                                <div
                                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                                    style={{ backgroundColor: task.color.startsWith('border-') ? undefined : task.color }}
                                />
                                <span className={`text-sm font-bold ${selectedTasks.length === 0 || selectedTasks.includes(task.id) ? 'text-slate-800' : 'text-slate-400'}`}>
                                    {task.name}
                                </span>
                            </label>
                        ))}
                    </div>
                    {selectedTasks.length > 0 && (
                        <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest px-1">נבחרו {selectedTasks.length} משימות ספציפיות</p>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};
