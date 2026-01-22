import React, { useEffect, useState } from 'react';
import { X, ClockCounterClockwise, User as UserIcon, Calendar, ArrowRight, CaretRight, CaretLeft } from '@phosphor-icons/react';
import { AuditLog, fetchAttendanceLogs, subscribeToAuditLogs } from '@/services/auditService';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface ActivityFeedProps {
    onClose: () => void;
    organizationId: string;
    onLogClick?: (log: AuditLog) => void;
    logs: AuditLog[];
    isLoading: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = React.memo(({ onClose, organizationId, onLogClick, logs, isLoading }) => {

    // State and fetching moved to AttendanceManager for caching/performance


    const formatLogMessage = (log: AuditLog) => {
        const userName = log.user_name || 'מערכת';

        // --- Handle Scheduling Logs (Shifts) ---
        if (log.entity_type === 'shift') {
            const personName = log.metadata?.personName || 'חייל';
            const action = log.event_type; // ASSIGN, UNASSIGN

            if (action === 'ASSIGN') {
                return (
                    <div className="flex flex-col gap-1 w-full">
                        <div className="text-right text-xs leading-relaxed text-slate-600">
                            <span className="font-black text-slate-900">{userName}</span>
                            <span> שיבץ את </span>
                            <span className="font-black text-slate-900">{personName}</span>
                            <span> למשמרת</span>
                        </div>
                        {log.metadata?.taskName && (
                            <div className="flex items-center gap-2 mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100/50">
                                <div className="w-1 h-3 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-bold text-slate-700">{log.metadata.taskName}</span>
                                {(log.metadata.startTime && log.metadata.endTime) && (
                                    <span className="text-[9px] text-black font-black font-mono border-r border-slate-200 pr-2 mr-auto" dir="ltr">
                                        {format(new Date(log.metadata.startTime), 'HH:mm')} - {format(new Date(log.metadata.endTime), 'HH:mm')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            } else if (action === 'UNASSIGN') {
                return (
                    <div className="flex flex-col gap-1 w-full">
                        <div className="text-right text-xs leading-relaxed text-slate-600">
                            <span className="font-black text-slate-900">{userName}</span>
                            <span> הסיר את </span>
                            <span className="font-black text-slate-900">{personName}</span>
                            <span> מהמשמרת</span>
                        </div>
                        {log.metadata?.taskName && (
                            <div className="flex items-center gap-2 mt-1 bg-red-50 p-1.5 rounded-lg border border-red-100/50">
                                <div className="w-1 h-3 rounded-full bg-red-500"></div>
                                <span className="text-[10px] font-bold text-slate-700 line-through decoration-red-500/50">{log.metadata.taskName}</span>
                                {(log.metadata.startTime && log.metadata.endTime) && (
                                    <span className="text-[9px] text-black font-black font-mono border-r border-red-200 pr-2 mr-auto" dir="ltr">
                                        {format(new Date(log.metadata.startTime), 'HH:mm')} - {format(new Date(log.metadata.endTime), 'HH:mm')}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                );
            } else {
                return (
                    <div className="text-right text-xs leading-relaxed text-slate-600">
                        <span className="font-black text-slate-900">{userName}</span>
                        <span> {log.action_description}</span>
                    </div>
                );
            }
        }

        // --- Handle Attendance Logs (Default) ---
        const soldierName = log.entity_name || log.metadata?.entity_name || 'חייל';
        const oldVal = log.before_data || 'לא ידוע';
        const newVal = log.after_data || 'לא ידוע';

        // Translate status values for user friendly display
        const translateStatus = (status: any, currentLog: AuditLog) => {
            if (typeof status !== 'string') return JSON.stringify(status);

            const map: Record<string, string> = {
                'base': 'בסיס',
                'home': 'בית',
                'full': 'בסיס (יום שלם)',
                'arrival': 'הגעה',
                'departure': 'יציאה',
                'unavailable': 'אילוץ',
                'leave_shamp': 'חופשה בשמפ',
                'gimel': "ג'",
                'absent': 'נפקד',
                'organization_days': 'ימי התארגנות',
                'not_in_shamp': 'לא בשמ"פ'
            };

            // 1. If it's a direct key, translate it
            if (map[status]) return map[status];

            // 2. If it's a complex string like "בית (absent)", translate the content inside brackets
            let translated = status;

            // Handle the homeStatusType from metadata if the status is generic or missing part
            const hType = currentLog.metadata?.homeStatusType;
            if (hType && (status === 'home' || status === 'בית')) {
                return `בית (${map[hType] || hType})`;
            }

            // Regex to find content inside parentheses (e.g., "(absent)") and translate if it's a key
            translated = translated.replace(/\(([^)]+)\)/g, (match: string, p1: string) => {
                const key = p1.trim();
                return `(${map[key] || key})`;
            });

            // Replace top-level generic terms
            Object.entries(map).forEach(([key, val]) => {
                if (translated === key) translated = val;
            });

            return translated;
        };

        return (
            <div className="text-right text-xs leading-relaxed text-slate-600">
                <span className="font-black text-slate-900">{userName}</span>
                <span> שינה את הערך מ-</span>
                <span className="font-bold text-blue-600/80">{translateStatus(oldVal, log)}</span>
                <span> ל-</span>
                <span className="font-bold text-emerald-600/80">{translateStatus(newVal, log)}</span>
                <span> עבור החייל </span>
                <span className="font-black text-slate-900">{soldierName}</span>
            </div>
        );
    };

    return (
        <div className="fixed top-[8.5rem] md:top-16 bottom-0 right-0 w-full md:w-96 bg-white/80 backdrop-blur-2xl border-l border-slate-200 flex flex-col h-[calc(100%-8.5rem)] md:h-[calc(100%-64px)] shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] z-[9999] animate-in slide-in-from-right duration-500 overflow-hidden" dir="rtl">
            {/* Header */}
            <div className="p-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <ClockCounterClockwise size={18} weight="bold" />
                    </div>
                    <h3 className="font-black text-slate-800 tracking-tight text-sm md:text-base">היסטוריית שינויים</h3>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                >
                    <X size={20} weight="bold" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 md:p-3 space-y-3">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold">טוען פעולות...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400 opacity-60">
                        <ClockCounterClockwise size={32} weight="thin" />
                        <span className="text-xs font-bold">אין היסטוריה זמינה</span>
                    </div>
                ) : (
                    logs.map((log) => (
                        <div
                            key={log.id}
                            onClick={() => onLogClick?.(log)}
                            className={`p-3 bg-white/40 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-white hover:shadow-sm transition-all group ${onLogClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">
                                    {format(new Date(log.created_at), 'HH:mm • dd/MM', { locale: he })}
                                </span>
                                <div className="w-2 h-2 rounded-full bg-blue-100 group-hover:bg-blue-400 transition-colors" />
                            </div>
                            {formatLogMessage(log)}
                            {log.metadata?.date && (
                                <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-lg w-fit">
                                    <Calendar size={12} weight="bold" />
                                    <span>תאריך: {log.metadata.date}</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
});
