import React, { useMemo, useState } from 'react';
import { Person, Shift, TaskTemplate, Role, Absence, HourlyBlockage } from '../../types';
import { Warning, Clock, UserFocus, CalendarX, CheckCircle, Info, SortAscending, SortDescending, Funnel, Shield } from '@phosphor-icons/react';
import { ExportButton } from '../../components/ui/ExportButton';
import { ActionBar } from '../../components/ui/ActionBar';

interface ComplianceReportProps {
    people: Person[];
    shifts: Shift[];
    tasks: TaskTemplate[];
    roles: Role[];
    absences: Absence[];
    hourlyBlockages: HourlyBlockage[];
}

interface Violation {
    id: string;
    type: 'rest_time' | 'role_mismatch' | 'absence_conflict';
    person: Person;
    shifts: Shift[];
    details: string;
    severity: 'high' | 'medium' | 'low';
    timestamp: number;
}

type SortField = 'name' | 'date' | 'severity';
type SortOrder = 'asc' | 'desc';

export const ComplianceReport: React.FC<ComplianceReportProps> = ({
    people, shifts, tasks, roles, absences, hourlyBlockages
}) => {
    const [sortField, setSortField] = useState<SortField>('severity');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<string>('all');
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [isSearchExpanded, setIsSearchExpanded] = useState(false);

    const violations = useMemo(() => {
        const result: Violation[] = [];
        const activeShifts = shifts.filter(s => !s.isCancelled);

        people.forEach(person => {
            const personShifts = activeShifts
                .filter(s => s.assignedPersonIds.includes(person.id))
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

            // 1. Rest Time Violations
            for (let i = 0; i < personShifts.length - 1; i++) {
                const currentShift = personShifts[i];
                const nextShift = personShifts[i + 1];

                const currentTask = tasks.find(t => t.id === currentShift.taskId);
                const currentSegment = currentTask?.segments.find(s => s.id === currentShift.segmentId);
                const minRest = currentShift.requirements?.minRest ?? currentSegment?.minRestHoursAfter ?? 0;

                if (minRest > 0) {
                    const restEnd = new Date(currentShift.endTime);
                    const restNeededUntil = new Date(restEnd.getTime() + minRest * 60 * 60 * 1000);
                    const nextStart = new Date(nextShift.startTime);

                    if (nextStart < restNeededUntil) {
                        const actualRest = (nextStart.getTime() - restEnd.getTime()) / (1000 * 60 * 60);
                        result.push({
                            id: `rest-${currentShift.id}-${nextShift.id}`,
                            type: 'rest_time',
                            person,
                            shifts: [currentShift, nextShift],
                            details: `זמן מנוחה קצרה מדי: ${actualRest.toFixed(1)} שעות (נדרש ${minRest})`,
                            severity: actualRest < (minRest / 2) ? 'high' : 'medium',
                            timestamp: nextStart.getTime()
                        });
                    }
                }
            }

            // 2. Role Mismatch
            personShifts.forEach(shift => {
                const task = tasks.find(t => t.id === shift.taskId);
                const segment = task?.segments.find(s => s.id === shift.segmentId);
                const requirements = shift.requirements?.roleComposition ?? segment?.roleComposition ?? [];

                if (requirements.length > 0) {
                    const personRoles = person.roleIds || (person.roleId ? [person.roleId] : []);
                    const hasRequiredRole = requirements.some(req => personRoles.includes(req.roleId));

                    if (!hasRequiredRole) {
                        const requiredRoleNames = requirements
                            .map(req => roles.find(r => r.id === req.roleId)?.name)
                            .filter(Boolean)
                            .join(' או ');

                        result.push({
                            id: `role-${shift.id}-${person.id}`,
                            type: 'role_mismatch',
                            person,
                            shifts: [shift],
                            details: `חוסר התאמה להסמכה: דורש [${requiredRoleNames}]`,
                            severity: 'high',
                            timestamp: new Date(shift.startTime).getTime()
                        });
                    }
                }
            });

            // 3. Absence Conflicts
            personShifts.forEach(shift => {
                const sStart = new Date(shift.startTime);
                const sEnd = new Date(shift.endTime);

                const conflictAbsence = absences.find(a => {
                    if (a.person_id !== person.id || a.status !== 'approved') return false;
                    const aStart = new Date(`${a.start_date}T${a.start_time || '00:00'}`);
                    const aEnd = new Date(`${a.end_date}T${a.end_time || '23:59'}`);
                    return sStart < aEnd && sEnd > aStart;
                });

                if (conflictAbsence) {
                    result.push({
                        id: `absence-${shift.id}-${conflictAbsence.id}`,
                        type: 'absence_conflict',
                        person,
                        shifts: [shift],
                        details: `התנגשות עם היעדרות: ${conflictAbsence.reason || 'חופשה'}`,
                        severity: 'high',
                        timestamp: sStart.getTime()
                    });
                }

                const conflictBlockage = hourlyBlockages.find(b => {
                    if (b.person_id !== person.id) return false;
                    const bStart = new Date(`${b.date}T${b.start_time}`);
                    const bEnd = new Date(`${b.date}T${b.end_time}`);
                    return sStart < bEnd && sEnd > bStart;
                });

                if (conflictBlockage) {
                    result.push({
                        id: `blockage-${shift.id}-${conflictBlockage.id}`,
                        type: 'absence_conflict',
                        person,
                        shifts: [shift],
                        details: `התנגשות עם חסימה שעתית: ${conflictBlockage.reason || 'חסימה'}`,
                        severity: 'high',
                        timestamp: sStart.getTime()
                    });
                }
            });
        });

        return [...result]
            .filter(v => v.person.name.toLowerCase().includes(searchTerm.toLowerCase()))
            .filter(v => filterType === 'all' || v.type === filterType)
            .filter(v => filterSeverity === 'all' || v.severity === filterSeverity)
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
    }, [people, shifts, tasks, roles, absences, hourlyBlockages, sortField, sortOrder, searchTerm, filterType, filterSeverity]);

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
        link.setAttribute('download', `compliance_report_${new Date().toISOString().split('T')[0]}.csv`);
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
            <div className="sticky top-0 z-[100] -mx-4 px-4 py-3 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 shadow-sm transition-all">
                <ActionBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    isSearchExpanded={isSearchExpanded}
                    onSearchExpandedChange={setIsSearchExpanded}
                    className="bg-white/50 p-2 rounded-[1.5rem] border border-slate-200"
                    leftActions={
                        <div className="flex items-center gap-4">
                            {/* Summary Badge - ABSOLUTE RIGHT in RTL */}
                            <div className="px-5 py-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-center shadow-lg shadow-blue-100 min-w-[90px] group transition-transform hover:scale-105">
                                <div className="text-[10px] font-black text-blue-100 uppercase tracking-tighter leading-none mb-1 opacity-80">סה"כ</div>
                                <div className="text-xl font-black text-white leading-none">{violations.length}</div>
                            </div>

                            <div className="hidden sm:flex flex-col border-r border-slate-200 pr-4">
                                <h3 className="text-lg font-black text-slate-800 tracking-tight leading-none">דוח חריגות</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">סריקה אוטומטית • {new Date().toLocaleDateString('he-IL')}</p>
                            </div>
                        </div>
                    }
                    rightActions={
                        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-2xl border border-slate-200/50">
                            {/* Grouped Action Buttons */}
                            <ExportButton
                                onExport={handleExport}
                                iconOnly
                                className="h-10 w-10 border border-slate-200 bg-white text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all flex items-center justify-center shadow-sm rounded-xl"
                                title="ייצוא לאקסל"
                            />

                            <div className="w-[1px] h-6 bg-slate-200 mx-1" />

                            <button
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                className={`h-10 w-10 rounded-xl border transition-all flex items-center justify-center shadow-sm ${sortOrder === 'desc' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                title={sortOrder === 'asc' ? 'מיין בסדר יורד' : 'מיין בסדר עולה'}
                            >
                                {sortOrder === 'asc' ? <SortAscending size={20} weight="bold" /> : <SortDescending size={20} weight="bold" />}
                            </button>
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
                />
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                {violations.length === 0 ? (
                    <div className="md:col-span-2 flex flex-col items-center justify-center p-24 bg-emerald-50/20 rounded-[3rem] border-2 border-emerald-100 border-dashed">
                        <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                            <CheckCircle size={56} className="text-emerald-500" weight="fill" />
                        </div>
                        <h4 className="text-2xl font-black text-emerald-800 mb-2">אין חריגות בלו"ז!</h4>
                        <p className="text-sm text-emerald-600 font-bold max-w-xs text-center leading-relaxed opacity-80">מצוין, השיבוץ הנוכחי תואם את כל הכללים וההגבלות.</p>
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

                {/* Info Box - Always span full width at bottom */}
                <div className="md:col-span-2 bg-gradient-to-br from-slate-800 to-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl mt-4">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
                    <div className="relative flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-right">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner backdrop-blur-md">
                            <Info size={28} className="text-blue-400" weight="bold" />
                        </div>
                        <div>
                            <h4 className="text-xl font-black mb-2 tracking-tight">מידע על ניהול חריגות</h4>
                            <p className="text-sm text-slate-400 font-bold leading-relaxed max-w-xl">
                                המערכת סורקת באופן רציף את כל השיבוצים לאיתור הפרות של חוקי המנוחה, חוסר התאמות לתפקיד וסתירות עם היעדרויות מאושרות.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
