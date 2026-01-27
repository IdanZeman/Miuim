import React, { useMemo } from 'react';
import { Person, Shift, Team, TaskTemplate, TeamRotation, Absence, HourlyBlockage, OrganizationSettings } from '@/types';
import { X, User, Clock, Coffee, CalendarCheck, Warning, Info, ArrowRight, Sparkle, Checks, ArrowLeft } from '@phosphor-icons/react';
import { getEffectiveAvailability, isPersonPresentAtHour, isStatusPresent } from '@/utils/attendanceUtils';
import { Button } from '@/components/ui/Button';

interface IdlePersonnelInsightsProps {
    people: Person[];
    shifts: Shift[];
    teams: Team[];
    taskTemplates: TaskTemplate[];
    selectedDate: Date;
    teamRotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
    settings: OrganizationSettings | null;
    onClose: () => void;
    onAssignClick?: (person: Person, shiftId?: string) => void;
    forceShowDemo?: boolean;
    constraints?: import('@/types').SchedulingConstraint[];
}

export const IdlePersonnelInsights: React.FC<IdlePersonnelInsightsProps> = ({
    people,
    shifts,
    teams,
    taskTemplates,
    selectedDate,
    teamRotations,
    absences,
    hourlyBlockages,
    settings,
    onClose,
    onAssignClick,
    forceShowDemo = false,
    constraints = []
}) => {
    const now = new Date();
    const isSelectedDayToday = selectedDate.toLocaleDateString('en-CA') === now.toLocaleDateString('en-CA');
    const referenceTime = isSelectedDayToday ? now : new Date(selectedDate.setHours(10, 0, 0, 0)); // Default to 10 AM if not today

    const idlePeopleData = useMemo(() => {
        const timeStr = referenceTime.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });

        // Find shifts that are under-staffed and end in the future
        const underStaffedShifts = shifts.filter(s => {
            const task = taskTemplates.find(t => t.id === s.taskId);
            const segment = task?.segments.find(seg => seg.id === s.segmentId);
            const reqCount = s.requirements?.requiredPeople || segment?.requiredPeople || 1;
            const isFuture = new Date(s.endTime) > now;
            return !s.isCancelled && isFuture && s.assignedPersonIds.length < reqCount;
        });

        const globalHasUnderstaffed = underStaffedShifts.length > 0;

        const processedPeople = people.filter(person => {
            // 1. Must be present or arriving later today
            const avail = getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages);
            const timeInMinutes = referenceTime.getHours() * 60 + referenceTime.getMinutes();
            const isPresent = isStatusPresent(avail, timeInMinutes);


            // If they are not present, they MUST be arriving later to be included.
            // If they ARE present, we include them (unless they are arriving later, which we handle via display logic)
            if (!isPresent) return false;

            // 2. No active shift now
            const activeShift = shifts.find(s => {
                const start = new Date(s.startTime);
                const end = new Date(s.endTime);
                return !s.isCancelled && s.assignedPersonIds.includes(person.id) && referenceTime >= start && referenceTime < end;
            });
            if (activeShift) return false;

            // 3. Rested enough
            const pastShifts = shifts
                .filter(s => !s.isCancelled && s.assignedPersonIds.includes(person.id) && new Date(s.endTime) <= referenceTime)
                .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

            const lastShift = pastShifts[0];
            if (lastShift) {
                const restRequirement = lastShift.requirements?.minRest || 4;
                const restEndTime = new Date(new Date(lastShift.endTime).getTime() + restRequirement * 60 * 60 * 1000);
                if (referenceTime < restEndTime) return false;
            }

            // 4. Scheduling Constraints (NEW)
            const isTimeBlockedNow = constraints.some(c => {
                if (c.type !== 'time_block' || !c.startTime || !c.endTime) return false;
                if (c.personId && c.personId !== person.id) return false;
                if (c.teamId && c.teamId !== person.teamId) return false;
                if (c.roleId && !(person.roleIds || [person.roleId]).includes(c.roleId)) return false;
                const bs = new Date(c.startTime);
                const be = new Date(c.endTime);
                return bs < referenceTime && be > referenceTime;
            });
            if (isTimeBlockedNow) return false;

            // If pinned to a task that is active NOW, they aren't idle
            const pinnedActiveTaskNow = constraints.find(c => {
                if (c.type !== 'always_assign' || !c.taskId) return false;
                if (c.personId && c.personId !== person.id) return false;
                if (c.teamId && c.teamId !== person.teamId) return false;
                if (c.roleId && !(person.roleIds || [person.roleId]).includes(c.roleId)) return false;

                // Find if THIS specific task they are pinned to is running now
                return shifts.some(s => {
                    const sStart = new Date(s.startTime);
                    const sEnd = new Date(s.endTime);
                    return s.taskId === c.taskId && !s.isCancelled && referenceTime >= sStart && referenceTime < sEnd;
                });
            });
            if (pinnedActiveTaskNow) return false;

            return true;
        }).map(person => {
            const avail = getEffectiveAvailability(person, selectedDate, teamRotations, absences, hourlyBlockages);

            // NEW: Find if they are pinned to ANY task (to show in UI)
            const pinnedConstraint = constraints.find(c =>
                c.type === 'always_assign' &&
                c.taskId &&
                (c.personId === person.id || (c.teamId && person.teamId === c.teamId) || (c.roleId && (person.roleIds || [person.roleId]).includes(c.roleId)))
            );
            const pinnedTask = pinnedConstraint ? taskTemplates.find(t => t.id === pinnedConstraint.taskId) : null;
            const timeInMinutes = referenceTime.getHours() * 60 + referenceTime.getMinutes();
            const isPresent = isStatusPresent(avail, timeInMinutes);

            const pastShifts = shifts
                .filter(s => !s.isCancelled && s.assignedPersonIds.includes(person.id) && new Date(s.endTime) <= referenceTime)
                .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

            const nextShifts = shifts
                .filter(s => !s.isCancelled && s.assignedPersonIds.includes(person.id) && new Date(s.startTime) > referenceTime)
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            const lastShift = pastShifts[0];
            const nextShift = nextShifts[0];

            let idleTimeMinutes = 0;
            if (lastShift) {
                const restRequirement = lastShift.requirements?.minRest || 4;
                const restEndTime = new Date(new Date(lastShift.endTime).getTime() + restRequirement * 60 * 60 * 1000);
                idleTimeMinutes = Math.max(0, Math.floor((referenceTime.getTime() - restEndTime.getTime()) / 60000));
            } else {
                const morning = new Date(referenceTime);
                morning.setHours(8, 0, 0, 0);
                idleTimeMinutes = Math.max(0, Math.floor((referenceTime.getTime() - morning.getTime()) / 60000));
            }

            const reasons = {
                role: 0,
                rest: 0,
                conflict: 0
            };

            const suggestions = underStaffedShifts.filter(s => {
                const task = taskTemplates.find(t => t.id === s.taskId);
                if (!task) return false;
                const segment = task.segments.find(seg => seg.id === s.segmentId);

                const sStart = new Date(s.startTime);
                const sEnd = new Date(s.endTime);

                // 1. Time logic: Shift must start after the person is available (lastShift + rest)
                let minStartTimeMillis = referenceTime.getTime();
                if (lastShift) {
                    const restReq = lastShift.requirements?.minRest || 4;
                    const restEndTime = new Date(lastShift.endTime).getTime() + restReq * 60 * 60 * 1000;
                    minStartTimeMillis = Math.max(minStartTimeMillis, restEndTime);
                }

                // If arriving later, tasks can only start after arrival
                if (avail.status === 'arrival' && avail.startHour) {
                    const [h, m] = avail.startHour.split(':').map(Number);
                    const arrivalTime = new Date(selectedDate);
                    arrivalTime.setHours(h, m, 0, 0);
                    if (arrivalTime.getTime() > minStartTimeMillis) {
                        minStartTimeMillis = arrivalTime.getTime();
                    }
                }

                minStartTimeMillis = Math.max(minStartTimeMillis, now.getTime());

                if (sStart.getTime() < minStartTimeMillis) {
                    reasons.rest++;
                    return false;
                }

                // 2. Conflict logic: If there's a next shift, this replacement must end before nextShift starts
                if (nextShift) {
                    const taskRestReq = s.requirements?.minRest || segment?.minRestHoursAfter || 4;
                    const requiredGapMs = taskRestReq * 60 * 60 * 1000;
                    if (sEnd.getTime() + requiredGapMs > new Date(nextShift.startTime).getTime()) {
                        reasons.conflict++;
                        return false;
                    }
                }

                // 3. Role logic: Check if person has one of the required roles
                const requiredRoles = s.requirements?.roleComposition?.map(r => r.roleId) || segment?.roleComposition?.map(r => r.roleId) || [];
                if (requiredRoles.length > 0) {
                    const personRoles = [person.roleId, ...(person.roleIds || [])].filter(Boolean);
                    const hasRequiredRole = requiredRoles.some(roleId => personRoles.includes(roleId));
                    if (!hasRequiredRole) {
                        reasons.role++;
                        return false;
                    }
                }

                // 4. Scheduling Constraints (NEW)
                const isNeverAssign = constraints.some(c =>
                    c.type === 'never_assign' &&
                    c.taskId === s.taskId &&
                    (c.personId === person.id || (c.teamId && person.teamId === c.teamId) || (c.roleId && (person.roleIds || [person.roleId]).includes(c.roleId)))
                );
                if (isNeverAssign) return false;

                const isPinnedToDifferentTask = constraints.some(c =>
                    c.type === 'always_assign' &&
                    c.taskId !== s.taskId &&
                    (c.personId === person.id || (c.teamId && person.teamId === c.teamId) || (c.roleId && (person.roleIds || [person.roleId]).includes(c.roleId)))
                );
                if (isPinnedToDifferentTask) return false;

                const isTimeBlockedForShift = constraints.some(c => {
                    if (c.type !== 'time_block' || !c.startTime || !c.endTime) return false;
                    if (c.personId && c.personId !== person.id) return false;
                    if (c.teamId && c.teamId !== person.teamId) return false;
                    if (c.roleId && !(person.roleIds || [person.roleId]).includes(c.roleId)) return false;
                    const bs = new Date(c.startTime);
                    const be = new Date(c.endTime);
                    return bs < sEnd && be > sStart;
                });
                if (isTimeBlockedForShift) return false;

                return true;
            })
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .slice(0, 2);

            return {
                person,
                lastShift,
                nextShift,
                idleTimeMinutes,
                suggestions,
                reasons,
                team: teams.find(t => t.id === person.teamId),
                pinnedTask,
                effectiveAvailability: avail
            };
        }).sort((a, b) => {
            // Priority 1: Soldiers with suggestions first
            if (a.suggestions.length > 0 && b.suggestions.length === 0) return -1;
            if (a.suggestions.length === 0 && b.suggestions.length > 0) return 1;
            // Priority 2: Then by idle time (descending)
            return b.idleTimeMinutes - a.idleTimeMinutes;
        });

        let finalPeople = processedPeople.filter(p => p.suggestions.length > 0 || forceShowDemo);
        if (finalPeople.length === 0 && forceShowDemo) {
            // Create a mock person for the tour
            const mockPerson: Person = {
                id: 'demo-p1',
                name: 'מתן דמו כהן',
                organization_id: 'demo-org',
                roleId: 'soldier',
                roleIds: ['soldier'],
                teamId: teams[0]?.id || 'demo-team',
                phone: '050-0000000',
                email: 'demo@example.com',
                color: '#indigo-500',
                maxShiftsPerWeek: 5
            };

            const demoData = {
                person: mockPerson,
                lastShift: shifts[0] || null,
                nextShift: shifts[1] || null,
                idleTimeMinutes: 125, // 2h 5m
                suggestions: shifts.slice(0, 2).map(s => ({ ...s, id: `demo-s-${s.id}` })),
                reasons: { role: 0, rest: 0, conflict: 0 },
                team: teams[0]
            };

            finalPeople = [demoData as any];
        }

        return {
            people: finalPeople,
            globalHasUnderstaffed: globalHasUnderstaffed || (forceShowDemo && finalPeople.length > 0)
        };
    }, [people, shifts, selectedDate, teamRotations, absences, hourlyBlockages, teams, referenceTime, taskTemplates, now, forceShowDemo]);

    const { people: idlePeople, globalHasUnderstaffed } = idlePeopleData;

    const [pendingAssignment, setPendingAssignment] = React.useState<{ person: Person, shift: Shift } | null>(null);

    const handleSuggestionClick = (person: Person, shift: Shift) => {
        setPendingAssignment({ person, shift });
    };

    const handleConfirmAssignment = () => {
        if (pendingAssignment) {
            onAssignClick?.(pendingAssignment.person, pendingAssignment.shift.id);
            setPendingAssignment(null);
        }
    };

    const formatIdleTime = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins} דק'`;
        return `${hours} ש' ו-${mins} דק'`;
    };

    return (
        <div id="tour-idle-panel" className="fixed top-16 bottom-0 left-0 z-[1000] w-96 bg-white/80 backdrop-blur-2xl border-r border-slate-200 shadow-2xl animate-in slide-in-from-left duration-500 overflow-hidden flex flex-col" data-component="IdlePersonnelInsights">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white/50">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100">
                            <Coffee size={24} weight="duotone" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">תמונת מצב פנויים</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {isSelectedDayToday ? 'זמן אמת' : `לתאריך ${selectedDate.toLocaleDateString('he-IL')}`}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} weight="bold" />
                    </button>
                </div>

                <div className="mt-4 flex items-center justify-between p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
                    <div className="text-center">
                        <span className="block text-xl font-black text-indigo-700 leading-none">{idlePeople.length}</span>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">חיילים פנויים</span>
                    </div>
                    <div className="h-8 w-px bg-indigo-100" />
                    <div className="text-center">
                        <span className="block text-xl font-black text-indigo-700 leading-none">
                            {Math.round((idlePeople.length / Math.max(1, people.length)) * 100)}%
                        </span>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">זמינות נוכחית</span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div id="tour-idle-list" className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 relative">
                {pendingAssignment && (
                    <div className="absolute inset-0 bg-white/95 z-50 flex flex-col animate-in fade-in duration-200">
                        <div className="flex-1 p-6 flex flex-col">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 shadow-sm border border-indigo-100 mx-auto">
                                <Checks size={24} weight="bold" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800 text-center mb-1">אישור שיבוץ</h3>
                            <p className="text-xs text-slate-500 text-center mb-6">אנא אשר את פרטי השיבוץ לפני הביצוע</p>

                            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-6">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400">חייל</span>
                                    <span className="text-sm font-bold text-slate-800">{pendingAssignment.person.name}</span>
                                </div>
                                <div className="h-px bg-slate-200" />
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400">משימה</span>
                                    {(() => {
                                        const task = taskTemplates.find(t => t.id === pendingAssignment.shift.taskId);
                                        return <span className="text-sm font-bold text-slate-800" style={{ color: task?.color }}>{task?.name}</span>;
                                    })()}
                                </div>
                                <div className="h-px bg-slate-200" />
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-400">שעות</span>
                                    <span dir="ltr" className="text-sm font-mono font-bold text-slate-600">
                                        {new Date(pendingAssignment.shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(pendingAssignment.shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-auto">
                                <div className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-1">לפני השיבוץ</div>
                                    <div className="text-xl font-black text-slate-700">
                                        {pendingAssignment.shift.assignedPersonIds.length}
                                        <span className="text-xs font-medium text-slate-400 mr-1">כוח אדם</span>
                                    </div>
                                </div>
                                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-center relative overflow-hidden">
                                    <div className="absolute inset-0 bg-indigo-100/20" />
                                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight mb-1 relative">אחרי השיבוץ</div>
                                    <div className="text-xl font-black text-indigo-700 relative">
                                        {pendingAssignment.shift.assignedPersonIds.length + 1}
                                        <span className="text-xs font-medium text-indigo-400 mr-1">כוח אדם</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 mt-4">
                                <Button variant="outline" className="flex-1" onClick={() => setPendingAssignment(null)}>
                                    ביטול
                                </Button>
                                <Button onClick={handleConfirmAssignment} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200">
                                    אשר שיבוץ
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                {!globalHasUnderstaffed && (
                    <div className="mb-4 p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                        <Warning size={18} className="text-amber-500 shrink-0 mt-0.5" weight="bold" />
                        <div>
                            <p className="text-xs font-bold text-amber-900 leading-snug">אין משימות פנויות ביומן</p>
                            <p className="text-[10px] text-amber-700 font-medium">המערכת לא מצאה משימות שחסרים בהן אנשים. כדי לקבל הצעות, וודא שיש משימות בלוח ושטרם שיבצת בהן את כל כוח האדם הנדרש.</p>
                        </div>
                    </div>
                )}

                {idlePeople.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
                            <User size={32} className="text-slate-300" weight="bold" />
                        </div>
                        <p className="font-bold text-slate-500">אין חיילים פנויים כרגע</p>
                        <p className="text-xs text-slate-400">כולם משובצים או נמצאים במנוחה</p>
                    </div>
                ) : (
                    idlePeople.map(({ person, lastShift, nextShift, idleTimeMinutes, suggestions, reasons, team, pinnedTask }) => {
                        const nextTask = nextShift ? taskTemplates.find(t => t.id === nextShift.taskId) : null;
                        const lastTask = lastShift ? taskTemplates.find(t => t.id === lastShift.taskId) : null;

                        return (
                            <div
                                key={person.id}
                                id="tour-idle-card"
                                className="group relative bg-white border border-slate-100 rounded-2xl p-4 hover:shadow-xl hover:shadow-indigo-500/5 hover:border-indigo-100 transition-all duration-300 cursor-default"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-indigo-600 bg-indigo-50 font-black text-sm shadow-sm border border-indigo-100"
                                        >
                                            {person.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-slate-800 text-sm leading-none mb-1">{person.name}</h4>
                                                {pinnedTask && (
                                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-[8px] font-black text-emerald-600 border border-emerald-100 uppercase tracking-tighter">
                                                        <Sparkle size={8} weight="fill" />
                                                        <span>מיועד ל: {pinnedTask.name}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: team?.color || '#cbd5e1' }}
                                                />
                                                <span className="text-[10px] font-bold text-slate-400">{team?.name || 'ללא צוות'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div id="tour-idle-time" className="text-left">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                                            <Clock size={12} weight="bold" />
                                            <span className="text-[11px] font-black">{formatIdleTime(idleTimeMinutes)}</span>
                                        </div>
                                        <div className="text-[9px] font-bold text-slate-400 mt-1 uppercase text-right">זמין מסוף מנוחה</div>
                                    </div>
                                </div>

                                <div id="tour-idle-history" className="space-y-2 mb-4">
                                    {lastTask && (
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                            <span className="text-slate-500">סיים משימה:</span>
                                            <span className="font-bold text-slate-700 truncate max-w-[100px]" style={{ color: lastTask.color }}>
                                                {lastTask.name}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mr-auto">
                                                {new Date(lastShift.endTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} בשעה {new Date(lastShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    )}
                                    {nextTask && (
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                            <span className="text-slate-500">משימה הבאה:</span>
                                            <span className="font-bold text-slate-700 truncate max-w-[100px]" style={{ color: nextTask.color }}>
                                                {nextTask.name}
                                            </span>
                                            <span className="text-[9px] text-slate-400 mr-auto">
                                                בעוד {Math.floor((new Date(nextShift.startTime).getTime() - referenceTime.getTime()) / 60000 / 60)} ש'
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Smart Suggestions */}
                                <div id="tour-idle-suggestions" className="space-y-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                                    <div className="flex items-center gap-1.5 mb-2 px-1">
                                        <Sparkle size={14} weight="fill" className="text-indigo-500" />
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">הצעות לשיבוץ מיידי</span>
                                    </div>

                                    {suggestions.length > 0 ? (
                                        suggestions.map(s => {
                                            const task = taskTemplates.find(t => t.id === s.taskId);
                                            const sDate = new Date(s.startTime);
                                            const eDate = new Date(s.endTime);
                                            const isSameDay = sDate.toDateString() === eDate.toDateString();

                                            // Format: "HH:MM - HH:MM" with LTR force
                                            const startStr = sDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            const endStr = eDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
                                            const timeRange = `${startStr} - ${endStr}`;

                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => handleSuggestionClick(person, s)}
                                                    className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 hover:border-indigo-300 hover:shadow-sm transition-all group/s"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-1.5 h-6 rounded-full" style={{ backgroundColor: task?.color }} />
                                                        <div className="text-right">
                                                            <div className="text-[11px] font-bold text-slate-700">{task?.name}</div>
                                                            <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                                                <span>{sDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span>
                                                                <span>•</span>
                                                                <span dir="ltr" className="font-mono text-[10px]">{timeRange}</span>
                                                                {!isSameDay && (
                                                                    <span className="text-amber-600 font-bold bg-amber-50 px-1 rounded text-[8px]">
                                                                        נמשך עד {eDate.getDate()}/{eDate.getMonth() + 1}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center opacity-0 group-hover/s:opacity-100 transition-opacity">
                                                        <Checks size={16} weight="bold" />
                                                    </div>
                                                </button>
                                            )
                                        })
                                    ) : (
                                        <div className="flex flex-col gap-1.5 py-1 px-1">
                                            <div className="flex items-center gap-2 text-[10px] text-slate-400 italic mb-1">
                                                <Info size={12} />
                                                לא נמצאו משימות מתאימות כרגע
                                            </div>
                                            {globalHasUnderstaffed && (
                                                <div className="flex flex-col gap-1 text-[9px] text-slate-400 font-medium pl-2 bg-slate-100/50 p-2 rounded-lg border border-slate-100">
                                                    {reasons.role > 0 && <div className="flex items-start gap-1.5"><span>•</span><span>{reasons.role} משימות דורשות תפקיד אחר</span></div>}
                                                    {reasons.rest > 0 && <div className="flex items-start gap-1.5"><span>•</span><span>{reasons.rest} משימות שחופפות למשימה קודמת או שכבר החלו</span></div>}
                                                    {reasons.conflict > 0 && <div className="flex items-start gap-1.5"><span>•</span><span>{reasons.conflict} משימות המשאירות מנוחה קצרה מדי לפני המשימה הבאה</span></div>}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                                    <button
                                        onClick={() => onAssignClick?.(person)}
                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                                    >
                                        <ArrowLeft size={14} weight="bold" />
                                        משימות של החייל
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200">
                    <Info size={18} className="text-slate-400 shrink-0" weight="bold" />
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        * האלגוריתם מציע משימות המכבדות את זמני המנוחה של החייל (לפני ואחרי המשימה) ומתאימות להגדרת התפקיד שלו.
                    </p>
                </div>
            </div>
        </div>
    );
};
