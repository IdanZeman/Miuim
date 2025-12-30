import React from 'react';
import { Footprints, Car, AlertTriangle, User } from 'lucide-react';
import { GateLog } from '../../hooks/useGateSystem';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

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

    return (
        <Modal
            isOpen={!!log}
            onClose={onClose}
            title="פרטי דיווח שער"
            size="md"
        >
            <div className="space-y-6">
                {/* Header Info */}
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className={`p-3 rounded-2xl ${log.entry_type === 'pedestrian' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                        {log.entry_type === 'pedestrian' ? <Footprints size={24} /> : <Car size={24} />}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">{log.plate_number}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${log.status === 'inside' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                                {log.status === 'inside' ? 'בתוך הבסיס' : 'יצא'}
                            </span>
                            {log.is_exceptional && (
                                <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">חריג</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Timeline */}
                <div className="space-y-4 relative pr-4">
                    <div className="absolute right-[7px] top-2 bottom-2 w-0.5 bg-slate-100" />

                    {/* Entry Event */}
                    <div className="relative pr-6">
                        <div className="absolute right-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-500 shadow-sm" />
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">כניסה</span>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-lg font-black text-slate-800">{formatTime(log.entry_time)}</span>
                                <span className="text-xs text-slate-500 font-medium">{formatDate(log.entry_time)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 bg-slate-50 self-start px-2 py-1 rounded-lg border border-slate-100/50">
                                <User size={12} className="text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-600">ש.ג: {log.entry_reporter?.full_name || 'לא ידוע'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Exit Event */}
                    {log.exit_time && !(Math.abs(new Date(log.entry_time).getTime() - new Date(log.exit_time).getTime()) < 2000) && (
                        <div className="relative pr-6 mt-6">
                            <div className="absolute right-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-slate-400 shadow-sm" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">יציאה</span>
                                <div className="flex items-baseline gap-2 mt-1">
                                    <span className="text-lg font-black text-slate-800">{formatTime(log.exit_time)}</span>
                                    <span className="text-xs text-slate-500 font-medium">{formatDate(log.exit_time)}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-2 bg-slate-50 self-start px-2 py-1 rounded-lg border border-slate-100/50">
                                    <User size={12} className="text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-600">ש.ג: {log.exit_reporter?.full_name || 'לא ידוע'}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Additional Details */}
                <div className="grid grid-cols-2 gap-3 pb-2">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">נהג / בעל רכב</span>
                        <span className="text-sm font-bold text-slate-700 block">{log.driver_name}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100/50">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">יחידה משוייכת</span>
                        <span className="text-sm font-bold text-slate-700 block truncate">{log.organizations?.name || 'ללא שיוך'}</span>
                    </div>
                </div>

                {log.notes && (
                    <div className="p-4 bg-amber-50 rounded-xl border border-amber-100/50">
                        <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1 flex items-center gap-1">
                            <AlertTriangle size={12} /> הערות
                        </span>
                        <p className="text-sm text-amber-900 leading-relaxed font-medium">{log.notes}</p>
                    </div>
                )}

                <div className="pt-2">
                    <Button onClick={onClose} variant="outline" className="w-full h-12 rounded-2xl font-bold border-slate-200 text-slate-600">
                        סגור
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
