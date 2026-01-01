import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, ArrowLeft } from '@phosphor-icons/react';
import { TimePicker } from '../../components/ui/DatePicker';

interface StatusEditPopoverProps {
    isOpen: boolean;
    date?: string;
    position: { top: number, left: number };
    onClose: () => void;
    onApply: (status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }) => void;
    defaultArrivalHour?: string;
    defaultDepartureHour?: string;
}

export const StatusEditPopover: React.FC<StatusEditPopoverProps> = ({
    isOpen, date, position, onClose, onApply,
    defaultArrivalHour = '10:00',
    defaultDepartureHour = '14:00'
}) => {
    const [customStart, setCustomStart] = useState(defaultArrivalHour);
    const [customEnd, setCustomEnd] = useState(defaultDepartureHour);
    const [customType, setCustomType] = useState<null | 'arrival' | 'departure' | 'custom'>(null);
    const [isMobile, setIsMobile] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setCustomType(null);
            setCustomStart(defaultArrivalHour);
            setCustomEnd(defaultDepartureHour);
        }
    }, [isOpen, defaultArrivalHour, defaultDepartureHour]);

    if (!isOpen || !mounted) return null;

    const handleApply = (status: 'base' | 'home' | 'unavailable', times?: { start: string, end: string }) => {
        onApply(status, times);
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[99999] flex cursor-default bg-black/20 backdrop-blur-[1px]"
            onClick={onClose}
        >
            <div
                className={`bg-white shadow-2xl flex flex-col gap-1 transition-all duration-300 ${isMobile
                    ? 'fixed bottom-0 left-0 right-0 rounded-t-[2rem] p-6 pb-10 animate-in slide-in-from-bottom duration-300 ease-out'
                    : 'absolute rounded-lg shadow-xl border border-slate-200 p-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-100'
                    }`}
                style={isMobile ? {} : {
                    top: position.top,
                    left: position.left,
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="text-xs font-black text-slate-400 px-1 pb-3 border-b border-slate-100 mb-2 flex justify-between items-center uppercase tracking-widest">
                    <span>ערוך סטטוס • {date}</span>
                    <button onClick={onClose} className="hover:bg-slate-100 rounded-full p-1 transition-colors">
                        <X size={16} weight="bold" />
                    </button>
                </div>

                {!customType ? (
                    <>
                        <button onClick={() => handleApply('base')} className="flex items-center gap-2 px-2 py-2 hover:bg-green-50 rounded text-xs text-slate-700 w-full text-right transition-colors font-bold">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> בבסיס (מלא)
                        </button>
                        <button onClick={() => handleApply('home')} className="flex items-center gap-2 px-2 py-2 hover:bg-red-50 rounded text-xs text-slate-700 w-full text-right transition-colors font-bold">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm" /> בבית (מלא)
                        </button>

                        <div className="flex gap-1 mt-1">
                            <button onClick={() => setCustomType('departure')} className="flex-1 flex items-center justify-center gap-1 px-1 py-2 hover:bg-amber-50 rounded text-xs text-slate-700 border border-slate-100 transition-colors font-bold">
                                <div className="w-2 h-2 rounded-full bg-amber-400" /> יציאה...
                            </button>
                            <button onClick={() => setCustomType('arrival')} className="flex-1 flex items-center justify-center gap-1 px-1 py-2 hover:bg-teal-50 rounded text-xs text-slate-700 border border-slate-100 transition-colors font-bold">
                                <div className="w-2 h-2 rounded-full bg-teal-400" /> הגעה...
                            </button>
                        </div>

                        <button onClick={() => setCustomType('custom')} className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 rounded text-xs text-slate-700 w-full text-right transition-colors mt-1 font-bold">
                            <Clock size={12} className="text-blue-500" weight="duotone" /> שעות מותאמות...
                        </button>

                        <button onClick={() => handleApply('unavailable')} className="flex items-center gap-3 px-2 py-2 hover:bg-slate-100 rounded text-xs text-slate-400 w-full text-right border-t mt-2 pt-3 transition-colors font-black uppercase tracking-tighter">
                            אילוץ / לא זמין
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col gap-3 p-1">
                        <button onClick={() => setCustomType(null)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 font-bold">
                            <ArrowLeft size={14} weight="duotone" />
                            <span className="text-xs">חזרה</span>
                        </button>

                        {customType === 'departure' && (
                            <div className="flex flex-col gap-1.5">
                                <TimePicker
                                    label="שעת יציאה"
                                    value={customEnd}
                                    onChange={setCustomEnd}
                                />
                            </div>
                        )}

                        {customType === 'arrival' && (
                            <div className="flex flex-col gap-1.5">
                                <TimePicker
                                    label="שעת הגעה"
                                    value={customStart}
                                    onChange={setCustomStart}
                                />
                            </div>
                        )}

                        {customType === 'custom' && (
                            <div className="flex items-center justify-between gap-2 px-1">
                                <div className="flex flex-1">
                                    <TimePicker
                                        label="מהשעה"
                                        value={customStart}
                                        onChange={setCustomStart}
                                    />
                                </div>
                                <div className="flex flex-1">
                                    <TimePicker
                                        label="עד השעה"
                                        value={customEnd}
                                        onChange={setCustomEnd}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 mt-2 pt-2 border-t border-slate-50">
                            <button onClick={() => setCustomType(null)} className="flex-1 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors">ביטול</button>
                            <button
                                onClick={() => {
                                    const start = customType === 'departure' ? '00:00' : customStart;
                                    const end = customType === 'arrival' ? '23:59' : customEnd;
                                    handleApply('base', { start, end });
                                }}
                                className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs font-black hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                שמור שינויים
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};