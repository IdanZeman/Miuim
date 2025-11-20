import React from 'react';
import { supabase } from '../services/supabaseClient';
import { ArrowRight } from 'lucide-react';

interface LoginProps {
    onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBack }) => {
    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error: any) {
            console.error('Error logging in with Google:', error);
            if (error.message?.includes('provider is not enabled')) {
                alert('שגיאה: התחברות עם גוגל לא מופעלת בפרויקט Supabase.\nיש לגשת ל-Authentication -> Providers ולהפעיל את Google.');
            } else {
                alert('שגיאה בהתחברות עם גוגל. אנא נסה שוב.\n' + (error.message || ''));
            }
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-yellow-50">
            {/* Back Button */}
            {onBack && (
                <button
                    onClick={onBack}
                    className="absolute top-8 right-8 text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2 font-medium"
                >
                    <ArrowRight size={20} />
                    <span>חזרה</span>
                </button>
            )}

            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full border-2 border-yellow-200">
                    {/* Logo */}
                    <div className="flex justify-center mb-8">
                        <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-10 h-10 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-slate-800 mb-3">התחברות</h1>
                        <p className="text-slate-600">התחבר כדי להמשיך ל-Miuim</p>
                    </div>

                    {/* Google Sign In Button */}
                    <div className="space-y-4">
                        <button
                            onClick={handleGoogleLogin}
                            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700 font-medium py-4 px-6 rounded-xl transition-all shadow-md hover:shadow-lg"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-6 h-6" />
                            <span className="text-lg">המשך עם Google</span>
                        </button>

                        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-right">
                            <p className="text-sm text-yellow-800">
                                💡 שים לב: יש להפעיל את Google Provider בלוח הבקרה של Supabase
                            </p>
                        </div>
                    </div>

                    {/* Terms */}
                    <p className="text-xs text-slate-400 mt-8 text-center">
                        בכניסה למערכת אתה מסכים לתנאי השימוש ומדיניות הפרטיות
                    </p>
                </div>
            </div>
        </div>
    );
};
