import React, { useState } from 'react';
import { Shield, Users, Calendar, CheckCircle, ArrowRight, Star, Clock, Layout } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';

export const LandingPage: React.FC = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin
                }
            });
            if (error) throw error;
        } catch (error: any) {
            console.error('Error logging in:', error);
            showToast('שגיאה בהתחברות: ' + error.message, 'error');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50" dir="rtl">
            {/* Navbar */}
            <nav className="p-4 md:p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <Shield className="text-white" size={20} />
                    </div>
                    <span className="text-2xl font-bold text-slate-800 tracking-tight">Miuim</span>
                </div>
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed text-sm md:text-base"
                >
                    {loading ? 'מתחבר...' : 'התחברות'}
                </button>
            </nav>

            {/* Hero Section */}
            <main className="max-w-7xl mx-auto px-4 md:px-6 py-12 md:py-20 flex flex-col md:flex-row items-center gap-12 md:gap-20">
                <div className="flex-1 text-center md:text-right space-y-6 md:space-y-8 animate-in slide-in-from-bottom-10 duration-700">
                    <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full font-bold text-sm border border-blue-100">
                        <Star size={16} className="fill-blue-700" />
                        <span>הדרך החדשה לניהול משמרות</span>
                    </div>

                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] tracking-tight">
                        ניהול שיבוצים <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">חכם ופשוט יותר</span>
                    </h1>

                    <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto md:mx-0">
                        מערכת מתקדמת לניהול סידורי עבודה, משמרות וצוותים.
                        חוסכים זמן יקר ומונעים טעויות בשיבוץ עם ממשק נוח ואינטואיטיבי.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start pt-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={loading}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-blue-200 hover:shadow-2xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 group"
                        >
                            <span>התחל עכשיו בחינם</span>
                            <ArrowRight className="group-hover:-translate-x-1 transition-transform" />
                        </button>

                        <button className="bg-white text-slate-700 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 px-8 py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2">
                            <Layout size={20} />
                            <span>הדגמה חיה</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-center md:justify-start gap-6 pt-4 text-slate-500 text-sm font-medium">
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-500" />
                            <span>ללא צורך באשראי</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-500" />
                            <span>הקמה תוך דקה</span>
                        </div>
                    </div>
                </div>

                {/* Hero Image/Illustration */}
                <div className="flex-1 w-full max-w-lg md:max-w-none relative animate-in zoom-in-95 duration-1000 delay-200">
                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[2rem] rotate-3 opacity-10 blur-2xl"></div>
                    <div className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden p-2">
                        <div className="bg-slate-50 rounded-[1.5rem] border border-slate-100 p-6 md:p-8 space-y-6">
                            {/* Mock UI Elements */}
                            <div className="flex items-center justify-between mb-8">
                                <div className="space-y-2">
                                    <div className="h-4 w-32 bg-slate-200 rounded-full"></div>
                                    <div className="h-3 w-20 bg-slate-100 rounded-full"></div>
                                </div>
                                <div className="w-10 h-10 bg-blue-100 rounded-full"></div>
                            </div>

                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${i === 1 ? 'bg-green-100 text-green-600' : i === 2 ? 'bg-amber-100 text-amber-600' : 'bg-purple-100 text-purple-600'}`}>
                                            <Users size={18} />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 w-24 bg-slate-100 rounded-full"></div>
                                            <div className="h-2 w-16 bg-slate-50 rounded-full"></div>
                                        </div>
                                        <div className="w-16 h-8 bg-slate-50 rounded-lg"></div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-4 flex gap-4">
                                <div className="flex-1 h-10 bg-blue-600 rounded-xl opacity-90"></div>
                                <div className="flex-1 h-10 bg-slate-200 rounded-xl"></div>
                            </div>
                        </div>
                    </div>

                    {/* Floating Badges */}
                    <div className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce duration-[3000ms]">
                        <div className="bg-green-100 p-2 rounded-lg text-green-600">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold">סטטוס מערכת</p>
                            <p className="text-sm font-bold text-slate-800">פעיל ותקין</p>
                        </div>
                    </div>

                    <div className="absolute -bottom-8 -left-8 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 animate-bounce duration-[4000ms] delay-500">
                        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
                            <Clock size={20} />
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 font-bold">חיסכון בזמן</p>
                            <p className="text-sm font-bold text-slate-800">80% פחות עבודה</p>
                        </div>
                    </div>
                </div>
            </main>

            {/* Features Grid */}
            <section className="max-w-7xl mx-auto px-4 md:px-6 py-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { icon: Calendar, title: 'שיבוץ חכם', desc: 'מערכת גרירה ושחרור אינטואיטיבית לניהול משמרות בקלות.' },
                        { icon: Users, title: 'ניהול צוות', desc: 'מעקב אחרי זמינות, תפקידים והעדפות של כל חברי הצוות.' },
                        { icon: Shield, title: 'הרשאות מתקדמות', desc: 'שליטה מלאה במי רואה מה ומי יכול לערוך שינויים.' }
                    ].map((feature, i) => (
                        <div key={i} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-6">
                                <feature.icon size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-3">{feature.title}</h3>
                            <p className="text-slate-600 leading-relaxed">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
