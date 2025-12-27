import React from 'react';
import { ArrowRight, Accessibility, Mail, Phone, CheckCircle2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const AccessibilityStatement: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900" dir="rtl">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg shadow-blue-900/20">
                            <Accessibility size={20} aria-hidden="true" />
                        </div>
                        <div className="hidden md:block">
                            <h1 className="font-bold text-lg leading-tight text-slate-900">הצהרת נגישות</h1>
                            <p className="text-xs text-slate-500 font-medium">מערכת ניהול פלוגה</p>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="group flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold transition-all bg-slate-50 hover:bg-blue-50 px-4 py-2 rounded-xl"
                        aria-label="חזרה לדף הבית"
                    >
                        <ArrowRight size={18} aria-hidden="true" className="group-hover:-translate-x-1 transition-transform" />
                        <span>חזרה למערכת</span>
                    </button>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-12">
                <div className="grid md:grid-cols-12 gap-12">

                    {/* Main Content Info */}
                    <div className="md:col-span-8 space-y-12">

                        {/* Intro Section */}
                        <section className="space-y-6">
                            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                                התחייבות לנגישות שוויונית
                            </h2>
                            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl">
                                אנו במערכת לניהול פלוגה רואים חשיבות עליונה בהענקת שירות שוויוני ונגיש לכלל המשתמשים.
                                האתר תוכנן בקפידה כדי לאפשר חווית גלישה נוחה, ברורה ומכבדת לכל אדם, ללא קשר למוגבלות טכנולוגית או פיזית.
                            </p>
                        </section>

                        {/* Standards Box */}
                        <section className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-colors">
                            <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
                            <div className="flex items-start gap-4 relatie z-10">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                                    <Shield size={24} aria-hidden="true" />
                                </div>
                                <div className="space-y-3">
                                    <h3 className="text-xl font-bold text-slate-900">תקינה וסטנדרטים</h3>
                                    <p className="text-slate-600 leading-relaxed">
                                        אתר זה הותאם לדרישות תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013.
                                        <br />
                                        ההתאמות בוצעו על פי המלצות התקן הישראלי (ת"י 5568) לנגישות תכנים באינטרנט ברמת <strong>AA</strong> ומסמך <strong>WCAG 2.1</strong> הבינלאומי.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* Features List */}
                        <section>
                            <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-3">
                                <span className="w-8 h-1 bg-slate-900 rounded-full"></span>
                                התאמות שבוצעו באתר
                            </h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                {[
                                    'ניווט מקלדת מלא (Tab, Enter, Esc)',
                                    'תמיכה בקוראי מסך (NVDA, JAWS)',
                                    'ניגודיות צבעים גבוהה וברורה',
                                    'הגדלת טקסט רספונסיבית',
                                    'מבנה סמנטי תקין (כותרות, אזורים)',
                                    'התאמה מלאה למובייל וטאבלטים',
                                    'הודעות שגיאה ואישור מונגשות',
                                    'ביטול הבהובים ותוכן מרצד'
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100/50 hover:bg-white hover:shadow-sm hover:border-slate-200 transition-all">
                                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" aria-hidden="true" />
                                        <span className="text-slate-700 font-medium text-sm">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Sidebar Contact */}
                    <aside className="md:col-span-4 space-y-6">
                        <div className="bg-slate-900 text-white p-8 rounded-[2rem] shadow-xl relative overflow-hidden">
                            {/* Decorative Circles */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl -ml-10 -mb-10"></div>

                            <h3 className="text-2xl font-black mb-2 relative z-10">נתקלת בבעיה?</h3>
                            <p className="text-slate-300 text-sm mb-8 leading-relaxed relative z-10">
                                אנחנו כאן כדי לעזור. אם מצאת רכיב שאינו נגיש או שנתקלת בקושי, אנא צור קשר ונטפל בפנייתך בהקדם.
                            </p>

                            <div className="space-y-4 relative z-10">
                                <div>
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">רכז נגישות</span>
                                    <div className="text-lg font-bold mt-1">דואר אלקטרוני</div>
                                    <a href="mailto:support@miuim.app" className="flex items-center gap-2 text-blue-300 hover:text-white transition-colors mt-1 group">
                                        <Mail size={16} />
                                        <span className="group-hover:underline">support@miuim.app</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-3xl border border-slate-100 text-center">
                            <p className="text-slate-500 text-xs">
                                הצהרה זו עודכנה לאחרונה בתאריך:
                                <br />
                                <span className="font-bold text-slate-900 text-sm block mt-1">
                                    {new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </p>
                        </div>
                    </aside>

                </div>
            </main>
        </div>
    );
};
