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

import { PermissionEditorContent } from './PermissionEditorContent';

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

                <PermissionEditorContent permissions={permissions} setPermissions={setPermissions} teams={teams} />
            </div>
        </Modal>
    );
};
