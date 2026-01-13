import React from 'react';
import {
    CalendarBlank as Calendar,
    Users,
    ClipboardText as ClipboardList,
    List as Menu,
    SignOut as LogOut,
    Clock,
    Gear as Settings,
    FileText,
    Shield,
    DiceSix as Dices,
    Envelope as Mail,
    Anchor,
    House as Home,
    UserMinus as UserX,
    Package,
    Pulse as Activity,
    Question as HelpCircle,
    Car,
    Info
} from '@phosphor-icons/react';
import { ViewMode } from '@/types';
import { useAuth } from '../../features/auth/AuthContext';

interface FooterProps {
    setView?: (view: ViewMode) => void;
    checkAccess: (screen: ViewMode, requiredLevel?: 'view' | 'edit') => boolean;
}

export const Footer: React.FC<FooterProps> = ({ setView, checkAccess }) => {
    const { organization, profile } = useAuth();
    const currentYear = new Date().getFullYear();

    const renderLink = (view: ViewMode, label: string, icon: React.ReactNode) => {
        if (!checkAccess(view)) return null;
        return (
            <li>
                <button
                    onClick={() => {
                        if (setView) {
                            setView(view);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                    }}
                    className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm py-1 font-medium"
                >
                    {icon}
                    <span>{label}</span>
                </button>
            </li>
        );
    };

    return (
        <footer className="bg-white text-slate-600 pt-12 pb-32 md:pt-16 md:pb-8 px-6 mt-12 border-t border-slate-200 w-full">
            <div className="max-w-7xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12 text-right" dir="rtl">
                {/* Column 1: Brand & About */}
                <div className="space-y-4 col-span-2 lg:col-span-1">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Anchor size={24} weight="bold" className="text-white" />
                        </div>
                        <h2 className="text-xl font-black tracking-tight text-slate-900">
                            ניהול פלוגה
                        </h2>
                    </div>
                    <p className="text-slate-500 text-sm leading-relaxed max-w-none">
                        מערכת ניהול חכמה לכוח אדם, משימות ולוגיסטיקה. פותחה במיוחד ליחידות צבאיות וארגונים ביטחוניים לשיפור היעילות המבצעית.
                    </p>
                </div>

                {/* Column 2: Main Navigation */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">ניווט ראשי</h3>
                    <ul className="space-y-3">
                        {renderLink('home', 'בית', <Home size={18} weight="duotone" />)}
                        {renderLink('dashboard', 'לוח שיבוצים', <Calendar size={18} weight="duotone" />)}
                        {renderLink('personnel', 'ניהול כוח אדם', <Users size={18} weight="duotone" />)}
                        {renderLink('tasks', 'משימות', <ClipboardList size={18} weight="duotone" />)}
                        {renderLink('attendance', 'נוכחות', <Clock size={18} weight="duotone" />)}
                    </ul>
                </div>

                {/* Column 3: Tools & Management */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">כלים וניהול</h3>
                    <ul className="space-y-3">
                        {renderLink('constraints', 'אילוצים', <Anchor size={18} weight="duotone" />)}
                        {renderLink('absences', 'בקשות יציאה', <UserX size={18} weight="duotone" />)}
                        {renderLink('equipment', 'ניהול אמצעים', <Package size={18} weight="duotone" />)}
                        {renderLink('gate', 'בקרת שער', <Car size={18} weight="duotone" />)}
                        {renderLink('stats', 'דוחות וסטטיסטיקה', <FileText size={18} weight="duotone" />)}
                        {renderLink('lottery', 'הגרלה', <Dices size={18} weight="duotone" />)}
                    </ul>
                </div>

                {/* Column 4: Help & Admin */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">עזרה ומערכת</h3>
                    <ul className="space-y-3">
                        {renderLink('faq', 'מרכז עזרה', <HelpCircle size={18} weight="duotone" />)}
                        {renderLink('contact', 'צור קשר', <Mail size={18} weight="duotone" />)}
                        {renderLink('settings', 'הגדרות ארגון', <Settings size={18} weight="duotone" />)}
                        {profile?.is_super_admin && renderLink('system', 'ניהול מערכת', <Shield size={18} weight="duotone" />)}
                        <li>
                            <button
                                onClick={() => {
                                    if (setView) {
                                        setView('accessibility');
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }
                                }}
                                className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors text-sm py-1 font-medium"
                            >
                                <Info size={18} weight="duotone" />
                                <span>הצהרת נגישות</span>
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6 text-slate-400 text-xs font-bold" dir="rtl">
                <div className="flex items-center gap-2">
                    <span>© {currentYear} מערכת לניהול פלוגה. כל הזכויות שמורות.</span>
                </div>
                <div className="flex items-center gap-6">
                    <button onClick={() => setView?.('terms')} className="hover:text-blue-600 transition-colors">תנאי שימוש</button>
                    <button onClick={() => setView?.('privacy')} className="hover:text-blue-600 transition-colors">מדיניות פרטיות</button>
                    <button onClick={() => setView?.('security')} className="hover:text-blue-600 transition-colors">אבטחת מידע</button>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                    <span>V 2.1.0</span>
                </div>
            </div>
        </footer>
    );
};
