import React from 'react';
import { CalendarBlank as Calendar, Users, ClipboardText as ClipboardList, List as Menu, SignOut as LogOut, Clock, Gear as Settings, FileText, Shield, DiceSix as Dices, Envelope as Mail, Anchor, House as Home, UserMinus as UserX, Package, Pulse as Activity, Question as HelpCircle, Car, SquaresFour as LayoutDashboard, ChartBar as BarChart2 } from '@phosphor-icons/react';
import { ViewMode } from '@/types';
import { useAuth } from '../../features/auth/AuthContext';
import { analytics } from '../../services/analytics';
import { useNavigate, useLocation } from 'react-router-dom';
import * as Sentry from "@sentry/react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    currentView?: ViewMode;
    checkAccess: (screen: ViewMode, requiredLevel?: 'view' | 'edit') => boolean;
    isPublic?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentView: propView, checkAccess, isPublic = false }) => {
    const { user, profile, organization, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    // Map route to ViewMode for backward compatibility
    const getViewFromPath = (path: string): ViewMode => {
        if (path === '/') return 'home';
        return path.substring(1) as ViewMode;
    };

    const currentView = propView || getViewFromPath(location.pathname);

    const setView = (view: ViewMode) => {
        const path = view === 'home' ? '/' : `/${view}`;
        navigate(path);
    };

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
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                            <h2 className="text-lg font-black text-slate-900 leading-tight">
                                {organization?.battalion_id ? (organization.name || 'מבט גדודי') : (organization?.name || 'מערכת ניהול')}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 mt-0.5">{user?.email}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                        >
                            <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                    <button
                        onClick={() => { handleLogout(); onClose(); }}
                        className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm border border-red-200"
                    >
                        <LogOut size={16} weight="bold" />
                        <span>התנתק</span>
                    </button>
                </div>

                <div className="p-4 pb-24 flex flex-col gap-1">
                    {organization?.org_type === 'battalion' ? (
                        <>
                            <div className="pb-2 px-4">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ניהול גדוד</span>
                            </div>
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'home' || currentView === 'battalion-home'
                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('home'); onClose() }}
                            >
                                <LayoutDashboard size={22} weight="bold" className={currentView === 'home' || currentView === 'battalion-home' ? 'text-blue-500' : 'text-slate-400'} />
                                <span>תמונת מצב</span>
                            </button>
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'battalion-personnel'
                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('battalion-personnel'); onClose() }}
                            >
                                <Users size={22} weight="bold" className={currentView === 'battalion-personnel' ? 'text-blue-500' : 'text-slate-400'} />
                                <span>סד"כ גדודי</span>
                            </button>
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'battalion-attendance'
                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('battalion-attendance'); onClose() }}
                            >
                                <Calendar size={22} weight="bold" className={currentView === 'battalion-attendance' ? 'text-blue-500' : 'text-slate-400'} />
                                <span>נוכחות גדודית</span>
                            </button>
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'reports'
                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('reports'); onClose() }}
                            >
                                <BarChart2 size={22} weight="bold" className={currentView === 'reports' ? 'text-blue-500' : 'text-slate-400'} />
                                <span>שינויים בדוח 1</span>
                            </button>
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'battalion-settings' || currentView === 'settings'
                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('battalion-settings'); onClose() }}
                            >
                                <Settings size={22} weight="bold" className={currentView === 'battalion-settings' || currentView === 'settings' ? 'text-blue-500' : 'text-slate-400'} />
                                <span>הגדרות גדוד</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'home'
                                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                    : 'hover:bg-slate-50 text-slate-700'
                                    }`}
                                onClick={() => { setView('home'); onClose() }}
                            >
                                <Home size={22} weight="bold" className={currentView === 'home' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                <span>בית</span>
                            </button>

                            {/* Battalion Section - For users with battalion access */}
                            {(organization?.battalion_id || profile?.battalion_id) && (
                                <>
                                    <div className="pt-6 pb-2 px-4">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ניהול גדוד</span>
                                    </div>
                                    <button
                                        className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'battalion-home'
                                            ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                            : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        onClick={() => { setView('battalion-home'); onClose() }}
                                    >
                                        <Activity size={22} weight="bold" className={currentView === 'battalion-home' ? 'text-blue-500' : 'text-slate-400'} />
                                        <span>מבט גדודי</span>
                                    </button>

                                    {checkAccess('battalion') && (
                                        <>
                                            <button
                                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'battalion-personnel'
                                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                onClick={() => { setView('battalion-personnel'); onClose() }}
                                            >
                                                <Users size={22} weight="bold" className={currentView === 'battalion-personnel' ? 'text-blue-500' : 'text-slate-400'} />
                                                <span>סד"כ גדודי</span>
                                            </button>
                                            <button
                                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'battalion-attendance'
                                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                onClick={() => { setView('battalion-attendance'); onClose() }}
                                            >
                                                <Calendar size={22} weight="bold" className={currentView === 'battalion-attendance' ? 'text-blue-500' : 'text-slate-400'} />
                                                <span>נוכחות גדודית</span>
                                            </button>
                                            <button
                                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'reports'
                                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                onClick={() => { setView('reports'); onClose() }}
                                            >
                                                <BarChart2 size={22} weight="bold" className={currentView === 'reports' ? 'text-blue-500' : 'text-slate-400'} />
                                                <span>שינויים בדוח 1</span>
                                            </button>
                                            <button
                                                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'settings' && new URLSearchParams(window.location.search).get('tab') === 'battalion'
                                                    ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500'
                                                    : 'hover:bg-slate-50 text-slate-700'
                                                    }`}
                                                onClick={() => { navigate('/settings?tab=battalion'); onClose() }}
                                            >
                                                <Settings size={22} weight="bold" className={currentView === 'settings' && new URLSearchParams(window.location.search).get('tab') === 'battalion' ? 'text-blue-500' : 'text-slate-400'} />
                                                <span>הגדרות גדוד</span>
                                            </button>
                                        </>
                                    )}
                                </>
                            )}

                            <div className="pt-6 pb-2 px-4 md:hidden">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ניהול פלוגה</span>
                            </div>

                            {checkAccess('dashboard') && (
                                <button
                                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'dashboard'
                                        ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    onClick={() => { setView('dashboard'); onClose() }}
                                >
                                    <Calendar size={22} weight="bold" className={currentView === 'dashboard' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
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
                                    <Users size={22} weight="bold" className={currentView === 'personnel' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
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
                                    <ClipboardList size={22} weight="bold" className={currentView === 'tasks' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
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
                                    <Anchor size={22} weight="bold" className={currentView === 'constraints' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                    <span>אילוצים</span>
                                </button>
                            )}

                            {checkAccess('absences') && (
                                <button
                                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'absences'
                                        ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    onClick={() => { setView('absences'); onClose() }}
                                >
                                    <UserX size={22} weight="bold" className={currentView === 'absences' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
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
                                    <Clock size={22} weight="bold" className={currentView === 'attendance' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
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
                                    <FileText size={22} weight="bold" className={currentView === 'stats' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                    <span>{!checkAccess('stats', 'edit') ? 'דוח אישי' : 'דוחות'}</span>
                                </button>
                            )}

                            {checkAccess('org-logs') && (
                                <button
                                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'org-logs'
                                        ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    onClick={() => { setView('org-logs'); onClose() }}
                                >
                                    <Activity size={22} weight="bold" className={currentView === 'org-logs' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
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
                                    <Package size={22} weight="bold" className={currentView === 'equipment' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                    <span>ניהול אמצעים (צלם)</span>
                                </button>
                            )}

                            {checkAccess('gate') && (
                                <button
                                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'gate'
                                        ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    onClick={() => { setView('gate'); onClose() }}
                                >
                                    <Car size={22} weight="bold" className={currentView === 'gate' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                    <span>ש.ג</span>
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
                                    <Dices size={22} weight="bold" className={currentView === 'lottery' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                    <span>הגרלה</span>
                                </button>
                            )}

                            {checkAccess('settings') && (
                                <button
                                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'settings'
                                        ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                                        : 'hover:bg-slate-50 text-slate-700'
                                        }`}
                                    onClick={() => { setView('settings'); onClose() }}
                                >
                                    <Settings size={22} weight="bold" className={currentView === 'settings' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                                    <span>הגדרות</span>
                                </button>
                            )}
                        </>
                    )}

                    <div className="pt-6 pb-2 px-4">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">מערכת</span>
                    </div>

                    <button
                        className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'faq'
                            ? (organization?.org_type === 'battalion' ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500' : 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow')
                            : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        onClick={() => { setView('faq'); onClose() }}
                    >
                        <HelpCircle size={22} weight="bold" className={currentView === 'faq' ? (organization?.org_type === 'battalion' ? 'text-blue-500' : 'text-idf-yellow-hover') : 'text-slate-400'} />
                        <span>עזרה / מדריכים</span>
                    </button>
                    <button
                        className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'contact'
                            ? (organization?.org_type === 'battalion' ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500' : 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow')
                            : 'hover:bg-slate-50 text-slate-700'
                            }`}
                        onClick={() => { setView('contact'); onClose() }}
                    >
                        <Mail size={22} weight="bold" className={currentView === 'contact' ? (organization?.org_type === 'battalion' ? 'text-blue-500' : 'text-idf-yellow-hover') : 'text-slate-400'} />
                        <span>צור קשר</span>
                    </button>
                    <button
                        className="p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all hover:bg-red-50 text-red-600 border border-transparent hover:border-red-100"
                        onClick={() => {
                            const feedback = Sentry.getFeedback();
                            if (feedback) {
                                (feedback as any).openDialog();
                            }
                            onClose();
                        }}
                    >
                        <HelpCircle size={22} weight="bold" className="text-red-400" />
                        <span>דווח על באג / משוב</span>
                    </button>

                    {profile?.is_super_admin && (
                        <button
                            className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'system' || currentView === 'logs' || currentView === 'tickets'
                                ? (organization?.org_type === 'battalion' ? 'bg-blue-50 text-slate-900 font-bold border-r-4 border-blue-500' : 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow')
                                : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            onClick={() => { setView('system'); onClose() }}
                        >
                            <Shield size={22} weight="bold" className={(currentView === 'system' || currentView === 'logs' || currentView === 'tickets') ? (organization?.org_type === 'battalion' ? 'text-blue-500' : 'text-idf-yellow-hover') : 'text-slate-400'} />
                            <span>ניהול מערכת</span>
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};
