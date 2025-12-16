import React, { useState, useEffect } from 'react';
import { Person } from '../types';
import { ChevronRight, ChevronLeft, CalendarDays } from 'lucide-react';
import { Switch } from './ui/Switch';

interface AttendanceRowProps {
    person: Person;
    availability: any; // Using any for brevity given the complex type, but should be strictly typed
    onTogglePresence: (p: Person) => void;
    onTimeChange: (p: Person, field: 'startHour' | 'endHour', value: string) => void;
    onSelectPerson: (p: Person) => void;
    isViewer?: boolean;
}

export const AttendanceRow: React.FC<AttendanceRowProps> = ({
    person,
    availability: initialAvailability,
    onTogglePresence,
    onTimeChange,
    onSelectPerson,
    isViewer = false
}) => {
    // Local optimistic state
    const [optimisticAvailability, setOptimisticAvailability] = useState(initialAvailability);

    // Sync with props when they change (server/parent update confirmed)
    useEffect(() => {
        setOptimisticAvailability(initialAvailability);
    }, [initialAvailability]);

    const handleToggle = () => {
        if (isViewer) return;

        // Optimistic update
        const newIsAvailable = !optimisticAvailability.isAvailable;
        setOptimisticAvailability(prev => ({
            ...prev,
            isAvailable: newIsAvailable
        }));

        // Actual update
        onTogglePresence(person);
    };

    const isManualOverride = optimisticAvailability.source === 'manual';
    let statusLabel = 'נוכח';
    let statusColor = 'bg-green-100 text-green-700';
    const availStatus = optimisticAvailability.status;

    if (!optimisticAvailability.isAvailable) {
        statusLabel = 'בבית';
        statusColor = 'bg-slate-100 text-slate-500';
    } else if (availStatus === 'arrival') {
        statusLabel = 'חוזר לבסיס';
        statusColor = 'bg-blue-100 text-blue-700';
    } else if (availStatus === 'departure') {
        statusLabel = 'יוצא הביתה';
        statusColor = 'bg-orange-100 text-orange-700';
    }

    return (
        <div className={`p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${optimisticAvailability.isAvailable ? 'bg-white' : 'bg-slate-50/50 opacity-90'}`}>
            {/* Person Info */}
            <div className="flex items-center gap-4 flex-1 w-full md:w-auto cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors group" onClick={() => onSelectPerson(person)}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} group-hover:ring-4 ring-slate-100 transition-all text-sm`}>
                    {person.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex flex-col justify-center">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{person.name}</h4>

                        <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${statusColor} flex items-center gap-1 shadow-sm`}>
                            {availStatus === 'arrival' && <ChevronLeft size={10} className="rotate-180" />}
                            {availStatus === 'departure' && <ChevronRight size={10} className="rotate-180" />}
                            {statusLabel}
                        </span>

                        {isManualOverride && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-bold" title="שינוי ידני חריג">
                                ידני
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {optimisticAvailability.isAvailable && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">התחלה</span>
                            <input
                                type="time"
                                value={optimisticAvailability.startHour}
                                onChange={e => {
                                    setOptimisticAvailability(prev => ({ ...prev, startHour: e.target.value })); // Immediate local feedback
                                    onTimeChange(person, 'startHour', e.target.value);
                                }}
                                className="bg-slate-50 rounded px-1 text-sm font-bold text-slate-700 w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 ltr-input"
                                disabled={isViewer}
                            />
                        </div>
                        <div className="w-px h-8 bg-slate-100 mx-1"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">סיום</span>
                            <input
                                type="time"
                                value={optimisticAvailability.endHour}
                                onChange={e => {
                                    setOptimisticAvailability(prev => ({ ...prev, endHour: e.target.value })); // Immediate local feedback
                                    onTimeChange(person, 'endHour', e.target.value);
                                }}
                                className="bg-slate-50 rounded px-1 text-sm font-bold text-slate-700 w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 ltr-input"
                                disabled={isViewer}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" dir="ltr">
                        <Switch
                            checked={!!optimisticAvailability.isAvailable}
                            onChange={handleToggle}
                            disabled={isViewer}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
