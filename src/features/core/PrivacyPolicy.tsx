import React from 'react';
import { ShieldCheck, Eye, Lock, FileText } from '@phosphor-icons/react';
import { PageInfo } from '../../components/ui/PageInfo';

export const PrivacyPolicy: React.FC = () => {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto mb-12" dir="rtl">
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm space-y-12 leading-relaxed text-slate-700">
                <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-8">
                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
                        <ShieldCheck size={32} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-slate-800">מדיניות פרטיות</h1>
                            <PageInfo
                                title="מדיניות פרטיות"
                                description="הגנה על המידע שלך היא בראש סדר העדיפויות שלנו"
                            />
                        </div>
                        <p className="text-slate-500 font-bold mt-0.5">ניהול והגנה על נתונים אישיים</p>
                    </div>
                </div>
                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                            <Eye size={22} weight="bold" />
                        </div>
                        איזה מידע אנחנו אוספים?
                    </h2>
                    <p className="text-lg">
                        על מנת לספק את שירותי ניהול כוח האדם והמשימות, אנו אוספים מידע אישי בסיסי הכולל שמות, מספרי טלפון, שיוך יחידתי ופרטי שיבוץ. מידע זה משמש אך ורק למטרות תפעוליות של היחידה ואינו מועבר לצדדים שלישיים ללא אישור מפורש.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                            <Lock size={22} weight="bold" />
                        </div>
                        אבטחת המידע
                    </h2>
                    <p className="text-lg">
                        אנו נוקטים באמצעי אבטחה מחמירים כדי להגן על המידע שלך מפני גישה בלתי מורשית, שינוי או השמדה. המידע מאוחסן בשרתים מאובטחים תוך שימוש בהצפנה מתקדמת (AES-256) וגישה מבוססת הרשאות קפדנית.
                    </p>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                            <FileText size={22} weight="bold" />
                        </div>
                        זכויות המשתמש
                    </h2>
                    <p className="text-lg">
                        לכל משתמש קיימת הזכות לעיין במידע השמור עליו, לעעדכן פרטים שגויים ולבקש את מחיקת המידע בתיאום עם מנהל המערכת היחידתי.
                    </p>
                </section>

                <div className="pt-8 border-t border-slate-100 mt-12">
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-slate-600 text-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <p className="font-medium italic">לשאלות נוספות בנושא פרטיות, ניתן ליצור קשר עם ממונה אבטחת המידע דרך עמוד ה"צור קשר".</p>
                        <p className="text-[10px] font-black uppercase opacity-50 whitespace-nowrap">עודכן לאחרונה: ינואר 2026</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
