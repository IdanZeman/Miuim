import React, { useState } from 'react';
import { CalendarBlank as Calendar, Users, ClipboardText as ClipboardList, ChartBar as BarChart2, List as Menu, User, Bell, SignOut as LogOut, Clock, Gear as Settings, FileText, Shield, Stack as Layers, DiceTwo as Dices, EnvelopeSimple as Mail, Anchor, House as Home, UserMinus as UserX, Package, Pulse as Activity, Question as HelpCircle, Car } from '@phosphor-icons/react';
import { ViewMode } from '@/types';
import { SystemMessagePopup } from '../common/SystemMessagePopup';
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

      <SystemMessagePopup />

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
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/50 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex justify-around items-center h-20 px-2"> {/* Rule 1: Generous 80px height for touch comfort */}
            <button
              onClick={() => { setView('home'); setIsMobileMenuOpen(false); }}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'home' ? 'text-blue-600' : 'text-slate-400'}`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'home' ? 'bg-blue-50' : ''}`}>
                <Home size={22} className={currentView === 'home' ? 'fill-blue-200/40' : ''} weight="duotone" />
              </div>
              <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'home' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>בית</span>
              {currentView === 'home' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full shadow-[0_1px_4px_rgba(37,99,235,0.3)]" />}
            </button>

            {checkAccess('dashboard') && (
              <button
                onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}
              >
                <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'dashboard' ? 'bg-blue-50' : ''}`}>
                  <Calendar size={22} className={currentView === 'dashboard' ? 'fill-blue-200/40' : ''} weight="duotone" />
                </div>
                <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'dashboard' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>שיבוצים</span>
                {currentView === 'dashboard' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full shadow-[0_1px_4px_rgba(37,99,235,0.3)]" />}
              </button>
            )}

            {checkAccess('attendance') && (
              <button
                onClick={() => { setView('attendance'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'attendance' ? 'text-blue-600' : 'text-slate-400'}`}
              >
                <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'attendance' ? 'bg-blue-50' : ''}`}>
                  <Clock size={22} className={currentView === 'attendance' ? 'fill-blue-200/40' : ''} weight="duotone" />
                </div>
                <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'attendance' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>נוכחות</span>
                {currentView === 'attendance' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full shadow-[0_1px_4px_rgba(37,99,235,0.3)]" />}
              </button>
            )}

            {checkAccess('gate') && (
              <button
                onClick={() => { setView('gate'); setIsMobileMenuOpen(false); }}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'gate' ? 'text-blue-600' : 'text-slate-400'}`}
              >
                <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'gate' ? 'bg-blue-50' : ''}`}>
                  <Car size={22} className={currentView === 'gate' ? 'fill-blue-200/40' : ''} weight="duotone" />
                </div>
                <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'gate' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>ש.ג</span>
                {currentView === 'gate' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full shadow-[0_1px_4px_rgba(37,99,235,0.3)]" />}
              </button>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${isMobileMenuOpen ? 'text-blue-600' : 'text-slate-400'}`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ${isMobileMenuOpen ? 'bg-blue-50' : ''}`}>
                <Menu size={22} weight="duotone" />
              </div>
              <span className="text-[10px] font-bold mt-1">תפריט</span>
              {isMobileMenuOpen && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-blue-600 rounded-b-full shadow-[0_1px_4px_rgba(37,99,235,0.3)]" />}
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main ref={mainRef} className="flex-1 overflow-y-auto relative bg-idf-bg scroll-smooth">
        {/* Green Hero Section - Responsive height */}
        {/* Green Hero Section - Responsive height */}
        <div className="bg-hero-pattern h-32 md:h-40 w-full absolute top-0 left-0 z-0 transition-all" />

        {/* Content Cards Container - Responsive spacing */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-4 md:pt-6 pb-24 md:pb-10 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
