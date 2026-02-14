import React, { useState } from 'react';
import ExcelJS from 'exceljs';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/ui/DatePicker';
import { Shift, Person, TaskTemplate } from '../../types';
import { DownloadSimple as Download, FileArrowDown as FileDown, Funnel, Check, Checks } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';

interface ExportScheduleModalProps {
    isOpen: boolean;
    onClose: () => void;
    shifts: Shift[];
    people: Person[];
    tasks: TaskTemplate[];
    roles: import('../../types').Role[];
    teams: import('../../types').Team[];
    settings?: import('../../types').OrganizationSettings | null;
}

export const ExportScheduleModal: React.FC<ExportScheduleModalProps> = ({
    isOpen,
    onClose,
    shifts,
    people,
    tasks,
    roles,
    teams,
    settings
}) => {
    const { showToast } = useToast();
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedTasks, setSelectedTasks] = useState<string[]>([]); // Empty = All
    const [selectedPersonFields, setSelectedPersonFields] = useState<string[]>(['name']);

    const personFields = React.useMemo(() => {
        const baseFields = [
            { id: 'name', label: 'שם מלא' },
            { id: 'team', label: 'צוות' },
            { id: 'role', label: 'תפקיד' },
            { id: 'phone', label: 'טלפון' },
            { id: 'email', label: 'אימייל' },
        ];

        const customFields = (settings?.customFieldsSchema || []).map(cf => ({
            id: `cf_${cf.key}`,
            label: cf.label,
            isCustom: true,
            key: cf.key
        }));

        return [...baseFields, ...customFields];
    }, [settings]);

    const togglePersonField = (id: string) => {
        setSelectedPersonFields(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const handleExport = async () => {
        try {
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            if (end < start) {
                showToast('תאריך סיום חייב להיות אחרי תאריך התחלה', 'error');
                return;
            }

            const filteredShifts = shifts.filter(s => {
                // Exclude cancelled shifts from export
                if (s.isCancelled) return false;
                const sDate = new Date(s.startTime);
                if (sDate < start || sDate > end) return false;
                if (selectedTasks.length > 0 && !selectedTasks.includes(s.taskId)) return false;
                return true;
            });

            if (filteredShifts.length === 0) {
                showToast('לא נמצאו משמרות לטווח הנבחר', 'error');
                return;
            }

            // Sort by Date and Time
            const sortedShifts = [...filteredShifts].sort((a, b) =>
                new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            );

            // Determine Columns for Personnel (excluding name which is the anchor)
            const personDetailFields = personFields.filter(f => selectedPersonFields.includes(f.id) && f.id !== 'name');

            const headers = [
                'תאריך / שעה',
                'משימה',
                'שם משובץ',
                ...personDetailFields.map(f => f.label),
                'הערות'
            ];

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('לוח שיבוצים');
            worksheet.views = [{ rightToLeft: true }];

            // Header Row
            const headerRow = worksheet.addRow(headers);
            headerRow.eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D3748' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.numFmt = '@';
            });

            // Group by Date
            const shiftsByDate: Record<string, typeof sortedShifts> = {};
            sortedShifts.forEach(s => {
                const dateKey = new Date(s.startTime).toLocaleDateString('he-IL');
                if (!shiftsByDate[dateKey]) shiftsByDate[dateKey] = [];
                shiftsByDate[dateKey].push(s);
            });

            // Build Rows Hierarchically
            Object.entries(shiftsByDate).forEach(([dateStr, dateShifts]) => {
                // DATE HEADER
                const dayName = new Date(dateShifts[0].startTime).toLocaleDateString('he-IL', { weekday: 'long' });
                const dateRow = worksheet.addRow([`${dateStr} (${dayName})`]);
                dateRow.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    cell.font = { bold: true, size: 13, color: { argb: 'FF1E293B' } };
                    cell.alignment = { horizontal: 'right' };
                });
                worksheet.mergeCells(dateRow.number, 1, dateRow.number, headers.length);

                dateShifts.forEach(s => {
                    const sDate = new Date(s.startTime);
                    const eDate = new Date(s.endTime);
                    const timeRange = `${sDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - ${eDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                    const taskName = tasks.find(t => t.id === s.taskId)?.name || 'לא ידוע';
                    const activePeople = people.filter(p => p.isActive !== false);

                    // SHIFT SUMMARY ROW
                    const shiftRow = worksheet.addRow([
                        timeRange,
                        taskName,
                        s.assignedPersonIds.length > 0 ? `משובצים (${s.assignedPersonIds.length}):` : 'אין משובצים',
                        ...Array(personDetailFields.length).fill(''),
                        s.isCancelled ? 'מבוטל' : ''
                    ]);

                    shiftRow.eachCell(cell => {
                        cell.font = { bold: true, color: { argb: 'FF475569' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                        cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
                        cell.alignment = { horizontal: 'center' };
                        cell.numFmt = '@';
                    });

                    // PERSONNEL DETAIL ROWS
                    s.assignedPersonIds.forEach(pid => {
                        const person = activePeople.find(p => p.id === pid);
                        if (!person) return;

                        const detailValues: string[] = [];
                        personDetailFields.forEach(f => {
                            if (f.id === 'team') {
                                detailValues.push(teams.find(t => t.id === person.teamId)?.name || '-');
                            } else if (f.id === 'role') {
                                // Infer mission-specific role
                                const shiftReqs = s.requirements?.roleComposition || [];
                                const requiredRoleIds = shiftReqs.map(rc => rc.roleId);
                                const userRoleIds = person.roleIds || (person.roleId ? [person.roleId] : []);
                                const matchingRoles = userRoleIds.filter(rid => requiredRoleIds.includes(rid));

                                if (matchingRoles.length > 0) {
                                    detailValues.push(matchingRoles.map(rid => roles.find(r => r.id === rid)?.name).filter(Boolean).join(', '));
                                } else {
                                    detailValues.push(roles.find(r => r.id === person.roleId)?.name || '-');
                                }
                            } else if (f.id === 'phone') {
                                detailValues.push(person.phone || '-');
                            } else if (f.id === 'email') {
                                detailValues.push(person.email || '-');
                            } else if (f.id.startsWith('cf_')) {
                                const key = f.id.replace('cf_', '');
                                detailValues.push(person.customFields?.[key] || '-');
                            }
                        });

                        let displayName = person.name;
                        if (s.metadata?.commanderId === person.id) displayName += ' (מפקד)';

                        const pRow = worksheet.addRow([
                            '', // Date/Time Col
                            '', // Task Col
                            displayName,
                            ...detailValues,
                            '' // Notes Col
                        ]);

                        pRow.eachCell((cell, colNum) => {
                            cell.alignment = { horizontal: 'center' };
                            cell.numFmt = '@';
                            // Indent name
                            if (colNum === 3) {
                                cell.alignment = { horizontal: 'right', indent: 1 };
                                cell.font = { italic: s.metadata?.commanderId === person.id, bold: s.metadata?.commanderId === person.id };
                            }
                        });
                    });

                    // Add a tiny spacer between shifts for clarity
                    worksheet.addRow([]);
                });
            });

            // Styling and Column Widths
            worksheet.columns.forEach((col, i) => {
                col.width = i === 2 ? 30 : 20; // Anchor name column wider
            });

            worksheet.eachRow(row => {
                row.eachCell(cell => {
                    if (!cell.alignment) cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    if (!cell.numFmt) cell.numFmt = '@'; // Force text everywhere
                });
            });

            // Generate and Trigger Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `schedule_export_${startDate}_${endDate}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            logger.info('EXPORT', `Exported schedule to Excel (.xlsx) from ${startDate} to ${endDate}`, {
                startDate,
                endDate,
                rowCount: sortedShifts.length,
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
                <FileDown className="text-blue-500" size={20} weight="bold" />
                <span>ייצוא נתוני שיבוץ</span>
            </h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <Download size={12} className="text-blue-500" weight="bold" />
                <span>הפקת קובץ Excel מעוצב לניתוח נתונים</span>
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
            <ExportButton
                onExport={handleExport}
                className="flex-1 h-12 md:h-10 text-base md:text-sm"
                variant="premium"
            />
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="md"
            footer={modalFooter}
        >
            <div className="flex flex-col gap-8 py-2">
                {/* Date Range */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-6 bg-blue-500 rounded-full"></div>
                        <span className="text-sm font-black text-slate-700 uppercase tracking-tight">טווח תאריכים</span>
                    </div>
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
                </div>

                {/* Person Field Selection - MATCHING THE IMAGE STYLE */}
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                            <Funnel size={18} weight="bold" className="text-blue-500" />
                            <h4 className="text-base font-black text-slate-800 tracking-tight">אילו שדות לכלול בדוח?</h4>
                        </div>
                        <button
                            onClick={() => setSelectedPersonFields(personFields.map(f => f.id))}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                        >
                            <Checks size={14} weight="bold" />
                            בחר הכל
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                        {personFields.map(field => {
                            const isSelected = selectedPersonFields.includes(field.id);
                            return (
                                <button
                                    key={field.id}
                                    onClick={() => togglePersonField(field.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-200 font-bold text-sm
                                        ${isSelected
                                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 scale-105'
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    <span className="truncate max-w-[120px]">{field.label}</span>
                                    <div className={`
                                        w-5 h-5 rounded-full flex items-center justify-center border transition-colors
                                        ${isSelected ? 'bg-white/20 border-white' : 'bg-slate-50 border-slate-200'}
                                    `}>
                                        {isSelected && <Check size={12} weight="bold" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {selectedPersonFields.length === 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center gap-2 text-amber-700 text-xs font-bold animate-pulse">
                            <Check size={14} weight="bold" />
                            שים לב: לא נבחרו שדות פרטי כוח אדם. רק פרטי המשימה יופיעו.
                        </div>
                    )}
                </div>

                {/* Task Selection */}
                <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
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
