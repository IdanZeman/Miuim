import React, { useState, useEffect } from 'react';
import { Person } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, Gear as Settings, Clock, CheckCircle as CheckCircle2 } from '@phosphor-icons/react';
import { logger } from '@/services/loggingService';
import { TimePicker } from '@/components/ui/DatePicker';

interface AttendanceRowProps {
    person: Person;
    availability: any;
    onTogglePresence: (p: Person) => void;
    onTimeChange: (p: Person, field: 'startHour' | 'endHour', value: string) => void;
    onSelectPerson: (p: Person) => void;
    onEditRotation?: (p: Person) => void;
    isViewer?: boolean;
    teamColor?: string; // NEW
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
    person,
    availability,
    onTogglePresence,
    onTimeChange,
    onSelectPerson,
    onEditRotation,
    isViewer = false,
    teamColor // NEW
}) => {
    // Optimistic state for immediate feedback
    const [isAvailable, setIsAvailable] = useState(availability.isAvailable);
    const [isTimeExpanded, setIsTimeExpanded] = useState(false); // NEW

    // Sync with props when they change from parent
    useEffect(() => {
        setIsAvailable(availability.isAvailable);
    }, [availability.isAvailable]);

    const handleToggle = () => {
        if (isViewer) return;
        const newAvailable = !isAvailable;
        setIsAvailable(newAvailable); // Immediate visual update
        onTogglePresence(person);
        logger.info('CLICK', `${newAvailable ? 'Checked' : 'Unchecked'} presence for ${person.name}`, { personId: person.id, isAvailable: newAvailable });
    };

    const isManualOverride = availability.source === 'manual';
    let statusLabel = 'נוכח';
    let statusColor = 'bg-green-100 text-green-700';
    const availStatus = availability.status;

    if (!isAvailable) {
        statusLabel = 'בבית';
        statusColor = 'bg-slate-100 text-slate-500';
    } else if (availStatus === 'arrival') {
        statusLabel = 'חוזר לבסיס';
        statusColor = 'bg-blue-100 text-blue-700';
    } else if (availStatus === 'departure') {
        statusLabel = 'יוצא הביתה';
        statusColor = 'bg-orange-100 text-orange-700';
    } else if (availStatus === 'home') {
        // Handle explicit 'home' status from rotation
        statusLabel = 'בבית';
        statusColor = 'bg-slate-100 text-slate-500';
    }

    return (
        <div className={`p-3 flex flex-wrap items-center justify-between gap-y-3 gap-x-3 transition-colors ${isAvailable ? 'bg-white' : 'bg-slate-50/50 opacity-90'}`}>
            {/* Person Info */}
            <div className="flex items-center gap-3 min-w-0 max-w-full cursor-pointer hover:bg-slate-50 p-1.5 -ml-1.5 rounded-lg transition-colors group flex-grow sm:flex-grow-0" onClick={() => onSelectPerson(person)}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm shrink-0 ${teamColor ? teamColor.replace('border-', 'bg-') : person.color} group-hover:ring-2 ring-slate-100 transition-all text-xs`}>
                    {person.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>

                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-800 text-base truncate group-hover:text-blue-600 transition-colors">{person.name}</h4>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] whitespace-nowrap ${statusColor} flex items-center gap-1 shadow-sm`}>
                            {availStatus === 'arrival' && <ChevronLeft size={10} className="rotate-180" weight="bold" />}
                            {availStatus === 'departure' && <ChevronRight size={10} className="rotate-180" weight="bold" />}
                            {statusLabel}
                        </span>
                    </div>
                </div>
            </div>

            {/* Controls - Validated Single Line */}
            <div className="flex items-center gap-3 shrink-0 ml-auto sm:ml-0 pl-11 sm:pl-0 w-full sm:w-auto justify-end sm:justify-start">
                {/* Time Display/Edit */}
                {isAvailable && (
                    <div className="flex items-center">
                        {isTimeExpanded ? (
                            <div className="absolute left-4 z-10 flex items-center gap-2 bg-white px-2 py-1.5 rounded-lg border border-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                                <TimePicker
                                    variant="compact"
                                    label="התחלה"
                                    value={availability.startHour}
                                    onChange={val => onTimeChange(person, 'startHour', val)}
                                    className="w-16"
                                />
                                <div className="w-px h-6 bg-slate-100 mx-0.5 mt-4"></div>
                                <TimePicker
                                    variant="compact"
                                    label="סיום"
                                    value={availability.endHour}
                                    onChange={val => onTimeChange(person, 'endHour', val)}
                                    className="w-16"
                                />
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsTimeExpanded(false); }}
                                    className="mr-1 p-1 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                                >
                                    <CheckCircle2 size={14} className="text-green-600" weight="bold" />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => !isViewer && setIsTimeExpanded(true)}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-sm text-slate-600 transition-all group/time"
                                title="ערוך שעות"
                                disabled={isViewer}
                            >
                                <span className="text-xs font-bold dir-ltr font-mono pointer-events-none">
                                    {availability.startHour}-{availability.endHour}
                                </span>
                            </button>
                        )}
                    </div>
                )}

                {/* Toggle Switch */}
                <div className="flex items-center" dir="ltr">
                    <button
                        onClick={handleToggle}
                        className={`relative w-9 h-5 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-slate-200'}`}
                        disabled={isViewer}
                        dir="ltr"
                    >
                        <span
                            className={`absolute top-0.5 left-0.5 bg-white w-4 h-4 rounded-full shadow transform transition-transform duration-200 ease-in-out ${isAvailable ? 'translate-x-4' : 'translate-x-0'}`}
                        />
                    </button>
                </div>

                {/* Settings Button (Hidden on Mobile if needed, or kept small) */}
                {!isViewer && onEditRotation && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditRotation(person); }}
                        className="text-slate-300 hover:text-blue-600 transition-colors"
                        title="הגדרת סבב אישי"
                    >
                        <Settings size={14} weight="bold" />
                    </button>
                )}
            </div>
        </div>
    );
};
