import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { OrganizationInvite, Profile, UserRole } from '../types';
import { getRoleDisplayName, getRoleDescription, canManageOrganization } from '../utils/permissions';
import { Users, Mail, Trash2, Shield, UserPlus, Clock, CheckCircle, XCircle, Moon, Save } from 'lucide-react';

const GeneralSettings: React.FC<{ organizationId: string }> = ({ organizationId }) => {
    const [start, setStart] = useState('22:00');
    const [end, setEnd] = useState('06:00');
    const [viewerDays, setViewerDays] = useState(2);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

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
            alert('שגיאה בשמירת ההגדרות');
        } else {
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }
        setSaving(false);
    };

    if (loading) return <div className="text-slate-500">טוען הגדרות...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-end gap-4">
                <div>
                    <label className="block text-slate-700 font-medium mb-2 text-right">התחלת משמרת לילה</label>
                    <input
                        type="time"
                        value={start}
                        onChange={e => setStart(e.target.value)}
                        className="px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="block text-slate-700 font-medium mb-2 text-right">סיום משמרת לילה</label>
                    <input
                        type="time"
                        value={end}
                        onChange={e => setEnd(e.target.value)}
                        className="px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6">
                <label className="block text-slate-700 font-medium mb-2 text-right">חשיפת לו"ז לצופים (ימים קדימה)</label>
                <div className="flex items-center gap-4">
                    <input
                        type="number"
                        min="1"
                        max="30"
                        value={viewerDays}
                        onChange={e => setViewerDays(parseInt(e.target.value))}
                        className="w-24 px-4 py-2 rounded-xl border-2 border-slate-200 focus:border-indigo-400 focus:outline-none"
                    />
                    <span className="text-slate-500 text-sm">ימים</span>
                </div>
                <p className="text-slate-400 text-sm mt-1">המשתמשים יוכלו לראות את הלו"ז להיום ולמספר הימים הבאים שהוגדר.</p>
            </div>

            <div className="flex justify-end items-center gap-4">
                {showSuccess && (
                    <div className="flex items-center gap-2 text-green-600 animate-fadeIn">
                        <CheckCircle size={18} />
                        <span className="font-bold text-sm">נשמר בהצלחה!</span>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                    <Save size={18} />
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

            alert(`הזמנה נשלחה ל-${inviteEmail}`);
            setInviteEmail('');
            setInviteRole('viewer');
            fetchInvites();
        } catch (error: any) {
            console.error('Error sending invite:', error);
            if (error.code === '23505') {
                alert('משתמש זה כבר הוזמן או חבר בארגון');
            } else {
                alert('שגיאה בשליחת ההזמנה');
            }
        } finally {
            setSending(false);
        }
    };

    const handleDeleteInvite = async (inviteId: string) => {
        if (!confirm('האם למחוק הזמנה זו?')) return;

        const { error } = await supabase
            .from('organization_invites')
            .delete()
            .eq('id', inviteId);

        if (error) {
            console.error('Error deleting invite:', error);
            alert('שגיאה במחיקת ההזמנה');
        } else {
            fetchInvites();
        }
    };

    const handleChangeRole = async (memberId: string, newRole: UserRole) => {
        if (!confirm('האם לשנות את ההרשאה?')) return;

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', memberId);

        if (error) {
            console.error('Error updating role:', error);
            alert('שגיאה בעדכון ההרשאה');
        } else {
            fetchMembers();
        }
    };

    if (!canManageOrganization(profile?.role || 'viewer')) {
        return (
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-red-200">
                <div className="text-center">
                    <Shield className="mx-auto text-red-500 mb-4" size={48} />
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">אין הרשאה</h2>
                    <p className="text-slate-600">רק מנהלים יכולים לגשת להגדרות הארגון</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-emerald-200">
                <p className="text-center text-slate-600">טוען...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Organization Info */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-yellow-200">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center">
                        <svg className="w-7 h-7 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{organization?.name}</h1>
                        <p className="text-slate-600">{members.length} חברי צוות</p>
                    </div>
                </div>
            </div>

            {/* Night Shift Settings */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-indigo-200">
                <div className="flex items-center gap-3 mb-6">
                    <Moon className="text-indigo-600" size={24} />
                    <h2 className="text-2xl font-bold text-slate-800">הגדרות כלליות</h2>
                </div>
                <GeneralSettings organizationId={organization?.id || ''} />
            </div>

            {/* Invite Form */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-emerald-200">
                <div className="flex items-center gap-3 mb-6">
                    <UserPlus className="text-emerald-600" size={24} />
                    <h2 className="text-2xl font-bold text-slate-800">הזמן משתמש חדש</h2>
                </div>

                <form onSubmit={handleSendInvite} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-slate-700 font-medium mb-2 text-right">
                                כתובת אימייל
                            </label>
                            <input
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                placeholder="user@example.com"
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:outline-none text-right"
                                required
                                disabled={sending}
                            />
                        </div>

                        <div>
                            <label className="block text-slate-700 font-medium mb-2 text-right">
                                הרשאה
                            </label>
                            <select
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-emerald-400 focus:outline-none text-right"
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
                        className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        <Mail size={20} />
                        <span>{sending ? 'שולח...' : 'שלח הזמנה'}</span>
                    </button>
                </form>
            </div>

            {/* Pending Invites */}
            {invites.length > 0 && (
                <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-yellow-200">
                    <div className="flex items-center gap-3 mb-6">
                        <Clock className="text-yellow-600" size={24} />
                        <h2 className="text-2xl font-bold text-slate-800">הזמנות ממתינות</h2>
                    </div>

                    <div className="space-y-3">
                        {invites.map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                <div className="flex items-center gap-4">
                                    <Mail className="text-yellow-600" size={20} />
                                    <div>
                                        <p className="font-medium text-slate-800">{invite.email}</p>
                                        <p className="text-sm text-slate-600">{getRoleDisplayName(invite.role)}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDeleteInvite(invite.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="מחק הזמנה"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Members List */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border-2 border-emerald-200">
                <div className="flex items-center gap-3 mb-6">
                    <Users className="text-emerald-600" size={24} />
                    <h2 className="text-2xl font-bold text-slate-800">חברי צוות</h2>
                </div>

                <div className="space-y-3">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                    <span className="text-emerald-700 font-bold">
                                        {member.email.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-medium text-slate-800">
                                        {member.full_name || member.email.split('@')[0]}
                                        {member.id === user?.id && <span className="text-emerald-600 mr-2">(אתה)</span>}
                                    </p>
                                    <p className="text-sm text-slate-500">{member.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {member.id === user?.id ? (
                                    <span className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
                                        {getRoleDisplayName(member.role)}
                                    </span>
                                ) : (
                                    <select
                                        value={member.role}
                                        onChange={(e) => handleChangeRole(member.id, e.target.value as UserRole)}
                                        className="px-4 py-2 rounded-lg border-2 border-slate-200 focus:border-emerald-400 focus:outline-none font-medium"
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
        </div>
    );
};
