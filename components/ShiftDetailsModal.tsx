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
}

export const ShiftDetailsModal: React.FC<ShiftDetailsModalProps> = ({
  shift,
  task,
  people,
  roles,
  onClose,
  onUnassign,
  userRole
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ...existing header code... */}

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* Assigned Personnel Section */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Users size={18} />
              כוח אדם משובץ ({shift.assignedPersonIds.length}/{requiredPeople})
            </h3>
            <div className="space-y-2">
              {shift.assignedPersonIds.map(pid => {
                const person = people.find(p => p.id === pid);
                if (!person) return null;

                // NEW: Check qualification
                const isQualified = requiredRoleIds.length === 0 || person.roleIds.some(rid => requiredRoleIds.includes(rid));
                const personRoles = person.roleIds
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
              })}
            </div>
          </div>

          {/* ...existing required roles section... */}
        </div>

        {/* ...existing footer... */}
      </div>
    </div>
  );
};