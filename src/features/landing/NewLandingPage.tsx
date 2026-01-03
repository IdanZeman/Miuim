import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowLeft, Lightning, ChartBar, LinkedinLogo, X, User } from '@phosphor-icons/react';
import { StickyScrollFeatures } from './components/StickyScrollFeatures';
import { BentoGrid } from './components/BentoGrid';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { TermsModal } from '../auth/TermsModal';
import { logger } from '../../services/loggingService';

// --- Components ---

const Navbar = ({ onLogin, onScrollToTop }: { onLogin: () => void; onScrollToTop: () => void }) => (
    <motion.nav
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 py-4 pointer-events-none"
        dir="rtl"
    >
        <div className="pointer-events-auto w-full max-w-7xl flex items-center justify-between px-6 py-3 rounded-2xl bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl shadow-slate-200/50">

            {/* Logo (Right in RTL - First Child) */}
            <button
                onClick={onScrollToTop}
                className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
                <div className="w-10 h-10 flex items-center justify-center">
                    <img src="/images/logo.webp" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-xl font-black text-slate-800 tracking-tight hidden sm:block">מערכת לניהול פלוגה</span>
            </button>

            {/* Links (Center) */}
            <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
                <a href="#features" className="hover:text-blue-600 transition-colors">פיצ'רים</a>
                <a href="#about" className="hover:text-blue-600 transition-colors">אודות</a>
                <a href="/contact" className="hover:text-blue-600 transition-colors">צור קשר</a>
            </div>

            {/* Actions (Left in RTL - Last Child) */}
            <div className="flex items-center gap-3">
                <button
                    onClick={onLogin}
                    className="bg-[#FFD700] hover:bg-[#F4C430] text-slate-900 px-6 py-2.5 rounded-xl text-sm font-black hover:shadow-lg hover:shadow-amber-200 transition-all"
                >
                    התחבר
                </button>
            </div>

        </div>
    </motion.nav>
);

const Hero = ({ onLogin }: { onLogin: () => void }) => {
    return (
        <header className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden" dir="rtl">
            <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center relative z-10">

                {/* Content */}
                <div className="space-y-8 text-right">


                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl font-black text-slate-900 leading-[1.1]"
                    >
                        עושים סדר <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
                            בבלאגן בפלוגה
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-xl text-slate-500 leading-relaxed max-w-lg"
                    >
                        הפתרון המלא לניהול נוכחות, משימות ושיבוץ חכם.
                        כל נתוני הפלוגה במקום אחד, נגיש, מאובטח ופשוט לתפעול.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-wrap gap-4"
                    >
                        <button
                            onClick={onLogin}
                            className="bg-[#FFD700] hover:bg-[#F4C430] text-slate-900 px-8 py-4 rounded-2xl font-black text-lg shadow-xl shadow-amber-200 hover:-translate-y-1 transition-all flex items-center gap-3"
                        >
                            התחל עכשיו בחינם
                            <ArrowLeft weight="bold" />
                        </button>
                        <button
                            onClick={() => window.location.href = '/contact'}
                            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:-translate-y-1 transition-all"
                        >
                            תיאום הדגמה
                        </button>
                    </motion.div>

                    {/* Trust Badges */}
                    <div className="pt-8 flex items-center gap-6 opacity-60 grayscale hover:grayscale-0 transition-all">
                        <div className="flex items-center gap-2 font-bold text-slate-400">
                            <Shield weight="fill" size={20} />
                            אבטחת מידע
                        </div>
                        <div className="flex items-center gap-2 font-bold text-slate-400">
                            <Lightning weight="fill" size={20} />
                            הטמעה מהירה
                        </div>
                        <div className="flex items-center gap-2 font-bold text-slate-400">
                            <ChartBar weight="fill" size={20} />
                            נתונים בזמן אמת
                        </div>
                    </div>
                </div>

                {/* Hero Visual Mockup */}
                <motion.div
                    initial={{ opacity: 0, x: -50, rotate: -3 }}
                    animate={{ opacity: 1, x: 0, rotate: -2 }}
                    transition={{ delay: 0.4, duration: 1 }}
                    className="hidden md:block relative"
                >
                    <div className="relative z-20 rounded-3xl overflow-hidden shadow-2xl border-[8px] border-slate-900 bg-slate-900 aspect-[16/10] transform rotate-2 hover:rotate-0 transition-transform duration-700">
                        <img src="/landing/hero-dashboard.webp" alt="Dashboard" className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity" />
                    </div>
                    {/* Decorative Blobs */}
                    <div className="absolute top-10 -right-10 w-72 h-72 bg-emerald-400 rounded-full blur-[100px] opacity-20 -z-10 animate-pulse"></div>
                    <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-amber-400 rounded-full blur-[100px] opacity-20 -z-10 animate-pulse delay-700"></div>
                </motion.div>

            </div>
        </header>
    )
}

