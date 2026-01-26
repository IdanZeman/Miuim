import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    UsersIcon as Users,
    BuildingsIcon as Building2,
    GearIcon as Settings,
    BellIcon as Bell,
    CaretDownIcon as ChevronDown,
    SignOutIcon as LogOut,
    UserIcon,
    QuestionIcon as HelpCircle,
    EnvelopeIcon as Mail,
    ShieldCheckIcon,
    MagnifyingGlass,
    PackageIcon,
    SquaresFourIcon as LayoutDashboard,
    ClipboardTextIcon as ClipboardList,
    CalendarBlankIcon as Calendar,
    ClockIcon,
    UserMinusIcon as UserX,
    CarIcon,
    ChartBarIcon as BarChart3,
    FileTextIcon,
    AnchorIcon,
    ActivityIcon as Pulse,
    DiceFiveIcon as Dices,
    ShieldCheckIcon as Shield
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewMode, Profile } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { analytics } from '../../services/analytics';
import { fetchBattalion } from '../../services/battalionService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging tailwind classes efficiently
 */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface NavbarProps {
    currentView?: ViewMode;
    setView?: (view: ViewMode) => void;
    isPublic?: boolean;
    checkAccess: (screen: ViewMode) => boolean;
    onMobileMenuToggle?: () => void;
    onSearchOpen?: () => void;
}

interface NavItem {
    id: string;
    label: string;
    icon: any;
    primaryView: ViewMode;
    views: ViewMode[];
    isSpecial?: boolean;
    subItems?: {
        label: string;
        view: ViewMode;
        icon: any;
        description?: string;
    }[];
}

const TABS: NavItem[] = [
    {
        id: 'battalion',
        label: 'ניהול גדודי',
        icon: Building2,
        primaryView: 'battalion-home',
        views: ['battalion-home', 'battalion-personnel', 'battalion-attendance'],
        isSpecial: true,
        subItems: [
            { label: 'מבט גדודי', view: 'battalion-home', icon: LayoutDashboard, description: 'סיכום נתונים וסטטיסטיקות גדוד' },
            { label: 'סד"כ גדודי', view: 'battalion-personnel', icon: Users, description: 'ניהול כוח אדם רוחבי בגדוד' },
            { label: 'נוכחות גדודית', view: 'battalion-attendance', icon: Calendar, description: 'ריכוז נוכחות מכל הפלוגות' },
            { label: 'שינויים בדוח 1', view: 'reports', icon: BarChart3, description: 'דוח בוקר והשוואת שינויים יומי' }
        ]
    },
    {
        id: 'hr',
        label: 'אנשים ונוכחות',
        icon: Users,
        primaryView: 'personnel',
        views: ['personnel', 'attendance', 'absences', 'lottery'],
        subItems: [
            { label: 'ניהול כוח אדם', view: 'personnel', icon: Users, description: 'ניהול חיילים, צוותים ותפקידים' },
            { label: 'יומן נוכחות', view: 'attendance', icon: ClockIcon, description: 'מעקב נוכחות ודוחות יומיים' },
            { label: 'בקשות יציאה', view: 'absences', icon: UserX, description: 'ניהול היעדרויות ואישורי חופשה' },
            { label: 'הגרלות', view: 'lottery', icon: Dices, description: 'הגרלת זוכים' }
        ]
    },
    {
        id: 'ops',
        label: 'מבצעים ומשימות',
        icon: ClipboardList,
        primaryView: 'tasks',
        views: ['tasks', 'dashboard', 'constraints'],
        subItems: [
            { label: 'ניהול משימות', view: 'tasks', icon: ClipboardList, description: 'הגדרת משימות וסיבובי שמירה' },
            { label: 'לוח שיבוצים', view: 'dashboard', icon: Calendar, description: 'מבט שבועי על כל המשימות' },
            { label: 'ניהול אילוצים', view: 'constraints', icon: AnchorIcon, description: 'ניהול חסימות וזמינות אישית' }
        ]
    },
    {
        id: 'logistics',
        label: 'לוגיסטיקה',
        icon: PackageIcon,
        primaryView: 'equipment',
        views: ['equipment', 'gate'],
        subItems: [
            { label: 'רשימת ציוד', view: 'equipment', icon: PackageIcon, description: 'מעקב אחר אקסים, נשקים וציוד' },
            { label: 'ש.ג ורכבים', view: 'gate', icon: CarIcon, description: 'רישום כניסות וניהול רכבים' }
        ]
    },
    {
        id: 'admin',
        label: 'דוחות וניהול',
        icon: Pulse,
        primaryView: 'stats',
        views: ['stats', 'settings', 'system', 'org-logs', 'admin-analytics', 'admin-center'],
        subItems: [
            { label: 'מרכז ניהול ובקרה', view: 'admin-center', icon: Shield, description: 'אנליטיקה, בריאות המערכת ויומני פעילות' },
            { label: 'דוחות ונתונים', view: 'stats', icon: BarChart3, description: 'ניתוח עומסים וסטטיסטיקות' },
        ]
    },
];

