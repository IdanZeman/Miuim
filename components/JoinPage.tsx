import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, ArrowRight, Building2, CheckCircle, AlertCircle } from 'lucide-react';

const JoinPage: React.FC = () => {
    const { user, profile, loading: authLoading } = useAuth();
    const [orgName, setOrgName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Extract token from URL manually since we don't have react-router hooks in this context
    const token = window.location.pathname.split('/join/')[1];

    useEffect(() => {
        if (token) {
            fetchOrgName();
        } else {
            setError('קישור לא תקין');
            setLoading(false);
        }
    }, [token]);

    const fetchOrgName = async () => {
        try {
            const { data, error } = await supabase.rpc('get_org_name_by_token', { token });
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
            // Redirect to login/signup with return URL
            // Since we are using a custom auth flow, we might need to handle this differently
            // For now, let's assume the user needs to be logged in manually
            // Store token for post-login processing
            localStorage.setItem('pending_invite_token', token);
            alert('אנא התחבר למערכת כדי להצטרף לארגון');
            window.location.href = '/'; // Redirect to home/login
            return;
        }

        setJoining(true);
        try {
            const { data, error } = await supabase.rpc('join_organization_by_token', { token });
            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                window.location.href = '/'; // Redirect to dashboard
            }, 2000);
        } catch (err: any) {
            console.error('Error joining org:', err);
            setError(err.message || 'שגיאה בהצטרפות לארגון');
        } finally {
            setJoining(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-2 border-green-100">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">הצטרפת בהצלחה!</h1>
                    <p className="text-slate-600 mb-6">אתה מועבר למערכת...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border-2 border-red-100">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 mb-2">שגיאה</h1>
                    <p className="text-slate-600 mb-6">{error}</p>
                    <a href="/" className="text-indigo-600 font-medium hover:underline">חזרה לדף הבית</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-200">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Building2 className="w-8 h-8 text-indigo-600" />
                </div>

                <h1 className="text-2xl font-bold text-slate-800 mb-2">הזמנה להצטרף לארגון</h1>
                <p className="text-lg text-indigo-600 font-medium mb-8">{orgName}</p>

                {user ? (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                            <p className="text-sm text-slate-600 mb-1">מחובר כ:</p>
                            <p className="font-medium text-slate-800">{user.email}</p>
                        </div>

                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                        >
                            {joining ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>מצטרף...</span>
                                </>
                            ) : (
                                <>
                                    <span>הצטרף לארגון</span>
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-slate-600 mb-6">עליך להתחבר כדי להצטרף לארגון.</p>
                        <button
                            onClick={async () => {
                                localStorage.setItem('pending_invite_token', token);
                                const { error } = await supabase.auth.signInWithOAuth({
                                    provider: 'google',
                                    options: {
                                        redirectTo: window.location.origin
                                    }
                                });
                                if (error) console.error('Google login error:', error);
                            }}
                            className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 px-6 rounded-xl transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                            <span>התחבר עם Google</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default JoinPage;
