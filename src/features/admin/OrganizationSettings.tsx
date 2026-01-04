import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { FloppyDisk as Save, CheckCircle, Clock, Shield, Link as LinkIcon, Moon, Trash as Trash2, Users, MagnifyingGlass as Search, PencilSimple as Pencil, Info, Copy, ArrowsClockwise as RefreshCw, Gear as Settings, Plus, Gavel, SquaresFour as Layout, UserCircle, Globe, Anchor, Pulse as Activity, CaretLeft as ChevronLeft, Warning as AlertTriangle, Megaphone, IdentificationBadge as Accessibility, PlusIcon } from '@phosphor-icons/react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Team, Profile, UserPermissions, UserRole, OrganizationInvite, PermissionTemplate, ViewMode, Role } from '@/types';
import { PermissionEditor } from './PermissionEditor';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { logger } from '../../services/loggingService';
import { useConfirmation } from '../../hooks/useConfirmation';
import { Select } from '../../components/ui/Select';
import { PermissionEditorContent } from './PermissionEditorContent';
import { PageInfo } from '../../components/ui/PageInfo';
import { OrganizationMessagesManager } from './OrganizationMessagesManager';
import { OrganizationUserManagement } from './OrganizationUserManagement';
import { TimePicker } from '../../components/ui/DatePicker';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { CustomFieldsManager } from '../personnel/CustomFieldsManager';

import { canManageOrganization, getRoleDisplayName, getRoleDescription, SYSTEM_ROLE_PRESETS } from '../../utils/permissions';

const SCREENS: { id: ViewMode; label: string; icon: any }[] = [
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
];

