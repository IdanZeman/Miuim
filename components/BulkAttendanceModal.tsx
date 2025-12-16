import React, { useState } from 'react';
import { X, Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { Person } from '../types';

interface BulkAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (data: {
        startDate: string;
        endDate: string;
        isAvailable: boolean;
        startHour: string;
        endHour: string;
        reason?: string
    }) => void;
    selectedCount: number;
}

export const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = ({ isOpen, onClose, onApply, selectedCount }) => {
    if (!isOpen) return null;

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isAvailable, setIsAvailable] = useState(true);
    const [startHour, setStartHour] = useState('08:00');
    const [endHour, setEndHour] = useState('17:00');
    const [reason, setReason] = useState('');

    const handleSubmit = () => {
        onApply({
            startDate,
            endDate,
            isAvailable,
            startHour: isAvailable ? startHour : '00:00',
            endHour: isAvailable ? endHour : '00:00',
            reason
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn">
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-slate-800">עריכה קבוצתית ({selectedCount} נבחרים)</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Selection */}
                    <div className="flex gap-3">
                        <button
                            onClick={() => setIsAvailable(true)}
                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${isAvailable ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            <CheckCircle2 size={20} />
                            זמין
                        </button>
                        <button
                            onClick={() => setIsAvailable(false)}
                            className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${!isAvailable ? 'border-red-500 bg-red-50 text-red-700 font-bold' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                        >
                            <XCircle size={20} />
                            לא זמין
                        </button>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">מתאריך</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">עד תאריך</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                min={startDate}
                                className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    {/* Time Range (Only if available) */}
                    {isAvailable && (
                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                            <div className="flex items-center gap-2 text-blue-800 font-bold text-sm mb-3">
                                <Clock size={16} />
                                שעות זמינות
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">התחלה</label>
                                    <input
                                        type="time"
                                        value={startHour}
                                        onChange={e => setStartHour(e.target.value)}
                                        className="w-full bg-white border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">סיום</label>
                                    <input
                                        type="time"
                                        value={endHour}
                                        onChange={e => setEndHour(e.target.value)}
                                        className="w-full bg-white border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    {!isAvailable && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">סיבה (אופציונלי)</label>
                            <input
                                type="text"
                                placeholder="לדוגמה: ימי מחלה, חופשה..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm"
                            />
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">
                        ביטול
                    </button>
                    <button onClick={handleSubmit} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        החל שינויים
                    </button>
                </div>
            </div>
        </div>
    );
};
