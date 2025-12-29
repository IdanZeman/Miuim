import React, { useState, useRef, useEffect } from 'react';
import {
    Calendar, Users, ClipboardList, BarChart2, Menu, LogOut, Clock,
    Settings, FileText, Shield, Dices, Mail, Anchor, Home, UserX,
    Package, Activity, HelpCircle, ChevronDown, User as UserIcon,
    LayoutDashboard, Briefcase, Database, UserCog
} from 'lucide-react';
import { ViewMode, Profile } from '../../types';
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

// Dropdown Component
const NavDropdown = ({
    label,
    icon: Icon,
    isActive,
    children,
    testId
}: {
    label: string;
    icon: React.ElementType;
    isActive: boolean;
    children: React.ReactNode;
    testId?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    return (
        <div
            className="relative font-medium h-full flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            data-testid={testId}
        >
            <button
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all relative ${isActive || isOpen
                    ? 'text-blue-700 bg-blue-50/50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                aria-expanded={isOpen}
            >
                <Icon size={18} className={isActive ? 'text-blue-600' : 'text-slate-500'} />
                <span>{label}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} text-slate-400`} />

                {/* Active Indicator Line */}
                {isActive && (
                    <div className="absolute -bottom-4 left-0 right-0 h-0.5 bg-blue-600 rounded-t-full" />
                )}
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full right-0 w-60 pt-2 z-[100] animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 overflow-hidden ring-1 ring-black/5">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
};

const DropdownItem = ({
    label,
    icon: Icon,
    onClick,
    active,
    danger = false,
    testId
}: {
    label: string;
    icon?: React.ElementType;
    onClick: () => void;
    active?: boolean;
    danger?: boolean;
    testId?: string;
}) => (
    <button
        onClick={() => {
            onClick();
        }}
        data-testid={testId}
        className={`w-full text-right px-4 py-2.5 text-sm flex items-center gap-3 transition-colors ${active
            ? 'bg-blue-50 text-blue-700 font-medium'
            : danger
                ? 'text-red-600 hover:bg-red-50'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
    >
        {Icon && <Icon size={18} className={active ? 'text-blue-600' : danger ? 'text-red-500' : 'text-slate-500'} />}
        {label}
    </button>
);


const UserDropdown = ({
    user,
    profile,
    onLogout,
    children
}: {
    user: any;
    profile: Profile | null;
    onLogout: () => void;
    children: React.ReactNode
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'משתמש';

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border transition-all ${isOpen ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
            >
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <UserIcon size={18} />
                </div>
                <div className="hidden md:flex flex-col items-start min-w-[3rem] max-w-[8rem]">
                    <span className="text-xs font-bold text-slate-700 truncate w-full dir-ltr text-right">
                        {displayName}
                    </span>
                    <span className="text-[10px] text-slate-400">אזור אישי</span>
                </div>
                <ChevronDown size={14} className="text-slate-400 mr-1" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 py-2 overflow-hidden ring-1 ring-black/5">
                        <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                            <p className="text-sm font-bold text-slate-800">{displayName}</p>
                            <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                        </div>
                        <div className="py-1">
                            {children}
                        </div>
                        <div className="border-t border-slate-100 mt-1 pt-1">
                            <DropdownItem
                                label="התנתק"
                                icon={LogOut}
                                onClick={onLogout}
                                danger
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const Navbar: React.FC<NavbarProps> = ({ currentView, setView, isPublic = false, checkAccess, onMobileMenuToggle }) => {
    const { user, profile, organization, signOut } = useAuth();

    const handleLogout = async () => {
        analytics.trackButtonClick('logout', 'header');
        try {
            await signOut();
            window.location.reload();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const handleNav = (view: ViewMode) => {
        if (setView) setView(view);
    };

    return (
        <header className="bg-white/80 backdrop-blur-md shadow-sm z-40 relative h-16 flex-none border-b border-slate-200/50">
            <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between gap-4">

                {/* Logo & Brand */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => handleNav('home')}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        aria-label="חזרה לדף הבית"
                    >
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden p-1.5 border border-slate-100">
                            <img src="/images/new_icon.png" alt="App Logo" className="w-full h-full object-contain" aria-hidden="true" />
                        </div>
                        <span className="block text-lg font-bold text-slate-800 tracking-tight">
                            {isPublic ? 'מערכת ניהול' : (organization?.name || 'מערכת ניהול')}
                        </span>
                    </button>

                    {/* Desktop Navigation */}
                    {!isPublic && setView && (
                        <nav className="hidden md:flex items-center gap-1">

                            {/* 1. Personnel (Single Link) */}
                            {checkAccess('personnel') && (
                                <button
                                    onClick={() => handleNav('personnel')}
                                    className={`px-3 py-2 text-sm font-medium transition-all flex items-center gap-2 rounded-lg ${currentView === 'personnel'
                                        ? 'text-slate-900 bg-slate-50'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                        }`}
                                    aria-label="ניהול כוח אדם"
                                >
                                    <Users size={18} className={currentView === 'personnel' ? 'text-blue-600' : 'text-slate-500'} aria-hidden="true" />
                                    <span>ניהול כוח אדם</span>
                                </button>
                            )}

                            {/* 2. Tasks Group */}
                            {(checkAccess('tasks') || checkAccess('dashboard') || checkAccess('constraints')) && (
                                <NavDropdown
                                    label="משימות"
                                    icon={ClipboardList}
                                    isActive={['tasks', 'dashboard', 'constraints'].includes(currentView || '')}
                                >
                                    {checkAccess('tasks') && (
                                        <DropdownItem
                                            label="ניהול משימות"
                                            icon={ClipboardList}
                                            active={currentView === 'tasks'}
                                            onClick={() => handleNav('tasks')}
                                        />
                                    )}
                                    {checkAccess('dashboard') && (
                                        <DropdownItem
                                            label="לוח שיבוצים"
                                            icon={Calendar}
                                            active={currentView === 'dashboard'}
                                            onClick={() => handleNav('dashboard')}
                                        />
                                    )}
                                    {checkAccess('constraints') && (
                                        <DropdownItem
                                            label="ניהול אילוצים"
                                            icon={Anchor}
                                            active={currentView === 'constraints'}
                                            onClick={() => handleNav('constraints')}
                                        />
                                    )}
                                </NavDropdown>
                            )}

                            {/* 3. Attendance Group */}
                            {(checkAccess('attendance') || checkAccess('absences')) && (
                                <NavDropdown
                                    label="נוכחות והיעדרויות"
                                    icon={Clock}
                                    isActive={['attendance', 'absences'].includes(currentView || '')}
                                    testId="nav-attendance-group"
                                >
                                    {checkAccess('attendance') && (
                                        <DropdownItem
                                            label="יומן נוכחות"
                                            icon={Clock}
                                            active={currentView === 'attendance'}
                                            onClick={() => handleNav('attendance')}
                                            testId="nav-attendance-journal"
                                        />
                                    )}
                                    <DropdownItem
                                        label="בקשות יציאה"
                                        icon={UserX}
                                        active={currentView === 'absences'}
                                        onClick={() => handleNav('absences')}
                                        testId="nav-absence-requests"
                                    />
                                </NavDropdown>
                            )}

                            {/* 4. Logistics Group */}
                            {checkAccess('equipment') && (
                                <NavDropdown
                                    label="לוגיסטיקה"
                                    icon={Package}
                                    isActive={['equipment'].includes(currentView || '')}
                                >
                                    <DropdownItem
                                        label="רשימת ציוד"
                                        icon={Package}
                                        active={currentView === 'equipment'}
                                        onClick={() => handleNav('equipment')}
                                    />
                                </NavDropdown>
                            )}

                            {/* 5. Reports Group */}
                            {(checkAccess('stats') || checkAccess('org-logs')) && (
                                <NavDropdown
                                    label="דוחות"
                                    icon={BarChart2}
                                    isActive={['stats', 'org-logs'].includes(currentView || '')}
                                >
                                    {checkAccess('stats') && (
                                        <DropdownItem
                                            label="דוחות"
                                            icon={FileText}
                                            active={currentView === 'stats'}
                                            onClick={() => handleNav('stats')}
                                        />
                                    )}
                                    {(checkAccess('org-logs') || profile?.is_super_admin || profile?.role === 'admin') && (
                                        <DropdownItem
                                            label="יומן פעילות"
                                            icon={Activity}
                                            active={currentView === 'org-logs'}
                                            onClick={() => handleNav('org-logs')}
                                        />
                                    )}
                                </NavDropdown>
                            )}

                            {/* 6. More Group */}
                            <NavDropdown
                                label="עוד"
                                icon={Menu}
                                isActive={['lottery', 'contact', 'faq'].includes(currentView || '')}
                            >
                                {checkAccess('lottery') && (
                                    <DropdownItem
                                        label="הגרלות"
                                        icon={Dices}
                                        active={currentView === 'lottery'}
                                        onClick={() => handleNav('lottery')}
                                    />
                                )}
                                <DropdownItem
                                    label="צור קשר"
                                    icon={Mail}
                                    active={currentView === 'contact'}
                                    onClick={() => handleNav('contact')}
                                />
                                <DropdownItem
                                    label="מרכז מידע"
                                    icon={HelpCircle}
                                    active={currentView === 'faq'}
                                    onClick={() => handleNav('faq')}
                                />
                            </NavDropdown>

                        </nav>
                    )}
                </div>

                {/* Left: User Profile - Hidden in Public Mode & Mobile */}
                {!isPublic && (
                    <div className="hidden md:flex items-center justify-end gap-2 pl-2 flex-shrink-0">
                        <UserDropdown user={user} profile={profile} onLogout={handleLogout}>
                            {checkAccess('settings') && (
                                <DropdownItem
                                    label="הגדרות ארגון"
                                    icon={Settings}
                                    active={currentView === 'settings'}
                                    onClick={() => handleNav('settings')}
                                />
                            )}

                            {profile?.is_super_admin && (
                                <DropdownItem
                                    label="ניהול מערכת"
                                    icon={Shield}
                                    active={currentView === 'system'}
                                    onClick={() => handleNav('system')}
                                />
                            )}
                            <div className="bg-slate-50 my-1 py-1 border-t border-b border-slate-100">
                                <DropdownItem
                                    label="מרכז עזרה"
                                    icon={HelpCircle}
                                    active={currentView === 'faq'}
                                    onClick={() => handleNav('faq')}
                                />
                                <DropdownItem
                                    label="צור קשר"
                                    icon={Mail}
                                    active={currentView === 'contact'}
                                    onClick={() => handleNav('contact')}
                                />
                            </div>
                        </UserDropdown>
                    </div>
                )}
            </div>
        </header>
    );
};
