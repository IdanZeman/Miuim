import React, { useState, useEffect } from 'react';
import { X, FloppyDisk as Save, Shield, Check, Info, Users, Globe, Lock, Plus } from '@phosphor-icons/react';
import { Profile, ViewMode, AccessLevel, DataScope, UserPermissions, Team, UserRole, PermissionTemplate } from '@/types';
import { useAuth } from '@/features/auth/AuthContext';
import { supabase } from '@/services/supabaseClient';

interface PermissionEditorProps {
    isOpen: boolean;
    onClose: () => void;
    user: Profile;
    onSave: (userId: string, permissions: UserPermissions, templateId?: string | null) => Promise<void>;
    teams: Team[];
    templates?: PermissionTemplate[];
    onManageTemplates?: () => void;
    isHq?: boolean;
}



const DEFAULT_PERMISSIONS: UserPermissions = {
    dataScope: 'organization',
    allowedTeamIds: [],
    screens: {},
};

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

import { PermissionEditorContent } from './PermissionEditorContent';
import { SYSTEM_ROLE_PRESETS } from '@/utils/permissions';

export const PermissionEditor: React.FC<PermissionEditorProps> = ({ isOpen, onClose, user: targetUser, onSave, teams, templates = [], onManageTemplates, isHq }) => {
    const { profile: currentUser } = useAuth();
    const canManageBattalion = isHq || currentUser?.is_super_admin;
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

    const applyRolePreset = (presetId: string) => {
        const preset = SYSTEM_ROLE_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        setPermissions(preset.permissions(DEFAULT_PERMISSIONS));
        setActiveTemplateId(preset.id); // Use preset ID as active ID
    };

    const handlePermissionsChange = (newPermissions: UserPermissions) => {
        setPermissions(newPermissions);
        // If they start editing, we should technically clear the active preset/template if it no longer matches
        // but for now we keep it simple as labels.
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // If it's a system preset, we save it as custom permissions (templateId: null)
            const isSystemPreset = SYSTEM_ROLE_PRESETS.some(p => p.id === activeTemplateId);
            await onSave(targetUser.id, permissions, isSystemPreset ? null : activeTemplateId);
            onClose();
        } catch (error) {
            console.error('Failed to save permissions', error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // Filter out templates that match system preset names to avoid duplication
    const customTemplates = templates.filter(t => !SYSTEM_ROLE_PRESETS.some(p => p.name === t.name));

    // Determine current effective active ID (maps legacy DB templates to virtual system presets by name)
    let effectiveActiveId = activeTemplateId;
    if (activeTemplateId) {
        const dbTemplate = templates.find(t => t.id === activeTemplateId);
        if (dbTemplate) {
            const sysMatch = SYSTEM_ROLE_PRESETS.find(p => p.name === dbTemplate.name);
            if (sysMatch) {
                effectiveActiveId = sysMatch.id;
            }
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Shield size={24} weight="duotone" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">עריכת הרשאות מתקדמת</h2>
                        <p className="text-sm font-bold text-slate-400">
                            עבור המשתמש: <span className="text-slate-600">{targetUser.full_name || targetUser.email}</span>
                        </p>
                    </div>
                </div>
            }
            size="2xl"
            footer={(
                <div className="flex justify-end gap-3 w-full">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="font-bold text-slate-500 hover:text-slate-700"
                    >
                        ביטול
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={saving}
                        icon={Save}
                        className="shadow-lg shadow-blue-200"
                    >
                        שמור שינויים
                    </Button>
                </div>
            )}
        >
            <div className="space-y-6 md:space-y-8">
                {/* --- System Presets Area --- */}
                <section>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-3">
                        <Globe size={14} weight="duotone" />
                        תבניות מערכת (קבועות)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {SYSTEM_ROLE_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyRolePreset(preset.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-black border transition-all flex items-center gap-2 shadow-sm ${effectiveActiveId === preset.id ? 'bg-blue-600 text-white border-blue-600 ring-2 ring-blue-200' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-100'}`}
                            >
                                {effectiveActiveId === preset.id && <Check size={14} weight="bold" />}
                                {preset.name}
                            </button>
                        ))}
                    </div>
                </section>

                {/* --- Custom Organization Templates Area --- */}
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Shield size={14} weight="duotone" />
                            תבניות מותאמות לארגון
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
                    {customTemplates.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {customTemplates.map(tmp => (
                                <button
                                    key={tmp.id}
                                    onClick={() => applyTemplate(tmp)}
                                    className={`px-4 py-2 rounded-xl text-sm font-black border transition-all flex items-center gap-2 shadow-sm ${effectiveActiveId === tmp.id ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100'}`}
                                >
                                    {effectiveActiveId === tmp.id && <Check size={14} weight="bold" />}
                                    {tmp.name}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                            <p className="text-xs text-slate-500 font-medium">לא הוגדרו עדיין תבניות מותאמות אישית לארגון.</p>
                        </div>
                    )}
                </section>

                <PermissionEditorContent permissions={permissions} setPermissions={handlePermissionsChange} teams={teams} isHq={canManageBattalion} />
            </div>
        </Modal>
    );
};
