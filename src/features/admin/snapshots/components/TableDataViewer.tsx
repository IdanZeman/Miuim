import React, { useState } from 'react';
import {
    Clock,
    Eye,
    Calendar,
    Shield,
    Users,
    Package,
    MapPin,
    House,
    CheckCircle as CheckCircleIcon,
    User,
    CheckSquare,
    Square,
    ArrowsClockwise as RestoreIcon
} from '@phosphor-icons/react';
import { useToast } from '../../../../contexts/ToastContext';
import { snapshotService } from '../../../../services/snapshotService';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { ConfirmationModal } from '../../../../components/ui/ConfirmationModal';
import { useConfirmation } from '../../../../hooks/useConfirmation';
import { getTableLabel, getPersonalId, getProp, safeDate } from '../utils/snapshotUtils';
import { getEffectiveAvailability } from '../../../../utils/attendanceUtils';

interface TableDataViewerProps {
    tableName: string;
    data: any[];
    onBack: () => void;
    // Context maps for ID lookups
    peopleMap?: Record<string, any>;
    teamsMap?: Record<string, any>;
    rolesMap?: Record<string, any>;
    tasksMap?: Record<string, any>;
    equipmentMap?: Record<string, any>;
    // Supplementary data for attendance logic
    absences?: any[];
    teamRotations?: any[];
    hourlyBlockages?: any[];
}

