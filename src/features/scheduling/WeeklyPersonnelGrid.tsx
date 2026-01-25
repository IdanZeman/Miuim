import React, { useState, useMemo, useCallback } from 'react';
import { Person, Shift, TaskTemplate, Team, Role } from '@/types';
import { User, Calendar, Plus, Clock, Warning, CaretDown, CaretRight, Users, SignOut, SignIn, House, Prohibit, X, UserPlus, Info, ClockCounterClockwise } from '@phosphor-icons/react';
import { hexToRgba } from './ScheduleBoard';
import { getAttendanceDisplayInfo, isStatusPresent } from '../../utils/attendanceUtils';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';

const TAILWIND_COLORS_MAP: Record<string, string> = {
    'blue-500': '#3b82f6',
    'red-500': '#ef4444',
    'green-500': '#22c55e',
    'yellow-500': '#eab308',
    'purple-500': '#a855f7',
    'pink-500': '#ec4899',
    'indigo-500': '#6366f1',
    'teal-500': '#14b8a6',
    'orange-500': '#f97316'
};

const getTaskColorHex = (colorString: string): string => {
    if (!colorString) return '#cbd5e1'; // slate-300
    if (colorString.startsWith('#')) return colorString; // Already hex

    // Extract color name from class like 'border-l-blue-500'
    const match = colorString.match(/border-l-([a-z]+-\d+)/);
    if (match && TAILWIND_COLORS_MAP[match[1]]) {
        return TAILWIND_COLORS_MAP[match[1]];
    }

    return '#cbd5e1'; // Fallback
};

interface WeeklyPersonnelGridProps {
    startDate: Date;
    people: Person[];
    shifts: Shift[];
    taskTemplates: TaskTemplate[];
    teams: Team[];
    roles: Role[];
    onAssign: (shiftId: string, personId: string) => void;
    onSelectShift: (shiftId: string) => void;
    isViewer?: boolean;
    absences?: import('@/types').Absence[];
    hourlyBlockages?: import('@/types').HourlyBlockage[];
    teamRotations?: import('@/types').TeamRotation[];
}

