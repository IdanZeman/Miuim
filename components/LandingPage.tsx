import React, { useState } from 'react';
import { Calendar, Users, BarChart3, Shield, Zap, Clock, X } from 'lucide-react';
import { supabase } from '../services/supabaseClient'; // NEW: Import supabase

export const LandingPage: React.FC = () => { // NEW: Remove onGetStarted prop
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // NEW: Direct Google Login Handler
    const handleGoogleLogin = async () => {
        setIsLoggingIn(true);
        try {
            // Determine redirect URL based on environment
            const redirectUrl = window.location.hostname === 'localhost'
                ? window.location.origin
                : 'https://miuim.vercel.app';

            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl, // Use production URL in production
                }
            });

            if (error) {
                console.error('Login error:', error);
                alert('שגיאה בהתחברות: ' + error.message);
                setIsLoggingIn(false);
            }
            // Success: Supabase will automatically redirect
        } catch (err) {
            console.error('Unexpected error:', err);
            alert('שגיאה לא צפויה בהתחברות');
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 overflow-y-auto">
            {/* Hero Section - UPDATED WITH IMAGE */}
            <section className="relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 lg:py-32">
                    <div className="grid lg:grid-cols-2 gap-8 md:gap-12 items-center">
                        {/* Left: Text Content */}
                        <div className="text-center lg:text-right space-y-4 md:space-y-8 animate-in fade-in slide-in-from-right duration-700 order-2 lg:order-1">
                            <div className="inline-block">
                                <span className="bg-gradient-to-r from-green-600 to-teal-600 text-white text-xs md:text-sm font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-full shadow-md">
                                    מערכת שיבוץ חכמה לצה״ל
                                </span>
                            </div>

                            <h1 className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-extrabold text-slate-900 leading-tight">
                                ניהול משמרות צה״לי.
                                <br />
                                <span className="bg-gradient-to-l from-green-600 to-teal-600 bg-clip-text text-transparent">
                                    כל הכוח שלך, בפקודה אחת.
                                </span>
                            </h1>

                            <p className="text-base md:text-lg lg:text-xl text-slate-600 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                                מערכת ניהול שיבוצים אוטומטית המותאמת לצה״ל.
                                חסוך שעות, מונע טעויות, ושומר על איזון צוותי אופטימלי.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center lg:justify-start">
                                <button
                                    onClick={() => setShowLoginModal(true)}
                                    className="group relative bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 md:px-8 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        התחל עכשיו
                                        <Zap className="group-hover:rotate-12 transition-transform" size={18} />
                                    </span>
                                    <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-green-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                </button>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4 md:gap-6 pt-6 md:pt-8 border-t border-slate-200">
                                <div>
                                    <div className="text-2xl md:text-3xl font-bold text-green-600">95%</div>
                                    <div className="text-xs md:text-sm text-slate-600">דיוק שיבוץ</div>
                                </div>
                                <div>
                                    <div className="text-2xl md:text-3xl font-bold text-teal-600">80%</div>
                                    <div className="text-xs md:text-sm text-slate-600">חיסכון בזמן</div>
                                </div>
                                <div>
                                    <div className="text-2xl md:text-3xl font-bold text-blue-600">24/7</div>
                                    <div className="text-xs md:text-sm text-slate-600">זמינות</div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Hero Image */}
                        <div className="relative animate-in fade-in slide-in-from-left duration-700 delay-300 order-1 lg:order-2">
                            <div className="relative rounded-xl md:rounded-2xl overflow-hidden shadow-xl md:shadow-2xl border-2 md:border-4 border-white">
                                <img
                                    src="/images/hero-schedule.png"
                                    alt="מערכת שיבוצים צה״לית"
                                    className="w-full h-auto object-cover"
                                />

                                {/* Overlay Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"></div>

                                {/* Floating Badge */}
                                <div className="absolute top-2 md:top-4 right-2 md:right-4 bg-white/90 backdrop-blur-sm px-3 md:px-4 py-1.5 md:py-2 rounded-full shadow-lg flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                    <span className="text-xs md:text-sm font-bold text-slate-800">פועל כעת</span>
                                </div>
                            </div>

                            {/* Decorative Elements */}
                            <div className="absolute -top-4 md:-top-8 -left-4 md:-left-8 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-green-400 to-teal-400 rounded-full blur-3xl opacity-30 animate-pulse"></div>
                            <div className="absolute -bottom-4 md:-bottom-8 -right-4 md:-right-8 w-32 md:w-40 h-32 md:h-40 bg-gradient-to-br from-blue-400 to-teal-400 rounded-full blur-3xl opacity-30 animate-pulse delay-700"></div>
                        </div>
                    </div>
                </div>

                {/* Wave Decoration */}
                <div className="absolute bottom-0 left-0 right-0 hidden md:block">
                    <svg viewBox="0 0 1440 120" className="w-full h-auto">
                        <path
                            fill="#ffffff"
                            d="M0,64L48,69.3C96,75,192,85,288,80C384,75,480,53,576,48C672,43,768,53,864,58.7C960,64,1056,64,1152,58.7C1248,53,1344,43,1392,37.3L1440,32L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
                        ></path>
                    </svg>
                </div>
            </section>

            {/* Features Section */}
            <section className="bg-white py-12 md:py-20">
                {/* ...existing features... */}
            </section>

            {/* Login Modal Popup - RESPONSIVE */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 relative animate-in zoom-in-95 duration-300 my-auto">
                        {/* Close Button */}
                        <button
                            onClick={() => setShowLoginModal(false)}
                            className="absolute top-3 md:top-4 left-3 md:left-4 text-slate-400 hover:text-slate-600 transition-colors"
                            disabled={isLoggingIn}
                        >
                            <X size={20} className="md:w-6 md:h-6" />
                        </button>

                        {/* Logo */}
                        <div className="flex justify-center mb-4 md:mb-6">
                            <div className="w-14 h-14 md:w-16 md:h-16 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <svg className="w-8 h-8 md:w-10 md:h-10 text-yellow-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                                </svg>
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mb-6 md:mb-8">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">התחברות</h2>
                            <p className="text-slate-500 text-xs md:text-sm">התחבר כדי להמשיך ל-Miuim</p>
                        </div>

                        {/* Google Login Button */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isLoggingIn}
                            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-200 hover:border-slate-300 hover:shadow-md px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-sm md:text-base text-slate-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoggingIn ? (
                                <>
                                    <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                                    מתחבר...
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                    המשך עם Google
                                </>
                            )}
                        </button>

                        {/* Privacy Notice */}
                        <p className="text-[10px] md:text-xs text-slate-400 text-center mt-4 md:mt-6 leading-relaxed">
                            בכניסה למערכת אתה מסכים לתנאי השימוש ולמדיניות הפרטיות
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
