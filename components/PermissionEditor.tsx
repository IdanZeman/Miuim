import React, { useState, useEffect } from 'react';
import { X, Save, Shield, Check, Info, Users, Globe, Lock, Plus } from 'lucide-react';
import { Profile, ViewMode, AccessLevel, DataScope, UserPermissions, Team, UserRole, PermissionTemplate } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';

interface PermissionEditorProps {
    isOpen: boolean;
    onClose: () => void;
    user: Profile;
    onSave: (userId: string, permissions: UserPermissions, templateId?: string | null) => Promise<void>;
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
    canManageUsers: false,
    canManageSettings: false,
};

import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

import { PermissionEditorContent } from './PermissionEditorContent';
import { SYSTEM_ROLE_PRESETS } from '../utils/permissions';

export const PermissionEditor: React.FC<PermissionEditorProps> = ({ isOpen, onClose, user: targetUser, onSave, teams, templates = [], onManageTemplates }) => {
    const [permissions, setPermissions] = useState<UserPermissions>(targetUser.permissions || DEFAULT_PERMISSIONS);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(targetUser.permission_template_id || null);
    const [saving, setSaving] = useState(false);

    // Reset when user changes
    useEffect(() => {
        if (targetUser.permissions) {
            setPermissions(targetUser.permissions);
        } else {
            // Fallback if no permissions exist yet (should contain checks)
            applyRolePreset('viewer');
        }
        setActiveTemplateId(targetUser.permission_template_id || null);
    }, [targetUser]);

    const applyTemplate = (template: PermissionTemplate) => {
        setPermissions(template.permissions);
        setActiveTemplateId(template.id);
    };

    const handlePermissionsChange = (newPermissions: UserPermissions) => {
        setPermissions(newPermissions);
        // We do NOT clear activeTemplateId here immediately to allow minor tweaks
        // checking if permissions drastically change? 
        // Actually, if users tweak, it is technically a 'Custom' template based on X.
        // But for our UI logic, if we want to show the tag, we probably want to keep the ID 
        // unless the user explicitly wants to detach?
        // Let's Keep the ID. The backend doesn't enforce that `permissions` must match `template`.
        // The ID is just a label/reference.
    };

    const applyRolePreset = (presetId: string) => {
        const preset = SYSTEM_ROLE_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        const newPerms = preset.permissions(DEFAULT_PERMISSIONS);
        setPermissions(newPerms);

        // Try to find a matching template in the organization's templates
        const match = templates.find(t => t.name === preset.name);
        if (match) {
            setActiveTemplateId(match.id);
        } else {
            setActiveTemplateId(null);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(targetUser.id, permissions, activeTemplateId);
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
                {/* Presets Removed as they are now in templates */}

                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Shield size={14} />
                            תבניות תפקיד (Role Templates)
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
                                    className={`px-4 py-2 rounded-xl text-sm font-black border transition-all flex items-center gap-2 shadow-sm ${activeTemplateId === tmp.id ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100'}`}
                                >
                                    {activeTemplateId === tmp.id && <Check size={14} />}
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

                <PermissionEditorContent permissions={permissions} setPermissions={handlePermissionsChange} teams={teams} />
            </div>
        </Modal>
    );
};