// Separate component for each person row to optimize performance
const PersonRow = React.memo<{
    person: Person;
    days: Date[];
    weekShifts: Shift[];
    taskTemplates: TaskTemplate[];
    roles: Role[];
    isViewer: boolean;
    teamRotations: any[];
    absences: any[];
    hourlyBlockages: any[];
    onSelectShift: (id: string) => void;
    onAssign: (sId: string, pId: string) => void;
    setQuickAssignTarget: (t: any) => void;
    getDayKey: (d: Date) => string;
    dragOverCell: any;
    handleDragOver: any;
    handleDrop: any;
    setDragOverCell: (c: any) => void;
    formatTime: (t: string) => string;
}>(({ person, days, weekShifts, taskTemplates, roles, isViewer, teamRotations, absences, hourlyBlockages, onSelectShift, onAssign, setQuickAssignTarget, getDayKey, dragOverCell, handleDragOver, handleDrop, setDragOverCell, formatTime }) => {

    const getPersonShiftsForDay = useCallback((dayIndex: number) => {
        const colNum = dayIndex + 1;
        const visualShifts: any[] = [];
        const personShifts = weekShifts.filter(s => s.assignedPersonIds.includes(person.id));

        personShifts.forEach(s => {
            const sStart = new Date(s.startTime);
            const sEnd = new Date(s.endTime);
            const dayStart = new Date(days[dayIndex]);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const overlapStart = sStart > dayStart ? sStart : dayStart;
            const overlapEnd = sEnd < dayEnd ? sEnd : dayEnd;

            if (overlapStart < overlapEnd) {
                if (overlapEnd.getTime() === dayStart.getTime() && dayIndex > 0) return;
                visualShifts.push({
                    ...s,
                    _visualId: `${s.id}-${dayIndex}`,
                    _isSplitStart: sStart < dayStart,
                    _isSplitEnd: sEnd > dayEnd,
                    _virtualStartTime: overlapStart.getTime()
                });
            }
        });
        return visualShifts.sort((a, b) => a._virtualStartTime - b._virtualStartTime);
    }, [weekShifts, person.id, days]);

    return (
        <div className="grid grid-cols-[120px_repeat(7,minmax(120px,1fr))] md:grid-cols-[200px_repeat(7,minmax(150px,1fr))] border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 transition-colors group/row shrink-0">
            <div className="p-2.5 md:p-3.5 border-l border-slate-200 flex items-center gap-2 md:gap-3 bg-white sticky right-0 z-[60] shadow-[10px_0_15px_-5px_rgba(0,0,0,0.08)] border-l-4 border-l-transparent group-hover/row:border-l-blue-400 transition-all" style={{ backgroundColor: '#ffffff' }}>
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center shrink-0 border border-slate-100 shadow-sm"><User size={16} className="text-slate-400" /></div>
                <div className="flex flex-col overflow-hidden">
                    <span className="font-bold text-slate-800 text-[11px] md:text-[13px] truncate leading-tight">{person.name}</span>
                    <span className="text-[9px] md:text-[10px] text-slate-400 font-bold truncate mt-0.5">{roles.find(r => r.id === person.roleId)?.name || 'ללא תפקיד'}</span>
                </div>
            </div>

            <div className="col-span-7 grid grid-cols-7 relative auto-rows-min overflow-visible">
                {days.map((day, i) => {
                    const isToday = new Date().toDateString() === day.toDateString();
                    const attendance = getAttendanceDisplayInfo(person, day, teamRotations, absences, hourlyBlockages);
                    const dateKey = getDayKey(day);
                    const isDragHovered = dragOverCell?.personId === person.id && dragOverCell?.dateKey === dateKey;
                    const isForbiddenDrag = isDragHovered && (attendance.isHome || !attendance.availability.isAvailable);
                    const dayShifts = getPersonShiftsForDay(i);

                    return (
                        <div key={i} className={`border-l border-slate-100 last:border-l-0 min-h-[100px] flex flex-col gap-1 transition-all relative ${i % 2 === 0 ? 'bg-slate-50/20' : 'bg-white'} ${isToday ? 'bg-blue-50/10' : ''}`}>
                            <div className="absolute inset-0 pointer-events-none">
                                <div className={`w-full h-full transition-colors ${isDragHovered ? (isForbiddenDrag ? 'bg-red-100/40 ring-2 ring-red-400 ring-inset' : 'bg-blue-100/40 ring-2 ring-blue-400 ring-inset') : ''}`} />
                            </div>

                            {isDragHovered && (
                                <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 text-center z-[45] pointer-events-none animate-in fade-in duration-200 ${isForbiddenDrag ? 'bg-red-50/20' : 'bg-blue-50/10'}`}>
                                    {isForbiddenDrag ? (
                                        <><div className="p-1.5 bg-red-500 rounded-full shadow-lg mb-1"><Warning size={22} weight="fill" className="text-white" /></div><span className="text-[11px] font-black text-red-600 bg-white/90 px-2 py-0.5 rounded shadow-sm leading-tight">החייל בחופשה</span></>
                                    ) : (
                                        <><div className="p-1.5 bg-blue-500 rounded-full shadow-lg mb-1"><UserPlus size={22} weight="fill" className="text-white" /></div><span className="text-[11px] font-black text-blue-600 bg-white/90 px-2 py-0.5 rounded shadow-sm leading-tight">שבץ כאן</span></>
                                    )}
                                </div>
                            )}

                            <div className="p-1 flex flex-col gap-0.5 pointer-events-auto relative z-[50]">
                                {attendance.isHome ? (
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[8px] font-black border border-red-100"><House size={10} weight="fill" /><span>{attendance.label}</span></div>
                                ) : (
                                    <div className="flex flex-wrap gap-0.5">
                                        {attendance.isArrival && <div className="flex items-center gap-0.5 px-1 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[8px] font-black border border-emerald-100"><SignIn size={10} weight="bold" /><span>{attendance.availability.startHour}</span></div>}
                                        {attendance.isDeparture && <div className="flex items-center gap-0.5 px-1 py-0.5 bg-amber-50 text-amber-600 rounded text-[8px] font-black border border-amber-100"><SignOut size={10} weight="bold" /><span>{attendance.availability.endHour}</span></div>}
                                        {attendance.availability.unavailableBlocks.length > 0 && attendance.availability.unavailableBlocks.map(block => (<div key={block.id} className="flex items-center gap-0.5 px-1 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black border border-slate-200"><Prohibit size={10} weight="bold" /><span>{block.start}</span></div>))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-1 p-1 pointer-events-none relative z-[45]">
                                {dayShifts.map(shift => {
                                    const task = taskTemplates.find(t => t.id === shift.taskId);
                                    const taskColor = task ? getTaskColorHex(task.color) : '#e2e8f0';
                                    return (
                                        <div key={shift._visualId} onClick={() => onSelectShift(shift.id)} className={`p-1 px-2 rounded-xl border shadow-md cursor-pointer hover:scale-[1.01] transition-transform active:scale-95 group/task relative overflow-hidden pointer-events-auto ${shift._isSplitStart ? 'rounded-r-none border-r-0' : ''} ${shift._isSplitEnd ? 'rounded-l-none border-l-0' : ''}`} style={{ backgroundColor: task ? hexToRgba(taskColor, 0.45) : '#f8fafc', borderColor: taskColor, borderRightWidth: shift._isSplitStart ? 0 : 4, borderRightColor: taskColor }}>
                                            <div className="flex items-center justify-between mb-1 relative z-10">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {shift._isSplitStart && <ClockCounterClockwise size={10} className="text-slate-400 shrink-0" />}
                                                    <span className="text-[9px] md:text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">{task?.name || 'משימה'}{shift._isSplitStart && <span className="mr-1 opacity-50 text-[7px] font-bold">(המשך)</span>}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-0.5 text-[8px] text-slate-600 font-bold bg-white/40 w-full px-1 py-0.5 rounded border border-black/5 relative z-10" dir="ltr"><span>{formatTime(shift.startTime)} → {formatTime(shift.endTime)}</span></div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="absolute inset-0 pointer-events-auto z-[40]" onDragOver={(e) => handleDragOver(e, person.id, day)} onDragLeave={() => setDragOverCell(null)} onDrop={(e) => handleDrop(e, person.id, day)} />

                            {!isViewer && (
                                <div className="mt-auto p-1 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity pointer-events-auto relative z-[50]">
                                    <button onClick={(e) => { e.stopPropagation(); setQuickAssignTarget({ personId: person.id, date: day }); }} className={`w-7 h-7 rounded-full border-2 border-dashed flex items-center justify-center transition-all shadow-sm bg-white active:scale-95 ${attendance.isHome || !attendance.availability.isAvailable ? 'border-red-200 text-red-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50' : 'border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'}`} title={attendance.isHome ? `שים לב: ${attendance.label}` : "שיבוץ מהיר"}><Plus size={14} weight="bold" /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

const WeeklyPersonnelGridBase: React.FC<WeeklyPersonnelGridProps> = ({
    startDate, people, shifts, taskTemplates, teams, roles, onAssign, onSelectShift,
    isViewer = false, absences = [], hourlyBlockages = [], teamRotations = [],
}) => {
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [quickAssignTarget, setQuickAssignTarget] = useState<any>(null);
    const [dragOverCell, setDragOverCell] = useState<any>(null);

    const toggleTeam = useCallback((teamId: string) => {
        setCollapsedTeams(prev => {
            const next = new Set(prev);
            if (next.has(teamId)) next.delete(teamId);
            else next.add(teamId);
            return next;
        });
    }, []);

    const groupedPeople = useMemo(() => {
        const groups: { team: Team | null, members: Person[] }[] = [];
        teams.forEach(team => {
            const members = people.filter(p => p.teamId === team.id);
            if (members.length > 0) groups.push({ team, members });
        });
        const noTeamMembers = people.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
        if (noTeamMembers.length > 0) groups.push({ team: null, members: noTeamMembers });
        return groups;
    }, [people, teams]);

    const days = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        return d;
    }), [startDate]);

    const getDayKey = useCallback((date: Date) => date.toLocaleDateString('en-CA'), []);

    const formatTime = useCallback((timeStr: string) => {
        if (!timeStr) return '--:--';
        if (timeStr.includes('T')) { const date = new Date(timeStr); return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); }
        return timeStr.substring(0, 5);
    }, []);

    const weekShifts = useMemo(() => {
        const weekStart = new Date(startDate);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(startDate);
        weekEnd.setDate(weekEnd.getDate() + 7);
        weekEnd.setHours(23, 59, 59, 999);
        return shifts.filter(s => { const sStart = new Date(s.startTime); const sEnd = new Date(s.endTime); return !(sStart > weekEnd || sEnd < weekStart); });
    }, [shifts, startDate]);

    const handleDragOver = useCallback((e: React.DragEvent, personId: string, dropDate: Date) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const dateKey = getDayKey(dropDate);
        if (dragOverCell?.personId !== personId || dragOverCell?.dateKey !== dateKey) {
            setDragOverCell({ personId, dateKey });
        }
    }, [dragOverCell, getDayKey]);

    const handleDrop = useCallback((e: React.DragEvent, personId: string, dropDate: Date) => {
        e.preventDefault();
        setDragOverCell(null);
        const data = e.dataTransfer.getData('application/json');
        if (!data) return;
        try {
            const { shiftId } = JSON.parse(data);
            const sourceShift = shifts.find(s => s.id === shiftId);
            if (!sourceShift) return;
            const droppedDayKey = getDayKey(dropDate);
            const targetShift = shifts.find(s => { const sDate = new Date(s.startTime).toLocaleDateString('en-CA'); return sDate === droppedDayKey && s.taskId === sourceShift.taskId && s.assignedPersonIds.length === 0; });
            if (targetShift) onAssign(targetShift.id, personId);
            else onAssign(shiftId, personId);
        } catch (err) { console.error('Failed to parse dropped data', err); }
    }, [shifts, getDayKey, onAssign]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm transition-all duration-300">
            <div className="flex-1 overflow-auto min-w-max lg:min-w-0 custom-scrollbar pb-20">
                <div className="grid grid-cols-[120px_repeat(7,minmax(120px,1fr))] md:grid-cols-[200px_repeat(7,minmax(150px,1fr))] border-b border-slate-200 bg-white sticky top-0 z-[80] shrink-0 md:h-[72px]">
                    <div className="p-3 md:p-4 border-l border-slate-200 flex items-center gap-2 bg-white sticky right-0 z-[90] shadow-[10px_0_15px_-5px_rgba(0,0,0,0.08)] h-full border-l-4 border-l-transparent" style={{ backgroundColor: '#ffffff' }}>
                        <User size={18} className="text-slate-400" weight="bold" /><span className="font-bold text-slate-600 text-xs md:text-sm">חייל / יום</span>
                    </div>
                    {days.map((day, i) => (
                        <div key={i} className={`p-2 md:p-4 flex flex-col items-center justify-center border-l border-slate-200 last:border-l-0 h-full ${i % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`} style={{ backgroundColor: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                            <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-0.5 md:mb-1">{day.toLocaleDateString('he-IL', { weekday: 'short' })}</span>
                            <span className={`text-sm md:text-lg font-black ${new Date().toDateString() === day.toDateString() ? 'text-blue-600' : 'text-slate-700'}`}>{day.getDate()}</span>
                        </div>
                    ))}
                </div>

                {groupedPeople.map(({ team, members }) => {
                    const teamId = team?.id || 'no-team';
                    const isCollapsed = collapsedTeams.has(teamId);
                    return (
                        <div key={teamId} className="flex flex-col relative">
                            <div onClick={() => toggleTeam(teamId)} className="grid grid-cols-[120px_repeat(7,minmax(120px,1fr))] md:grid-cols-[200px_repeat(7,minmax(150px,1fr))] border-b border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer sticky top-[72px] z-10 group shrink-0">
                                <div className="p-1.5 md:p-2.5 border-l border-slate-200 flex items-center gap-2 sticky right-0 z-[60] bg-white border-l-4 border-l-blue-200 shadow-[10px_0_15px_-5px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#ffffff' }}>
                                    <div className="flex items-center justify-center w-5 h-5 rounded-md bg-white shadow-sm border border-slate-300 group-hover:border-blue-300 transition-colors">{isCollapsed ? <CaretRight weight="bold" size={12} className="text-slate-400" /> : <CaretDown weight="bold" size={12} className="text-slate-400" />}</div>
                                    <div className="flex items-center gap-1.5 overflow-hidden"><Users size={14} className="text-blue-600 shrink-0" weight="bold" /><span className="font-black text-slate-800 text-[10px] md:text-xs truncate">{team?.name || 'ללא צוות'}<span className="mr-2 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black border border-blue-100">{members.length}</span></span></div>
                                </div>
                                {days.map((_, i) => (<div key={i} className={`border-l border-slate-200/40 last:border-l-0 ${i % 2 === 0 ? 'bg-slate-200/5' : ''}`} />))}
                            </div>
                            {!isCollapsed && members.map(person => (
                                <PersonRow
                                    key={person.id} person={person} days={days} weekShifts={weekShifts} taskTemplates={taskTemplates} roles={roles} isViewer={isViewer} teamRotations={teamRotations} absences={absences} hourlyBlockages={hourlyBlockages} onSelectShift={onSelectShift} onAssign={onAssign} setQuickAssignTarget={setQuickAssignTarget} getDayKey={getDayKey} dragOverCell={dragOverCell} handleDragOver={handleDragOver} handleDrop={handleDrop} setDragOverCell={setDragOverCell} formatTime={formatTime}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>

            {quickAssignTarget && (() => {
                const targetPerson = people.find(p => p.id === quickAssignTarget.personId);
                if (!targetPerson) return null;
                const attendance = getAttendanceDisplayInfo(targetPerson, quickAssignTarget.date, teamRotations, absences, hourlyBlockages);
                const isUnavailable = attendance.isHome || !attendance.availability.isAvailable;
                const checkShiftConflict = (sS: string, sE: string) => {
                    const [sh, sm] = formatTime(sS).split(':').map(Number); const [eh, em] = formatTime(sE).split(':').map(Number);
                    const sM = sh * 60 + sm; let eM = eh * 60 + em; if (eM < sM) eM += 24 * 60;
                    if (!isStatusPresent(attendance.availability, sM) || !isStatusPresent(attendance.availability, eM - 1)) return true;
                    if (attendance.availability.unavailableBlocks?.length > 0) return attendance.availability.unavailableBlocks.some(block => {
                        const [bsh, bsm] = block.start.split(':').map(Number); const [beh, bem] = block.end.split(':').map(Number);
                        const bS = bsh * 60 + bsm; let bE = beh * 60 + bem; if (bE < bS) bE += 24 * 60;
                        return Math.max(sM, bS) < Math.min(eM, bE);
                    });
                    return false;
                };

                if ((isUnavailable || (quickAssignTarget as any)._pendingShiftId) && !quickAssignTarget.confirmed) {
                    const psId = (quickAssignTarget as any)._pendingShiftId; const pS = psId ? shifts.find(s => s.id === psId) : null;
                    return (
                        <GenericModal isOpen={true} onClose={() => setQuickAssignTarget(null)} title={`אזהרת שיבוץ - ${targetPerson.name}`} size="sm">
                            <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
                                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600"><Warning size={40} weight="fill" /></div>
                                <h3 className="text-lg font-black text-slate-800 mb-2">אזהרת שיבוץ</h3>
                                <div className="text-sm text-slate-600 mb-6 leading-relaxed">
                                    <p className="mb-2 text-slate-800 font-bold">שים לב: {targetPerson.name} נמצא במצב "{attendance.label}" בשעות אלו.</p>
                                    {pS && <div className="bg-red-50 p-2 rounded-lg border border-red-100 mt-2 mb-4"><span className="font-bold text-red-700">{taskTemplates.find(t => t.id === pS.taskId)?.name}</span><br /><span className="text-xs" dir="ltr">{formatTime(pS.startTime)} - {formatTime(pS.endTime)}</span></div>}
                                    <p>האם ברצונך להמשיך לשיבוץ בכל זאת?</p>
                                </div>
                                <div className="flex flex-col gap-3 w-full">
                                    <Button variant="primary" className="w-full font-bold py-3 bg-red-600 hover:bg-red-700 border-none" onClick={() => { if (psId) { onAssign(psId, quickAssignTarget.personId); setQuickAssignTarget(null); } else { setQuickAssignTarget({ ...quickAssignTarget, confirmed: true }); } }}>כן, המשך לשיבוץ</Button>
                                    <Button variant="secondary" className="w-full font-bold py-3" onClick={() => setQuickAssignTarget(null)}>ביטול</Button>
                                </div>
                            </div>
                        </GenericModal>
                    );
                }

                return (
                    <GenericModal isOpen={true} onClose={() => setQuickAssignTarget(null)} title={`שיבוץ מהיר - ${targetPerson.name}`} size="sm">
                        <div className="flex flex-col gap-4">
                            <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-3">
                                <Calendar size={20} className="text-blue-600" weight="bold" />
                                <div className="flex flex-col text-right"><span className="text-sm font-bold text-slate-800">{quickAssignTarget.date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span><span className="text-[10px] text-slate-500 font-bold uppercase">משימות זמינות לשיבוץ</span></div>
                            </div>
                            <div className="flex flex-col gap-2">
                                {shifts.filter(s => { const sDate = new Date(s.startTime).toLocaleDateString('en-CA'); const req = s.requirements?.requiredPeople || 1; return sDate === getDayKey(quickAssignTarget.date) && s.assignedPersonIds.length < req && !s.isCancelled; }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()).map(shift => {
                                    const task = taskTemplates.find(t => t.id === shift.taskId); const hasC = checkShiftConflict(shift.startTime, shift.endTime);
                                    const taskColor = task ? getTaskColorHex(task.color) : '#cbd5e1';
                                    return (
                                        <button key={shift.id} onClick={() => { if (hasC && !quickAssignTarget.confirmed) { setQuickAssignTarget({ ...quickAssignTarget, confirmed: true, _pendingShiftId: shift.id } as any); return; } onAssign(shift.id, quickAssignTarget.personId); setQuickAssignTarget(null); }} className={`flex items-center justify-between p-3 rounded-xl border transition-all group/item ${hasC ? 'border-red-200 bg-red-50/30 hover:border-red-400 hover:bg-red-50' : 'border-slate-200 bg-white hover:border-blue-300'}`}>
                                            <div className="flex items-center gap-3"><div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: taskColor }} /><div className="flex flex-col text-right"><div className="flex items-center gap-2"><span className="font-bold text-slate-800 text-sm">{task?.name || 'שיבוץ פנוי'}</span>{hasC && <span className="flex items-center gap-1 text-[9px] font-black text-red-600 bg-white px-1.5 py-0.5 rounded border border-red-100 uppercase"><Warning size={10} weight="fill" />התנגשות שעות</span>}</div><div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold" dir="ltr"><Clock size={12} weight="bold" /><span>{formatTime(shift.startTime)} - {formatTime(shift.endTime)}</span></div></div></div>
                                            <div className={`p-2 rounded-lg transition-colors ${hasC ? 'bg-red-100 text-red-600 group-hover/item:bg-red-600 group-hover/item:text-white' : 'bg-blue-50 text-blue-600 group-hover/item:bg-blue-600 group-hover/item:text-white'}`}>{hasC ? <Warning size={16} weight="bold" /> : <UserPlus size={16} weight="bold" />}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </GenericModal>
                );
            })()}
        </div>
    );
};

export const WeeklyPersonnelGrid = React.memo(WeeklyPersonnelGridBase);
