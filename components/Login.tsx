import React from 'react';
import { supabase } from '../services/supabaseClient';
import { ArrowRight } from 'lucide-react';
import { Layout } from './Layout';
import { useToast } from '../contexts/ToastContext';

interface LoginProps {
    onBack?: () => void;
}

export const Login: React.FC<LoginProps> = ({ onBack }) => {
    const { showToast } = useToast();

    const handleGoogleLogin = async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/`
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Error logging in:', error);
            showToast('שגיאה בהתחברות עם Google', 'error');
        }
    };

    return (
        <Layout isPublic={true}>
            <div className="min-h-[60vh] flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-3xl shadow-xl max-w-md w-full border-2 border-yellow-200 relative">
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

                    {/* Logo */}
                    <div className="flex justify-center mb-8">
                        <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-full flex items-center justify-center shadow-lg overflow-hidden p-3 border border-slate-100">
                            <img src="/favicon.png" alt="Miuim Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-slate-800 mb-3">התחברות</h1>
                        <p className="text-slate-600">התחבר כדי להמשיך למערכת שיבוץ משימות</p>
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
                    </div>

                    {/* Terms */}
                    <p className="text-xs text-slate-400 mt-8 text-center">
                        בכניסה למערכת אתה מסכים לתנאי השימוש ומדיניות הפרטיות
                    </p>
                </div>
            </div>
        </Layout>
    );
};
