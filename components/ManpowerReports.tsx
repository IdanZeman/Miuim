import React, { useState, useMemo } from 'react';
import { Person, Team, Role } from '../types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, Label } from 'recharts';
import { Users, Calendar, TrendingUp, AlertCircle, CheckCircle2, XCircle, LayoutGrid, List, Search, Download } from 'lucide-react';
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
    const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
    const [selectedRoleId, setSelectedRoleId] = useState<string>('all');

    // Modal State
    const { showToast } = useToast();
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; title: string; people: Person[]; type: 'present' | 'absent' | 'general' } | null>(null);
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
        const filteredPeople = selectedTeamId === 'all'
            ? people
            : people.filter(p => p.teamId === selectedTeamId);

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

        // 4. Trend Data (Last 14 Days)
        const trendData = [];
        for (let i = 13; i >= 0; i--) {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - i);
            const dKey = d.toLocaleDateString('en-CA');
            const dStats = getAttendanceForDate(dKey, filteredPeople);
            trendData.push({
                date: dKey.slice(5), // MM-DD
                percentage: dStats.percentage,
                present: dStats.present
            });
        }

        return { dailyStats, roleBreakdown, teamBreakdown, trendData };
    }, [people, selectedDate, selectedTeamId, selectedRoleId, roles, teams]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header / Controls */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-600">
                        {viewMode === 'daily' ? <LayoutGrid size={24} /> : <TrendingUp size={24} />}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">
                            {viewMode === 'daily' ? 'תמונת מצב יומית' : 'מגמות וניתוח נתונים'}
                        </h2>
                        <p className="text-sm text-slate-500">דוח מפקדים - כוח אדם</p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                    {/* View Toggle - Full width on mobile */}
                    <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                        <button
                            onClick={() => setViewMode('daily')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'daily' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                        >
                            יומי
                        </button>
                        <button
                            onClick={() => setViewMode('trends')}
                            className={`flex-1 md:flex-none px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'trends' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                        >
                            מגמות
                        </button>
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-1 hidden md:block"></div>

                    {/* Controls Row on Mobile */}
                    <div className="grid grid-cols-2 md:flex items-center gap-3 w-full md:w-auto">
                        {/* Date Picker */}
                        <div className="w-full md:w-40">
                            <div className="relative flex items-center bg-white rounded-lg border border-slate-300 px-3 py-2 w-full group hover:border-blue-500 transition-colors">
                                <span className={`text-sm font-bold flex-1 text-right pointer-events-none truncate ${dateKey ? 'text-slate-900' : 'text-slate-400'}`}>
                                    {selectedDate ? selectedDate.toLocaleDateString('he-IL') : 'בחר תאריך'}
                                </span>
                                <input
                                    type="date"
                                    value={dateKey}
                                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                                />
                                <Calendar size={18} className="text-slate-400 ml-2 pointer-events-none shrink-0" />
                            </div>
                        </div>

                        {/* Team Filter */}
                        <div className="w-full md:w-60">
                            <Select
                                value={selectedTeamId}
                                onChange={setSelectedTeamId}
                                options={[{ value: 'all', label: 'כל הארגון' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === 'daily' && (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <KPICard
                            title='מצבת כוח אדם'
                            value={stats.dailyStats.total}
                            icon={<Users size={24} />}
                            color="blue"
                            onClick={() => setModalConfig({
                                isOpen: true,
                                title: `מצבת כוח אדם (${stats.dailyStats.total})`,
                                people: selectedTeamId === 'all' ? people : people.filter(p => p.teamId === selectedTeamId),
                                type: 'general'
                            })}
                        />
                        <KPICard
                            title='נוכחים'
                            value={stats.dailyStats.present}
                            subtext={`${stats.dailyStats.percentage}% מהכוח`}
                            icon={<CheckCircle2 size={24} />}
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
                            icon={<XCircle size={24} />}
                            color="red"
                            onClick={() => setModalConfig({
                                isOpen: true,
                                title: `רשימת חסרים (${stats.dailyStats.absent})`,
                                people: stats.dailyStats.absentPeople,
                                type: 'absent'
                            })}
                        />
                        <KPICard
                            title='כשירות מבצעית'
                            value={`${stats.dailyStats.percentage}%`}
                            icon={<TrendingUp size={24} />}
                            color={stats.dailyStats.percentage > 80 ? 'emerald' : stats.dailyStats.percentage > 50 ? 'yellow' : 'red'}
                        />
                    </div>

                    {/* Role Breakdown Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <List size={20} className="text-slate-400" />
                                    זמינות לפי תפקיד
                                </h3>
                                <div className="w-60">
                                    <Select
                                        value={selectedRoleId}
                                        onChange={setSelectedRoleId}
                                        options={[{ value: 'all', label: 'כל התפקידים' }, ...roles.map(r => ({ value: r.id, label: r.name }))]}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                {stats.roleBreakdown.map((role: any) => (
                                    <div
                                        key={role.id}
                                        onClick={() => setModalConfig({
                                            isOpen: true,
                                            title: `זמינות - ${role.name}`,
                                            people: [...role.presentPeople, ...role.absentPeople],
                                            type: 'general'
                                        })}
                                        className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden active:scale-[0.98]"
                                    >
                                        <div className={`absolute top-0 right-0 w-1 h-full bg-${role.percentage === 100 ? 'green' : role.percentage > 50 ? 'yellow' : 'red'}-500`}></div>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-700">{role.name}</span>
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${role.percentage === 100 ? 'bg-green-100 text-green-700' :
                                                role.percentage > 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {role.percentage}%
                                            </span>
                                        </div>
                                        <div className="flex items-end gap-1">
                                            <span className="text-2xl font-bold text-slate-800">{role.present}</span>
                                            <span className="text-sm text-slate-400 mb-1">/ {role.total}</span>
                                        </div>
                                        {/* Mini Progress Bar */}
                                        <div className="w-full h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${role.percentage === 100 ? 'bg-green-500' : role.percentage > 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
                                                style={{ width: `${role.percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Team Comparison Chart (Donut - Quantity) */}
                        {selectedTeamId === 'all' && (
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
                <div className="bg-white p-6 rounded-xl shadow-portal">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <TrendingUp className="text-blue-500" size={20} />
                        מגמת נוכחות (14 ימים אחרונים)
                    </h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorAttendance" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} unit="%" />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    formatter={(value: number) => [`${value}%`, 'נוכחות']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="percentage"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorAttendance)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
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
                    footer={
                        <div className="flex justify-between items-center w-full">
                            <span className="text-sm text-slate-500 font-bold">
                                {modalConfig.people.length} רשומות
                            </span>
                            <button
                                onClick={() => {
                                    const dateStr = selectedDate.toLocaleDateString('he-IL').replace(/\./g, '-');
                                    let csvContent = "שם,צוות,תפקיד,סטטוס\n";

                                    modalConfig.people.forEach(p => {
                                        const teamName = teams.find(t => t.id === p.teamId)?.name || 'ללא צוות';
                                        const roleName = roles.find(r => r.id === p.roleId)?.name || 'ללא תפקיד';

                                        // Determine status text based on modal context, or fetch specifically 
                                        let statusString = 'לא ידוע';
                                        if (modalConfig.type === 'present') statusString = 'נוכח';
                                        else if (modalConfig.type === 'absent') statusString = 'חסר';
                                        else {
                                            // Fallback logic if needed, though 'general' implies we might want real status
                                            const avail = p.dailyAvailability?.[dateKey];
                                            statusString = (avail?.isAvailable ?? true) ? 'נוכח' : 'חסר';
                                        }

                                        csvContent += `"${p.name}","${teamName}","${roleName}","${statusString}"\n`;
                                    });

                                    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const link = document.createElement('a');
                                    link.href = URL.createObjectURL(blob);
                                    link.download = `report_${modalConfig.type}_${dateStr}.csv`;
                                    link.click();
                                    showToast('הקובץ הורד בהצלחה', 'success');
                                }}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                            >
                                <Download size={18} />
                                ייצוא לאקסל
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-4">
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
                    </div>
                </Modal>
            )}
        </div>
    );
};

// Helper Component for KPI Cards
const KPICard: React.FC<{ title: string, value: string | number, subtext?: string, icon: React.ReactNode, color: string, onClick?: () => void }> = ({ title, value, subtext, icon, color, onClick }) => {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600',
        yellow: 'bg-yellow-50 text-yellow-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''}`}
        >
            <div>
                <p className="text-slate-500 font-medium text-sm mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-slate-800">{value}</h3>
                {subtext && <p className="text-xs text-slate-400 mt-1 font-medium">{subtext}</p>}
            </div>
            <div className={`p-3 rounded-xl ${colorClasses[color] || colorClasses.blue}`}>
                {icon}
            </div>
        </div>
    );
};
