import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shift, Person, TaskTemplate, Role, Team } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { RotateCcw, Sparkles } from 'lucide-react';
import { ChevronLeft, ChevronRight, Plus, X, Check, AlertTriangle, Clock, User, MapPin, Calendar as CalendarIcon, Pencil, Save, Trash2, Copy, CheckCircle, Ban, Undo2, ChevronDown, Search } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationModal } from './ConfirmationModal';
import { analytics } from '../services/analytics';
import { supabase } from '../services/supabaseClient';
import { EmptyStateGuide } from './EmptyStateGuide';

interface ScheduleBoardProps {
    shifts: Shift[];
    people: Person[];
    taskTemplates: TaskTemplate[];
    roles: Role[];
    teams: Team[];
    constraints: import('../types').SchedulingConstraint[];
    selectedDate: Date;
    onDateChange: (date: Date) => void;
    onSelect: (shift: Shift) => void;
    onDelete: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings?: Set<string>;
    onClearDay: () => void;
    onNavigate: (view: 'personnel' | 'tasks', tab?: 'people' | 'teams' | 'roles') => void;
    onAssign: (shiftId: string, personId: string) => void;
    onUnassign: (shiftId: string, personId: string) => void;
    onAddShift: (task: TaskTemplate, date: Date) => void;
    onUpdateShift: (shift: Shift) => void;
    onToggleCancelShift: (shiftId: string) => void;
}

// Helper to calculate position based on time
const PIXELS_PER_HOUR = 60;
const START_HOUR = 0;
const HEADER_HEIGHT = 40;

const getPositionFromTime = (date: Date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const totalHours = hours + minutes / 60;
    return (totalHours - START_HOUR) * PIXELS_PER_HOUR;
};

const getHeightFromDuration = (start: Date, end: Date) => {
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    return durationHours * PIXELS_PER_HOUR;
    return durationHours * PIXELS_PER_HOUR;
};

