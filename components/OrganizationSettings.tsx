import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useConfirmation } from '../hooks/useConfirmation';
import { ConfirmationModal } from './ConfirmationModal';
import { logger } from '../services/loggingService';
import { Save, CheckCircle, LinkIcon, Copy, RefreshCw, Moon, Shield, UserPlus, Clock, XCircle, Mail, Trash2, Users } from 'lucide-react';
import { UserRole, Profile, OrganizationInvite } from '../types';

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
        const { data, error } = await supabase
            .from('organization_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .single();

        if (data) {
            setStart(data.night_shift_start.slice(0, 5));
            setEnd(data.night_shift_end.slice(0, 5));
            setViewerDays(data.viewer_schedule_days || 2);
        }
        setLoading(false);
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
            <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-4">
                <div className="flex-1">
                    <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">התחלת משמרת לילה</label>
                    <input
                        type="time"
                        value={start}
                        onChange={e => setStart(e.target.value)}
                        className="w-full px-3 md:px-4 py-2 rounded-lg md:rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none text-sm md:text-base"
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">סיום משמרת לילה</label>
                    <input
                        type="time"
                        value={end}
                        onChange={e => setEnd(e.target.value)}
                        className="w-full px-3 md:px-4 py-2 rounded-lg md:rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none text-sm md:text-base"
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 pt-4 md:pt-6">
                <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">חשיפת לו"ז לצופים (ימים קדימה)</label>
                <div className="flex items-center gap-3 md:gap-4">
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={viewerDays}
                        onChange={e => setViewerDays(parseInt(e.target.value))}
                        className="w-20 md:w-24 px-3 md:px-4 py-2 rounded-lg md:rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none text-sm md:text-base"
                    />
                    <span className="text-slate-500 text-xs md:text-sm">ימים</span>
                </div>
                <p className="text-slate-400 text-xs md:text-sm mt-2">המשתמשים יוכלו לראות את הלו"ז להיום ולמספר הימים הבאים שהוגדר.</p>
            </div>

            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 md:gap-4 pt-2">
                {showSuccess && (
                    <div className="flex items-center justify-center gap-2 text-green-600 animate-fadeIn">
                        <CheckCircle size={16} />
                        <span className="font-bold text-xs md:text-sm">נשמר בהצלחה!</span>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm md:text-base"
                >
                    <Save size={16} />
                    {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
            </div>
        </div>
    );
};

export const OrganizationSettings: React.FC = () => {
    const { user, profile, organization } = useAuth();
    const [members, setMembers] = useState<Profile[]>([]);
    const [invites, setInvites] = useState<OrganizationInvite[]>([]);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<UserRole>('viewer');
    const [sending, setSending] = useState(false);

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
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 md:w-7 md:h-7 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
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

                <form onSubmit={handleSendInvite} className="space-y-3 md:space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div>
                            <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">
                                כתובת אימייל
                            </label>
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:outline-none text-right text-sm md:text-base"
                                required
                                disabled={sending}
                            />
                        </div>

                        <div>
                            <label className="block text-slate-700 font-medium mb-2 text-right text-sm md:text-base">
                                הרשאה
                            </label>
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                                className="w-full px-3 md:px-4 py-2 md:py-3 rounded-lg md:rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:outline-none text-right text-sm md:text-base"
                                disabled={sending}
                            >
                                <option value="admin">מנהל - גישה מלאה</option>
                                <option value="editor">עורך - עריכת שיבוצים</option>
                                <option value="viewer">צופה - צפייה בלבד</option>
                                <option value="attendance_only">נוכחות בלבד</option>
                            </select>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={sending || !inviteEmail.trim()}
                        className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-2.5 md:py-3 px-5 md:px-6 rounded-lg md:rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm md:text-base"
                    >
                        <Mail size={18} />
                        <span>{sending ? 'שולח...' : 'שלח הזמנה'}</span>
                    </button>
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
                                <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                    title="מחק הזמנה"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Members List */}
            <div className="bg-white rounded-xl md:rounded-2xl p-5 md:p-8 shadow-lg border-2 border-emerald-200">
                <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                    <Users className="text-emerald-600 flex-shrink-0" size={20} />
                    <h2 className="text-lg md:text-2xl font-bold text-slate-800">חברי צוות</h2>
                </div>

                <div className="space-y-2 md:space-y-3">
                    {members.map((member) => (
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
                                    <select
                                        value={member.role}
                                        onChange={(e) => handleChangeRole(member.id, e.target.value as UserRole)}
                                        className="w-full sm:w-auto px-3 md:px-4 py-1.5 md:py-2 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:outline-none font-medium text-xs md:text-sm"
                                    >
                                        <option value="admin">מנהל</option>
                                        <option value="editor">עורך</option>
                                        <option value="viewer">צופה</option>
                                        <option value="attendance_only">נוכחות בלבד</option>
                                    </select>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
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
        navigator.clipboard.writeText(link);
        setCopied(true);
        showToast('הקישור הועתק ללוח', 'success');
        setTimeout(() => setCopied(false), 2000);
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
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                    <span className="text-sm font-medium text-slate-600 whitespace-nowrap">הרשאה למצטרפים:</span>
                    <select
                        value={defaultRole}
                        onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                        disabled={loading}
                        className="bg-transparent border-none text-sm font-bold text-slate-800 focus:ring-0 cursor-pointer py-0 pl-8 pr-2"
                    >
                        <option value="viewer">צופה</option>
                        <option value="editor">עורך</option>
                        <option value="attendance_only">נוכחות בלבד</option>
                        <option value="member">חבר צוות</option>
                    </select>
                </div>
            </div>

            {isActive && inviteToken && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col md:flex-row gap-3">
                        {/* URL Display */}
                        <div className="flex-1 flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border-2 border-slate-200 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50 transition-all">
                            <div
                                className="flex-1 px-3 py-2 text-slate-600 text-sm font-mono truncate select-all"
                                dir="ltr"
                            >
                                {`${window.location.origin}/join/${inviteToken}`}
                            </div>
                            <div className="w-px h-8 bg-slate-200 mx-1"></div>
                            <button
                                onClick={copyToClipboard}
                                className="p-2 hover:bg-white rounded-lg transition-all text-slate-500 hover:text-blue-600 hover:shadow-sm active:scale-95"
                                title="העתק קישור"
                            >
                                {copied ? <CheckCircle size={20} className="text-green-500" /> : <Copy size={20} />}
                            </button>
                        </div>

                        {/* Regenerate Button */}
                        <button
                            onClick={handleRegenerate}
                            disabled={loading}
                            className="px-5 py-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-sm hover:shadow-md active:scale-95"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                            <span>צור קישור חדש</span>
                        </button>
                    </div>

                    <p className="text-xs text-slate-500 flex items-center gap-1.5 mr-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        משתמשים שיירשמו דרך הקישור יצורפו אוטומטית לארגון עם ההרשאה שנבחרה.
                    </p>
                </div>
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};
