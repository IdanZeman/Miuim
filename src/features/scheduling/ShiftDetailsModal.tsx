import React from 'react';
import { X, Users } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Person, Shift, TaskTemplate, Role } from "../../types";

interface ShiftDetailsModalProps {
  shift: Shift;
  task: TaskTemplate;
  people: Person[];
  roles: Role[];
  onClose: () => void;
  onUnassign: (shiftId: string, personId: string) => void;
  userRole: string;
  teams?: import("../../types").Team[]; // NEW: Optional teams
}

import { GenericModal } from '../../components/ui/GenericModal';

export const ShiftDetailsModal: React.FC<ShiftDetailsModalProps> = ({
  shift,
  task,
  people,
  roles,
  onClose,
  onUnassign,
  userRole,
  teams
}) => {
  // NEW: Get required role IDs
  let requiredRoleIds: string[] = [];
  let requiredPeople = 0;

  if (shift.requirements) {
    requiredRoleIds = shift.requirements.roleComposition.map(rc => rc.roleId);
    requiredPeople = shift.requirements.requiredPeople;
  } else if (shift.segmentId && task?.segments) {
    const seg = task.segments.find(s => s.id === shift.segmentId);
    if (seg) {
      requiredRoleIds = seg.roleComposition.map(rc => rc.roleId);
      requiredPeople = seg.requiredPeople;
    }
  } else if (task?.segments?.[0]) {
    // Fallback
    requiredRoleIds = task.segments[0].roleComposition.map(rc => rc.roleId);
    requiredPeople = task.segments[0].requiredPeople;
  }

  const startTimeStr = new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const endTimeStr = new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const dateStr = new Date(shift.startTime).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });

  const modalTitle = (
    <div className="flex flex-col gap-0.5">
      <h3 className="text-xl font-black text-slate-800 leading-tight">{task.name}</h3>
      <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
        <Users size={12} className="text-blue-500" weight="duotone" />
        <span>{dateStr} • {startTimeStr} - {endTimeStr}</span>
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
        סגור
      </Button>
    </div>
  );

  return (
    <GenericModal
      isOpen={true}
      onClose={onClose}
      title={modalTitle}
      size="md"
      footer={modalFooter}
    >
      <div className="flex flex-col gap-5 py-2">
        {/* Personnel Section */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
              כוח אדם משובץ
              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{shift.assignedPersonIds.length}/{requiredPeople}</span>
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {shift.assignedPersonIds.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-100 rounded-2xl text-slate-400">
                <Users size={32} className="mb-2 opacity-20" weight="duotone" />
                <p className="text-sm font-bold italic">אין חיילים משובצים למשמרת זו</p>
              </div>
            ) : (
              shift.assignedPersonIds.map(pid => {
                const person = people.find(p => p.id === pid);
                if (!person) return null;

                const assignedTeamId = task.assignedTeamId;
                const isTeamMismatch = assignedTeamId && person.teamId !== assignedTeamId;
                const userRoleIds = person.roleIds || [];
                const isQualified = requiredRoleIds.length === 0 || userRoleIds.some(rid => requiredRoleIds.includes(rid));
                const personRoles = userRoleIds
                  .map(rid => roles.find(r => r.id === rid)?.name)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div
                    key={pid}
                    className={cn(
                      "group relative flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-md bg-white",
                      !isQualified ? "border-red-200 ring-2 ring-red-50" : "border-slate-100"
                    )}
                  >
                    {/* Qualification Strip */}
                    <div className={cn(
                      "absolute right-0 top-3 bottom-3 w-1.5 rounded-l-lg",
                      !isQualified ? "bg-red-500" : isTeamMismatch ? "bg-orange-400" : "bg-blue-500"
                    )} />

                    {/* Avatar */}
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm",
                      person.color.replace('border-', 'bg-') || 'bg-slate-400'
                    )}>
                      {person.name.slice(0, 2)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-black text-slate-800 text-base leading-tight">
                          {person.name}
                        </span>
                        {!isQualified && (
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-full uppercase tracking-tighter border border-red-200">
                            משימה כפויה
                          </span>
                        )}
                        {isTeamMismatch && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-[10px] font-black rounded-full uppercase tracking-tighter border border-orange-200">
                            לא מהצוות
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wide truncate">
                        {personRoles || 'ללא הגדרת תפקידים'}
                      </div>
                    </div>

                    {userRole !== 'viewer' && (
                      <button
                        onClick={() => onUnassign(shift.id, pid)}
                        className="p-2.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                        title="הסר שיבוץ"
                      >
                        <X size={18} weight="bold" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </GenericModal>
  );
};