const hexToRgba = (hex: string, alpha: number) => {
    if (!hex) return `rgba(226, 232, 240, ${alpha})`; // Slate-200 equivalent
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const ShiftCard: React.FC<{
    shift: Shift;
    taskTemplates: TaskTemplate[];
    people: Person[];
    roles: Role[];
    onSelect: (shift: Shift) => void;
    onToggleCancel: (shiftId: string) => void;
    isViewer: boolean;
    acknowledgedWarnings?: Set<string>;
    style?: React.CSSProperties;
}> = ({ shift, taskTemplates, people, roles, onSelect, onToggleCancel, isViewer, acknowledgedWarnings, style }) => {
    const task = taskTemplates.find(t => t.id === shift.taskId);
    if (!task) return null;
    const assigned = shift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[];

    // Determine status color
    let bgColor = 'bg-blue-50';
    let borderColor = 'border-blue-200';
    if (shift.isCancelled) { bgColor = 'bg-slate-100'; borderColor = 'border-slate-300'; }
    else if (shift.assignedPersonIds.length === 0) { bgColor = 'bg-white'; }
    else if (task.segments && task.segments.length > 0) {
        // Use segment or task required people
        const segment = task.segments.find(s => s.id === shift.segmentId) || task.segments[0];
        const req = shift.requirements?.requiredPeople || segment?.requiredPeople || 1;
        if (shift.assignedPersonIds.length >= req) { bgColor = 'bg-green-50'; borderColor = 'border-green-200'; }
    }

    // Calc required for display
    const segment = task.segments?.find(s => s.id === shift.segmentId) || task.segments?.[0];
    const req = shift.requirements?.requiredPeople || segment?.requiredPeople || 1;

    return (
        <div
            id={`shift-card-${shift.id}`}
            className={`absolute flex flex-col p-1.5 rounded-md border text-xs cursor-pointer transition-all overflow-hidden ${bgColor} ${borderColor} hover:border-blue-400 group justify-between shadow-sm`}
            style={style}
            onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
        >
            {/* Top Row: Task Name & Actions */}
            <div className="flex font-bold truncate text-slate-800 text-[11px] md:text-sm justify-between items-start">
                <div className="flex items-center gap-1 truncate">
                    {shift.isCancelled && <Ban size={12} className="text-red-500 mr-1" />}
                    <span>{task.name}</span>
                </div>
                {!isViewer && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCancel(shift.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-slate-200 rounded transition-opacity"
                        title={shift.isCancelled ? 'הפעל משמרת' : 'בטל משמרת'}
                    >
                        {shift.isCancelled ? <RotateCcw size={12} className="text-blue-500" /> : <Ban size={12} className="text-slate-400 hover:text-red-500" />}
                    </button>
                )}
            </div>

            {/* Middle Row - Names (Adaptive - Desktop Only) */}
            {(style?.height && parseInt(String(style.height)) >= 50 && assigned.length > 0) && (
                <div className="hidden md:flex flex-1 flex-col justify-center items-center gap-1 overflow-hidden py-1 w-full px-1">
                    {assigned.map(p => (
                        <div
                            key={p.id}
                            className={`shadow-sm border border-slate-200/60 bg-white/95 px-3 py-1 rounded-full text-xs font-bold text-slate-800 truncate w-full max-w-[95%] text-center hover:scale-105 transition-transform hover:shadow-md cursor-help z-10`}
                            title={p.name}
                            onClick={(e) => { e.stopPropagation(); onSelect(shift); }}
                        >
                            {p.name}
                        </div>
                    ))}
                </div>
            )}

            {/* Bottom Row: Info & Avatars (Fallback) */}
            <div className={`flex items-end justify-between ${!(style?.height && parseInt(String(style.height)) >= 50 && assigned.length > 0) ? 'mt-auto' : ''} pt-1 w-full overflow-hidden`}>

                {/* Staffing Count */}
                <div className="text-[10px] text-slate-400 font-medium leading-none flex-shrink-0 ml-1 mb-0.5">
                    {assigned.length}/{req}
                </div>

                {/* Avatars Logic:
                    1. If Shift is Short (<50px): Always Show (Flex).
                    2. If Shift is Tall (>=50px):
                       - Mobile: Show (Flex) - because Names are hidden.
                       - Desktop: Hide (md:Hidden) - because Names are shown.
                */}
                {(assigned.length > 0) && (
                    <div className={`flex -space-x-1.5 space-x-reverse overflow-hidden px-1 pb-0.5 ${(style?.height && parseInt(String(style.height)) >= 50) ? 'md:hidden' : ''}`}>
                        {assigned.map(p => (
                            <div key={p.id} className={`w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] text-white font-bold ring-2 ring-white ${p.color} shadow-sm`} title={p.name}>
                                {getPersonInitials(p.name)}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Warning Indicator */}
            {acknowledgedWarnings && assigned.some(p => {
                const segment = task.segments?.find(s => s.id === shift.segmentId) || task.segments?.[0];
                const roleComposition = shift.requirements?.roleComposition || segment?.roleComposition || [];
                const requiredRoleIds = roleComposition.map(rc => rc.roleId);
                if (requiredRoleIds.length === 0) return false;

                const isMismatch = !p.roleIds.some(rid => requiredRoleIds.includes(rid));
                return isMismatch && !acknowledgedWarnings.has(`${shift.id}-${p.id}`);
            }) && (
                    <div className="absolute top-0 right-0 p-0.5">
                        <AlertTriangle size={10} className="text-amber-500" />
                    </div>
                )}
        </div>
    );
};

export const ScheduleBoard: React.FC<ScheduleBoardProps> = ({
    shifts, people, taskTemplates, roles, teams, constraints,
    selectedDate, onDateChange, onSelect, onDelete, isViewer,
    acknowledgedWarnings: propAcknowledgedWarnings, onClearDay, onNavigate, onAssign,
    onUnassign, onAddShift, onUpdateShift, onToggleCancelShift
}) => {
    // Scroll Synchronization Refs
    const headerScrollRef = useRef<HTMLDivElement>(null);
    const bodyScrollRef = useRef<HTMLDivElement>(null);

    // Synchronize horizontal scrolling between header and body
    useEffect(() => {
        const headerElement = headerScrollRef.current;
        const bodyElement = bodyScrollRef.current;

        if (!headerElement || !bodyElement) return;

        const handleHeaderScroll = () => {
            if (bodyElement.scrollLeft !== headerElement.scrollLeft) {
                bodyElement.scrollLeft = headerElement.scrollLeft;
            }
        };

        const handleBodyScroll = () => {
            if (headerElement.scrollLeft !== bodyElement.scrollLeft) {
                headerElement.scrollLeft = bodyElement.scrollLeft;
            }
        };

        headerElement.addEventListener('scroll', handleHeaderScroll);
        bodyElement.addEventListener('scroll', handleBodyScroll);

        return () => {
            headerElement.removeEventListener('scroll', handleHeaderScroll);
            bodyElement.removeEventListener('scroll', handleBodyScroll);
        };
    }, []);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const selectedShift = useMemo(() => shifts.find(s => s.id === selectedShiftId), [shifts, selectedShiftId]);
    const [isLoadingWarnings, setIsLoadingWarnings] = useState(false);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [newStart, setNewStart] = useState('');
    const [newEnd, setNewEnd] = useState('');
    const [isEditingTime, setIsEditingTime] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewerDaysLimit, setViewerDaysLimit] = useState(2);
    const now = new Date();
    // Local state for warnings
    const [localAcknowledgedWarnings, setLocalAcknowledgedWarnings] = useState<Set<string>>(new Set());
    const acknowledgedWarnings = propAcknowledgedWarnings || localAcknowledgedWarnings;
    const setAcknowledgedWarnings = setLocalAcknowledgedWarnings;

    // Helper to resolve warnings based on prop or local state
    // If prop is provided, we can't set it locally easily without callback. 
    // For now assuming local handling to match previous logic found in file.

    const renderFeaturedCard = () => null; // Placeholder to fix build error
    const handleExportToClipboard = async () => { }; // Placeholder
    const dateInputRef = useRef<HTMLInputElement>(null);

    // Measure header height for sticky stacking - REMOVED per user request
    // The simplified layout relies on flexbox and overflow-auto



    const { organization } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    useEffect(() => {
        if (selectedShift) {
            setNewStart(new Date(selectedShift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
            setNewEnd(new Date(selectedShift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }));
        }
    }, [selectedShift]);

    const toggleTeamCollapse = (teamId: string) => {
        const newSet = new Set(collapsedTeams);
        if (newSet.has(teamId)) newSet.delete(teamId);
        else newSet.add(teamId);
        setCollapsedTeams(newSet);
    };

    const assignedPeople = useMemo(() =>
        selectedShift ? selectedShift.assignedPersonIds.map(id => people.find(p => p.id === id)).filter(Boolean) as Person[] : []
        , [selectedShift, people]);


    const availablePeople = useMemo(() => {
        if (!selectedShift) return [];
        const task = taskTemplates.find(t => t.id === selectedShift.taskId);
        if (!task) return [];

        // Resolve requirements
        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];
        const requiredRoleIds = roleComposition.map(rc => rc.roleId);

        return people.filter(p => {
            // 1. Exclude if already assigned
            if (selectedShift.assignedPersonIds.includes(p.id)) return false;

            // 2. Check unavailability
            if (p.unavailableDates?.includes(selectedDate.toLocaleDateString('en-CA'))) return false;
            if (p.dailyAvailability?.[selectedDate.toLocaleDateString('en-CA')]?.isAvailable === false) return false;

            // 3. Role check
            if (requiredRoleIds.length > 0) {
                const hasRole = p.roleIds.some(rid => requiredRoleIds.includes(rid));
                if (!hasRole) return false;
            }

            // 4. Search Term
            if (searchTerm) {
                return p.name.includes(searchTerm) || (p.phone && p.phone.includes(searchTerm));
            }

            return true;
        });
    }, [people, selectedShift, selectedDate, searchTerm, taskTemplates]);


    const Modal = () => {
        const [suggestedCandidates, setSuggestedCandidates] = useState<{ person: Person, reason: string }[]>([]);
        const [suggestionIndex, setSuggestionIndex] = useState(0);

        if (!selectedShift) return null;
        const task = taskTemplates.find(t => t.id === selectedShift.taskId)!;

        const handleSuggestBest = () => {
            const candidates = people.map(p => {
                let score = 0;
                const reasons: string[] = [];
                // Reconstruct variables for orphaned code
                const personShifts = shifts.filter(s => s.assignedPersonIds.includes(p.id));
                const hasRestViolation = false; // Placeholder

                // ORPHANED CODE CONNECTS HERE
                if (hasRestViolation) {
                    score -= 1000; // Heavy penalty for rest violation
                    reasons.push('מנוחה לא מספקת');
                }

                // Conflict Check (Overlapping)
                const hasOverlap = personShifts.some(s => {
                    const sStart = new Date(s.startTime);
                    const sEnd = new Date(s.endTime);
                    const thisStart = new Date(selectedShift.startTime);
                    const thisEnd = new Date(selectedShift.endTime);
                    return sStart < thisEnd && sEnd > thisStart;
                });

                if (hasOverlap) {
                    score -= 5000; // Disqualify
                    reasons.push('חפיפה עם משמרת אחרת');
                }

                return { person: p, score, reasons };
            });

            // 3. Sort and Filter
            const validCandidates = candidates
                .filter(c => c.score > -4000) // Filter out hard conflicts
                .sort((a, b) => b.score - a.score)
                .map(c => ({
                    person: c.person,
                    reason: c.reasons.length > 0 ? c.reasons.join(', ') : 'זמינות וניקוד אופטימליים'
                }));

            if (validCandidates.length > 0) {
                setSuggestedCandidates(validCandidates);
                setSuggestionIndex(0);
            } else {
                showToast('לא נמצאו מועמדים מתאימים', 'error');
            }
        };

        const handleNextSuggestion = () => {
            setSuggestionIndex(prev => (prev + 1) % suggestedCandidates.length);
        };

        const currentSuggestion = suggestedCandidates[suggestionIndex];

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

        return createPortal(
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 md:p-6 animate-fadeIn pt-16 md:pt-24">
                <div className="bg-white rounded-xl md:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[calc(100vh-10rem)] md:max-h-[calc(100vh-12rem)] mb-16 md:mb-0">
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
                                        <div className="flex items-center gap-1 md:gap-2 animate-fadeIn flex-wrap">
                                            <input type="time" value={newStart} onChange={e => setNewStart(e.target.value)} className="text-xs md:text-sm p-1 rounded border border-slate-300 w-20 text-right" lang="he" />
                                            <span className="text-xs">-</span>
                                            <input type="time" value={newEnd} onChange={e => setNewEnd(e.target.value)} className="text-xs md:text-sm p-1 rounded border border-slate-300 w-20 text-right" lang="he" />
                                            <button onClick={handleSaveTime} className="text-green-600 hover:text-green-800 p-1 bg-green-50 rounded-full transition-colors"><Save size={12} /></button>
                                            <button onClick={() => setIsEditingTime(false)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded-full transition-colors"><X size={12} /></button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                                {!isViewer && (
                                    <button onClick={() => { onToggleCancelShift(selectedShift.id); setSelectedShiftId(null); }} className={`p-1.5 md:p-2 rounded-full transition-colors ${selectedShift.isCancelled ? 'text-green-600 hover:bg-green-50' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`} title={selectedShift.isCancelled ? "שחזר משמרת" : "בטל משמרת"}>
                                        {selectedShift.isCancelled ? <Undo2 size={16} /> : <Ban size={16} />}
                                    </button>
                                )}
                                <button onClick={() => setSelectedShiftId(null)} className="p-1.5 md:p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">
                        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
                            <div className="md:flex-1 p-3 md:p-6 h-fit border-b md:border-b-0 md:border-l border-slate-100">
                                <h4 className="font-bold text-slate-800 mb-3 md:mb-4 text-xs md:text-sm uppercase tracking-wider">משובצים ({assignedPeople.length}/{selectedShift.requirements?.requiredPeople || (task.segments?.find(s => s.id === selectedShift.segmentId)?.requiredPeople || task.segments?.[0]?.requiredPeople || 1)})</h4>

                                {currentSuggestion && (
                                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 animate-fadeIn">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                                                <Sparkles size={12} />
                                                המלצה חכמה
                                            </span>
                                            <button onClick={() => setSuggestedCandidates([])} className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${currentSuggestion.person.color}`}>
                                                    {getPersonInitials(currentSuggestion.person.name)}
                                                </div>
                                                <div>
                                                    <div className="text-sm font-bold text-slate-800">{currentSuggestion.person.name}</div>
                                                    <div className="text-[10px] text-slate-500">{currentSuggestion.reason}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {suggestedCandidates.length > 1 && (
                                                    <button
                                                        onClick={handleNextSuggestion}
                                                        className="text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                                                    >
                                                        <RotateCcw size={14} />
                                                        <span>הצעה חדשה</span>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        onAssign(selectedShift.id, currentSuggestion.person.id);
                                                        setSuggestedCandidates([]);
                                                    }}
                                                    className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold hover:bg-blue-700 transition-colors"
                                                >
                                                    שבץ
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2 md:space-y-3">
                                    {assignedPeople.map(p => (
                                        <div key={p.id} className="flex items-center justify-between p-2 md:p-3 bg-green-50 border border-green-100 rounded-lg md:rounded-xl">
                                            <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                                <div className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold flex-shrink-0 ${p.color}`}>{getPersonInitials(p.name)}</div>
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="font-bold text-slate-800 text-xs md:text-sm truncate">{p.name}</span>
                                                    {(() => {
                                                        const segment = task.segments?.find(s => s.id === selectedShift.segmentId) || task.segments?.[0];
                                                        const roleComposition = selectedShift.requirements?.roleComposition || segment?.roleComposition || [];

                                                        if (roleComposition.length > 0) {
                                                            return (
                                                                <span className="text-[9px] md:text-[10px] text-slate-500 truncate">
                                                                    {roles.find(r => roleComposition.some(rc => rc.roleId === r.id) && p.roleIds.includes(r.id))?.name || ''}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })()}
                                                </div>
                                            </div>
                                            {!isViewer && (
                                                <button onClick={() => onUnassign(selectedShift.id, p.id)} className="text-red-500 p-1 md:p-1.5 hover:bg-red-100 rounded-lg flex-shrink-0">
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {assignedPeople.length === 0 && <p className="text-slate-400 text-xs md:text-sm text-center py-4">לא שובצו חיילים</p>}
                                </div>
                            </div>

                            {!isViewer && (
                                <div className="flex-1 p-3 md:p-6 h-fit bg-slate-50/50">
                                    <div className="flex items-center justify-between mb-3 md:mb-4">
                                        <h4 className="font-bold text-slate-800 text-xs md:text-sm uppercase tracking-wider">מאגר זמין</h4>
                                        <button
                                            onClick={handleSuggestBest}
                                            className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-full transition-colors"
                                        >
                                            <Sparkles size={12} />
                                            תציע לי חייל זמין                                        </button>
                                    </div>
                                    <div className="relative mb-3">
                                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                        <input
                                            type="text"
                                            placeholder="חפש חייל פנוי..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        {(() => {
                                            const peopleByTeam = teams.map(team => ({
                                                team,
                                                members: availablePeople.filter(p => p.teamId === team.id)
                                            }));

                                            const noTeamMembers = availablePeople.filter(p => !p.teamId || !teams.find(t => t.id === p.teamId));
                                            if (noTeamMembers.length > 0) {
                                                peopleByTeam.push({
                                                    team: { id: 'no-team', name: 'ללא צוות', color: 'border-slate-300' } as any,
                                                    members: noTeamMembers
                                                });
                                            }

                                            return peopleByTeam.map(({ team, members }) => {
                                                if (members.length === 0) return null;
                                                const isCollapsed = collapsedTeams.has(team.id);

                                                return (
                                                    <div key={team.id} className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                                                        <div
                                                            className="px-2 py-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                                                            onClick={() => toggleTeamCollapse(team.id)}
                                                        >
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <div className={`w-0.5 h-4 rounded-full ${team.color?.replace('border-', 'bg-') || 'bg-slate-400'}`}></div>
                                                                <span className="font-bold text-xs text-slate-700 truncate">{team.name}</span>
                                                                <span className="text-[10px] bg-white px-1.5 rounded-full border border-slate-200 text-slate-500 font-bold">{members.length}</span>
                                                            </div>
                                                            <button className="text-slate-400">
                                                                {isCollapsed ? <ChevronLeft size={14} /> : <ChevronDown size={14} />}
                                                            </button>
                                                        </div>

                                                        {!isCollapsed && (
                                                            <div className="space-y-1.5 p-2 pt-0 md:space-y-2 border-t border-slate-200/50 mt-1">
                                                                {members.map(p => {
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
                                                        )}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>,
            document.body
        );
    };


    const mismatchWarnings = useMemo(() => {
        if (isViewer) return [];

        return shifts.flatMap(shift => {
            const task = taskTemplates.find(t => t.id === shift.taskId);
            if (!task) return [];

            // Resolve requirements from shift snapshot or segment
            const segment = task.segments?.find(s => s.id === shift.segmentId) || task.segments?.[0];
            const roleComposition = shift.requirements?.roleComposition || segment?.roleComposition || [];

            const requiredRoleIds = roleComposition.map(rc => rc.roleId);
            return shift.assignedPersonIds
                .filter(pid => {
                    const person = people.find(p => p.id === pid);
                    if (!person) return false;

                    const warningId = `${shift.id}-${pid}`;

                    if (acknowledgedWarnings.has(warningId)) return false;

                    if (requiredRoleIds.length === 0) return false; // No specific roles required

                    return !person.roleIds.some(rid => requiredRoleIds.includes(rid));
                })
                .map(pid => {
                    const person = people.find(p => p.id === pid)!;
                    return {
                        warningId: `${shift.id}-${pid}`,
                        shiftId: shift.id,
                        personId: pid,
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
    }, [shifts, taskTemplates, people, roles, acknowledgedWarnings, isViewer]);

    const handleAcknowledgeWarning = async (warningId: string) => {
        setAcknowledgedWarnings(prev => new Set([...prev, warningId]));

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

    const visibleTasks = useMemo(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        const dayOfWeek = selectedDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

        return taskTemplates.filter(task => {
            if (!task.segments || task.segments.length === 0) return false;

            return task.segments.some(segment => {
                if (segment.frequency === 'daily') return true;
                if (segment.frequency === 'weekly') {
                    return segment.daysOfWeek?.includes(dayOfWeek);
                }
                if (segment.frequency === 'specific_date') {
                    return segment.specificDate === dateKey;
                }
                return false;
            });
        });
    }, [taskTemplates, selectedDate]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const maxViewerDate = new Date(today);
    maxViewerDate.setDate(today.getDate() + (viewerDaysLimit - 1));

    const isAtViewerLimit = selectedDate >= maxViewerDate;

    const canGoNext = !isViewer || !isAtViewerLimit;
    const canGoPrev = true;

    const handleJumpToShift = (shiftId: string, shiftStart: Date) => {
        const shiftDate = new Date(shiftStart);
        shiftDate.setHours(0, 0, 0, 0);
        onDateChange(shiftDate);

        setTimeout(() => {
            const shiftElement = document.getElementById(`shift-card-${shiftId}`);
            if (shiftElement) {
                shiftElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                shiftElement.classList.add('ring-4', 'ring-red-500', 'ring-offset-2');
                setTimeout(() => {
                    shiftElement.classList.remove('ring-4', 'ring-red-500', 'ring-offset-2');
                }, 2000);
            }
        }, 300);
    };

    const handleDateChange = (newDate: Date) => {
        onDateChange(newDate);
        analytics.trackDateChanged(newDate.toISOString());
    };

    const handleShiftSelect = (shift: Shift) => {
        const task = taskTemplates.find(t => t.id === shift.taskId);
        if (task) {
            analytics.trackModalOpen(`shift_management:${task.name}`);
        }
        setSelectedShiftId(shift.id);
    };

    const handleExportClick = async () => {
        analytics.trackButtonClick('export_schedule', 'schedule_board');
        await handleExportToClipboard();
    };

    const handleClearDayClick = () => {
        analytics.trackButtonClick('clear_day', 'schedule_board');
        confirm({
            title: 'ניקוי יום',
            message: 'האם אתה בטוח שברצונך למחוק את כל המשמרות של היום? פעולה זו אינה הפיכה.',
            confirmText: 'נקה יום',
            type: 'danger',
            onConfirm: () => {
                onClearDay();
                showToast('היום נוקה בהצלחה', 'success');
            }
        });
    };

    useEffect(() => {
        const dateKey = selectedDate.toLocaleDateString('en-CA');
        analytics.trackFilterApplied('date', dateKey);
    }, [selectedDate]);

    return (
        <div className="flex flex-col gap-2 h-full">
            {isViewer && renderFeaturedCard()}
            {selectedShift && <Modal />}


            <ConfirmationModal {...modalProps} />

            {/* Global Mismatch Warnings Panel */}
            {!isViewer && !isLoadingWarnings && mismatchWarnings.length > 0 && (
                <div className="rounded-xl border-2 border-red-500 bg-red-50 p-2 space-y-2 animate-fadeIn flex-shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">

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

                    <ul className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
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
            )
            }

            {/* Time Grid Board Container */}
            <div className="bg-white rounded-xl shadow-portal p-2 flex flex-col flex-1 min-h-0">
                {/* Controls Header - Sticky */}
                <div className="flex flex-col gap-2 mb-2 flex-shrink-0 sticky top-0 z-50 bg-white pb-2 border-b border-transparent">
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

                    <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 md:gap-3">
                        <div className="flex gap-2 order-2 sm:order-1">
                            <button onClick={handleExportClick} className="flex items-center justify-center gap-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors">
                                <Copy size={14} />
                                <span className="hidden sm:inline">העתק ללוח</span>
                                <span className="sm:hidden">העתק</span>
                            </button>
                            {!isViewer && (
                                <button onClick={handleClearDayClick} className="flex items-center justify-center gap-1.5 text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 md:py-2 rounded-full font-bold text-xs md:text-sm transition-colors">
                                    <Trash2 size={14} />
                                    <span className="hidden sm:inline">נקה יום</span>
                                    <span className="sm:hidden">נקה</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-center bg-slate-100 rounded-full p-0.5 md:p-1 order-1 sm:order-2">
                            <button onClick={() => { if (canGoNext) { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); handleDateChange(d); } }} disabled={!canGoNext} className={`p-1.5 md:p-2 rounded-full transition-all ${canGoNext ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}>
                                <ChevronRight size={16} />
                            </button>

                            <div
                                className="relative group cursor-pointer px-2 md:px-4 min-w-[120px] md:min-w-[140px] text-center"
                                onClick={() => {
                                    if (dateInputRef.current) {
                                        if ('showPicker' in dateInputRef.current) {
                                            (dateInputRef.current as any).showPicker();
                                        } else {
                                            dateInputRef.current.focus();
                                            dateInputRef.current.click();
                                        }
                                    }
                                }}
                            >
                                <span className="text-xs md:text-sm font-bold text-slate-600 group-hover:text-blue-600 transition-colors flex items-center justify-center gap-1">
                                    {selectedDate.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' })}
                                    <CalendarIcon size={12} className="opacity-50 group-hover:opacity-100 transition-opacity" />
                                </span>
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={selectedDate.toLocaleDateString('en-CA')}
                                    onChange={(e) => {
                                        if (e.target.valueAsDate) handleDateChange(e.target.valueAsDate);
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    lang="he"
                                    title="בחר תאריך"
                                />
                            </div>

                            <button onClick={() => { if (canGoPrev) { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); handleDateChange(d); } }} disabled={!canGoPrev} className={`p-1.5 md:p-2 rounded-full transition-all ${canGoPrev ? 'hover:bg-white' : 'opacity-50 cursor-not-allowed'}`}>
                                <ChevronLeft size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scrollable Grid Area */}
                <div className="flex-1 overflow-y-auto relative border-t border-slate-200">

                    {/* ************************************************* */}
                    {/* GRID CONTAINER - הפריסה הדו-ממדית. אין גלילה כאן! */}
                    {/* ************************************************* */}
                    <div
                        className="grid relative"
                        // Grid: עמודה 1 (ציר שעות) רוחב קבוע. עמודה 2 תופסת את השאר.
                        style={{ gridTemplateColumns: 'min-content 1fr' }}
                    >

                        {/* ======================================================== */}
                        {/* CELL 1,1: CORNER (הפינה הקבועה) - Sticky Right/Top */}
                        {/* ======================================================== */}
                        <div
                            className="sticky right-0 top-0 z-40 bg-slate-50 border-b border-l border-slate-200"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            <div className="w-10 md:w-16 h-full flex items-center justify-center">
                                <span className="text-[10px] text-slate-500 font-bold">זמנים</span>
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 1,2: TOP ROW (כותרות המשימות) - Sticky רק ב-TOP */}
                        {/* זה חייב להכיל את הגלילה האופקית כדי להיות מסונכרן עם CELL 2,2 */}
                        {/* ======================================================== */}
                        <div
                            // הכותרת נדבקת למעלה, ומאלצת את התוכן הפנימי לגלול אופקית.
                            ref={headerScrollRef}
                            className="sticky top-0 z-30 bg-white shadow-sm border-b border-slate-200 overflow-x-auto"
                            style={{ height: HEADER_HEIGHT }}
                        >
                            {/* Task Headers: הרוחב המינימלי יוצר את הגלילה ב-overflow-x-auto של ההורה */}
                            <div className="flex relative" style={{ minWidth: 'max-content' }}>
                                {visibleTasks.map(task => (
                                    <div
                                        key={task.id}
                                        className="w-[130px] md:w-[260px] flex-shrink-0 border-l border-b-2"
                                        style={{
                                            height: HEADER_HEIGHT,
                                            backgroundColor: hexToRgba(task.color, 0.4), // Increased visibility
                                            borderTopColor: task.color,
                                            borderTopWidth: 3,
                                            borderColor: 'rgb(241 245 249)', // slate-200 for side borders
                                            borderBottomColor: task.color
                                        }}
                                    >
                                        <h4 className="font-bold text-slate-800 text-xs md:text-sm truncate w-full px-2 pt-2 text-center">{task.name}</h4>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 2,1: SIDE AXIS (ציר השעות האנכי) - Sticky רק ב-RIGHT */}
                        {/* ======================================================== */}
                        <div className="sticky right-0 z-20 bg-slate-50 border-l border-slate-100">
                            {Array.from({ length: 25 }).map((_, i) => (
                                <div key={i} className="h-[60px] border-t border-dashed border-slate-300 text-[9px] md:text-xs text-slate-400 font-bold flex justify-center pt-1 relative">
                                    <span className="bg-slate-50 px-0.5 md:px-1">{i.toString().padStart(2, '0')}:00</span>
                                </div>
                            ))}
                        </div>

                        {/* ======================================================== */}
                        {/* CELL 2,2: MAIN CONTENT (גוף המשימות) - גלילה אופקית פנימית */}
                        {/* ======================================================== */}
                        <div
                            ref={bodyScrollRef}
                            className="relative overflow-x-auto"
                        >
                            {/* ה-min-w-max כאן חשוב כדי שכל המשמרות יכנסו */}
                            <div className="flex relative min-w-max">

                                {visibleTasks.map(task => {
                                    const dateKey = selectedDate.toLocaleDateString('en-CA');
                                    const taskShifts = shifts.filter(s => {
                                        if (s.taskId !== task.id) return false;
                                        const shiftStart = new Date(s.startTime);
                                        const shiftEnd = new Date(s.endTime);

                                        const dayStart = new Date(selectedDate);
                                        dayStart.setHours(0, 0, 0, 0);
                                        const dayEnd = new Date(selectedDate);
                                        dayEnd.setHours(24, 0, 0, 0);

                                        return shiftStart < dayEnd && shiftEnd > dayStart;
                                    });

                                    return (
                                        <div
                                            key={task.id}
                                            className="w-[130px] md:w-[260px] flex-shrink-0 border-l border-slate-100 relative h-[1540px]"
                                            style={{ backgroundColor: hexToRgba(task.color, 0.2) }} // Increased visibility
                                        >
                                            {/* Grid Lines */}
                                            <div className="absolute inset-0 pointer-events-none">
                                                {Array.from({ length: 25 }).map((_, i) => (
                                                    <div key={i} className="h-[60px] border-t border-dashed border-slate-300/50"></div>
                                                ))}
                                            </div>

                                            {/* Shifts */}
                                            {taskShifts.map(shift => {
                                                const shiftStart = new Date(shift.startTime);
                                                const shiftEnd = new Date(shift.endTime);
                                                const dayStart = new Date(selectedDate);
                                                dayStart.setHours(0, 0, 0, 0);
                                                const dayEnd = new Date(selectedDate);
                                                dayEnd.setHours(24, 0, 0, 0);

                                                const effectiveStart = shiftStart < dayStart ? dayStart : shiftStart;
                                                const effectiveEnd = shiftEnd > dayEnd ? dayEnd : shiftEnd;

                                                const top = getPositionFromTime(effectiveStart);
                                                const height = getHeightFromDuration(effectiveStart, effectiveEnd);
                                                const isContinuedFromPrev = shiftStart < dayStart;
                                                const isContinuedToNext = shiftEnd > dayEnd;

                                                return (
                                                    <ShiftCard
                                                        key={shift.id}
                                                        shift={shift}
                                                        taskTemplates={taskTemplates}
                                                        people={people}
                                                        roles={roles}
                                                        onSelect={handleShiftSelect}
                                                        onToggleCancel={onToggleCancelShift}
                                                        isViewer={isViewer}
                                                        acknowledgedWarnings={acknowledgedWarnings}
                                                        style={{
                                                            top: `${top}px`,
                                                            height: `${Math.max(height, 30)}px`,
                                                            left: '2px',
                                                            right: '2px',
                                                            width: 'auto',
                                                            borderTopLeftRadius: isContinuedFromPrev ? 0 : undefined,
                                                            borderTopRightRadius: isContinuedFromPrev ? 0 : undefined,
                                                            borderBottomLeftRadius: isContinuedToNext ? 0 : undefined,
                                                            borderBottomRightRadius: isContinuedToNext ? 0 : undefined,
                                                            borderTop: isContinuedFromPrev ? '2px dashed rgba(0,0,0,0.1)' : undefined,
                                                            borderBottom: isContinuedToNext ? '2px dashed rgba(0,0,0,0.1)' : undefined,
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Global Time Line */}
                        {/* ... (השאר את קוד קו הזמן כפי שהוא ב-Grid) ... */}
                        {(() => {
                            const currentDayKey = now.toLocaleDateString('en-CA');
                            const selectedDayKey = selectedDate.toLocaleDateString('en-CA');
                            if (currentDayKey === selectedDayKey) {
                                const top = getPositionFromTime(now) + HEADER_HEIGHT;
                                return (
                                    <div
                                        className="absolute z-[60] flex items-center pointer-events-none"
                                        style={{
                                            top: `${top}px`,
                                            gridColumn: '1 / span 2', // מכסה את שתי עמודות ה-Grid
                                            left: 0,
                                            right: 0
                                        }}
                                    >
                                        <div className="w-full h-[2px] bg-red-500 shadow-sm"></div>
                                        <div className="absolute right-0 translate-x-1/2 w-3 h-3 bg-red-600 rounded-full shadow-md"></div>
                                        <div className="absolute left-10 -translate-y-[120%] bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                                            {now.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                    </div>

                    {visibleTasks.length === 0 && (
                        <div className="absolute inset-0 col-span-full flex items-center justify-center text-slate-400 p-10">
                            אין משימות להצגה
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};
