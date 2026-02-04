import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Profile, Person, UserPermissions, Team, PermissionTemplate, Organization } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { PermissionEditorContent } from './PermissionEditorContent';
import { SYSTEM_ROLE_PRESETS } from '../../utils/permissions';
import { User, Buildings as Building, Link as LinkIcon, Shield, Check, FloppyDisk as Save } from '@phosphor-icons/react';

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: Profile;
    organizations: Organization[];
    onSave: (userId: string, updates: Partial<Profile>, linkedPersonId: string | null) => Promise<void>;
}

const DEFAULT_PERMISSIONS: UserPermissions = {
    dataScope: 'organization',
    allowedTeamIds: [],
    screens: {},
};

export const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, user, organizations, onSave }) => {
    const { showToast } = useToast();
    const [fullName, setFullName] = useState(user.full_name || '');
    const [orgId, setOrgId] = useState(user.organization_id || '');
    const [permissions, setPermissions] = useState<UserPermissions>(user.permissions || DEFAULT_PERMISSIONS);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(user.permission_template_id || null);

    const [people, setPeople] = useState<Person[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
    const [selectedPersonId, setSelectedPersonId] = useState<string>('');
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);

    // Initial load and when organization changes
    useEffect(() => {
        if (orgId) {
            fetchOrgRelatedData(orgId);
        } else {
            setPeople([]);
            setTeams([]);
            setTemplates([]);
            setSelectedPersonId('');
        }
    }, [orgId]);

    // Set initial person if linked
    useEffect(() => {
        if (people.length > 0) {
            const linked = people.find(p => p.userId === user.id);
            if (linked) {
                setSelectedPersonId(linked.id);
            } else {
                setSelectedPersonId('');
            }
        }
    }, [people, user.id]);

    const fetchOrgRelatedData = async (organizationId: string) => {
        setLoadingData(true);
        try {
            const [people, teams, templates] = await Promise.all([
                adminService.fetchPeople(organizationId),
                adminService.fetchTeamsByOrg(organizationId),
                adminService.fetchPermissionTemplates(organizationId)
            ]);

            setPeople(people || []);
            setTeams(teams || []);
            setTemplates(templates || []);
        } catch (error: any) {
            console.error('Error fetching org data:', error);
            showToast('שגיאה בטעינת נתוני הארגון', 'error');
        } finally {
            setLoadingData(false);
        }
    };

    const applyRolePreset = (presetId: string) => {
        const preset = SYSTEM_ROLE_PRESETS.find(p => p.id === presetId);
        if (!preset) return;

        setPermissions(preset.permissions(DEFAULT_PERMISSIONS));
        setActiveTemplateId(preset.id);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Check if selected person is already linked to someone else
            if (selectedPersonId) {
                const person = people.find(p => p.id === selectedPersonId);
                if (person?.userId && person.userId !== user.id) {
                    showToast('חייל זה כבר מקושר למשתמש אחר', 'error');
                    setSaving(false);
                    return;
                }
            }

            const updates: Partial<Profile> = {
                full_name: fullName,
                organization_id: orgId || null,
                permissions,
                permission_template_id: SYSTEM_ROLE_PRESETS.some(p => p.id === activeTemplateId) ? null : activeTemplateId
            };

            await onSave(user.id, updates, selectedPersonId || null);
            onClose();
        } catch (error: any) {
            console.error('Save error:', error);
            showToast('שגיאה בשמירת השינויים', 'error');
        } finally {
            setSaving(false);
        }
    };

    const personOptions = people
        .filter(p => !p.userId || p.userId === user.id)
        .map(p => ({
            value: p.id,
            label: p.name
        }));

    const orgOptions = organizations.map(org => ({
        value: org.id,
        label: org.name
    }));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                        <User size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">עריכת משתמש מלאה</h2>
                        <p className="text-sm font-bold text-slate-400">{user.email}</p>
                    </div>
                </div>
            }
            size="2xl"
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="font-bold">ביטול</Button>
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={saving}
                        icon={Save}
                        className="font-bold shadow-lg shadow-purple-200"
                    >
                        שמור הכל
                    </Button>
                </div>
            }
        >
            <div className="space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                        label="שם מלא"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="שם המשתמש"
                        icon={User}
                    />
                    <Select
                        label="שיוך לארגון (פלוגה)"
                        value={orgId}
                        onChange={setOrgId}
                        options={orgOptions}
                        placeholder="-- בחר ארגון --"
                        icon={Building}
                    />
                </div>

                {/* Person Link */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 text-slate-800 font-bold">
                        <LinkIcon size={20} className="text-green-600" />
                        קישור לחייל בפלוגה
                    </div>
                    <Select
                        value={selectedPersonId}
                        onChange={setSelectedPersonId}
                        options={personOptions}
                        placeholder={orgId ? "-- בחר חייל לקשר --" : "בחר קודם פלוגה"}
                        disabled={!orgId || loadingData}
                        searchable={true}
                    />
                    {!orgId && (
                        <p className="text-xs text-amber-600 font-bold">יש לשייך את המשתמש לפלוגה כדי לקשר אותו לחייל</p>
                    )}
                </div>

                {/* Permissions Section */}
                <div className="space-y-6">
                    <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-2">
                        <Shield size={20} className="text-blue-600" />
                        ניהול הרשאות ויכולות
                    </div>

                    {/* Presets */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">תבניות מערכת</h3>
                        <div className="flex flex-wrap gap-2">
                            {SYSTEM_ROLE_PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => applyRolePreset(preset.id)}
                                    className={`px-4 py-2 rounded-xl text-sm font-black border transition-all flex items-center gap-2 ${activeTemplateId === preset.id ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                                >
                                    {activeTemplateId === preset.id && <Check size={14} weight="bold" />}
                                    {preset.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Templates */}
                    {templates.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">תבניות פלוגתיות</h3>
                            <div className="flex flex-wrap gap-2">
                                {templates.map(tmp => (
                                    <button
                                        key={tmp.id}
                                        onClick={() => {
                                            setPermissions(tmp.permissions);
                                            setActiveTemplateId(tmp.id);
                                        }}
                                        className={`px-4 py-2 rounded-xl text-sm font-black border transition-all flex items-center gap-2 ${activeTemplateId === tmp.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                                    >
                                        {activeTemplateId === tmp.id && <Check size={14} weight="bold" />}
                                        {tmp.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <PermissionEditorContent
                        permissions={permissions}
                        setPermissions={setPermissions}
                        teams={teams}
                        isHq={true} // Allow battalion permissions in global view
                    />
                </div>
            </div>
        </Modal>
    );
};
