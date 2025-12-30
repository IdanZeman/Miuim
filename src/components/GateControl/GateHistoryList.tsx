import React from 'react';
import { GateLog, AuthorizedVehicle } from '../../hooks/useGateSystem';
import { ArrowLeftRight, Calendar, Clock, Car, Footprints, AlertTriangle, User, ShieldCheck, Building2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface GateHistoryListProps {
    logs: GateLog[];
    isLoading: boolean;
    onLoadMore?: () => void;
    hasMore?: boolean;
    onExit?: (logId: string, plateNumber: string) => void;
}

export const GateHistoryList: React.FC<GateHistoryListProps> = ({ logs, isLoading, onExit }) => {
    if (isLoading && logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <div className="animate-spin mb-4">
                    <ArrowLeftRight size={32} />
                </div>
                <p>טוען היסטוריה...</p>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <Calendar size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">לא נמצאה היסטוריה</p>
                <p className="text-sm">נסה לשנות את תאריכי הסינון</p>
            </div>
        );
    }

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

    // Group logs by Date
    const groupedLogs = logs.reduce((groups, log) => {
        const date = formatDate(log.entry_time);
        if (!groups[date]) {
            groups[date] = [];
        }
        groups[date].push(log);
        return groups;
    }, {} as Record<string, GateLog[]>);

    // State for collapsed dates
    const [collapsedDates, setCollapsedDates] = React.useState<Record<string, boolean>>({});
    const [selectedLog, setSelectedLog] = React.useState<GateLog | null>(null);

    const toggleDate = (date: string) => {
        setCollapsedDates(prev => ({
            ...prev,
            [date]: !prev[date]
        }));
    };

    const LogDetailsModal = ({ log, onClose }: { log: GateLog; onClose: () => void }) => {
        const isEntryOnly = !log.exit_time || (Math.abs(new Date(log.entry_time).getTime() - new Date(log.exit_time).getTime()) < 2000);

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
                        {log.exit_time && (
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

    return (
        <div className="flex-1 overflow-y-auto px-2 space-y-6">
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                <div key={date}>
                    <div
                        onClick={() => toggleDate(date)}
                        className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 py-2 px-1 mb-2 border-b border-slate-200 text-xs font-bold text-slate-500 flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-colors"
                    >
                        {/* Chevron Icon for Collapse/Expand - Rotation based on state */}
                        <div className={`transition-transform duration-200 ${collapsedDates[date] ? '-rotate-90' : 'rotate-0'}`}>
                            <Calendar size={12} />
                        </div>
                        {date}
                        <span className="mr-auto bg-slate-200 px-1.5 rounded-full text-[10px]">{dateLogs.length}</span>
                    </div>

                    {/* Collapsible Content */}
                    {!collapsedDates[date] && (
                        <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                            {dateLogs.map((log) => (
                                <div
                                    key={log.id}
                                    onClick={() => setSelectedLog(log)}
                                    className="bg-white rounded-xl shadow-sm border border-slate-100 p-3 hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer active:scale-[0.98]"
                                >
                                    {/* Status Color Bar */}
                                    <div className={`absolute top-0 right-0 bottom-0 w-1 ${log.status === 'inside' ? 'bg-indigo-500' : 'bg-slate-300'}`} />

                                    <div className="flex items-center justify-between mr-2.5">
                                        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
                                            {/* Icon - Smaller on mobile */}
                                            <div className={`p-1.5 md:p-2 rounded-full shrink-0 ${log.entry_type === 'pedestrian'
                                                ? 'bg-amber-50 text-amber-600'
                                                : 'bg-blue-50 text-blue-600'
                                                }`}>
                                                {log.entry_type === 'pedestrian' ? <Footprints size={16} className="md:w-[18px] md:h-[18px]" /> : <Car size={16} className="md:w-[18px] md:h-[18px]" />}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                                    <h4 className="font-bold text-slate-800 text-sm md:text-lg truncate">
                                                        {log.plate_number}
                                                    </h4>
                                                    {log.is_exceptional && (
                                                        <span className="flex items-center gap-1 text-[9px] md:text-[10px] bg-red-50 text-red-600 px-1 md:px-1.5 py-0.5 rounded font-bold border border-red-100 animate-pulse">
                                                            <AlertTriangle size={10} />
                                                            חריג
                                                        </span>
                                                    )}
                                                    {log.organizations?.name && (
                                                        <span className="text-[9px] md:text-[10px] bg-slate-100 text-slate-600 px-1 md:px-1.5 py-0.5 rounded font-medium truncate max-w-[80px] md:max-w-none">
                                                            {log.organizations.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] md:text-sm text-slate-500 truncate mt-0.5 md:mt-0">
                                                    <User size={10} className="md:w-3 md:h-3" />
                                                    <span className="truncate">{log.driver_name}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action / Times */}
                                        <div className="shrink-0 flex items-center gap-2 md:gap-4 ml-1">
                                            {!log.exit_time && (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-wider">כניסה</span>
                                                    <span className="font-bold text-slate-700 text-xs md:text-base">{formatTime(log.entry_time)}</span>
                                                    {log.entry_reporter?.full_name && (
                                                        <span className="text-[8px] md:text-[9px] text-slate-400 truncate max-w-[60px] text-center" title={`דיווח: ${log.entry_reporter.full_name}`}>
                                                            {log.entry_reporter.full_name.split(' ')[0]}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {log.exit_time ? (
                                                <div className="flex items-center gap-2 md:gap-4 text-sm">
                                                    {/* Hide Entry time if it's identical to Exit time (Immediate Exit report) */}
                                                    {Math.abs(new Date(log.entry_time).getTime() - new Date(log.exit_time).getTime()) > 2000 && (
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-wider">כניסה</span>
                                                            <span className="font-bold text-slate-700 text-xs md:text-base">{formatTime(log.entry_time)}</span>
                                                            {log.entry_reporter?.full_name && (
                                                                <span className="text-[8px] md:text-[9px] text-slate-400 truncate max-w-[60px] text-center" title={`דיווח: ${log.entry_reporter.full_name}`}>
                                                                    {log.entry_reporter.full_name.split(' ')[0]}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] md:text-[10px] text-slate-400 uppercase tracking-wider">יציאה</span>
                                                        <span className="font-bold text-slate-700 text-xs md:text-base">{formatTime(log.exit_time)}</span>
                                                        {log.exit_reporter?.full_name && (
                                                            <span className="text-[8px] md:text-[9px] text-slate-400 truncate max-w-[60px] text-center" title={`דיווח: ${log.exit_reporter.full_name}`}>
                                                                {log.exit_reporter.full_name.split(' ')[0]}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1.5 md:gap-3">
                                                    <div className="flex flex-col items-center hidden sm:flex">
                                                        <span className="text-[9px] md:text-[10px] text-zinc-400 uppercase tracking-wider">סטטוס</span>
                                                        <span className="font-bold text-indigo-600 text-[10px] md:text-xs bg-indigo-50 px-1.5 md:px-2 py-0.5 rounded-full mt-0.5 uppercase">בפנים</span>
                                                    </div>
                                                    {onExit && (
                                                        <Button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onExit(log.id, log.plate_number);
                                                            }}
                                                            className="h-7 md:h-8 px-2 md:px-3 text-[10px] md:text-xs bg-red-600 text-white hover:bg-red-700 border-none font-bold shadow-lg shadow-red-200"
                                                        >
                                                            יציאה
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {log.notes && (
                                        <div className="mt-2 mr-3 text-xs bg-yellow-50 text-yellow-800 p-1.5 rounded flex items-start gap-1.5">
                                            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                                            {log.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {selectedLog && <LogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};
