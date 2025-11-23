import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Mail, CheckCircle } from 'lucide-react';

export const Onboarding: React.FC = () => {
    const { user, refreshProfile } = useAuth();
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(true);
    const [pendingInvite, setPendingInvite] = useState<any>(null);

    // Check for pending invites when component mounts
    useEffect(() => {
        checkForInvite();
    }, [user]);

    const checkForInvite = async () => {
        if (!user?.email) return;

        try {
            const { data: invites, error } = await supabase
                .from('organization_invites')
                .select('*, organizations(name)')
                .eq('email', user.email.toLowerCase())
                .eq('accepted', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (invites && invites.length > 0) {
                setPendingInvite(invites[0]);
            }
        } catch (error) {
            console.error('Error checking for invites:', error);
        } finally {
            setCheckingInvite(false);
        }
    };

    const handleAcceptInvite = async () => {
        if (!pendingInvite || !user) return;

        setLoading(true);
        try {
            // Update profile with organization and role from invite
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    organization_id: pendingInvite.organization_id,
                    role: pendingInvite.invited_role || 'viewer'
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Mark invite as accepted
            const { error: inviteError } = await supabase
                .from('organization_invites')
                .update({ accepted: true })
                .eq('id', pendingInvite.id);

            if (inviteError) throw inviteError;

            // Refresh profile to load organization
            await refreshProfile();
        } catch (error) {
            console.error('Error accepting invite:', error);
            alert('שגיאה בקבלת ההזמנה. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim() || !user) return;

        setLoading(true);
        try {
            // Create organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName.trim() })
                .select()
                .single();

            if (orgError) throw orgError;

            // Update user profile with organization_id and set as admin
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    organization_id: org.id,
                    role: 'admin' // First user becomes admin
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Refresh profile to get the new organization
            await refreshProfile();
        } catch (error) {
            console.error('Error creating organization:', error);
            alert('שגיאה ביצירת הארגון. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    if (checkingInvite) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-yellow-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
                    <p className="text-slate-600">בודק הזמנות...</p>
                </div>
            </div>
        );
    }

    // If user has a pending invite, show accept invite screen
    if (pendingInvite) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50">
                <div className="min-h-screen flex items-center justify-center p-4">
                    <div className="bg-white p-12 rounded-3xl shadow-xl max-w-lg w-full border-2 border-blue-200">
                        {/* Icon */}
                        <div className="flex justify-center mb-8">
                            <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-5 rounded-2xl shadow-lg">
                                <Mail size={48} className="text-white" />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mb-8">
                            <h1 className="text-4xl font-bold text-slate-800 mb-3">קיבלת הזמנה!</h1>
                            <p className="text-slate-600 text-lg">הוזמנת להצטרף לארגון</p>
                        </div>

                        {/* Invite Details */}
                        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-6">
                            <div className="text-center">
                                <p className="text-sm text-slate-600 mb-2">ארגון:</p>
                                <p className="text-2xl font-bold text-slate-800 mb-4">
                                    {pendingInvite.organizations?.name || 'ארגון'}
                                </p>
                                <p className="text-sm text-slate-600 mb-2">תפקיד:</p>
                                <p className="text-lg font-medium text-blue-700">
                                    {pendingInvite.invited_role === 'admin' && 'מנהל מערכת'}
                                    {pendingInvite.invited_role === 'shift_manager' && 'אחראי שמירות'}
                                    {pendingInvite.invited_role === 'viewer' && 'צופה'}
                                </p>
                            </div>
                        </div>

                        {/* Accept Button */}
                        <button
                            onClick={handleAcceptInvite}
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-3"
                        >
                            <CheckCircle size={24} />
                            <span>{loading ? 'מצטרף...' : 'קבל הזמנה והצטרף'}</span>
                        </button>

                        {/* Create Own Org Option */}
                        <div className="mt-6 text-center">
                            <button
                                onClick={() => setPendingInvite(null)}
                                className="text-slate-600 hover:text-slate-800 text-sm underline"
                            >
                                או צור ארגון חדש משלך
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Create new organization
    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-yellow-50">
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-3xl shadow-xl max-w-lg w-full border-2 border-emerald-200">
                    {/* Icon */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-5 rounded-2xl shadow-lg">
                            <Building2 size={48} className="text-white" />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-slate-800 mb-3">ברוך הבא!</h1>
                        <p className="text-slate-600 text-lg">בוא ניצור את הארגון הראשון שלך</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleCreateOrg} className="space-y-6">
                        <div>
                            <label className="block text-slate-700 font-medium mb-3 text-right text-lg">
                                שם הארגון / היחידה
                            </label>
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="לדוגמה: פלוגה א׳, מחלקת IT..."
                                className="w-full px-4 py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-emerald-400 focus:outline-none text-slate-800 placeholder-slate-400 text-right text-lg transition-colors"
                                required
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !orgName.trim()}
                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-lg"
                        >
                            {loading ? 'יוצר ארגון...' : 'צור ארגון והמשך'}
                        </button>
                    </form>

                    {/* Info */}
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 text-right mt-6">
                        <p className="text-sm text-emerald-800">
                            💡 תוכל להוסיף חברי צוות, להגדיר תפקידים וליצור משמרות מיד לאחר היצירה
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
