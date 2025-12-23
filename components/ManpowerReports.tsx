import React, { useState, useMemo } from 'react';
import { Person, Team, Role } from '../types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, Label } from 'recharts';
import { Users, Calendar, TrendingUp, AlertCircle, CheckCircle2, XCircle, LayoutGrid, List, Search, Download, ChevronDown } from 'lucide-react';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { useToast } from '../contexts/ToastContext';

interface ManpowerReportsProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
}

export const ManpowerReports: React.FC<ManpowerReportsProps> = ({ people, teams, roles }) => {
    // State
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [viewMode, setViewMode] = useState<'daily' | 'trends'>('daily');
    const [trendPeriod, setTrendPeriod] = useState<7 | 30 | 90>(30);
    const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(['all']);
    const [selectedRoleId, setSelectedRoleId] = useState<string>('all');

    // Modal State
    const { showToast } = useToast();
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; people: Person[]; type: 'present' | 'absent' | 'general' | 'role_risk_detail' | 'filter'; riskDetails?: any[] } | null>(null);
    const [modalSearch, setModalSearch] = useState('');

    const dateKey = selectedDate.toLocaleDateString('en-CA');

    // Helper: Get attendance for a specific date
    const getAttendanceForDate = (dateIso: string, subsetPeople: Person[]) => {
        let present = 0;
        let absent = 0;
        const presentPeople: Person[] = [];
        const absentPeople: Person[] = [];
        let total = subsetPeople.length;

        subsetPeople.forEach(p => {
            const availability = p.dailyAvailability?.[dateIso];
            // Default is available if not marked otherwise
            const isAvailable = availability ? availability.isAvailable : true;
            if (isAvailable) {
                present++;
                presentPeople.push(p);
            } else {
                absent++;
                absentPeople.push(p);
            }
        });

        return { present, absent, total, percentage: total > 0 ? Math.round((present / total) * 100) : 0, presentPeople, absentPeople };
    };

    // Derived Data
    const stats = useMemo(() => {
        const filteredPeople = selectedTeamIds.includes('all')
            ? people
            : people.filter(p => selectedTeamIds.includes(p.teamId));

        // 1. Daily Snapshot Data
        const dailyStats = getAttendanceForDate(dateKey, filteredPeople);

        // 2. Role Breakdown (Daily)
        const roleBreakdown = roles.map(role => {
            if (selectedRoleId !== 'all' && role.id !== selectedRoleId) return null;
            const peopleWithRole = filteredPeople.filter(p => {
                const currentRoleIds = p.roleIds || [p.roleId];
                return currentRoleIds.includes(role.id);
            });
            if (peopleWithRole.length === 0) return null;
            const roleStats = getAttendanceForDate(dateKey, peopleWithRole);
            return { ...role, ...roleStats };
        }).filter(Boolean);

        // 3. Team Breakdown (Daily - Only relevant if "All Org" is selected)
        const teamBreakdown = teams.map(team => {
            const teamPeople = people.filter(p => p.teamId === team.id);
            if (teamPeople.length === 0) return null;
            const teamStats = getAttendanceForDate(dateKey, teamPeople);
            return { name: team.name, ...teamStats, color: team.color };
        }).filter(Boolean);

        // 4. Trend Data
        const trendData = [];
        const roleTrends: Record<string, any[]> = {};
        let totalPercentage = 0;

        for (let i = trendPeriod - 1; i >= 0; i--) {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - i);
            const dKey = d.toLocaleDateString('en-CA');
            const dStats = getAttendanceForDate(dKey, filteredPeople);

            totalPercentage += dStats.percentage;

            trendData.push({
                date: dKey.slice(5),
                fullDate: dKey,
                percentage: dStats.percentage,
                present: dStats.present,
                dayName: d.toLocaleDateString('he-IL', { weekday: 'short' })
            });
        }

        const avgAttendance = Math.round(totalPercentage / trendPeriod);

        // 5. Insights & Hazards
        const roleRisks = roles.map(role => {
            const peopleWithRole = filteredPeople.filter(p => (p.roleIds || [p.roleId]).includes(role.id));
            if (peopleWithRole.length === 0) return null;

            const lowDaysInfo = trendData.filter(d => {
                const dayStats = getAttendanceForDate(d.fullDate, peopleWithRole);
                return dayStats.percentage < 50;
            }).map(d => ({
                date: d.fullDate,
                absentPeople: getAttendanceForDate(d.fullDate, peopleWithRole).absentPeople
            }));

            return {
                id: role.id,
                name: role.name,
                riskLevel: lowDaysInfo.length > trendPeriod * 0.3 ? 'high' : lowDaysInfo.length > 0 ? 'medium' : 'low',
                lowDays: lowDaysInfo.length,
                details: lowDaysInfo
            };
        }).filter(r => r && (r.riskLevel === 'high' || r.riskLevel === 'medium'))
            .sort((a, b) => b!.lowDays - a!.lowDays);

        // 6. Day of Week Analysis
        const dayOfWeekStats: Record<string, { total: number, count: number }> = {};
        trendData.forEach(d => {
            if (!dayOfWeekStats[d.dayName]) dayOfWeekStats[d.dayName] = { total: 0, count: 0 };
            dayOfWeekStats[d.dayName].total += d.percentage;
            dayOfWeekStats[d.dayName].count += 1;
        });
        const weekdayAnalysis = Object.entries(dayOfWeekStats).map(([name, s]) => ({
            name,
            avg: Math.round(s.total / s.count)
        }));

        return { dailyStats, roleBreakdown, teamBreakdown, trendData, avgAttendance, roleRisks, weekdayAnalysis };
    }, [people, selectedDate, selectedTeamIds, selectedRoleId, roles, teams, trendPeriod]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Compact Header / Controls */}
            <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl shadow-sm border border-slate-200 sticky top-0 z-20 flex flex-col gap-3">
                {/* Single Row Filters */}
                <div className="flex items-center justify-between gap-2">
                    {/* Left Side: View Toggle + Date */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {/* View Toggle - Integrated */}
                        <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                            <button
                                onClick={() => setViewMode('daily')}
                                className={`px-2 py-1.5 rounded-[6px] text-xs font-bold transition-all ${viewMode === 'daily' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                            >
                                יומי
                            </button>
                            <button
                                onClick={() => setViewMode('trends')}
                                className={`px-2 py-1.5 rounded-[6px] text-xs font-bold transition-all ${viewMode === 'trends' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                            >
                                מגמות
                            </button>
                        </div>

                        {/* Date Picker - Compact */}
                        {/* Date Picker - Compact & Functional */}
                        <div className="relative group">
                            <button
                                onClick={() => (document.getElementById('mobile-date-picker') as HTMLInputElement)?.showPicker()}
                                className="flex items-center justify-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5 hover:border-blue-500 transition-colors w-24 sm:w-32"
                            >
                                <span className="text-[10px] sm:text-xs font-bold truncate text-slate-900 leading-tight">
                                    {selectedDate ? selectedDate.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'תאריך'}
                                </span>
                            </button>
                            <input
                                id="mobile-date-picker"
                                type="date"
                                value={dateKey}
                                onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                                tabIndex={-1}
                            />
                        </div>
                    </div>

                    {/* Right Side: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Filter Button */}
                        <button
                            onClick={() => setModalConfig({ isOpen: true, title: 'סינון לפי צוות', people: [], type: 'filter' })}
                            className={`flex items-center justify-center h-8 px-2 rounded-lg transition-colors border ${!selectedTeamIds.includes('all') ? 'bg-blue-600 border-blue-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`}
                            title="סינון לפי צוות"
                        >
                            {!selectedTeamIds.includes('all') ? (
                                <span className="text-[10px] font-bold flex items-center gap-1">
                                    <span className="bg-white/20 px-1 rounded-sm">{selectedTeamIds.length}</span>
                                    <span>נבחרו</span>
                                </span>
                            ) : (
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-bold">כל הארגון</span>
                                    <List size={14} />
                                </div>
                            )}
                        </button>

                        {/* Export Button - Outside */}
                        <button
                            onClick={() => {
                                const dateStr = selectedDate.toLocaleDateString('he-IL').replace(/\./g, '-');
                                let csvContent = "שם,צוות,תפקיד,סטטוס\n";

                                const exportPeople = selectedTeamIds.includes('all')
                                    ? people
                                    : people.filter(p => selectedTeamIds.includes(p.teamId));

                                exportPeople.forEach(p => {
                                    const teamName = teams.find(t => t.id === p.teamId)?.name || 'ללא צוות';
                                    const roleName = roles.find(r => r.id === p.roleId)?.name || 'ללא תפקיד';
                                    const avail = p.dailyAvailability?.[dateKey];
                                    const statusString = (avail?.isAvailable ?? true) ? 'נוכח' : 'חסר';
                                    csvContent += `"${p.name}","${teamName}","${roleName}","${statusString}"\n`;
                                });

                                const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                link.href = URL.createObjectURL(blob);
                                link.download = `manpower_report_${dateStr}.csv`;
                                link.click();
                                showToast('הדו"ח היומי יוצא בהצלחה', 'success');
                            }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition-colors"
                            title="ייצוא לאקסל"
                        >
                            <Download size={16} />
                        </button>
                    </div>
                </div>

                {viewMode === 'trends' && (
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">תקופת ניתוח:</span>
                        <div className="flex gap-1">
                            {[7, 30, 90].map(period => (
                                <button
                                    key={period}
                                    onClick={() => setTrendPeriod(period as any)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${trendPeriod === period ? 'bg-blue-600 border-blue-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                                >
                                    {period} ימים
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {viewMode === 'daily' && (
                <>
                    {/* KPI Cards */}
                    {/* KPI Bento Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                        <KPICard
                            title='סד"כ כולל'
                            value={stats.dailyStats.total}
                            icon={<Users size={20} />}
                            color="blue"
                            onClick={() => setModalConfig({
                                isOpen: true,
                                title: `מצבת כוח אדם (${stats.dailyStats.total})`,
                                people: selectedTeamIds.includes('all') ? people : people.filter(p => selectedTeamIds.includes(p.teamId)),
                                type: 'general'
                            })}
                        />
                        <KPICard
                            title='נוכחים'
                            value={stats.dailyStats.present}
                            icon={<CheckCircle2 size={20} />}
                            color="green"
                            onClick={() => setModalConfig({
                                isOpen: true,
                                title: `רשימת נוכחים (${stats.dailyStats.present})`,
                                people: stats.dailyStats.presentPeople,
                                type: 'present'
                            })}
                        />
                        <KPICard
                            title='חסרים'
                            value={stats.dailyStats.absent}
                            icon={<XCircle size={20} />}
                            color="red"
                            onClick={() => setModalConfig({
                                isOpen: true,
                                title: `רשימת חסרים (${stats.dailyStats.absent})`,
                                people: stats.dailyStats.absentPeople,
                                type: 'absent'
                            })}
                        />
                        <KPICard
                            title='כשירות'
                            value={`${stats.dailyStats.percentage}%`}
                            icon={<TrendingUp size={20} />}
                            color={stats.dailyStats.percentage > 80 ? 'emerald' : stats.dailyStats.percentage > 50 ? 'yellow' : 'red'}
                        />
                    </div>

                    {/* Presence Overview Visual */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">סקירת נוכחות ויזואלית</h3>
                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{stats.dailyStats.percentage}% זמינות</span>
                        </div>

                        <div className="flex h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-green-500 transition-all duration-1000 ease-out"
                                style={{ width: `${stats.dailyStats.percentage}%` }}
                            />
                            <div
                                className="h-full bg-red-400 transition-all duration-1000 ease-out"
                                style={{ width: `${100 - stats.dailyStats.percentage}%` }}
                            />
                        </div>

                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                <span>נוכחים ({stats.dailyStats.present})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                <span>חסרים ({stats.dailyStats.absent})</span>
                            </div>
                        </div>
                    </div>

                    {/* Role Breakdown Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            {/* Availability by Role - Refactored List */}
                            <div className="rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200 mt-6 md:mt-0">
                                {/* White Header */}
                                <div className="bg-white p-4 border-b border-slate-100">
                                    <div className="flex items-center justify-between gap-4">
                                        <h3 className="text-slate-800 font-bold text-lg flex items-center gap-2">
                                            <Users size={20} className="text-emerald-500" />
                                            זמינות לפי תפקיד
                                        </h3>
                                        <div className="w-40">
                                            <div className="relative">
                                                <select
                                                    value={selectedRoleId}
                                                    onChange={(e) => setSelectedRoleId(e.target.value)}
                                                    className="w-full appearance-none bg-slate-50 text-slate-800 text-sm font-bold border border-slate-200 rounded-lg py-2 pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                                                >
                                                    <option value="all">כל התפקידים</option>
                                                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                                </select>
                                                <ChevronDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Compact List */}
                                <div className="divide-y divide-slate-100">
                                    {stats.roleBreakdown.map((role: any) => {
                                        const colorClass = role.percentage === 100 ? 'bg-[#82d682]' : role.percentage >= 80 ? 'bg-yellow-400' : 'bg-red-400';
                                        const textColorClass = role.percentage === 100 ? 'text-[#5eb85e]' : role.percentage >= 80 ? 'text-yellow-600' : 'text-red-600';

                                        return (
                                            <div
                                                key={role.id}
                                                onClick={() => setModalConfig({
                                                    isOpen: true,
                                                    title: `זמינות - ${role.name}`,
                                                    people: [...role.presentPeople, ...role.absentPeople],
                                                    type: 'general'
                                                })}
                                                className="relative p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                                            >
                                                <div className="flex items-center justify-between mb-1 relative z-10">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800 text-sm md:text-base">{role.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-medium group-hover:text-blue-500 transition-colors">לחץ לפירוט</span>
                                                    </div>

                                                    <div className="text-right">
                                                        <div className="flex items-baseline justify-end gap-1.5">
                                                            <span className="text-base md:text-lg font-black text-slate-800 tracking-tight">{role.present}</span>
                                                            <span className="text-xs text-slate-400 font-medium">/ {role.total}</span>
                                                        </div>
                                                        <span className={`text-xs font-bold ${textColorClass}`}>
                                                            {role.percentage}% זמינות
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Slim Progress Line at Bottom */}
                                                <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-slate-50">
                                                    <div
                                                        className={`h-full ${colorClass} transition-all duration-500 rounded-r-full shadow-sm`}
                                                        style={{ width: `${role.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Team Comparison Chart (Donut - Quantity) */}
                        {(selectedTeamIds.includes('all') || selectedTeamIds.length > 1) && (
                            <div className="bg-white p-6 rounded-xl shadow-portal flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 mb-2">התפלגות נוכחים לפי צוותים</h3>
                                <div className="w-full h-[300px] relative">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                            <Pie
                                                data={stats.teamBreakdown}
                                                dataKey="present"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={2}
                                                cornerRadius={4}
                                            >
                                                {stats.teamBreakdown.map((entry: any, index: number) => {
                                                    // Vibrant Palette
                                                    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];
                                                    return <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />;
                                                })}
                                                <Label
                                                    content={({ viewBox }) => {
                                                        const { cx, cy } = viewBox as any;
                                                        return (
                                                            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
                                                                <tspan x={cx} dy="-0.5em" fontSize="28" fontWeight="bold" fill="#1e293b">
                                                                    {stats.dailyStats.present}
                                                                </tspan>
                                                                <tspan x={cx} dy="1.5em" fontSize="14" fill="#64748b">
                                                                    נוכחים
                                                                </tspan>
                                                            </text>
                                                        );
                                                    }}
                                                    position="center"
                                                />
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                                formatter={(value: number) => [value, 'נוכחים']}
                                            />
                                            <Legend
                                                layout="vertical"
                                                verticalAlign="middle"
                                                align="right"
                                                iconType="circle"
                                                formatter={(value, entry: any) => (
                                                    <span className="text-slate-700 font-medium mr-2">{value} ({entry.payload.present})</span>
                                                )}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {viewMode === 'trends' && (
                <div className="space-y-6">
                    {/* Trend Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <KPICard
                            title="ממוצע נוכחות לתקופה"
                            value={`${stats.avgAttendance}%`}
                            icon={<TrendingUp size={24} />}
                            color={stats.avgAttendance > 80 ? 'green' : stats.avgAttendance > 60 ? 'yellow' : 'red'}
                            subtext={`מבוסס על ${trendPeriod} הימים האחרונים`}
                        />
                        <KPICard
                            title="יציבות כוח אדם"
                            value={stats.trendData.filter(d => d.percentage > 70).length > trendPeriod * 0.8 ? 'גבוהה' : 'בינונית'}
                            icon={<CheckCircle2 size={24} />}
                            color="blue"
                            subtext="עקביות במצבת הנוכחים"
                        />
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                            <h4 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2">
                                <AlertCircle size={16} className="text-red-500" />
                                סיכונים בתפקידי ליבה
                            </h4>
                            <div className="space-y-3">
                                {stats.roleRisks.slice(0, 3).map((risk: any) => (
                                    <button
                                        key={risk.id}
                                        onClick={() => {
                                            setModalConfig({
                                                isOpen: true,
                                                title: `פירוט סיכון: ${risk.name} (${risk.lowDays} ימים מתחת ל-50%)`,
                                                people: [],
                                                type: 'role_risk_detail',
                                                riskDetails: risk.details
                                            });
                                        }}
                                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-red-50 transition-colors group text-right"
                                    >
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700">{risk.name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">לחץ לפירוט מפורט לפי תאריכים</span>
                                        </div>
                                        <span className={`text-red-600 bg-red-50 px-2.5 py-1 rounded-lg font-black text-xs border border-red-100 group-hover:bg-red-100 transition-colors`}>
                                            {risk.lowDays} ימי חוסר
                                        </span>
                                    </button>
                                ))}
                                {stats.roleRisks.length === 0 && <p className="text-xs text-slate-400 italic">לא זוהו סיכונים משמעותיים</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Main Trend Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-portal border border-slate-100">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp className="text-blue-500" size={20} />
                                גרף נוכחות - {trendPeriod} ימים
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorAttendanceTrends" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} interval={Math.floor(trendPeriod / 7)} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontWeight: 'bold' }}
                                            formatter={(value: number) => [`${value}%`, 'נוכחות']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="percentage"
                                            stroke="#3b82f6"
                                            strokeWidth={4}
                                            fillOpacity={1}
                                            fill="url(#colorAttendanceTrends)"
                                            animationDuration={1500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Weekday Analysis */}
                        <div className="bg-white p-6 rounded-xl shadow-portal border border-slate-100">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <Calendar className="text-emerald-500" size={20} />
                                ניתוח נוכחות לפי ימי שבוע
                            </h3>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.weekdayAnalysis} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                            cursor={{ fill: '#f8fafc' }}
                                        />
                                        <Bar dataKey="avg" radius={[6, 6, 0, 0]} barSize={40}>
                                            {stats.weekdayAnalysis.map((entry: any, index: number) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.avg > 80 ? '#10b981' : entry.avg > 60 ? '#f59e0b' : '#ef4444'}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-center text-slate-400 mt-4 font-bold italic">
                                * מציג את ממוצע הנוכחות לאורך תקופת הדיווח (ללא סופי שבוע שאינם פעילים)
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {modalConfig && (
                <Modal
                    isOpen={modalConfig.isOpen}
                    onClose={() => { setModalConfig(null); setModalSearch(''); }}
                    title={modalConfig.title}
                    size="lg"

                >
                    <div className="space-y-4">
                        {modalConfig.type === 'role_risk_detail' ? (
                            // Special view for role risk details - grouped by date
                            <div className="space-y-4">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                                    <strong>הסבר:</strong> להלן רשימת הימים בהם רמת הכשירות של תפקיד זה ירדה מתחת ל-50%, עם פירוט האנשים שהיו חסרים בכל יום.
                                </div>
                                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                                    {modalConfig.riskDetails?.map((dayDetail: any, idx: number) => {
                                        const dateObj = new Date(dayDetail.date);
                                        const dateStr = dateObj.toLocaleDateString('he-IL', {
                                            weekday: 'long',
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        });

                                        return (
                                            <div key={idx} className="bg-white border-2 border-red-100 rounded-xl p-4 shadow-sm">
                                                <div className="flex items-center justify-between mb-3 pb-2 border-b border-red-100">
                                                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                        <Calendar size={16} className="text-red-500" />
                                                        {dateStr}
                                                    </h4>
                                                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">
                                                        {dayDetail.absentPeople.length} חסרים
                                                    </span>
                                                </div>
                                                <div className="space-y-2">
                                                    {dayDetail.absentPeople.map((person: Person) => {
                                                        const team = teams.find(t => t.id === person.teamId);
                                                        const role = roles.find(r => r.id === person.roleId);

                                                        return (
                                                            <div key={person.id} className="flex items-center gap-3 p-2 bg-red-50 rounded-lg">
                                                                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs bg-red-100 text-red-700">
                                                                    {person.name.charAt(0)}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="font-bold text-slate-800 text-sm">{person.name}</div>
                                                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                                                        <span>{team?.name || 'ללא צוות'}</span>
                                                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                        <span>{role?.name || 'ללא תפקיד'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : modalConfig.type === 'filter' ? (
                            <div className="space-y-4">
                                <button
                                    onClick={() => {
                                        if (selectedTeamIds.includes('all')) {
                                            setSelectedTeamIds([]); // Deselect
                                        } else {
                                            setSelectedTeamIds(['all']); // Select only All
                                        }
                                    }}
                                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${selectedTeamIds.includes('all')
                                        ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'
                                        }`}
                                >
                                    <span className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedTeamIds.includes('all') ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Users size={20} />
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold">כל הארגון</div>
                                            <div className="text-xs opacity-70">הצג נתונים עבור כלל היחידה</div>
                                        </div>
                                    </span>
                                    {selectedTeamIds.includes('all') && <CheckCircle2 size={20} className="text-blue-600" />}
                                </button>

                                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">צוותים ומחלקות (נבחרו: {selectedTeamIds.includes('all') ? 'הכל' : selectedTeamIds.length})</h4>
                                    {teams.map(team => {
                                        const isSelected = selectedTeamIds.includes(team.id);
                                        return (
                                            <button
                                                key={team.id}
                                                onClick={() => {
                                                    let newIds = [...selectedTeamIds];
                                                    if (newIds.includes('all')) {
                                                        // If currently 'all', switching to specific -> clear 'all' and add this one
                                                        newIds = [team.id];
                                                    } else {
                                                        if (isSelected) {
                                                            newIds = newIds.filter(id => id !== team.id);
                                                        } else {
                                                            newIds.push(team.id);
                                                        }
                                                    }

                                                    // If nothing selected? Maybe keep empty or revert to all? 
                                                    // Let's allow empty for now or default back to all if user closes?
                                                    // Actually, let's keep it as is.
                                                    if (newIds.length === 0) newIds = ['all'];

                                                    setSelectedTeamIds(newIds);
                                                }}
                                                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${isSelected
                                                    ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold shadow-sm'
                                                    : 'bg-white border-slate-200 hover:border-blue-300 text-slate-700'
                                                    }`}
                                            >
                                                <span className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                                                        {team.name.charAt(0)}
                                                    </div>
                                                    <span>{team.name}</span>
                                                </span>
                                                {isSelected && <CheckCircle2 size={18} className="text-blue-600" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                <button
                                    onClick={() => setModalConfig(null)}
                                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md sticky bottom-0"
                                >
                                    אישור ובחירה ({selectedTeamIds.includes('all') ? 'כל הארגון' : selectedTeamIds.length})
                                </button>
                            </div>
                        ) : (
                            // Original people list view
                            <>
                                <Input
                                    placeholder="חיפוש לפי שם..."
                                    value={modalSearch}
                                    onChange={(e) => setModalSearch(e.target.value)}
                                    icon={Search}
                                    autoFocus
                                />

                                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                                    {modalConfig.people
                                        .filter(p => p.name.includes(modalSearch))
                                        .map(person => {
                                            const team = teams.find(t => t.id === person.teamId);
                                            const role = roles.find(r => r.id === person.roleId);

                                            return (
                                                <div key={person.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:bg-slate-100 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${modalConfig.type === 'present' ? 'bg-green-100 text-green-700' :
                                                            modalConfig.type === 'absent' ? 'bg-red-100 text-red-700' :
                                                                'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {person.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-800">{person.name}</div>
                                                            <div className="text-xs text-slate-500 flex items-center gap-2">
                                                                <span>{team?.name || 'ללא צוות'}</span>
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                <span>{role?.name || 'ללא תפקיד'}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Status Badge inside list if 'general' */}
                                                    {modalConfig.type === 'general' && (
                                                        <div className="flex-shrink-0">
                                                            {(person.dailyAvailability?.[dateKey]?.isAvailable ?? true) ? (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">נוכח</span>
                                                            ) : (
                                                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-bold">חסר</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                    {modalConfig.people.filter(p => p.name.includes(modalSearch)).length === 0 && (
                                        <div className="text-center py-8 text-slate-400">
                                            לא נמצאו תוצאות
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

// Helper Component for KPI Cards
const KPICard: React.FC<{ title: string, value: string | number, subtext?: string, icon: React.ReactNode, color: string, onClick?: () => void }> = ({ title, value, subtext, icon, color, onClick }) => {
    const colorClasses: Record<string, string> = {
        blue: 'text-blue-600 bg-blue-50',
        green: 'text-green-600 bg-green-50',
        red: 'text-red-600 bg-red-50',
        yellow: 'text-yellow-600 bg-yellow-50',
        emerald: 'text-emerald-600 bg-emerald-50',
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white p-3 lg:p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between transition-all aspect-[1.3] lg:aspect-auto ${onClick ? 'cursor-pointer hover:shadow-md active:scale-95' : ''}`}
        >
            <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center mb-auto ${colorClasses[color] || colorClasses.blue}`}>
                {icon}
            </div>
            <div className="mt-2">
                <h3 className={`text-xl lg:text-3xl font-black ${color === 'red' ? 'text-red-600' : color === 'green' || color === 'emerald' ? 'text-green-600' : color === 'blue' ? 'text-blue-600' : 'text-slate-800'}`}>
                    {value}
                </h3>
                <p className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-tighter truncate">{title}</p>
                {subtext && <p className="hidden lg:block text-[10px] text-slate-400 mt-0.5 font-medium">{subtext}</p>}
            </div>
        </div>
    );
};
