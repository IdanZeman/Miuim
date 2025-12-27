import React, { useState } from 'react';
import { Shield, MessageSquare, AlertCircle, LayoutDashboard, Megaphone } from 'lucide-react';

import { AdminLogsViewer } from '../features/admin/AdminLogsViewer';
import { SupportTicketsPage } from './SupportTicketsPage';
import { useAuth } from '../features/auth/AuthContext';

import { SystemStatsDashboard } from '../features/admin/SystemStatsDashboard';
import { SystemMessagesManager } from '../features/admin/SystemMessagesManager';

type Tab = 'dashboard' | 'logs' | 'tickets' | 'messages';

export const SystemManagementPage: React.FC = () => {
    const { user, profile } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('dashboard');

    // Double check access (though App.tsx also gates it)
    // Double check access (though App.tsx also gates it)
    if (!profile?.is_super_admin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
                <AlertCircle size={48} className="mb-4 text-red-400" />
                <h2 className="text-2xl font-bold text-slate-800">אין גישה</h2>
                <p>עמוד זה מיועד למנהלי מערכת בלבד.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                    <Shield className="text-slate-700" size={28} />
                    <h1 className="text-2xl font-bold text-slate-800">ניהול מערכת</h1>
                </div>
                <p className="text-slate-500">מרכז שליטה למנהלי מערכת: צפייה בלוגים וטיפול בפניות.</p>

                {/* Tabs */}
                <div className="flex gap-1 mt-6 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'dashboard'
                            ? 'bg-slate-100 text-slate-900 border-b-2 border-slate-900'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <LayoutDashboard size={16} />
                        דשבורד
                    </button>
                    <button
                        onClick={() => setActiveTab('logs')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'logs'
                            ? 'bg-slate-100 text-slate-900 border-b-2 border-slate-900'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <Shield size={16} />
                        לוגים מערכתיים
                    </button>
                    <button
                        onClick={() => setActiveTab('tickets')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'tickets'
                            ? 'bg-red-50 text-red-700 border-b-2 border-red-600'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <MessageSquare size={16} />
                        פניות ותמיכה
                    </button>
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${activeTab === 'messages'
                            ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        <Megaphone size={16} />
                        הודעות מערכת
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                {activeTab === 'dashboard' && <SystemStatsDashboard />}
                {activeTab === 'logs' && <AdminLogsViewer />}
                {activeTab === 'tickets' && <SupportTicketsPage />}
                {activeTab === 'messages' && <SystemMessagesManager />}
            </div>
        </div>
    );
};
