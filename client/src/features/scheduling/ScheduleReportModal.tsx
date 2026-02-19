import React from 'react';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { SchedulingResult } from '../../services/scheduler';
import {
    CheckCircle,
    XCircle,
    WarningCircle,
    ChartBar,
    Clock,
    Users,
    Info
} from '@phosphor-icons/react';

interface ScheduleReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: SchedulingResult;
    dateRange: { start: Date; end: Date };
}

export const ScheduleReportModal: React.FC<ScheduleReportModalProps> = ({
    isOpen,
    onClose,
    result,
    dateRange
}) => {
    const { stats, failures } = result;

    // Group failures by reason type
    const failuresByType = failures.reduce((acc, failure) => {
        failure.reasons.forEach(reason => {
            if (!acc[reason.type]) {
                acc[reason.type] = [];
            }
            acc[reason.type].push({ ...failure, reason });
        });
        return acc;
    }, {} as Record<string, Array<typeof failures[0] & { reason: typeof failures[0]['reasons'][0] }>>);

    const getReasonTypeLabel = (type: string) => {
        const labels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
            'no_available_people': {
                label: 'חסרים אנשים זמינים',
                icon: <Users size={20} weight="bold" />,
                color: 'text-red-600'
            },
            'role_mismatch': {
                label: 'אין אנשים בתפקיד',
                icon: <XCircle size={20} weight="bold" />,
                color: 'text-orange-600'
            },
            'unavailable': {
                label: 'כל האנשים לא זמינים',
                icon: <Clock size={20} weight="bold" />,
                color: 'text-amber-600'
            },
            'constraint_violation': {
                label: 'אילוצים מנעו שיבוץ',
                icon: <WarningCircle size={20} weight="bold" />,
                color: 'text-purple-600'
            },
            'rest_period': {
                label: 'אילוצי מנוחה',
                icon: <Clock size={20} weight="bold" />,
                color: 'text-blue-600'
            },
            'team_organic': {
                label: 'אורגניות צוותים',
                icon: <Users size={20} weight="bold" />,
                color: 'text-indigo-600'
            },
            'inter_person_constraint': {
                label: 'אילוצים בין-אישיים',
                icon: <WarningCircle size={20} weight="bold" />,
                color: 'text-pink-600'
            }
        };
        return labels[type] || { label: type, icon: <Info size={20} />, color: 'text-gray-600' };
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp);
        return date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
    };

    const modalTitle = (
        <div className="flex flex-col gap-0.5">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight flex items-center gap-2">
                <ChartBar className="text-blue-500" size={20} weight="bold" />
                <span>דוח שיבוץ אוטומטי</span>
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                <span>
                    {dateRange.start.toLocaleDateString('he-IL')}
                    {dateRange.start.getTime() !== dateRange.end.getTime() &&
                        ` - ${dateRange.end.toLocaleDateString('he-IL')}`}
                </span>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex gap-3 w-full">
            <Button
                onClick={onClose}
                className="flex-1 h-12 md:h-10 text-base md:text-sm font-black bg-blue-600 hover:bg-blue-700 text-white"
            >
                סגור
            </Button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            size="lg"
            footer={modalFooter}
        >
            <div className="flex flex-col gap-6">
                {/* Summary Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-2xl border border-green-100">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle size={18} className="text-green-600" weight="bold" />
                            <span className="text-xs font-black text-green-700 uppercase tracking-wider">שובצו במלואן</span>
                        </div>
                        <div className="text-3xl font-black text-green-600">{stats.fullyAssigned}</div>
                        <div className="text-[10px] text-green-600 font-bold mt-1">
                            מתוך {stats.totalShifts} משמרות
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-4 rounded-2xl border border-amber-100">
                        <div className="flex items-center gap-2 mb-2">
                            <WarningCircle size={18} className="text-amber-600" weight="bold" />
                            <span className="text-xs font-black text-amber-700 uppercase tracking-wider">שובצו חלקית</span>
                        </div>
                        <div className="text-3xl font-black text-amber-600">{stats.partiallyAssigned}</div>
                        <div className="text-[10px] text-amber-600 font-bold mt-1">
                            משמרות לא מלאות
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-red-50 to-rose-50 p-4 rounded-2xl border border-red-100">
                        <div className="flex items-center gap-2 mb-2">
                            <XCircle size={18} className="text-red-600" weight="bold" />
                            <span className="text-xs font-black text-red-700 uppercase tracking-wider">לא שובצו</span>
                        </div>
                        <div className="text-3xl font-black text-red-600">{stats.unassigned}</div>
                        <div className="text-[10px] text-red-600 font-bold mt-1">
                            משמרות ריקות
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                        <div className="flex items-center gap-2 mb-2">
                            <ChartBar size={18} className="text-blue-600" weight="bold" />
                            <span className="text-xs font-black text-blue-700 uppercase tracking-wider">אחוז הצלחה</span>
                        </div>
                        <div className="text-3xl font-black text-blue-600">{stats.successRate}%</div>
                        <div className="text-[10px] text-blue-600 font-bold mt-1">
                            {stats.totalSlotsFilled}/{stats.totalSlotsRequired} משבצות
                        </div>
                    </div>
                </div>

                {/* Failures Section */}
                {failures.length > 0 && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2 px-1">
                            <XCircle size={20} className="text-red-500" weight="bold" />
                            <h3 className="text-lg font-black text-slate-800">
                                משמרות שלא שובצו במלואן ({failures.length})
                            </h3>
                        </div>

                        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                            {Object.entries(failuresByType).map(([type, failuresOfType]) => {
                                const typeInfo = getReasonTypeLabel(type);
                                return (
                                    <div key={type} className="flex flex-col gap-2">
                                        <div className={`flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100`}>
                                            <div className={typeInfo.color}>{typeInfo.icon}</div>
                                            <span className={`text-sm font-black ${typeInfo.color}`}>
                                                {typeInfo.label} ({failuresOfType.length})
                                            </span>
                                        </div>

                                        <div className="flex flex-col gap-2 pr-4">
                                            {failuresOfType.map((failure, idx) => (
                                                <div
                                                    key={`${failure.shiftId}-${idx}`}
                                                    className="bg-white p-4 rounded-xl border border-slate-100 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex-1">
                                                            <div className="font-black text-slate-800 text-base leading-tight mb-1">
                                                                {failure.taskName}
                                                            </div>
                                                            <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
                                                                <span>{formatDate(failure.startTime)}</span>
                                                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                                                <span>{formatTime(failure.startTime)} - {formatTime(failure.endTime)}</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-red-50 px-3 py-1 rounded-lg">
                                                            <span className="text-xs font-black text-red-600">
                                                                {failure.assignedCount}/{failure.requiredPeople}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                        <div className="text-xs font-bold text-slate-600 mb-1">סיבה:</div>
                                                        <div className="text-sm font-black text-slate-800">
                                                            {failure.reason.details}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Success Message */}
                {failures.length === 0 && (
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-2xl border border-green-100 text-center">
                        <CheckCircle size={48} className="text-green-600 mx-auto mb-3" weight="bold" />
                        <div className="text-xl font-black text-green-700 mb-2">
                            כל המשמרות שובצו בהצלחה! 🎉
                        </div>
                        <div className="text-sm text-green-600 font-bold">
                            {stats.totalShifts} משמרות שובצו במלואן
                        </div>
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
