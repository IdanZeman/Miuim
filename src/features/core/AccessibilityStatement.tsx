import React from 'react';
import { Wheelchair as AccessibilityIcon, Envelope as MailIcon, Phone as PhoneIcon, CheckCircle as CheckCircleIcon, Shield as ShieldIcon } from '@phosphor-icons/react';
import { PageInfo } from '../../components/ui/PageInfo';

export const AccessibilityStatement: React.FC = () => {

    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto mb-12" dir="rtl">
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm space-y-12 leading-relaxed text-slate-700">
                <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-8">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                        <AccessibilityIcon size={32} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-slate-800">הצהרת נגישות</h1>
                            <PageInfo
                                title="הצהרת נגישות"
                                description="אנו מחויבים להנגשת המערכת לכלל המשתמשים"
                            />
                        </div>
                        <p className="text-slate-500 font-bold mt-0.5">שוויון הזדמנויות ונוחות שימוש</p>
                    </div>
                </div>

                <section className="space-y-6">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                        התחייבות לנגישות שוויונית
                    </h2>
                    <div className="space-y-4 text-xl text-slate-600 leading-relaxed">
                        <p>
                            אנו ב"מערכת לניהול פלוגה" רואים חשיבות עליונה בהענקת שירות שוויוני ונגיש לכלל המשתמשים. המערכת תוכננה בקפידה כדי לאפשר חווית גלישה נוחה, ברורה ומכבדת לכל אדם.
                        </p>
                    </div>
                </section>

                <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-2 h-full bg-blue-600"></div>
                    <div className="flex items-start gap-6 relative z-10">
                        <div className="p-4 bg-white text-blue-600 rounded-2xl shadow-sm border border-blue-50">
                            <ShieldIcon size={28} weight="duotone" />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-2xl font-black text-slate-900">תקינה וסטנדרטים</h3>
                            <p className="text-lg text-slate-600 leading-relaxed">
                                אתר זה הותאם לדרישות תקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), תשע"ג-2013.
                                <br />
                                ההתאמות בוצעו על פי המלצות התקן הישראלי (ת"י 5568) לנגישות תכנים באינטרנט ברמת <strong>AA</strong> ומסמך <strong>WCAG 2.1</strong> הבינלאומי.
                            </p>
                        </div>
                    </div>
                </div>

                <section className="space-y-8">
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                        <span className="w-12 h-1.5 bg-blue-600 rounded-full"></span>
                        התאמות נגישות מרכזיות
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-lg">
                        {[
                            'תאימות מלאה לסיוע טכנולוגי (קוראי מסך) במבנה HTML סמנטי',
                            'ניווט מלא ונוח באמצעות המקלדת בלבד (Tab, Enter, Arrows)',
                            'יחס ניגודיות צבעים העומד בדרישות התקן המחמירות ביותר',
                            'אפשרות להגדלת הטקסט עד 200% ללא פגיעה במבנה הדף',
                            'הימנעות משימוש באנימציות מהבהבות או תוכן מרצד',
                            'תיוג נכון של טפסים, שדות קלט ומקראות נתונים',
                            'רספונסיביות מלאה המאפשרת שימוש נוח בכל גודל מסך',
                            'תמיכה במיקוד (Focus) ברור וניכר לעין בכל אלמנט אינטראקטיבי'
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-white hover:bg-white hover:shadow-md hover:border-slate-200 transition-all group">
                                <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-colors shrink-0">
                                    <CheckCircleIcon size={20} weight="bold" />
                                </div>
                                <span className="text-slate-800 font-bold">{item}</span>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-6">
                    <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                        <span className="w-12 h-1.5 bg-blue-600 rounded-full"></span>
                        מגבלות נגישות
                    </h3>
                    <p className="text-lg text-slate-600">
                        למרות מאמצינו להנגיש את כלל דפי האתר, ייתכן ויתגלו חלקים או יכולות שטרם הונגשו במלואם (למשל תכנים המועלים על ידי משתמשים כגון קבצים חיצוניים). אנו ממשיכים במאמצים לשפר את נגישות האתר כחלק ממחויבותנו לאפשר שימוש בו לכלל האוכלוסייה.
                    </p>
                </section>

                <div className="pt-12 border-t border-slate-100 mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden flex flex-col justify-between group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-white/10 transition-colors"></div>
                        <div className="relative z-10">
                            <h3 className="text-3xl font-black mb-4">רכז נגישות</h3>
                            <p className="text-slate-300 text-lg leading-relaxed mb-6">
                                אם נתקלתם בקושי הנגשה או בבעיה מסוימת, אנא פנו אלינו ונטפל בהקדם המרבי.
                            </p>
                        </div>
                        <div className="relative z-10 flex flex-wrap gap-4 text-sm font-bold opacity-90">
                            <div className="flex items-center gap-2 bg-white/20 px-6 py-3 rounded-2xl border border-white/10 hover:bg-white/30 transition-all cursor-default">
                                <MailIcon size={20} />
                                <span>ניתן ליצור קשר דרך עמוד "צור קשר" במערכת</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center text-center">
                        <p className="text-slate-500 font-medium">
                            הצהרה זו עודכנה לאחרונה בתאריך:
                        </p>
                        <span className="font-black text-slate-900 text-2xl mt-2">
                            {new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <p className="text-xs text-slate-400 mt-4 leading-relaxed">
                            הצהרת הנגישות תקפה לאתר הפועל תחת דומיין המערכת המבצעית.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
