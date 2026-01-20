import React, { useState } from 'react';
import { Person, Shift, TaskTemplate, Role, Absence, HourlyBlockage } from '@/types';
import { X, Warning, Clock, UserFocus, CalendarX, Info, Shield, CheckCircle, SortAscending, SortDescending } from '@phosphor-icons/react';
import { useComplianceViolations } from './hooks/useComplianceViolations';

interface ComplianceInsightsProps {
    people: Person[];
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
    selectedDate: Date;
    onClose: () => void;
    onPersonSelect?: (personId: string) => void;
}

type SortField = 'severity' | 'name' | 'date';

export const ComplianceInsights: React.FC<ComplianceInsightsProps> = ({
    people,
    shifts,
    tasks,
    roles,
    absences,
    hourlyBlockages,
    selectedDate,
    onClose,
    onPersonSelect,
}) => {
    const [sortField, setSortField] = useState<SortField>('severity');

    // Get violations relative to the selected date (time-wise)
    // The hook expects a Date object for filtering
    const violations = useComplianceViolations(people, shifts, tasks, roles, absences, hourlyBlockages, selectedDate);

    const highSeverityCount = violations.filter(v => v.severity === 'high').length;
    const mediumSeverityCount = violations.filter(v => v.severity === 'medium').length;

    const sortedViolations = [...violations].sort((a, b) => {
        if (sortField === 'name') {
            return a.person.name.localeCompare(b.person.name, 'he');
        } else if (sortField === 'date') {
            return a.timestamp - b.timestamp;
        } else {
            const severityOrder = { high: 0, medium: 1, low: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        }
    });

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="fixed top-16 bottom-0 left-0 z-[1000] w-96 bg-white/80 backdrop-blur-2xl border-r border-slate-200 shadow-2xl animate-in slide-in-from-left duration-500 overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white/50">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-red-50 text-red-600 shadow-sm border border-red-100">
                            <Shield size={24} weight="duotone" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">חריגות שיבוץ</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                לתאריך {selectedDate.toLocaleDateString('he-IL')} והלאה
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                    >
                        <X size={20} weight="bold" />
                    </button>
                </div>

                <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setSortField('severity')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortField === 'severity'
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        לפי חומרה
                    </button>
                    <button
                        onClick={() => setSortField('date')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortField === 'date'
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        לפי זמן
                    </button>
                    <button
                        onClick={() => setSortField('name')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${sortField === 'name'
                            ? 'bg-slate-800 text-white shadow-md'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        לפי שם
                    </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-red-50/50 rounded-xl border border-red-100/50">
                    <div className="text-center flex-1">
                        <span className="block text-xl font-black text-red-600 leading-none">{highSeverityCount}</span>
                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-tighter">קריטי</span>
                    </div>
                    <div className="h-8 w-px bg-red-100" />
                    <div className="text-center flex-1">
                        <span className="block text-xl font-black text-amber-600 leading-none">{mediumSeverityCount}</span>
                        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-tighter">בינוני</span>
                    </div>
                    <div className="h-8 w-px bg-red-100" />
                    <div className="text-center flex-1">
                        <span className="block text-xl font-black text-slate-700 leading-none">{violations.length}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">סה"כ</span>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                {sortedViolations.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-60">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4 border border-emerald-100">
                            <CheckCircle size={32} className="text-emerald-500" weight="bold" />
                        </div>
                        <p className="font-bold text-emerald-700">הלוח תקין!</p>
                        <p className="text-xs text-emerald-600">לא נמצאו חריגות מהמועד הנוכחי והלאה</p>
                    </div>
                ) : (
                    sortedViolations.map((v, idx) => (
                        <div
                            key={`${v.id}-${idx}`}
                            onClick={() => onPersonSelect?.(v.person.id)}
                            className={`group relative bg-white border rounded-2xl p-4 hover:shadow-xl transition-all duration-300 cursor-pointer ${v.severity === 'high' ? 'border-red-100 hover:border-red-200 shadow-red-500/5' : 'border-amber-100 hover:border-amber-200 shadow-amber-500/5'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Icon Type */}
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${v.type === 'rest_time' ? 'bg-amber-100 text-amber-600' :
                                    v.type === 'role_mismatch' ? 'bg-indigo-100 text-indigo-600' :
                                        'bg-red-100 text-red-600'
                                    }`}>
                                    {v.type === 'rest_time' && <Clock size={20} weight="bold" />}
                                    {v.type === 'role_mismatch' && <UserFocus size={20} weight="bold" />}
                                    {v.type === 'absence_conflict' && <CalendarX size={20} weight="bold" />}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors">{v.person.name}</h4>
                                        <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide ${v.severity === 'high' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                                            }`}>
                                            {v.severity === 'high' ? 'קריטי' : 'בינוני'}
                                        </div>
                                    </div>

                                    <p className="text-xs font-medium text-slate-500 leading-snug mb-2">
                                        {v.details}
                                    </p>

                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                        <Clock size={12} weight="bold" />
                                        <span>
                                            {new Date(v.timestamp).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })} • {formatTime(v.timestamp)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-white border border-slate-200">
                    <Info size={18} className="text-slate-400 shrink-0" weight="bold" />
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                        * מוצגות חריגות שהתרחשו החל מהזמן הנוכחי בלוח. חריגות עבר אינן מוצגות כאן אך מופיעות בדוח המלא.
                    </p>
                </div>
            </div>
        </div>
    );
};
