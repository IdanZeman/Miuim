import React, { useState, useEffect } from 'react';
import {
    Users,
    Trash,
    Database,
    ArrowsClockwise,
    Pulse,
    CheckCircle,
    XCircle,
    Clock,
    ArrowRight,
    ShieldCheck,
    Calendar,
    User as UserIcon,
    Info,
    TrendUp,
    Shield,
    Warning
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService, AnalyticsSummary, ActivityEvent } from '../../../services/adminService';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../contexts/ToastContext';

// Tooltip component for descriptions
const MetricTooltip = ({ text }: { text: string }) => (
    <div className="group relative inline-block ml-1 align-middle">
        <Info size={14} className="text-slate-400 cursor-help" weight="bold" />
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 text-center shadow-xl">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900" />
        </div>
    </div>
);

import { Skeleton } from '@/components/ui/Skeleton';

const AnalyticsSkeleton = () => (
    <div className="space-y-8">
        {/* Main Stats Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm h-32 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div className="space-y-3">
                            <Skeleton className="w-20 h-3" />
                            <Skeleton className="w-12 h-8 rounded-lg" />
                        </div>
                        <Skeleton className="w-12 h-12 rounded-2xl" />
                    </div>
                    <Skeleton className="w-16 h-2 rounded-full self-end" />
                </div>
            ))}
        </div>

        {/* System Performance & Nightly Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[2.5rem] p-8 h-64 flex items-center gap-8">
                <Skeleton className="w-32 h-32 rounded-full shrink-0" />
                <div className="flex-1 space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="w-48 h-6" />
                        <Skeleton className="w-64 h-4" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Skeleton className="h-20 rounded-2xl" />
                        <Skeleton className="h-20 rounded-2xl" />
                    </div>
                </div>
            </div>
            <Skeleton className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-8 h-64 w-full" />
        </div>

        {/* Activity Feed Skeleton */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-[400px] p-6 space-y-4">
            <div className="flex justify-between items-center mb-6">
                <Skeleton className="w-40 h-6" />
                <Skeleton className="w-24 h-6 rounded-lg" />
            </div>
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex gap-4 items-center">
                    <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="w-32 h-4" />
                        <Skeleton className="w-48 h-3" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

interface AnalyticsDashboardProps {
    isEmbedded?: boolean;
    onNavigate?: (tab: 'analytics' | 'logs') => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ isEmbedded = false, onNavigate }) => {
    const { organization } = useAuth();
    const { showToast } = useToast();
    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [activity, setActivity] = useState<ActivityEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (organization?.id) {
            loadData();
        }
    }, [organization?.id]);

    const loadData = async (silent = false) => {
        try {
            if (!silent) setLoading(true);
            else setIsRefreshing(true);

            const [summaryData, activityData] = await Promise.all([
                adminService.fetchAnalyticsSummary(organization!.id),
                adminService.fetchRecentActivity(organization!.id)
            ]);
            setSummary(summaryData);
            setActivity(activityData);
        } catch (error) {
            console.error('Error loading analytics:', error);
            showToast('שגיאה בטעינת נתוני אנליטיקה', 'error');
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-black text-sm animate-pulse">מעבד נתונים...</p>
            </div>
        );
    }

    const StatCard = ({ title, value, icon: Icon, color, description, tooltip }: any) => (
        <div className="bg-slate-50 p-4 sm:p-5 rounded-xl sm:rounded-2xl border border-slate-200/60 flex flex-col justify-between h-full group hover:border-blue-200 transition-all hover:shadow-md hover:shadow-blue-50/50">
            <div className="flex justify-between items-start mb-2 sm:mb-3">
                <div className={`p-2 sm:p-2.5 ${color.bg} ${color.text} rounded-lg sm:rounded-xl group-hover:scale-110 transition-transform shadow-sm`}>
                    <Icon size={window.innerWidth < 640 ? 18 : 22} weight="duotone" />
                </div>
                <div className="flex items-center">
                    <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{description}</span>
                    {tooltip && <MetricTooltip text={tooltip} />}
                </div>
            </div>
            <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">{value ?? 0}</h3>
                <p className="text-[10px] sm:text-xs font-bold text-slate-500 mt-1.5 sm:mt-2">{title}</p>
            </div>
        </div>
    );

    const getEventIcon = (type: string) => {
        switch (type) {
            case 'deletion': return <Trash size={20} weight="duotone" className="text-rose-500" />;
            case 'create': return <Database size={20} weight="duotone" className="text-blue-500" />;
            case 'restore': return <ArrowsClockwise size={20} weight="duotone" className="text-orange-500" />;
            default: return <Pulse size={20} weight="duotone" className="text-slate-500" />;
        }
    };

    const getEventLabel = (type: string) => {
        switch (type) {
            case 'deletion': return 'מחיקת חייל';
            case 'create': return 'יצירת גיבוי';
            case 'restore': return 'שחזור מערכת';
            case 'delete': return 'מחיקת גיבוי';
            default: return 'פעולת מערכת';
        }
    };

    return (
        <div className={isEmbedded ? "" : "bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)] relative z-20"} dir="rtl">
            {/* Premium Header - Only show if not embedded */}
            {!isEmbedded && (
                <div className="flex flex-col md:flex-row items-center justify-between px-8 py-6 md:h-28 bg-white border-b border-slate-100 shrink-0 gap-4">
                    <div className="flex items-center gap-5 w-full md:w-auto">
                        <div className="w-14 h-14 bg-gradient-to-br from-slate-800 to-slate-950 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                            <Pulse size={28} weight="duotone" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">ניהול מערכת ואנליטיקה</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                                System Telemetry & Health
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                {organization?.name}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={() => loadData(true)}
                            disabled={isRefreshing}
                            className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs transition-all active:scale-95 ${isRefreshing ? 'bg-slate-100 text-slate-400' : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60'}`}
                        >
                            <ArrowsClockwise size={18} weight="bold" className={isRefreshing ? 'animate-spin' : ''} />
                            {isRefreshing ? 'מרענן...' : 'רענן נתונים'}
                        </button>
                        <div className="h-10 w-px bg-slate-100 mx-1 hidden md:block" />
                        <div className="bg-emerald-50 text-emerald-600 px-4 py-2.5 rounded-xl border border-emerald-100 flex items-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                            <span className="text-xs font-black">מחובר בזמן אמת</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Scrollable Content */}
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isEmbedded ? "" : "p-4 sm:p-6 md:p-8"} space-y-5 sm:space-y-6 md:space-y-8`}>

                {/* About Section - Informational */}
                <section className="bg-gradient-to-l from-blue-50/50 to-transparent p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-blue-100/50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-blue-100/20 rounded-full -ml-16 -mt-16 blur-3xl" />
                    <div className="relative z-10 flex flex-col md:flex-row gap-3 sm:gap-4 md:gap-6 items-start">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl md:rounded-2xl border border-blue-200 flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                            <Info size={20} className="md:size-[24px]" weight="duotone" />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 mb-1 md:mb-2 text-right">מה דף זה מציג?</h3>
                            <p className="text-slate-600 text-[11px] sm:text-xs md:text-sm font-medium leading-relaxed max-w-4xl text-right">
                                דף האנליטיקה מספק שקיפות מלאה על פעולות הליבה של הארגון. כאן ניתן לעקוב אחר שינויים משמעותיים בסד"כ, לוודא שהגיבויים תקינים, ולצפות בפיד פעילות בזמן אמת.
                            </p>
                        </div>
                    </div>
                </section>

                {loading ? (
                    <AnalyticsSkeleton />
                ) : (
                    <>
                        {/* Main Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                            <StatCard
                                title="אנשים"
                                value={summary?.active_people}
                                icon={Users}
                                color={{ bg: "bg-blue-100/50", text: "text-blue-600" }}
                                description="People"
                                tooltip="מספר החיילים המוגדרים כ'פעילים' כרגע במערכת."
                            />
                            <StatCard
                                title="מחיקות"
                                value={summary?.deletions_30d}
                                icon={Trash}
                                color={{ bg: "bg-rose-100/50", text: "text-rose-600" }}
                                description="Sec"
                                tooltip="כמות החיילים שהוסרו מהארגון ב-30 הימים האחרונים."
                            />
                            <StatCard
                                title="גיבויים"
                                value={summary?.snapshots_30d}
                                icon={Database}
                                color={{ bg: "bg-indigo-100/50", text: "text-indigo-600" }}
                                description="Backup"
                                tooltip="כמות הגיבויים המלאים שבוצעו החודש."
                            />
                            <StatCard
                                title="שחזורים"
                                value={summary?.restores_30d}
                                icon={ArrowsClockwise}
                                color={{ bg: "bg-amber-100/50", text: "text-amber-600" }}
                                description="Rec"
                                tooltip="כמות הפעמים שבוצע שחזור מידע מגיבוי קודם."
                            />
                        </div>

                        {/* Performance and Activity Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                            {/* System Performance & Health */}
                            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
                                <div className="bg-white border border-slate-200/60 rounded-2xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8">
                                    <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle
                                                cx={window.innerWidth < 640 ? "48" : "64"}
                                                cy={window.innerWidth < 640 ? "48" : "64"}
                                                r={window.innerWidth < 640 ? "42" : "58"}
                                                fill="transparent"
                                                stroke="#f1f5f9"
                                                strokeWidth={window.innerWidth < 640 ? "8" : "10"}
                                            />
                                            <circle
                                                cx={window.innerWidth < 640 ? "48" : "64"}
                                                cy={window.innerWidth < 640 ? "48" : "64"}
                                                r={window.innerWidth < 640 ? "42" : "58"}
                                                fill="transparent"
                                                stroke={
                                                    (summary?.health_score || 0) > 90 ? '#10b981' :
                                                        (summary?.health_score || 0) > 70 ? '#3b82f6' : '#f59e0b'
                                                }
                                                strokeWidth={window.innerWidth < 640 ? "8" : "10"}
                                                strokeDasharray={window.innerWidth < 640 ? 264 : 364}
                                                strokeDashoffset={(window.innerWidth < 640 ? 264 : 364) - ((window.innerWidth < 640 ? 264 : 364) * (summary?.health_score || 0)) / 100}
                                                strokeLinecap="round"
                                                className="transition-all duration-1000 ease-out"
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center translate-x-[2px] sm:translate-x-[4px]">
                                            <span className="text-xl sm:text-3xl font-black text-slate-800">{summary?.health_score || 0}%</span>
                                            <span className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">בריאות</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-3 sm:space-y-4 w-full text-center md:text-right">
                                        <div>
                                            <h3 className="text-base sm:text-lg font-black text-slate-800 mb-1">ביצועי מערכת ומסד נתונים</h3>
                                            <p className="text-[11px] sm:text-sm text-slate-500 font-bold">ניטור רציף של מהירויות תגובה ויציבות הגיבויים</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-right">
                                                <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">זמן תגובה</div>
                                                <div className="flex items-end justify-end gap-1">
                                                    <span className="text-lg sm:text-xl font-black text-slate-800">{summary?.avg_latency_ms || 0}</span>
                                                    <span className="text-[10px] sm:text-xs font-bold text-slate-500 mb-1">ms</span>
                                                </div>
                                            </div>
                                            <div className="bg-slate-50 border border-slate-100 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-right">
                                                <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">סטטוס סנכרון</div>
                                                <div className="flex items-center gap-1.5 sm:gap-2 text-emerald-600 font-black justify-end">
                                                    <Shield size={16} className="sm:size-[18px]" weight="duotone" />
                                                    <span className="text-sm sm:text-base">תקין</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Feed */}
                                <div className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col min-h-[400px] sm:min-h-[500px]">
                                    <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-5 md:py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                        <div className="text-right">
                                            <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                                                <Pulse size={18} weight="duotone" className="text-blue-500 sm:size-[20px]" />
                                                יומן אירועים אחרונים
                                            </h3>
                                            <p className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 sm:mt-1">Recent Activity</p>
                                        </div>
                                        <span className="bg-white border border-slate-200 text-slate-600 text-[8px] sm:text-[9px] md:text-[10px] font-black px-2 md:px-3 py-1 sm:py-1.5 rounded-lg shadow-sm whitespace-nowrap">
                                            {activity.length} פעולות
                                        </span>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                                        {activity.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center p-12 sm:p-20 text-center">
                                                <div className="w-12 h-12 sm:w-16 h-16 bg-slate-50 text-slate-200 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                                                    <Calendar size={28} className="sm:size-[32px]" weight="duotone" />
                                                </div>
                                                <h4 className="text-slate-800 font-black text-sm sm:text-base">אין אירועים להצגה</h4>
                                                <p className="text-slate-400 text-xs sm:text-sm font-medium mt-1">לא זוהתה פעילות מערכת חריגה בתקופה האחרונה</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                {activity.map((event, idx) => (
                                                    <div key={idx} className="px-3 sm:px-6 md:px-8 py-3 sm:py-4 md:py-5 hover:bg-slate-50/50 transition-colors group">
                                                        <div className="flex items-start gap-3 sm:gap-4 md:gap-5">
                                                            <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-lg sm:rounded-xl md:rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0 group-hover:border-blue-200 group-hover:shadow-md transition-all">
                                                                {React.cloneElement(getEventIcon(event.event_type) as React.ReactElement<{ size: number }>, { size: window.innerWidth < 640 ? 14 : (window.innerWidth < 768 ? 16 : 20) })}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-col md:flex-row md:items-center justify-between mb-1 text-right gap-1">
                                                                    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 md:gap-2">
                                                                        <h4 className="font-black text-slate-800 text-xs sm:text-sm md:text-base truncate max-w-[120px] sm:max-w-[150px] md:max-w-none">{event.event_name}</h4>
                                                                        <span className={`text-[8px] sm:text-[9px] md:text-[10px] font-black px-1 sm:px-1.5 md:px-2 py-0.5 rounded-md ${event.event_type === 'deletion' ? 'bg-rose-50 text-rose-600' :
                                                                            event.event_type === 'create' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                                                                            }`}>
                                                                            {getEventLabel(event.event_type)}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 bg-slate-50 px-1 sm:px-1.5 py-0.5 rounded-md self-start md:self-auto">
                                                                        {new Date(event.occurred_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center flex-wrap gap-x-2 sm:gap-x-3 md:gap-x-5 gap-y-0.5 text-[9px] sm:text-[10px] md:text-[11px] text-slate-500 font-bold justify-end">
                                                                    <span className="flex items-center gap-1 bg-slate-100/50 px-1 sm:px-1.5 py-0.5 rounded-md">
                                                                        <UserIcon size={10} weight="bold" className="text-slate-400 sm:size-[12px]" />
                                                                        {event.user_name || 'המערכת'}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar size={10} weight="bold" className="text-slate-400 sm:size-[12px]" />
                                                                        {new Date(event.occurred_at).toLocaleDateString('he-IL')}
                                                                    </span>
                                                                    <span className={`flex items-center gap-1 ${event.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                        <div className={`w-1 h-1 rounded-full ${event.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                                        {event.status === 'success' ? 'הושלם' : 'נכשל'}
                                                                    </span>
                                                                </div>
                                                                {event.metadata?.reason && (
                                                                    <div className="mt-1 sm:mt-2 relative">
                                                                        <div className="absolute inset-y-0 right-0 w-0.5 bg-rose-200 rounded-full" />
                                                                        <p className="pr-2 text-[9px] sm:text-[10px] md:text-xs text-slate-500 font-medium italic text-right">
                                                                            סיבה: {event.metadata.reason}
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="px-4 sm:px-6 md:px-8 py-3 sm:py-5 bg-slate-100/30 border-t border-slate-100">
                                        <button
                                            className="text-blue-600 font-black text-[10px] sm:text-xs hover:gap-2 transition-all flex items-center gap-1 justify-end w-full"
                                            onClick={() => onNavigate?.('logs')}
                                        >
                                            כל יומן הפעילות
                                            <ArrowRight size={14} className="sm:size-[16px]" mirrored />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Side Info & Nightly Status */}
                            <div className="lg:col-span-1 space-y-6 sm:space-y-8">
                                {/* Nightly Status Card */}
                                <div className={`
                            rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-sm flex flex-col border h-fit
                            ${summary?.last_nightly_status === 'success'
                                        ? 'bg-emerald-50/50 border-emerald-100/50'
                                        : summary?.last_nightly_status === 'failed'
                                            ? 'bg-rose-50 border-rose-100'
                                            : 'bg-orange-50 border-orange-100'}
                        `}>
                                    <div className="flex items-center justify-between mb-6 sm:mb-8">
                                        <div className={`
                                    w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center
                                    ${summary?.last_nightly_status === 'success' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-orange-500 text-white shadow-lg shadow-orange-100'}
                                `}>
                                            <Clock size={24} className="sm:size-[28px]" weight="duotone" />
                                        </div>
                                        <span className="text-[9px] sm:text-[10px] font-black opacity-40 uppercase tracking-widest">Nightly Health</span>
                                    </div>

                                    <div className="text-right">
                                        <h3 className="text-lg sm:text-xl font-black text-slate-800 mb-1 sm:mb-2">גיבוי לילי אחרון</h3>
                                        <div className="flex items-center gap-2 justify-end">
                                            <span className={`text-sm sm:text-base font-black ${summary?.last_nightly_status === 'success' ? 'text-emerald-700' : 'text-orange-700'}`}>
                                                {summary?.last_nightly_status === 'success' ? 'בוצע בהצלחה' : 'דרושה תשומת לב'}
                                            </span>
                                            <div className={`w-2 h-2 rounded-full animate-pulse ${summary?.last_nightly_status === 'success' ? 'bg-emerald-500' : 'bg-orange-500'}`} />
                                        </div>
                                    </div>

                                    <p className="text-[11px] sm:text-xs font-bold text-slate-500 leading-relaxed mt-4 sm:mt-6 text-right">
                                        {summary?.last_nightly_status === 'success'
                                            ? 'מערכת הגיבויים הלילית פועלת כסדרה. כל המידע הארגוני מאובטח ומשוכפל אוטומטית לענן.'
                                            : 'לא נמצא תיעוד של גיבוי לילי מוצלח ב-24 השעות האחרונות. כדאי לבצע גיבוי ידני.'}
                                    </p>

                                    <div className="mt-8 sm:mt-10 grid grid-cols-2 gap-4 border-t border-slate-100 pt-6 sm:pt-8">
                                        <div className="text-right">
                                            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase mb-0.5 sm:mb-1">מדיניות</p>
                                            <p className="text-xs sm:text-sm font-black text-slate-700">גיבוי לילי</p>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase mb-0.5 sm:mb-1">שמירה</p>
                                            <p className="text-xs sm:text-sm font-black text-slate-700">30 יום</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Tips */}
                                <div className="bg-slate-900 rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 text-white relative overflow-hidden">
                                    <div className="absolute bottom-0 right-0 opacity-10 scale-150 rotate-12">
                                        <Shield size={window.innerWidth < 640 ? 80 : 120} weight="duotone" />
                                    </div>
                                    <h3 className="text-base sm:text-lg font-black mb-3 sm:mb-4 flex items-center gap-2 text-right justify-end">
                                        אבטחת נתונים
                                        <Shield size={20} weight="duotone" className="text-blue-400 sm:size-[24px]" />
                                    </h3>
                                    <p className="text-slate-400 text-[11px] sm:text-sm font-medium leading-relaxed mb-5 sm:mb-6 text-right">
                                        המערכת מצלמת את כל הארגון בכל לילה. אם מחקתם מידע בטעות, ניתן לבצע שחזור מלא מניהול הגיבויים.
                                    </p>
                                    <button className="w-full py-3 sm:py-4 bg-white/10 hover:bg-white/20 rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-black transition-all border border-white/5">
                                        ניהול גיבויים
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