const RoleTemplateManager: React.FC<{
    organizationId: string;
    templates: PermissionTemplate[];
    teams: Team[];
    onRefresh: () => void;
    onRestorePresets?: () => void; // NEW
    isAdmin?: boolean; // NEW
    isCreating: boolean;
    setIsCreating: (v: boolean) => void;
}> = ({ organizationId, templates, teams, onRefresh, onRestorePresets, isAdmin, isCreating, setIsCreating }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null);

    const handleDeleteTemplate = async (id: string) => {
        confirm({
            title: 'מחיקת תבנית',
            message: 'האם אתה בטוח שברצונך למחוק תבנית זו? משתמשים שמשויכים אליה ישמרו את ההרשאות האחרונות שלהם כהרשאות מותאמות אישית.',
            confirmText: 'מחק',
            type: 'danger',
            onConfirm: async () => {
                const { error } = await supabase.from('permission_templates').delete().eq('id', id);
                if (error) {
                    showToast('שגיאה במחיקת התבנית', 'error');
                } else {
                    showToast('התבנית נמחקה', 'success');
                    onRefresh();
                }
            }
        });
    };

    const handleSaveTemplate = async (templateId: string | null, name: string, permissions: UserPermissions) => {
        const payload = {
            organization_id: organizationId,
            name,
            permissions
        };

        let error;
        if (templateId) {
            const { error: err } = await supabase.from('permission_templates').update(payload).eq('id', templateId);
            error = err;
        } else {
            const { error: err } = await supabase.from('permission_templates').insert(payload);
            error = err;
        }

        if (error) {
            showToast('שגיאה בשמירת התבנית', 'error');
        } else {
            showToast('התבנית נשמרה בהצלחה', 'success');
            setIsCreating(false);
            setEditingTemplate(null);
            onRefresh();
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                    <Shield className="text-indigo-600 flex-shrink-0" size={24} weight="duotone" />
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800">תבניות הרשאות</h2>
                        <p className="text-xs md:text-sm text-slate-500 font-bold">הגדר תפקידים מובנים כמו "מפקד מחלקה", "חייל" וכו'</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && onRestorePresets && (
                        <Button
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={onRestorePresets}
                            className="hidden md:flex"
                        >
                            שחזר תבניות מערכת
                        </Button>
                    )}
                </div>
            </div>

            {isAdmin && onRestorePresets && (
                <div className="md:hidden">
                    <Button
                        variant="secondary"
                        icon={RefreshCw}
                        onClick={onRestorePresets}
                        className="w-full"
                    >
                        שחזר תבניות מערכת
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(tmp => (
                    <div key={tmp.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-all group shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-black text-slate-800 text-lg">{tmp.name}</h3>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" icon={Pencil} onClick={() => setEditingTemplate(tmp)} />
                                <Button variant="ghost" size="sm" icon={Trash2} className="text-red-500 hover:bg-red-50" onClick={() => handleDeleteTemplate(tmp.id)} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                                {tmp.permissions.dataScope === 'organization' ? 'כל הארגון' : tmp.permissions.dataScope === 'team' ? 'צוותי' : 'אישי'}
                            </span>
                            {Object.entries(tmp.permissions.screens).filter(([_, level]) => level !== 'none').length > 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                                    {Object.entries(tmp.permissions.screens).filter(([_, level]) => level !== 'none').length} מסכים מורשים
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {(isCreating || editingTemplate) && (
                <TemplateEditorModal
                    isOpen={true}
                    onClose={() => { setIsCreating(false); setEditingTemplate(null); }}
                    template={editingTemplate}
                    onSave={handleSaveTemplate}
                    teams={teams}
                />
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};

const TemplateEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    template: PermissionTemplate | null;
    onSave: (id: string | null, name: string, permissions: UserPermissions) => void;
    teams: Team[];
}> = ({ isOpen, onClose, template, onSave, teams }) => {
    const [name, setName] = useState(template?.name || '');
    const [permissions, setPermissions] = useState<UserPermissions>(template?.permissions || {
        dataScope: 'organization',
        screens: {},
    });

    const handleSave = () => {
        if (!name.trim()) return;
        onSave(template?.id || null, name, permissions);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Shield size={24} weight="duotone" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{template ? 'עריכת תבנית' : 'יצירת תבנית חדשה'}</h2>
                        <p className="text-sm font-bold text-slate-400">הגדרת הרשאות ותפקידים</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 hover:text-slate-700">ביטול</Button>
                    <Button variant="primary" icon={Save} onClick={handleSave} disabled={!name.trim()} className="shadow-none">שמור תבנית</Button>
                </div>
            }
            size="2xl"
        >
            <div className="space-y-6">
                <Input
                    label="שם התבנית"
                    placeholder="למשל: מפקד מחלקה"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="!bg-gray-50 font-black text-lg"
                />

                <div className="border-t border-slate-100 pt-6">
                    <PermissionEditorContent
                        permissions={permissions}
                        setPermissions={setPermissions}
                        teams={teams}
                    />
                </div>
            </div>
        </Modal>
    );
};


const GeneralSettings: React.FC<{ organizationId: string }> = ({ organizationId }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [start, setStart] = useState('22:00');
    const [end, setEnd] = useState('06:00');
    const [viewerDays, setViewerDays] = useState(2);
    // New Params
    const [daysOn, setDaysOn] = useState(11);
    const [daysOff, setDaysOff] = useState(3);
    const [minStaff, setMinStaff] = useState(0);
    const [rotationStart, setRotationStart] = useState('');

    useEffect(() => {
        fetchSettings();
    }, [organizationId]);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('organization_settings')
                .select('*')
                .eq('organization_id', organizationId)
                .maybeSingle();

            if (error) {
                if (error.code !== '406' && error.code !== 'PGRST116') {
                    console.error('Error fetching settings:', error);
                }
            }

            if (data) {
                setStart((data.night_shift_start || '22:00').slice(0, 5));
                setEnd((data.night_shift_end || '06:00').slice(0, 5));
                setViewerDays(data.viewer_schedule_days || 2);
                setDaysOn(data.default_days_on || 11);
                setDaysOff(data.default_days_off || 3);
                setMinStaff(data.min_daily_staff || 0);
                setRotationStart(data.rotation_start_date || '');
            }
        } catch (err) {
            console.warn('Failed to fetch settings, using defaults');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('organization_settings')
            .upsert({
                organization_id: organizationId,
                night_shift_start: start,
                night_shift_end: end,
                viewer_schedule_days: viewerDays,
                default_days_on: daysOn,
                default_days_off: daysOff,
                rotation_start_date: rotationStart || null,
                min_daily_staff: minStaff
            });

        if (error) {
            console.error('Error save settings:', error);
            showToast('שגיאה בשמירת ההגדרות', 'error');
        } else {
            setShowSuccess(true);
            showToast('ההגדרות נשמרו בהצלחה', 'success');
            setTimeout(() => setShowSuccess(false), 3000);
        }
        setSaving(false);
    };

    if (loading) return <div className="text-slate-500 text-sm">טוען הגדרות...</div>;

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1 w-full md:w-auto">
                    <TimePicker
                        label="התחלת לילה"
                        value={start}
                        onChange={setStart}
                    />
                </div>
                <div className="flex-1 w-full md:w-auto">
                    <TimePicker
                        label="סיום לילה"
                        value={end}
                        onChange={setEnd}
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6">


                <Input
                    type="number"
                    label="חשיפת לו&quot;ז (ימים)"
                    min={1}
                    max={30}
                    value={viewerDays}
                    onChange={e => setViewerDays(parseInt(e.target.value))}
                    className="!bg-gray-50"
                    containerClassName="w-32"
                />
            </div>

            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    variant="primary"
                    className="shadow-none"
                >
                    {saving ? 'שומר...' : 'שמור שינויים'}
                </Button>
            </div>
        </div>
    );
};

export const OrganizationSettings: React.FC<{ teams: Team[] }> = ({ teams = [] }) => {
    const { user, profile, organization } = useAuth();
    const [members, setMembers] = useState<Profile[]>([]);
    const [invites, setInvites] = useState<OrganizationInvite[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState('');
    const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
    const [roles, setRoles] = useState<Role[]>([]); // New State
    const [activeTab, setActiveTab] = useState<'general' | 'members' | 'roles' | 'messages' | 'teams' | 'customFields'>('general');
    const [organizationSettings, setOrganizationSettings] = useState<any>(null); // New organization settings state
    const [isCreating, setIsCreating] = useState(false);

    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    const { checkAccess } = useAuth();
    const isAdmin = profile?.is_super_admin || checkAccess('settings', 'edit');

    useEffect(() => {
        if (organization?.id) {
            loadInitialData();
        }
    }, [organization?.id]);

    const loadInitialData = async () => {
        setLoading(true);
        await Promise.all([
            fetchMembers(),
            fetchInvites(),
            fetchTemplates(),
            fetchRoles(),
            fetchOrganizationSettings()
        ]);
        setLoading(false);
    };

    const fetchOrganizationSettings = async () => {
        if (!organization) return;
        const { data, error } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('organization_id', organization.id)
            .single();

        if (!error && data) {
            setOrganizationSettings({
                ...data,
                customFieldsSchema: data.custom_fields_schema || []
            });
        }
    };

    const fetchTemplates = async () => {
        if (!organization) return;
        const { data, error } = await supabase
            .from('permission_templates')
            .select('*')
            .eq('organization_id', organization.id);

        if (!error && data) {
            setTemplates(data);
        }
    };

    const fetchRoles = async () => {
        if (!organization) return;
        const { data } = await supabase.from('roles').select('*').eq('organization_id', organization.id);
        if (data) setRoles(data);
    };

    const fetchMembers = async () => {
        if (!organization) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', organization.id)
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching members:', error);
        } else {
            setMembers(data || []);
        }
        // setLoading(false); // Handled in loadInitialData
    };

    const fetchInvites = async () => {
        if (!organization || !isAdmin) return;
        const { data, error } = await supabase
            .from('organization_invites')
            .select('*')
            .eq('organization_id', organization.id)
            .eq('accepted', false)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching invites:', error);
        } else {
            setInvites(data || []);
        }
    };




    const [editingPermissionsFor, setEditingPermissionsFor] = useState<Profile | null>(null);

    const handleOpenPermissionEditor = (member: Profile) => {
        setEditingPermissionsFor(member);
    };

    const handleSavePermissions = async (userId: string, permissions: UserPermissions, templateId?: string | null) => {
        const payload: any = { permissions };

        // If templateId is provided (or explicitly null), update it. 
        // If undefined, we might leave it? No, checking logic below. 
        // Actually best to always update it if passed.
        if (templateId !== undefined) {
            payload.permission_template_id = templateId;
        }

        const { error } = await supabase
            .from('profiles')
            .update(payload)
            .eq('id', userId);

        if (error) {
            showToast('שגיאה בשמירת הרשאות', 'error');
        } else {
            showToast('הרשאות עודכנו בהצלחה', 'success');
            setMembers(prev => prev.map(m => m.id === userId ? {
                ...m,
                permissions,
                permission_template_id: templateId !== undefined ? (templateId || undefined) : m.permission_template_id
            } : m));
        }
        setEditingPermissionsFor(null);
    };

    if (!checkAccess('settings', 'edit') && !profile?.is_super_admin) {
        return (
            <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 text-center">
                <Shield className="mx-auto text-red-500 mb-4" size={40} weight="duotone" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">אין הרשאה</h2>
                <p className="text-slate-600">רק מנהלים יכולים לגשת להגדרות הארגון</p>
            </div>
        );
    }

    if (loading) {
        return <div className="p-8 text-center text-slate-500">טוען...</div>;
    }

    const navigationTabs = [
        { id: 'general', label: 'כללי', icon: Settings },
        { id: 'roles', label: 'תבניות הרשאות', icon: Shield },
        { id: 'members', label: 'חברים', icon: Users },
        { id: 'customFields', label: 'שדות מותאמים', icon: Layout },
        { id: 'messages', label: 'הודעות ועדכונים', icon: Megaphone },
    ];

    return (
        <div className="h-full bg-slate-50 md:bg-white rounded-[2rem] md:rounded-2xl shadow-xl md:shadow-none border md:border-slate-100 p-0 md:p-0 overflow-hidden" dir="rtl">
            {/* === Mobile Layout (< md) === */}
            {/* Header Removed - Content moved to main card */}

            {/* Content Container (Mobile: Pull-up Sheet, Desktop: Split View) */}
            <div className="md:flex h-full md:max-w-6xl md:mx-auto md:gap-8 md:p-6 md:h-[calc(100vh-100px)]">

                {/* === Desktop Sidebar (Left Menu) === */}
                <div className="hidden md:flex flex-col w-64 shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full">
                    <div className="p-6 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-lg">
                                {organization?.name?.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                                <h2 className="font-bold text-slate-800 truncate">{organization?.name}</h2>
                                <p className="text-xs text-slate-500">ניהול מערכת</p>
                            </div>
                        </div>
                    </div>
                    <nav className="flex-1 p-2 space-y-1 overflow-y-auto" role="tablist" aria-orientation="vertical">
                        {navigationTabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'bg-indigo-50 text-indigo-700 font-bold border-r-4 border-indigo-600 rounded-r-none'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                aria-controls={`panel-${tab.id}`}
                            >
                                <tab.icon size={18} weight="duotone" className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} aria-hidden="true" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 mt-auto border-t border-slate-100">
                        <a
                            href="/accessibility"
                            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all group"
                        >
                            <Accessibility size={18} weight="duotone" className="text-slate-400 group-hover:text-slate-600" aria-hidden="true" />
                            הצהרת נגישות
                        </a>
                    </div>

                </div>

                {/* === Active Content Area === */}
                {/* === Active Content Area === */}
                <div className="flex-1 relative z-20 md:z-auto md:mt-0 md:mx-0 px-0 md:px-0 pb-20 md:pb-0 overflow-y-auto h-full hide-scrollbar">
                    <div className="bg-white rounded-[2rem] md:rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 p-6 md:p-8 min-h-[400px]">

                        {/* Mobile Only: Organization Info & Tabs */}
                        <div className="md:hidden space-y-6 mb-8">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mb-2 shadow-sm border border-blue-100">
                                    <span className="text-3xl font-black">{organization?.name?.charAt(0) || 'O'}</span>
                                </div>
                                <h1 className="text-2xl font-black text-slate-900 flex items-center justify-center gap-2">
                                    {organization?.name}
                                    <PageInfo
                                        title="הגדרות ארגון"
                                        description={
                                            <>
                                                <p className="mb-2">ניהול מרכזי של הגדרות המערכת והמשתמשים.</p>
                                                <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                    <li><b>הזמנות:</b> יצירה וניהול של קישורי הצטרפות לארגון.</li>
                                                    <li><b>תבניות הרשאות:</b> הגדרת תפקידים (כמו מ"מ, סמ"פ) ורמות גישה.</li>
                                                    <li><b>משתמשים:</b> ניהול חברי הארגון, עריכת פרטים והרשאות אישיות.</li>
                                                    <li><b>הגדרות כלליות:</b> שעות לילה, הגדרות לו"ז ועוד.</li>
                                                </ul>
                                            </>
                                        }
                                    />
                                </h1>
                                <p className="text-slate-500 font-medium text-sm">הגדרות וניהול מערכת</p>
                            </div>

                            <div className="bg-slate-50 p-1.5 rounded-2xl flex border border-slate-200 overflow-x-auto hide-scrollbar">
                                {navigationTabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex-none px-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                            ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                                            : 'text-slate-400 hover:bg-slate-200/50 hover:text-slate-600'
                                            }`}
                                    >
                                        <tab.icon size={16} weight={activeTab === tab.id ? 'fill' : 'duotone'} className={tab.id === 'messages' && activeTab !== tab.id ? 'text-slate-500' : ''} />
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                            <div className="h-px bg-slate-100 w-full"></div>
                        </div>

                        {activeTab === 'general' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="hidden md:flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                        <Settings className="text-slate-600" size={28} weight="duotone" />
                                        הגדרות וניהול
                                        <PageInfo
                                            title="הגדרות ארגון"
                                            description={
                                                <>
                                                    <p className="mb-2">ניהול מרכזי של הגדרות המערכת והמשתמשים.</p>
                                                    <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                        <li><b>הזמנות:</b> יצירה וניהול של קישורי הצטרפות לארגון.</li>
                                                        <li><b>תבניות הרשאות:</b> הגדרת תפקידים (כמו מ"מ, סמ"פ) ורמות גישה.</li>
                                                        <li><b>משתמשים:</b> ניהול חברי הארגון, עריכת פרטים והרשאות אישיות.</li>
                                                        <li><b>הגדרות כלליות:</b> שעות לילה, הגדרות לו"ז ועוד.</li>
                                                    </ul>
                                                </>
                                            }
                                        />
                                    </h2>
                                </div>
                                <section>
                                    <div className="flex items-center gap-2 mb-4 text-slate-800">
                                        <LinkIcon className="text-blue-500" size={20} weight="duotone" />
                                        <h2 className="text-xl font-black">הגדרות הזמנה</h2>
                                    </div>
                                    <InviteLinkSettings
                                        organization={organization}
                                        onUpdate={fetchMembers}
                                        templates={templates}
                                        onViewTemplates={() => setActiveTab('roles')}

                                    />
                                </section>

                                <div className="h-px bg-slate-100 my-6"></div>

                                <section>
                                    <div className="flex items-center gap-2 mb-4 text-slate-800">
                                        <Clock className="text-orange-500" size={20} weight="duotone" />
                                        <h2 className="text-xl font-black">הגדרות כלליות</h2>
                                    </div>
                                    <GeneralSettings organizationId={organization?.id || ''} />
                                </section>
                            </div>
                        )}

                        {activeTab === 'roles' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <RoleTemplateManager
                                    organizationId={organization?.id || ''}
                                    templates={templates.filter(t => !SYSTEM_ROLE_PRESETS.some(p => p.name === t.name))}
                                    teams={teams}
                                    onRefresh={fetchTemplates}
                                    isCreating={isCreating}
                                    setIsCreating={setIsCreating}
                                />
                            </div>
                        )}

                        {activeTab === 'members' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <OrganizationUserManagement teams={teams} />
                            </div>
                        )}

                        {activeTab === 'customFields' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <CustomFieldsManager
                                    fields={organizationSettings?.customFieldsSchema || []}
                                    onFieldsChange={async (fields) => {
                                        try {
                                            const { error } = await supabase
                                                .from('organization_settings')
                                                .update({ custom_fields_schema: fields })
                                                .eq('organization_id', organization?.id);

                                            if (error) throw error;

                                            setOrganizationSettings(prev => prev ? { ...prev, customFieldsSchema: fields } : prev);
                                            showToast('שדות מותאמים עודכנו בהצלחה', 'success');
                                        } catch (error: any) {
                                            console.error('Error updating custom fields:', error);
                                            showToast('שגיאה בעדכון שדות מותאמים', 'error');
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {activeTab === 'messages' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <OrganizationMessagesManager teams={teams} roles={roles} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Unified FAB for Organization Settings */}
            <FloatingActionButton
                icon={Plus}
                onClick={() => {
                    if (activeTab === 'roles') setIsCreating(true);
                }}
                ariaLabel={activeTab === 'roles' ? 'תבנית חדשה' : 'הזמן משתמש'}
                show={isAdmin && !loading && activeTab === 'roles'}
            />

            {editingPermissionsFor && (
                <PermissionEditor
                    isOpen={true}
                    onClose={() => setEditingPermissionsFor(null)}
                    user={editingPermissionsFor}
                    onSave={handleSavePermissions}
                    teams={teams}
                    templates={templates}
                    onManageTemplates={() => setActiveTab('roles')}
                />
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};

const InviteLinkSettings: React.FC<{
    organization: any;
    onUpdate: () => void;
    templates: PermissionTemplate[];
    onViewTemplates: () => void;
}> = ({ organization, onUpdate, templates, onViewTemplates }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isActive, setIsActive] = useState(organization?.is_invite_link_active || false);
    const [templateId, setTemplateId] = useState<string | null>(organization?.invite_link_template_id || null);
    const [inviteToken, setInviteToken] = useState(organization?.invite_token || '');

    useEffect(() => {
        if (organization) {
            setIsActive(organization.is_invite_link_active);
            setTemplateId(organization.invite_link_template_id || null);
            setInviteToken(organization.invite_token);
        }
    }, [organization]);

    const handleToggleActive = async () => {
        setLoading(true);
        try {
            let token = inviteToken;
            if (!isActive && !token) {
                console.log('🔗 [InviteLink] No token found, calling RPC: generate_invite_token');
                const { data, error: rpcError } = await supabase.rpc('generate_invite_token');

                if (rpcError) {
                    console.error('❌ [InviteLink] RPC Error:', rpcError);
                    throw rpcError;
                }

                console.log('✅ [InviteLink] RPC Success, Token:', data);
                token = data;
                setInviteToken(token);
            }

            const { error } = await supabase
                .from('organizations')
                .update({ is_invite_link_active: !isActive, invite_token: token })
                .eq('id', organization.id);

            if (error) throw error;
            setIsActive(!isActive);
        } catch (error) {
            console.error('Error toggling invite link:', error);
            showToast('שגיאה בעדכון סטטוס קישור', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        confirm({
            title: 'יצירת קישור חדש',
            message: 'הקישור הקיים יבוטל. האם להמשיך?',
            confirmText: 'כן, צור חדש',
            type: 'warning',
            onConfirm: async () => {
                setLoading(true);
                try {
                    console.log('🔗 [InviteLink] Regenerating... Calling RPC: generate_invite_token');
                    const { data, error } = await supabase.rpc('generate_invite_token');

                    if (error) {
                        console.error('❌ [InviteLink] RPC Error during regeneration:', error);
                        throw error;
                    }

                    console.log('✅ [InviteLink] RPC Success, New Token:', data);
                    setInviteToken(data);
                    setIsActive(true);
                    showToast('קישור חדש נוצר', 'success');
                } catch (error) {
                    showToast('שגיאה ביצירה', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleTemplateChange = async (tid: string) => {
        setTemplateId(tid);
        setLoading(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ invite_link_template_id: tid || null })
                .eq('id', organization.id);

            if (error) throw error;
            showToast('תבנית עודכנה', 'success');
        } catch (error) {
            showToast('שגיאה בעדכון תבנית', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const link = `${window.location.origin}/join/${inviteToken}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link);
            setCopied(true);
            showToast('הועתק!', 'success');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* --- Link Invite Section --- */}
            <div className="bg-gray-50 border border-slate-200 rounded-2xl p-4 md:p-6 space-y-6">
                {/* 1. Toggle Row */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">סטטוס קישור הצטרפות</h3>
                        <p className="text-xs text-slate-500">אפשר למשתמשים להצטרף באופן עצמאי</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={handleToggleActive}
                            disabled={loading}
                        />
                        <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                {/* 2. Active State Controls */}
                {isActive && inviteToken && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1">
                        {/* Template Selector - Compact */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                                <Shield size={12} weight="duotone" /> תבנית הרשאות למצטרפים (דרך הקישור)
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={templateId || ''}
                                        onChange={handleTemplateChange}
                                        options={[
                                            { value: '', label: 'ללא (צפייה בלבד)' },
                                            ...templates.map(t => ({ value: t.id, label: t.name }))
                                        ]}
                                        className="!bg-white !h-10 text-base"
                                        placeholder="בחר תבנית..."
                                    />
                                </div>
                                <button onClick={onViewTemplates} className="bg-white border border-slate-200 rounded-lg px-3 hover:bg-slate-50 text-slate-500">
                                    <Settings size={16} weight="duotone" />
                                </button>
                            </div>
                        </div>

                        {/* Copy Link Button */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1.5 block">קישור ייחודי</label>
                            <button
                                onClick={copyToClipboard}
                                className="w-full flex items-center justify-between bg-white border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 rounded-xl p-3 transition-all group"
                            >
                                <span className="text-base font-mono truncate dir-ltr px-2 opacity-80 group-hover:opacity-100">
                                    {window.location.origin}/join/{inviteToken.slice(0, 8)}...
                                </span>
                                <div className="flex items-center gap-2 font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-700">
                                    {copied ? <CheckCircle size={16} weight="duotone" /> : <Copy size={16} weight="duotone" />}
                                    <span>{copied ? 'הועתק' : 'העתק'}</span>
                                </div>
                            </button>
                        </div>

                        <div className="flex justify-center">
                            <button onClick={handleRegenerate} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                                <RefreshCw size={10} weight="bold" /> אפס קישור קיים
                            </button>
                        </div>
                    </div>
                )}
                <ConfirmationModal {...modalProps} />
            </div>


        </div>
    );
};
