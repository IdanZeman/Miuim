import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { logger } from '@/services/loggingService';

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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`עריכה קבוצתית (${selectedCount} נבחרים)`}>
            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Status Selection */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        type="button"
                        onClick={() => setStatus('available')}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${status === 'available' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}
                    >
                        <CheckCircle2 size={32} className="mb-2" />
                        <span className="font-bold">נוכח / זמין</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatus('away')}
                        className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${status === 'away' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 hover:border-slate-300 text-slate-500'}`}
                    >
                        <XCircle size={32} className="mb-2" />
                        <span className="font-bold">לא נוכח / חופש</span>
                    </button>
                </div>

                {/* Date Range */}
                <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <Calendar size={18} />
                        טווח תאריכים
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            type="date"
                            label="מתאריך"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            required
                        />
                        <Input
                            type="date"
                            label="עד תאריך"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            required
                        />
                    </div>
                </div>

                {/* Hours Configuration (Only if Available) */}
                {status === 'available' && (
                    <div className="bg-slate-50 p-4 rounded-xl space-y-4 border border-slate-100 animate-in fade-in slide-in-from-top-2">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                            <Clock size={18} />
                            שעות זמינות
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                type="time"
                                label="התחלה"
                                value={startHour}
                                onChange={(e) => setStartHour(e.target.value)}
                                required
                            />
                            <Input
                                type="time"
                                label="סיום"
                                value={endHour}
                                onChange={(e) => setEndHour(e.target.value)}
                                required
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
                    <Button type="submit" variant="primary">החל שינויים</Button>
                </div>
            </form>
        </Modal>
    );
};
