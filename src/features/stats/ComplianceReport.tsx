import React, { useMemo, useState } from 'react';
import { Person, Shift, TaskTemplate, Role, Absence, HourlyBlockage } from '../../types';
import { useComplianceViolations, Violation } from '../scheduling/hooks/useComplianceViolations';
import { Warning, Clock, UserFocus, CalendarX, CheckCircle, Info, SortAscending, SortDescending, Funnel, Shield } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import { ActionBar, ActionListItem } from '../../components/ui/ActionBar';
import { PageInfo } from '../../components/ui/PageInfo';

interface ComplianceReportProps {
    people: Person[];
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
}

type SortField = 'name' | 'date' | 'severity';
type SortOrder = 'asc' | 'desc';

import { DatePicker } from '../../components/ui/DatePicker';

export const ComplianceReport: React.FC<ComplianceReportProps> = ({
    people, shifts, tasks, roles, absences, hourlyBlockages
}) => {
    const [sortField, setSortField] = useState<SortField>('severity');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        return d.toISOString().split('T')[0];
    });

    const violations = useComplianceViolations(people, shifts, tasks, roles, absences, hourlyBlockages)
        .filter(v => v.person.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .filter(v => filterType === 'all' || v.type === filterType)
        .filter(v => filterSeverity === 'all' || v.severity === filterSeverity)
        .filter(v => {
            const vDate = new Date(v.timestamp);
            const startWindow = new Date(startDate);
            startWindow.setHours(0, 0, 0, 0);
            const endWindow = new Date(endDate);
            endWindow.setHours(23, 59, 59, 999);
            return vDate >= startWindow && vDate <= endWindow;
        })
        .sort((a, b) => {
            let comparison = 0;
            if (sortField === 'name') {
                comparison = a.person.name.localeCompare(b.person.name, 'he');
            } else if (sortField === 'date') {
                comparison = a.timestamp - b.timestamp;
            } else {
                const severityOrder = { high: 0, medium: 1, low: 2 };
                comparison = severityOrder[a.severity] - severityOrder[b.severity];
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    const handleExport = async () => {
        const headers = ['שם לוחם', 'סוג חריגה', 'חומרה', 'פרטים', 'תאריך', 'שעה', 'משימה'];
        const csvContent = violations.map(v => {
            const firstShift = v.shifts[0];
            const task = tasks.find(t => t.id === firstShift.taskId);
            const date = new Date(firstShift.startTime).toLocaleDateString('he-IL');
            const hour = new Date(firstShift.startTime).getHours() + ':00';

            return [
                v.person.name,
                v.type === 'rest_time' ? 'מנוחה' : v.type === 'role_mismatch' ? 'הסמכה' : 'התנגשות',
                v.severity === 'high' ? 'קריטי' : 'בינוני',
                v.details.replace(/,/g, ' '),
                date,
                hour,
                task?.name || 'לא ידוע'
            ].join(',');
        });

        const csvString = [headers.join(','), ...csvContent].join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `compliance_report_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const formatRoundedHour = (date: Date) => {
        const hour = date.getHours();
        return `${hour.toString().padStart(2, '0')}:00`;
    };

    return (
        <div className="space-y-6 relative pb-10">
            {/* Sticky Header Container */}
            <div className="sticky top-0 z-[100] bg-white/95 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all -mx-6 px-6 py-2">
                <ActionBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    isSearchExpanded={isSearchExpanded}
                    onSearchExpandedChange={setIsSearchExpanded}
                    onExport={handleExport}
                    className=""
                    leftActions={
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">דוח חריגות</h3>
                                    <PageInfo
                                        title="דוח חריגות"
                                        description={
                                            <>
                                                <p className="mb-2">כאן ניתן לראות את כל החריגות וההתראות בסידור העבודה.</p>
                                                <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                    <li><b>מנוחה:</b> חריגות בשעות מנוחה בין משמרות.</li>
                                                    <li><b>הסמכה:</b> שיבוץ ללא הסמכה מתאימה.</li>
                                                    <li><b>התנגשויות:</b> חפיפה עם היעדרויות מאושרות או חסימות.</li>
                                                </ul>
                                            </>
                                        }
                                    />
                                </div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                    ניהול ובקרה • {new Date().toLocaleDateString('he-IL')}
                                </p>
                            </div>

                            {/* Summary Badge */}
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100/50 shadow-sm ml-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">סה"כ</span>
                                <span className="text-lg font-black leading-none">{violations.length}</span>
                            </div>
                        </div>
                    }
                    rightActions={
                        <div className="flex items-center gap-2">
                            {/* Date Range - Desktop */}
                            <div className="hidden xl:flex items-center gap-2">
                                <DatePicker
                                    id="report-start-date"
                                    value={startDate}
                                    onChange={setStartDate}
                                    variant="compact"
                                    className="w-40"
                                />
                                <div className="text-slate-300">-</div>
                                <DatePicker
                                    id="report-end-date"
                                    value={endDate}
                                    onChange={setEndDate}
                                    variant="compact"
                                    className="w-40"
                                />
                            </div>

                            <div className="w-px h-6 bg-slate-200 mx-2 hidden xl:block" />

                            <div className="flex items-center gap-2 hidden md:flex">
                                <div title={sortOrder === 'asc' ? 'מיין בסדר יורד' : 'מיין בסדר עולה'}>
                                    <button
                                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                        className={`h-10 w-10 rounded-xl border transition-all flex items-center justify-center shadow-sm ${sortOrder === 'desc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                    >
                                        {sortOrder === 'asc' ? <SortAscending size={20} weight="bold" /> : <SortDescending size={20} weight="bold" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    }
                    filters={[
                        {
                            id: 'sortBy',
                            value: sortField,
                            onChange: (val) => setSortField(val as SortField),
                            placeholder: 'מיון לפי',
                            icon: SortAscending,
                            options: [
                                { value: 'severity', label: 'רמת חומרה' },
                                { value: 'date', label: 'תאריך ושעה' },
                                { value: 'name', label: 'שם הלוחם' }
                            ]
                        },
                        {
                            id: 'type',
                            value: filterType,
                            onChange: setFilterType,
                            placeholder: 'סוג חריגה',
                            icon: Funnel,
                            options: [
                                { value: 'all', label: 'כל הסוגים' },
                                { value: 'rest_time', label: 'חריגות מנוחה' },
                                { value: 'role_mismatch', label: 'חריגות הסמכה' },
                                { value: 'absence_conflict', label: 'התנגשויות לו"ז' }
                            ]
                        },
                        {
                            id: 'severity',
                            value: filterSeverity,
                            onChange: setFilterSeverity,
                            placeholder: 'חומרה',
                            icon: Shield,
                            options: [
                                { value: 'all', label: 'כל החומרות' },
                                { value: 'high', label: 'קריטי (אדום)' },
                                { value: 'medium', label: 'בינוני (צהוב)' }
                            ]
                        }
                    ]}
                    mobileMoreActions={
                        <div className="space-y-4 pt-2">
                            <ActionListItem
                                icon={sortOrder === 'asc' ? SortAscending : SortDescending}
                                label={`סדר מיון: ${sortOrder === 'asc' ? 'עולה' : 'יורד'}`}
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                color="bg-blue-50 text-blue-600"
                            />

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 px-1">טווח תאריכים</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <DatePicker
                                        id="mobile-start-date"
                                        value={startDate}
                                        onChange={setStartDate}
                                        variant="default"
                                        label="מתאריך"
                                        className="w-full"
                                    />
                                    <DatePicker
                                        id="mobile-end-date"
                                        value={endDate}
                                        onChange={setEndDate}
                                        variant="default"
                                        label="עד תאריך"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        </div>
                    }
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                {violations.length === 0 ? (
                    <div className="md:col-span-2 flex flex-col items-center justify-center p-12 md:p-24 bg-emerald-50/20 rounded-[3rem] border-2 border-emerald-100 border-dashed text-center">
                        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-inner animate-pulse mx-auto">
                            <CheckCircle size={56} className="text-emerald-500" weight="fill" />
                        </div>
                        <h4 className="text-2xl font-black text-emerald-800 mb-2 text-center">אין חריגות בלו"ז!</h4>
                        <p className="text-sm text-emerald-600 font-bold max-w-xs text-center leading-relaxed opacity-80 mx-auto">מצוין, השיבוץ הנוכחי תואם את כל הכללים וההגבלות.</p>
                    </div>
                ) : (
                    <>
                        {violations.map((v, idx) => (
                            <div key={`${v.id}-${idx}-${sortField}-${sortOrder}-${filterType}-${filterSeverity}`} className={`group bg-white rounded-[2rem] border-2 transition-all hover:shadow-2xl hover:-translate-y-1 overflow-hidden ${v.severity === 'high' ? 'border-red-50 hover:border-red-100 shadow-red-50/50' : 'border-slate-50 hover:border-slate-100'}`}>
                                <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-6">
                                    {/* Type Icon */}
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110 ${v.type === 'rest_time' ? 'bg-amber-100 text-amber-600' :
                                        v.type === 'role_mismatch' ? 'bg-indigo-100 text-indigo-600' :
                                            'bg-red-100 text-red-600'
                                        }`}>
                                        {v.type === 'rest_time' && <Clock size={32} weight="bold" />}
                                        {v.type === 'role_mismatch' && <UserFocus size={32} weight="bold" />}
                                        {v.type === 'absence_conflict' && <CalendarX size={32} weight="bold" />}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2.5 mb-2">
                                            <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full shadow-sm ${v.severity === 'high' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                                                {v.severity === 'high' ? 'קריטי' : 'בינוני'}
                                            </span>
                                            <h4 className="font-black text-slate-800 text-lg tracking-tight truncate">{v.person.name}</h4>
                                        </div>
                                        <p className="text-sm font-bold text-slate-500 leading-snug line-clamp-2">{v.details}</p>
                                    </div>

                                    {/* Shifts Minimal View */}
                                    <div className="shrink-0 flex sm:flex-col gap-2">
                                        {v.shifts.slice(0, 2).map(s => (
                                            <div key={s.id} className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 flex items-center gap-2">
                                                <div className="text-[10px] font-black text-blue-600">{formatRoundedHour(new Date(s.startTime))}</div>
                                                <div className="w-[2px] h-2 bg-slate-200" />
                                                <div className="text-[10px] font-bold text-slate-400 truncate max-w-[60px]">
                                                    {new Date(s.startTime).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}


            </div>
        </div>
    );
};