const StorySection = () => {
    return (
        <section className="py-24 bg-slate-900 text-white relative overflow-hidden" id="about" dir="rtl">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid md:grid-cols-2 gap-16 items-center">
                    <div className="space-y-8">
                        <div className="inline-block px-4 py-1.5 rounded-full bg-blue-500/10 text-blue-400 font-bold text-sm border border-blue-500/20">
                            קצת עליי
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black leading-tight text-white">
                            למה בניתי את המערכת?
                        </h2>
                        <div className="space-y-6 text-lg text-slate-300 leading-relaxed font-light">
                            <p>
                                המערכת נולדה מתוך כאב אישי וקושי שחוויתי במהלך שירות מילואים ארוך ותובעני.
                                ראיתי איך מפקדים מצוינים טובעים בים של טבלאות אקסל, הודעות ווטסאפ ובלגן ניהולי,
                                במקום להתמקד במה שחשוב באמת - האנשים והמשימה.
                            </p>
                            <p>
                                החלטתי לקחת את הידע המקצועי שלי כמפתח וליצור פתרון שמותאם בדיוק לצרכים של פלוגה קרבית.
                                המטרה שלי הייתה פשוטה: ליצור מערכת שתעשה סדר בבלאגן, תחבר בין כל הקצוות, ותיתן למפקדים שקט נפשי.
                            </p>
                        </div>

                        <a
                            href="https://www.linkedin.com/in/idan-zeman"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-3 text-white bg-[#0077b5] hover:bg-[#006399] px-6 py-3 rounded-xl font-bold transition-all shadow-lg hover:shadow-[#0077b5]/30 group"
                        >
                            <LinkedinLogo size={24} weight="fill" />
                            <span>בואו נדבר בלינקדאין</span>
                            <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                        </a>
                    </div>

                    <div className="relative">
                        <div className="relative z-10 rounded-[2.5rem] overflow-hidden border-4 border-white/10 shadow-2xl transform hover:scale-[1.02] transition-transform duration-700">
                            <img src="/images/about-me.webp" alt="Idan Zeman" className="w-full h-auto object-cover grayscale hover:grayscale-0 transition-all duration-700" />
                        </div>
                        {/* Background Decor */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-600/30 to-purple-600/30 rounded-full blur-3xl -z-0"></div>
                    </div>
                </div>
            </div>
        </section>
    )
}

// --- Main Page ---

export const NewLandingPage: React.FC = () => {
    const { showToast } = useToast();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const scrollToTop = () => {
        if (containerRef.current) {
            containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const handleGoogleLogin = async () => {
        logger.logClick('google_login_button', 'login_modal');
        if (!termsAccepted) return;

        localStorage.setItem('terms_accepted_timestamp', new Date().toISOString());

        setIsLoggingIn(true);
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
            setIsLoggingIn(false);
            logger.logError(error, 'LandingPage:GoogleLogin');
        }
    };

    return (
        <div
            ref={containerRef}
            className="h-screen w-full overflow-y-auto overflow-x-hidden bg-slate-50 text-slate-900 font-sans selection:bg-emerald-200"
        >

            <Navbar onLogin={() => setShowLoginModal(true)} onScrollToTop={scrollToTop} />

            <main className="relative z-10 w-full">

                <Hero onLogin={() => setShowLoginModal(true)} />

                <StickyScrollFeatures />

                <BentoGrid />

                <StorySection />

                {/* Footer */}
                <footer className="border-t border-slate-200 py-12 px-6 text-center bg-white" dir="rtl">
                    <div className="flex flex-col items-center justify-center gap-4">
                        <button
                            onClick={scrollToTop}
                            className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity"
                        >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                                <img src="/images/logo.webp" alt="Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-slate-900 font-black text-xl">מערכת לניהול פלוגה</span>
                        </button>
                        <p className="text-slate-500 font-medium text-sm">
                            &copy; 2025 כל הזכויות שמורות.
                        </p>
                    </div>
                </footer>

            </main>

            {/* Login Modal Popup */}
            {showLoginModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 md:p-8 relative animate-in zoom-in-95 duration-300 my-auto">
                        {/* Close Button */}
                        <button
                            onClick={() => setShowLoginModal(false)}
                            className="absolute top-3 md:top-4 left-3 md:left-4 text-slate-400 hover:text-slate-600 transition-colors"
                            disabled={isLoggingIn}
                        >
                            <X size={20} weight="bold" className="md:w-6 md:h-6" />
                        </button>

                        {/* Logo */}
                        <div className="flex justify-center mb-4 md:mb-6">
                            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden bg-white p-3 border border-slate-100">
                                <img src="/images/logo.webp" alt="Shibuz Logo" className="w-full h-full object-contain" />
                            </div>
                        </div>

                        {/* Title */}
                        <div className="text-center mb-6 md:mb-8">
                            <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2 text-right">התחברות</h2>
                            <p className="text-slate-500 text-xs md:text-sm text-right">התחבר כדי להמשיך למערכת לניהול פלוגה משימות</p>
                        </div>

                        {/* Terms Checkbox */}
                        <div className="flex items-start gap-3 mb-6 bg-blue-50/50 p-3 rounded-xl border border-blue-100" dir="rtl">
                            <div className="pt-0.5">
                                <input
                                    type="checkbox"
                                    id="terms-check"
                                    checked={termsAccepted}
                                    onChange={(e) => setTermsAccepted(e.target.checked)}
                                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </div>
                            <label htmlFor="terms-check" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none text-right">
                                אני מאשר/ת שקראתי והבנתי את{" "}
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setShowTermsModal(true);
                                    }}
                                    className="text-blue-600 font-bold hover:underline"
                                >
                                    תנאי השימוש ומדיניות הפרטיות
                                </button>
                                , ומצהיר/ה כי לא אעלה למערכת מידע מסווג (מעל רמת בלמ"ס).
                            </label>
                        </div>

                        {/* Google Login Button */}
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isLoggingIn || !termsAccepted}
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
            <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
        </div>
    );
};
