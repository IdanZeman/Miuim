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
  const requiredRoleIds = task?.roleComposition.map(rc => rc.roleId) || [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ...existing header code... */}

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
          {/* ...existing task info... */}

          {/* Assigned Personnel Section */}
          <div>
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Users size={18} />
              כוח אדם משובץ ({shift.assignedPersonIds.length}/{task?.requiredPeople || 0})
            </h3>
            <div className="space-y-2">
              {shift.assignedPersonIds.map(pid => {
                const person = people.find(p => p.id === pid);
                if (!person) return null;

                // remove qualification / mismatch logic
                return (
                  <div
                    key={pid}
                    className="p-3 rounded-lg border-2 flex items-start justify-between transition-all bg-blue-50 border-blue-200"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-blue-900">{person.name}</span>
                      </div>
                      <p className="text-sm text-slate-600">
                        <strong>תפקידים:</strong> {person.roleIds.map(rid => roles.find(r => r.id === rid)?.name).filter(Boolean).join(', ') || 'אין'}
                      </p>
                    </div>
                    {userRole !== 'viewer' && (
                      <button
                        onClick={() => onUnassign(shift.id, pid)}
                        className="p-2 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"
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