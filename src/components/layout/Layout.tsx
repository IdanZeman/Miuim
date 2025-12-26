import React, { useState } from 'react';
import { Calendar, Users, ClipboardList, BarChart2, Menu, User, Bell, LogOut, Clock, Settings, FileText, Shield, Layers, Dices, Mail, Anchor, Home, UserX, Package, Activity, HelpCircle } from 'lucide-react';
import { ViewMode } from '@/types';
import { useAuth } from '../../features/auth/AuthContext';
import { Analytics } from "@vercel/analytics/next"
import { analytics } from '../../services/analytics';
import { logger } from '../../services/loggingService';

interface LayoutProps {
  currentView?: ViewMode;
  setView?: (view: ViewMode) => void;
  children: React.ReactNode;
  isPublic?: boolean;
}

import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

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
      {/* Navbar */}
      <Navbar
        currentView={currentView}
        setView={setView}
        isPublic={isPublic}
        checkAccess={checkAccess}
      />

      {/* Mobile Menu Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentView={currentView}
        setView={setView}
        checkAccess={checkAccess}
        isPublic={isPublic}
      />

      {/* Mobile Bottom Navigation */}
      {!isPublic && setView && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 pb-safe">
          <div className="flex justify-around items-center h-16">
            <button
              onClick={() => { setView('home'); setIsMobileMenuOpen(false); }}
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'home' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Home size={20} className={currentView === 'home' ? 'fill-blue-100' : ''} />
              <span className="text-[10px] font-medium">בית</span>
            </button>

            {checkAccess('dashboard') && (
              <button
                onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Calendar size={20} className={currentView === 'dashboard' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">שיבוצים</span>
              </button>
            )}

            {checkAccess('personnel') && (
              <button
                onClick={() => { setView('personnel'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'personnel' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Users size={20} className={currentView === 'personnel' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">כוח אדם</span>
              </button>
            )}

            {checkAccess('tasks') && (
              <button
                onClick={() => { setView('tasks'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'tasks' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ClipboardList size={20} className={currentView === 'tasks' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">משימות</span>
              </button>
            )}

            {checkAccess('attendance') && (
              <button
                onClick={() => { setView('attendance'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${currentView === 'attendance' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Clock size={20} className={currentView === 'attendance' ? 'fill-blue-100' : ''} />
                <span className="text-[10px] font-medium">נוכחות</span>
              </button>
            )}

            {checkAccess('stats') && (
              <button
                onClick={() => { setView('stats'); setIsMobileMenuOpen(false); }}
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
              {currentView === 'absences' && 'בקשות יציאה'}
              {currentView === 'equipment' && 'דוח צלם / אמצעים'}
              {currentView === 'faq' && 'מרכז עזרה'}
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
