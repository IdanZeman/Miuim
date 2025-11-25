import React, { useState } from 'react';
import { Calendar, Users, ClipboardList, BarChart2, Menu, User, Bell, LogOut, Clock, Settings, FileText, Shield, Layers } from 'lucide-react';
import { ViewMode } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from "@vercel/analytics/next"
import { analytics } from '../services/analytics';
import { logger } from '../services/loggingService';

interface LayoutProps {
  currentView?: ViewMode;
  setView?: (view: ViewMode) => void;
  children: React.ReactNode;
  isPublic?: boolean;
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
      {Icon && <Icon size={16} className={active ? 'text-idf-yellow-hover' : 'text-slate-400'} />}
      {/* Show text for active link always, hide for others on md-lg screens */}
      <span className={active ? '' : 'hidden lg:inline'}>{label}</span>
      {/* Tooltip for inactive links when text is hidden */}
      {!active && (
        <span className="lg:hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 max-w-[150px]">
          {label}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></span>
        </span>
      )}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-idf-yellow mx-2 rounded-full"></span>
      )}
    </button>
  );
};

export const Layout: React.FC<LayoutProps> = ({ currentView, setView, children, isPublic = false }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, profile, organization, signOut } = useAuth();

  const handleLogout = async () => {
    analytics.trackButtonClick('logout', 'header');
    console.log('Logout clicked');
    try {
      await signOut();
      console.log('Signed out successfully');
      window.location.reload(); // Force reload to clear state
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="flex flex-col h-screen bg-idf-bg overflow-hidden font-sans">
      {/* White Header */}
      <header className="bg-white shadow-sm z-40 relative h-16 flex-none">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Right: Logo & Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              {/* IDF Logo Placeholder */}
              <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-lg font-bold text-slate-800 tracking-tight">
                {isPublic ? 'Miuim' : (organization?.name || 'Miuim')}
              </span>
            </div>

            {/* Desktop Nav - Hidden in Public Mode */}
            {!isPublic && setView && (
              <nav className="hidden md:flex items-center gap-0.5 lg:gap-1">
                {/* Dashboard - Visible to everyone */}
                <TopNavLink active={currentView === 'dashboard'} onClick={() => setView('dashboard')} label="לוח שיבוצים" icon={Calendar} />

                {/* Personnel & Tasks - Visible to Admin and Editor only */}
                {(profile?.role === 'admin' || profile?.role === 'editor') && (
                  <>
                    <TopNavLink active={currentView === 'personnel'} onClick={() => setView('personnel')} label="כוח אדם" icon={Users} />
                    <TopNavLink active={currentView === 'tasks'} onClick={() => setView('tasks')} label="משימות" icon={ClipboardList} />
                  </>
                )}

                {/* Attendance - Visible to Admin, Editor, and Attendance Manager */}
                {profile?.role !== 'viewer' && (
                  <TopNavLink active={currentView === 'attendance'} onClick={() => setView('attendance')} label="נוכחות וזמינות" icon={Clock} />
                )}

                {/* Stats - Visible to everyone */}
                <TopNavLink active={currentView === 'stats'} onClick={() => setView('stats')} label={(profile?.role === 'viewer' || profile?.role === 'attendance_only') ? 'דוח אישי' : 'דוחות'} icon={FileText} />

                {isAdmin && (
                  <>
                    <TopNavLink active={currentView === 'reports'} onClick={() => setView('reports')} label="דו״ח נוכחות" icon={Clock} />
                    <TopNavLink active={currentView === 'settings'} onClick={() => setView('settings')} label="הגדרות" icon={Settings} />
                    {profile?.email === 'idanzeman@gmail.com' && (
                      <TopNavLink active={currentView === 'logs'} onClick={() => setView('logs')} label="לוגים" icon={Shield} />
                    )}
                  </>
                )}
              </nav>
            )}
          </div>

          {/* Left: User Profile - Hidden in Public Mode */}
          {!isPublic && (
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-slate-600 hidden md:block">
                {user?.email?.split('@')[0] || 'משתמש'}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
                title="התנתק"
              >
                <LogOut size={20} />
              </button>
              <button className="md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                <Menu size={24} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Menu */}
      {!isPublic && isMobileMenuOpen && setView && (
        <>
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/30 z-40 md:hidden backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Menu panel - full height from top */}
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-2xl z-50 md:hidden overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-slate-800">תפריט ניווט</h2>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">{user?.email || 'משתמש'}</p>

              {/* Logout button */}
              <button
                onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}
                className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors text-sm border border-red-200"
              >
                <LogOut size={16} />
                <span>התנתק</span>
              </button>
            </div>

            {/* Menu Items */}
            <div className="p-4 flex flex-col gap-1">
              {/* Dashboard - Visible to everyone */}
              <button
                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'dashboard'
                  ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                  : 'hover:bg-slate-50 text-slate-700'
                  }`}
                onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false) }}
              >
                <Calendar size={22} className={currentView === 'dashboard' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                <span>לוח שיבוצים</span>
              </button>

              {/* Personnel & Tasks - Visible to Admin and Editor only */}
              {(profile?.role === 'admin' || profile?.role === 'editor') && (
                <>
                  <button
                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'personnel'
                      ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                      : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    onClick={() => { setView('personnel'); setIsMobileMenuOpen(false) }}
                  >
                    <Users size={22} className={currentView === 'personnel' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                    <span>ניהול כוח אדם</span>
                  </button>

                  <button
                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'tasks'
                      ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                      : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    onClick={() => { setView('tasks'); setIsMobileMenuOpen(false) }}
                  >
                    <ClipboardList size={22} className={currentView === 'tasks' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                    <span>משימות</span>
                  </button>
                </>
              )}

              {/* Attendance - Visible to Admin, Editor, and Attendance Manager */}
              {profile?.role !== 'viewer' && (
                <button
                  className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'attendance'
                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                    : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  onClick={() => { setView('attendance'); setIsMobileMenuOpen(false) }}
                >
                  <Clock size={22} className={currentView === 'attendance' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                  <span>נוכחות</span>
                </button>
              )}

              {/* Stats - Visible to everyone */}
              <button
                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'stats'
                  ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                  : 'hover:bg-slate-50 text-slate-700'
                  }`}
                onClick={() => { setView('stats'); setIsMobileMenuOpen(false) }}
              >
                <FileText size={22} className={currentView === 'stats' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                <span>{(profile?.role === 'viewer' || profile?.role === 'attendance_only') ? 'דוח אישי' : 'דוחות'}</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'reports'
                      ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                      : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    onClick={() => { setView('reports'); setIsMobileMenuOpen(false) }}
                  >
                    <Clock size={22} className={currentView === 'reports' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                    <span>ייצוא נתונים</span>
                  </button>

                  <button
                    className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'settings'
                      ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                      : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    onClick={() => { setView('settings'); setIsMobileMenuOpen(false) }}
                  >
                    <Settings size={22} className={currentView === 'settings' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                    <span>הגדרות</span>
                  </button>

                  {profile?.email === 'idanzeman@gmail.com' && (
                    <button
                      className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'logs'
                        ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                        : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      onClick={() => { setView('logs'); setIsMobileMenuOpen(false) }}
                    >
                      <Shield size={22} className={currentView === 'logs' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                      <span>לוגים</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto relative bg-idf-bg">
        {/* Green Hero Section - Responsive height */}
        <div className="bg-hero-pattern h-40 md:h-64 w-full absolute top-0 left-0 z-0">
          <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-8 lg:pt-10">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800">
              {currentView === 'dashboard' && 'השיבוצים שלי'}
              {currentView === 'personnel' && 'ניהול יחידה'}
              {currentView === 'attendance' && 'יומן נוכחות'}
              {currentView === 'tasks' && 'בנק משימות'}
              {currentView === 'stats' && 'מרכז נתונים'}
              {currentView === 'settings' && 'הגדרות ארגון'}
              {currentView === 'reports' && 'ייצוא נתונים'}
            </h1>
            <div className="w-12 md:w-16 h-1 md:h-1.5 bg-white/40 rounded-full mt-2 md:mt-3"></div>
          </div>
        </div>

        {/* Content Cards Container - Responsive spacing */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-24 md:pt-32 pb-6 md:pb-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
