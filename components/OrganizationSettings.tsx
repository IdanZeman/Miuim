import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { Save, CheckCircle, Clock, Shield, Link as LinkIcon, Moon, UserPlus, Mail, Trash2, Users, Search, Pencil, Info, Copy, RefreshCw } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Team, Profile, UserPermissions, UserRole, OrganizationInvite } from '../types';
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

const GeneralSettings: React.FC<{ organizationId: string }> = ({ organizationId }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [start, setStart] = useState('22:00');
    const [end, setEnd] = useState('06:00');
    const [viewerDays, setViewerDays] = useState(2);

    useEffect(() => {
        fetchSettings();
    }, [organizationId]);

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('organization_settings')
                .select('*')
                .eq('organization_id', organizationId)
                .maybeSingle(); // Use maybeSingle to avoid 406 on empty? No, 406 is header/content neg. 

            if (error) {
                if (error.code !== '406' && error.code !== 'PGRST116') {
                    console.error('Error fetching settings:', error);
                }
                // If 406 or not found, just use defaults
            }

            if (data) {
                setStart(data.night_shift_start.slice(0, 5));
                setEnd(data.night_shift_end.slice(0, 5));
                setViewerDays(data.viewer_schedule_days || 2);
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
                viewer_schedule_days: viewerDays
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
        <div className="space-y-4 md:space-y-6">
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

            <div className="border-t border-slate-100 pt-4 md:pt-6">
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

    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    const isAdmin = profile?.role === 'admin';

    useEffect(() => {
        if (organization) {
            fetchMembers();
            fetchInvites();
        }
    }, [organization]);

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
        <div className="space-y-4 md:space-y-6">
            {/* Organization Info */}
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-yellow-200">
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                    <div className="w-24 h-24 md:w-32 md:h-32 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src="/images/app_icon.png" alt="Organization Logo" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl md:text-3xl font-bold text-slate-800 truncate">{organization?.name}</h1>
                        <p className="text-sm md:text-base text-slate-600">{members.length} חברי צוות</p>
                    </div>
                </div>
            </div>

            {/* Invite Link Settings */}
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-blue-200">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <LinkIcon className="text-blue-600 flex-shrink-0" size={20} />
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800">קישור הצטרפות</h2>
                </div>
                <InviteLinkSettings organization={organization} onUpdate={fetchMembers} />
            </div>

            {/* Night Shift Settings */}
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-indigo-200">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <Moon className="text-indigo-600 flex-shrink-0" size={20} />
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800">הגדרות כלליות</h2>
                </div>
                <GeneralSettings organizationId={organization?.id || ''} />
            </div>

            {/* Invite Form */}
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-emerald-200">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <UserPlus className="text-emerald-600 flex-shrink-0" size={20} />
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800">הזמן משתמש חדש</h2>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-3 md:space-y-4 max-w-3xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <Input
                            label="כתובת אימייל"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="user@example.com"
                            required
                            disabled={sending}
                            className="text-right"
                        />

                        <div>
                            <Select
                                label="הרשאה"
                                value={inviteRole}
                                onChange={(val) => setInviteRole(val as UserRole)}
                                options={[
                                    { value: 'admin', label: 'מנהל - גישה מלאה' },
                                    { value: 'editor', label: 'עורך - עריכת שיבוצים' },
                                    { value: 'viewer', label: 'צופה - צפייה בלבד' },
                                    { value: 'attendance_only', label: 'נוכחות בלבד' }
                                ]}
                                disabled={sending}
                                placeholder="בחר הרשאה"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={sending || !inviteEmail.trim()}
                        isLoading={sending}
                        icon={Mail}
                        fullWidth={false}
                        variant="primary"
                        className="w-full md:w-auto shadow-md"
                    >
                        {sending ? 'שולח...' : 'שלח הזמנה'}
                    </Button>
                </form>
            </div>

            {/* Pending Invites */}
            {invites.length > 0 && (
                <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-yellow-200">
                    <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                        <Clock className="text-yellow-600 flex-shrink-0" size={20} />
                        <h2 className="text-lg md:text-2xl font-bold text-slate-800">הזמנות ממתינות</h2>
                    </div>

                    <div className="space-y-2 md:space-y-3">
                        {invites.map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between p-3 md:p-4 bg-yellow-50 rounded-lg md:rounded-xl border border-yellow-200 gap-3">
                                <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
                                    <Mail className="text-yellow-600 flex-shrink-0" size={18} />
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-slate-800 text-sm md:text-base truncate">{invite.email}</p>
                                        <p className="text-xs md:text-sm text-slate-600">{getRoleDisplayName(invite.role)}</p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    variant="ghost"
                                    className="text-red-500 hover:bg-red-50 hover:text-red-600 p-2 h-auto w-auto"
                                    title="מחק הזמנה"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Members List */}
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-emerald-200">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <div className="flex items-center gap-2 md:gap-3">
                        <Users className="text-emerald-600 flex-shrink-0" size={20} />
                        <h2 className="text-lg md:text-2xl font-bold text-slate-800">חברי צוות</h2>
                    </div>
                    <div className="w-full max-w-xs">
                        <Input
                            placeholder="חפש חבר צוות..."
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
            {editingPermissionsFor && (
                <PermissionEditor
                    isOpen={true}
                    onClose={() => setEditingPermissionsFor(null)}
                    user={editingPermissionsFor}
                    onSave={handleSavePermissions}
                    teams={teams}
                />
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};

const InviteLinkSettings: React.FC<{ organization: any, onUpdate: () => void }> = ({ organization, onUpdate }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isActive, setIsActive] = useState(organization?.is_invite_link_active || false);
    const [defaultRole, setDefaultRole] = useState<UserRole>(organization?.invite_link_role || 'member');
    const [inviteToken, setInviteToken] = useState(organization?.invite_token || '');

    useEffect(() => {
        if (organization) {
            setIsActive(organization.is_invite_link_active);
            setDefaultRole(organization.invite_link_role || 'member');
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

    const handleRoleChange = async (newRole: UserRole) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('organizations')
                .update({ invite_link_role: newRole })
                .eq('id', organization.id);

            if (error) throw error;
            setDefaultRole(newRole);
        } catch (error) {
            console.error('Error updating default role:', error);
            showToast('שגיאה בעדכון הרשאת ברירת מחדל', 'error');
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

    const getRoleDescription = (role: UserRole) => {
        switch (role) {
            case 'admin': return 'גישה מלאה לכל הגדרות הארגון, המשתמשים והנתונים.';
            case 'editor': return 'יכולת עריכת שיבוצים, ניהול משימות וצפייה בדוחות.';
            case 'viewer': return 'צפייה בלוח השיבוצים ובנתונים בלבד, ללא יכולת עריכה.';
            case 'attendance_only': return 'גישה לדיווח נוכחות בלבד.';
            default: return 'הרשאות בסיסיות.';
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

                {/* Role Selector */}
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 w-full sm:w-auto">
                    <span className="text-sm font-medium text-slate-600 whitespace-nowrap hidden sm:inline">הרשאה למצטרפים:</span>
                    <div className="w-full sm:w-48">
                        <Select
                            value={defaultRole}
                            onChange={(val) => handleRoleChange(val as UserRole)}
                            options={[
                                { value: 'viewer', label: 'צופה (Viewer)' },
                                { value: 'editor', label: 'עורך (Editor)' },
                                { value: 'admin', label: 'מנהל (Admin)' },
                                { value: 'attendance_only', label: 'נוכחות בלבד' }
                            ]}
                            disabled={loading}
                            placeholder="בחר הרשאה"
                        />
                    </div>
                </div>
            </div>

            {isActive && inviteToken && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm text-slate-600 flex items-start gap-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>
                            <strong>משמעות ההרשאה הנבחרת ({getRoleDisplayName(defaultRole)}):</strong><br />
                            {getRoleDescription(defaultRole)}
                        </span>
                    </p>

                    <div className="flex flex-col md:flex-row gap-3 items-end">
                        {/* URL Display */}
                        <div className="flex-1 w-full">
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
                        <div className="w-full md:w-auto">
                            <Button
                                onClick={handleRegenerate}
                                disabled={loading}
                                icon={RefreshCw}
                                variant="outline"
                                className="bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                            >
                                צור קישור חדש
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};
