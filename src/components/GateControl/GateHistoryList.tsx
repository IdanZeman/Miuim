import React from 'react';
import { GateLog, AuthorizedVehicle } from '../../hooks/useGateSystem';
import { ArrowLeftRight, Calendar, Clock, Car, Footprints, AlertTriangle, User, ShieldCheck, Building2, X, ChevronDown, LogOut } from 'lucide-react';
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
        <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-8 custom-scrollbar">
            {Object.entries(groupedLogs).map(([date, dateLogs]) => (
                <div key={date}>
                    {/* Premium Sticky Date Header */}
                    <div
                        onClick={() => toggleDate(date)}
                        className="sticky top-0 bg-white/90 backdrop-blur-xl z-20 py-4 px-1 mb-4 border-b border-slate-100/50 flex items-center justify-between cursor-pointer group transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition-colors">
                                <Calendar size={16} />
                            </div>
                            <span className="text-sm font-black text-slate-900 tracking-tight">{date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{dateLogs.length} תנועות</span>
                            <div className={`transition-transform duration-300 ${collapsedDates[date] ? '-rotate-90' : 'rotate-0'}`}>
                                <ChevronDown size={16} className="text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Collapsible Content */}
                    {!collapsedDates[date] && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-400">
                            {dateLogs.map((log) => (
                                <div
                                    key={log.id}
                                    onClick={() => setSelectedLog(log)}
                                    className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 hover:shadow-lg transition-all relative overflow-hidden cursor-pointer active:scale-[0.98] group"
                                >
                                    {/* Status Indicator Bar */}
                                    <div className={`absolute top-0 bottom-0 right-0 w-1.5 transition-all ${log.status === 'inside' ? 'bg-blue-600' : 'bg-slate-200 group-hover:bg-slate-300'}`} />

                                    <div className="flex items-center justify-between mr-2">
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            {/* Vehicle/Pedestrian Icon Capsule */}
                                            <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 ${log.entry_type === 'pedestrian'
                                                ? 'bg-amber-50 text-amber-600 shadow-sm shadow-amber-100'
                                                : 'bg-blue-50 text-blue-600 shadow-sm shadow-blue-100'
                                                }`}>
                                                {log.entry_type === 'pedestrian' ? <Footprints size={22} strokeWidth={2.5} /> : <Car size={22} strokeWidth={2.5} />}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="font-black text-slate-900 text-base md:text-lg tracking-tight truncate uppercase">
                                                        {log.plate_number}
                                                    </h4>
                                                    {log.is_exceptional && (
                                                        <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-lg font-black text-[9px] border border-red-100/50 animate-pulse">
                                                            <AlertTriangle size={10} />
                                                            חריג
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                                    <User size={12} className="text-slate-400" />
                                                    <span className="truncate">{log.driver_name}</span>
                                                    {log.organizations?.name && (
                                                        <>
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span className="truncate text-blue-600/70">{log.organizations.name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Activity Info */}
                                        <div className="shrink-0 flex items-center gap-3">
                                            {!log.exit_time && (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">כניסה</span>
                                                    <span className="font-black text-slate-900 text-sm">{formatTime(log.entry_time)}</span>
                                                </div>
                                            )}

                                            {log.exit_time ? (
                                                <div className="flex items-center gap-3">
                                                    {/* Duration Logic could be here, but let's stick to times */}
                                                    <div className="flex flex-col items-center opacity-60">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">כניסה</span>
                                                        <span className="font-black text-slate-600 text-sm">{formatTime(log.entry_time)}</span>
                                                    </div>
                                                    <div className="w-px h-6 bg-slate-100" />
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">יציאה</span>
                                                        <span className="font-black text-slate-900 text-sm">{formatTime(log.exit_time)}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-3">
                                                    {onExit && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onExit(log.id, log.plate_number);
                                                            }}
                                                            className="h-10 px-4 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-red-200 active:scale-95 transition-all flex items-center gap-2"
                                                        >
                                                            <LogOut size={14} />
                                                            יציאה
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {log.notes && (
                                        <div className="mt-3 mr-14 bg-amber-50/50 text-amber-900 text-[11px] p-2.5 rounded-xl border border-amber-100/30 flex items-start gap-2 font-bold leading-relaxed">
                                            <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                            {log.notes}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
