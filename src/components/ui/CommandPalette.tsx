import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MagnifyingGlass,
    Users,
    X,
    Buildings,
    Calendar,
    Clock,
    ClipboardText,
    Gear,
    Shield,
    IdentificationCard,
    ArrowSquareOut,
    UserMinus,
    DiceFive,
    Anchor,
    Package,
    Car,
    ChartBar,
    FileText,
    SquaresFour,
    Pulse,
    Icon as PhosphorIcon
} from '@phosphor-icons/react';
import { ViewMode, Person, Role, Team, NavigationAction } from '../../types';
import { useAuth } from '../../features/auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility for merging tailwind classes efficiently
 */
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Static Map for View Access Checks - Moved outside to prevent re-allocation
const VIEW_ID_MAP: Record<string, ViewMode> = {
    'view-home': 'home',
    'view-dashboard': 'dashboard',
    'view-personnel': 'personnel',
    'view-attendance': 'attendance',
    'view-absences': 'absences',
    'view-tasks': 'tasks',
    'view-constraints': 'constraints',
    'view-equipment': 'equipment',
    'view-gate': 'gate',
    'view-stats': 'stats',
    'view-lottery': 'lottery',
    'view-settings': 'settings',
    'view-battalion-home': 'battalion-home',
    'view-battalion-personnel': 'battalion-personnel',
    'view-battalion-attendance': 'battalion-attendance',
    'view-reports': 'reports',
    'view-admin-center': 'admin-center',
    'view-admin': 'system'
};

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: PhosphorIcon;
    category: 'דפים' | 'אנשים' | 'צוותים' | 'פעולות';
    onSelect: () => void;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
    people: Person[];
    roles: Role[];
    teams: Team[];
    onNavigate: (view: ViewMode, action?: NavigationAction) => void;
    checkAccess: (view: ViewMode) => boolean;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
    isOpen,
    onClose,
    people,
    roles,
    teams,
    onNavigate,
    checkAccess
}) => {
    const { profile, signOut } = useAuth();
    const { showToast } = useToast();
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setSearch('');
            setSelectedIndex(0);
            // Use requestAnimationFrame for cleaner focus timing
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [isOpen]);

    // 1. Generate Static Commands (Base Pages & Internal Tabs) - Memoized separately for performance
    const baseCommands: CommandItem[] = useMemo(() => {
        const items: CommandItem[] = [
            // --- MAIN PAGES ---
            { id: 'view-home', label: 'דף הבית', icon: Buildings, category: 'דפים', onSelect: () => onNavigate('home') },
            { id: 'view-dashboard', label: 'לוח שיבוצים', icon: Calendar, category: 'דפים', onSelect: () => onNavigate('dashboard') },
            { id: 'view-personnel', label: 'ניהול כוח אדם', icon: Users, category: 'דפים', onSelect: () => onNavigate('personnel') },
            { id: 'view-attendance', label: 'יומן נוכחות', icon: Clock, category: 'דפים', onSelect: () => onNavigate('attendance') },
            { id: 'view-absences', label: 'בקשות יציאה וחופשות', icon: UserMinus, category: 'דפים', onSelect: () => onNavigate('absences') },
            { id: 'view-tasks', label: 'ניהול משימות', icon: ClipboardText, category: 'דפים', onSelect: () => onNavigate('tasks') },
            { id: 'view-constraints', label: 'ניהול אילוצים וזמינות', icon: Anchor, category: 'דפים', onSelect: () => onNavigate('constraints') },
            { id: 'view-equipment', label: 'ניהול ציוד (אקסים)', icon: Package, category: 'דפים', onSelect: () => onNavigate('equipment') },
            { id: 'view-gate', label: 'ש.ג וניהול רכבים', icon: Car, category: 'דפים', onSelect: () => onNavigate('gate') },
            { id: 'view-stats', label: 'דוחות ונתונים', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats') },
            { id: 'view-lottery', label: 'הגרלות', icon: DiceFive, category: 'דפים', onSelect: () => onNavigate('lottery') },
            { id: 'view-settings', label: 'הגדרות ארגון', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings') },

            // --- INTERNAL TABS - PERSONNEL ---
            { id: 'tab-personnel-people', label: 'כוח אדם | חיפוש ועריכת חיילים', icon: Users, category: 'דפים', onSelect: () => onNavigate('personnel', { type: 'select_tab', tabId: 'people' }) },
            { id: 'tab-personnel-teams', label: 'כוח אדם | ניהול צוותים', icon: Users, category: 'דפים', onSelect: () => onNavigate('personnel', { type: 'select_tab', tabId: 'teams' }) },
            { id: 'tab-personnel-roles', label: 'כוח אדם | ניהול תפקידים', icon: Users, category: 'דפים', onSelect: () => onNavigate('personnel', { type: 'select_tab', tabId: 'roles' }) },

            // --- INTERNAL TABS - STATS ---
            { id: 'tab-stats-manpower', label: 'דוחות | דוח מצבת (כוח אדם)', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats', { type: 'select_tab', tabId: 'manpower' }) },
            { id: 'tab-stats-tasks', label: 'דוחות | דוח שיבוצים ועומסים', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats', { type: 'select_tab', tabId: 'tasks' }) },
            { id: 'tab-stats-location', label: 'דוחות | מיקומי כוח אדם', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats', { type: 'select_tab', tabId: 'location' }) },
            { id: 'tab-stats-custom', label: 'דוחות | דוח שדות מותאמים', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats', { type: 'select_tab', tabId: 'customFields' }) },
            { id: 'tab-stats-attendance', label: 'דוחות | דוח 1 (נוכחות)', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats', { type: 'select_tab', tabId: 'dailyAttendance' }) },
            { id: 'tab-stats-compliance', label: 'דוחות | דוח חריגות וציות', icon: ChartBar, category: 'דפים', onSelect: () => onNavigate('stats', { type: 'select_tab', tabId: 'compliance' }) },

            // --- INTERNAL TABS - SETTINGS ---
            { id: 'tab-settings-general', label: 'הגדרות | הגדרות כלליות', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings', { type: 'select_tab', tabId: 'general' }) },
            { id: 'tab-settings-roles', label: 'הגדרות | תבניות הרשאות', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings', { type: 'select_tab', tabId: 'roles' }) },
            { id: 'tab-settings-members', label: 'הגדרות | ניהול חברי מערכת', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings', { type: 'select_tab', tabId: 'members' }) },
            { id: 'tab-settings-messages', label: 'הגדרות | הודעות ועדכונים', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings', { type: 'select_tab', tabId: 'messages' }) },
            { id: 'tab-settings-battalion', label: 'הגדרות | שיוך גדודי', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings', { type: 'select_tab', tabId: 'battalion' }) },
            { id: 'tab-settings-snapshots', label: 'הגדרות | גיבויים ושחזור', icon: Gear, category: 'דפים', onSelect: () => onNavigate('settings', { type: 'select_tab', tabId: 'snapshots' }) },

            // --- BATTALION PAGES ---
            { id: 'view-battalion-home', label: 'מבט גדודי | דשבורד מרכזי', icon: SquaresFour, category: 'דפים', onSelect: () => onNavigate('battalion-home') },
            { id: 'view-battalion-personnel', label: 'מבט גדודי | סד"כ גדודי', icon: Users, category: 'דפים', onSelect: () => onNavigate('battalion-personnel') },
            { id: 'view-battalion-attendance', label: 'מבט גדודי | נוכחות גדודית', icon: Calendar, category: 'דפים', onSelect: () => onNavigate('battalion-attendance') },
            { id: 'view-reports', label: 'מבט גדודי | שינויים בדוח 1', icon: FileText, category: 'דפים', onSelect: () => onNavigate('reports') },

            // --- ADMIN ---
            { id: 'view-admin-center', label: 'מרכז ניהול ובקרה (Admin)', icon: Pulse, category: 'דפים', onSelect: () => onNavigate('admin-center') },
            { id: 'tab-admin-analytics', label: 'אדמין | אנליטיקה ובריאות', icon: Pulse, category: 'דפים', onSelect: () => onNavigate('admin-center', { type: 'select_tab', tabId: 'analytics' }) },
            { id: 'tab-admin-logs', label: 'אדמין | יומן פעילות משתמשים', icon: Pulse, category: 'דפים', onSelect: () => onNavigate('admin-center', { type: 'select_tab', tabId: 'logs' }) },
        ];

        if (profile?.is_super_admin) {
            items.push({ id: 'view-admin', label: 'ניהול מערכת (Super Admin)', icon: Shield, category: 'דפים', onSelect: () => onNavigate('system') });
        }

        // Filter by permissions
        return items.filter(item => {
            // Check based on the base view ID
            let baseViewId = item.id.startsWith('tab-')
                ? 'view-' + item.id.split('-')[1] // e.g. tab-stats-manpower -> view-stats
                : item.id;

            // Manual mapping fix for admin tags
            if (item.id === 'tab-admin-analytics' || item.id === 'tab-admin-logs') {
                baseViewId = 'view-admin-center';
            }

            const view = VIEW_ID_MAP[baseViewId];
            return view ? checkAccess(view) : true;
        });
    }, [onNavigate, checkAccess, profile?.is_super_admin]);

    // 2. Performance Optimized Filtering & Merging
    const filteredCommands = useMemo(() => {
        const term = search.toLowerCase().trim();

        // Actions (always allowed)
        const actions: CommandItem[] = [{
            id: 'action-logout',
            label: 'התנתקות מהמערכת',
            icon: X,
            category: 'פעולות',
            onSelect: async () => {
                try {
                    await signOut();
                    window.location.reload();
                } catch (e) {
                    showToast('שגיאה בהתנתקות', 'error');
                }
            }
        }];

        // Filter Pages
        const matchingPages = term
            ? baseCommands.filter(cmd => cmd.label.toLowerCase().includes(term))
            : baseCommands.slice(0, 10);

        // Filter People - Only search if term is provided to avoid massive object creation
        const matchingPeople: CommandItem[] = [];
        if (term.length > 1) {
            const matchedPersonnel = people
                .filter(p => p.name.toLowerCase().includes(term))
                .slice(0, 5); // Limit performance impact

            matchedPersonnel.forEach(person => {
                matchingPeople.push({
                    id: `p-${person.id}-tasks`,
                    label: `${person.name} | משימות`,
                    description: `צפייה בלוח המשימות`,
                    icon: ClipboardText,
                    category: 'אנשים',
                    onSelect: () => onNavigate('dashboard', { type: 'filter_schedule', personId: person.id })
                });
                matchingPeople.push({
                    id: `p-${person.id}-attendance`,
                    label: `${person.name} | נוכחות`,
                    description: `צפייה ביומן הנוכחות האישי`,
                    icon: Clock,
                    category: 'אנשים',
                    onSelect: () => onNavigate('attendance', { type: 'filter_attendance', personId: person.id })
                });
                matchingPeople.push({
                    id: `p-${person.id}-info`,
                    label: `${person.name} | פרטים אישיים`,
                    description: `עריכת פרטי חייל`,
                    icon: IdentificationCard,
                    category: 'אנשים',
                    onSelect: () => onNavigate('personnel', { type: 'edit_person', personId: person.id })
                });
            });
        }

        return [...matchingPages, ...matchingPeople, ...actions].slice(0, 20);
    }, [search, baseCommands, people, onNavigate, signOut, showToast]);

    // Handle keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredCommands[selectedIndex]) {
                    filteredCommands[selectedIndex].onSelect();
                    onClose();
                }
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onClose]);

    // Scroll selected item into view
    useEffect(() => {
        const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
        if (selectedElement) {
            selectedElement.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div role="none" className="fixed inset-0 z-[10001] flex items-start justify-center pt-[15vh] px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        aria-hidden="true"
                    />

                    {/* Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="relative w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_32px_128px_-16px_rgba(15,23,42,0.3)] border border-white/50 overflow-hidden flex flex-col max-h-[70vh]"
                        dir="rtl"
                    >
                        {/* Search Input with ARIA Accessibility */}
                        <div className="flex items-center gap-4 px-8 py-6 border-b border-slate-100 bg-white/50 backdrop-blur-md">
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                                <MagnifyingGlass size={26} weight="bold" className="text-blue-600" aria-hidden="true" />
                            </div>
                            <input
                                ref={inputRef}
                                id="tour-search-input"
                                type="text"
                                role="combobox"
                                aria-expanded="true"
                                aria-autocomplete="list"
                                aria-controls="command-list"
                                aria-activedescendant={`cmd-item-${selectedIndex}`}
                                placeholder="חיפוש מהיר... (דפים, אנשים, פעולות)"
                                className="flex-1 bg-transparent border-none outline-none text-xl font-bold text-slate-800 placeholder-slate-400 focus:ring-0"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setSelectedIndex(0);
                                }}
                            />

                            <button
                                onClick={onClose}
                                aria-label="סגור חיפוש"
                                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all active:scale-90"
                            >
                                <X size={24} weight="bold" />
                            </button>
                        </div>

                        {/* Results List with Listbox Role */}
                        <div
                            ref={listRef}
                            id="command-list"
                            role="listbox"
                            aria-label="תוצאות חיפוש"
                            className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 custom-scrollbar"
                        >
                            {filteredCommands.length > 0 ? (
                                filteredCommands.map((cmd, index) => {
                                    const isSelected = index === selectedIndex;
                                    const Icon = cmd.icon;

                                    // Show category header if it's the first in its category
                                    const showCategory = index === 0 || filteredCommands[index - 1].category !== cmd.category;

                                    return (
                                        <React.Fragment key={cmd.id}>
                                            {showCategory && (
                                                <div
                                                    role="presentation"
                                                    className="px-5 pt-5 pb-2.5 text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]"
                                                >
                                                    {cmd.category}
                                                </div>
                                            )}
                                            <button
                                                id={`cmd-item-${index}`}
                                                role="option"
                                                aria-selected={isSelected}
                                                className={cn(
                                                    "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 relative group overflow-hidden",
                                                    isSelected
                                                        ? "bg-gradient-to-l from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-500/25 scale-[1.01] -translate-x-1"
                                                        : "hover:bg-slate-50 text-slate-600"
                                                )}
                                                onClick={() => {
                                                    cmd.onSelect();
                                                    onClose();
                                                }}
                                                onMouseEnter={() => setSelectedIndex(index)}
                                            >
                                                {/* Animated highlight for selected */}
                                                {isSelected && (
                                                    <motion.div
                                                        layoutId="highlight"
                                                        className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none"
                                                    />
                                                )}

                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className={cn(
                                                        "w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-all duration-500",
                                                        isSelected
                                                            ? "bg-white/20 rotate-6 scale-110 shadow-lg"
                                                            : "bg-slate-100 group-hover:bg-white group-hover:scale-105"
                                                    )}>
                                                        <Icon size={24} weight={isSelected ? "fill" : "duotone"} />
                                                    </div>
                                                    <div className="flex flex-col items-start text-right">
                                                        <span className={cn(
                                                            "font-extrabold text-base tracking-tight transition-colors",
                                                            isSelected ? "text-white" : "text-slate-700"
                                                        )}>
                                                            {cmd.label}
                                                        </span>
                                                        {cmd.description && (
                                                            <span className={cn(
                                                                "text-xs font-medium transition-colors",
                                                                isSelected ? "text-blue-100/80" : "text-slate-400"
                                                            )}>
                                                                {cmd.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 relative z-10">
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ opacity: 0, x: 10 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            className="flex items-center gap-2"
                                                        >
                                                            <ArrowSquareOut size={16} weight="bold" className="opacity-70" />
                                                        </motion.div>
                                                    )}
                                                </div>
                                            </button>
                                        </React.Fragment>
                                    );
                                })
                            ) : (
                                <div className="text-center py-16 text-slate-400">
                                    <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 border-2 border-dashed border-slate-200">
                                        <MagnifyingGlass size={36} className="opacity-20 animate-pulse text-slate-600" />
                                    </div>
                                    <h3 className="font-black text-slate-600 text-lg mb-1">לא נמצאו תוצאות</h3>
                                    <p className="text-sm font-medium">נסה חיפוש חופשי בשם או בתפקיד</p>
                                </div>
                            )}
                        </div>

                        {/* Visual Bottom Accent */}
                        <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
