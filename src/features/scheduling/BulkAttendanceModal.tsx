import React, { useState } from 'react';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { DatePicker, TimePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Calendar, Clock, CheckCircle as CheckCircle2, XCircle } from '@phosphor-icons/react';
import { logger } from '@/services/loggingService';
import { cn } from '@/lib/utils';

interface BulkAttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (data: { startDate: string; endDate: string; isAvailable: boolean; startHour: string; endHour: string; reason?: string }) => void;
    selectedCount: number;
}

export const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = ({ isOpen, onClose, onApply, selectedCount }) => {
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [status, setStatus] = useState<'available' | 'away'>('away'); // Default to away as that's the common use case
    const [startHour, setStartHour] = useState('00:00');
    const [endHour, setEndHour] = useState('23:59');
    const [reason, setReason] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onApply({
            startDate,
            endDate,
            isAvailable: status === 'available',
            startHour: status === 'available' ? startHour : '00:00',
            endHour: status === 'available' ? endHour : '00:00',
            reason
        });
        logger.info('UPDATE', `Applied bulk attendance update to ${selectedCount} people`, {
            selectedCount,
            startDate,
            endDate,
            status,
            startHour,
            endHour,
            category: 'attendance'
        });
        onClose();
    };

    const modalTitle = (
        <div className="flex flex-col gap-0.5">
            <h3 className="text-xl font-black text-slate-800 leading-tight">עריכה קבוצתית</h3>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                <CheckCircle2 size={12} className="text-blue-500" weight="bold" />
                <span>עדכון סטטוס עבור {selectedCount} משתמשים</span>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex gap-3 w-full">
            <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-bold"
            >
                ביטול
            </Button>
            <Button
                type="submit"
                form="bulk-attendance-form"
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
            >
                החל שינויים
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
            <form id="bulk-attendance-form" onSubmit={handleSubmit} className="flex flex-col gap-6 py-2">
                {/* Status Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setStatus('available')}
                        className={cn(
                            "flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all group",
                            status === 'available'
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm ring-2 ring-emerald-50"
                                : "border-slate-100 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500"
                        )}
                    >
                        <CheckCircle2 size={32} className={cn("mb-2 transition-transform group-hover:scale-110", status === 'available' ? "text-emerald-600" : "text-slate-200")} weight="bold" />
                        <span className="font-black text-[10px] uppercase tracking-widest">נוכח / זמין</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatus('away')}
                        className={cn(
                            "flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all group",
                            status === 'away'
                                ? "border-red-500 bg-red-50 text-red-700 shadow-sm ring-2 ring-red-50"
                                : "border-slate-100 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500"
                        )}
                    >
                        <XCircle size={32} className={cn("mb-2 transition-transform group-hover:scale-110", status === 'away' ? "text-red-600" : "text-slate-200")} weight="bold" />
                        <span className="font-black text-[10px] uppercase tracking-widest">לא נוכח / חופש</span>
                    </button>
                </div>

                {/* Date Range */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 px-1">
                        <Calendar size={14} className="text-blue-500" weight="bold" />
                        <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">טווח תאריכים</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <DatePicker
                            label="מתאריך"
                            value={startDate}
                            onChange={setStartDate}
                        />
                        <DatePicker
                            label="עד תאריך"
                            value={endDate}
                            onChange={setEndDate}
                        />
                    </div>
                </div>

                {/* Hours Configuration */}
                {status === 'available' && (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 px-1">
                            <Clock size={14} className="text-blue-500" weight="bold" />
                            <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">שעות זמינות</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <TimePicker
                                label="התחלה"
                                value={startHour}
                                onChange={setStartHour}
                            />
                            <TimePicker
                                label="סיום"
                                value={endHour}
                                onChange={setEndHour}
                            />
                        </div>
                    </div>
                )}
            </form>
        </GenericModal>
    );
};
