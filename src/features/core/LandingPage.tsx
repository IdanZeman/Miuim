import React, { useState, useEffect, useRef } from 'react';
import { Shield, Zap, X, Calendar, Users, CheckCircle, ArrowLeft, Menu, Bell, User, Mail, Phone, Send, MessageSquare, Upload, Loader2, Heart } from 'lucide-react';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { TermsModal } from '../auth/TermsModal'; // Import TermsModal
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../services/loggingService';

export const LandingPage: React.FC = () => {
    const { showToast } = useToast();
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false); // NEW
    const [termsAccepted, setTermsAccepted] = useState(false); // NEW
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        logger.logView('landing_page');
    }, []);

    // Contact Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const container = document.getElementById('landing-page-container');
        const handleScroll = () => {
            if (container) {
                setScrolled(container.scrollTop > 20);
            } else {
                setScrolled(window.scrollY > 20);
            }
        };

        if (container) {
            container.addEventListener('scroll', handleScroll);
        }
        window.addEventListener('scroll', handleScroll);

        return () => {
            if (container) {
                container.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    const handleGoogleLogin = async () => {
        logger.logClick('google_login_button', 'login_modal');
        if (!termsAccepted) return; // Guard
        localStorage.setItem('terms_accepted_timestamp', new Date().toISOString()); // Save timestamp

        setIsLoggingIn(true);
        try {
            console.log('🔵 [LandingPage] Google Login clicked.');
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmitContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        logger.log({ action: 'CLICK', entityType: 'button', entityName: 'submit_contact_form', category: 'ui' });

        try {
            let imageUrl = null;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${uuidv4()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('contact_uploads')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('contact_uploads')
                    .getPublicUrl(filePath);

                imageUrl = publicUrl;
            }

            const { error: insertError } = await supabase
                .from('contact_messages')
                .insert({
                    name,
                    phone,
                    message,
                    image_url: imageUrl,
                    user_id: null // Guest user
                });

            if (insertError) throw insertError;

            setIsSuccess(true);
            setMessage('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            showToast('ההודעה נשלחה בהצלחה!', 'success');

            logger.log({
                action: 'SUBMIT',
                entityType: 'form',
                entityName: 'contact_form',
                category: 'data',
                metadata: { hasImage: !!imageUrl }
            });

        } catch (error: any) {
            console.error('Error submitting contact form:', error);
            showToast('שגיאה בשליחת ההודעה. אנא נסה שוב מאוחר יותר.', 'error');
            logger.logError(error, 'LandingPage:ContactForm');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div id="landing-page-container" className="h-screen overflow-y-auto bg-slate-50 font-sans text-slate-900 custom-scrollbar" dir="rtl">



            {/* Navbar */}
            <nav className={`sticky top-0 left-0 right-0 z-40 transition-all duration-300 border-b ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-slate-200 py-2' : 'bg-white border-slate-200 py-3'
                }`}>
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
                    {/* Logo Area */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group select-none"
                        onClick={() => document.getElementById('landing-page-container')?.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-xl flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform overflow-hidden bg-white p-2 border border-slate-100">
                            <img src="/favicon.png" alt="Logo" className="w-full h-full object-contain" />
                        </div>
                        <div className="hidden md:block">
                            <div className="text-lg font-bold tracking-tight text-slate-900 leading-tight">מערכת ניהול פלוגה</div>
                            <div className="text-xs text-slate-500 font-medium tracking-wide">שליטה ובקרה</div>
                        </div>
                    </div>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
                        <a href="#features" className="hover:text-slate-900 transition-colors">פיצ'רים</a>
                        <a href="#about" className="hover:text-slate-900 transition-colors">אודות</a>
                        <a href="#contact" className="hover:text-slate-900 transition-colors">צור קשר</a>
                    </div>

                    {/* Login Button */}
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="bg-[#FFD700] hover:bg-[#F4C430] text-slate-900 px-5 md:px-6 py-2 md:py-2.5 rounded-full font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2 group"
                    >
                        <User size={18} className="group-hover:scale-110 transition-transform" />
                        <span>לאזור האישי</span>
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
                {/* Background Image */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="/images/landing-hero-new.png"
                        alt="Background"
                        className="w-full h-full object-cover"
                    />
                    {/* Gradient Overlays - Strengthened for accessibility legibility */}
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 via-slate-900/80 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent opacity-90"></div>
                </div>

                {/* Content */}
                <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 w-full pt-10">
                    <div className="max-w-2xl space-y-6 md:space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full px-4 py-1.5 text-xs md:text-sm font-medium">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            מערכת שליטה ובקרה פלוגתית
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.1] tracking-tight drop-shadow-2xl">
                            עושים סדר <br />
                            <span className="text-[#FFD700] drop-shadow-lg">בבלאגן בפלוגה</span>
                        </h1>

                        <p className="text-lg md:text-2xl text-slate-300 font-light leading-relaxed max-w-xl">
                            הפתרון המלא לניהול נוכחות, משימות ושיבוץ חכם.
                            כל נתוני הפלוגה במקום אחד, נגיש ומאובטח.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                onClick={() => setShowLoginModal(true)}
                                className="bg-[#FFD700] hover:bg-[#F4C430] text-slate-950 px-8 py-4 rounded-xl font-bold text-lg shadow-lg shadow-amber-900/20 hover:shadow-amber-900/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                                aria-label="תעבור מאקסלים לשליטה בזמן אמת"
                            >
                                <span>תעבור מאקסלים לשליטה בזמן אמת</span>
                                <ArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                            </button>

                        </div>
                    </div>
                </div>

                {/* Bottom Stats Banner - REMOVED STATS per request */}
                <div className="absolute bottom-0 left-0 right-0 bg-white/5 backdrop-blur-md border-t border-white/10 py-6 hidden md:block">
                    {/* Empty or minimal banner if needed */}
                </div>
            </header>

            {/* Features Grid */}
            <section className="py-20 md:py-32 bg-white relative overflow-hidden" id="features">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-slate-50 to-transparent"></div>
                <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
                    <div className="text-center mb-16 md:mb-24">
                        <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-6">הכלים לניהול הפלוגה</h2>
                        <p className="text-xl text-slate-500 max-w-2xl mx-auto">מערכת אחת שמרכזת את כל מה שהמפקד צריך כדי לשלוט בכוח האדם והמשימות.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 md:gap-12">
                        {/* Feature 1 */}
                        <div className="group bg-slate-50 rounded-[2rem] p-8 md:p-10 border border-slate-100 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-900/5 transition-all duration-300 hover:-translate-y-2">
                            <div className="w-24 h-24 mb-6 group-hover:scale-110 transition-transform">
                                <img src="/images/feature-attendance.png" alt="Attendance" className="w-full h-full object-contain" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-4">ניהול נוכחות וזמינות</h3>
                            <p className="text-slate-600 leading-relaxed text-lg">
                                תמונת מצב בזמן אמת של כוח האדם. מי נמצא, מי בגימלים, ומי זמין למשימה. דוחות אוטומטיים למפקדות.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="group bg-slate-50 rounded-[2rem] p-8 md:p-10 border border-slate-100 hover:border-amber-200 hover:shadow-2xl hover:shadow-amber-900/5 transition-all duration-300 hover:-translate-y-2">
                            <div className="w-24 h-24 mb-6 group-hover:scale-110 transition-transform">
                                <img src="/images/feature-tasks.png" alt="Tasks" className="w-full h-full object-contain" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-4">ניהול משימות</h3>
                            <p className="text-slate-600 leading-relaxed text-lg">
                                הקצאת משימות לחיילים ולצוותים. מעקב ביצוע, תזכורות אוטומטיות וניהול עומסים חכם למניעת שחיקה.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="group bg-slate-50 rounded-[2rem] p-8 md:p-10 border border-slate-100 hover:border-green-200 hover:shadow-2xl hover:shadow-green-900/5 transition-all duration-300 hover:-translate-y-2">
                            <div className="w-24 h-24 mb-6 group-hover:scale-110 transition-transform">
                                <img src="/images/feature-scheduling.png" alt="Scheduling" className="w-full h-full object-contain" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-4">שיבוץ חכם</h3>
                            <p className="text-slate-600 leading-relaxed text-lg">
                                אלגוריתם אוטומטי לשיבוץ משמרות ושמירות. מתחשב באילוצים, העדפות, וכשירויות בצורה אופטימלית.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* About Section - NEW */}
            <section className="py-20 bg-slate-900 text-white relative overflow-hidden" id="about">
                <div className="max-w-7xl mx-auto px-4 md:px-6 relative z-10">
                    <div className="grid md:grid-cols-2 gap-12 items-center">
                        <div className="space-y-6">
                            <h2 className="text-4xl md:text-5xl font-black leading-tight">
                                קצת עליי ועל הסיבה שהמערכת קיימת
                            </h2>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                המערכת נולדה מתוך כאב אישי וקושי שחוויתי במהלך שירות מילואים ארוך ותובעני.
                                ראיתי איך מפקדים מצוינים טובעים בים של טבלאות אקסל, הודעות ווטסאפ ובלגן ניהולי,
                                במקום להתמקד במה שחשוב באמת - האנשים והמשימה.
                            </p>
                            <p className="text-slate-300 text-lg leading-relaxed">
                                החלטתי לקחת את הידע המקצועי שלי כמפתח וליצור פתרון שמותאם בדיוק לצרכים של פלוגה קרבית.
                                המטרה שלי הייתה פשוטה: ליצור מערכת שתעשה סדר בבלאגן, תחבר בין כל הקצוות, ותיתן למפקדים שקט נפשי.
                            </p>
                            <div className="pt-4">
                                <a
                                    href="https://www.linkedin.com/in/idan-zeman"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-medium transition-colors bg-white/10 px-4 py-2 rounded-lg hover:bg-white/20"
                                >
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
                                    <span>בואו נדבר בלינקדאין</span>
                                </a>
                            </div>
                        </div>
                        <div className="relative">
                            <div className="rounded-3xl p-1 transform hover:scale-[1.02] transition-transform duration-500 shadow-2xl">
                                <div className="bg-slate-900 rounded-[1.4rem] overflow-hidden border border-slate-700 aspect-square relative z-10">
                                    <img
                                        src="/images/about-me.jpg"
                                        alt="About the Developer"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                {/* Decorative background element behind the image */}
                                <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600 to-teal-500 rounded-[2rem] opacity-20 blur-lg -z-0"></div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Decor */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            </section>

            {/* Contact Section - NEW */}
            <section className="py-20 md:py-32 bg-slate-50" id="contact">
                <div className="max-w-3xl mx-auto px-4 md:px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black text-slate-900 mb-4">דברו איתנו</h2>
                        <p className="text-slate-600">יש לכם הצעה לשיפור? נתקלתם בבעיה? אנחנו כאן בשבילכם.</p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 md:p-12 overflow-hidden relative">
                        {isSuccess ? (
                            <div className="text-center py-12 animate-in fade-in zoom-in">
                                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <Send className="text-green-600" size={40} />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">ההודעה נשלחה בהצלחה!</h3>
                                <p className="text-slate-600 mb-8 max-w-md mx-auto">תודה שפנית אלינו. הצוות שלנו יבדוק את הפנייה ויחזור אליך בהקדם האפשרי.</p>
                                <button
                                    onClick={() => setIsSuccess(false)}
                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 px-8 rounded-xl transition-colors"
                                >
                                    שלח הודעה נוספת
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmitContact} className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">שם מלא</label>
                                        <div className="relative">
                                            <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="text"
                                                required
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                                placeholder="ישראל ישראלי"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700">טלפון</label>
                                        <div className="relative">
                                            <Phone className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                            <input
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-right"
                                                placeholder="050-0000000"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">תוכן ההודעה</label>
                                    <div className="relative">
                                        <MessageSquare className="absolute right-4 top-4 text-slate-400" size={18} />
                                        <textarea
                                            required
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            rows={4}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                            placeholder="כתוב כאן..."
                                        ></textarea>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700">צרף תמונה (אופציונלי)</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                            id="file-upload-landing"
                                        />
                                        <label
                                            htmlFor="file-upload-landing"
                                            className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all font-medium"
                                        >
                                            <Upload size={18} />
                                            בחר קובץ
                                        </label>
                                        {file && (
                                            <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm border border-blue-100 animate-in fade-in slide-in-from-right-2">
                                                <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFile(null);
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                    }}
                                                    className="hover:bg-blue-100 rounded-full p-1 transition-colors"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            שולח...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={20} />
                                            שלח הודעה
                                        </>
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>

            {/* Login Modal Popup - RESPONSIVE */}
            {
                showLoginModal && (
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
                                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden bg-white p-3 border border-slate-100">
                                    <img src="/favicon.png" alt="Shibuz Logo" className="w-full h-full object-contain" />
                                </div>
                            </div>

                            {/* Title */}
                            <div className="text-center mb-6 md:mb-8">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-2">התחברות</h2>
                                <p className="text-slate-500 text-xs md:text-sm">התחבר כדי להמשיך למערכת לניהול פלוגה משימות</p>
                            </div>

                            {/* Terms Checkbox - NEW */}
                            <div className="flex items-start gap-3 mb-6 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                <div className="pt-0.5">
                                    <input
                                        type="checkbox"
                                        id="terms-check"
                                        checked={termsAccepted}
                                        onChange={(e) => setTermsAccepted(e.target.checked)}
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="terms-check" className="text-xs text-slate-600 leading-relaxed cursor-pointer select-none">
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
                                disabled={isLoggingIn || !termsAccepted} // Disable if not accepted
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
                )
            }
            <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
        </div>
    );
};