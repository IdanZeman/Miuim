import React from 'react';
import { Calendar, Users, ClipboardList, BarChart2, Menu, User, Bell, LogOut, Clock, Settings, FileText, Shield, Layers, Dices, Mail, Anchor, Home, UserX, Package, Activity, HelpCircle } from 'lucide-react';
import { ViewMode } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { analytics } from '../../services/analytics';
import { logger } from '../../services/loggingService';

interface NavbarProps {
    currentView?: ViewMode;
    setView?: (view: ViewMode) => void;
    isPublic?: boolean;
    checkAccess: (screen: ViewMode) => boolean;
    onMobileMenuToggle?: () => void;
}

const TopNavLink = ({
    active,
    onClick,
    label,
    icon: Icon
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    icon?: React.ElementType;
}) => {
    const handleClick = () => {
        analytics.trackButtonClick(label, 'top_nav');
        logger.logClick(label, 'top_nav');
        onClick();
    };

    return (
        <button
            onClick={handleClick}
            className={`px-3 md:px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2 group ${active
                ? 'text-slate-900 font-bold'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            title={label}
        >
            {Icon && <Icon size={20} className={active ? 'text-idf-yellow-hover' : 'text-slate-400'} />}
            <span className={`whitespace-nowrap ${active ? 'font-bold block' : 'hidden group-hover:block min-[2000px]:block'}`}>
                {label}
            </span>
            {active && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-idf-yellow mx-2 rounded-full"></span>
            )}
        </button>
    );
};

export const Navbar: React.FC<NavbarProps> = ({ currentView, setView, isPublic = false, checkAccess, onMobileMenuToggle }) => {
    const { user, profile, organization, signOut } = useAuth();

    const handleLogout = async () => {
        analytics.trackButtonClick('logout', 'header');
        console.log('Logout clicked');
        try {
            await signOut();
            console.log('Signed out successfully');
            window.location.reload();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    return (
        <header className="bg-white shadow-sm z-40 relative h-16 flex-none">
            <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">
                {/* Right: Logo & Nav */}
                <div className="flex items-center gap-4 md:gap-8 flex-1 min-w-0 max-w-[calc(100%-220px)]">
                    <button
                        onClick={() => setView && setView('home')}
                        className="flex items-center gap-1 hover:opacity-80 transition-opacity flex-shrink-0"
                    >
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden p-1.5 border border-slate-100">
                            <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap">
                            {isPublic ? 'מערכת לניהול פלוגה' : (organization?.name || 'מערכת לניהול פלוגה')}
                        </span>
                    </button>

                    {/* Desktop Nav - Hidden in Public Mode */}
                    {!isPublic && setView && (
                        <nav className="hidden md:flex items-center gap-1 overflow-visible">
                            <TopNavLink active={currentView === 'home'} onClick={() => setView('home')} label="בית" icon={Home} />

                            {checkAccess('dashboard') && (
                                <TopNavLink active={currentView === 'dashboard'} onClick={() => setView('dashboard')} label="שיבוצים" icon={Calendar} />
                            )}

                            {checkAccess('personnel') && (
                                <TopNavLink active={currentView === 'personnel'} onClick={() => setView('personnel')} label="כוח אדם" icon={Users} />
                            )}

                            {checkAccess('tasks') && (
                                <TopNavLink active={currentView === 'tasks'} onClick={() => setView('tasks')} label="משימות" icon={ClipboardList} />
                            )}

                            {checkAccess('constraints') && (
                                <TopNavLink active={currentView === 'constraints'} onClick={() => setView('constraints')} label="אילוצים" icon={Anchor} />
                            )}

                            {checkAccess('attendance') && (
                                <TopNavLink active={currentView === 'absences'} onClick={() => setView('absences')} label="היעדרויות" icon={UserX} />
                            )}

                            {checkAccess('attendance') && (
                                <TopNavLink active={currentView === 'attendance'} onClick={() => setView('attendance')} label="נוכחות" icon={Clock} />
                            )}

                            {(profile?.is_super_admin ||
                                profile?.role === 'admin' ||
                                profile?.permissions?.screens?.['logs'] === 'view' ||
                                profile?.permissions?.screens?.['logs'] === 'edit') && (
                                    <TopNavLink active={currentView === 'org-logs'} onClick={() => setView('org-logs')} label="יומן פעילות" icon={Activity} />
                                )}

                            {checkAccess('stats') && (
                                <TopNavLink active={currentView === 'stats'} onClick={() => setView('stats')} label={(profile?.role === 'viewer' || profile?.role === 'attendance_only') ? 'דוח אישי' : 'דוחות'} icon={FileText} />
                            )}

                            {checkAccess('equipment') && (
                                <TopNavLink active={currentView === 'equipment'} onClick={() => setView('equipment')} label="ניהול אמצעים" icon={Package} />
                            )}

                            {checkAccess('lottery') && (
                                <TopNavLink active={currentView === 'lottery'} onClick={() => setView('lottery')} label="הגרלה" icon={Dices} />
                            )}

                            <TopNavLink active={currentView === 'faq'} onClick={() => setView('faq')} label="עזרה" icon={HelpCircle} />
                            <TopNavLink active={currentView === 'contact'} onClick={() => setView('contact')} label="צור קשר" icon={Mail} />

                            {checkAccess('settings') && (
                                <TopNavLink active={currentView === 'settings'} onClick={() => setView('settings')} label="הגדרות" icon={Settings} />
                            )}

                            {profile?.is_super_admin && (
                                <TopNavLink
                                    active={currentView === 'system' || currentView === 'logs' || currentView === 'tickets'}
                                    onClick={() => setView('system')}
                                    label="ניהול מערכת"
                                    icon={Shield}
                                />
                            )}
                        </nav>
                    )}
                </div>

                {/* Left: User Profile - Hidden in Public Mode */}
                {!isPublic && (
                    <div className="flex items-center justify-end gap-2 pl-2 flex-shrink-0">
                        <span className="text-sm font-medium text-slate-600 hidden sm:block md:block truncate text-ellipsis dir-ltr text-right" title={user?.email || ''}>
                            {user?.email?.split('@')[0] || 'משתמש'}
                        </span>

                        <button
                            onClick={handleLogout}
                            className="hidden md:flex items-center gap-2 p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors flex-shrink-0"
                            title="התנתק"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                )}
            </div>
        </header>
    );
};