const NavDropdown = ({ tab, isActive, currentView, onNav }: { tab: NavItem, isActive: boolean, currentView: ViewMode, onNav: (v: ViewMode) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    const Icon = tab.icon;

    return (
        <div
            className="relative h-full flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                onClick={() => onNav(tab.primaryView)}
                className={cn(
                    "relative flex items-center gap-2 px-4 py-2 text-sm font-bold transition-all duration-300 rounded-xl z-10",
                    isActive
                        ? (tab.isSpecial ? "text-amber-700 hover:text-amber-800" : "text-slate-900 hover:text-slate-950")
                        : "text-slate-500 hover:text-slate-800"
                )}
            >
                {isActive && (
                    <motion.div
                        layoutId="navbar-active-pill"
                        className={cn(
                            "absolute inset-0 rounded-xl shadow-sm z-[-1]",
                            tab.isSpecial ? "bg-amber-100/50" : "bg-white"
                        )}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                )}

                <Icon className={cn(
                    "w-4 h-4",
                    isActive
                        ? (tab.isSpecial ? "text-amber-600" : "text-blue-600")
                        : "text-slate-400"
                )} />
                <span>{tab.label}</span>
                {tab.subItems && (
                    <ChevronDown className={cn("w-3 h-3 transition-transform duration-200 opacity-50", isOpen && "rotate-180")} />
                )}
            </button>

            <AnimatePresence>
                {isOpen && tab.subItems && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute top-full left-0 md:left-auto md:right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-[100] ring-1 ring-black/5"
                    >
                        <div className="space-y-1">
                            {tab.subItems.map((item) => {
                                const SubIcon = item.icon;
                                const isSubActive = currentView === item.view;

                                return (
                                    <button
                                        key={item.view}
                                        onClick={() => { onNav(item.view); setIsOpen(false); }}
                                        className={cn(
                                            "w-full flex items-start gap-4 px-3 py-2.5 rounded-xl transition-all group text-right",
                                            isSubActive
                                                ? (tab.isSpecial ? "bg-amber-50" : "bg-blue-50")
                                                : "hover:bg-slate-50"
                                        )}
                                    >
                                        <div className={cn(
                                            "mt-0.5 p-1.5 rounded-lg border transition-colors",
                                            isSubActive
                                                ? (tab.isSpecial ? "bg-white border-amber-200 text-amber-600" : "bg-white border-blue-200 text-blue-600")
                                                : "bg-slate-50 border-slate-100 text-slate-400 group-hover:text-slate-600 group-hover:bg-white group-hover:border-slate-200"
                                        )}>
                                            <SubIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex flex-col items-start leading-tight">
                                            <span className={cn(
                                                "text-sm font-black transition-colors text-right w-full",
                                                isSubActive
                                                    ? (tab.isSpecial ? "text-amber-900" : "text-blue-900")
                                                    : "text-slate-700 group-hover:text-slate-900"
                                            )}>
                                                {item.label}
                                            </span>
                                            {item.description && (
                                                <span className="text-[10px] font-bold text-slate-400 mt-0.5 text-right w-full">
                                                    {item.description}
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const Navbar: React.FC<NavbarProps> = ({ currentView, setView, isPublic = false, checkAccess, onSearchOpen }) => {
    const { user, profile, organization, signOut } = useAuth();
    const [battalionName, setBattalionName] = useState<string | null>(null);
    const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

    // Only fetch and display battalion name for HQ users with battalion permissions
    // Regular company users should see their company name
    useEffect(() => {
        const bid = organization?.battalion_id;
        const isHQUser = organization?.is_hq && (
            profile?.permissions?.dataScope === 'battalion'
        );

        if (bid && isHQUser) {
            fetchBattalion(bid)
                .then(b => setBattalionName(b.name))
                .catch(err => console.error('Failed to fetch battalion name', err));
        } else {
            setBattalionName(null);
        }
    }, [organization?.battalion_id, organization?.is_hq, profile?.permissions?.dataScope, profile?.is_super_admin]);

    const activeTabId = useMemo(() => {
        return TABS.find(tab => tab.views.includes(currentView || 'home'))?.id || null;
    }, [currentView]);

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

    const isBattalionOrg = organization?.org_type === 'battalion';

    const filteredTabs = useMemo(() => {
        if (isBattalionOrg) {
            // For Battalion organizations, we flatten the battalion sub-items as top-level tabs
            const battalionTab = TABS.find(t => t.id === 'battalion');
            if (!battalionTab || !battalionTab.subItems) return [];

            return battalionTab.subItems.map(item => ({
                id: `battalion-${item.view}`,
                label: item.label,
                icon: item.icon,
                primaryView: item.view,
                views: [item.view],
                isSpecial: true
            }));
        }

        // Standard company filtering logic
        return TABS.reduce<NavItem[]>((acc, tab) => {
            // Special logic for Battalion Tab: Hide if NOT in HQ context
            if (tab.id === 'battalion' && (!organization || !organization.is_hq)) {
                return acc;
            }

            // Filter sub-items based on access
            const visibleSubItems = tab.subItems?.filter(item => checkAccess(item.view)) || [];

            // Determine the actual default view for this tab
            let actualPrimaryView = tab.primaryView;
            const isPrimaryAccessible = checkAccess(tab.primaryView);

            if (!isPrimaryAccessible && visibleSubItems.length > 0) {
                actualPrimaryView = visibleSubItems[0].view;
            }

            // If the main view is accessible OR there are visible sub-items, show the tab
            if (isPrimaryAccessible || visibleSubItems.length > 0) {
                acc.push({
                    ...tab,
                    primaryView: actualPrimaryView,
                    subItems: visibleSubItems.length > 0 ? visibleSubItems : undefined
                });
            }

            return acc;
        }, []);
    }, [isBattalionOrg, organization?.is_hq, checkAccess]);

    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'משתמש';
    const userInitials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <header className="sticky top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50 h-16 flex-none">
            <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-full flex items-center justify-between">

                <div className="flex items-center gap-4 sm:min-w-[200px] shrink-0">
                    <button
                        onClick={() => handleNav('home')}
                        className="flex items-center gap-2 sm:gap-3 px-1 sm:px-2 py-1.5 rounded-xl transition-all group"
                    >
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden shrink-0">
                            <img src="/images/logo.webp" alt="Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
                        </div>

                        <div className="flex flex-col items-start leading-tight text-right overflow-hidden">
                            <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors truncate max-w-[120px] sm:max-w-none">
                                {battalionName ? battalionName : (organization?.name || 'מערכת ניהול')}
                            </span>
                        </div>
                    </button>
                </div>

                {!isPublic && (
                    <nav className="hidden md:flex items-center bg-slate-50/50 p-1 rounded-2xl border border-slate-100 shadow-sm gap-0.5 h-12">
                        {filteredTabs.map((tab) => (
                            <NavDropdown
                                key={tab.id}
                                tab={tab}
                                isActive={activeTabId === tab.id}
                                currentView={currentView || 'home'}
                                onNav={handleNav}
                            />
                        ))}
                    </nav>
                )}

                <div className="flex items-center justify-end gap-2 sm:gap-3 sm:min-w-[200px] shrink-0">
                    {!isPublic && (
                        <>
                            <button
                                id="tour-search-trigger"
                                onClick={onSearchOpen}
                                className="hidden 2xl:flex items-center gap-3 px-4 py-2 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-blue-200 border border-slate-200/60 rounded-xl transition-all group relative"
                                title="חיפוש מהיר (Ctrl+K)"
                            >
                                <MagnifyingGlass size={18} weight="bold" className="text-slate-400 group-hover:text-blue-600 transition-all group-hover:scale-110" />
                                <span className="text-slate-400 font-bold text-xs group-hover:text-slate-600 transition-colors">חיפוש מהיר...</span>
                            </button>

                            {/* Mobile Search Icon */}
                            <button
                                id="tour-search-trigger-mobile"
                                onClick={onSearchOpen}
                                className="2xl:hidden flex items-center justify-center w-10 h-10 bg-slate-50/50 border border-slate-200/60 rounded-xl text-slate-400 active:scale-95 transition-all"
                            >
                                <MagnifyingGlass size={20} weight="bold" />
                            </button>

                            <div className="w-px h-6 bg-slate-100 mx-1 hidden sm:block" />

                            <div
                                className="relative hidden md:flex flex-col items-center"
                                onMouseEnter={() => setIsProfileDropdownOpen(true)}
                                onMouseLeave={() => {
                                    setTimeout(() => setIsProfileDropdownOpen(false), 200);
                                }}
                            >
                                <button
                                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                    className="flex items-center gap-3 pl-3 pr-1.5 py-1.5 bg-blue-50/30 hover:bg-blue-50 border border-blue-100/50 hover:border-blue-200 rounded-full transition-all group"
                                >
                                    <div className="w-8 h-8 rounded-full bg-white border border-blue-100 flex items-center justify-center text-slate-400 group-hover:text-blue-600 shadow-sm">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div className="flex flex-col items-start leading-none min-w-[60px]">
                                        <span className="text-xs font-black text-slate-800 mb-0.5">{displayName}</span>
                                        <span className="text-[10px] font-bold text-slate-400 group-hover:text-blue-500 transition-colors">אזור אישי</span>
                                    </div>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors opacity-50 group-hover:opacity-100" />
                                </button>

                                <AnimatePresence>
                                    {isProfileDropdownOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute top-full left-0 pt-3 w-64 z-[110]"
                                        >
                                            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 overflow-hidden ring-1 ring-black/5">
                                                <div className="px-3 py-3 border-b border-slate-50 mb-1 text-right">
                                                    <p className="text-sm font-black text-slate-800">{displayName}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5 uppercase tracking-tighter">{user?.email}</p>
                                                </div>

                                                <div className="space-y-0.5">
                                                    {checkAccess('settings') && (
                                                        <button
                                                            onClick={() => { handleNav('settings'); setIsProfileDropdownOpen(false); }}
                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all text-right"
                                                        >
                                                            <Settings className="w-4 h-4" />
                                                            <span>הגדרות ארגון</span>
                                                        </button>
                                                    )}
                                                    {organization?.battalion_id && organization?.is_hq && checkAccess('battalion-settings') && (
                                                        <button
                                                            onClick={() => { handleNav('battalion-settings'); setIsProfileDropdownOpen(false); }}
                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all text-right"
                                                        >
                                                            <Building2 className="w-4 h-4" />
                                                            <span>הגדרות גדוד</span>
                                                        </button>
                                                    )}
                                                    {profile?.is_super_admin && (
                                                        <button
                                                            onClick={() => { handleNav('system'); setIsProfileDropdownOpen(false); }}
                                                            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all text-right"
                                                        >
                                                            <Shield className="w-4 h-4" />
                                                            <span>ניהול מערכת</span>
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="h-px bg-slate-50 my-1 mx-2" />

                                                <div className="space-y-0.5">
                                                    <button
                                                        onClick={() => { handleNav('faq'); setIsProfileDropdownOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all text-right"
                                                    >
                                                        <HelpCircle className="w-4 h-4" />
                                                        <span>מדריכי שימוש</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { handleNav('contact'); setIsProfileDropdownOpen(false); }}
                                                        className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all text-right"
                                                    >
                                                        <Mail className="w-4 h-4" />
                                                        <span>צור קשר ומשוב</span>
                                                    </button>
                                                </div>

                                                <div className="h-px bg-slate-50 my-1 mx-2" />

                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-all text-right"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    <span>התנתק</span>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};
