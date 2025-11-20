import React from 'react';
import { Calendar, Users, ClipboardList, BarChart2, Menu, User, Bell, LogOut, Clock } from 'lucide-react';
import { ViewMode } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  children: React.ReactNode;
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
}) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium transition-all relative flex items-center gap-2 ${active
      ? 'text-slate-900 font-bold'
      : 'text-slate-500 hover:text-slate-800'
      }`}
  >
    {Icon && <Icon size={16} className={active ? 'text-idf-yellow-hover' : 'text-slate-400'} />}
    {label}
    {active && (
      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-idf-yellow mx-2 rounded-full"></span>
    )}
  </button>
);

export const Layout: React.FC<LayoutProps> = ({ currentView, setView, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, organization, signOut } = useAuth();

  const handleLogout = async () => {
    console.log('Logout clicked');
    try {
      await signOut();
      console.log('Signed out successfully');
      window.location.reload(); // Force reload to clear state
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

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
                {organization?.name || 'Miuim'}
              </span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              <TopNavLink active={currentView === 'dashboard'} onClick={() => setView('dashboard')} label="לוח שיבוצים" />
              <TopNavLink active={currentView === 'personnel'} onClick={() => setView('personnel')} label="כוח אדם" />
              <TopNavLink active={currentView === 'attendance'} onClick={() => setView('attendance')} label="נוכחות וזמינות" icon={Clock} />
              <TopNavLink active={currentView === 'tasks'} onClick={() => setView('tasks')} label="משימות" />
              <TopNavLink active={currentView === 'stats'} onClick={() => setView('stats')} label="דוחות" />
            </nav>
          </div>

          {/* Left: User Profile */}
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
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-16 left-0 right-0 bg-white shadow-lg z-50 p-4 flex flex-col gap-2 md:hidden">
          <button className="p-3 text-right font-medium hover:bg-slate-50 rounded-lg" onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false) }}>לוח שיבוצים</button>
          <button className="p-3 text-right font-medium hover:bg-slate-50 rounded-lg" onClick={() => { setView('personnel'); setIsMobileMenuOpen(false) }}>ניהול כוח אדם</button>
          <button className="p-3 text-right font-medium hover:bg-slate-50 rounded-lg" onClick={() => { setView('attendance'); setIsMobileMenuOpen(false) }}>נוכחות</button>
          <button className="p-3 text-right font-medium hover:bg-slate-50 rounded-lg" onClick={() => { setView('tasks'); setIsMobileMenuOpen(false) }}>משימות</button>
          <button className="p-3 text-right font-medium hover:bg-slate-50 rounded-lg" onClick={() => { setView('stats'); setIsMobileMenuOpen(false) }}>דוחות</button>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto relative bg-idf-bg">
        {/* Green Hero Section */}
        <div className="bg-hero-pattern h-64 w-full absolute top-0 left-0 z-0">
          <div className="max-w-7xl mx-auto px-4 pt-8 md:pt-10">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800">
              {currentView === 'dashboard' && 'השיבוצים שלי'}
              {currentView === 'personnel' && 'ניהול יחידה'}
              {currentView === 'attendance' && 'יומן נוכחות'}
              {currentView === 'tasks' && 'בנק משימות'}
              {currentView === 'stats' && 'מרכז נתונים'}
            </h1>
            <div className="w-16 h-1.5 bg-white/40 rounded-full mt-3"></div>
          </div>
        </div>

        {/* Content Cards Container */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-32 pb-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
