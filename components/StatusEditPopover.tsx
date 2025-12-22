import React, { useState } from 'react';
import { X, Clock, ArrowLeft } from 'lucide-react';

interface StatusEditPopoverProps {
    isOpen: boolean;
    position: { top: number, left: number };
    onClose: () => void;
    onApply: (status: 'base' | 'home' | 'unavailable', customTimes?: { start: string, end: string }) => void;
}

export const StatusEditPopover: React.FC<StatusEditPopoverProps> = ({ isOpen, position, onClose, onApply }) => {
    const [showCustomHours, setShowCustomHours] = useState(false);
    const [customStart, setCustomStart] = useState('08:00');
    const [customEnd, setCustomEnd] = useState('17:00');

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex cursor-default"
            onClick={onClose}
        >
            <div
                className="absolute bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex flex-col gap-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                style={{
                    top: position.top,
                    left: position.left,
                    maxHeight: '300px'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="text-[11px] font-bold text-slate-400 px-2 pb-2 border-b mb-1 flex justify-between items-center">
                    <span>ערוך סטטוס</span>
                    <button onClick={onClose} className="hover:bg-slate-100 rounded p-0.5"><X size={12} /></button>
                </div>

                {!showCustomHours ? (
                    <>
                        <button onClick={() => onApply('base')} className="flex items-center gap-2 px-2 py-2 hover:bg-green-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm" /> בבסיס (מלא)
                        </button>
                        <button onClick={() => onApply('home')} className="flex items-center gap-2 px-2 py-2 hover:bg-red-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-sm" /> בבית
                        </button>
                        <button onClick={() => setShowCustomHours(true)} className="flex items-center gap-2 px-2 py-2 hover:bg-blue-50 rounded text-xs text-slate-700 w-full text-right transition-colors">
                            <Clock size={12} className="text-blue-500" /> שעות מסוימות...
                        </button>
                        <button onClick={() => onApply('unavailable')} className="flex items-center gap-2 px-2 py-2 hover:bg-slate-100 rounded text-xs text-slate-700 w-full text-right border-t mt-1 pt-2 transition-colors">
                            אילוץ / לא זמין
                        </button>
                    </>
                ) : (
                    <div className="flex flex-col gap-2 p-1">
                        <button onClick={() => setShowCustomHours(false)} className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 mb-1">
                            <ArrowLeft size={10} /> חזרה
                        </button>
                        <div className="flex items-center gap-1">
                            <input
                                type="time"
                                value={customStart}
                                onChange={e => setCustomStart(e.target.value)}
                                className="w-16 p-1 text-xs border rounded text-center bg-slate-50"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="time"
                                value={customEnd}
                                onChange={e => setCustomEnd(e.target.value)}
                                className="w-16 p-1 text-xs border rounded text-center bg-slate-50"
                            />
                        </div>
                        <button
                            onClick={() => onApply('base', { start: customStart, end: customEnd })}
                            className="bg-blue-600 text-white text-xs py-1.5 rounded font-bold hover:bg-blue-700 mt-1"
                        >
                            שמור
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
