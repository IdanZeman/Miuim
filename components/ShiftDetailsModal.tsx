import React from 'react';
import { X, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Person, Shift, TaskTemplate, Role } from "../types";

interface ShiftDetailsModalProps {
  shift: Shift;
  task: TaskTemplate;
  people: Person[];
  roles: Role[];
  onClose: () => void;
  onUnassign: (shiftId: string, personId: string) => void;
  userRole: string;
  teams?: import("../types").Team[]; // NEW: Optional teams
}

import { Modal } from './ui/Modal';

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

  return (
    <Modal isOpen={true} onClose={onClose} title={task.name} size="lg">
      <div className="space-y-6">
        {/* Time Header */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
          <div>
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">זמן משמרת</span>
            <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <span>{new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>-</span>
              <span>{new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">תאריך</span>
            <span className="font-bold text-slate-800">{new Date(shift.startTime).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</span>
          </div>
        </div>

        {/* Assigned Personnel Section */}
        <div>
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Users size={18} />
            כוח אדם משובץ ({shift.assignedPersonIds.length}/{requiredPeople})
          </h3>
          <div className="space-y-2">
            {shift.assignedPersonIds.length === 0 ? (
              <p className="text-slate-400 italic text-sm py-4 text-center bg-slate-50 rounded-lg">אין חיילים משובצים למשמרת זו</p>
            ) : (
              shift.assignedPersonIds.map(pid => {
                const person = people.find(p => p.id === pid);
                if (!person) return null;

                // NEW: Team Check
                const assignedTeamId = task.assignedTeamId;
                const isTeamMismatch = assignedTeamId && person.teamId !== assignedTeamId;

                // NEW: Check qualification
                const userRoleIds = person.roleIds || [];
                const isQualified = requiredRoleIds.length === 0 || userRoleIds.some(rid => requiredRoleIds.includes(rid));
                const personRoles = userRoleIds
                  .map(rid => roles.find(r => r.id === rid)?.name)
                  .filter(Boolean)
                  .join(', ');

                return (
                  <div
                    key={pid}
                    className={`p-3 rounded-lg border-2 flex items-start justify-between transition-all ${isQualified
                      ? 'bg-blue-50 border-blue-200'
                      : 'bg-red-50 border-red-500 shadow-red-100 shadow-md'
                      }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {!isQualified && (
                          <span className="text-red-600 text-xl" title="אזהרה: לא מוסמך לתפקיד זה!">
                            ⚠️
                          </span>
                        )}
                        <span className={`font-bold text-lg ${isQualified ? 'text-blue-900' : 'text-red-900'}`}>
                          {person.name}
                        </span>
                        {!isQualified && (
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full flex items-center gap-1">
                            <AlertTriangle size={12} /> שיבוץ כפוי
                          </span>
                        )}
                        {isTeamMismatch && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded-full flex items-center gap-1 border border-orange-200">
                            ⚠️ צוות לא תואם
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        <strong>תפקידים:</strong> {personRoles || 'אין'}
                      </p>
                      {!isQualified && (
                        <p className="text-xs text-red-600 font-bold mt-1 flex items-center gap-1">
                          <AlertTriangle size={12} />
                          אדם זה אינו מוסמך לתפקיד הנדרש במשימה זו!
                        </p>
                      )}
                      {isTeamMismatch && (
                        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                          משובץ: {teams?.find(t => t.id === person.teamId)?.name || 'לא ידוע'}, נדרש: {teams?.find(t => t.id === assignedTeamId)?.name || 'לא ידוע'}
                        </p>
                      )}
                    </div>

                    {userRole !== 'viewer' && (
                      <button
                        onClick={() => onUnassign(shift.id, pid)}
                        className={`p-2 rounded-lg transition-colors ${isQualified
                          ? 'hover:bg-red-100 text-slate-400 hover:text-red-600'
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                          }`}
                        title="הסר שיבוץ"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};