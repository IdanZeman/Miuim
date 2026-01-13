import React from 'react';
import { ShieldCheck, LockKey, Fingerprint, Detective } from '@phosphor-icons/react';
import { PageInfo } from '../../components/ui/PageInfo';

export const SecurityPage: React.FC = () => {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto mb-12" dir="rtl">
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm space-y-12 leading-relaxed text-slate-700">
                <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-8">
                    <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
                        <ShieldCheck size={32} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-slate-800">אבטחת מידע</h1>
                            <PageInfo
                                title="אבטחת מידע"
                                description="מערך ההגנה על המערכת והנתונים"
                            />
                        </div>
                        <p className="text-slate-500 font-bold mt-0.5">פרוטוקולי אבטחה ושמירה על חיסיון</p>
                    </div>
                </div>
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <LockKey size={22} weight="bold" />
                        </div>
                        ארכיטקטורת הגנה והצפנה
                    </h2>
                    <div className="space-y-4 text-lg">
                        <p>
                            אבטחת הנתונים בראש מעיינינו. המערכת עושה שימוש בפרוטוקולים המחמירים ביותר בתעשייה:
                        </p>
                        <ul className="list-disc list-inside mr-4 space-y-2 text-slate-600">
                            <li><strong>הצפנה בתנועה (In-Transit)</strong>: כל התקשורת בין המשתמש לשרת מוגנת בהצפנת TLS 1.3 המונעת ציתות או שינוי נתונים.</li>
                            <li><strong>הצפנה במנוחה (At-Rest)</strong>: נתוני המערכת בבסיס הנתונים מוצפנים באמצעות AES-256, התקן המועדף על ארגוני ביטחון ובנקים.</li>
                            <li><strong>בידוד נתונים</strong>: כל ארגון (גדוד/פלוגה) מנוהל בסביבה לוגית מבודדת לחלוטין למניעת דליפת מידע בין יחידות.</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <Fingerprint size={22} weight="bold" />
                        </div>
                        ניהול זהות וגישה (IAM)
                    </h2>
                    <div className="space-y-4 text-lg text-slate-600">
                        <p>
                            אנו מיישמים את עקרון "מינימום ההרשאות הנדרש" (Least Privilege):
                        </p>
                        <ul className="list-disc list-inside mr-4 space-y-2">
                            <li><strong>הרשאות מבוססות תפקיד (RBAC)</strong>: המערכת מבדילה בין משתמש קצה, מפקד פלוגה, ומנהל מערכת.</li>
                            <li><strong>אימות דו-שלבי (MFA)</strong>: היכולת להוסיף שכבת הגנה נוספת לגישה למערכת.</li>
                            <li><strong>ניהול סיסמאות</strong>: סיסמאות המשתמשים אינן נשמרות במערכת בטקסט גלוי אלא כערכי Hash מאובטחים (Bcrypt).</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                            <Detective size={22} weight="bold" />
                        </div>
                        ניטור, בקרה ושקיפות
                    </h2>
                    <div className="space-y-4 text-lg text-slate-600">
                        <p>
                            מערך הניטור שלנו פועל 24/7 לזיהוי ותגובה לאירועי אבטחה:
                        </p>
                        <ul className="list-disc list-inside mr-4 space-y-2">
                            <li><strong>יומן פעילות (Audit Log)</strong>: תיעוד מלא של כל פעולת עריכה, מחיקה או גישה למידע רגיש.</li>
                            <li><strong>סריקות פגיעות</strong>: ביצוע סריקות אוטומטיות שוטפות לזיהוי חולשות תוכנה ועדכוני אבטחה.</li>
                            <li><strong>גיבויים</strong>: ביצוע גיבויים אוטומטיים יומיים במיקומים גיאוגרפיים נפרדים להבטחת המשכיות מבצעית.</li>
                        </ul>
                    </div>
                </section>

                <div className="pt-8 border-t border-slate-100 mt-12">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-emerald-800 text-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="font-bold flex items-center gap-2 text-emerald-900">
                                ⭐ המערכת מתוכננת לעמידה בסטנדרטים בטחוניים ושימוש בסביבות רגישות.
                            </p>
                            <p className="opacity-80 font-medium">לשאלות בנושא אבטחה או דיווח על פרצה, אנא פנו אלינו דרך עמוד "צור קשר".</p>
                        </div>
                        <p className="text-[10px] font-black uppercase opacity-60 whitespace-nowrap align-bottom">עודכן לאחרונה: ינואר 2026</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
