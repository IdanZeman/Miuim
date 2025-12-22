import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { Save, CheckCircle, Clock, Shield, Link as LinkIcon, Moon, UserPlus, Mail, Trash2, Users, Search, Pencil, Info, Copy, RefreshCw, Settings, Plus, Gavel, Layout, UserCircle, Globe, Anchor, Activity } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Team, Profile, UserPermissions, UserRole, OrganizationInvite, PermissionTemplate, ViewMode } from '../types';
import { PermissionEditor } from './PermissionEditor';
import { Modal } from './ui/Modal';
import { ConfirmationModal } from './ConfirmationModal';
import { logger } from '../services/loggingService';
import { useConfirmation } from '../hooks/useConfirmation';
import { Select } from './ui/Select';

const canManageOrganization = (role: UserRole) => {
    return role === 'admin';
};

const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
        case 'admin': return 'מנהל';
        case 'editor': return 'עורך';
        case 'viewer': return 'צופה';
        case 'attendance_only': return 'נוכחות בלבד';
        default: return role;
    }
};

const getRoleDescription = (role: UserRole) => {
    switch (role) {
        case 'admin': return 'גישה מלאה לכל הגדרות הארגון, המשתמשים והנתונים.';
        case 'editor': return 'יכולת עריכת שיבוצים, ניהול משימות וצפייה בדוחות.';
        case 'viewer': return 'צפייה בלוח השיבוצים ובנתונים בלבד, ללא יכולת עריכה.';
        case 'attendance_only': return 'גישה לדיווח נוכחות בלבד.';
        default: return 'הרשאות בסיסיות.';
    }
};

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
}> = ({ organizationId, templates, teams, onRefresh }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [isCreating, setIsCreating] = useState(false);
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
                    <Shield className="text-indigo-600 flex-shrink-0" size={24} />
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800">תבניות הרשאות</h2>
                        <p className="text-xs md:text-sm text-slate-500 font-bold">הגדר תפקידים מובנים כמו "מפקד מחלקה", "חייל" וכו'</p>
                    </div>
                </div>
                <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setIsCreating(true)}
                    className="shadow-md"
                >
                    תבנית חדשה
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(tmp => (
                    <div key={tmp.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-all group shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-black text-slate-800 text-lg">{tmp.name}</h3>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
        canManageUsers: false,
        canManageSettings: false
    });

    const handleSave = () => {
        if (!name.trim()) return;
        onSave(template?.id || null, name, permissions);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={template ? 'עריכת תבנית' : 'יצירת תבנית חדשה'} size="2xl">
            <div className="space-y-6">
                <Input
                    label="שם התבנית"
                    placeholder="למשל: מפקד מחלקה"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="font-black text-lg"
                />

                <div className="border-t border-slate-100 pt-6">
                    <PermissionEditorContent
                        permissions={permissions}
                        setPermissions={setPermissions}
                        teams={teams}
                    />
                </div>

                <div className="flex justify-end gap-3 mt-8">
                    <Button variant="ghost" onClick={onClose}>ביטול</Button>
                    <Button variant="primary" icon={Save} onClick={handleSave} disabled={!name.trim()}>שמור תבנית</Button>
                </div>
            </div>
        </Modal>
    );
};

