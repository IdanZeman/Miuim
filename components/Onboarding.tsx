import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Building2, Mail, CheckCircle, Sparkles, Shield, FileSpreadsheet, Upload } from 'lucide-react';
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

        // Check for terms acceptance from Landing Page
        const saveTerms = async () => {
            const timestamp = localStorage.getItem('terms_accepted_timestamp');
            if (user && timestamp) {
                console.log("📝 Onboarding: Saving terms acceptance...", timestamp);
                await supabase.from('profiles').update({ terms_accepted_at: timestamp }).eq('id', user.id);
                localStorage.removeItem('terms_accepted_timestamp');
            }
        };
        saveTerms();

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
                    role: pendingInvite.role || 'viewer'
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
            // 1. Create organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName.trim() })
                .select()
                .single();

            if (orgError) throw orgError;
            if (!org) throw new Error('Failed to create organization');

            analytics.trackSignup(orgName);

            // 2. Update user profile with new organization and admin role
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        organization_id: org.id,
                        role: 'admin'
                    })
                    .eq('id', user.id);

                if (profileError) throw profileError;

                // 3. Refresh profile to update global state and redirect
                await refreshProfile();
            }

        } catch (error) {
            console.error('Error creating organization:', error);
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
                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center shadow-lg mb-4 mx-auto animate-pulse overflow-hidden">
                        <img src="/images/app_icon.png" alt="Miuim Logo" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-slate-600 font-medium">בודק הזמנות...</p>
                </div>
            </div>
        );
    }

    // If user has a pending invite, show accept invite screen
    if (pendingInvite) {
        return (
            <div className="h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 overflow-y-auto">
                {/* Header with Logo */}
                <div className="bg-white border-b border-slate-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                            <img src="/images/app_icon.png" alt="Miuim Logo" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-xl font-bold text-slate-800">מערכת שיבוץ משימות </span>
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
                                                {pendingInvite.role === 'admin' && 'מנהל מערכת'}
                                                {pendingInvite.role === 'editor' && 'עורך'}
                                                {pendingInvite.role === 'shift_manager' && 'מנהל משמרות'}
                                                {pendingInvite.role === 'viewer' && 'צופה'}
                                                {pendingInvite.role === 'attendance_only' && 'נוכחות בלבד'}
                                                {!['admin', 'editor', 'shift_manager', 'viewer', 'attendance_only'].includes(pendingInvite.role) && (pendingInvite.role || 'צופה')}
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
        <div className="h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 overflow-y-auto">
            {/* Header with Logo */}
            <div className="bg-white border-b border-slate-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-sm overflow-hidden">
                            <img src="/images/app_icon.png" alt="Miuim Logo" className="w-full h-full object-cover" />
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
                <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full overflow-hidden border border-slate-200">
                    {/* Header Section */}
                    <div className="bg-gradient-to-r from-green-600 to-teal-600 p-8 md:p-12 text-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                            <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-1/2 translate-y-1/2"></div>
                        </div>

                        <div className="relative z-10">
                            <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">ברוך הבא!</h1>
                            <p className="text-green-50 text-lg">בוא נתחיל בהקמת הארגון שלך. איך תרצה להתחיל?</p>
                        </div>
                    </div>

                    {/* Setup Options */}
                    <div className="p-8 md:p-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">

                            {/* Option 1: Manual Setup */}
                            <div className="flex flex-col h-full bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-green-500 hover:shadow-lg transition-all group relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-200 to-slate-300 group-hover:from-green-400 group-hover:to-teal-500 transition-all"></div>
                                <div className="mb-6 bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Building2 size={32} className="text-slate-600 group-hover:text-green-600 transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">הקמה ידנית</h3>
                                <p className="text-slate-500 text-sm mb-6 flex-1">
                                    להתחיל מאפס. תן שם לארגון והתחל להוסיף צוותים, תפקידים ומשתמשים באופן ידני דרך הממשק.
                                </p>

                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    // Manual setup logic handles creating org and proceeding
                                    handleSubmit(e);
                                }} className="space-y-4">
                                    <input
                                        type="text"
                                        value={orgName}
                                        onChange={handleOrgNameChange}
                                        placeholder="שם הארגון (לדוגמה: פלוגה א׳)"
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-green-500 focus:bg-white focus:outline-none text-slate-800 text-sm transition-colors"
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !orgName.trim()}
                                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 group-hover:bg-green-600 group-hover:text-white"
                                    >
                                        {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={18} />}
                                        צור והתחל
                                    </button>
                                </form>
                            </div>

                            {/* Option 2: Import Setup */}
                            <div className="flex flex-col h-full bg-white border-2 border-slate-100 rounded-2xl p-6 hover:border-blue-500 hover:shadow-lg transition-all group relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-slate-200 to-slate-300 group-hover:from-blue-400 group-hover:to-indigo-500 transition-all"></div>
                                <div className="mb-6 bg-slate-100 w-16 h-16 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <FileSpreadsheet size={32} className="text-slate-600 group-hover:text-blue-600 transition-colors" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-800 mb-2">ייבוא מאקסל</h3>
                                <p className="text-slate-500 text-sm mb-6 flex-1">
                                    יש לך כבר קובץ עם רשימת חיילים? ייבא אותם ישירות. אנחנו נקים את הצוותים והתפקידים אוטומטית.
                                </p>

                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    // Set flag for import flow
                                    localStorage.setItem('open_import_wizard', 'true');
                                    handleSubmit(e);
                                }} className="space-y-4">
                                    <input
                                        type="text"
                                        value={orgName}
                                        onChange={handleOrgNameChange}
                                        placeholder="שם הארגון (לדוגמה: גדוד 101)"
                                        className="w-full px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white focus:outline-none text-slate-800 text-sm transition-colors"
                                        required
                                        disabled={loading}
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading || !orgName.trim()}
                                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 group-hover:bg-blue-600 group-hover:text-white"
                                    >
                                        {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Upload size={18} />}
                                        צור וייבא נתונים
                                    </button>
                                </form>
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
