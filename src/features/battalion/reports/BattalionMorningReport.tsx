import React, { useState, useMemo } from 'react';
import { CaretRight, ChartLineUp, Warning, Users, Buildings, ArrowDown, CaretLeftIcon, House as Home } from '@phosphor-icons/react';
import { useBattalionData } from '../../../hooks/useBattalionData';
import { useBattalionSnapshots } from '../../../hooks/useBattalionSnapshots';
import { getEffectiveAvailability } from '../../../utils/attendanceUtils';
import { ActionBar } from '../../../components/ui/ActionBar';
import { PageInfo } from '../../../components/ui/PageInfo';
import { useActivityLogs } from '../../../hooks/useActivityLogs';
import { AuditLog } from '../../../services/auditService';
import { format, parseISO, isAfter } from 'date-fns';
import { he } from 'date-fns/locale';
import { ClockCounterClockwise } from '@phosphor-icons/react';

interface BattalionMorningReportProps {
    battalionId?: string | null;
}

export const BattalionMorningReport: React.FC<BattalionMorningReportProps> = ({ battalionId }) => {
    // defaults to today
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

    // Fetch Data
    const {
        companies,
        people: currentSoldiers,
        presenceSummary,
        teamRotations = [],
        absences = [],
        hourlyBlockages = [],
        isLoading: loadingCurrent,
        battalion
    } = useBattalionData(battalionId, selectedDate);

    const {
        snapshots,
        loading: loadingSnapshots
    } = useBattalionSnapshots(selectedDate, companies);

    // Memoize filters to prevent infinite loops and unnecessary re-renders
    const activityFilters = useMemo(() => ({
        date: selectedDate,
        createdDate: selectedDate,
        limit: 200
    }), [selectedDate]);

    // Collect all company IDs for log fetching
    const allOrgIds = useMemo(() => {
        if (!battalionId) return [];
        const ids = [battalionId]; // Include battalion HQ
        companies.forEach(c => {
            if (c.id !== battalionId) ids.push(c.id);
        });
        return ids;
    }, [battalionId, companies]);

    // Fetch Activity Logs
    const {
        logs: rawLogs,
        isLoading: loadingLogs
    } = useActivityLogs({
        organizationId: allOrgIds,
        entityTypes: ['attendance'],
        initialFilters: activityFilters
    });

    const isLoading = loadingCurrent || loadingSnapshots || loadingLogs || (!!battalionId && !currentSoldiers);

    if (!battalionId) {
        return (
            <div className="bg-slate-50 md:bg-white rounded-[2rem] border md:border-slate-100 p-0 relative flex flex-col items-center justify-center text-slate-400">
                <Warning size={48} className="mb-4 opacity-20" />
                <span className="text-lg font-medium">לא נמצא גדוד מקושר למשתמש זה.</span>
            </div>
        );
    }

    // Computed Logic: Diffing & Logs
    const reportData = useMemo(() => {
        if (isLoading || !currentSoldiers) return null;

        const statsByCompany: Record<string, { total: number, presentDetails: number, changes: number }> = {};
        const logsByCompany: Record<string, AuditLog[]> = {};

        companies.forEach(company => {
            statsByCompany[company.id] = { total: 0, presentDetails: 0, changes: 0 };
            logsByCompany[company.id] = [];
        });

        // Determine morning report time (threshold for changes)
        const reportTimeStr = battalion?.morning_report_time || '09:00';
        const [hours, minutes] = reportTimeStr.split(':').map(Number);

        // threshold is today's report time
        const thresholdDate = new Date(selectedDate);
        thresholdDate.setHours(hours, minutes, 0, 0);

        // Map snapshots for fast lookup
        const snapshotMap = new Map(snapshots.map(s => [`${s.person_id}`, s]));
        const hasSnapshots = snapshots.length > 0;
        const targetDate = new Date(selectedDate);
        const SECTOR_STATUSES = ['base', 'full', 'arrival', 'departure'];

        // Process Logs
        rawLogs.forEach(log => {
            const logTime = parseISO(log.created_at);
            if (isAfter(logTime, thresholdDate)) {
                // Find which company this soldier belongs to
                const personId = log.entity_id || log.metadata?.personId;
                const soldier = currentSoldiers.find(p => p.id === personId);
                if (soldier && soldier.organization_id && logsByCompany[soldier.organization_id]) {
                    logsByCompany[soldier.organization_id].push(log);
                    statsByCompany[soldier.organization_id].changes++;
                }
            }
        });

        // Iterate current soldiers for presence stats
        currentSoldiers.forEach(soldier => {
            if (soldier.isActive === false) return;

            const companyId = soldier.organization_id!;
            if (!statsByCompany[companyId]) return;

            statsByCompany[companyId].total++;

            const avail = getEffectiveAvailability(soldier, targetDate, teamRotations, absences, hourlyBlockages);
            if (SECTOR_STATUSES.includes(avail.status)) {
                statsByCompany[companyId].presentDetails++;
            }
        });

        return { statsByCompany, logsByCompany, hasSnapshots, thresholdDate };
    }, [isLoading, companies, currentSoldiers, snapshots, teamRotations, absences, hourlyBlockages, selectedDate, rawLogs, battalion?.morning_report_time]);


    const getStatusLabel = (status: string) => {
        if (!status) return { label: 'לא ידוע', color: 'bg-slate-100 text-slate-500' };

        const map: Record<string, string> = {
            'base': 'בבסיס',
            'full': 'בבסיס',
            'home': 'בבית',
            'arrival': 'הגעה',
            'departure': 'יציאה',
            'leave': 'חופש',
            'mission': 'משימה',
            'unavailable': 'אילוץ',
            'leave_shamp': 'חופשה בשמפ',
            'gimel': "ג'",
            'absent': 'נפקד',
            'organization_days': 'ימי התארגנות',
            'not_in_shamp': 'לא בשמ"פ'
        };

        const label = map[status] || status;

        switch (status) {
            case 'base':
            case 'full': return { label, color: 'bg-emerald-100 text-emerald-700' };
            case 'home': return { label, color: 'bg-slate-100 text-slate-600' };
            case 'arrival': return { label, color: 'bg-blue-100 text-blue-700' };
            case 'departure': return { label, color: 'bg-amber-100 text-amber-700' };
            case 'leave':
            case 'leave_shamp':
            case 'gimel': return { label, color: 'bg-amber-100 text-amber-700' };
            case 'mission': return { label, color: 'bg-blue-100 text-blue-700' };
            case 'absent': return { label, color: 'bg-rose-100 text-rose-700' };
            default: return { label, color: 'bg-slate-100 text-slate-500' };
        }
    }

    const translateStatus = (status: any, log: AuditLog) => {
        if (typeof status !== 'string') return JSON.stringify(status);
        const map: Record<string, string> = {
            'base': 'בסיס', 'home': 'בית', 'full': 'בסיס (יום שלם)', 'arrival': 'הגעה', 'departure': 'יציאה',
            'unavailable': 'אילוץ', 'leave_shamp': 'חופשה בשמפ', 'gimel': "ג'", 'absent': 'נפקד',
            'organization_days': 'ימי התארגנות', 'not_in_shamp': 'לא בשמ"פ'
        };
        if (map[status]) return map[status];
        let translated = status;
        const hType = log.metadata?.homeStatusType;
        if (hType && (status === 'home' || status === 'בית')) return `בית (${map[hType] || hType})`;
        translated = translated.replace(/\(([^)]+)\)/g, (match: string, p1: string) => {
            const key = p1.trim();
            return `(${map[key] || key})`;
        });
        Object.entries(map).forEach(([key, val]) => {
            if (translated === key) translated = val;
        });
        return translated;
    };

    if (isLoading) {
        return (
            <div className="bg-slate-50 md:bg-white rounded-[2rem] border md:border-slate-100 p-0 relative flex flex-col items-center justify-center text-slate-400">
                <ChartLineUp size={48} className="animate-pulse mb-4 opacity-20" />
                <span className="text-lg font-medium">טוען נתוני דוח בוקר...</span>
            </div>
        );
    }

    const hasSnapshots = !!reportData?.hasSnapshots;
    const totalPresent = Object.values(reportData?.statsByCompany || {}).reduce((acc, curr) => acc + curr.presentDetails, 0);
    const totalChanges = Object.values(reportData?.logsByCompany || {}).reduce((acc, curr) => acc + curr.length, 0);

    // Determine the nature of the data based on the date
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = selectedDate === todayStr;
    const isFuture = selectedDate > todayStr;
    const presenceLabel = 'נוכחים בגזרה';
    const totalHome = Object.values(reportData?.statsByCompany || {}).reduce((acc, curr) => acc + (curr.total - curr.presentDetails), 0);

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-hidden">
            {/* Unified Action Bar */}
            <ActionBar
                searchTerm=""
                onSearchChange={() => { }}
                isSearchHidden={true}
                variant="unified"
                className="px-4 md:px-6 sticky top-0"
                leftActions={
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col min-w-0">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight truncate">דוח שינויים דוח 1</h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">השוואת שינויים יומי</span>
                        </div>
                    </div>
                }
                rightActions={
                    <div className="flex items-center gap-2 h-9">
                        <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest pl-2 border-l border-slate-200">תאריך דוח</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none font-bold text-slate-700 outline-none text-sm h-full"
                        />
                    </div>
                }
            />

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-slate-50/30">
                <div className="flex flex-col gap-8 max-w-7xl mx-auto">
                    {/* Stats Cards - Compact & Styled */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
                            <div className="absolute left-0 top-0 h-full w-1 bg-indigo-500" />
                            <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">{presenceLabel}</span>
                                <span className="text-3xl font-black text-slate-900">{totalPresent}</span>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Users size={24} weight="fill" />
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group">
                            <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
                            <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">נמצאים בבית</span>
                                <span className="text-3xl font-black text-slate-900">{totalHome}</span>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Home size={24} weight="fill" />
                            </div>
                        </div>

                        <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group ${(!hasSnapshots && totalChanges === 0) ? 'opacity-60' : ''}`}>
                            <div className={`absolute left-0 top-0 h-full w-1 ${(!hasSnapshots && totalChanges === 0) ? 'bg-slate-300' : 'bg-amber-500'}`} />
                            <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">שינויים מהבוקר</span>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-3xl font-black ${(!hasSnapshots && totalChanges === 0) ? 'text-slate-300' : 'text-slate-900'}`}>{hasSnapshots || totalChanges > 0 ? totalChanges : 'אין דוח'}</span>
                                    {(hasSnapshots || totalChanges > 0) && (
                                        <span className="text-xs font-bold text-slate-400">חיילים ששינו סטטוס</span>
                                    )}
                                </div>
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${(!hasSnapshots && totalChanges === 0) ? 'bg-slate-50 text-slate-300' : 'bg-amber-50 text-amber-600'}`}>
                                <ArrowDown size={24} weight="fill" />
                            </div>
                        </div>
                    </div>

                    {!hasSnapshots && (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 flex items-start gap-4 text-amber-900 shadow-sm">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                                <Warning size={22} weight="fill" className="text-amber-600" />
                            </div>
                            <div className="space-y-1">
                                <p className="font-black text-base">לא בוצע צילום מצב הבוקר ({battalion?.morning_report_time || '09:00'})</p>
                                <p className="text-sm font-medium opacity-80 leading-relaxed">
                                    כדי להציג שינויים ודיוור בין הבוקר לעכשיו, המערכת חייבת לשמור "צילום" של הסטטוסים בשעה המוגדרת.
                                    <br />
                                    מכיוון שהצילום לא התקיים, מוצגת כרגע <strong>נוכחות עדכנית בלבד</strong> ללא השוואת שינויים.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Company List Table */}
                    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center text-xs font-black text-slate-400 uppercase tracking-widest">
                            <div className="flex-1">פלוגה</div>
                            <div className="w-32 text-center">נוכחים</div>
                            <div className="w-32 text-center">שינויים</div>
                            <div className="w-10"></div>
                        </div>

                        <div className="divide-y divide-slate-100">
                            {companies.length === 0 ? (
                                <div className="p-12 text-center text-slate-400">
                                    <Buildings size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="font-bold">לא נמצאו פלוגות תחת הגדוד.</p>
                                    <p className="text-sm">וודא שהפלוגות מקושרות למזהה הגדוד הנכון.</p>
                                </div>
                            ) : [...companies].sort((a, b) => a.name.localeCompare(b.name)).map(company => {
                                const stats = reportData?.statsByCompany[company.id];
                                const companyLogs = reportData?.logsByCompany[company.id] || [];
                                const hasChanges = companyLogs.length > 0;
                                const isExpanded = expandedCompany === company.id;

                                return (
                                    <div key={company.id} className="group transition-colors hover:bg-slate-50/50">
                                        <div
                                            className={`px-6 py-4 flex items-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                            onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                                        >
                                            <div className="flex-1 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700">
                                                    <Buildings size={20} weight="bold" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-900 text-sm">{company.name}</div>
                                                    <div className="text-xs text-slate-500">{stats?.total || 0} חיילים</div>
                                                </div>
                                            </div>

                                            <div className="w-32 flex justify-center">
                                                <div className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-700 min-w-[3rem] text-center">
                                                    {stats?.presentDetails || 0}
                                                </div>
                                            </div>

                                            <div className="w-32 flex justify-center">
                                                {hasChanges ? (
                                                    <div className="bg-amber-50 px-3 py-1 rounded-full text-xs font-bold text-amber-700 flex items-center gap-1">
                                                        <Warning size={12} weight="fill" />
                                                        {stats?.changes}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs font-bold text-slate-300">-</div>
                                                )}
                                            </div>

                                            <div className="w-10 flex justify-end">
                                                <CaretRight
                                                    size={16}
                                                    weight="bold"
                                                    className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-indigo-500' : ''}`}
                                                />
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-300">
                                                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                                                    {!hasChanges ? (
                                                        <div className="p-8 text-center text-slate-400 text-sm font-bold">
                                                            אין שינויי סטטוס בפלוגה זו מאז הבוקר ({battalion?.morning_report_time || '09:00'}).
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-slate-100">
                                                            {companyLogs.map((log, idx) => {
                                                                const isLast = idx === companyLogs.length - 1;
                                                                const logTime = parseISO(log.created_at);

                                                                // Name Resolution
                                                                const personId = log.entity_id || log.metadata?.personId;
                                                                const soldier = currentSoldiers?.find(p => p.id === personId);
                                                                const displayName = log.entity_name || soldier?.name || 'חייל לא ידוע';

                                                                return (
                                                                    <div key={log.id} className={`group relative flex gap-3 pr-4 pl-4 py-3 transition-colors hover:bg-white hover:shadow-sm ${!isLast ? 'border-b border-slate-50' : ''}`}>
                                                                        {/* Timeline Line */}
                                                                        <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-slate-50 group-hover:bg-indigo-300 transition-colors" />

                                                                        {/* User Avatar */}
                                                                        <div className="mt-1.5 shrink-0 z-10 -mr-[1.1rem]">
                                                                            <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center shadow-sm group-hover:border-indigo-200 group-hover:text-indigo-600 transition-colors text-[10px] font-black text-slate-400">
                                                                                {log.user_name ? log.user_name.charAt(0) : 'S'}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                                            {/* Header: Name & Metadata */}
                                                                            <div className="flex flex-col gap-0.5">
                                                                                <span className="font-black text-slate-800 text-sm truncate">{displayName}</span>

                                                                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                                                                                    <span className="truncate max-w-[150px]">עודכן ע"י {log.user_name || 'מערכת'}</span>
                                                                                    <span className="w-1 h-1 rounded-full bg-slate-200" />
                                                                                    <span>שעת עריכה: <span className="font-bold font-mono text-slate-500">{format(logTime, 'HH:mm')}</span></span>
                                                                                </div>
                                                                            </div>

                                                                            {/* Status Change Badges */}
                                                                            <div className="flex items-center gap-2 mt-1">
                                                                                {/* Old Status */}
                                                                                <div className={`px-2 py-0.5 rounded-md text-[11px] font-bold border opacity-60 grayscale filter ${getStatusLabel(log.before_data).color.replace('bg-', 'bg-white border-')}`}>
                                                                                    <span className="line-through decoration-slate-400/50">{translateStatus(log.before_data, log)}</span>
                                                                                </div>

                                                                                <CaretLeftIcon size={12} weight="bold" className="text-slate-300" />

                                                                                {/* New Status */}
                                                                                <div className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border shadow-sm flex items-center gap-1.5 ${getStatusLabel(log.after_data).color.replace('text-', 'border-transparent text-')}`}>
                                                                                    <div className={`w-1.5 h-1.5 rounded-full bg-current opacity-50`} />
                                                                                    {translateStatus(log.after_data, log)}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
