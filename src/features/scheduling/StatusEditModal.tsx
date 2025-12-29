import React, { useState, useEffect } from 'react';
import { Clock, ArrowRight, Plus, Trash2, Calendar as CalendarIcon, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { logger } from '@/services/loggingService';
import { AvailabilitySlot } from '@/types';

interface StatusEditModalProps {
    isOpen: boolean;
    date?: string;
    personName?: string;
    currentAvailability?: AvailabilitySlot;
    onClose: () => void;
    onApply: (status: 'base' | 'home', customTimes?: { start: string, end: string }, unavailableBlocks?: { id: string, start: string, end: string, reason?: string }[]) => void;
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
                setCustomType(null); // Simple logic, can expand if needed
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
        }
    }, [currentAvailability, isOpen, defaultArrivalHour, defaultDepartureHour]);

    // ... (rest of code) ...

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
            `${personName}: Updated status to ${mainStatus}${customType ? ` (${customType})` : ''} for ${date}`,
            {
                personName,
                date,
                status: mainStatus,
                type: customType,
                start: finalStart,
                end: finalEnd,
                blocksCount: unavailableBlocks.length,
                category: 'attendance'
            }
        );

        onApply(mainStatus, { start: finalStart, end: finalEnd }, unavailableBlocks);
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
        // Simple visual representation of the day
        // 06:00 to 22:00
        const hours = Array.from({ length: 17 }, (_, i) => i + 6);

        return (
            <div className="flex flex-col gap-2 mt-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">יומן יומי</span>
                    {!isAddingBlock && (
                        <button
                            onClick={() => {
                                setIsAddingBlock(true);
                                setEditingBlockId(null);
                                setNewBlockStart('10:00');
                                setNewBlockEnd('11:00');
                                setNewBlockReason('');
                            }}
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md font-bold transition-colors flex items-center gap-1"
                        >
                            <Plus size={12} /> הוסף חסימה
                        </button>
                    )}
                </div>

                {isAddingBlock && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-[10px] font-bold text-slate-400">התחלה</label>
                                <input type="time" value={newBlockStart} onChange={e => setNewBlockStart(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold w-full outline-none focus:border-blue-500" />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                                <label className="text-[10px] font-bold text-slate-400">סיום</label>
                                <input type="time" value={newBlockEnd} onChange={e => setNewBlockEnd(e.target.value)} className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold w-full outline-none focus:border-blue-500" />
                            </div>
                        </div>
                        <input
                            type="text"
                            placeholder="סיבה (אופציונלי)"
                            value={newBlockReason}
                            onChange={e => setNewBlockReason(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold outline-none focus:border-blue-500 mb-2"
                        />
                        <div className="flex gap-2">
                            <button onClick={() => { setIsAddingBlock(false); setEditingBlockId(null); }} className="flex-1 py-1 text-xs font-bold text-slate-400 hover:text-slate-600">ביטול</button>
                            <button onClick={addOrUpdateBlock} className="flex-1 py-1 bg-slate-800 text-white text-xs font-bold rounded hover:bg-slate-700">
                                {editingBlockId ? 'עדכן' : 'הוסף'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                    {unavailableBlocks.filter(b => b.type !== 'absence').length === 0 && !isAddingBlock && (
                        <div className="text-center py-4 text-xs text-slate-300 font-bold border border-dashed border-slate-100 rounded-lg">
                            אין חסימות להיום
                        </div>
                    )}
                    {unavailableBlocks.filter(b => b.type !== 'absence').sort((a, b) => a.start.localeCompare(b.start)).map(block => (
                        <div
                            key={block.id}
                            onClick={() => handleEditBlock(block)}
                            className={`flex items-center justify-between p-2 rounded-lg group border cursor-pointer hover:shadow-sm transition-all ${editingBlockId === block.id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-300' : 'bg-red-50 border-red-100 hover:bg-red-100'}`}
                        >
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${editingBlockId === block.id ? 'bg-blue-400' : 'bg-red-400'}`} />
                                <div className="flex flex-col">
                                    <span className="text-xs font-black text-slate-700">{block.start} - {block.end}</span>
                                    {block.reason && <span className="text-[10px] text-slate-400">{block.reason}</span>}
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                                className="text-red-300 hover:text-red-500 p-1 rounded-full hover:bg-white/50 transition-colors"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex flex-col">
                    <span className="text-base font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        ערוך סטטוס
                    </span>
                    <span className="text-xs text-slate-400 font-bold">{personName} • {date}</span>
                </div>
            }
            size="sm"
            closeIcon="close"
            footer={
                <div className="flex gap-3 w-full">
                    <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">ביטול</button>
                    <button
                        onClick={handleApply}
                        className="flex-1 py-3 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
                    >
                        שמור שינויים
                    </button>
                </div>
            }
        >
            <div className="flex flex-col gap-1 w-full">
                {!customType ? (
                    <>
                        {/* Status Toggles */}
                        <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                            <button
                                onClick={() => setMainStatus('base')}
                                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${mainStatus === 'base' ? 'bg-white text-green-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                בבסיס
                            </button>
                            <button
                                onClick={() => setMainStatus('home')}
                                className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${mainStatus === 'home' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                בבית
                            </button>
                        </div>

                        {mainStatus === 'base' && (
                            <div className="grid grid-cols-2 gap-2 mb-2">
                                <button onClick={() => setCustomType('arrival')} className="flex flex-col items-center justify-center p-3 border border-slate-100 hover:border-teal-200 bg-white hover:bg-teal-50 rounded-xl transition-all group">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 group-hover:text-teal-600">שעת הגעה</span>
                                    <span className="text-lg font-black text-slate-700 group-hover:text-teal-700">
                                        {customType === 'arrival' ? customStart : (currentAvailability?.startHour !== '00:00' ? currentAvailability?.startHour : '00:00')}
                                    </span>
                                </button>
                                <button onClick={() => setCustomType('departure')} className="flex flex-col items-center justify-center p-3 border border-slate-100 hover:border-amber-200 bg-white hover:bg-amber-50 rounded-xl transition-all group">
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 group-hover:text-amber-600">שעת יציאה</span>
                                    <span className="text-lg font-black text-slate-700 group-hover:text-amber-700">
                                        {customType === 'departure' ? customEnd : (currentAvailability?.endHour !== '23:59' ? currentAvailability?.endHour : '23:59')}
                                    </span>
                                </button>
                            </div>
                        )}

                        <div className="my-2 border-b border-slate-50" />

                        {/* Daily Agenda / Blocks - Only show if Base */}
                        {mainStatus === 'base' && !disableJournal && renderTimeline()}
                    </>
                ) : (
                    // Sub-views for time picking (Arrival/Departure)
                    <div className="flex flex-col gap-4">
                        <button onClick={() => setCustomType(null)} className="flex items-center gap-2 text-slate-400 hover:text-slate-600 font-bold self-start px-1">
                            <ArrowRight size={16} />
                            <span className="text-sm">חזרה</span>
                        </button>

                        {customType === 'departure' && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">שעת יציאה להיום</span>
                                <input
                                    type="time"
                                    value={customEnd}
                                    onChange={e => setCustomEnd(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black w-full text-center outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 h-14"
                                />
                            </div>
                        )}

                        {customType === 'arrival' && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">שעת הגעה להיום</span>
                                <input
                                    type="time"
                                    value={customStart}
                                    onChange={e => setCustomStart(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-black w-full text-center outline-none focus:ring-2 ring-blue-500/20 focus:border-blue-500 h-14"
                                />
                            </div>
                        )}

                        {/* We can remove 'custom' logic button if we just rely on the granular Arrival/Departure buttons above */}
                    </div>
                )}
            </div>
        </Modal>
    );
};
