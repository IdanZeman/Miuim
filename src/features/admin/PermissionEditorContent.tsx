import React from 'react';
import { Globe, Check, Shield, Users, Lock, SquaresFour as Layout, UserCircle, Info, Anchor, Gavel, Pulse as Activity, Gear as Settings, CheckCircle, Lightning as Zap } from '@phosphor-icons/react';
import { UserPermissions, Team, ViewMode } from '../../types';

const SCREENS: { id: ViewMode; label: string; icon: any; isBattalion?: boolean }[] = [
    { id: 'dashboard', label: 'לוח שיבוצים', icon: Layout },
    { id: 'personnel', label: 'ניהול כוח אדם', icon: Users },
    { id: 'tasks', label: 'משימות', icon: CheckCircle },
    { id: 'attendance', label: 'נוכחות', icon: UserCircle },
    { id: 'stats', label: 'דוחות ונתונים', icon: Info },
    { id: 'constraints', label: 'ניהול אילוצים', icon: Anchor },
    { id: 'lottery', label: 'הגרלות', icon: Gavel },
    { id: 'equipment', label: 'ניהול אמצעים', icon: Shield },
    { id: 'logs', label: 'יומן פעילות', icon: Activity },
    { id: 'settings', label: 'הגדרות ארגון', icon: Settings },
    // Battalion - Single unified permission for all battalion screens
    { id: 'battalion' as ViewMode, label: 'ניהול גדודי', icon: Users, isBattalion: true },
];

interface PermissionEditorContentProps {
    permissions: UserPermissions;
    setPermissions: React.Dispatch<React.SetStateAction<UserPermissions>>;
    teams: Team[];
    isHq?: boolean;
}

export const PermissionEditorContent: React.FC<PermissionEditorContentProps> = ({ permissions, setPermissions, teams, isHq }) => {
    const setAllScreens = (lvl: 'none' | 'view' | 'edit') => {
        const nextScreens: any = {};
        SCREENS.filter(s => !s.isBattalion || isHq).forEach(s => {
            nextScreens[s.id] = lvl;
        });
        setPermissions(prev => ({
            ...prev,
            screens: nextScreens
        }));
    };

    const toggleTeam = (teamId: string) => {
        const current = permissions.allowedTeamIds || [];
        setPermissions(prev => ({
            ...prev,
            allowedTeamIds: current.includes(teamId)
                ? current.filter(id => id !== teamId)
                : [...current, teamId]
        }));
    };

    return (
        <div className="space-y-8">
            <section className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Globe size={14} weight="duotone" />
                    היקף נתונים (Scope)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {['organization', 'my_team', 'team', 'personal'].map((s) => (
                        <label key={s} className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${permissions.dataScope === s ? 'border-blue-500 bg-blue-50' : 'border-slate-100'}`}>
                            <input type="radio" className="sr-only" checked={permissions.dataScope === s} onChange={() => setPermissions(p => ({ ...p, dataScope: s as any }))} />
                            <div className="font-black text-slate-800 mb-1">
                                {s === 'organization' && 'כל הארגון'}
                                {s === 'my_team' && 'הצוות שלי'}
                                {s === 'team' && 'צוותים נבחרים'}
                                {s === 'personal' && 'אישי'}
                            </div>
                            <p className="text-[10px] text-slate-500 font-bold leading-tight">
                                {s === 'organization' && 'גישה לכל נתוני היחידה'}
                                {s === 'my_team' && 'גישה אוטומטית לצוות המשויך'}
                                {s === 'team' && 'ניהול ידני של הרשאות צוות'}
                                {s === 'personal' && 'רק המידע המשויך למשתמש'}
                            </p>
                        </label>
                    ))}
                </div>
                {permissions.dataScope === 'team' && (
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[60px] items-center">
                        {teams.length > 0 ? (
                            teams.map(t => (
                                <button key={t.id} onClick={() => toggleTeam(t.id)} className={`px-4 py-1.5 rounded-full text-xs font-black transition-all border ${permissions.allowedTeamIds?.includes(t.id) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                                    {t.name}
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-slate-400 font-bold italic w-full text-center">לא נמצאו צוותים בארגון...</p>
                        )}
                    </div>
                )}
            </section>

            {/* Advanced Capabilities */}
            <section className="space-y-4">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={14} weight="duotone" />
                    יכולות מתקדמות (Capabilities)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${permissions.canApproveRequests ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${permissions.canApproveRequests ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <CheckCircle size={20} weight="duotone" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-slate-800 text-sm">אישור בקשות יציאה</div>
                            <div className="text-[10px] text-slate-500">יכולת לאשר או לדחות בקשות יציאה של חיילים</div>
                        </div>
                        <input type="checkbox" className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500" checked={!!permissions.canApproveRequests} onChange={(e) => setPermissions(p => ({ ...p, canApproveRequests: e.target.checked }))} />
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${permissions.canManageRotaWizard ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-slate-200 hover:border-orange-300'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${permissions.canManageRotaWizard ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Zap size={20} weight="duotone" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-slate-800 text-sm">ניהול מחולל סבבים</div>
                            <div className="text-[10px] text-slate-500">יכולת להגדיר ולהפעיל את מחולל הסבבים האוטומטי</div>
                        </div>
                        <input type="checkbox" className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500" checked={!!permissions.canManageRotaWizard} onChange={(e) => setPermissions(p => ({ ...p, canManageRotaWizard: e.target.checked }))} />
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${permissions.canManageGateAuthorized ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${permissions.canManageGateAuthorized ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Shield size={20} weight="duotone" />
                        </div>
                        <div className="flex-1">
                            <div className="font-bold text-slate-800 text-sm">ניהול רכבים מורשים (ש.ג)</div>
                            <div className="text-[10px] text-slate-500">יכולת לערוך את רשימת הרכבים המורשים לכניסה</div>
                        </div>
                        <input type="checkbox" className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500" checked={!!permissions.canManageGateAuthorized} onChange={(e) => setPermissions(p => ({ ...p, canManageGateAuthorized: e.target.checked }))} />
                    </label>
                </div>
            </section>

            <section>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider">הרשאות מסכים</h3>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase">
                            <tr>
                                <th className="px-4 py-3 border-b">מסך</th>
                                {['none', 'view', 'edit'].map(lvl => (
                                    <th key={lvl} className="px-4 py-3 border-b text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            <span>{lvl === 'none' ? 'חסום' : lvl === 'view' ? 'צפייה' : 'עריכה'}</span>
                                            <button
                                                onClick={() => setAllScreens(lvl as any)}
                                                className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                                            >
                                                בחר הכל
                                            </button>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {SCREENS.filter(screen => !screen.isBattalion || isHq).map(screen => (
                                <tr key={screen.id}>
                                    <td className="px-4 py-3 flex items-center gap-2 font-bold text-slate-700">
                                        <screen.icon size={16} weight="duotone" className="text-slate-400" />
                                        {screen.label}
                                    </td>
                                    {['none', 'view', 'edit'].map(lvl => (
                                        <td key={lvl} className="px-4 py-3 text-center">
                                            <input
                                                type="radio"
                                                className="w-4 h-4"
                                                checked={(permissions.screens[screen.id] || 'none') === lvl}
                                                onChange={() => setPermissions(prev => ({
                                                    ...prev,
                                                    screens: { ...prev.screens, [screen.id]: lvl as any }
                                                }))}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
