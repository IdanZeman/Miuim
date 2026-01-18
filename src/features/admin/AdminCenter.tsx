import React, { useState } from 'react';
import {
    Pulse as ActivityIcon,
    ListBullets as ListIcon,
    ShieldCheck as ShieldIcon
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsDashboard } from './analytics/AnalyticsDashboard';
import { UserActivityStats } from './UserActivityStats';
import { useAuth } from '../auth/AuthContext';

type AdminTab = 'analytics' | 'logs';

export const AdminCenter: React.FC = () => {
    const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
    const { organization, profile } = useAuth();

    const canViewLogs = profile?.is_super_admin ||
        profile?.role === 'admin' ||
        profile?.permissions?.screens?.['logs'] === 'view' ||
        profile?.permissions?.screens?.['logs'] === 'edit';

    const tabs = [
        { id: 'analytics' as const, label: 'אנליטיקה ובריאות', icon: ActivityIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
        ...(canViewLogs ? [{ id: 'logs' as const, label: 'יומן פעילות משתמשים', icon: ListIcon, color: 'text-indigo-600', bg: 'bg-indigo-50' }] : [])
    ];

    if (!organization) return null;

    return (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-8rem)] relative z-20" dir="rtl">
            {/* Unified Premium Header with Tabs */}
            <div className="bg-white border-b border-slate-100 shrink-0">
                <div className="flex flex-col md:flex-row items-center justify-between px-8 py-6 md:h-24 gap-4">
                    <div className="flex items-center gap-5 w-full md:w-auto">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                            <ShieldIcon size={28} weight="duotone" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">מרכז ניהול ובקרה</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 flex items-center gap-2">
                                Admin Control Center
                                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                {organization?.name}
                            </p>
                        </div>
                    </div>

                    {/* Tab Switcher */}
                    <div className="flex bg-slate-50 border border-slate-200/60 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto relative z-30">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-5 py-2.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-2 font-black text-xs ${activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <tab.icon size={18} weight={activeTab === tab.id ? 'fill' : 'bold'} className={activeTab === tab.id ? tab.color : ''} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                        className="h-full"
                    >
                        {activeTab === 'analytics' ? (
                            <div className="h-full overflow-y-auto custom-scrollbar p-8 pt-4">
                                <AnalyticsDashboard isEmbedded={true} onNavigate={setActiveTab} />
                            </div>
                        ) : (
                            <div className="h-full overflow-y-auto custom-scrollbar">
                                <UserActivityStats isEmbedded={true} />
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

