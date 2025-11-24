import React, { useState, useMemo, useEffect } from 'react';
import { Shift, Person, TaskTemplate, Role, Team } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { Sparkles } from 'lucide-react';
import { ChevronLeft, ChevronRight, Plus, X, Check, AlertTriangle, Clock, User, MapPin, Calendar as CalendarIcon, Pencil, Save, Trash2, Copy, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

import { supabase } from '../services/supabaseClient';

interface ScheduleBoardProps {
    shifts: Shift[];
    people: Person[];
    taskTemplates: TaskTemplate[];
    roles: Role[];
    teams: Team[];
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onAddShift: (task: TaskTemplate, start: Date) => void;
    onUpdateShift: (shift: Shift) => void;
    onDeleteShift: (shiftId: string) => void;
    onClearDay: () => void;
}

// Helper component for Shift Card
const ShiftCard: React.FC<{
    shift: Shift;
    compact?: boolean;
    taskTemplates: TaskTemplate[];
    people: Person[];
    roles: Role[];
    onSelect: (shift: Shift) => void;
    onDelete: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings: Set<string>; // NEW: Pass acknowledged warnings
}> = ({ shift, compact = false, taskTemplates, people, roles, onSelect, onDelete, isViewer, acknowledgedWarnings }) => {
    const task = taskTemplates.find(t => t.id === shift.taskId);
    if (!task) return null;
    const isFull = shift.assignedPersonIds.length >= task.requiredPeople;

    const assigned = shift.assignedPersonIds
        .map(id => people.find(p => p.id === id))
        .filter(Boolean) as Person[];

    // NEW: Check if ANY assigned person lacks the required role (and is NOT acknowledged)
    const requiredRoleIds = task.roleComposition.map(rc => rc.roleId);
    const hasMismatch = isViewer ? false : shift.assignedPersonIds.some(pid => {
        const person = people.find(p => p.id === pid);
        if (!person) return false;

        const warningId = `${shift.id}-${pid}`;
        if (acknowledgedWarnings.has(warningId)) return false;

        return !person.roleIds.some(rid => requiredRoleIds.includes(rid));
    });

    return (
        <div
            onClick={() => onSelect(shift)}
            className={`p-3 rounded-xl shadow-sm border-2 cursor-pointer hover:shadow-md transition-all mb-3 group relative overflow-hidden ${hasMismatch
                ? 'bg-red-50 border-red-500 animate-pulse'
                : 'bg-white border-slate-100'
                }`}
        >
            {/* Color Indicator Strip */}
            <div className={`absolute top-0 right-0 w-1 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

            {/* Delete Action (Visible on Hover) - NO CONFIRM - Hidden for Viewers */}
            {!isViewer && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(shift.id);
                    }}
                    className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full bg-white/80 transition-all z-20"
                >
                    <Trash2 size={14} />
                </button>
            )}

            <div className="flex justify-between items-start mb-2 pr-2">
                <div className="flex-1">
                    <div className="font-bold text-sm text-slate-800 leading-tight">{task.name}</div>
                    <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock size={10} />
                        <span dir="ltr" className="flex items-center gap-1">
                            {new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            <span>-</span>
                            {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                    {isFull
                        ? <div className="bg-green-50 text-green-600 p-1 rounded-full"><Check size={12} /></div>
                        : <div className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md">
                            {shift.assignedPersonIds.length}/{task.requiredPeople}
                        </div>
                    }
                    {/* NEW: Force Assign Badge - MOVED HERE (below the status) */}
                    {hasMismatch && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">
                            <AlertTriangle size={10} />
                            שיבוץ כפוי
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-1.5 pr-2">
                {assigned.length === 0 ? (
                    <div className="flex items-center gap-2 text-slate-400 text-xs bg-slate-50 p-1.5 rounded-lg border border-slate-100 border-dashed">
                        <User size={12} />
                        <span>טרם שובצו</span>
                    </div>
                ) : (
                    assigned.map(p => {
                        // NEW: For viewers, always show as qualified
                        const isQualified = isViewer ? true : p.roleIds.some(rid => requiredRoleIds.includes(rid));
                        const warningId = `${shift.id}-${p.id}`;
                        const isAcknowledged = isViewer ? true : acknowledgedWarnings.has(warningId);

                        const showAsQualified = isQualified || isAcknowledged;

                        return (
                            <div
                                key={p.id}
                                className={`flex items-center gap-2 p-1.5 rounded-lg border ${showAsQualified
                                    ? 'bg-slate-50 border-slate-100'
                                    : 'bg-red-100 border-red-500 animate-pulse'
                                    }`}
                            >
                                {!showAsQualified && (
                                    <AlertTriangle size={14} className="text-red-700 flex-shrink-0" />
                                )}
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold shadow-sm ${p.color}`}>
                                    {getPersonInitials(p.name)}
                                </div>
                                {/* FIX: Use showAsQualified for text color too */}
                                <span className={`text-xs font-bold truncate ${showAsQualified ? 'text-slate-700' : 'text-red-900'}`}>
                                    {p.name}
                                </span>
                                {!showAsQualified && (
                                    <span className="text-red-700 text-xs font-bold">לא מוסמך</span>
                                )}
                            </div>
                        );
                    })
                )}
                {/* Warning if understaffed and has assignments but not enough */}
                {(!isFull && assigned.length > 0) && (
                    <div className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
                        <Sparkles size={10} />
                        <span>חסרים {task.requiredPeople - assigned.length}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export const ScheduleBoard: React.FC<ScheduleBoardProps> = (props) => {
    const {
        shifts,
        people,
        taskTemplates,
        roles,
        teams,
        selectedDate,
        onDateChange,
        onAssign,
        onUnassign,
        onAddShift,
        onUpdateShift,
        onDeleteShift,
        onClearDay
    } = props;
    const { profile, organization } = useAuth();
    const isViewer = profile?.role === 'viewer';
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [viewerDaysLimit, setViewerDaysLimit] = useState(2);
    const [showCopySuccess, setShowCopySuccess] = useState(false);

    // NEW: Only load warnings for non-viewers
    const [isLoadingWarnings, setIsLoadingWarnings] = useState(!isViewer); // Viewers skip loading
    const [acknowledgedWarnings, setAcknowledgedWarnings] = useState<Set<string>>(new Set());

    // Load acknowledged warnings ONLY if NOT a viewer
    useEffect(() => {
        if (isViewer) {
            setIsLoadingWarnings(false); // Skip for viewers
            return;
        }

        const loadAcknowledgedWarnings = async () => {
            if (!organization?.id) {
                setIsLoadingWarnings(false);
                return;
            }

            const { data, error } = await supabase
                .from('acknowledged_warnings')
                .select('warning_id')
                .eq('organization_id', organization.id);

            if (error) {
                console.error('Error loading acknowledged warnings:', error);
                setIsLoadingWarnings(false);
                return;
            }

            if (data) {
                const warningIds = new Set(data.map(w => w.warning_id));
                setAcknowledgedWarnings(warningIds);
            }

            setIsLoadingWarnings(false);
        };

        loadAcknowledgedWarnings();
    }, [organization?.id, isViewer]); // NEW: Add isViewer dependency

    useEffect(() => {
        if (organization?.id) {
            supabase
                .from('organization_settings')
                .select('viewer_schedule_days')
                .eq('organization_id', organization.id)
                .maybeSingle()
                .then(({ data, error }) => {
                    if (error) {
                        console.error('Error fetching viewer settings:', error);
                    }
                    if (data?.viewer_schedule_days) {
                        setViewerDaysLimit(data.viewer_schedule_days);
                    }
                });
        }
    }, [organization?.id]);

    const selectedShift = useMemo(() =>
        shifts.find(s => s.id === selectedShiftId) || null
        , [shifts, selectedShiftId]);



    // Export schedule to clipboard
    const handleExportToClipboard = async () => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        const dateDisplay = selectedDate.toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        let output = `📅 לוח שיבוצים - ${dateDisplay}\n`;
        output += `${'='.repeat(50)}\n\n`;

        // Get all shifts for this day
        const dayShifts = shifts.filter(s => {
            const shiftDate = new Date(s.startTime).toLocaleDateString('en-CA');
            return shiftDate === dateKey;
        }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        // Group by task
        const taskGroups = new Map<string, Shift[]>();
        dayShifts.forEach(shift => {
            const existing = taskGroups.get(shift.taskId) || [];
            taskGroups.set(shift.taskId, [...existing, shift]);
        });

        // Build output for each task
        taskGroups.forEach((shifts, taskId) => {
            const task = tasks.find(t => t.id === taskId);
            if (!task) return;

            output += `🔹 ${task.name}\n`;
            output += `${'-'.repeat(40)}\n`;

            shifts.forEach(shift => {
                const startTime = new Date(shift.startTime).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const endTime = new Date(shift.endTime).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const assignedPeople = shift.assignedPersonIds
                    .map(id => people.find(p => p.id === id))
                    .filter(Boolean) as Person[];

                const assignedNames = assignedPeople.length > 0
                    ? assignedPeople.map(p => p.name).join(', ')
                    : 'לא שובץ';

                const status = assignedPeople.length >= task.requiredPeople ? '✅' : '⚠️';

                output += `  ${status} ${startTime} - ${endTime}\n`;
                output += `     👥 ${assignedNames}\n`;

                if (assignedPeople.length < task.requiredPeople) {
                    output += `     📌 חסרים: ${task.requiredPeople - assignedPeople.length}\n`;
                }
                output += `\n`;
            });

            output += `\n`;
        });

        // Summary
        const totalShifts = dayShifts.length;
        const fullyAssigned = dayShifts.filter(s => {
            const task = tasks.find(t => t.id === s.taskId);
            return task && s.assignedPersonIds.length >= task.requiredPeople;
        }).length;

        output += `${'='.repeat(50)}\n`;
        output += `📊 סיכום:\n`;
        output += `   • סה"כ משמרות: ${totalShifts}\n`;
        output += `   • מאוישות במלואן: ${fullyAssigned}\n`;
        output += `   • דורשות השלמה: ${totalShifts - fullyAssigned}\n`;

        // Copy to clipboard
        try {
            await navigator.clipboard.writeText(output);
            setShowCopySuccess(true);
            setTimeout(() => setShowCopySuccess(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
            alert('❌ שגיאה בהעתקה ללוח ההדבקה');
        }
    };

    // Portal Style Card for "Current/Next" Shift
    const renderFeaturedCard = () => {
        const now = new Date();

        if (isViewer) {
            // --- Viewer Personalized View ---
            const currentPerson = people.find(p => p.name === profile?.full_name || (p as any).email === profile?.email);
            const nextPersonalShift = currentPerson
                ? shifts
                    .filter(s => s.assignedPersonIds.includes(currentPerson.id) && new Date(s.startTime) > now)
                    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0]
                : null;

            const task = nextPersonalShift ? taskTemplates.find(t => t.id === nextPersonalShift.taskId) : null;

            return (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0 overflow-hidden mb-6 md:mb-8">
                    <div className="p-4 md:p-6 lg:p-8">
                        <div className="mb-4 md:mb-6">
                            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-1">
                                שלום, {profile?.full_name?.split(' ')[0] || 'לוחם'}
                            </h2>
                            <p className="text-slate-500 text-base md:text-lg">הנה המשימה הבאה שלך להיום</p>
                        </div>

                        {nextPersonalShift && task ? (
                            <div className={`bg-white rounded-xl p-4 md:p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-md transition-all`}>
                                <div className={`absolute top-0 right-0 w-1 md:w-1.5 h-full ${task.color.replace('border-l-', 'bg-')}`}></div>

                                <div className="flex flex-col gap-3 md:gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">המשמרת הבאה</span>
                                        </div>
                                        <h3 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">{task.name}</h3>
                                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-6 sm:gap-y-2 text-slate-600 text-sm md:text-base">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon size={16} className="text-slate-400 flex-shrink-0" />
                                                <span className="font-medium">{new Date(nextPersonalShift.startTime).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock size={16} className="text-slate-400 flex-shrink-0" />
                                                <span className="font-medium" dir="ltr">
                                                    {new Date(nextPersonalShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(nextPersonalShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="hidden sm:flex items-center justify-center bg-slate-50 rounded-full w-12 h-12 md:w-16 md:h-16 text-slate-400 self-end">
                                        <Clock size={20} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-50 rounded-xl p-6 md:p-8 text-center border border-slate-100">
                                <p className="text-slate-600 text-base md:text-lg font-medium">אין משמרות קרובות ביומן</p>
                                <p className="text-slate-400 text-xs md:text-sm mt-1">ניתן לנוח ולהתעדכן בהמשך</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        // --- Admin/Manager General View ---
        const upcoming = shifts.find(s => new Date(s.startTime) > now);
        if (!upcoming) return null;
        const task = taskTemplates.find(t => t.id === upcoming.taskId);
        if (!task) return null;

        const isAssigned = upcoming.assignedPersonIds.length >= task.requiredPeople;

        return (
            <div className="bg-white rounded-xl shadow-portal p-0 overflow-hidden mb-6 md:mb-8">
                <div className="flex flex-col">
                    <div className="p-4 md:p-6 lg:p-8 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                <Clock size={12} /> משמרת קרובה
                            </span>
                            <span className="text-green-600 text-xs md:text-sm font-bold flex items-center gap-1">
                                <Check size={14} /> {isAssigned ? 'מאוישת' : 'נדרש איוש'}
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-slate-900 mb-2">{task.name}</h2>
                        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-4 text-slate-500 text-sm mb-4 md:mb-6">
                            <div className="flex items-center gap-1.5">
                                <CalendarIcon size={16} className="flex-shrink-0" />
                                <span>{new Date(upcoming.startTime).toLocaleDateString('he-IL')}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <Clock size={16} className="flex-shrink-0" />
                                <span dir="ltr">
                                    {new Date(upcoming.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(upcoming.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={16} className="flex-shrink-0" />
                                <span>מחנה נחשונים</span>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={() => setSelectedShiftId(upcoming.id)}
                                className="bg-idf-yellow hover:bg-idf-yellow-hover text-slate-900 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold shadow-sm transition-colors text-sm md:text-base"
                            >
                                נהל משמרת
                            </button>
                            <button className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 md:px-6 py-2 md:py-2.5 rounded-full font-bold transition-colors text-sm md:text-base">
                                בקשות מיוחדות
                            </button>
                        </div>
                    </div>
                    <div className="bg-slate-50 p-4 md:p-6 border-t md:border-t-0 md:border-r border-slate-100 flex flex-col justify-center">
                        <h4 className="font-bold text-slate-700 mb-3 text-sm md:text-base">צוות משובץ:</h4>
                        <div className="flex flex-wrap gap-2 md:-space-x-3 md:space-x-reverse md:flex-nowrap">
                            {upcoming.assignedPersonIds.length === 0 && <span className="text-slate-400 text-xs md:text-sm">טרם שובצו</span>}
                            {upcoming.assignedPersonIds.map(pid => {
                                const p = people.find(x => x.id === pid);
                                return p ? (
                                    <div key={pid} title={p.name} className={`w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white flex items-center justify-center text-white font-bold shadow-sm text-xs md:text-sm ${p.color}`}>
                                        {getPersonInitials(p.name)}
                                    </div>
                                ) : null;
                            })}
                        </div>
                        {upcoming.assignedPersonIds.length < task.requiredPeople && (
                            <div className="mt-3 text-xs text-red-500 font-medium flex items-center gap-1">
                                <Sparkles size={12} />
                                חסרים {task.requiredPeople - upcoming.assignedPersonIds.length} לוחמים
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const Modal = () => {
        if (!selectedShift) return null;
        const task = taskTemplates.find(t => t.id === selectedShift.taskId);
        if (!task) return null;

        const [isEditingTime, setIsEditingTime] = useState(false);
        const [newStart, setNewStart] = useState(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
        const [newEnd, setNewEnd] = useState(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));

        const assignedPeople = selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];
        const availablePeople = people.filter(p => !selectedShift.assignedPersonIds.includes(p.id));

        const handleSaveTime = () => {
            const [sh, sm] = newStart.split(':').map(Number);
            const [eh, em] = newEnd.split(':').map(Number);

            const s = new Date(selectedShift.startTime);
            s.setHours(sh, sm);
            const e = new Date(selectedShift.endTime);
            e.setHours(eh, em);

            if (e.getTime() < s.getTime()) {
                e.setDate(e.getDate() + 1);
            } else if (e.getDate() !== s.getDate()) {
                const diff = new Date(selectedShift.endTime).getDate() - new Date(selectedShift.startTime).getDate();
                if (diff > 0) e.setDate(s.getDate() + diff);
                else e.setDate(s.getDate());
            }

            onUpdateShift({
                ...selectedShift,
                startTime: s.toISOString(),
                endTime: e.toISOString()
            });
            setIsEditingTime(false);
        };

        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-2 md:p-4 animate-fadeIn">
                <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[85vh]">
                    <div className="p-3 md:p-6 border-b border-slate-100 bg-slate-50">
                        <div className="flex justify-between items-start gap-2">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-base md:text-xl font-bold text-slate-900 truncate">{task.name} - {isViewer ? 'פרטי משמרת' : 'ניהול שיבוץ'}</h3>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {!isEditingTime ? (
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-slate-500 text-xs md:text-sm flex items-center gap-1 md:gap-2">
                                                <span>{new Date(selectedShift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</span>
                                                <span className="text-slate-300">|</span>
                                                <span dir="ltr" className="text-[11px] md:text-sm">
                                                    {new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </p>
                                            {!isViewer && (
                                                <button onClick={() => setIsEditingTime(true)} className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded-full transition-colors" title="ערוך שעות">
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 md:gap-2 animate-fadeIn">
                                            <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="text-xs md:text-sm p-1 rounded border border-slate-300 w-20" />
                                            <span className="text-xs">-</span>
                                            <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="text-xs md:text-sm p-1 rounded border border-slate-300 w-20" />
                                            <button onClick={handleSaveTime} className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded-full transition-colors"><Save size={12} /></button>
                                            <button onClick={() => setIsEditingTime(false)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-full transition-colors"><X size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                {!isViewer && (
                                    <button onClick={() => { onDeleteShift(selectedShift.id); setSelectedShiftId(null); }} className="p-1.5 md:p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors" title="מחק משמרת">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                <button onClick={() => setSelectedShiftId(null)} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                        {/* Assigned People Section */}
                        <div className="flex-1 p-3 md:p-6 overflow-y-auto border-b md:border-b-0 md:border-l border-slate-100">
                            <h4 className="font-bold text-slate-800 mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">משובצים ({assignedPeople.length}/{task.requiredPeople})</h4>
                            <div className="space-y-2 md:space-y-3">
                                {assignedPeople.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-2 md:p-3 bg-green-50 border border-green-100 rounded-lg md:rounded-xl">
                                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                            <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold flex-shrink-0 ${p.color}`}>{getPersonInitials(p.name)}</div>
                                            <div className="flex flex-col min-w-0 flex-1">
                                                <span className="font-bold text-slate-800 text-xs md:text-sm truncate">{p.name}</span>
                                                {task.roleComposition && task.roleComposition.length > 0 && (
                                                    <span className="text-[9px] md:text-[10px] text-slate-500 truncate">
                                                        {roles.find(r => task.roleComposition.some(rc => rc.roleId === r.id) && p.roleIds.includes(r.id))?.name || ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {!isViewer && (
                                            <button onClick={() => onUnassign(selectedShift.id, p.id)} className="text-red-500 p-1 md:p-1.5 hover:bg-red-100 rounded-lg flex-shrink-0">
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {assignedPeople.length === 0 && <p className="text-slate-400 text-xs md:text-sm text-center py-4">לא שובצו לוחמים</p>}
                            </div>
                        </div>

                        {/* Available People Section */}
                        {!isViewer && (
                            <div className="flex-1 p-3 md:p-6 overflow-y-auto bg-slate-50/50">
                                <h4 className="font-bold text-slate-800 mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">מאגר זמין</h4>
                                <div className="space-y-1.5 md:space-y-2">
                                    {availablePeople.map(p => {
                                        const hasRole = !task.roleComposition || task.roleComposition.length === 0 || task.roleComposition.some(rc => p.roleIds.includes(rc.roleId));
                                        const isFull = assignedPeople.length >= task.requiredPeople;
                                        const canAssign = hasRole && !isFull;

                                        return (
                                            <div key={p.id} className={`flex items-center justify-between p-2 md:p-3 rounded-lg md:rounded-xl border transition-all ${canAssign ? 'bg-white border-slate-200 hover:border-blue-300' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                                                <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                    <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold flex-shrink-0 ${p.color}`}>{getPersonInitials(p.name)}</div>
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                        <span className="font-bold text-slate-700 text-xs md:text-sm truncate">{p.name}</span>
                                                        {!hasRole && <span className="text-[9px] md:text-[10px] text-red-500">אין התאמה</span>}
                                                        {isFull && hasRole && <span className="text-[9px] md:text-[10px] text-amber-500">משמרת מלאה</span>}
                                                    </div>
                                                </div>
                                                <button onClick={() => onAssign(selectedShift.id, p.id)} disabled={!canAssign} className={`px-2 md:px-3 py-1 rounded-full text-[10px] md:text-xs font-bold flex-shrink-0 ${canAssign ? 'bg-idf-yellow text-slate-900 hover:bg-idf-yellow-hover' : 'bg-slate-200 text-slate-400'}`}>שבץ</button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // NEW: Build mismatch warnings list (filtered by acknowledged ones)
    const mismatchWarnings = useMemo(() => {
        if (isViewer) return []; // NEW: Empty array for viewers

        return shifts.flatMap(shift => {
            const task = taskTemplates.find(t => t.id === shift.taskId);
            if (!task) return [];
            const requiredRoleIds = task.roleComposition.map(rc => rc.roleId);
            return shift.assignedPersonIds
                .filter(pid => {
                    const person = people.find(p => p.id === pid);
                    if (!person) return false;

                    // NEW: Create unique warning ID
                    const warningId = `${shift.id}-${pid}`;

                    // Skip if already acknowledged
                    if (acknowledgedWarnings.has(warningId)) return false;

                    return !person.roleIds.some(rid => requiredRoleIds.includes(rid));
                })
                .map(pid => {
                    const person = people.find(p => p.id === pid)!;
                    return {
                        warningId: `${shift.id}-${pid}`, // NEW: Unique ID
                        shiftId: shift.id,
                        personId: pid, // NEW: Track person ID
                        taskName: task.name,
                        start: new Date(shift.startTime),
                        end: new Date(shift.endTime),
                        personName: person.name,
                        missingRoles: requiredRoleIds
                            .map(rid => roles.find(r => r.id === rid)?.name)
                            .filter(Boolean) as string[]
                    };
                });
        });
    }, [shifts, taskTemplates, people, roles, acknowledgedWarnings, isViewer]); // NEW: Add isViewer

    // NEW: Handler to acknowledge (dismiss) a warning with DB save
    const handleAcknowledgeWarning = async (warningId: string) => {
        // Update local state immediately
        setAcknowledgedWarnings(prev => new Set([...prev, warningId]));

        // Save to database
        if (organization?.id) {
            const { error } = await supabase
                .from('acknowledged_warnings')
                .upsert({
                    organization_id: organization.id,
                    warning_id: warningId,
                    acknowledged_at: new Date().toISOString()
                }, {
                    onConflict: 'organization_id,warning_id'
                });

            if (error) {
                console.error('Error saving acknowledged warning:', error);
            }
        }
    };

    // Helper to filter visible tasks for the daily view
    const visibleTasks = useMemo(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        return taskTemplates.filter(task => {
            if (task.schedulingType === 'one-time' && task.specificDate) {
                return task.specificDate === dateKey;
            }
            return true;
        });
    }, [taskTemplates, selectedDate]);

    // Date Navigation Logic for Viewers
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate max date for viewers
    const maxViewerDate = new Date(today);
    maxViewerDate.setDate(today.getDate() + (viewerDaysLimit - 1));

    const isAtViewerLimit = selectedDate >= maxViewerDate;

    const canGoNext = !isViewer || !isAtViewerLimit;
    const canGoPrev = true; // Allow viewing history

    // NEW: Handler to jump to a specific shift's date (WITHOUT opening modal)
    const handleJumpToShift = (shiftId: string, shiftStart: Date) => {
        // 1. Change to the shift's date
        const shiftDate = new Date(shiftStart);
        shiftDate.setHours(0, 0, 0, 0);
        onDateChange(shiftDate);

        // 2. Scroll to the shift card after a brief delay (to ensure date change renders)
        setTimeout(() => {
            const shiftElement = document.getElementById(`shift-card-${shiftId}`);
            if (shiftElement) {
                shiftElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Add a temporary highlight effect
                shiftElement.classList.add('ring-4', 'ring-red-500', 'ring-offset-2');
                setTimeout(() => {
                    shiftElement.classList.remove('ring-4', 'ring-red-500', 'ring-offset-2');
                }, 2000);
            }
        }, 300);
    };

    return (
        <div className="flex flex-col gap-8">
            {renderFeaturedCard()}
            {selectedShift && <Modal />}

            {/* Copy Success Toast */}
            {showCopySuccess && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-fadeIn">
                    <div className="bg-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 border-2 border-emerald-400">
                        <div className="bg-emerald-50 rounded-full p-1.5">
                            <Check size={16} className="text-emerald-600" />
                        </div>
                        <span className="font-medium text-slate-700">הלוח הועתק בהצלחה</span>
                    </div>
                </div>
            )}

            {/* Global Mismatch Warnings Panel */}
            {!isViewer && !isLoadingWarnings && mismatchWarnings.length > 0 && (
                <div className="rounded-xl border-2 border-red-500 bg-red-50 p-3 md:p-4 space-y-2 md:space-y-3 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="text-red-600 flex-shrink-0" size={18} />
                            <h2 className="text-red-700 font-bold text-base md:text-lg">
                                אזהרות שיבוץ ({mismatchWarnings.length})
                            </h2>
                        </div>
                        <button
                            onClick={() => {
                                const allWarningIds = mismatchWarnings.map(w => w.warningId);
                                setAcknowledgedWarnings(new Set([...acknowledgedWarnings, ...allWarningIds]));
                            }}
                            className="text-xs text-red-600 hover:text-red-800 font-bold px-3 py-1 rounded-full bg-white hover:bg-red-100 transition-colors whitespace-nowrap"
                        >
                            אשר הכל
                        </button>
                    </div>
                    <ul className="space-y-2">
                        {mismatchWarnings.map((w) => (
                            <li key={w.warningId} className="text-xs md:text-sm flex flex-col gap-2 bg-white/60 rounded-md p-2 md:px-3 md:py-2 border border-red-300">
                                <div onClick={() => handleJumpToShift(w.shiftId, w.start)} className="flex-1 flex flex-col gap-1 cursor-pointer hover:bg-white/80">
                                    <div className="flex flex-wrap items-center gap-1">
                                        <span className="font-bold text-red-700">{w.personName}</span>
                                        <span className="text-red-600">במשימה "{w.taskName}"</span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 text-slate-600">
                                        <span className="font-medium text-xs">📅 {w.start.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</span>
                                        <span className="text-xs" dir="ltr">🕐 {w.start.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}–{w.end.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <span className="text-xs text-red-500">חסר: {w.missingRoles.join(', ')}</span>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleAcknowledgeWarning(w.warningId); }}
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold transition-colors"
                                >
                                    <CheckCircle size={14} />
                                    אישור
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Calendar Board Container */}
            <div className="bg-white rounded-xl shadow-portal p-3 md:p-6">
                {/* Controls Header */}
                <div className="flex flex-col gap-3 md:gap-4 mb-4 md:mb-6">
                    {/* Top Row */}
                    <div className="flex flex-wrap items-center gap-2 md:gap-3">
                        <h3 className="text-lg md:text-xl font-bold text-slate-800">מבט יומי</h3>
                        {!isViewer && (() => {
                            const dateKey = selectedDate.toLocaleDateString('en-CA');
                            const unavailableCount = people.filter(p => {
                                if (p.unavailableDates?.includes(dateKey)) return true;
                                if (p.dailyAvailability?.[dateKey]?.isAvailable === false) return true;
                                return false;
                            }).length;
                            const availableCount = people.length - unavailableCount;

                            return (
                                <div className="flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-emerald-50 to-green-50 px-2 md:px-4 py-1 md:py-2 rounded-full border border-emerald-200">
                                    <User size={14} className="text-emerald-600" />
                                    <span className="text-xs md:text-sm font-bold text-emerald-700">
                                        זמינים: {availableCount}/{people.length}
                                    </span>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Bottom Row */}
                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 md:gap-3">
                        {/* Action Buttons */}
                        <div className="flex gap-2 order-2 sm:order-1">
                            <button onClick={handleExportToClipboard} className="flex items-center justify-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors flex-1 sm:flex-initial">
                                <Copy size={14} />
                                <span className="hidden sm:inline">העתק ללוח</span>
                                <span className="sm:hidden">העתק</span>
                            </button>
                            {!isViewer && (
                                <button onClick={onClearDay} className="flex items-center justify-center gap-1.5 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors flex-1 sm:flex-initial">
                                    <Trash2 size={14} />
                                    <span className="hidden sm:inline">נקה יום</span>
                                    <span className="sm:hidden">נקה</span>
                                </button>
                            )}
                        </div>

                        {/* Date Navigation */}
                        <div className="flex items-center justify-center bg-slate-100 rounded-full p-0.5 md:p-1 order-1 sm:order-2">
                            <button onClick={() => { if (canGoNext) { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); onDateChange(d); } }} disabled={!canGoNext} className={`p-1.5 md:p-2 rounded-full transition-all ${canGoNext ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}>
                                <ChevronRight size={16} />
                            </button>

                            <span className="px-2 md:px-4 text-xs md:text-sm font-bold text-slate-600 min-w-[120px] md:min-w-[140px] text-center">
                                {selectedDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>

                            <button onClick={() => { if (canGoPrev) { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); onDateChange(d); } }} disabled={!canGoPrev} className={`p-1.5 md:p-2 rounded-full transition-all ${canGoPrev ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}>
                                <ChevronLeft size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto pb-4 -mx-3 md:mx-0 px-3 md:px-0">
                    <div className="flex gap-2 md:gap-4 min-w-max md:min-w-[1000px]">
                        {visibleTasks.length > 0 ? visibleTasks.map(task => {
                            const dateKey = selectedDate.toLocaleDateString('en-CA');
                            const taskShifts = shifts.filter(s => {
                                if (s.taskId !== task.id) return false;
                                const shiftDate = new Date(s.startTime).toLocaleDateString('en-CA');
                                return shiftDate === dateKey;
                            }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                            return (
                                <div key={task.id} className="flex-1 min-w-[200px] md:min-w-[250px] bg-slate-50 rounded-xl p-2 md:p-3">
                                    <div className={`border-b-2 pb-1.5 md:pb-2 mb-2 md:mb-3 ${task.color.replace('border-l-', 'border-')}`}>
                                        <h4 className="font-bold text-slate-800 text-sm md:text-base truncate">{task.name}</h4>
                                        <div className="flex justify-between text-[10px] md:text-xs text-slate-500 mt-0.5 md:mt-1">
                                            <span>{task.schedulingType === 'continuous' ? 'רציף' : 'בודדת'}</span>
                                            <span>{taskShifts.length} משמרות</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        {taskShifts.map(shift => (
                                            <div key={shift.id} id={`shift-card-${shift.id}`}>
                                                <ShiftCard
                                                    shift={shift}
                                                    taskTemplates={taskTemplates}
                                                    people={people}
                                                    roles={roles}
                                                    onSelect={(s) => setSelectedShiftId(s.id)}
                                                    onDelete={onDeleteShift}
                                                    isViewer={isViewer}
                                                    acknowledgedWarnings={isViewer ? new Set() : acknowledgedWarnings}
                                                />
                                            </div>
                                        ))}
                                        {taskShifts.length === 0 && <div className="text-center py-10 text-slate-400 text-sm italic">אין משמרות ליום זה</div>}
                                    </div>
                                </div>
                            );
                        }) : <div className="w-full text-center py-12 md:py-20 text-slate-400 font-medium text-sm md:text-base">אין משימות המוגדרות לתאריך זה</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};
