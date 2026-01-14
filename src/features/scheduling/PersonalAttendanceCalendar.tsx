import React, { useState, useEffect } from 'react';
import { Person, TeamRotation, Absence } from '@/types';
import { CaretRight as ChevronRight, CaretLeft as ChevronLeft, X, ArrowRight, ArrowLeft, House as Home, CalendarBlank as CalendarIcon, Trash as Trash2, Clock, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react';
import { getEffectiveAvailability } from '@/utils/attendanceUtils';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { TimePicker } from '@/components/ui/DatePicker';
import { PersonalRotationEditor } from './PersonalRotationEditor';
import { logger } from '@/services/loggingService';
import { ExportButton } from '@/components/ui/ExportButton';
import { getPersonInitials } from '@/utils/nameUtils';

interface PersonalAttendanceCalendarProps {
    person: Person;
    teamRotations: TeamRotation[];
    absences?: Absence[];
    onClose: () => void;
    onUpdatePerson: (p: Person) => void;
    onUpdatePresence?: (presence: import('@/types').DailyPresence) => void;
    onDeletePresence?: (personId: string, date: string) => void;
    isViewer?: boolean;
    unifiedPresence?: import('@/types').DailyPresence[];
}

const formatTime = (time?: string) => time?.slice(0, 5) || '';

export const PersonalAttendanceCalendar: React.FC<PersonalAttendanceCalendarProps> = ({
    person: initialPerson, teamRotations, absences = [], onClose, onUpdatePerson,
    onUpdatePresence, onDeletePresence, isViewer = false, unifiedPresence = []
}) => {
    const [person, setPerson] = useState(initialPerson);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [editingDate, setEditingDate] = useState<Date | null>(null);
    const [editState, setEditState] = useState({ isAvailable: true, start: '00:00', end: '23:59' });
    const [showRotationSettings, setShowRotationSettings] = useState(false);

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
        logger.info('UPDATE', `Updated personal rotation for ${person.name}`, {
            personId: person.id,
            rotation: rotationSettings,
            category: 'attendance'
        });
        setShowRotationSettings(false);
    };

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const monthName = currentDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

    const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    const getDisplayAvailability = (date: Date) => {
        return getEffectiveAvailability(person, date, teamRotations, absences, [], unifiedPresence);
    };

    useEffect(() => {
        if (editingDate) {
            const data = getDisplayAvailability(editingDate);

            console.log('🔍 [PersonalAttendanceCalendar] Loading edit state:', {
                date: editingDate.toLocaleDateString('en-CA'),
                personName: person.name,
                dataStatus: data.status,
                dataIsAvailable: data.isAvailable,
                dataSource: data.source
            });

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

        const isCheckIn = editState.isAvailable && editState.start === '00:00' && editState.end === '23:59';

        if (onUpdatePresence) {
            let status: any = editState.isAvailable ? 'full' : 'home';
            if (editState.isAvailable && (editState.start !== '00:00' || editState.end !== '23:59')) {
                if (editState.start !== '00:00' && editState.end === '23:59') status = 'arrival';
                else if (editState.start === '00:00' && editState.end !== '23:59') status = 'departure';
                else status = 'base';
            }

            onUpdatePresence({
                person_id: person.id,
                date: dateKey,
                organization_id: person.organization_id,
                status,
                start_time: editState.start,
                end_time: editState.end,
                source: 'manual'
            });
        } else {
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
            setPerson(updatedPerson);
            onUpdatePerson(updatedPerson);
        }

        logger.info(isCheckIn ? 'CHECK_IN' : 'UPDATE',
            `${isCheckIn ? 'Reported presence' : 'Manually updated personal attendance'} for ${person.name}`,
            {
                personId: person.id,
                date: dateKey,
                isAvailable: editState.isAvailable,
                start: editState.start,
                end: editState.end,
                category: 'attendance'
            }
        );
        setEditingDate(null);
    };

    const handleClearDay = () => {
        if (!editingDate) return;
        const dateKey = editingDate.toLocaleDateString('en-CA');

        if (onDeletePresence) {
            onDeletePresence(person.id, dateKey);
        } else {
            const newDaily = { ...(person.dailyAvailability || {}) };
            delete newDaily[dateKey];
            const updatedPerson = { ...person, dailyAvailability: newDaily };
            setPerson(updatedPerson);
            onUpdatePerson(updatedPerson);
        }

        logger.info('DELETE', `Cleared manual attendance update for ${person.name} on ${dateKey}`, {
            personId: person.id,
            date: dateKey,
            category: 'attendance'
        });
        setEditingDate(null);
    };

    const renderCalendarDays = () => {
        const days = [];
        for (let i = 0; i < firstDay; i++) {
            days.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 border border-slate-100"></div>);
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const isToday = new Date().toDateString() === date.toDateString();
            const avail = getDisplayAvailability(date);
            const isManual = avail.source === 'manual' || (avail as any).source === 'manual';
            const status = (avail as any).status;

            let bgClass = 'bg-white';
            let content = null;

            if (!avail.isAvailable) {
                bgClass = 'bg-slate-100/50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Home size={16} weight="duotone" />
                        <span className="text-[10px] font-bold mt-1">בבית</span>
                    </div>
                );
            } else if (status === 'arrival') {
                bgClass = 'bg-blue-50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-blue-600">
                        <ArrowLeft size={16} weight="bold" />
                        <span className="text-[10px] font-bold mt-1">הגעה</span>
                        <span className="text-[9px]">{formatTime(avail.startHour)}</span>
                    </div>
                );
            } else if (status === 'departure') {
                bgClass = 'bg-orange-50';
                content = (
                    <div className="flex flex-col items-center justify-center h-full text-orange-600">
                        <ArrowRight size={16} weight="bold" />
                        <span className="text-[10px] font-bold mt-1">יציאה</span>
                        <span className="text-[9px]">{formatTime(avail.endHour)}</span>
                    </div>
                );
            } else {
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
        <GenericModal
            isOpen={true}
            onClose={onClose}
            title={(
                <div className="flex items-center gap-3 pr-2 text-right">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color} text-sm shrink-0`}>
                        {getPersonInitials(person.name)}
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">{person.name}</h2>
                        <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 font-bold uppercase tracking-wider">
                            <CalendarIcon size={14} className="text-slate-400" weight="duotone" />
                            <span>לוח נוכחות אישי</span>
                        </div>
                    </div>
                </div>
            )}
            headerActions={(
                <div className="flex items-center gap-2">
                    <ExportButton
                        onExport={async () => {
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
                        iconOnly
                        className="w-10 h-10 rounded-full"
                        title="ייצוא נתוני נוכחות"
                    />
                    {!isViewer && (
                        <button
                            onClick={() => setShowRotationSettings(true)}
                            className="w-10 h-10 flex items-center justify-center text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                            title="הגדרת סבב אישי"
                        >
                            <RotateCcw size={20} weight="duotone" />
                        </button>
                    )}
                </div>
            )}
            footer={(
                <div className="flex items-center justify-between w-full">
                    <div className="flex gap-6 items-center">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-sm font-bold text-slate-600">בבסיס</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            <span className="text-sm font-bold text-slate-600">בבית</span>
                        </div>
                    </div>
                </div>
            )}
            size="2xl"
        >
            <div className="flex items-center justify-between mb-4 bg-slate-50 p-2 rounded-xl border border-slate-100">
                <Button onClick={handlePrevMonth} variant="ghost" size="icon" icon={ChevronRight} />
                <h3 className="text-lg font-black text-slate-800 tracking-tight">{monthName}</h3>
                <Button onClick={handleNextMonth} variant="ghost" size="icon" icon={ChevronLeft} />
            </div>

            <div className="flex-1 overflow-hidden border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col">
                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
                    {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map(day => (
                        <div key={day} className="py-2.5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 flex-1">
                    {renderCalendarDays()}
                </div>
            </div>

            {showRotationSettings && (
                <PersonalRotationEditor
                    person={person}
                    isOpen={true}
                    onClose={() => setShowRotationSettings(false)}
                    onSave={handleSaveRotation}
                />
            )}

            {editingDate && (
                <GenericModal
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
                                    <TimePicker
                                        label="התחלה"
                                        value={editState.start}
                                        onChange={val => setEditState(prev => ({ ...prev, start: val }))}
                                    />
                                </div>
                                <div>
                                    <TimePicker
                                        label="סיום"
                                        value={editState.end}
                                        onChange={val => setEditState(prev => ({ ...prev, end: val }))}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            {getDisplayAvailability(editingDate).source === 'manual' && (
                                <Button onClick={handleClearDay} variant="ghost" className="text-red-500 hover:bg-red-50 hover:text-red-600 px-3" title="נקה שינוי ידני">
                                    <Trash2 size={18} weight="duotone" />
                                </Button>
                            )}
                            <Button onClick={handleSaveDay} variant="primary" className="flex-1">
                                שמור שינויים
                            </Button>
                        </div>
                    </div>
                </GenericModal>
            )}
        </GenericModal>
    );
};
