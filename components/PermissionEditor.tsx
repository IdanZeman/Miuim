import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Check, Info, Users, Globe, Lock } from 'lucide-react';
import { Profile, ViewMode, AccessLevel, DataScope, UserPermissions, Team, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface PermissionEditorProps {
    isOpen: boolean;
    onClose: () => void;
    user: Profile;
    onSave: (userId: string, permissions: UserPermissions) => Promise<void>;
    teams: Team[];
}

const SCREENS: { id: ViewMode; label: string }[] = [
    { id: 'dashboard', label: 'לוח שיבוצים' },
    { id: 'personnel', label: 'ניהול כוח אדם' },
    { id: 'tasks', label: 'משימות' },
    { id: 'attendance', label: 'נוכחות' },
    { id: 'stats', label: 'דוחות ונתונים' },
    { id: 'settings', label: 'הגדרות ארגון' },
    { id: 'reports', label: 'ייצוא נתונים' },
    { id: 'lottery', label: 'הגרלות' },
    { id: 'constraints', label: 'אילוצים' },
];

const DEFAULT_PERMISSIONS: UserPermissions = {
    dataScope: 'organization',
    allowedTeamIds: [],
    screens: {},
    canManageUsers: false,
    canManageSettings: false
};

export const PermissionEditor: React.FC<PermissionEditorProps> = ({ isOpen, onClose, user: targetUser, onSave, teams }) => {
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

    const applyRolePreset = (role: UserRole) => {
        const newPerms: UserPermissions = { ...DEFAULT_PERMISSIONS, screens: {} };

        switch (role) {
            case 'admin':
                newPerms.dataScope = 'organization';
                newPerms.canManageUsers = true;
                newPerms.canManageSettings = true;
                SCREENS.forEach(s => newPerms.screens[s.id] = 'edit');
                break;
            case 'editor':
                newPerms.dataScope = 'organization';
                newPerms.canManageUsers = true;
                newPerms.canManageSettings = false;
                SCREENS.forEach(s => {
                    if (s.id === 'settings' || s.id === 'logs') newPerms.screens[s.id] = 'none';
                    else newPerms.screens[s.id] = 'edit';
                });
                break;
            case 'viewer':
                newPerms.dataScope = 'organization';
                newPerms.canManageUsers = false;
                newPerms.canManageSettings = false;
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

    const handleSave = async () => {
        setSaving(true);
        await onSave(targetUser.id, permissions);
        setSaving(false);
        onClose();
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-start justify-center p-4 pt-24 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300 mb-8">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Shield className="text-blue-600" />
                            עריכת הרשאות מתקדמת
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">
                            עבור המשתמש: <span className="font-bold text-slate-700">{targetUser.full_name || targetUser.email}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">

                    {/* Presets */}
                    <section>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">תבניות מהירות</h3>
                        <div className="flex gap-3">
                            <button onClick={() => applyRolePreset('admin')} className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-bold transition-colors">מנהל מלא</button>
                            <button onClick={() => applyRolePreset('editor')} className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-bold transition-colors">עורך תוכן</button>
                            <button onClick={() => applyRolePreset('viewer')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-colors">צפייה בלבד</button>
                            <button onClick={() => applyRolePreset('attendance_only')} className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-sm font-bold transition-colors">נוכחות בלבד</button>
                        </div>
                    </section>

                    {/* Data Scope */}
                    <section className="space-y-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Globe size={14} />
                            היקף נתונים
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'organization' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                                <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'organization'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'organization' }))} />
                                <div className="flex items-center gap-2 mb-1">
                                    <Globe className={`w-5 h-5 ${permissions.dataScope === 'organization' ? 'text-blue-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-slate-800">כל הארגון</span>
                                </div>
                                <p className="text-xs text-slate-500">גישה לכל נתוני הארגון, הצוותים והמשתמשים.</p>
                            </label>

                            <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'team' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                                <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'team'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'team' }))} />
                                <div className="flex items-center gap-2 mb-1">
                                    <Users className={`w-5 h-5 ${permissions.dataScope === 'team' ? 'text-blue-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-slate-800">צוותים ספציפיים</span>
                                </div>
                                <p className="text-xs text-slate-500">גישה מוגבלת לנתוני הצוותים הנבחרים בלבד.</p>
                            </label>

                            <label className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${permissions.dataScope === 'personal' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}>
                                <input type="radio" name="scope" className="sr-only" checked={permissions.dataScope === 'personal'} onChange={() => setPermissions(p => ({ ...p, dataScope: 'personal' }))} />
                                <div className="flex items-center gap-2 mb-1">
                                    <Lock className={`w-5 h-5 ${permissions.dataScope === 'personal' ? 'text-blue-600' : 'text-slate-400'}`} />
                                    <span className="font-bold text-slate-800">אישי בלבד</span>
                                </div>
                                <p className="text-xs text-slate-500">המשתמש רואה רק את הנתונים המשויכים אליו אישית.</p>
                            </label>
                        </div>

                        {/* Team Selector - Only if Scope is Team */}
                        {permissions.dataScope === 'team' && (
                            <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2">
                                <h4 className="text-sm font-bold text-slate-700 mb-2">בחר צוותים מורשים:</h4>
                                <div className="flex flex-wrap gap-2">
                                    {teams.map(team => (
                                        <button
                                            key={team.id}
                                            onClick={() => toggleTeam(team.id)}
                                            className={`px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${(permissions.allowedTeamIds || []).includes(team.id)
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
                        <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-4 py-3 border-b">מסך</th>
                                        <th className="px-4 py-3 border-b text-center w-32">הסתרה מלאה</th>
                                        <th className="px-4 py-3 border-b text-center w-32">צפייה בלבד</th>
                                        <th className="px-4 py-3 border-b text-center w-32">עריכה מלאה</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {SCREENS.map((screen) => {
                                        const currentLevel = permissions.screens[screen.id] || 'none';
                                        return (
                                            <tr key={screen.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 font-medium text-slate-700">{screen.label}</td>

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

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                    >
                        ביטול
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                    >
                        {saving ? <span className="animate-spin">⌛</span> : <Save size={18} />}
                        שמור שינויים
                    </button>
                </div>
            </div>
        </div>
    );
};
