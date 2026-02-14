import React, { useState, useEffect } from 'react';
import { CalendarBlank as Calendar, Users, ClipboardText as ClipboardList, ChartBar as BarChart2, List as Menu, User, Bell, SignOut as LogOut, Clock, Gear as Settings, FileText, Shield, Stack as Layers, DiceTwo as Dices, EnvelopeSimple as Mail, Anchor, House as Home, UserMinus as UserX, Package, Pulse as Activity, Question as HelpCircle, Car, Buildings } from '@phosphor-icons/react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ViewMode, Organization } from '@/types';
import { SystemMessagePopup } from '../common/SystemMessagePopup';
import { useAuth } from '../../features/auth/AuthContext';
import { Analytics } from "@vercel/analytics/react"
import { analytics } from '../../services/analytics';
import { logger } from '../../services/loggingService';

interface LayoutProps {
  currentView?: ViewMode;
  setView?: (view: ViewMode) => void;
  isPublic?: boolean;
  activeOrgId?: string | null;
  onOrgChange?: (id: string) => void;
  battalionCompanies?: Organization[];
  onSearchOpen?: () => void;
  children?: React.ReactNode;
  isCompanySwitcherEnabled?: boolean;
}

import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export const Layout: React.FC<LayoutProps> = ({ currentView: propView, setView: propSetView, isPublic = false, onSearchOpen, children, activeOrgId, onOrgChange, battalionCompanies, isCompanySwitcherEnabled }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { user, profile, organization, signOut, checkAccess: contextCheckAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Map route to ViewMode for backward compatibility
  const getViewFromPath = (path: string): ViewMode => {
    const p = path === '/' ? 'home' : path.substring(1);
    return p as ViewMode; // Simplified for now
  };

  const currentView = propView || getViewFromPath(location.pathname);
  const setView = (view: ViewMode) => {
    if (propSetView) propSetView(view);
    const path = view === 'home' ? '/' : `/${view}`;
    navigate(path);
  };

  const checkAccess = (screen: ViewMode, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    // 1. Super Admin always has access
    if (profile?.is_super_admin) return true;

    // 2. Admin Role (Backward Compatibility - To be removed)
    if (profile?.role === 'admin') return true;

    // 3. Check explicit permissions object (New RBAC)
    if (profile?.permissions?.screens) {
      const access = profile?.permissions.screens[screen];
      if (access) {
        if (access === 'none') return false;
        if (requiredLevel === 'edit' && access !== 'edit') return false;
        return true;
      }
    }

    // 4. Fallback to context check (which we updated to be strict)
    if (contextCheckAccess) return contextCheckAccess(screen, requiredLevel);

    // 5. Default restrictive fallback
    return false;
  };

  const mainRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo(0, 0);
    }
  }, [location.pathname]);

  // Check if user is in battalion mode (HQ with battalion scope)
  const isBattalionMode = organization?.is_hq;
  const themeColor = isBattalionMode ? 'blue' : 'blue';
  const themeAccent = isBattalionMode ? 'blue-500' : 'blue-600';
  const themeBg = isBattalionMode ? 'blue-50' : 'blue-50';
  const themeShadow = isBattalionMode ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.3)';

  return (
    <div className={`flex flex-col h-screen overflow-hidden font-sans ${isBattalionMode ? 'bg-slate-50' : 'bg-idf-bg'}`}>
      <Analytics />
      {/* Navbar */}
      <Navbar
        currentView={currentView}
        setView={setView}
        isPublic={isPublic}
        checkAccess={checkAccess}
        onSearchOpen={onSearchOpen}
        activeOrgId={activeOrgId}
        onOrgChange={onOrgChange}
        battalionCompanies={battalionCompanies}
        isCompanySwitcherEnabled={isCompanySwitcherEnabled}
      />

      <SystemMessagePopup />

      {/* Mobile Menu Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        currentView={currentView}
        checkAccess={checkAccess}
        isPublic={isPublic}
      />

      {/* Mobile Bottom Navigation */}
      {!isPublic && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/50 z-50 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          <div className="flex justify-around items-center h-20 px-2">
            {!isBattalionMode && (
              <>
                <button
                  onClick={() => { setView('home'); setIsMobileMenuOpen(false); }}
                  className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'home' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                >
                  <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'home' ? `bg-${themeColor}-50` : ''}`}>
                    <Home size={22} className={currentView === 'home' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                  </div>
                  <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'home' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>בית</span>
                  {currentView === 'home' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                </button>

                {checkAccess('dashboard') && (
                  <button
                    onClick={() => { setView('dashboard'); setIsMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'dashboard' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                  >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'dashboard' ? `bg-${themeColor}-50` : ''}`}>
                      <Calendar size={22} className={currentView === 'dashboard' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                    </div>
                    <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'dashboard' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>שיבוצים</span>
                    {currentView === 'dashboard' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                  </button>
                )}

                {checkAccess('attendance') && (
                  <button
                    onClick={() => { setView('attendance'); setIsMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'attendance' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                  >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'attendance' ? `bg-${themeColor}-50` : ''}`}>
                      <Clock size={22} className={currentView === 'attendance' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                    </div>
                    <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'attendance' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>נוכחות</span>
                    {currentView === 'attendance' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                  </button>
                )}

                {checkAccess('gate') && (
                  <button
                    onClick={() => { setView('gate'); setIsMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'gate' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                  >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'gate' ? `bg-${themeColor}-50` : ''}`}>
                      <Car size={22} className={currentView === 'gate' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                    </div>
                    <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'gate' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>ש.ג</span>
                    {currentView === 'gate' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                  </button>
                )}
              </>
            )}

            {isBattalionMode && (
              <>
                <button
                  onClick={() => { setView('battalion-home'); setIsMobileMenuOpen(false); }}
                  className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'battalion-home' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                >
                  <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'battalion-home' ? `bg-${themeColor}-50` : ''}`}>
                    <Buildings size={22} className={currentView === 'battalion-home' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                  </div>
                  <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'battalion-home' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>מבט גדודי</span>
                  {currentView === 'battalion-home' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                </button>

                {checkAccess('battalion-personnel') && (
                  <button
                    onClick={() => { setView('battalion-personnel'); setIsMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'battalion-personnel' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                  >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'battalion-personnel' ? `bg-${themeColor}-50` : ''}`}>
                      <Users size={22} className={currentView === 'battalion-personnel' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                    </div>
                    <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'battalion-personnel' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>סד"כ גדודי</span>
                    {currentView === 'battalion-personnel' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                  </button>
                )}

                {checkAccess('battalion-attendance') && (
                  <button
                    onClick={() => { setView('battalion-attendance'); setIsMobileMenuOpen(false); }}
                    className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${currentView === 'battalion-attendance' ? `text-${themeColor}-600` : 'text-slate-400'}`}
                  >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${currentView === 'battalion-attendance' ? `bg-${themeColor}-50` : ''}`}>
                      <ClipboardList size={22} className={currentView === 'battalion-attendance' ? `fill-${themeColor}-200/40` : ''} weight="bold" />
                    </div>
                    <span className={`text-[10px] font-bold mt-1 transition-all ${currentView === 'battalion-attendance' ? 'opacity-100 scale-100' : 'opacity-70 scale-95'}`}>יומן נוכחות גדודי</span>
                    {currentView === 'battalion-attendance' && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`flex flex-col items-center justify-center flex-1 h-full relative transition-all duration-300 ${isMobileMenuOpen ? `text-${themeColor}-600` : 'text-slate-400'}`}
            >
              <div className={`p-2 rounded-xl transition-all duration-300 ${isMobileMenuOpen ? `bg-${themeColor}-50` : ''}`}>
                <Menu size={22} weight="bold" />
              </div>
              <span className="text-[10px] font-bold mt-1">תפריט</span>
              {isMobileMenuOpen && <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-${themeColor}-600 rounded-b-full shadow-[0_1px_4px_${themeShadow}]`} />}
            </button>
          </div>
        </div>
      )}

      {/* Main Content - Scrollable */}
      <main ref={mainRef} className={`flex-1 overflow-y-auto relative scroll-smooth ${isBattalionMode ? 'bg-slate-50' : 'bg-idf-bg'}`}>
        {/* Hero Section - Responsive height */}
        <div className={`${isBattalionMode ? 'bg-gradient-to-br from-blue-500 to-blue-600' : 'bg-hero-pattern'} h-32 md:h-40 w-full absolute top-0 left-0 z-0 transition-all shadow-inner`} />

        {/* Content Cards Container - Responsive spacing */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 pt-4 md:pt-6 pb-24 md:pb-10 min-h-full">
          {children || <Outlet />}
        </div>
      </main>
    </div>
  );
};

