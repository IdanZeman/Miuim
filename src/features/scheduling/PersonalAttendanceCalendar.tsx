import React, { useState, useEffect } from 'react';
import { Person, TeamRotation, Absence } from '@/types';
import { ChevronRight, ChevronLeft, X, ArrowRight, ArrowLeft, Home, Calendar as CalendarIcon, Trash2, Clock, RotateCcw, Download } from 'lucide-react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { PersonalRotationEditor } from './PersonalRotationEditor';

interface PersonalAttendanceCalendarProps {
    person: Person;
    teamRotations: TeamRotation[];
    absences?: Absence[]; // NEW
    onClose: () => void;
    onUpdatePerson: (p: Person) => void;
    isViewer?: boolean;
}

const formatTime = (time?: string) => time?.slice(0, 5) || '';

export const PersonalAttendanceCalendar: React.FC<PersonalAttendanceCalendarProps> = ({ person: initialPerson, teamRotations, absences = [], onClose, onUpdatePerson, isViewer = false }) => {
    const [person, setPerson] = useState(initialPerson);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [editingDate, setEditingDate] = useState<Date | null>(null);
    const [editState, setEditState] = useState({ isAvailable: false, start: '00:00', end: '23:59' });
    const [showRotationSettings, setShowRotationSettings] = useState(false);

    // Sync with prop updates
    useEffect(() => {
        setPerson(initialPerson);
    }, [initialPerson]);

    const handleSaveRotation = (rotationSettings: any) => {
        const updatedPerson = {
            ...person,
            personalRotation: rotationSettings
        };
        setPerson(updatedPerson);
        onUpdatePerson(updatedPerson);
        setShowRotationSettings(false);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay(); // 0 = Sunday

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Helper to calculate availability including personal rotation
    const getDisplayAvailability = (date: Date) => {
        return getEffectiveAvailability(person, date, teamRotations, absences);
    };

    // Initialize edit state when opening modal
    useEffect(() => {
        if (editingDate) {
            const data = getDisplayAvailability(editingDate);
            setEditState({
                isAvailable: data.isAvailable,
                start: data.startHour === '00:00' ? '00:00' : data.startHour,
                end: data.endHour === '00:00' ? '23:59' : data.endHour
            });
        }
    }, [editingDate]);

    const handleSaveDay = () => {
        if (!editingDate) return;
        const dateKey = editingDate.toLocaleDateString('en-CA');

        const newData = {
            isAvailable: editState.isAvailable,
            startHour: editState.start,
            endHour: editState.end,
            source: 'manual'
        };

        const updatedPerson = {
            ...person,
            dailyAvailability: {
                ...(person.dailyAvailability || {}),
                [dateKey]: newData
            }
        };

        setPerson(updatedPerson); // Optimistic update
        onUpdatePerson(updatedPerson);
        setEditingDate(null);
    };

    const handleClearDay = () => {
        if (!editingDate) return;
        const dateKey = editingDate.toLocaleDateString('en-CA');
        const newDaily = { ...(person.dailyAvailability || {}) };
        delete newDaily[dateKey];

        const updatedPerson = { ...person, dailyAvailability: newDaily };
        setPerson(updatedPerson); // Optimistic update
        onUpdatePerson(updatedPerson);
        setEditingDate(null);
    };

    const renderCalendarDays = () => {
        const days = [];

        // Empty slots for start of month
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100"></div>);
        }

        // Days
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();

            const avail = getDisplayAvailability(date);
            const isManual = avail.source === 'manual';
            const status = (avail as any).status; // Cast for now

            let bgClass = 'bg-white';
            let content = null;

            if (!avail.isAvailable) {
                bgClass = 'bg-slate-100/50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Home size={16} />
                        <span className="text-[10px] font-bold mt-1">בבית</span>
                    </div>
                );
            } else if (status === 'arrival') {
                bgClass = 'bg-blue-50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-blue-600">
                        <ArrowLeft size={16} strokeWidth={3} />
                        <span className="text-[10px] font-bold mt-1">הגעה</span>
                        <span className="text-[9px]">{formatTime(avail.startHour)}</span>
                    </div>
                );
            } else if (status === 'departure') {
                bgClass = 'bg-orange-50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-orange-600">
                        <ArrowRight size={16} strokeWidth={3} />
                        <span className="text-[10px] font-bold mt-1">יציאה</span>
                        <span className="text-[9px]">{formatTime(avail.endHour)}</span>
                    </div>
                );
            } else {
                // Base - Full
                bgClass = 'bg-green-50/50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-green-600/50">
                        <span className="text-[10px] font-bold">בבסיס</span>
                    </div>
                );
            }

            days.push(
                <div
                    key={d}
                    onClick={() => !isViewer && setEditingDate(date)}
                    className={`h-24 border border-slate-100 relative p-1 transition-all ${isViewer ? '' : 'hover:bg-opacity-70 cursor-pointer hover:shadow-inner'} ${bgClass} ${isToday ? 'ring-2 ring-inset ring-blue-400' : ''}`}
                    title={isViewer ? "" : "לחץ לעריכת נוכחות"}
                >
                    <span className={`absolute top-1 right-2 text-xs font-bold ${isToday ? 'text-blue-600 bg-blue-100 px-1.5 rounded-full' : 'text-slate-400'}`}>
                        {d}
                    </span>
                    {isManual && (
                        <span className="absolute top-1 left-1 w-2 h-2 bg-amber-400 rounded-full" title="שינוי ידני"></span>
                    )}
                    <div className="mt-4 h-full pointer-events-none">
                        {content}
                    </div>
                </div>
            );
        }

        return days;
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={person.name} size="xl">
            <div className="flex flex-col h-full max-h-[calc(90dvh-100px)]">
                {/* Sub-Header with Avatar and subtitle - Styled as part of content */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} text-lg`}>
                            {person.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700">לוח נוכחות אישי</h3>
                            <p className="text-sm text-slate-500">צפה וערוך את הנוכחות החודשית</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            icon={Download} // Requires import
                            onClick={() => {
                                const csvHeader = 'תאריך,סטטוס,שעות\n';
                                const rows = [];
                                for (let d = 1; d <= daysInMonth; d++) {
                                    const date = new Date(year, month, d);
                                    const avail = getDisplayAvailability(date);
                                    const dateStr = date.toLocaleDateString('he-IL');
                                    const status = avail.isAvailable ? 'נמצא' : 'בבית';
                                    const hours = avail.isAvailable ? `${avail.startHour} - ${avail.endHour}` : '-';
                                    rows.push(`${dateStr},${status},${hours}`);
                                }
                                const csvContent = csvHeader + rows.join('\n');
                                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.href = url;
                                link.download = `attendance_${person.name}_${month + 1}_${year}.csv`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                        >
                            ייצוא
                        </Button>
                        {!isViewer && (
                            <Button
                                variant="outline"
                                size="sm"
                                icon={RotateCcw}
                                onClick={() => setShowRotationSettings(true)}
                            >
                                הגדרת סבב אישי
                            </Button>
                        )}
                    </div>
                </div>

                {/* Calendar Controls */}
                <div className="p-4 flex items-center justify-between bg-slate-50 rounded-t-xl border border-slate-200 border-b-0">
                    <Button onClick={handlePrevMonth} variant="ghost" size="icon" icon={ChevronRight} />
                    <h3 className="text-lg font-bold text-slate-700">{monthName}</h3>
                    <Button onClick={handleNextMonth} variant="ghost" size="icon" icon={ChevronLeft} />
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-y-auto custom-scrollbar border border-slate-200 rounded-b-xl">
                    <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                        {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => (
                            <div key={day} className="py-2 text-center text-xs font-bold text-slate-500">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {renderCalendarDays()}
                    </div>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                    {(() => {
                        let daysOnBase = 0;
                        let daysAtHome = 0;
                        for (let d = 1; d <= daysInMonth; d++) {
                            const date = new Date(year, month, d);
                            const avail = getDisplayAvailability(date);
                            const status = (avail as any).status;

                            if (!avail.isAvailable) {
                                daysAtHome++;
                            } else if (status === 'departure') {
                                daysAtHome++; // Departure counts as Home
                            } else {
                                daysOnBase++; // Arrival, Base, Full
                            }
                        }
                        return (
                            <div className="flex gap-4">
                                <span className="font-bold">סיכום חודשי:</span>
                                <span className="text-green-600">ימים בבסיס: {daysOnBase}</span>
                                <span className="text-red-600">ימים בבית: {daysAtHome}</span>
                            </div>
                        );
                    })()}
                    <div>* יום יציאה נספר כיום בבית</div>
                </div>
            </div>

            {/* Rotation Settings Modal */}
            {
                showRotationSettings && (
                    <PersonalRotationEditor
                        person={person}
                        isOpen={true}
                        onClose={() => setShowRotationSettings(false)}
                        onSave={handleSaveRotation}
                    />
                )
            }

            {/* Day Edit Modal */}
            {
                editingDate && (
                    <Modal
                        isOpen={true}
                        onClose={() => setEditingDate(null)}
                        title={`עריכה - ${editingDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}`}
                        size="sm"
                    >
                        <div className="space-y-6">
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-700">סטטוס נוכחות</span>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm font-bold ${editState.isAvailable ? 'text-green-600' : 'text-slate-500'}`}>
                                        {editState.isAvailable ? 'נוכח' : 'בבית'}
                                    </span>
                                    <button
                                        onClick={() => setEditState(prev => {
                                            const nextAvailable = !prev.isAvailable;
                                            // Always default to 00:00-23:59 when turning ON
                                            if (nextAvailable) {
                                                return { ...prev, isAvailable: nextAvailable, start: '00:00', end: '23:59' };
                                            }
                                            return { ...prev, isAvailable: nextAvailable };
                                        })}
                                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${editState.isAvailable ? 'bg-green-500' : 'bg-slate-200'}`}
                                        dir="ltr"
                                    >
                                        <span
                                            className={`absolute top-0.5 left-0.5 bg-white w-5 h-5 rounded-full shadow transform transition-transform duration-200 ease-in-out ${editState.isAvailable ? 'translate-x-5' : 'translate-x-0'}`}
                                        />
                                    </button>
                                </div>
                            </div>

                            {editState.isAvailable && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">התחלה</label>
                                        <div className="relative flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 w-full group hover:bg-white hover:border-blue-400 transition-colors">
                                            <span className={`text-sm font-bold flex-1 text-center pointer-events-none ${editState.start ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {editState.start || '00:00'}
                                            </span>
                                            <input
                                                type="time"
                                                value={editState.start}
                                                onChange={e => setEditState(prev => ({ ...prev, start: e.target.value }))}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                            />
                                            <Clock size={16} className="text-slate-400 absolute left-2 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 mb-1 block">סיום</label>
                                        <div className="relative flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 w-full group hover:bg-white hover:border-blue-400 transition-colors">
                                            <span className={`text-sm font-bold flex-1 text-center pointer-events-none ${editState.end ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {editState.end || '23:59'}
                                            </span>
                                            <input
                                                type="time"
                                                value={editState.end}
                                                onChange={e => setEditState(prev => ({ ...prev, end: e.target.value }))}
                                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                            />
                                            <Clock size={16} className="text-slate-400 absolute left-2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                {getDisplayAvailability(editingDate).source === 'manual' && (
                                    <Button onClick={handleClearDay} variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 px-3" title="נקה שינוי ידני">
                                        <Trash2 size={18} />
                                    </Button>
                                )}
                                <Button onClick={handleSaveDay} variant="primary" className="flex-1">
                                    שמור שינויים
                                </Button>
                            </div>
                        </div>
                    </Modal>
                )
            }
        </Modal >
    );
};
