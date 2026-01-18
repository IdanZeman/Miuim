import React from 'react';
import { Footprints as FootprintsIcon, Car as CarIcon, Warning as AlertTriangleIcon, User as UserIcon, ClockCounterClockwise as HistoryIcon, UserPlus as UserPlusIcon, SignOut as LogOutIcon } from '@phosphor-icons/react';
import { GateLog } from '../../hooks/useGateSystem';
import { Button } from '../ui/Button';
import { GenericModal } from '../ui/GenericModal';

interface LogDetailsModalProps {
    log: GateLog;
    onClose: () => void;
}

export const LogDetailsModal: React.FC<LogDetailsModalProps> = ({ log, onClose }) => {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('he-IL', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit'
        });
    };

    const formatTime = (dateString: string) => {
        return new Date(dateString).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const modalTitle = (
        <div className="flex flex-col">
            <h3 className="text-xl font-black text-slate-800 tracking-tight">פרטי דיווח שער</h3>
            <div className="flex items-center gap-2 mt-1">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    {log.entry_type === 'pedestrian' ? <FootprintsIcon size={14} weight="bold" /> : <CarIcon size={14} weight="bold" />}
                </div>
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-widest">
                    {log.entry_type === 'pedestrian' ? 'הולך רגל' : 'רכב ממונע'}
                </span>
            </div>
        </div>
    );

    const modalFooter = (
        <Button
            onClick={onClose}
            variant="secondary"
            className="w-full h-12 md:h-10 rounded-xl font-bold bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200"
        >
            סגור
        </Button>
    );

    return (
        <GenericModal
            isOpen={!!log}
            onClose={onClose}
            title={modalTitle}
            footer={modalFooter}
            size="sm"
        >
            <div className="space-y-6 py-2">
                {/* Plate / Main ID Card */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-4 flex items-center justify-between bg-slate-50/50 border-b border-slate-50">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">מספר זיהוי</span>
                            <span className="text-2xl font-black text-slate-900 tracking-tighter">{log.plate_number}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase shadow-sm ${log.status === 'inside' ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                {log.status === 'inside' ? 'בתוך הבסיס' : 'יצא מהבסיס'}
                            </span>
                            {log.is_exceptional && (
                                <span className="text-[10px] font-black bg-rose-100 text-rose-700 px-3 py-1 rounded-lg border border-rose-200 shadow-sm">
                                    דיווח חריג
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">נהג / מדווח</span>
                            <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <UserIcon size={14} className="text-slate-400" weight="bold" />
                                {log.driver_name}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">שיוך יחידה</span>
                            <span className="text-sm font-bold text-slate-800 truncate">
                                {log.organizations?.name || 'ללא שיוך'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Timeline Section */}
                <div className="px-1">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <HistoryIcon size={14} weight="bold" /> ציר זמן דיווחים
                    </h4>

                    <div className="space-y-6 relative mr-2">
                        <div className="absolute right-[7px] top-2 bottom-2 w-0.5 bg-slate-100" />

                        {/* Entry Event */}
                        <div className="relative pr-6">
                            <div className="absolute right-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-500 shadow-md ring-2 ring-blue-100" />
                            <div className="flex flex-col bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">רישום כניסה</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-lg font-black text-slate-800">{formatTime(log.entry_time)}</span>
                                    <span className="text-xs text-slate-500 font-bold">{formatDate(log.entry_time)}</span>
                                </div>
                                <div className="mt-2 flex items-center gap-1.5 text-slate-400 group">
                                    <UserPlusIcon size={12} className="group-hover:text-blue-500 transition-colors" weight="bold" />
                                    <span className="text-[10px] font-bold text-slate-500">
                                        מדווח: <span className="text-slate-700">{log.entry_reporter?.full_name || 'מערכת'}</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Exit Event */}
                        {log.exit_time && !(Math.abs(new Date(log.entry_time).getTime() - new Date(log.exit_time).getTime()) < 2000) && (
                            <div className="relative pr-6">
                                <div className="absolute right-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-amber-500 shadow-md ring-2 ring-amber-100" />
                                <div className="flex flex-col bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                                    <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">רישום יציאה</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-black text-slate-800">{formatTime(log.exit_time)}</span>
                                        <span className="text-xs text-slate-500 font-bold">{formatDate(log.exit_time)}</span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-1.5 text-slate-400 group">
                                        <LogOutIcon size={12} className="group-hover:text-amber-500 transition-colors" weight="bold" />
                                        <span className="text-[10px] font-bold text-slate-500">
                                            מדווח: <span className="text-slate-700">{log.exit_reporter?.full_name || 'מערכת'}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {log.notes && (
                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 ring-4 ring-amber-50/30">
                        <span className="text-[10px] font-black text-amber-600 uppercase block mb-1.5 flex items-center gap-2">
                            <AlertTriangleIcon size={14} weight="bold" /> הערות ש.ג
                        </span>
                        <p className="text-sm text-slate-700 leading-relaxed font-bold italic">
                            "{log.notes}"
                        </p>
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
