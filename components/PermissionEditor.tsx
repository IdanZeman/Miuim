import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Check, Info, Users, Globe, Lock, Plus } from 'lucide-react';
import { Profile, ViewMode, AccessLevel, DataScope, UserPermissions, Team, UserRole, PermissionTemplate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface PermissionEditorProps {
    isOpen: boolean;
    onClose: () => void;
    user: Profile;
    onSave: (userId: string, permissions: UserPermissions) => Promise<void>;
    teams: Team[];
    templates?: PermissionTemplate[];
    onManageTemplates?: () => void;
}

const SCREENS: { id: ViewMode; label: string }[] = [
    { id: 'dashboard', label: 'לוח שיבוצים' },
    { id: 'personnel', label: 'ניהול כוח אדם' },
    { id: 'tasks', label: 'משימות' },
    { id: 'attendance', label: 'נוכחות' },
    { id: 'stats', label: 'דוחות ונתונים' },
    { id: 'constraints', label: 'ניהול אילוצים' },
    { id: 'lottery', label: 'הגרלות' },
    { id: 'equipment', label: 'ניהול אמצעים' },
    { id: 'logs', label: 'יומן פעילות' },
    { id: 'settings', label: 'הגדרות ארגון' },
];

const DEFAULT_PERMISSIONS: UserPermissions = {
    dataScope: 'organization',
    allowedTeamIds: [],
    screens: {},
};

import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export const PermissionEditor: React.FC<PermissionEditorProps> = ({ isOpen, onClose, user: targetUser, onSave, teams, templates = [], onManageTemplates }) => {
    const [permissions, setPermissions] = useState<UserPermissions>(targetUser.permissions || DEFAULT_PERMISSIONS);
    const [saving, setSaving] = useState(false);

    // Reset when user changes
    useEffect(() => {
        if (targetUser.permissions) {
            setPermissions(targetUser.permissions);
        } else {
            // Apply logic based on current role if no custom permissions exist
            applyRolePreset(targetUser.role);
        }
    }, [targetUser]);

    const applyTemplate = (template: PermissionTemplate) => {
        setPermissions(template.permissions);
    };

    const applyRolePreset = (role: UserRole) => {
        const newPerms: UserPermissions = { ...DEFAULT_PERMISSIONS, screens: {} };

        switch (role) {
            case 'admin':
                newPerms.dataScope = 'organization';
                SCREENS.forEach(s => newPerms.screens[s.id] = 'edit');
                break;
            case 'editor':
                newPerms.dataScope = 'organization';
                SCREENS.forEach(s => {
                    if (s.id === 'settings' || s.id === 'logs') newPerms.screens[s.id] = 'none';
                    else newPerms.screens[s.id] = 'edit';
                });
                break;
            case 'viewer':
                newPerms.dataScope = 'organization';
                SCREENS.forEach(s => {
                    if (['settings', 'logs', 'personnel', 'tasks'].includes(s.id)) newPerms.screens[s.id] = 'none';
                    else newPerms.screens[s.id] = 'view';
                });
                // Viewers can view dashboard
                newPerms.screens['dashboard'] = 'view';
                break;
            case 'attendance_only':
                newPerms.dataScope = 'organization';
                SCREENS.forEach(s => newPerms.screens[s.id] = 'none');
                newPerms.screens['attendance'] = 'edit';
                newPerms.screens['dashboard'] = 'view';
                break;
        }
        setPermissions(newPerms);
    };

    const handleScreenChange = (screenId: ViewMode, level: AccessLevel) => {
        setPermissions(prev => ({
            ...prev,
            screens: {
                ...prev.screens,
                [screenId]: level
            }
        }));
    };

    const handleSetAllScreens = (level: AccessLevel) => {
        const newScreens: Partial<Record<ViewMode, AccessLevel>> = {};
        SCREENS.forEach(s => {
            newScreens[s.id] = level;
        });
        setPermissions(prev => ({ ...prev, screens: newScreens }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(targetUser.id, permissions);
            onClose();
        } catch (error) {
            console.error('Failed to save permissions', error);
        } finally {
            setSaving(false);
        }
    };

    const toggleTeam = (teamId: string) => {
        setPermissions(prev => {
            const current = prev.allowedTeamIds || [];
            if (current.includes(teamId)) {
                return { ...prev, allowedTeamIds: current.filter(id => id !== teamId) };
            } else {
                return { ...prev, allowedTeamIds: [...current, teamId] };
            }
        });
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex flex-col">
                    <span className="flex items-center gap-2">
                        <Shield className="text-blue-600" size={20} />
                        עריכת הרשאות מתקדמת
                    </span>
                    <span className="text-sm font-normal text-slate-500 mt-1">
                        עבור המשתמש: <span className="font-bold text-slate-700">{targetUser.full_name || targetUser.email}</span>
                    </span>
                </div>
            }
            size="2xl"
            footer={(
                <div className="flex justify-end gap-3 w-full">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                    >
                        ביטול
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={saving}
                        icon={Save}
                    >
                        שמור שינויים
                    </Button>
                </div>
            )}
        >
            <div className="space-y-6 md:space-y-8">
                {/* Presets */}
                <section>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">תבניות מהירות (System Presets)</h3>
                    <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 md:gap-3">
                        <button onClick={() => applyRolePreset('admin')} className="px-3 py-2 md:px-4 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-sm border border-purple-100">מנהל מלא</button>
                        <button onClick={() => applyRolePreset('editor')} className="px-3 py-2 md:px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-sm border border-blue-100">עורך תוכן</button>
                        <button onClick={() => applyRolePreset('viewer')} className="px-3 py-2 md:px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-sm border border-slate-200">צפייה בלבד</button>
                        <button onClick={() => applyRolePreset('attendance_only')} className="px-3 py-2 md:px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-xs md:text-sm font-bold transition-colors shadow-sm border border-amber-100">נוכחות בלבד</button>
                    </div>
                </section>

                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Shield size={14} />
                            תבניות ארגוניות (Custom Roles)
                        </h3>
                        {onManageTemplates && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onManageTemplates();
                                }}
                                className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors px-1 underline"
                            >
                                נהל תבניות...
                            </button>
                        )}
                    </div>
                    {templates.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {templates.map(tmp => (
                                <button
                                    key={tmp.id}
                                    onClick={() => applyTemplate(tmp)}
                                    className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-sm font-black border border-indigo-100 transition-all flex items-center gap-2 shadow-sm"
                                >
                                    {tmp.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                            <p className="text-xs text-slate-500 font-medium mb-2">לא הוגדרו עדיין תבניות מותאמות אישית לארגון.</p>
                            {onManageTemplates && (
                                <button
                                    onClick={() => {
                                        onClose();
                                        onManageTemplates();
                                    }}
                                    className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-all"
                                >
                                    <Plus size={12} />
                                    צור תבנית חדשה בניהול תפקידים
                                </button>
                            )}
                        </div>
                    )}
                </section>

                {/* Data Scope */}
                <section className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                        <Globe size={14} />
                        היקף נתונים
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                        <label className={`cursor-pointer p-3 md:p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'organization' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                            <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'organization'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'organization' }))} />
                            <div className="flex items-center gap-2 mb-1">
                                <Globe className={`w-5 h-5 ${permissions.dataScope === 'organization' ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className="font-bold text-slate-800 text-sm md:text-base">כל הארגון</span>
                            </div>
                            <p className="text-xs text-slate-500">גישה לכל נתוני הארגון, הצוותים והמשתמשים.</p>
                        </label>

                        <label className={`cursor-pointer p-3 md:p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'my_team' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                            <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'my_team'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'my_team' }))} />
                            <div className="flex items-center gap-2 mb-1">
                                <Shield className={`w-5 h-5 ${permissions.dataScope === 'my_team' ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className="font-bold text-slate-800 text-sm md:text-base">הצוות שלי</span>
                            </div>
                            <p className="text-xs text-slate-500">גישה אוטומטית לצוות המשויך למשתמש.</p>
                        </label>

                        <label className={`cursor-pointer p-3 md:p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'team' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                            <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'team'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'team' }))} />
                            <div className="flex items-center gap-2 mb-1">
                                <Users className={`w-5 h-5 ${permissions.dataScope === 'team' ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className="font-bold text-slate-800 text-sm md:text-base">צוותים ספציפיים</span>
                            </div>
                            <p className="text-xs text-slate-500">בחירה ידנית של צוותים מורשים.</p>
                        </label>

                        <label className={`cursor-pointer p-3 md:p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'personal' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                            <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'personal'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'personal' }))} />
                            <div className="flex items-center gap-2 mb-1">
                                <Lock className={`w-5 h-5 ${permissions.dataScope === 'personal' ? 'text-blue-600' : 'text-slate-400'}`} />
                                <span className="font-bold text-slate-800 text-sm md:text-base">אישי בלבד</span>
                            </div>
                            <p className="text-xs text-slate-500">המשתמש רואה רק את הנתונים המשויכים אליו.</p>
                        </label>
                    </div>

                    {/* Team Selector - Only if Scope is Team */}
                    {permissions.dataScope === 'team' && (
                        <div className="mt-4 p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                            <h4 className="text-sm font-bold text-slate-700 mb-2">בחר צוותים מורשים:</h4>
                            <div className="flex flex-wrap gap-2">
                                {teams.map(team => (
                                    <button
                                        key={team.id}
                                        onClick={() => toggleTeam(team.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs md:text-sm font-bold transition-all border ${(permissions.allowedTeamIds || []).includes(team.id)
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                            }`}
                                    >
                                        {team.name}
                                        {(permissions.allowedTeamIds || []).includes(team.id) && <Check size={14} className="inline mr-1" />}
                                    </button>
                                ))}
                                {teams.length === 0 && <p className="text-sm text-slate-400">לא הוגדרו צוותים בארגון</p>}
                            </div>
                        </div>
                    )}
                </section>

                {/* Screen Actions Table */}
                <section>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">הרשאות מסכים</h3>
                    <div className="bg-white border rounded-xl overflow-hidden shadow-sm overflow-x-auto">
                        <table className="w-full text-right min-w-[500px]">
                            <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-4 py-3 border-b whitespace-nowrap">מסך</th>
                                    {['none', 'view', 'edit'].map(lvl => (
                                        <th key={lvl} className="px-4 py-3 border-b text-center w-24 md:w-32 whitespace-nowrap">
                                            <div className="flex flex-col items-center gap-1">
                                                <span>{lvl === 'none' ? 'הסתרה מלאה' : lvl === 'view' ? 'צפייה בלבד' : 'עריכה מלאה'}</span>
                                                <button
                                                    onClick={() => handleSetAllScreens(lvl as any)}
                                                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] text-blue-600 hover:bg-blue-50 transition-colors shadow-sm font-black"
                                                >
                                                    בחר הכל
                                                </button>
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {SCREENS.map((screen) => {
                                    const currentLevel = permissions.screens[screen.id] || 'none';
                                    return (
                                        <tr key={screen.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-700 text-sm md:text-base">{screen.label}</td>

                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={`screen-${screen.id}`}
                                                    checked={currentLevel === 'none'}
                                                    onChange={() => handleScreenChange(screen.id, 'none')}
                                                    className="w-4 h-4 text-red-600 focus:ring-red-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={`screen-${screen.id}`}
                                                    checked={currentLevel === 'view'}
                                                    onChange={() => handleScreenChange(screen.id, 'view')}
                                                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <input
                                                    type="radio"
                                                    name={`screen-${screen.id}`}
                                                    checked={currentLevel === 'edit'}
                                                    onChange={() => handleScreenChange(screen.id, 'edit')}
                                                    className="w-4 h-4 text-green-600 focus:ring-green-500 cursor-pointer"
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </Modal >
    );
};
