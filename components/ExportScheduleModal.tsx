import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Shift, Person, TaskTemplate } from '../types';
import { Download, FileDown } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

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
                const assigneeNames = s.assignedPersonIds
                    .map(id => people.find(p => p.id === id)?.name)
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="ייצוא נתונים" maxWidth="max-w-md">
            <div className="space-y-6">

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700">מתאריך</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700">עד תאריך</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Task Selection */}
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex justify-between">
                        <span>סינון לפי משימות (חובה לבחור)</span>
                        <button
                            onClick={() => setSelectedTasks([])}
                            className="text-xs text-blue-600 hover:underline"
                        >
                            בחר הכל (מומלץ)
                        </button>
                    </label>
                    <div className="border rounded-lg p-2 max-h-48 overflow-y-auto space-y-1 bg-slate-50">
                        {tasks.map(task => (
                            <label key={task.id} className="flex items-center gap-2 p-1.5 hover:bg-white rounded cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectedTasks.length === 0 || selectedTasks.includes(task.id)}
                                    onChange={() => toggleTask(task.id)}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: task.color }} />
                                <span className="text-sm text-slate-700">{task.name}</span>
                            </label>
                        ))}
                    </div>
                    {selectedTasks.length > 0 && (
                        <p className="text-xs text-slate-500">נבחרו {selectedTasks.length} משימות</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                    <Button onClick={onClose} variant="secondary" className="flex-1">ביטול</Button>
                    <Button onClick={handleExport} className="flex-1 gap-2">
                        <FileDown size={18} />
                        ייצוא ל-CSV
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
