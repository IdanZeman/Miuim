import React from 'react';
import { Calendar, Users, ClipboardList, Menu, LogOut, Clock, Settings, FileText, Shield, Dices, Mail, Anchor, Home, UserX, Package, Activity, HelpCircle } from 'lucide-react';
import { ViewMode } from '@/types';
import { useAuth } from '../../features/auth/AuthContext';
import { analytics } from '../../services/analytics';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentView?: ViewMode;
    setView?: (view: ViewMode) => void;
    checkAccess: (screen: ViewMode) => boolean;
    isPublic?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView, setView, checkAccess, isPublic = false }) => {
    const { user, profile, signOut } = useAuth();

    const handleLogout = async () => {
        analytics.trackButtonClick('logout', 'sidebar');
        try {
            await signOut();
            window.location.reload();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (isPublic || !isOpen || !setView) return null;

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 bg-slate-900/30 z-40 md:hidden backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Menu panel - full height from top */}
            <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 md:hidden overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-bold text-slate-800">תפריט ניווט</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{user?.email || 'משתמש'}</p>

                    <button
                        onClick={() => { handleLogout(); onClose(); }}
                        className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm border border-red-200"
                    >
                        <LogOut size={16} />
                        <span>התנתק</span>
                    </button>
                </div>

                <div className="p-4 pb-24 flex flex-col gap-1">
                    <button
                        className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'home'
                            ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                            : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        onClick={() => { setView('home'); onClose() }}
                    >
                        <Home size={22} className={currentView === 'home' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                        <span>בית</span>
                    </button>

                    {checkAccess('dashboard') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'dashboard'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('dashboard'); onClose() }}
                        >
                            <Calendar size={22} className={currentView === 'dashboard' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>לוח שיבוצים</span>
                        </button>
                    )}

                    {checkAccess('personnel') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'personnel'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('personnel'); onClose() }}
                        >
                            <Users size={22} className={currentView === 'personnel' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>ניהול כוח אדם</span>
                        </button>
                    )}

                    {checkAccess('tasks') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'tasks'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('tasks'); onClose() }}
                        >
                            <ClipboardList size={22} className={currentView === 'tasks' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>משימות</span>
                        </button>
                    )}

                    {checkAccess('constraints') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'constraints'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('constraints'); onClose() }}
                        >
                            <Anchor size={22} className={currentView === 'constraints' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>אילוצים</span>
                        </button>
                    )}

                    {checkAccess('attendance') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'absences'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('absences'); onClose() }}
                        >
                            <UserX size={22} className={currentView === 'absences' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>בקשות יציאה</span>
                        </button>
                    )}

                    {checkAccess('attendance') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'attendance'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('attendance'); onClose() }}
                        >
                            <Clock size={22} className={currentView === 'attendance' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>נוכחות</span>
                        </button>
                    )}

                    {checkAccess('stats') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'stats'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('stats'); onClose() }}
                        >
                            <FileText size={22} className={currentView === 'stats' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>{(profile?.role === 'viewer' || profile?.role === 'attendance_only') ? 'דוח אישי' : 'דוחות'}</span>
                        </button>
                    )}

                    {(profile?.is_super_admin ||
                        profile?.role === 'admin' ||
                        profile?.permissions?.screens?.['logs'] === 'view' ||
                        profile?.permissions?.screens?.['logs'] === 'edit') && (
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'org-logs'
                                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('org-logs'); onClose() }}
                            >
                                <Activity size={22} className={currentView === 'org-logs' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                <span>יומן פעילות</span>
                            </button>
                        )}

                    {checkAccess('equipment') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'equipment'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('equipment'); onClose() }}
                        >
                            <Package size={22} className={currentView === 'equipment' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>ניהול אמצעים (צלם)</span>
                        </button>
                    )}

                    {checkAccess('lottery') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'lottery'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('lottery'); onClose() }}
                        >
                            <Dices size={22} className={currentView === 'lottery' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>הגרלה</span>
                        </button>
                    )}

                    <button
                        className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'faq'
                            ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                            : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        onClick={() => { setView('faq'); onClose() }}
                    >
                        <HelpCircle size={22} className={currentView === 'faq' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                        <span>עזרה / מדריכים</span>
                    </button>
                    <button
                        className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'contact'
                            ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                            : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        onClick={() => { setView('contact'); onClose() }}
                    >
                        <Mail size={22} className={currentView === 'contact' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                        <span>צור קשר</span>
                    </button>

                    {checkAccess('settings') && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'settings'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('settings'); onClose() }}
                        >
                            <Settings size={22} className={currentView === 'settings' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>הגדרות</span>
                        </button>
                    )}

                    {profile?.is_super_admin && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'system' || currentView === 'logs' || currentView === 'tickets'
                                ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('system'); onClose() }}
                        >
                            <Shield size={22} className={(currentView === 'system' || currentView === 'logs' || currentView === 'tickets') ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                            <span>ניהול מערכת</span>
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};
