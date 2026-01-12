import React, { useState, useMemo } from 'react';
import { CaretRight, ChartLineUp, Warning, Users, Buildings, ArrowDown, CaretLeftIcon, House as Home } from '@phosphor-icons/react';
import { useBattalionData } from '../../../hooks/useBattalionData';
import { useBattalionSnapshots } from '../../../hooks/useBattalionSnapshots';
import { getEffectiveAvailability } from '../../../utils/attendanceUtils';
import { ActionBar } from '../../../components/ui/ActionBar';
import { PageInfo } from '../../../components/ui/PageInfo';

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

    const isLoading = loadingCurrent || loadingSnapshots || (!!battalionId && !currentSoldiers);

    if (!battalionId) {
        return (
            <div className="bg-slate-50 md:bg-white rounded-[2rem] shadow-xl md:shadow-portal border md:border-slate-100 p-0 h-[85vh] md:h-[calc(100vh-140px)] relative overflow-hidden flex flex-col items-center justify-center text-slate-400">
                <Warning size={48} className="mb-4 opacity-20" />
                <span className="text-lg font-medium">לא נמצא גדוד מקושר למשתמש זה.</span>
            </div>
        );
    }

    // Computed Logic: Diffing
    const reportData = useMemo(() => {
        if (isLoading || !currentSoldiers) return null;

        const changes: any[] = [];
        const statsByCompany: Record<string, { total: number, presentDetails: number, changes: number }> = {};

        companies.forEach(company => {
            statsByCompany[company.id] = { total: 0, presentDetails: 0, changes: 0 };
        });

        // Map snapshots for fast lookup
        const snapshotMap = new Map(snapshots.map(s => [`${s.person_id}`, s]));

        // Check if we have snapshots for this date
        const hasSnapshots = snapshots.length > 0;
        const targetDate = new Date(selectedDate);
        const SECTOR_STATUSES = ['base', 'full', 'arrival', 'departure'];

        // Iterate current soldiers to find changes or additions
        currentSoldiers.forEach(soldier => {
            if (soldier.isActive === false) return;

            const companyId = soldier.organization_id!;
            if (!statsByCompany[companyId]) return;

            statsByCompany[companyId].total++;

            // Resolve current status using Effective Availability (Synchronized with Log/Dashboard)
            const avail = getEffectiveAvailability(soldier, targetDate, teamRotations, absences, hourlyBlockages);
            const currentStatus = avail.status;

            if (SECTOR_STATUSES.includes(currentStatus)) {
                statsByCompany[companyId].presentDetails++;
            }

            // Only calculate changes if we actually have a snapshot to compare to
            if (hasSnapshots) {
                const snapshot = snapshotMap.get(soldier.id);
                // Snapshots status uses simple labels: 'base', 'home', 'leave', 'mission'
                // We normalize currentStatus for comparison
                const normalizedCurrent = (currentStatus === 'base' || currentStatus === 'full' || currentStatus === 'arrival' || currentStatus === 'departure') ? 'base' : currentStatus;

                const snapshotStatus = snapshot ? snapshot.status : 'home';

                if (snapshotStatus !== normalizedCurrent) {
                    statsByCompany[companyId].changes++;
                    changes.push({
                        soldier,
                        company: companies.find(c => c.id === companyId),
                        from: snapshotStatus,
                        to: normalizedCurrent
                    });
                }
            }
        });

        return { statsByCompany, changes, hasSnapshots };
    }, [isLoading, companies, currentSoldiers, snapshots, teamRotations, absences, hourlyBlockages, selectedDate]);


    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'base':
            case 'full': return { label: 'בבסיס', color: 'bg-emerald-100 text-emerald-700' };
            case 'home': return { label: 'בבית', color: 'bg-slate-100 text-slate-600' };
            case 'arrival': return { label: 'הגעה', color: 'bg-blue-100 text-blue-700' };
            case 'departure': return { label: 'יציאה', color: 'bg-amber-100 text-amber-700' };
            case 'leave': return { label: 'חופש', color: 'bg-amber-100 text-amber-700' };
            case 'mission': return { label: 'משימה', color: 'bg-blue-100 text-blue-700' };
            default: return { label: status, color: 'bg-slate-100 text-slate-500' };
        }
    }

    if (isLoading) {
        return (
            <div className="bg-slate-50 md:bg-white rounded-[2rem] shadow-xl md:shadow-portal border md:border-slate-100 p-0 h-[85vh] md:h-[calc(100vh-140px)] relative overflow-hidden flex flex-col items-center justify-center text-slate-400">
                <ChartLineUp size={48} className="animate-pulse mb-4 opacity-20" />
                <span className="text-lg font-medium">טוען נתוני דוח בוקר...</span>
            </div>
        );
    }

    const hasSnapshots = !!reportData?.hasSnapshots;
    const totalPresent = Object.values(reportData?.statsByCompany || {}).reduce((acc, curr) => acc + curr.presentDetails, 0);
    const totalChanges = reportData?.changes.length || 0;

    // Determine the nature of the data based on the date
    const todayStr = new Date().toISOString().split('T')[0];
    const isToday = selectedDate === todayStr;
    const isFuture = selectedDate > todayStr;
    const presenceLabel = 'נוכחים בגזרה';
    const totalHome = Object.values(reportData?.statsByCompany || {}).reduce((acc, curr) => acc + (curr.total - curr.presentDetails), 0);

    return (
        <div className="bg-slate-50 md:bg-white rounded-[2rem] shadow-xl md:shadow-portal border md:border-slate-100 p-0 h-[85vh] md:h-[calc(100vh-140px)] relative overflow-hidden flex flex-col">
            {/* Unified Action Bar */}
            <ActionBar
                searchTerm=""
                onSearchChange={() => { }}
                isSearchHidden={true}
                className="px-4 md:px-6 sticky top-0 z-40 bg-white/90 backdrop-blur-md md:bg-white border-b border-slate-100"
                leftActions={
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex flex-col min-w-0">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight leading-tight truncate">דוח שינויים דוח 1</h2>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">השוואת שינויים יומי</span>
                        </div>
                    </div>
                }
                rightActions={
                    <div className="flex items-center bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                        <span className="px-3 text-slate-400 text-[10px] font-black uppercase tracking-widest border-l border-slate-100 pl-4 py-1">תאריך דוח</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent border-none font-bold text-slate-700 outline-none px-3 text-sm"
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

                        <div className={`bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between relative overflow-hidden group ${!hasSnapshots ? 'opacity-60' : ''}`}>
                            <div className={`absolute left-0 top-0 h-full w-1 ${!hasSnapshots ? 'bg-slate-300' : 'bg-amber-500'}`} />
                            <div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1">שינויים מהבוקר</span>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-3xl font-black ${!hasSnapshots ? 'text-slate-300' : 'text-slate-900'}`}>{hasSnapshots ? totalChanges : 'אין דוח'}</span>
                                    {hasSnapshots && (
                                        <span className="text-xs font-bold text-slate-400">חיילים ששינו סטטוס</span>
                                    )}
                                </div>
                            </div>
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${!hasSnapshots ? 'bg-slate-50 text-slate-300' : 'bg-amber-50 text-amber-600'}`}>
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
                                const hasChanges = stats && stats.changes > 0 && hasSnapshots;
                                const companyChanges = reportData?.changes.filter(c => c.company?.id === company.id) || [];
                                const isExpanded = expandedCompany === company.id;

                                return (
                                    <div key={company.id} className="group transition-colors hover:bg-slate-50/50">
                                        <div
                                            className={`px-6 py-4 flex items-center cursor-pointer transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}
                                            onClick={() => setExpandedCompany(isExpanded ? null : company.id)}
                                        >
                                            <div className="flex-1 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700">
                                                    <Buildings size={20} weight="duotone" />
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

                                        {/* Drill-down Diff View */}
                                        {isExpanded && (
                                            <div className="px-6 pb-6 animate-in slide-in-from-top-4 duration-300">
                                                <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                                                    {!hasSnapshots ? (
                                                        <div className="p-8 text-center text-slate-400">
                                                            <p className="text-sm font-bold">לא ניתן להציג פירוט שינויים ללא דוח בוקר.</p>
                                                        </div>
                                                    ) : companyChanges.length === 0 ? (
                                                        <div className="p-8 text-center text-slate-400 text-sm font-bold">
                                                            אין שינויי סטטוס בפלוגה זו מאז הבוקר.
                                                        </div>
                                                    ) : (
                                                        <div className="divide-y divide-slate-100">
                                                            {companyChanges.map((change, idx) => (
                                                                <div key={idx} className="px-5 py-3 flex items-center justify-between hover:bg-white transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-2 h-2 rounded-full ${change.soldier.color || 'bg-slate-300'}`} />
                                                                        <span className="text-sm font-black text-slate-700">{change.soldier.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-6">
                                                                        <div className="flex flex-col items-end">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">דיווח בוקר (09:00)</span>
                                                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusLabel(change.from).color}`}>
                                                                                {getStatusLabel(change.from).label}
                                                                            </div>
                                                                        </div>
                                                                        <CaretLeftIcon size={14} weight="bold" className="text-slate-300 self-center mt-3" />
                                                                        <div className="flex flex-col items-start">
                                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">מצב עדכני</span>
                                                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusLabel(change.to).color}`}>
                                                                                {getStatusLabel(change.to).label}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
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
