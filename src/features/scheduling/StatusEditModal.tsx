import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, Trash, CalendarBlank as CalendarIcon, House, Buildings, Clock, Info, Check } from '@phosphor-icons/react';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { logger } from '@/services/loggingService';
import { AvailabilitySlot, HomeStatusType } from '@/types';
import { TimePicker } from '@/components/ui/DatePicker';
import { Input } from '@/components/ui/Input';
import { HomeStatusSelector } from '@/components/ui/HomeStatusSelector';

interface StatusEditModalProps {
    isOpen: boolean;
    date?: string;
    personName?: string;
    currentAvailability?: AvailabilitySlot;
    onClose: () => void;
    onApply: (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[], homeStatusType?: HomeStatusType) => void;
    defaultArrivalHour?: string;
    defaultDepartureHour?: string;
    disableJournal?: boolean;
}

export const StatusEditModal: React.FC<StatusEditModalProps> = ({
    isOpen, date, personName, currentAvailability, onClose, onApply,
    defaultArrivalHour = '10:00',
    defaultDepartureHour = '14:00',
    disableJournal = false
}) => {
    // Main Status State
    const [mainStatus, setMainStatus] = useState<'base' | 'home'>('base');
    const [customStart, setCustomStart] = useState(defaultArrivalHour);
    const [customEnd, setCustomEnd] = useState(defaultDepartureHour);
    const [homeStatusType, setHomeStatusType] = useState<HomeStatusType>('leave_shamp'); // Default to leave_shamp

    // Blocks State
    const [unavailableBlocks, setUnavailableBlocks] = useState<{ id: string, start: string, end: string, reason?: string, type?: string }[]>([]);

    // UI State
    const [customType, setCustomType] = useState<null | 'arrival' | 'departure' | 'custom'>(null);
    const [isAddingBlock, setIsAddingBlock] = useState(false);
    const [newBlockStart, setNewBlockStart] = useState('10:00');
    const [newBlockEnd, setNewBlockEnd] = useState('11:00');
    const [newBlockReason, setNewBlockReason] = useState('');
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

    // Sync from props
    useEffect(() => {
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
            } else if ((s === '00:00') && e !== '23:59' && e !== '00:00') {
                setCustomType('departure');
                setCustomEnd(e);
            } else {
                setCustomType(null); // Simple logic
                setCustomStart(s === '00:00' ? defaultArrivalHour : s);
                setCustomEnd(e === '23:59' ? defaultDepartureHour : e);
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

        // Log the change
        const isCheckIn = mainStatus === 'base' && customType === null;
        logger.info(isCheckIn ? 'CHECK_IN' : 'UPDATE',
            `${personName}: Updated status to ${mainStatus}${customType ? ` (${customType})` : ''}${mainStatus === 'home' ? ` - ${homeStatusType}` : ''} for ${date}`,
            {
                personName,
                date,
                status: mainStatus,
                type: customType,
                homeStatusType: mainStatus === 'home' ? homeStatusType : undefined,
                start: finalStart,
                end: finalEnd,
                blocksCount: unavailableBlocks.length,
                category: 'attendance'
            }
        );

        onApply(mainStatus, { start: finalStart, end: finalEnd }, unavailableBlocks, mainStatus === 'home' ? homeStatusType : undefined);
    };

    const addOrUpdateBlock = () => {
        if (newBlockStart >= newBlockEnd) return; // Simple validation

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
                        <Info size={14} weight="duotone" />
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
                            className="text-xs font-medium mb-3 h-10 border-slate-200"
                        />
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
                                    <Clock size={16} weight="duotone" />
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
                                <Trash size={16} weight="duotone" />
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
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{date}</span>
            </div>
        </div>
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
            size="sm"
            footer={modalFooter}
        >
            <div className="flex flex-col gap-6">
                {!customType ? (
                    <>
                        {/* 1. Segmented Control - Premium Design */}
                        <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-2xl flex relative shadow-inner">
                            <button
                                onClick={() => setMainStatus('base')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all duration-300 ${mainStatus === 'base'
                                    ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5 transform scale-[1.02]'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <Buildings size={18} weight={mainStatus === 'base' ? 'duotone' : 'bold'} />
                                בבסיס
                            </button>
                            <button
                                onClick={() => setMainStatus('home')}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black transition-all duration-300 ${mainStatus === 'home'
                                    ? 'bg-white text-slate-600 shadow-sm ring-1 ring-black/5 transform scale-[1.02]'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                <House size={18} weight={mainStatus === 'home' ? 'duotone' : 'bold'} />
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
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-500 delay-75">
                                <button
                                    onClick={() => setCustomType('arrival')}
                                    className="relative flex flex-col items-center justify-center p-5 border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/50 rounded-[1.5rem] transition-all group active:scale-[0.98] overflow-hidden"
                                >
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-50" />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 group-hover:text-slate-600 transition-colors">שעת הגעה</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                                        {customType === 'arrival' ? customStart : (currentAvailability?.startHour && currentAvailability.startHour !== '00:00' ? currentAvailability?.startHour : '00:00')}
                                    </span>
                                </button>
                                <button
                                    onClick={() => setCustomType('departure')}
                                    className="relative flex flex-col items-center justify-center p-5 border border-slate-100 bg-white hover:border-slate-200 hover:shadow-lg hover:shadow-slate-200/50 rounded-[1.5rem] transition-all group active:scale-[0.98] overflow-hidden"
                                >
                                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-50" />
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2 group-hover:text-slate-600 transition-colors">שעת יציאה</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                                        {customType === 'departure' ? customEnd : (currentAvailability?.endHour && currentAvailability.endHour !== '23:59' ? currentAvailability?.endHour : '23:59')}
                                    </span>
                                </button>
                            </div>
                        )}

                        <div className="h-px bg-slate-100 mx-4" />

                        {/* 4. Daily Agenda / Blocks */}
                        {mainStatus === 'base' && !disableJournal && renderTimeline()}
                    </>
                ) : (
                    // Sub-views for time picking
                    <div className="flex flex-col gap-6 animate-in slide-in-from-right-8 duration-300">
                        <button onClick={() => setCustomType(null)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold self-start px-1 transition-colors">
                            <ArrowRight size={18} weight="bold" />
                            <span className="text-xs">חזרה לתפריט</span>
                        </button>

                        <div className="bg-slate-50/50 rounded-[2rem] p-8 border border-slate-100 text-center shadow-lg shadow-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">
                                {customType === 'arrival' ? 'הגדרת שעת הגעה' : 'הגדרת שעת יציאה'}
                            </span>

                            {customType === 'departure' && (
                                <TimePicker
                                    label=""
                                    value={customEnd}
                                    onChange={setCustomEnd}
                                    className="text-center text-2xl h-16 max-w-[240px] mx-auto font-black"
                                />
                            )}
                            {customType === 'arrival' && (
                                <TimePicker
                                    label=""
                                    value={customStart}
                                    onChange={setCustomStart}
                                    className="text-center text-2xl h-16 max-w-[240px] mx-auto font-black"
                                />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