export const TableDataViewer: React.FC<TableDataViewerProps> = ({
    tableName,
    data,
    onBack,
    peopleMap,
    teamsMap,
    rolesMap,
    tasksMap,
    equipmentMap,
    absences = [],
    teamRotations = [],
    hourlyBlockages = []
}) => {
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const { confirm, modalProps } = useConfirmation();
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isRestoring, setIsRestoring] = useState(false);

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const togglePersonSelection = (personId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const personRecordIds = data
                .filter(item => getProp(item, 'person_id', 'personId') === personId)
                .map(item => item.id);

            const isSelected = personRecordIds.every(id => next.has(id));
            if (isSelected) personRecordIds.forEach(id => next.delete(id));
            else personRecordIds.forEach(id => next.add(id));
            return next;
        });
    };

    const isPersonSelected = (personId: string) => {
        const personRecordIds = data
            .filter(item => getProp(item, 'person_id', 'personId') === personId)
            .map(item => item.id);
        return personRecordIds.length > 0 && personRecordIds.every(id => selectedIds.has(id));
    };

    const handleRestoreSelected = async () => {
        if (selectedIds.size === 0) return;

        confirm({
            title: 'שחזור רשומות',
            message: `האם אתה בטוח שברצונך לשחזר ${selectedIds.size} רשומות? פעולה זו תעדכן או תוסיף נתונים למערכת הפעילה.`,
            confirmText: 'שחזר',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setIsRestoring(true);
                    const selectedRecords = data.filter(item => selectedIds.has(item.id));
                    await snapshotService.restoreRecords(tableName, selectedRecords);
                    showToast(`שוחזרו בהצלחה ${selectedIds.size} רשומות`, 'success');
                    setSelectedIds(new Set());
                    queryClient.invalidateQueries({ queryKey: ['organizationData'] });
                    queryClient.invalidateQueries({ queryKey: ['battalionPresence'] });
                } catch (error: any) {
                    console.error('Error restoring records:', error);
                    showToast(error.message || 'שגיאה בשחזור הרשומות', 'error');
                } finally {
                    setIsRestoring(false);
                }
            }
        });
    };

    const [selectedMonthStr, setSelectedMonthStr] = useState<string | null>(null);

    const renderAttendanceGrid = () => {
        // Group by person
        const personAttendance: Record<string, Record<string, any>> = {};
        const datesSet = new Set<string>();

        data.forEach(p => {
            const personId = getProp(p, 'person_id', 'personId');
            if (!personId) return;
            if (!personAttendance[personId]) personAttendance[personId] = {};
            // Normalize to YYYY-MM-DD to avoid timezone issues with snapshot data
            // Some snapshots might store full ISO strings, so we slice safely
            let dateStr = getProp(p, 'date', 'start_date', 'startDate');
            if (dateStr && dateStr.includes('T')) {
                dateStr = dateStr.split('T')[0];
            }
            if (!dateStr) return;

            personAttendance[personId][dateStr] = p;
            datesSet.add(dateStr);
        });

        // 1. Identify Available Months
        const dateStrings = Array.from(datesSet).sort();
        const availableMonths = Array.from(new Set(dateStrings.map(d => d.substring(0, 7)))).sort().reverse(); // ['2026-01', '2025-12']

        // 2. Determine Current View Month
        // Default to the latest available month if nothing selected, or if selected is invalid
        const currentMonthStr = (selectedMonthStr && availableMonths.includes(selectedMonthStr))
            ? selectedMonthStr
            : availableMonths[0];

        // Update state if it was null (initial load)
        if (!selectedMonthStr && currentMonthStr) {
            // We can't set state directly in render, but we can rely on currentMonthStr for this render cycle
        }

        // 3. Generate Display Dates for the Selected Month
        let displayDates: string[] = [];
        if (currentMonthStr) {
            const [yearStr, monthStr] = currentMonthStr.split('-');
            const year = parseInt(yearStr);
            const month = parseInt(monthStr) - 1; // JS 0-indexed
            const daysInMonth = new Date(year, month + 1, 0).getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                const dateObj = new Date(year, month, d);
                const offsetDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
                displayDates.push(offsetDate.toISOString().split('T')[0]);
            }
        }

        if (displayDates.length === 0) {
            return (
                <div className="py-12 text-center text-slate-400 font-bold italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    אין נתוני נוכחות להצגה בגרסה זו
                </div>
            );
        }

        return (
            // Use a simpler container that fits within the modal content area
            <div className="border border-slate-100 rounded-2xl bg-white shadow-sm overflow-hidden flex flex-col flex-1 h-full min-h-0">
                {/* Month Selector Toolbar */}
                {availableMonths.length > 0 && (
                    <div className="flex items-center gap-2 p-2 px-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                        <span className="text-xs font-black text-slate-500 mr-2 whitespace-nowrap">הצג חודש:</span>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {availableMonths.map(m => {
                                const [y, mo] = m.split('-');
                                const label = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
                                return (
                                    <button
                                        key={m}
                                        onClick={() => setSelectedMonthStr(m)}
                                        className={`px-3 py-1 rounded-lg text-xs font-black transition-colors whitespace-nowrap
                                            ${currentMonthStr === m ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-200'}
                                        `}
                                    >
                                        {label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Legend Toolbar */}
                <div className="flex items-center gap-4 p-2 px-4 border-b border-slate-100 bg-white text-[10px] font-bold text-slate-500 overflow-x-auto shrink-0 sticky top-0 z-10">
                    <span>מקרא:</span>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 font-black text-[10px]">ב</span>
                        <span>בבסיס</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-emerald-100 text-emerald-700 font-black text-[10px]">ג</span>
                        <span>הגעה</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-amber-100 text-amber-700 font-black text-[10px]">י</span>
                        <span>יציאה</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-red-100 text-red-700 font-black text-[10px]">ח</span>
                        <span>בבית</span>
                    </div>
                </div>

                <div className="overflow-auto custom-scrollbar flex-1 relative bg-slate-50">
                    <table className="w-full text-right border-collapse relative table-fixed">
                        <thead className="sticky top-0 z-40 shadow-sm">
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="p-3 text-xs font-black text-slate-500 sticky top-0 right-0 bg-slate-50 z-50 w-40 min-w-[160px] border-l border-slate-100 shadow-[4px_0_12px_rgba(0,0,0,0.02)]">חייל</th>
                                {displayDates.map(date => (
                                    <th key={date} className="p-2 text-[10px] font-black text-slate-500 border-r border-slate-100 min-w-[36px] text-center bg-slate-50">
                                        <div className="flex flex-col items-center">
                                            <span className="opacity-50 text-[9px]">
                                                {new Date(date).toLocaleDateString('he-IL', { weekday: 'short' })}
                                            </span>
                                            <span>{new Date(date).getDate()}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.keys(personAttendance).map((personId, idx) => (
                                <tr key={personId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                                    <td className={`p-3 text-xs font-bold text-slate-700 sticky right-0 bg-white z-10 border-l border-slate-50 group-hover:bg-slate-50 shadow-[4px_0_12px_rgba(0,0,0,0.02)]`}>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => togglePersonSelection(personId)}
                                                className={`p-1 rounded transition-colors ${isPersonSelected(personId) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                                            >
                                                {isPersonSelected(personId) ? <CheckSquare size={16} weight="fill" /> : <Square size={16} />}
                                            </button>
                                            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[9px] font-black ${peopleMap?.[personId]?.color || 'bg-slate-400'}`}>
                                                {peopleMap?.[personId]?.name?.slice(0, 1) || '?'}
                                            </div>
                                            <span className="truncate max-w-[100px]">{peopleMap?.[personId]?.name || `חייל (${personId.slice(0, 4)})`}</span>
                                        </div>
                                    </td>
                                    {displayDates.map((date, i) => {
                                        // Construct a minimal Person object for the utility
                                        const personRecord = peopleMap?.[personId] || {};

                                        // Gather all availability for this person to pass to utility
                                        const personDailyMap: Record<string, any> = {};
                                        // We populate it with valid entries we have in the snapshot for this person
                                        if (personAttendance[personId]) {
                                            Object.entries(personAttendance[personId]).forEach(([d, record]: [string, any]) => {
                                                const normalizedDate = d.includes('T') ? d.split('T')[0] : d;
                                                personDailyMap[normalizedDate] = {
                                                    status: getProp(record, 'status'),
                                                    isAvailable: getProp(record, 'is_available', 'isAvailable'),
                                                    startHour: getProp(record, 'start_time', 'startTime', 'startHour'),
                                                    endHour: getProp(record, 'end_time', 'endTime', 'endHour'),
                                                    unavailableBlocks: getProp(record, 'unavailable_blocks', 'unavailableBlocks'),
                                                    homeStatusType: getProp(record, 'home_status_type', 'homeStatusType')
                                                };
                                            });
                                        }

                                        const mockPerson = {
                                            id: personId,
                                            name: getProp(personRecord, 'name') || personId,
                                            teamId: getProp(personRecord, 'team_id', 'teamId'),
                                            dailyAvailability: personDailyMap,
                                            personalRotation: {
                                                // Try to find if personal rotation fields exist in snapshot people data
                                                isActive: getProp(personRecord, 'personal_rotation_active', 'personalRotationActive'),
                                                startDate: getProp(personRecord, 'personal_rotation_start', 'personalRotationStartDate'),
                                                daysOn: getProp(personRecord, 'personal_rotation_on', 'personalRotationDaysOn'),
                                                daysOff: getProp(personRecord, 'personal_rotation_off', 'personalRotationDaysOff')
                                            }
                                        };

                                        // Call the utility
                                        const cellDateObj = new Date(date);

                                        // We use the imported supplementary data
                                        const avail = getEffectiveAvailability(
                                            mockPerson as any,
                                            cellDateObj,
                                            teamRotations || [],
                                            absences || [],
                                            hourlyBlockages || []
                                        );

                                        // --- LOGIC ALIGNMENT WITH ATTENDANCETABLE.TSX ---
                                        // Check context (prev/next day) for Arrival/Departure inference
                                        const prevDateObj = new Date(cellDateObj);
                                        prevDateObj.setDate(cellDateObj.getDate() - 1);
                                        const nextDateObj = new Date(cellDateObj);
                                        nextDateObj.setDate(cellDateObj.getDate() + 1);

                                        const prevAvail = getEffectiveAvailability(
                                            mockPerson as any,
                                            prevDateObj,
                                            teamRotations || [],
                                            absences || [],
                                            hourlyBlockages || []
                                        );
                                        const nextAvail = getEffectiveAvailability(
                                            mockPerson as any,
                                            nextDateObj,
                                            teamRotations || [],
                                            absences || [],
                                            hourlyBlockages || []
                                        );

                                        let content = null;
                                        let cellClass = "bg-white";

                                        if (avail.status === 'home' || avail.status === 'unavailable' || avail.status === 'leave') {
                                            cellClass = "bg-red-50/70 text-red-800";
                                            content = (
                                                <div className="flex flex-col items-center justify-center gap-0.5">
                                                    <span className="text-[10px] font-black bg-red-100 w-5 h-5 flex items-center justify-center rounded text-red-700">ח</span>
                                                </div>
                                            );
                                        } else if (avail.status === 'base' || avail.status === 'full' || avail.status === 'arrival' || avail.status === 'departure') {
                                            // Enhanced Logic for Arrival/Departure/SingleDay based on AttendanceTable.tsx
                                            // Check strict Arrival/Departure conditions (Manual hours or transition from Home)
                                            const isArrival = (!prevAvail.isAvailable || prevAvail.status === 'home') || (avail.startHour && avail.startHour !== '00:00');
                                            const isDeparture = (!nextAvail.isAvailable || nextAvail.status === 'home') || (avail.endHour && avail.endHour !== '23:59');
                                            const isSingleDay = isArrival && isDeparture;

                                            if (isSingleDay) {
                                                cellClass = "bg-emerald-50 text-emerald-800";
                                                content = <span className="text-[10px] font-black bg-emerald-100 w-5 h-5 flex items-center justify-center rounded text-emerald-700">ב</span>;
                                            } else if (isArrival) {
                                                cellClass = "bg-emerald-50/60 text-emerald-800";
                                                content = <span className="text-[10px] font-black bg-emerald-100 w-5 h-5 flex items-center justify-center rounded text-emerald-700">ג</span>;
                                            } else if (isDeparture) {
                                                cellClass = "bg-amber-50/60 text-amber-900";
                                                content = <span className="text-[10px] font-black bg-amber-100 w-5 h-5 flex items-center justify-center rounded text-amber-700">י</span>;
                                            } else {
                                                cellClass = "bg-emerald-50/40 text-emerald-800";
                                                content = <span className="text-[10px] font-black bg-emerald-100 w-5 h-5 flex items-center justify-center rounded text-emerald-700">ב</span>;
                                            }
                                        } else {
                                            // Unknown/Other
                                            content = <span className="text-[10px] text-slate-400">?</span>;
                                        }

                                        return (
                                            <td key={date} className={`p-1 border-r border-slate-50 text-center h-10 w-9 min-w-[36px] ${cellClass}`}>
                                                {content || <div className="w-1 h-1 bg-slate-100 rounded-full mx-auto" />}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderItem = (item: any, idx: number) => {
        if (tableName === 'people') {
            return (
                <div
                    key={item.id || idx}
                    className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all text-right w-full group relative"
                >
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${item.color || 'bg-slate-400'}`}>
                            {item.name?.slice(0, 2)}
                        </div>
                        <div className="flex flex-col text-right">
                            <div className="font-black text-slate-800 text-sm">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold">
                                {getPersonalId(item)}{getPersonalId(item) ? ' • ' : ''}{teamsMap?.[item.team_id || item.teamId]?.name || 'ללא צוות'}
                            </div>
                        </div>
                        <Eye size={14} className="mr-auto text-slate-200 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
            );
        }

        if (tableName === 'teams' || tableName === 'roles' || tableName === 'permission_templates') {
            const isTeam = tableName === 'teams';
            const isPermissionTemplate = tableName === 'permission_templates';
            const colorClass = item.color || (isTeam ? 'border-slate-200' : 'bg-slate-200');

            return (
                <div key={item.id || idx} className={`
                    bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden
                    ${isTeam ? `border-r-4 ${colorClass}` : ''}
                `}>
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 z-10 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    {!isTeam && <div className={`absolute top-0 right-0 bottom-0 w-1 ${isPermissionTemplate ? 'bg-indigo-600' : colorClass}`} />}
                    {!isTeam && (
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white shadow-sm ${isPermissionTemplate ? 'bg-indigo-600' : colorClass}`}>
                            {item.icon ? <Shield size={16} /> : (isPermissionTemplate ? <Shield size={16} /> : item.name?.slice(0, 1))}
                        </div>
                    )}
                    <div className="flex flex-col text-right">
                        <div className="font-black text-slate-800">{item.name}</div>
                        {isTeam && item.memberCount !== undefined && (
                            <span className="text-[10px] text-slate-400 font-bold">{item.memberCount} חברים</span>
                        )}
                    </div>
                </div>
            );
        }

        if (tableName === 'task_templates') {
            return (
                <div
                    key={item.id || idx}
                    className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-right w-full group"
                >
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                            <Package size={20} />
                        </div>
                        <div className="text-right flex-1">
                            <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{item.name}</div>
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {item.category || 'כללי'} • רמה {item.difficulty || 1} • {item.segments?.length || 0} סגמנטים
                            </div>
                        </div>
                        <Eye size={14} className="mr-auto text-slate-200 group-hover:text-blue-400 transition-colors" />
                    </div>
                </div>
            );
        }

        if (tableName === 'shifts') {
            const taskId = getProp(item, 'task_id', 'taskId');
            const task = tasksMap?.[taskId];
            const startTime = safeDate(getProp(item, 'start_time', 'startTime'));
            const endTime = safeDate(getProp(item, 'end_time', 'endTime'));
            const assignedIds = getProp(item, 'assigned_person_ids', 'assignedPersonIds') || [];

            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm border-r-4 border-r-blue-100">
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col text-right">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{task?.name || 'משימה כללית'}</span>
                                <span className="text-xs font-black text-slate-800">{startTime ? startTime.toLocaleDateString('he-IL') : 'תאריך לא ידוע'}</span>
                            </div>
                            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-400">
                                <Clock size={12} />
                                {startTime?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) || '--:--'} - {endTime?.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) || '--:--'}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {assignedIds.map((pid: string) => (
                                <span key={pid} className="px-2 py-0.5 bg-blue-50/50 rounded text-[9px] font-black text-blue-600 border border-blue-100/30">
                                    {peopleMap?.[pid]?.name || pid.slice(0, 4)}
                                </span>
                            ))}
                            {assignedIds.length === 0 && (
                                <span className="text-[10px] text-slate-300 italic">טרם שובצו אנשים</span>
                            )}
                        </div>
                    </div>
                </div>
            );
        }

        if (tableName === 'absences' || tableName === 'hourly_blockages') {
            const isAbsence = tableName === 'absences';
            const personId = getProp(item, 'person_id', 'personId');
            const person = peopleMap?.[personId];
            const colorClass = isAbsence ? 'border-r-red-400' : 'border-r-amber-400';
            const startDate = getProp(item, 'start_date', 'startDate', 'date');
            const endDate = getProp(item, 'end_date', 'endDate', 'date');
            const startTime = getProp(item, 'start_time', 'startTime');
            const endTime = getProp(item, 'end_time', 'endTime');

            return (
                <div key={item.id || idx} className={`bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm border-r-4 ${colorClass}`}>
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${person?.color || 'bg-slate-400'}`}>
                                    {(person?.name || item.name)?.slice(0, 2)}
                                </div>
                                <span className="text-xs font-black text-slate-800">{person?.name || item.name || 'חייל לא ידוע'}</span>
                            </div>
                            {isAbsence && (
                                <div className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm ${item.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                                    {item.status === 'approved' ? 'מאושר' : 'ממתין'}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-50">
                            <div className="flex items-center gap-1.5">
                                <Calendar size={12} className="text-slate-300" />
                                {startDate}{endDate !== startDate ? ` - ${endDate}` : ''}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={12} className="text-slate-300" />
                                {startTime} - {endTime}
                            </div>
                        </div>

                        {item.reason && (
                            <div className="text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-50/50 italic">
                                "{item.reason}"
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (tableName === 'equipment') {
            const assignedId = getProp(item, 'assigned_to_id', 'assignedToId');
            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 items-center gap-3 shadow-sm flex group">
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="text-right flex-1">
                        <div className="font-black text-slate-800 text-sm">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold">
                            #{getProp(item, 'serial_number', 'serialNumber') || 'ללא מספר'} • {peopleMap?.[assignedId]?.name || 'לא משויך'}
                        </div>
                    </div>
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${item.status === 'present' || item.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {item.status === 'present' || item.status === 'ok' ? 'תקין' : 'חסר/תקול'}
                    </div>
                </div>
            );
        }

        if (tableName === 'equipment_daily_checks') {
            const equipId = item.equipment_id || item.equipmentId;
            const equip = equipmentMap?.[equipId];
            const checkedBy = item.checked_by || item.checkedBy;
            const checkDate = item.check_date || item.checkDate;

            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                    <button
                        onClick={() => toggleSelection(item.id)}
                        className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                    >
                        {selectedIds.has(item.id) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                    </button>
                    <div className="flex flex-col gap-1.5 flex-1">
                        <div className="flex items-center justify-between">
                            <div className="text-right">
                                <div className="font-black text-slate-800 text-xs">{equip?.type || equip?.name || 'ציוד לא ידוע'}</div>
                                <div className="text-[10px] text-slate-400 font-bold">#{equip?.serial_number || equip?.serialNumber || '---'}</div>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black ${item.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                                {item.status === 'ok' ? 'תקין' : 'לא תקין'}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold border-t border-slate-50 pt-1.5 mt-0.5">
                            <User size={12} className="text-slate-300" />
                            <span>נבדק ע"י: {peopleMap?.[checkedBy]?.name || 'לא ידוע'}</span>
                            <span className="mr-auto opacity-50">{checkDate ? new Date(checkDate).toLocaleDateString('he-IL') : '---'}</span>
                        </div>
                    </div>
                </div>
            );
        }

        // Default generic row
        return (
            <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm transition-all text-right w-full group">
                <button
                    onClick={() => toggleSelection(item.id || `gen-${idx}`)}
                    className={`p-1 rounded transition-colors shrink-0 ${selectedIds.has(item.id || `gen-${idx}`) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                >
                    {selectedIds.has(item.id || `gen-${idx}`) ? <CheckSquare size={18} weight="fill" /> : <Square size={18} />}
                </button>
                <div className="flex flex-col text-right flex-1 min-w-0">
                    <div className="font-black text-slate-800 text-xs truncate">
                        {item.name || item.label || item.title || (item.id ? `${tableName} (${item.id.slice(0, 8)})` : 'פריט ללא שם')}
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 truncate opacity-60">
                        {JSON.stringify(item).slice(0, 100)}...
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full min-h-0 space-y-4">
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={onBack} size="sm" className="text-blue-600 font-bold hover:bg-blue-50 border border-blue-100">
                        חזרה
                    </Button>
                    <div className="flex flex-col">
                        <h3 className="text-base font-black text-slate-800 leading-tight">{getTableLabel(tableName)}</h3>
                        <span className="text-[10px] text-slate-400 font-bold">({data.length} רשומות בגרסה)</span>
                    </div>
                </div>

                {selectedIds.size > 0 && (
                    <Button
                        variant="primary"
                        size="sm"
                        icon={RestoreIcon}
                        onClick={handleRestoreSelected}
                        isLoading={isRestoring}
                        className="bg-orange-600 hover:bg-orange-700 border-orange-600 shadow-md shadow-orange-100 animate-in fade-in slide-in-from-left-4"
                    >
                        שחזר {selectedIds.size} רשומות נבחרות
                    </Button>
                )}
            </div>

            {selectedItem ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4 overflow-y-auto custom-scrollbar flex-1">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black ${selectedItem.color || 'bg-slate-400'}`}>
                                {selectedItem.name?.slice(0, 2)}
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800">{selectedItem.name}</h4>
                                <p className="text-xs text-slate-400 font-bold" dir="ltr">{getPersonalId(selectedItem)}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)} className="text-slate-400 font-bold">X</Button>
                    </div>
                    {/* Item Details Grid */}
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">צוות</span>
                            <span className="text-sm font-bold text-slate-700">{teamsMap?.[getProp(selectedItem, 'team_id', 'teamId')]?.name || 'לא משויך'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">תפקידים</span>
                            <div className="flex flex-wrap gap-1">
                                {(() => {
                                    const roleIds = getProp(selectedItem, 'role_ids', 'roleIds');
                                    const roleId = getProp(selectedItem, 'role_id', 'roleId');

                                    if (roleIds && roleIds.length > 0) {
                                        return roleIds.map((rid: string) => (
                                            <span key={rid} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-700">
                                                {rolesMap?.[rid]?.name || rid}
                                            </span>
                                        ));
                                    } else {
                                        return <span className="text-sm font-bold text-slate-700">{rolesMap?.[roleId]?.name || 'לא הוגדר'}</span>;
                                    }
                                })()}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">טלפון</span>
                            <span className="text-sm font-bold text-slate-700" dir="ltr">{selectedItem.phone || 'אין'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">דוא"ל</span>
                            <span className="text-sm font-bold text-slate-700">{selectedItem.email || 'אין'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">מפקד</span>
                            <span className={`text-sm font-bold ${getProp(selectedItem, 'is_commander', 'isCommander') ? 'text-blue-600' : 'text-slate-700'}`}>{getProp(selectedItem, 'is_commander', 'isCommander') ? 'כן' : 'לא'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">סטטוס</span>
                            <span className={`text-sm font-bold ${getProp(selectedItem, 'is_active', 'isActive') === false ? 'text-red-500' : 'text-emerald-500'}`}>{getProp(selectedItem, 'is_active', 'isActive') === false ? 'לא פעיל' : 'פעיל'}</span>
                        </div>
                    </div>

                    {tableName === 'task_templates' && selectedItem.segments && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">סגמנטים ושיבוצים ({selectedItem.segments.length})</h5>
                            <div className="space-y-3">
                                {selectedItem.segments.map((seg: any, sIdx: number) => (
                                    <div key={seg.id || sIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">{seg.name || `סגמנט ${sIdx + 1}`}</div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                    <Clock size={12} />
                                                    {seg.startTime} ({seg.durationHours} שעות)
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                    <Users size={12} />
                                                    {seg.requiredPeople} אנשים
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                            {seg.roleComposition?.map((rc: any, rcIdx: number) => (
                                                <span key={rcIdx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500">
                                                    {rolesMap?.[rc.roleId]?.name || rc.roleId}: {rc.count}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className={`
                    ${(tableName === 'daily_presence' || tableName === 'unified_presence') ? 'flex flex-col flex-1 min-h-0' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto custom-scrollbar'}
                    p-1 flex-1 min-h-0
                `}>
                    {data.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400 font-bold italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">אין נתונים להציג בגרסה זו</div>
                    ) : (
                        (tableName === 'daily_presence' || tableName === 'unified_presence')
                            ? renderAttendanceGrid()
                            : data.map((item, idx) => renderItem(item, idx))
                    )}
                </div>
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};
