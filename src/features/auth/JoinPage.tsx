import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from './AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CircleNotch as LoaderIcon, WarningCircle as AlertCircleIcon, CheckCircle as CheckCircleIcon, ArrowRight as ArrowRightIcon, Check as CheckIcon } from '@phosphor-icons/react';

const JoinPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { user, loading: authLoading, signOut, refreshProfile } = useAuth();
    const { showToast } = useToast();

    const [orgName, setOrgName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (token) {
            fetchOrgName();
        }
    }, [token]);

    // Auto-join if user lands back on this page after login
    useEffect(() => {
        if (user && token && !success && !joining && !error) {
            console.log('🤖 [JoinPage] Auto-joining for logged in user...');
            handleJoin();
        }
    }, [user, token]);

    const fetchOrgName = async () => {
        try {
            const { data, error } = await supabase.rpc('get_org_name_by_token', { p_token: token });
            if (error) throw error;
            setOrgName(data);
        } catch (err) {
            console.error('Error fetching org name:', err);
            setError('הקישור אינו תקין או שפג תוקפו');
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!user) {
            // Store token for post-login processing
            localStorage.setItem('pending_invite_token', token || '');
            showToast('אנא התחבר למערכת כדי להצטרף לארגון', 'info');
            navigate('/'); // Redirect to home/login
            return;
        }

        console.log('🚀 [JoinPage] Attempting to join. Token:', token, 'User:', user?.id);
        setJoining(true);
        try {
            const { data, error } = await supabase.rpc('join_organization_by_token', { p_token: token });
            console.log('✅ [JoinPage] RPC Result:', { data, error });
            if (error) throw error;

            if (!data) {
                throw new Error('הקישור אינו תקין, פג תוקפו או שאתה כבר חבר בארגון זה');
            }

            setSuccess(true);
            showToast('הצטרפת לארגון בהצלחה!', 'success');

            // Refresh profile to update organization_id in context
            await refreshProfile();

            setTimeout(() => {
                window.location.href = '/'; // Use hard redirect to ensure state is clean
            }, 1000);
        } catch (err: any) {
            console.error('Error joining org:', err);
            setError(err.message || 'שגיאה בהצטרפות לארגון');
        } finally {
            setJoining(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-teal-50 to-blue-50">
                <LoaderIcon className="w-10 h-10 text-teal-600 animate-spin" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border-2 border-green-100 animate-in zoom-in-95 duration-300">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <CheckCircleIcon className="w-10 h-10 text-green-600" weight="bold" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 mb-2">הצטרפת בהצלחה!</h1>
                    <p className="text-slate-600 mb-6 text-lg">אתה מועבר למערכת...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border-2 border-red-100 animate-in zoom-in-95 duration-300" role="alert">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner" aria-hidden="true">
                        <AlertCircleIcon className="w-10 h-10 text-red-600" weight="bold" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">שגיאה</h1>
                    <p className="text-slate-600 mb-8">{error}</p>
                    <a href="/" className="inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl transition-all">
                        חזרה לדף הבית
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 p-4 overflow-y-auto">
            <div className="m-auto max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 md:p-10 text-center border border-white/50 relative overflow-hidden animate-in fade-in zoom-in-95 duration-500">

                {/* Decorative Background Elements */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-500 via-teal-500 to-blue-500" aria-hidden="true"></div>
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-100 rounded-full blur-3xl opacity-50" aria-hidden="true"></div>
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-100 rounded-full blur-3xl opacity-50" aria-hidden="true"></div>

                {/* IDF Style Logo */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 md:w-28 md:h-28 bg-white rounded-2xl flex items-center justify-center mx-auto shadow-lg overflow-hidden p-4 border border-slate-100">
                        <img src="/favicon.png" alt="לוגו האפליקציה" className="w-full h-full object-contain" />
                    </div>
                </div>

                <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">הזמנה להצטרף</h1>
                <div className="bg-slate-50 rounded-2xl p-4 mb-8 border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">אתה מוזמן להצטרף לארגון</p>
                    <p className="text-xl text-teal-700 font-bold">{orgName}</p>
                </div>

                {user ? (
                    <div className="space-y-6">
                        <div className="flex items-center justify-center gap-3 bg-blue-50 p-3 rounded-xl border border-blue-100 text-blue-800">
                            <div className="w-8 h-8 rounded-full bg-blue-200 flex items-center justify-center text-xs font-bold">
                                {user.email?.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-blue-600 font-medium">מחובר כ:</p>
                                <p className="text-sm font-bold">{user.email}</p>
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="text-xs text-blue-600 underline hover:text-blue-800 transition-colors mr-auto"
                            >
                                החלף משתמש
                            </button>
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            aria-busy={joining}
                            className="w-full group relative bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" aria-hidden="true"></div>
                            <div className="relative flex items-center justify-center gap-2">
                                {joining ? (
                                    <>
                                        <LoaderIcon className="w-5 h-5 animate-spin" />
                                        <span>מצטרף לפלוגה...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>אשר הצטרפות</span>
                                        <CheckIcon className="w-5 h-5 group-hover:scale-110 transition-transform" weight="bold" />
                                    </>
                                )}
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-slate-600 mb-6 font-medium">התחבר כדי להשלים את ההצטרפות</p>
                        <button
                            onClick={async () => {
                                console.log('🟢 [JoinPage] Google Login clicked. Saving token:', token);
                                localStorage.setItem('pending_invite_token', token || '');
                                console.log('📦 [JoinPage] LocalStorage after set:', localStorage.getItem('pending_invite_token'));
                                const { error } = await supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                    options: {
                                        redirectTo: window.location.href,
                                        queryParams: {
                                            prompt: 'select_account'
                                        }
                                    }
                                });
                                if (error) console.error('Google login error:', error);
                            }}
                            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-md px-6 py-4 rounded-xl font-bold text-slate-700 transition-all duration-200 group"
                        >
                            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            <span>התחבר עם Google</span>
                        </button>
                    </div>
                )}
            </div>
        </div >
    );


};

export default JoinPage;
