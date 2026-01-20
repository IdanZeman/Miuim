import React from 'react';
import { Shift, TaskTemplate, Person, Role, Team, MissionReport } from '@/types';
import { getPersonInitials } from '@/utils/nameUtils';
import { FileText, ArrowCounterClockwise as RotateCcw, Prohibit as Ban, Warning as AlertTriangle, ClockCounterClockwise, Plus } from '@phosphor-icons/react';

interface ShiftCardProps {
    shift: Shift;
    taskTemplates: TaskTemplate[];
    people: Person[];
    roles: Role[];
    teams: Team[];
    onSelect: (shift: Shift) => void;
    onToggleCancel: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings?: Set<string>;
    missionReports: MissionReport[];
    style?: React.CSSProperties;
    onReportClick: (shift: Shift) => void;
    onAutoSchedule?: () => void;
    isContinuedFromPrev?: boolean;
    isContinuedToNext?: boolean;
    isCompact?: boolean;
    hasAbsenceConflict?: boolean;
    hasRestViolation?: boolean;
    shiftConflicts?: { personId: string; type: string; reason?: string }[];
}

export const ShiftCard: React.FC<ShiftCardProps> = ({
    shift, taskTemplates, people, roles, teams, onSelect, onToggleCancel, onReportClick,
    isViewer, acknowledgedWarnings, missionReports, style,
    isCompact, hasAbsenceConflict, hasRestViolation, shiftConflicts = []
}) => {
    const task = taskTemplates.find(t => t.id === shift.taskId);
    if (!task) return null;
    const assigned = shift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

    // Calc required for display
    const segment = task.segments?.find(s => s.id === shift.segmentId) || task.segments?.[0];
    const req = shift.requirements?.requiredPeople || segment?.requiredPeople || 1;

    // Check for missing roles (not just mismatches)
    const roleComposition = shift.requirements?.roleComposition || segment?.roleComposition || [];
    const missingRoles = roleComposition.filter(rc => {
        const currentCount = assigned.filter(p => p.roleIds?.includes(rc.roleId) || p.roleId === rc.roleId).length;
        return currentCount < rc.count;
    }).map(rc => roles.find(r => r.id === rc.roleId)?.name).filter(Boolean);

    const hasMissingRoles = missingRoles.length > 0;
    const isUnderStaffed = assigned.length < req;
    const isOverStaffed = assigned.length > req;

    // Determine status color
    let bgColor = 'bg-blue-50';
    let borderColor = 'border-blue-200';
    if (shift.isCancelled) {
        bgColor = 'bg-slate-100'; borderColor = 'border-slate-300';
    }
    else if (assigned.length === 0) {
        bgColor = 'bg-white';
    }
    else {
        if (!isUnderStaffed && !isOverStaffed && !hasMissingRoles) {
            bgColor = 'bg-green-50';
            borderColor = 'border-green-200';
        } else if (isUnderStaffed || hasMissingRoles) {
            bgColor = 'bg-amber-50';
            borderColor = 'border-amber-200';
        } else if (isOverStaffed) {
            bgColor = 'bg-purple-50';
            borderColor = 'border-purple-200';
        }
    }

    // Role mismatch check (existing logic, checks if assigned person fits ANY required role)
    const hasRoleMismatch = assigned.some(p => {
        const requiredRoleIds = roleComposition.map(rc => rc.roleId);
        if (requiredRoleIds.length === 0) return false;

        const isMismatch = !p.roleIds?.some(rid => requiredRoleIds.includes(rid)) && !requiredRoleIds.includes(p.roleId);
        return isMismatch && (!acknowledgedWarnings || !acknowledgedWarnings.has(`${shift.id}-${p.id}`));
    });

    // NEW: Check for Team Mismatch
    const assignedTeamId = task.assignedTeamId;
    const hasTeamMismatch = assignedTeamId && assigned.some(p => p.teamId !== assignedTeamId);

    return (
        <div
            id={`shift-card-${shift.id}`}
            className={`absolute flex flex-col ${isCompact ? 'p-0.5' : 'p-1.5'} rounded-md border text-xs cursor-pointer transition-all overflow-hidden ${bgColor} ${borderColor} hover:border-blue-400 group justify-between shadow-sm`}
            style={style}
            onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
            title={hasMissingRoles ? `חסרים תפקידים: ${missingRoles.join(', ')}` : undefined}
        >
            {/* Action Buttons - Absolute Positioned (Top Left) */}
            <div className="absolute top-1 left-1 flex items-center gap-0.5 z-20">

                <button
                    onClick={(e) => { e.stopPropagation(); onReportClick(shift); }}
                    className={`p-0.5 md:p-1.5 rounded shadow-sm text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200
                        ${missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-white/50 hover:bg-white'}
                    `}
                    title={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "דוח הוגש - לחץ לצפייה" : "דוח משימה"}
                >
                    <FileText size={14} weight={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "fill" : "bold"} className={missionReports.find(r => r.shift_id === shift.id)?.submitted_at ? "text-blue-600" : ""} />
                </button>
                {!isViewer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCancel(shift.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 bg-white/50 hover:bg-white rounded shadow-sm text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-slate-200"
                        title={shift.isCancelled ? 'הפעל משמרת' : 'בטל משמרת'}
                    >
                        {shift.isCancelled ? <RotateCcw size={12} className="text-blue-500" weight="bold" /> : <Ban size={12} weight="bold" />}
                    </button>
                )}
            </div>

            {/* Top Row: Task Name */}
            <div className={`flex font-bold truncate text-slate-800 ${isCompact ? 'text-[9px] pl-10' : 'text-[11px] md:text-sm pl-12'} items-start w-full`}>
                <div className="flex items-center gap-1 truncate w-full">
                    {shift.isCancelled && <Ban size={12} className="text-red-500 mr-1 shrink-0" weight="bold" />}

                    {/* Inline Warnings */}
                    {hasRoleMismatch && !hasMissingRoles && (
                        <AlertTriangle size={12} className="text-amber-500 shrink-0" weight="bold" />
                    )}
                    {hasMissingRoles && (
                        <AlertTriangle size={12} className="text-red-500 drop-shadow-sm shrink-0" weight="bold" />
                    )}
                    {hasTeamMismatch && (
                        <span title="ישנם משובצים שאינם מהצוות המוגדר!">
                            <AlertTriangle size={12} className="text-orange-500 shrink-0" weight="bold" />
                        </span>
                    )}
                    {hasAbsenceConflict && (
                        <span title="חייל בבית / לא זמין במערכת הנוכחות">
                            <Ban size={12} className="text-red-500 shrink-0 animate-pulse" weight="bold" />
                        </span>
                    )}
                    {hasRestViolation && (
                        <span title="חייל ללא זמן מנוחה מספיק">
                            <ClockCounterClockwise size={12} className="text-red-600 shrink-0" weight="bold" />
                        </span>
                    )}
                    {isOverStaffed && (
                        <span title="חריגה מהתקן (יותר מדי אנשים)">
                            <Plus size={12} className="text-purple-600 shrink-0" weight="bold" />
                        </span>
                    )}

                    {task.assignedTeamId && (
                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded shadow-sm mr-1 shrink-0 font-bold tracking-tight">
                            {teams.find(t => t.id === task.assignedTeamId)?.name}
                        </span>
                    )}
                    <span className="truncate">{task.name}</span>
                </div>
            </div>

            {/* Middle Row - Names (Adaptive - Desktop Only) */}
            {
                (style?.height && parseInt(String(style.height)) >= 45 && assigned.length > 0) && (() => {
                    const cardHeight = parseInt(String(style.height));

                    // A full name chip + gap is roughly 28px. 
                    // Header/Footer take about 32px of space.
                    const maxVerticalNames = Math.max(1, Math.floor((cardHeight - 32) / 28));

                    // If we have fewer people than available vertical slots, we can show full names in a column
                    const isCrowded = assigned.length > maxVerticalNames;

                    return (
                        <div className={`hidden md:flex flex-1 ${isCrowded ? 'flex-row flex-wrap content-center justify-center' : 'flex-col justify-center items-center'} gap-1 overflow-hidden py-0.5 w-full px-1`}>
                            {assigned.map(p => {
                                // Only use initials if it's truly crowded (more people than vertical slots)
                                const useInitials = isCrowded;
                                const conflict = shiftConflicts.find(c => c.personId === p.id && c.type === 'absence');
                                const isProblematic = !!conflict;
                                return (
                                    <div
                                        key={p.id}
                                        className={`shadow-sm border 
                                        ${isProblematic ? 'border-red-400 bg-red-50 text-red-600 animate-pulse' : 'border-slate-200/60 bg-white/95 text-slate-800'}
                                        ${isCrowded ? 'px-1.5 py-0.5 text-[10px]' : 'w-full max-w-[95%] px-2 py-0.5 text-xs'} 
                                        rounded-full font-bold truncate text-center hover:scale-105 transition-transform hover:shadow-md cursor-help z-10`}
                                        title={isProblematic ? `${p.name}: ${conflict.reason}` : p.name}
                                        onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
                                    >
                                        {useInitials ? getPersonInitials(p.name) : p.name}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()
            }

            {/* Bottom Row: Info & Avatars (Fallback) */}
            <div className={`flex items-end justify-between ${!(style?.height && parseInt(String(style.height)) >= 50 && assigned.length > 0) ? 'mt-auto' : ''} pt-1 w-full overflow-hidden`}>

                {/* Staffing Count */}
                {(!isCompact || (style?.height && parseInt(String(style.height)) >= 28)) && (
                    <div className={`text-[10px] font-medium leading-none flex-shrink-0 ml-1 mb-0.5 ${hasMissingRoles || isUnderStaffed ? 'text-red-500 font-bold' : (isOverStaffed ? 'text-purple-600 font-bold' : 'text-slate-400')}`}>
                        {assigned.length}/{req}
                    </div>
                )}

                {/* Avatars Logic */}
                {(assigned.length > 0 && (!isCompact || (style?.height && parseInt(String(style.height)) >= 32))) && (
                    <div className={`flex -space-x-1.5 space-x-reverse overflow-hidden px-1 pb-0.5 ${(style?.height && parseInt(String(style.height)) >= 50) ? 'md:hidden' : ''}`}>
                        {assigned.map(p => {
                            const conflict = shiftConflicts.find(c => c.personId === p.id && c.type === 'absence');
                            const isProblematic = !!conflict;
                            return (
                                <div key={p.id} className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white font-bold ring-2 ${isProblematic ? 'ring-red-500 animate-pulse' : 'ring-white'} ${p.color} shadow-sm relative`} title={isProblematic ? `${p.name}: ${conflict.reason}` : p.name}>
                                    {getPersonInitials(p.name)}
                                    {isProblematic && (
                                        <div className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-0.5 border border-white">
                                            <Ban size={6} weight="bold" />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div >
    );
};
