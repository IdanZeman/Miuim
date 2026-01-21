import React from 'react';
import { Person, Role, Team, OrganizationSettings, Shift, TaskTemplate } from '../../types';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import {
    X, Phone, Envelope, Shield, Users, Info,
    ArrowSquareOut, Browsers, IdentificationCard,
    CalendarBlank, Clock, CaretLeft
} from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';

interface PersonInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
    roles: Role[];
    teams: Team[];
    settings?: OrganizationSettings | null;
    shifts?: Shift[];
    selectedDate?: Date;
    taskTemplates?: TaskTemplate[];
}

export const PersonInfoModal: React.FC<PersonInfoModalProps> = ({
    isOpen,
    onClose,
    person,
    roles,
    teams,
    settings,
    shifts = [],
    selectedDate = new Date(),
    taskTemplates = []
}) => {
    const personRoles = roles.filter(r => (person.roleIds || [person.roleId]).includes(r.id));
    const personTeam = teams.find(t => t.id === person.teamId);
    const customFieldsSchema = settings?.customFieldsSchema || [];
    const allRelevantShifts = shifts
        .filter(s => s.assignedPersonIds.includes(person.id) && !s.isCancelled)
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    const handleCall = () => {
        if (person.phone) window.open(`tel:${person.phone}`);
    };

    const handleEmail = () => {
        if (person.email) window.open(`mailto:${person.email}`);
    };

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-slate-200 ${person.color}`}>
                        {getPersonInitials(person.name)}
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-slate-800 leading-tight">{person.name}</h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ">
                            <IdentificationCard size={14} weight="bold" />
                            פרופיל חייל
                        </span>
                    </div>
                </div>
            }
            size="md"
        >
            <div className="space-y-8 py-2">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100/50">
                        <Users size={16} weight="bold" />
                        <span className="text-sm font-black">{personTeam?.name || 'ללא צוות'}</span>
                    </div>
                    {personRoles.map(role => (
                        <div key={role.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200/50">
                            <Shield size={16} weight="bold" />
                            <span className="text-sm font-black">{role.name}</span>
                        </div>
                    ))}
                    {person.isCommander && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/50">
                            <span className="text-[10px] font-black uppercase tracking-tighter">מפקד</span>
                        </div>
                    )}
                </div>

                {/* Contact Section */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">פרטי התקשרות</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <Phone size={20} weight="bold" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400">טלפון</span>
                                    <span className="text-sm font-black text-slate-700">{person.phone || 'לא הוזן'}</span>
                                </div>
                            </div>
                            {person.phone && (
                                <button
                                    onClick={handleCall}
                                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-100"
                                >
                                    <Phone size={18} weight="fill" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-purple-200 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-500 transition-colors">
                                    <Envelope size={20} weight="bold" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400">דוא״ל</span>
                                    <span className="text-sm font-black text-slate-700">{person.email || 'לא הוזן'}</span>
                                </div>
                            </div>
                            {person.email && (
                                <button
                                    onClick={handleEmail}
                                    className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-100"
                                >
                                    <ArrowSquareOut size={18} weight="bold" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Schedule Summary Section */}
                {allRelevantShifts.length === 0 ? (
                    <div className="p-8 bg-slate-50/50 rounded-2xl border border-slate-100/50 text-center">
                        <span className="text-xs font-bold text-slate-400">אין היסטוריה או שיבוצים עתידיים</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center justify-between">
                            <span>ציר זמן משימות</span>
                            <span className="text-slate-300 normal-case font-bold">{allRelevantShifts.length} משימות</span>
                        </h3>

                        <div className="relative pr-6 space-y-0">
                            {/* Timeline vertical line */}
                            <div className="absolute right-2.5 top-2 bottom-2 w-0.5 bg-slate-100 rounded-full" />

                            {allRelevantShifts.map((shift, index) => {
                                const taskTemplate = taskTemplates.find(t => t.id === shift.taskId);
                                const now = new Date();
                                const shiftStart = new Date(shift.startTime);
                                const shiftEnd = new Date(shift.endTime);

                                // Precise status checks
                                const isActive = now >= shiftStart && now <= shiftEnd;
                                const isPast = shiftEnd < now;
                                const isFuture = shiftStart > now;
                                const isSelectedDay = shiftStart.toLocaleDateString('en-CA') === selectedDate.toLocaleDateString('en-CA');

                                // Calculate rest gap if there was a previous shift
                                let restGapLabel = null;
                                let isNowInGap = false;
                                if (index > 0) {
                                    const prevShift = allRelevantShifts[index - 1];
                                    const prevEnd = new Date(prevShift.endTime);
                                    const gapMs = shiftStart.getTime() - prevEnd.getTime();
                                    const gapHours = gapMs / (1000 * 60 * 60);

                                    if (gapHours > 0) {
                                        restGapLabel = `${Math.floor(gapHours)}ש׳ הפסקה`;
                                    } else if (gapHours === 0) {
                                        restGapLabel = 'רציף';
                                    }

                                    // Check if "Now" falls in this specific gap
                                    if (now > prevEnd && now < shiftStart) {
                                        isNowInGap = true;
                                    }
                                }

                                return (
                                    <React.Fragment key={shift.id}>
                                        {/* Rest Indicator */}
                                        {restGapLabel && (
                                            <div className="relative py-2 pr-8">
                                                <div className="absolute right-1 top-1/2 -translate-y-1/2 w-3.5 h-0.5 bg-slate-100" />
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[9px] font-black text-slate-300 bg-white px-2 uppercase tracking-tighter">
                                                        {restGapLabel}
                                                    </span>
                                                    {isNowInGap && (
                                                        <div className="flex items-center gap-1 text-blue-500 animate-pulse">
                                                            <CaretLeft size={14} weight="fill" />
                                                            <span className="text-[10px] font-black uppercase tracking-tighter">עכשיו</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="relative pb-4 group">
                                            {/* Dot on the timeline - Red for Past, Blue for Active, Green for Future */}
                                            <div className={`absolute right-[-17.5px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm z-10 transition-transform group-hover:scale-125 ${isActive ? 'bg-blue-500 scale-110' :
                                                    isPast ? 'bg-red-500' :
                                                        'bg-emerald-500'
                                                }`} />

                                            {/* Arrow for the active shift */}
                                            {isActive && (
                                                <div className="absolute right-[-32px] top-4 text-blue-500 animate-pulse">
                                                    <CaretLeft size={16} weight="fill" />
                                                </div>
                                            )}

                                            <div className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isActive ? 'bg-blue-50/50 border-blue-200 shadow-md shadow-blue-100/20 ring-1 ring-blue-100' :
                                                    isPast ? 'bg-red-50/10 border-red-100 opacity-80' :
                                                        'bg-emerald-50/20 border-emerald-100'
                                                }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl shadow-sm ${isActive ? 'bg-white text-blue-500' :
                                                            isPast ? 'bg-white text-red-500' :
                                                                'bg-white text-emerald-500'
                                                        }`}>
                                                        {isPast ? <Clock size={16} weight="bold" /> : <CalendarBlank size={16} weight="bold" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-slate-700">{taskTemplate?.name || 'משימה'}</span>
                                                            {isActive && (
                                                                <span className="px-1.5 py-0.25 bg-blue-100 text-blue-700 text-[8px] font-black uppercase rounded-full animate-pulse">בביצוע</span>
                                                            )}
                                                            {isSelectedDay && !isActive && (
                                                                <span className="px-1.5 py-0.25 bg-slate-100 text-slate-500 text-[8px] font-black uppercase rounded-full">היום</span>
                                                            )}
                                                        </div>
                                                        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isActive ? 'text-blue-600' :
                                                                isPast ? 'text-red-600' :
                                                                    'text-emerald-700'
                                                            }`}>
                                                            <span>{shiftStart.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span>
                                                            <span className="opacity-30">•</span>
                                                            <span dir="ltr">
                                                                {shiftStart.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                                -
                                                                {shiftEnd.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Custom Fields Section */}
                {customFieldsSchema.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">מידע נוסף</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {customFieldsSchema.map(field => {
                                const value = person.customFields?.[field.key];
                                if (value === undefined || value === null || value === '') return null;

                                return (
                                    <div key={field.key} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                        <span className="block text-[10px] font-bold text-slate-400 mb-1">{field.label}</span>
                                        <span className="text-sm font-black text-slate-700">
                                            {typeof value === 'boolean' ? (value ? 'כן' : 'לא') :
                                                Array.isArray(value) ? value.join(', ') :
                                                    String(value)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex gap-3 pt-2">
                    <Button
                        variant="primary"
                        onClick={onClose}
                        className="flex-1 py-6 rounded-2xl font-black text-base shadow-xl shadow-blue-100"
                    >
                        סגור
                    </Button>
                </div>
            </div>
        </GenericModal>
    );
};
