import React, { useState, useEffect } from 'react';
import { Person } from '../types';
import { ChevronRight, ChevronLeft, Settings } from 'lucide-react';

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

    // Sync with props when they change from parent
    useEffect(() => {
        setIsAvailable(availability.isAvailable);
    }, [availability.isAvailable]);

    const handleToggle = () => {
        if (isViewer) return;
        setIsAvailable(!isAvailable); // Immediate visual update
        onTogglePresence(person);
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
        <div className={`p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors ${isAvailable ? 'bg-white' : 'bg-slate-50/50 opacity-90'}`}>
            {/* Person Info */}
            <div className="flex items-center gap-4 flex-1 w-full md:w-auto cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors group" onClick={() => onSelectPerson(person)}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${teamColor ? teamColor.replace('border-', 'bg-') : person.color} group-hover:ring-4 ring-slate-100 transition-all text-sm`}>
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
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
                {/* Settings Button */}
                {!isViewer && onEditRotation && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onEditRotation(person); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                        title="הגדרת סבב אישי"
                    >
                        <Settings size={16} />
                    </button>
                )}

                {isAvailable && (
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">התחלה</span>
                            <input
                                type="time"
                                value={availability.startHour}
                                onChange={e => onTimeChange(person, 'startHour', e.target.value)}
                                className="bg-slate-50 rounded px-1 text-sm font-bold text-slate-700 w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 ltr-input"
                                disabled={isViewer}
                            />
                        </div>
                        <div className="w-px h-8 bg-slate-100 mx-1"></div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-400 font-medium tracking-wide">סיום</span>
                            <input
                                type="time"
                                value={availability.endHour}
                                onChange={e => onTimeChange(person, 'endHour', e.target.value)}
                                className="bg-slate-50 rounded px-1 text-sm font-bold text-slate-700 w-20 text-center focus:outline-none focus:ring-1 focus:ring-blue-200 ltr-input"
                                disabled={isViewer}
                            />
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2" dir="ltr">
                        <button
                            onClick={handleToggle}
                            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${isAvailable ? 'bg-green-500' : 'bg-slate-200'}`}
                            disabled={isViewer}
                            dir="ltr"
                        >
                            <span
                                className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transform transition-transform duration-200 ease-in-out ${isAvailable ? 'translate-x-5' : 'translate-x-0'}`}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
