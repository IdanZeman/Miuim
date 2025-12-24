import React, { useState } from 'react';
import { Calendar, Users, ClipboardList, BarChart2, Menu, User, Bell, LogOut, Clock, Settings, FileText, Shield, Layers, Dices, Mail, Anchor, Home, UserX, Package, Activity } from 'lucide-react';
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
      {Icon && <Icon size={20} className={active ? 'text-idf-yellow-hover' : 'text-slate-400'} />}
      {/* Show text only for ACTIVE tab, or on HOVER, or on ultra-wide screens */}
      <span className={`whitespace-nowrap ${active ? 'font-bold block' : 'hidden group-hover:block min-[2000px]:block'}`}>
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
  const { user, profile, organization, signOut, checkAccess: contextCheckAccess } = useAuth();

  // ... (Access check logic remains the same, skipping lines for brevity if possible, keeping context stable)
  // Re-stating critical parts to ensure file integrity during replace
  const checkAccess = (screen: ViewMode): boolean => {
    // 1. Super Admin always has access
    if (profile?.is_super_admin) return true;

    // 2. Admin Role (Backward Compatibility)
    if (profile?.role === 'admin') return true;

    // 3. Check explicit permissions object (New RBAC)
    if (profile?.permissions?.screens) {
      const access = profile?.permissions.screens[screen];
      if (access) return access !== 'none';
    }

    // 4. Fallback to context check (which we updated to be strict)
    if (contextCheckAccess) return contextCheckAccess(screen);

    // 5. Default restrictive fallback
    return false;
  };

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
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4"> {/* Added gap-4 for safety */}
          {/* Right: Logo & Nav */}
          <div className="flex items-center gap-4 md:gap-8 flex-1 min-w-0 max-w-[calc(100%-220px)]"> {/* Increased safety margin */}
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
              <nav className="hidden md:flex items-center gap-1 overflow-visible"> {/* Allow overflow-visible if needed, but constrained by parent */}
                {/* Home - Visible to everyone */}
                <TopNavLink active={currentView === 'home'} onClick={() => setView('home')} label="בית" icon={Home} />

                {/* Dashboard - Visible to everyone */}
                {checkAccess('dashboard') && (
                  <TopNavLink active={currentView === 'dashboard'} onClick={() => setView('dashboard')} label="שיבוצים" icon={Calendar} />
                )}

                {/* Personnel */}
                {checkAccess('personnel') && (
                  <TopNavLink active={currentView === 'personnel'} onClick={() => setView('personnel')} label="כוח אדם" icon={Users} />
                )}

                {/* Tasks */}
                {checkAccess('tasks') && (
                  <TopNavLink active={currentView === 'tasks'} onClick={() => setView('tasks')} label="משימות" icon={ClipboardList} />
                )}

                {/* Constraints */}
                {checkAccess('constraints') && (
                  <TopNavLink active={currentView === 'constraints'} onClick={() => setView('constraints')} label="אילוצים" icon={Anchor} />
                )}



                {/* Absences - Before Attendance */}
                {checkAccess('attendance') && (
                  <TopNavLink active={currentView === 'absences'} onClick={() => setView('absences')} label="היעדרויות" icon={UserX} />
                )}

                {/* Attendance */}
                {checkAccess('attendance') && (
                  <TopNavLink active={currentView === 'attendance'} onClick={() => setView('attendance')} label="נוכחות" icon={Clock} />
                )}

                {/* Stats */}
                {(profile?.role === 'admin' || profile?.is_super_admin) && (
                  <TopNavLink active={currentView === 'org-logs'} onClick={() => setView('org-logs')} label="יומן פעילות" icon={Activity} />
                )}

                {checkAccess('stats') && (
                  <TopNavLink active={currentView === 'stats'} onClick={() => setView('stats')} label={(profile?.role === 'viewer' || profile?.role === 'attendance_only') ? 'דוח אישי' : 'דוחות'} icon={FileText} />
                )}

                {/* Equipment / Tzelem */}
                {checkAccess('equipment') && (
                  <TopNavLink active={currentView === 'equipment'} onClick={() => setView('equipment')} label="ניהול אמצעים" icon={Package} />
                )}

                {/* Lottery */}
                {checkAccess('lottery') && (
                  <TopNavLink active={currentView === 'lottery'} onClick={() => setView('lottery')} label="הגרלה" icon={Dices} />
                )}

                {/* Contact - Visible to everyone */}
                <TopNavLink active={currentView === 'contact'} onClick={() => setView('contact')} label="צור קשר" icon={Mail} />


                {checkAccess('settings') && (
                  <TopNavLink active={currentView === 'settings'} onClick={() => setView('settings')} label="הגדרות" icon={Settings} />
                )}

                {/* System Management (Admin Only) */}
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
              {/* Profile name - Hidden on small mobile */}
              <span className="text-sm font-medium text-slate-600 hidden sm:block md:block truncate text-ellipsis dir-ltr text-right" title={user?.email || ''}>
                {user?.email?.split('@')[0] || 'משתמש'}
              </span>

              {/* Logout button - Only visible on Desktop header */}
              {/* Logout button - Only visible on Desktop header */}
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

            <div className="p-4 pb-24 flex flex-col gap-1">
              {/* Home */}
              <button
                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'home'
                  ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                  : 'hover:bg-slate-50 text-slate-700'
                  }`}
                onClick={() => { setView('home'); setIsMobileMenuOpen(false) }}
              >
                <Home size={22} className={currentView === 'home' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                <span>בית</span>
              </button>

              {/* Dashboard - Visible to everyone */}
              {checkAccess('dashboard') && (
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
              )}

              {/* Personnel - Visible to Admin and Editor only */}
              {checkAccess('personnel') && (
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
              )}

              {/* Tasks */}
              {checkAccess('tasks') && (
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
              )}

              {/* Constraints */}
              {checkAccess('constraints') && (
                <button
                  className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'constraints'
                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                    : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  onClick={() => { setView('constraints'); setIsMobileMenuOpen(false) }}
                >
                  <Anchor size={22} className={currentView === 'constraints' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                  <span>אילוצים</span>
                </button>
              )}

              {/* Absences */}
              {checkAccess('attendance') && (
                <button
                  className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'absences'
                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                    : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  onClick={() => { setView('absences'); setIsMobileMenuOpen(false) }}
                >
                  <UserX size={22} className={currentView === 'absences' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                  <span>היעדרויות</span>
                </button>
              )}

              {/* Attendance - Visible to Admin, Editor, and Attendance Manager */}
              {checkAccess('attendance') && (
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
              {checkAccess('stats') && (
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
              )}

              {/* Organization Logs - Admin Only */}
              {(profile?.role === 'admin' || profile?.is_super_admin) && (
                <button
                  className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'org-logs'
                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                    : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  onClick={() => { setView('org-logs'); setIsMobileMenuOpen(false) }}
                >
                  <Activity size={22} className={currentView === 'org-logs' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                  <span>יומן פעילות</span>
                </button>
              )}

              {/* Equipment */}
              {checkAccess('equipment') && (
                <button
                  className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'equipment'
                    ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                    : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  onClick={() => { setView('equipment'); setIsMobileMenuOpen(false) }}
                >
                  <Package size={22} className={currentView === 'equipment' ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                  <span>ניהול אמצעים (צלם)</span>
                </button>
              )}

              {/* Lottery - Visible to everyone */}
              {checkAccess('lottery') && (
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
              )}

              {/* Contact - Visible to everyone */}
              <button
                className={`p-4 text-right font-medium rounded-xl flex items-center gap-3 transition-all ${currentView === 'contact'
                  ? 'bg-yellow-50 text-slate-900 font-bold border-r-4 border-idf-yellow'
                  : 'hover:bg-slate-50 text-slate-700'
                  }`}
                onClick={() => { setView('contact'); setIsMobileMenuOpen(false) }}
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
                  onClick={() => { setView('settings'); setIsMobileMenuOpen(false) }}
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
                  onClick={() => { setView('system'); setIsMobileMenuOpen(false) }}
                >
                  <Shield size={22} className={(currentView === 'system' || currentView === 'logs' || currentView === 'tickets') ? 'text-idf-yellow-hover' : 'text-slate-400'} />
                  <span>ניהול מערכת</span>
                </button>
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
              onClick={() => setView('home')}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Home size={20} className={currentView === 'home' ? 'fill-blue-100' : ''} />
              <span className="text-[10px] font-medium">בית</span>
            </button>

            {checkAccess('dashboard') && (
              <button
                onClick={() => setView('dashboard')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Calendar size={20} className={currentView === 'dashboard' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">שיבוצים</span>
              </button>
            )}

            {checkAccess('personnel') && (
              <button
                onClick={() => setView('personnel')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'personnel' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Users size={20} className={currentView === 'personnel' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">כוח אדם</span>
              </button>
            )}

            {checkAccess('tasks') && (
              <button
                onClick={() => setView('tasks')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'tasks' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ClipboardList size={20} className={currentView === 'tasks' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">משימות</span>
              </button>
            )}

            {checkAccess('attendance') && (
              <button
                onClick={() => setView('attendance')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'attendance' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Clock size={20} className={currentView === 'attendance' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">נוכחות</span>
              </button>
            )}

            {checkAccess('stats') && (
              <button
                onClick={() => setView('stats')}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'stats' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <BarChart2 size={20} className={currentView === 'stats' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">דוחות</span>
              </button>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${isMobileMenuOpen ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Menu size={20} />
              <span className="text-[10px] font-medium">תפריט</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main ref={mainRef} className="flex-1 overflow-y-auto relative bg-idf-bg scroll-smooth">
        {/* Green Hero Section - Responsive height */}
        <div className="bg-hero-pattern h-44 md:h-64 w-full absolute top-0 left-0 z-0 transition-all">
          <div className="max-w-7xl mx-auto px-4 pt-4 md:pt-8 lg:pt-10">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800">
              {currentView === 'home' && 'בית'}
              {currentView === 'dashboard' && 'השיבוצים שלי'}
              {currentView === 'personnel' && 'ניהול יחידה'}
              {currentView === 'attendance' && 'יומן נוכחות'}
              {currentView === 'tasks' && 'בנק משימות'}
              {currentView === 'stats' && 'מרכז נתונים'}
              {currentView === 'settings' && 'הגדרות ארגון'}
              {currentView === 'logs' && 'לוגים'}
              {currentView === 'org-logs' && 'יומן פעילות'}
              {currentView === 'lottery' && 'הגרלות'}
              {currentView === 'constraints' && 'ניהול אילוצים'}
              {currentView === 'absences' && 'ניהול היעדרויות'}
              {currentView === 'equipment' && 'דוח צלם / אמצעים'}
              {currentView === 'contact' && 'צור קשר'}
            </h1>
            <div className="w-12 md:w-16 h-1 md:h-1.5 bg-white/40 rounded-full mt-1.5 md:mt-3"></div>
          </div>
        </div>

        {/* Content Cards Container - Responsive spacing */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-24 md:pt-32 pb-24 md:pb-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
