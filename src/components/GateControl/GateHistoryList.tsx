import React from 'react';
import { GateLog, AuthorizedVehicle } from '../../hooks/useGateSystem';
import { ArrowsLeftRight as ArrowLeftRightIcon, Calendar as CalendarIcon, Clock as ClockIcon, Car as CarIcon, Footprints as FootprintsIcon, Warning as AlertTriangleIcon, User as UserIcon, ShieldCheck as ShieldCheckIcon, Buildings as Building2Icon, X as XIcon, CaretDown as ChevronDownIcon, SignOut as LogOutIcon } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import { LogDetailsModal } from './LogDetailsModal';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { format } from 'date-fns';

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
            <div className="p-8">
                <DashboardSkeleton />
                <p className="text-center text-slate-400 mt-4 font-bold">טוען היסטוריה...</p>
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                <CalendarIcon size={48} className="mb-4 opacity-50" weight="bold" />
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
                                <CalendarIcon size={16} weight="bold" />
                            </div>
                            <span className="text-sm font-black text-slate-900 tracking-tight">{date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider">{dateLogs.length} תנועות</span>
                            <div className={`transition-transform duration-300 ${collapsedDates[date] ? '-rotate-90' : 'rotate-0'}`}>
                                <ChevronDownIcon size={16} className="text-slate-400" weight="bold" />
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
                                                {log.entry_type === 'pedestrian' ? <FootprintsIcon size={22} weight="bold" /> : <CarIcon size={22} weight="bold" />}
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h4 className="font-black text-slate-900 text-base md:text-lg tracking-tight truncate uppercase">
                                                        {log.plate_number}
                                                    </h4>
                                                    {log.is_exceptional && (
                                                        <div className="flex items-center gap-1 bg-red-50 text-red-600 px-2 py-0.5 rounded-lg font-black text-[9px] border border-red-100/50 animate-pulse">
                                                            <AlertTriangleIcon size={10} weight="bold" />
                                                            חריג
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500 font-bold">
                                                    <UserIcon size={12} className="text-slate-400" weight="bold" />
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
                                                            <LogOutIcon size={14} weight="bold" />
                                                            יציאה
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {log.notes && (
                                        <div className="mt-3 mr-14 bg-amber-50/50 text-amber-900 text-[11px] p-2.5 rounded-xl border border-amber-100/30 flex items-start gap-2 font-bold leading-relaxed">
                                            <AlertTriangleIcon size={14} className="text-amber-500 shrink-0" weight="bold" />
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
