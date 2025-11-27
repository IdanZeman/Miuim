import React, { useState } from 'react';
import { Calendar, Users, ClipboardList, BarChart2, Menu, User, Bell, LogOut, Clock, Settings, FileText, Shield, Layers, Dices, Mail } from 'lucide-react';
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
      {/* Show text for active link always, expand on hover for others */}
      <span className={`${active ? '' : 'hidden 2xl:inline 2xl:group-hover:inline'} whitespace-nowrap transition-all duration-200 ${!active && 'group-hover:inline'}`}>
        {label}
      </span>
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

  const mainRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [currentView]);

  return (
    <div className="flex flex-col h-screen bg-idf-bg overflow-hidden font-sans">
      {/* White Header */}
      <header className="bg-white shadow-sm z-40 relative h-16 flex-none">
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Right: Logo & Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-1">
              {/* IDF Logo Placeholder */}
              {/* App Logo */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                <img src="/images/app_icon.png" alt="App Logo" className="w-full h-full object-cover" />
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

                {/* Lottery - Visible to everyone */}
                <TopNavLink active={currentView === 'lottery'} onClick={() => setView('lottery')} label="הגרלה" icon={Dices} />
                <TopNavLink active={currentView === 'contact'} onClick={() => setView('contact')} label="צור קשר" icon={Mail} />

                {isAdmin && (
                  <>
                    <TopNavLink active={currentView === 'reports'} onClick={() => setView('reports')} label="דו״ח נוכחות" icon={Clock} />
                    <TopNavLink active={currentView === 'settings'} onClick={() => setView('settings')} label="הגדרות" icon={Settings} />
                    {isAdmin && user?.email === 'idanzeman@gmail.com' && (
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
              <button className="hidden md:hidden p-2" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
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
            <div className="p-4 pb-24 flex flex-col gap-1">
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

              {/* Lottery - Visible to everyone */}
              <button
                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'lottery'
                  ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                  : 'hover:bg-slate-50 text-slate-700'
                  }`}
                onClick={() => { setView('lottery'); setIsMobileMenuOpen(false) }}
              >
                <Dices size={22} className={currentView === 'lottery' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                <span>הגרלה</span>
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

                  {isAdmin && user?.email === 'idanzeman@gmail.com' && (
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

      {/* Mobile Bottom Navigation */}
      {!isPublic && setView && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
          <div className="flex justify-around items-center h-16">
            <button
              onClick={() => setView('dashboard')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Calendar size={20} className={currentView === 'dashboard' ? 'fill-blue-100' : ''} />
              <span className="text-[10px] font-medium">שיבוצים</span>
            </button>

            {(profile?.role === 'admin' || profile?.role === 'editor') && (
              <>
                <button
                  onClick={() => setView('personnel')}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'personnel' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Users size={20} className={currentView === 'personnel' ? 'fill-blue-100' : ''} />
                  <span className="text-[10px] font-medium">כוח אדם</span>
                </button>
                <button
                  onClick={() => setView('tasks')}
                  className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'tasks' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <ClipboardList size={20} className={currentView === 'tasks' ? 'fill-blue-100' : ''} />
                  <span className="text-[10px] font-medium">משימות</span>
                </button>
              </>
            )}

            <button
              onClick={() => setView('stats')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'stats' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <BarChart2 size={20} className={currentView === 'stats' ? 'fill-blue-100' : ''} />
              <span className="text-[10px] font-medium">דוחות</span>
            </button>

            <button
              onClick={() => setView('lottery')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'lottery' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Dices size={20} className={currentView === 'lottery' ? 'fill-blue-100' : ''} />
              <span className="text-[10px] font-medium">הגרלה</span>
            </button>

            {profile?.role !== 'viewer' && (
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isMobileMenuOpen ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Menu size={20} />
                <span className="text-[10px] font-medium">תפריט</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main ref={mainRef} className="flex-1 overflow-y-auto relative bg-idf-bg pb-20 md:pb-0">
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
              {currentView === 'logs' && 'לוגים'}
              {currentView === 'lottery' && 'הגרלות ופרסים'}
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
