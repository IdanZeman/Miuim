import React, { useState, useEffect, useCallback } from 'react';
import {
    Search,
    Calendar,
    Filter,
    Download,
    User,
    Car,
    Footprints,
    ArrowRightCircle,
    ArrowLeftCircle,
    Building2,
    Clock
} from 'lucide-react';
import { useGateSystem, GateLog } from '../../hooks/useGateSystem';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { LogDetailsModal } from './LogDetailsModal';
import { format } from 'date-fns';

export const GateHistory: React.FC = () => {
    const { fetchGateHistory, battalionOrganizations } = useGateSystem();

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrgId, setSelectedOrgId] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Data
    const [logs, setLogs] = useState<GateLog[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<GateLog | null>(null);

    const loadHistory = useCallback(async () => {
        setIsLoading(true);
        const { data } = await fetchGateHistory({
            search: searchTerm,
            orgId: selectedOrgId === 'all' ? undefined : selectedOrgId,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            limit: 100
        });
        setLogs(data || []);
        setIsLoading(false);
    }, [fetchGateHistory, searchTerm, selectedOrgId, startDate, endDate]);

    // Initial load & Debounced Search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadHistory();
        }, 500);
        return () => clearTimeout(timer);
    }, [loadHistory]);

    const getDuration = (start: string, end: string | null) => {
        if (!end) return 'בבסיס';
        const s = new Date(start);
        const e = new Date(end);
        const diffMs = e.getTime() - s.getTime();
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        return `${diffHrs}ש ${diffMins}ד`;
    };

    return (
        <div className="space-y-6">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col lg:flex-row gap-4 items-end lg:items-center">
                <div className="flex-1 w-full relative">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">חיפוש</label>
                    <div className="relative">
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="מספר רכב, שם נהג..."
                            className="pl-10"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                </div>

                <div className="w-full lg:w-48">
                    <label className="text-xs font-bold text-slate-500 mb-1 block">יחידה</label>
                    <select
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="w-full h-[42px] px-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 bg-white"
                    >
                        <option value="all">כלל הגדוד</option>
                        {battalionOrganizations.map(org => (
                            <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2 w-full lg:w-auto">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">מתאריך</label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">עד תאריך</label>
                        <Input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                <Button variant="outline" onClick={loadHistory} className="mb-[1px]">
                    <Filter size={18} />
                </Button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                            <tr>
                                <th className="px-4 py-3 text-right font-medium">סוג</th>
                                <th className="px-4 py-3 text-right font-medium">זיהוי</th>
                                <th className="px-4 py-3 text-right font-medium">שם</th>
                                <th className="px-4 py-3 text-right font-medium">יחידה</th>
                                <th className="px-4 py-3 text-right font-medium">כניסה</th>
                                <th className="px-4 py-3 text-right font-medium">יציאה</th>
                                <th className="px-4 py-3 text-right font-medium">משך שהייה</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center">
                                        <LoadingSpinner />
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        לא נמצאה היסטוריה תואמת
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr
                                        key={log.id}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedLog(log)}
                                    >
                                        <td className="px-4 py-3">
                                            {log.entry_type === 'pedestrian' ? (
                                                <div className="bg-orange-100 text-orange-600 p-1.5 rounded-lg w-fit" title="הולך רגל">
                                                    <Footprints size={16} />
                                                </div>
                                            ) : (
                                                <div className="bg-blue-100 text-blue-600 p-1.5 rounded-lg w-fit" title="רכב">
                                                    <Car size={16} />
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-slate-700">
                                            {log.plate_number}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {log.driver_name}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                                                <Building2 size={12} />
                                                {log.organizations?.name || 'לא ידוע'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {format(new Date(log.entry_time), 'dd/MM HH:mm')}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {log.exit_time ? (
                                                format(new Date(log.exit_time), 'dd/MM HH:mm')
                                            ) : (
                                                <span className="text-green-600 font-medium text-xs bg-green-50 px-2 py-1 rounded-full">בבסיס</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-slate-500">
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} />
                                                {getDuration(log.entry_time, log.exit_time)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {selectedLog && <LogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
        </div>
    );
};