// Extracted Permission Editor Logic to share between Profile and Template
const PermissionEditorContent: React.FC<{
    permissions: UserPermissions;
    setPermissions: React.Dispatch<React.SetStateAction<UserPermissions>>;
    teams: Team[];
}> = ({ permissions, setPermissions, teams }) => {
    const setAllScreens = (lvl: 'none' | 'view' | 'edit') => {
        const nextScreens: any = {};
        SCREENS.forEach(s => {
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
                    <Globe size={14} />
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
                            {SCREENS.map(screen => (
                                <tr key={screen.id}>
                                    <td className="px-4 py-3 flex items-center gap-2 font-bold text-slate-700">
                                        <screen.icon size={16} className="text-slate-400" />
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
    const [optimizationMode, setOptimizationMode] = useState<'ratio' | 'min_staff' | 'tasks'>('ratio');
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
                setOptimizationMode(data.optimization_mode || 'ratio');
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
                min_daily_staff: minStaff,
                optimization_mode: optimizationMode
            });

        if (error) {
            console.error('Error saving settings:', error);
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
        <div className="space-y-4 md:space-y-6 max-w-3xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4 max-w-2xl">
                <div className="flex-1 w-full md:w-auto">
                    <label className="block text-sm font-bold text-slate-700 mb-1">התחלת משמרת לילה</label>
                    <div className="relative flex items-center bg-white rounded-lg border border-slate-300 px-3 py-2 w-full group hover:border-blue-500 transition-colors">
                        <span className={`text-sm font-bold flex-1 text-right pointer-events-none ${start ? 'text-slate-900' : 'text-slate-400'}`}>
                            {start || 'בחר שעה'}
                        </span>
                        <input
                            type="time"
                            value={start}
                            onChange={e => setStart(e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        />
                        <Clock size={18} className="text-slate-400 ml-2 pointer-events-none" />
                    </div>
                </div>
                <div className="flex-1 w-full md:w-auto">
                    <label className="block text-sm font-bold text-slate-700 mb-1">סיום משמרת לילה</label>
                    <div className="relative flex items-center bg-white rounded-lg border border-slate-300 px-3 py-2 w-full group hover:border-blue-500 transition-colors">
                        <span className={`text-sm font-bold flex-1 text-right pointer-events-none ${end ? 'text-slate-900' : 'text-slate-400'}`}>
                            {end || 'בחר שעה'}
                        </span>
                        <input
                            type="time"
                            value={end}
                            onChange={e => setEnd(e.target.value)}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        />
                        <Clock size={18} className="text-slate-400 ml-2 pointer-events-none" />
                    </div>
                </div>
            </div>
            <p className="text-slate-400 text-xs md:text-sm -mt-2">הגדרת משמרת לילה מסייעת לאלגוריתם לחשב את קושי המשימות בשיבוץ.</p>

            <div className="border-t border-slate-100 pt-4 md:pt-6">
                <label className="text-sm font-bold text-slate-700 block mb-2">מטרת השיבוץ (ברירת מחדל)</label>
                <div className="flex bg-slate-50 p-1 rounded-lg gap-2 mb-4 max-w-2xl">
                    <button
                        onClick={() => setOptimizationMode('ratio')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${optimizationMode === 'ratio' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <span>⚖️ שמירה על יחס</span>
                        <span className="text-[10px] font-normal opacity-70">חלוקה הוגנת (11-3)</span>
                    </button>
                    <button
                        onClick={() => setOptimizationMode('min_staff')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${optimizationMode === 'min_staff' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <span>🛡️ סד״כ מינימלי</span>
                        <span className="text-[10px] font-normal opacity-70">מקסימום בבית</span>
                    </button>
                    <button
                        onClick={() => setOptimizationMode('tasks')}
                        className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${optimizationMode === 'tasks' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'}`}
                    >
                        <span>📋 נגזרת משימות</span>
                        <span className="text-[10px] font-normal opacity-70">איוש כל המשימות</span>
                    </button>
                </div>

                <Input
                    type="number"
                    label="חשיפת לו&quot;ז לצופים (ימים קדימה)"
                    min={1}
                    max={30}
                    value={viewerDays}
                    onChange={e => setViewerDays(parseInt(e.target.value))}
                    containerClassName="w-32"
                />
                <p className="text-slate-400 text-xs md:text-sm mt-2">המשתמשים יוכלו לראות את הלו"ז להיום ולמספר הימים הבאים שהוגדר.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 md:gap-4 pt-2">
                {showSuccess && (
                    <div className="flex items-center justify-center gap-2 text-green-600 animate-fadeIn">
                        <CheckCircle size={16} />
                        <span className="font-bold text-xs md:text-sm">נשמר בהצלחה!</span>
                    </div>
                )}
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    variant="primary"
                    className="w-full sm:w-auto shadow-md"
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
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
    const [sending, setSending] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
    const [activeTab, setActiveTab] = useState<'general' | 'members' | 'roles'>('general');

    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (organization) {
            fetchMembers();
            fetchInvites();
            fetchTemplates();
        }
    }, [organization]);

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

    const fetchMembers = async () => {
        if (!organization) return;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', organization.id)
            .order('role', { ascending: true });

        if (error) {
            console.error('Error fetching members:', error);
        } else {
            setMembers(data || []);
        }
        setLoading(false);
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

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!organization || !user || !inviteEmail.trim()) return;

        setSending(true);
        try {
            const { error } = await supabase
                .from('organization_invites')
                .insert({
                    organization_id: organization.id,
                    email: inviteEmail.trim().toLowerCase(),
                    role: inviteRole,
                    invited_by: user.id
                });

            if (error) throw error;

            if (error) throw error;

            showToast(`הזמנה נשלחה ל-${inviteEmail}`, 'success');
            setInviteEmail('');
            setInviteRole('viewer');
            fetchInvites();
        } catch (error: any) {
            console.error('Error sending invite:', error);
            if (error.code === '23505') {
                showToast('משתמש זה כבר הוזמן או חבר בארגון', 'warning');
            } else {
                showToast('שגיאה בשליחת ההזמנה', 'error');
            }
        } finally {
            setSending(false);
        }
    };

    const handleDeleteInvite = async (inviteId: string) => {
        confirm({
            title: 'מחיקת הזמנה',
            message: 'האם אתה בטוח שברצונך למחוק הזמנה זו?',
            confirmText: 'מחק',
            type: 'danger',
            onConfirm: async () => {
                const { error } = await supabase
                    .from('organization_invites')
                    .delete()
                    .eq('id', inviteId);

                if (error) {
                    console.error('Error deleting invite:', error);
                    showToast('שגיאה במחיקת ההזמנה', 'error');
                } else {
                    showToast('ההזמנה נמחקה בהצלחה', 'success');
                    fetchInvites();
                }
            }
        });
    };

    const handleChangeRole = async (memberId: string, newRole: UserRole) => {
        console.log(`[OrganizationSettings] Requesting role change for ${memberId} to ${newRole}`);
        confirm({
            cancelText: 'ביטול',
            title: 'שינוי הרשאה',
            message: 'האם אתה בטוח שברצונך לשנות את ההרשאה?',
            confirmText: 'עדכן',
            type: 'warning',
            onConfirm: async () => {
                console.log(`[OrganizationSettings] Confirmed role change for ${memberId} to ${newRole}`);
                const { error, data } = await supabase
                    .from('profiles')
                    .update({ role: newRole })
                    .eq('id', memberId)
                    .select();

                console.log(`[OrganizationSettings] Update result:`, { error, data });

                if (error) {
                    console.error('Error updating role:', error);
                    showToast('שגיאה בעדכון ההרשאה', 'error');
                } else {
                    // LOG
                    const member = members.find(m => m.id === memberId);
                    await logger.logUpdate('profile', memberId, member?.full_name || member?.email || 'משתמש',
                        { role: member?.role },
                        { role: newRole }
                    );

                    showToast('ההרשאה עודכנה בהצלחה', 'success');
                    fetchMembers();
                }
            }
        });
    };

    const [editingPermissionsFor, setEditingPermissionsFor] = useState<Profile | null>(null);

    const handleOpenPermissionEditor = (member: Profile) => {
        setEditingPermissionsFor(member);
    };

    const handleSavePermissions = async (userId: string, permissions: UserPermissions) => {
        console.log(`Saving permissions for ${userId}`, permissions);
        const { error } = await supabase
            .from('profiles')
            .update({ permissions: permissions as any })
            .eq('id', userId);

        // Fetch old permissions for log diff (optional, but good)
        const oldPerms = members.find(m => m.id === userId)?.permissions;

        if (error) {
            console.error('Error saving permissions:', error);
            if (error.code === 'PGRST204') {
                showToast('שגיאה: חסרה עמודת permissions בטבלה profiles. יש להריץ את סקריפט העדכון (db_update.sql).', 'error');
            } else {
                showToast('שגיאה בשמירת הרשאות', 'error');
            }
        } else {
            showToast('הרשאות עודכנו בהצלחה', 'success');
            setMembers(prev => prev.map(m => m.id === userId ? { ...m, permissions } : m));

            logger.log({
                level: 'INFO',
                action: 'UPDATE',
                entityType: 'person',
                entityId: userId,
                component: 'OrganizationSettings',
                category: 'security',
                actionDescription: 'עדכן הרשאות משתמש מותאמות אישית',
                oldData: { permissions: oldPerms },
                newData: { permissions: permissions }
            });
        }
        setEditingPermissionsFor(null);
    };

    if (!canManageOrganization(profile?.role || 'viewer')) {
        return (
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg border-2 border-red-200">
                <div className="text-center">
                    <Shield className="mx-auto text-red-500 mb-4" size={40} />
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">אין הרשאה</h2>
                    <p className="text-sm md:text-base text-slate-600">רק מנהלים יכולים לגשת להגדרות הארגון</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-xl md:rounded-2xl p-6 md:p-8 shadow-lg border-2 border-emerald-200">
                <p className="text-center text-slate-600 text-sm md:text-base">טוען...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 max-w-4xl mx-auto pb-20">
            {/* Tab Navigation */}
            <div className="sticky top-0 z-20 flex bg-white/80 backdrop-blur-md p-1.5 rounded-2xl shadow-lg border border-slate-200/50 mb-6 mt-[-4px]">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'general' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Settings size={18} />
                    הגדרות כלליות
                </button>
                <button
                    onClick={() => setActiveTab('roles')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'roles' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Shield size={18} />
                    ניהול תפקידים (RBAC)
                </button>
                <button
                    onClick={() => setActiveTab('members')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-2 ${activeTab === 'members' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                    <Users size={18} />
                    חברי ארגון
                </button>
            </div>

            {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Organization Info */}
                    <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 md:gap-4 mb-4">
                            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center flex-shrink-0 animate-pulse-slow">
                                <img src="/favicon.png" alt="Logo" className="w-10 h-10 object-contain opacity-50" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h1 className="text-xl md:text-2xl font-black text-slate-800 truncate">{organization?.name}</h1>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">ניהול הגדרות ארגון</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 md:gap-3 mb-6">
                            <LinkIcon className="text-blue-600 flex-shrink-0" size={20} />
                            <h2 className="text-lg md:text-xl font-black text-slate-800">קישור הצטרפות</h2>
                        </div>
                        <InviteLinkSettings
                            organization={organization}
                            onUpdate={fetchMembers}
                            templates={templates}
                            onViewTemplates={() => setActiveTab('roles')}
                        />
                    </div>

                    <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-sm border border-slate-200">
                        <div className="flex items-center gap-2 md:gap-3 mb-6">
                            <Moon className="text-indigo-600 flex-shrink-0" size={20} />
                            <h2 className="text-lg md:text-xl font-black text-slate-800">הגדרות מערכת</h2>
                        </div>
                        <GeneralSettings organizationId={organization?.id || ''} />
                    </div>
                </div>
            )}

            {activeTab === 'roles' && (
                <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <RoleTemplateManager
                        organizationId={organization?.id || ''}
                        templates={templates}
                        teams={teams}
                        onRefresh={fetchTemplates}
                    />
                </div>
            )}

            {activeTab === 'members' && (
                <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-4 md:mb-6">
                        <div className="flex items-center gap-2 md:gap-3">
                            <Users className="text-emerald-600 flex-shrink-0" size={20} />
                            <h2 className="text-lg md:text-2xl font-bold text-slate-800">משתמשים במערכת</h2>
                        </div>
                        <div className="w-full max-w-xs">
                            <Input
                                placeholder="חפש משתמש..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                icon={Search}
                                className="rounded-full"
                                containerClassName="max-w-xs"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        {members.filter(m =>
                        (m.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            m.email.toLowerCase().includes(searchTerm.toLowerCase()))
                        ).map((member) => (
                            <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 md:p-4 bg-slate-50 rounded-lg md:rounded-xl border border-slate-200 gap-3">
                                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                    <div className="w-9 h-9 md:w-10 md:h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <span className="text-emerald-700 font-bold text-sm md:text-base">
                                            {member.email.charAt(0).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-slate-800 text-sm md:text-base truncate">
                                            {member.full_name || member.email.split('@')[0]}
                                            {member.id === user?.id && <span className="text-emerald-600 mr-2 text-xs md:text-sm">(אתה)</span>}
                                        </p>
                                        <p className="text-xs md:text-sm text-slate-500 truncate">{member.email}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 sm:flex-shrink-0">
                                    {member.id === user?.id ? (
                                        <span className="px-3 md:px-4 py-1.5 md:py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium text-xs md:text-sm text-center">
                                            {getRoleDisplayName(member.role)}
                                        </span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Button
                                                onClick={() => handleOpenPermissionEditor(member)}
                                                variant="ghost"
                                                size="sm"
                                                icon={Pencil}
                                                className="bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600"
                                            >
                                                ערוך הרשאות
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
    templates: PermissionTemplate[],
    onViewTemplates: () => void
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
            // If we are enabling and there is no token, generate one first
            let token = inviteToken;
            if (!isActive && !token) {
                const { data, error: rpcError } = await supabase.rpc('generate_invite_token', { org_id: organization.id });
                if (rpcError) throw rpcError;
                token = data;
                setInviteToken(token);
            }

            const { error } = await supabase
                .from('organizations')
                .update({
                    is_invite_link_active: !isActive,
                    invite_token: token // Ensure token is set
                })
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
            message: 'האם אתה בטוח? הקישור הקודם יפסיק לעבוד ומשתמשים לא יוכלו להצטרף באמצעותו.',
            confirmText: 'צור קישור חדש',
            type: 'warning',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase.rpc('generate_invite_token', { org_id: organization.id });

                    if (error) throw error;

                    setInviteToken(data);
                    setIsActive(true); // Auto-enable on regenerate
                    showToast('קישור חדש נוצר בהצלחה', 'success');
                } catch (error) {
                    console.error('Error regenerating token:', error);
                    showToast('שגיאה ביצירת קישור חדש', 'error');
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
                .update({
                    invite_link_template_id: tid || null
                })
                .eq('id', organization.id);

            if (error) throw error;
            showToast('הגדרות הקישור עודכנו', 'success');
        } catch (error) {
            console.error('Error updating invite template:', error);
            showToast('שגיאה בעדכון התבנית', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const link = `${window.location.origin}/join/${inviteToken}`;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(link);
            setCopied(true);
            showToast('הקישור הועתק ללוח', 'success');
            setTimeout(() => setCopied(false), 2000);
        } else {
            // Fallback
            showToast('שגיאה בהעתקה, נא להעתיק ידנית', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer group" dir="ltr">
                    <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isActive}
                        onChange={handleToggleActive}
                        disabled={loading}
                    />
                    <div className="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-base font-medium text-slate-700 group-hover:text-slate-900 transition-colors">
                        {isActive ? 'קישור פעיל' : 'קישור לא פעיל'}
                    </span>
                </label>

                {/* Selection Area */}
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                        <Shield size={16} className="text-indigo-600" />
                        <span className="text-sm font-black text-slate-700">תבנית הרשאות למצטרפים</span>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border-2 border-slate-100 transition-all focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-50 shadow-sm overflow-hidden relative group">
                        <div className="absolute top-0 right-0 w-2 h-full bg-indigo-500 opacity-0 group-focus-within:opacity-100 transition-opacity"></div>

                        <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">בחר תבנית הרשאות עבור הקישור</label>

                        {templates.length > 0 ? (
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <div className="w-full sm:flex-1">
                                    <Select
                                        value={templateId || ''}
                                        onChange={(val) => handleTemplateChange(val)}
                                        options={[
                                            { value: '', label: 'ללא תבנית (גישת "בית" בלבד)' },
                                            ...templates.map(t => ({ value: t.id, label: t.name }))
                                        ]}
                                        disabled={loading}
                                        placeholder="בחר תבנית..."
                                    />
                                    <button
                                        onClick={onViewTemplates}
                                        className="mt-2 text-[10px] font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors px-1"
                                    >
                                        <Shield size={10} />
                                        נהל תבניות הרשאות קיימות...
                                    </button>
                                </div>
                                <div className="h-full sm:w-px sm:h-10 bg-slate-100 hidden sm:block"></div>
                                <div className="flex-1 text-xs text-slate-500 font-bold italic">
                                    {templateId ? 'כל מצטרף יקבל את ההרשאות המוגדרות בתבנית זו.' : 'ללא תבנית, המשתמש יראה רק את עמוד הבית (מסך הפתיחה) ללא גישה ללוח השיבוצים או נתונים.'}
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100 text-amber-700">
                                <Info size={20} className="shrink-0" />
                                <div className="flex-1">
                                    <div className="text-xs font-black">
                                        אין עדיין תבניות מוגדרות. צור את התבנית הראשונה שלך בלשונית "ניהול תפקידים" כדי להפעיל את הקישור עם הרשאות מותאמות.
                                    </div>
                                    <button
                                        onClick={onViewTemplates}
                                        className="mt-2 text-xs font-black underline hover:text-amber-900"
                                    >
                                        עבור לניהול תפקידים עכשיו
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {isActive && inviteToken && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 flex items-start gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>
                            {templateId && templates.find(t => t.id === templateId) ? (
                                <>
                                    <strong>משמעות התבנית הנבחרת ({templates.find(t => t.id === templateId)?.name}):</strong><br />
                                    {templates.find(t => t.id === templateId)?.description || 'הרשאות מותאמות אישית כפי שהוגדרו בתבנית הארגונית.'}
                                </>
                            ) : (
                                <>
                                    <strong>משמעות ההצטרפות (עמוד הבית בלבד):</strong><br />
                                    גישה למסך הפתיחה בלבד. לוח השיבוצים ושאר חלקי המערכת יהיו חסומים עד להגדרת הרשאות.
                                </>
                            )}
                        </span>
                    </p>

                    <div className="flex flex-col md:flex-row gap-3 items-end flex-wrap">
                        {/* URL Display */}
                        <div className="flex-1 w-full min-w-[200px]">
                            <label className="text-xs font-bold text-slate-500 mb-1 block">קישור להעתקה</label>
                            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all shadow-sm">
                                <div
                                    className="flex-1 px-3 py-2 text-slate-600 text-sm font-mono truncate select-all"
                                    dir="ltr"
                                >
                                    {`${window.location.origin}/join/${inviteToken}`}
                                </div>
                                <div className="w-px h-8 bg-slate-100 mx-1"></div>
                                <Button
                                    onClick={copyToClipboard}
                                    variant="ghost"
                                    className="text-slate-500 hover:text-blue-600 p-2 h-auto w-auto"
                                    title="העתק קישור"
                                >
                                    {copied ? <CheckCircle size={20} className="text-green-500" /> : <Copy size={20} />}
                                </Button>
                            </div>
                        </div>

                        {/* Regenerate Button */}
                        <div className="w-full md:w-auto shrink-0">
                            <Button
                                onClick={handleRegenerate}
                                disabled={loading}
                                icon={RefreshCw}
                                variant="outline"
                                className="bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 w-full"
                            >
                                צור קישור חדש
                            </Button>
                        </div>
                    </div>
                </div>
            )
            }
            <ConfirmationModal {...modalProps} />
        </div >
    );
};
