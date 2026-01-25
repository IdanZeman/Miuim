import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, Trash, CalendarBlank as CalendarIcon, House, Buildings, Clock, Info, Check, Warning as AlertTriangle, ClockCounterClockwise } from '@phosphor-icons/react';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { logger } from '@/services/loggingService';
import { AvailabilitySlot, HomeStatusType } from '@/types';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { HomeStatusSelector } from '@/components/ui/HomeStatusSelector';
import { useToast } from '@/contexts/ToastContext';
import { Switch } from '@/components/ui/Switch'; // Assuming we have a Switch component, or use a checkbox
import { formatIsraelDate } from '@/utils/dateUtils';

interface StatusEditModalProps {
    isOpen: boolean;
    date?: string;
    dates?: string[]; // NEW: Support for multiple dates
    personId?: string; // NEW: Robust lookup
    personName?: string;
    currentAvailability?: AvailabilitySlot;
    onClose: () => void;
    onApply: (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: HomeStatusType, rangeDates?: string[]) => void;
    onViewHistory?: (personId: string, date: string) => void;
    defaultArrivalHour?: string;
    defaultDepartureHour?: string;
    disableJournal?: boolean;
}

export const StatusEditModal: React.FC<StatusEditModalProps> = ({
    isOpen, date, dates, personId, personName, currentAvailability, onClose, onApply,
    onViewHistory,
    defaultArrivalHour = '10:00',
    defaultDepartureHour = '14:00',
    disableJournal = false
}) => {
    // Determine effective date label
    const effectiveStartDate = (dates && dates.length > 0 ? dates[0] : date) || formatIsraelDate(new Date());
    const dateLabel = dates && dates.length > 1
        ? `${dates.length} ימים נבחרים`
        : (effectiveStartDate);

    // Main Status State
    const [mainStatus, setMainStatus] = useState<'base' | 'home'>('base');
    const [customStart, setCustomStart] = useState(defaultArrivalHour);
    const [customEnd, setCustomEnd] = useState(defaultDepartureHour);
    const [homeStatusType, setHomeStatusType] = useState<HomeStatusType>('leave_shamp'); // Default to leave_shamp

    // Range Mode State
    const [isRangeMode, setIsRangeMode] = useState(false);
    const [untilDate, setUntilDate] = useState<Date | null>(null);

    // Blocks State
    const [unavailableBlocks, setUnavailableBlocks] = useState<{ id: string, start: string, end: string, reason?: string, type?: string }[]>([]);

    // UI State
    const [customType, setCustomType] = useState<null | 'arrival' | 'departure' | 'custom'>(null);
    const [isAddingBlock, setIsAddingBlock] = useState(false);
    const [newBlockStart, setNewBlockStart] = useState('10:00');
    const [newBlockEnd, setNewBlockEnd] = useState('11:00');
    const [newBlockReason, setNewBlockReason] = useState('');
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);
    const { showToast } = useToast();

    // Sync from props
    useEffect(() => {
        setIsRangeMode(false);
        setUntilDate(null);

        if (currentAvailability) {
            // Status
            if (currentAvailability.status === 'home' || !currentAvailability.isAvailable) {
                setMainStatus('home');
            } else {
                setMainStatus('base');
            }

            // Home Status Type
            if (currentAvailability.homeStatusType) {
                setHomeStatusType(currentAvailability.homeStatusType);
            } else {
                setHomeStatusType('leave_shamp'); // Default
            }

            // Times & Type
            const s = currentAvailability.startHour || '00:00';
            const e = currentAvailability.endHour || '23:59';

            if (s !== '00:00' && (e === '23:59' || e === '00:00')) {
                setCustomType('arrival');
                setCustomStart(s);
            } else if (s === '00:00' && e !== '23:59' && e !== '00:00') {
                setCustomType('departure');
                setCustomEnd(e);
            } else if (s !== '00:00' && e !== '23:59' && e !== '00:00') {
                setCustomType('custom');
                setCustomStart(s);
                setCustomEnd(e);
            } else {
                setCustomType(null); // Full day (00:00 - 23:59)
                setCustomStart(defaultArrivalHour);
                setCustomEnd(defaultDepartureHour);
            }

            // Blocks
            if (currentAvailability.unavailableBlocks) {
                setUnavailableBlocks(currentAvailability.unavailableBlocks);
            } else {
                setUnavailableBlocks([]);
            }
        } else {
            // Default new
            setMainStatus('base');
            setUnavailableBlocks([]);
            setCustomType(null);
            setHomeStatusType('leave_shamp'); // Default
        }
    }, [currentAvailability, isOpen, defaultArrivalHour, defaultDepartureHour]);

    const handleApply = () => {
        let finalStart = '00:00';
        let finalEnd = '23:59';

        if (mainStatus === 'base') {
            if (customType === 'arrival') {
                finalStart = customStart;
            } else if (customType === 'departure') {
                finalEnd = customEnd;
            } else if (customType === 'custom') {
                finalStart = customStart;
                finalEnd = customEnd;
            }
        }

        // Helper to format status for logging
        const formatStatusForLog = (status: string, s: string, e: string, hType?: string) => {
            const homeStatusLabels: Record<string, string> = {
                'leave_shamp': "חופשה בשמפ",
                'gimel': "ג'",
                'absent': "נפקד",
                'organization_days': "ימי התארגנות",
                'not_in_shamp': "לא בשמ\"פ"
            };

            if (status === 'home') return `בית (${hType && homeStatusLabels[hType] ? homeStatusLabels[hType] : 'חופשה'})`;
            if (s === '00:00' && e === '23:59') return 'בסיס (יום שלם)';
            return `בסיס (${s} - ${e})`;
        };

        const oldStatus = currentAvailability
            ? formatStatusForLog(
                currentAvailability.status === 'home' || !currentAvailability.isAvailable ? 'home' : 'base',
                currentAvailability.startHour || '00:00',
                currentAvailability.endHour || '23:59',
                currentAvailability.homeStatusType
            )
            : 'לא ידוע';

        const newStatus = formatStatusForLog(mainStatus, finalStart, finalEnd, mainStatus === 'home' ? homeStatusType : undefined);

        // Log the change
        const isCheckIn = mainStatus === 'base' && customType === null;
        logger.log({
            level: 'INFO',
            action: isCheckIn ? 'CHECK_IN' : 'UPDATE',
            actionDescription: `${personName}: Updated status to ${mainStatus}${customType ? ` (${customType})` : ''}${mainStatus === 'home' ? ` - ${homeStatusType}` : ''} for ${dateLabel}`,
            entityType: 'attendance',
            entityName: personName,
            entityId: personId || personName, // Use ID if available
            category: 'scheduling',
            before_data: oldStatus,
            after_data: newStatus,
            metadata: {
                personId, // NEW
                personName,
                date: effectiveStartDate, // Always YYYY-MM-DD
                status: mainStatus,
                type: customType,
                homeStatusType: mainStatus === 'home' ? homeStatusType : undefined,
                start: finalStart,
                end: finalEnd,
                blocksCount: unavailableBlocks.length
            }
        });

        if (mainStatus === 'base' && customType === 'custom') {
            if (customStart >= customEnd) {
                showToast('שעת ההתחלה חייבת להיות לפני שעת הסיום', 'error');
                return;
            }
        }

        let calculatedRangeDates: string[] | undefined = undefined;
        if (isRangeMode && untilDate) {
            const start = new Date(effectiveStartDate);
            const end = new Date(untilDate);

            if (end < start) {
                showToast('תאריך הסיום חייב להיות מאוחר מתאריך ההתחלה', 'error');
                return;
            }

            calculatedRangeDates = [];
            const current = new Date(start);
            while (current <= end) {
                calculatedRangeDates.push(current.toLocaleDateString('en-CA'));
                current.setDate(current.getDate() + 1);
            }
        }

        onApply(mainStatus, { start: finalStart, end: finalEnd }, unavailableBlocks, mainStatus === 'home' ? homeStatusType : undefined, calculatedRangeDates);
    };

    const addOrUpdateBlock = () => {
        if (newBlockStart >= newBlockEnd) {
            setValidationError('שעת ההתחלה חייבת להיות לפני שעת הסיום');
            showToast('שעת ההתחלה חייבת להיות לפני שעת הסיום', 'error');
            return;
        }
        setValidationError(null);

        if (editingBlockId) {
            setUnavailableBlocks(prev => prev.map(b => b.id === editingBlockId ? {
                ...b,
                start: newBlockStart,
                end: newBlockEnd,
                reason: newBlockReason
            } : b));
            setEditingBlockId(null);
        } else {
            const newBlock = {
                id: crypto.randomUUID(),
                start: newBlockStart,
                end: newBlockEnd,
                reason: newBlockReason
            };
            setUnavailableBlocks([...unavailableBlocks, newBlock]);
        }

        setIsAddingBlock(false);
        setNewBlockReason('');
    };

    const handleEditBlock = (block: { id: string, start: string, end: string, reason?: string }) => {
        setNewBlockStart(block.start);
        setNewBlockEnd(block.end);
        setNewBlockReason(block.reason || '');
        setEditingBlockId(block.id);
        setIsAddingBlock(true);
    };

    const removeBlock = (id: string) => {
        setUnavailableBlocks(unavailableBlocks.filter(b => b.id !== id));
        if (editingBlockId === id) {
            setEditingBlockId(null);
            setIsAddingBlock(false);
        }
    };

    const renderTimeline = () => {
        return (
            <div className="flex flex-col gap-3 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={14} weight="bold" />
                        יומן יומי וחסימות
                    </span>
                    {!isAddingBlock && (
                        <button
                            onClick={() => {
                                setIsAddingBlock(true);
                                setEditingBlockId(null);
                                setNewBlockStart('10:00');
                                setNewBlockEnd('11:00');
                                setNewBlockReason('');
                                setValidationError(null);
                            }}
                            className="text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 px-3 py-1.5 rounded-full font-bold transition-colors flex items-center gap-1.5"
                        >
                            <Plus size={12} weight="bold" /> הוסף חסימה
                        </button>
                    )}
                </div>

                {isAddingBlock && (
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm animate-in zoom-in-95 duration-200 relative overflow-hidden ring-1 ring-slate-100">
                        <h4 className="text-xs font-bold text-slate-800 mb-3 block">
                            {editingBlockId ? 'עריכת חסימה' : 'חסימה חדשה'}
                        </h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                            <TimePicker label="התחלה" value={newBlockStart} onChange={setNewBlockStart} />
                            <TimePicker label="סיום" value={newBlockEnd} onChange={setNewBlockEnd} />
                        </div>
                        <Input
                            placeholder="סיבת חסימה (אופציונלי)"
                            value={newBlockReason}
                            onChange={e => setNewBlockReason(e.target.value)}
                            className={`text-xs font-medium mb-3 h-10 ${validationError ? 'border-rose-300 ring-rose-50' : 'border-slate-200'}`}
                        />

                        {validationError && (
                            <div className="flex items-center gap-1.5 mb-3 px-1 animate-in slide-in-from-right-2">
                                <AlertTriangle size={14} className="text-rose-500" weight="fill" />
                                <span className="text-[11px] font-bold text-rose-600">{validationError}</span>
                            </div>
                        )}
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setIsAddingBlock(false); setEditingBlockId(null); }}
                                className="text-slate-500"
                            >
                                ביטול
                            </Button>
                            <Button
                                size="sm"
                                onClick={addOrUpdateBlock}
                                className="bg-slate-900 text-white"
                            >
                                {editingBlockId ? 'עדכן' : 'הוסף'}
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                    {unavailableBlocks.filter(b => b.type !== 'absence').length === 0 && !isAddingBlock && (
                        <div className="text-center py-6 text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            <span className="text-xs font-medium block">הלו"ז פנוי להיום</span>
                        </div>
                    )}
                    {unavailableBlocks.filter(b => b.type !== 'absence').sort((a, b) => a.start.localeCompare(b.start)).map(block => (
                        <div
                            key={block.id}
                            onClick={() => handleEditBlock(block)}
                            className={`flex items-center justify-between p-3 pl-2 rounded-xl border cursor-pointer hover:shadow-sm transition-all ${editingBlockId === block.id
                                ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-100'
                                : 'bg-white border-slate-100 hover:border-slate-200'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${editingBlockId === block.id ? 'bg-blue-100 text-blue-600' : 'bg-rose-50 text-rose-500'}`}>
                                    <Clock size={16} weight="bold" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-slate-800 tracking-tight">{block.start} - {block.end}</span>
                                    {block.reason && <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{block.reason}</span>}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                            >
                                <Trash size={16} weight="bold" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // Use GenericModal Title prop for standard look
    const modalTitle = (
        <div className="flex flex-col">
            <span className="text-xl font-bold text-slate-800">ערוך סטטוס יומי</span>
            <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{personName}</span>
                <span className="text-[10px] text-slate-300">•</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{dateLabel}</span>
            </div>
        </div>
    );

    const headerActions = onViewHistory && personId && effectiveStartDate && (
        <button
            onClick={() => {
                onViewHistory(personId, effectiveStartDate);
                onClose();
            }}
            className="p-2 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-xl border border-slate-200 hover:border-blue-200 transition-all group flex items-center gap-1.5"
            title="צפה בהיסטוריית שינויים"
        >
            <ClockCounterClockwise size={18} weight="bold" />
            <span className="text-[10px] font-black uppercase tracking-wider hidden xs:inline">היסטוריה</span>
        </button>
    );

    const modalFooter = (
        <div className="flex items-center justify-between w-full gap-3">
            <Button
                variant="ghost"
                onClick={onClose}
                className="text-slate-500 hover:text-slate-700 font-bold"
            >
                ביטול
            </Button>
            <Button
                onClick={handleApply}
                className="bg-idf-yellow hover:bg-idf-yellow-hover text-slate-900 shadow-sm px-8 rounded-xl font-black"
                icon={Check}
            >
                שמור שינויים
            </Button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            headerActions={headerActions || undefined}
            size="sm"
            footer={modalFooter}
        >
            <div className="flex flex-col gap-6">
                {/* 0. Range Selection Toggle */}
                <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={18} className="text-indigo-600" weight="duotone" />
                            <span className="text-sm font-bold text-slate-700">החל על טווח תאריכים</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={isRangeMode}
                                onChange={(e) => setIsRangeMode(e.target.checked)}
                            />
                            <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                    </div>

                    {isRangeMode && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200 pt-2 border-t border-slate-100">
                            <DatePicker
                                label="עד תאריך (כולל)"
                                value={untilDate ? untilDate.toISOString().split('T')[0] : ''}
                                onChange={(val) => setUntilDate(val ? new Date(val) : null)}
                                className="w-full"
                            />
                            <span className="text-[10px] text-slate-400 px-1">השינוי יחול מהתאריך הנבחר ועד לתאריך הסיום</span>
                        </div>
                    )}
                </div>

                {/* 1. Segmented Control - Premium Design with smooth transitions */}
                <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-2xl flex relative shadow-inner">
                    <button
                        onClick={() => setMainStatus('base')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all duration-200 ease-out ${mainStatus === 'base'
                            ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5 transform scale-[1.02]'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <Buildings size={18} weight="bold" className="transition-all duration-200" />
                        בבסיס
                    </button>
                    <button
                        onClick={() => setMainStatus('home')}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all duration-200 ease-out ${mainStatus === 'home'
                            ? 'bg-white text-slate-600 shadow-sm ring-1 ring-black/5 transform scale-[1.02]'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        <House size={18} weight="bold" className="transition-all duration-200" />
                        בבית
                    </button>
                </div>

                {/* 2. Home Status Type Selector (if Home) */}
                {mainStatus === 'home' && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
                        <HomeStatusSelector
                            value={homeStatusType}
                            onChange={setHomeStatusType}
                            required={true}
                        />
                    </div>
                )}

                {/* 3. Time Cards (if Base) - Premium Design */}
                {mainStatus === 'base' && (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
                        {/* 2. Day Type Selection (if Base) */}
                        {mainStatus === 'base' && (
                            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
                                {/* Day Type Buttons - Subtle chips with smooth transitions */}
                                <div className="flex flex-wrap gap-2 justify-center">
                                    <button
                                        onClick={() => setCustomType(null)}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-150 ease-out ${customType === null
                                            ? 'bg-green-100 text-green-700 ring-1 ring-green-200'
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        יום שלם
                                    </button>
                                    <button
                                        onClick={() => setCustomType('arrival')}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-150 ease-out ${customType === 'arrival'
                                            ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        הגעה
                                    </button>
                                    <button
                                        onClick={() => setCustomType('departure')}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-150 ease-out ${customType === 'departure'
                                            ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        יציאה
                                    </button>
                                    <button
                                        onClick={() => setCustomType('custom')}
                                        className={`px-4 py-2 rounded-full text-sm font-bold transition-all duration-150 ease-out ${customType === 'custom'
                                            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-200'
                                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        יום בודד
                                    </button>
                                </div>

                                {/* Time Picker(s) - Show only for relevant types */}
                                {customType === 'arrival' && (
                                    <div className="flex items-center gap-3 bg-emerald-50 p-4 rounded-xl border border-emerald-100 animate-in fade-in duration-200">
                                        <span className="text-sm font-bold text-emerald-700">מגיע בשעה:</span>
                                        <TimePicker
                                            label=""
                                            value={customStart}
                                            onChange={setCustomStart}
                                            className="text-center text-lg font-black max-w-[100px] bg-white"
                                        />
                                    </div>
                                )}

                                {customType === 'departure' && (
                                    <div className="flex items-center gap-3 bg-amber-50 p-4 rounded-xl border border-amber-100 animate-in fade-in duration-200">
                                        <span className="text-sm font-bold text-amber-700">יוצא בשעה:</span>
                                        <TimePicker
                                            label=""
                                            value={customEnd}
                                            onChange={setCustomEnd}
                                            className="text-center text-lg font-black max-w-[100px] bg-white"
                                        />
                                    </div>
                                )}

                                {customType === 'custom' && (
                                    <div className="grid grid-cols-2 gap-3 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-in fade-in duration-200">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-blue-700">מגיע בשעה:</span>
                                            <TimePicker
                                                label=""
                                                value={customStart}
                                                onChange={setCustomStart}
                                                className="text-center font-black bg-white"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <span className="text-xs font-bold text-blue-700">יוצא בשעה:</span>
                                            <TimePicker
                                                label=""
                                                value={customEnd}
                                                onChange={setCustomEnd}
                                                className="text-center font-black bg-white"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="h-px bg-slate-100 mx-4" />

                        {/* 3. Daily Agenda / Blocks */}
                        {mainStatus === 'base' && !disableJournal && renderTimeline()}
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
