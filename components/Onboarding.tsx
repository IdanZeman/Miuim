import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Mail, CheckCircle, Sparkles, Shield } from 'lucide-react';
import { analytics } from '../services/analytics';

import { useToast } from '../contexts/ToastContext';

export const Onboarding: React.FC = () => {
    const { user, refreshProfile, signOut } = useAuth();
    const { showToast } = useToast();
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(true);
    const [pendingInvite, setPendingInvite] = useState<any>(null);
    const [error, setError] = useState('');

    // Check for pending invites when component mounts
    useEffect(() => {
        checkForInvite();
    }, [user]);

    const checkForInvite = async () => {
        console.log("🔍 Onboarding: Checking for invites...", user?.email);
        if (!user?.email) {
            console.warn("⚠️ Onboarding: No email found for user, skipping invite check.");
            setCheckingInvite(false);
            return;
        }

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
                console.log("💌 Onboarding: Found invite!", invites[0]);
                setPendingInvite(invites[0]);
            } else {
                console.log("📭 Onboarding: No invites found.");
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
            showToast('שגיאה בקבלת ההזמנה. אנא נסה שוב.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOrgName(e.target.value);
        analytics.trackFormFieldEdit('create_organization', 'org_name');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        analytics.trackFormStart('create_organization');

        if (!orgName.trim()) {
            analytics.trackValidationError('create_organization', 'org_name', 'empty');
            setError('נא להזין שם ארגון');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName.trim() })
            analytics.trackEvent('organization_created', 'Onboarding', orgName);
        } catch (error) {
            analytics.trackFormSubmit('create_organization', false);
            analytics.trackError((error as Error).message, 'CreateOrganization');
            setError('שגיאה ביצירת הארגון');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            window.location.reload();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    if (checkingInvite) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center shadow-lg mb-4 mx-auto animate-pulse">
                        <svg className="w-10 h-10 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <p className="text-slate-600 font-medium">בודק הזמנות...</p>
                </div>
            </div>
        );
    }

    // If user has a pending invite, show accept invite screen
    if (pendingInvite) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 overflow-y-auto">
                {/* Header with Logo */}
                <div className="bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm">
                            <svg className="w-6 h-6 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold text-slate-800">Miuim</span>
                    </div>
                </div>

                <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 md:p-8">
                    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200">
                        {/* Header Section */}
                        <div className="bg-gradient-to-r from-green-600 to-teal-600 p-8 md:p-12 text-center relative overflow-hidden">
                            <div className="absolute inset-0 opacity-10">
                                <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                                <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-center mb-4">
                                    <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
                                        <Mail size={48} className="text-white" />
                                    </div>
                                </div>
                                <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">קיבלת הזמנה!</h1>
                                <p className="text-green-50 text-lg">הוזמנת להצטרף לארגון</p>
                            </div>
                        </div>

                        {/* Content Section */}
                        <div className="p-8 md:p-12">
                            {/* Invite Details Card */}
                            <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-6 md:p-8 mb-8">
                                <div className="flex items-center justify-center mb-4">
                                    <Building2 size={32} className="text-green-600" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm text-slate-600 mb-2 font-medium">ארגון:</p>
                                    <p className="text-2xl md:text-3xl font-bold text-slate-900 mb-6">
                                        {pendingInvite.organizations?.name || 'ארגון'}
                                    </p>

                                    <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 inline-block">
                                        <p className="text-sm text-slate-600 mb-1 font-medium">תפקיד:</p>
                                        <div className="flex items-center justify-center gap-2">
                                            <Shield size={18} className="text-green-600" />
                                            <p className="text-lg font-bold text-green-700">
                                                {pendingInvite.invited_role === 'admin' && 'מנהל מערכת'}
                                                {pendingInvite.invited_role === 'shift_manager' && 'אחראי שמירות'}
                                                {pendingInvite.invited_role === 'viewer' && 'צופה'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Accept Button */}
                            <button
                                onClick={handleAcceptInvite}
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        מצטרף...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle size={24} />
                                        קבל הזמנה והצטרף
                                    </>
                                )}
                            </button>

                            {/* Alternative Option */}
                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => setPendingInvite(null)}
                                    className="text-slate-600 hover:text-slate-800 font-medium text-sm transition-colors"
                                >
                                    או צור ארגון חדש משלך →
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Create new organization
    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 overflow-y-auto">
            {/* Header with Logo */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center shadow-sm">
                            <svg className="w-6 h-6 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <span className="text-xl font-bold text-slate-800">Miuim</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-slate-500 hover:text-red-600 font-medium text-sm transition-colors flex items-center gap-2"
                    >
                        <span className="hidden md:inline">התנתק</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                    </button>
                </div>
            </div>

            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4 md:p-8">
                <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full overflow-hidden border border-slate-200">
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-green-600 to-teal-600 p-8 md:p-12 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
                        </div>

                        <div className="relative z-10">
                            <div className="flex justify-center mb-4">
                                <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
                                    <Building2 size={48} className="text-white" />
                                </div>
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">ברוך הבא!</h1>
                            <p className="text-green-50 text-lg">בוא ניצור את הארגון הראשון שלך</p>
                        </div>
                    </div>

                    {/* Form Section */}
                    <div className="p-8 md:p-12">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label className="block text-slate-700 font-bold mb-3 text-right text-lg flex items-center gap-2">
                                    <Building2 size={20} className="text-green-600" />
                                    שם הארגון / היחידה
                                </label>
                                <input
                                    type="text"
                                    value={orgName}
                                    onChange={handleOrgNameChange}
                                    placeholder="לדוגמה: פלוגה א׳, צוות..."
                                    className="w-full px-4 py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-green-500 focus:outline-none text-slate-800 placeholder-slate-400 text-right text-lg transition-colors shadow-sm"
                                    required
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm text-center">
                                    {error}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !orgName.trim()}
                                className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-lg flex items-center justify-center gap-3"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        יוצר ארגון...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={24} />
                                        צור ארגון והמשך
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Info Card */}
                        <div className="bg-gradient-to-br from-green-50 to-teal-50 border-2 border-green-200 rounded-xl p-6 mt-8">
                            <div className="flex items-start gap-3">
                                <div className="bg-green-100 p-2 rounded-lg flex-shrink-0">
                                    <Sparkles size={20} className="text-green-600" />
                                </div>
                                <p className="text-sm text-slate-700 leading-relaxed">
                                    תוכל להוסיף חברי צוות, להגדיר תפקידים וליצור משמרות מיד לאחר היצירה
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 text-center md:hidden">
                            <button
                                onClick={handleLogout}
                                className="text-slate-400 hover:text-red-500 text-sm font-medium transition-colors"
                            >
                                התנתק ויצא
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
