import React from 'react';
import { Gavel, CheckCircle, Warning, Scroll, Shield, WarningCircle } from '@phosphor-icons/react';
import { PageInfo } from '../../components/ui/PageInfo';

export const TermsOfUse: React.FC = () => {
    return (
        <div className="p-4 md:p-6 lg:p-8 space-y-8 max-w-5xl mx-auto mb-12" dir="rtl">
            <div className="bg-white rounded-3xl p-8 md:p-12 border border-slate-200 shadow-sm space-y-12 leading-relaxed text-slate-700">
                <div className="flex items-center gap-4 mb-4 border-b border-slate-100 pb-8">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                        <Shield size={32} weight="duotone" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-slate-800">תנאי שימוש</h1>
                            <PageInfo
                                title="תנאי שימוש ומדיניות פרטיות"
                                description="הנחיות וכללי שימוש במערכת"
                            />
                        </div>
                        <p className="text-slate-500 font-bold mt-0.5">הסכם שימוש ומדיניות משפטית</p>
                    </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4 text-amber-900 shadow-sm">
                    <div className="p-2 bg-amber-200 text-amber-700 rounded-lg">
                        <WarningCircle size={24} weight="duotone" className="shrink-0" />
                    </div>
                    <div>
                        <span className="font-extrabold block mb-1 text-xl">שים לב! איסור העלאת מידע מסווג</span>
                        <p className="text-lg opacity-90">המערכת פועלת על גבי רשת האינטרנט האזרחית. חל איסור מוחלט להעלות מידע בסיווג "שמור" ומעלה.</p>
                    </div>
                </div>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-sm border border-slate-100">
                            <Scroll size={22} weight="bold" />
                        </div>
                        1. כללי והגדרות
                    </h2>
                    <div className="space-y-4 text-lg">
                        <p>
                            ברוכים הבאים למערכת לניהול פלוגה (להלן: "המערכת" או "השירות"). השימוש במערכת מהווה הסכמה מלאה ובלתי מסויגת לתנאים המפורטים להלן.
                        </p>
                        <ul className="list-disc list-inside mr-4 space-y-2 text-slate-600 italic text-base">
                            <li><strong>"המשתמש"</strong>: כל אדם הניגש למערכת או עושה בה שימוש.</li>
                            <li><strong>"הארגון"</strong>: הישות (פלוגה, גדוד או יחידה) שבשרתה מנוהלים הנתונים.</li>
                            <li><strong>"נתוני לקוח"</strong>: כל מידע המוזן למערכת על ידי המשתמש או הארגון.</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-sm border border-slate-100">
                            <Shield size={22} weight="bold" />
                        </div>
                        2. רישיון שימוש וקניין רוחני
                    </h2>
                    <div className="space-y-4 text-lg">
                        <p>
                            המערכת מעניקה למשתמש רישיון מוגבל, לא בלעדי, ובלתי ניתן להעברה לעשות שימוש בשירות לצרכים המבצעיים והניהוליים של הארגון בלבד.
                        </p>
                        <p>
                            כל זכויות הקניין הרוחני במערכת, לרבות קוד המקור, העיצוב, ממשק המשתמש, סימני המסחר והלוגו, שייכים באופן בלעדי למערכת. חל איסור מוחלט על העתקה, הפצה, הנדסה לאחור או שימוש מסחרי כלשהו ללא אישור מפורש בכתב.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                            <Warning size={22} weight="bold" />
                        </div>
                        3. בטחון מידע ואחריות המשתמש
                    </h2>
                    <div className="space-y-4 text-lg text-slate-800">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4 text-amber-900 shadow-sm">
                            <div className="p-2 bg-amber-200 text-amber-700 rounded-lg shrink-0">
                                <WarningCircle size={24} weight="duotone" />
                            </div>
                            <div>
                                <span className="font-extrabold block mb-1 text-xl">איסור העלאת מידע מסווג</span>
                                <p className="text-lg opacity-90">המערכת פועלת על גבי רשת האינטרנט האזרחית. חל איסור מוחלט להעלות מידע בסיווג "שמור" ומעלה. האחריות על סיווג המידע חלה על המשתמש בלבד.</p>
                            </div>
                        </div>
                        <ul className="list-disc list-inside mr-4 space-y-2">
                            <li>המשתמש אחראי לשמירת סודיות פרטי הגישה (סיסמאות) שלו.</li>
                            <li>המשתמש מתחייב להזין נתונים מדויקים ואמינים בלבד.</li>
                        </ul>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-sm border border-slate-100">
                            <CheckCircle size={22} weight="bold" />
                        </div>
                        4. הגבלת אחריות
                    </h2>
                    <div className="space-y-4 text-lg">
                        <p>
                            השירות ניתן כפי שהוא (AS-IS). המערכת אינה מבטיחה זמינות רציפה של 100% ואינה אחראית לנזקים הנובעים מהפסקות שירות, תקלות בתקשורת או אובדן נתונים לא מכוון.
                        </p>
                        <p className="font-bold text-slate-900">
                            כל החלטה מבצעית או פיקודית המתבססת על נתוני המערכת (שיבוצים, סטטיסטיקות) הינה באחריות המפקד המבצע בלבד. המערכת מהווה כלי עזר תומך החלטה ולא תחליף לשיקול דעת פיקודי.
                        </p>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 shadow-sm border border-slate-100">
                            <Gavel size={22} weight="bold" />
                        </div>
                        5. סיום והפסקת שירות
                    </h2>
                    <p className="text-lg">
                        המערכת שומרת לעצמה את הזכות להשעות או להפסיק את מתן השירות למשתמש או לארגון הפועלים בניגוד לתנאים אלו, או מכל סיבה מבצעית/טכנית אחרת, בהודעה סבירה מראש ככל הניתן. במקרה של סיום התקשרות, המערכת תאפשר ייצוא נתונים בסיסי בטרם מחיקתם.
                    </p>
                </section>

                <div className="pt-8 border-t border-slate-100 mt-12 text-slate-500 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-bold text-slate-900">דין וסמכות שיפוט</p>
                        <p className="text-xs italic">על תנאים אלו יחולו דיני מדינת ישראל וסמכות השיפוט הבלעדית תהא לבתי המשפט בתל אביב.</p>
                    </div>
                    <p className="text-[10px] font-black uppercase opacity-60 shrink-0">עודכן לאחרונה: ינואר 2026</p>
                </div>
            </div>
        </div>
    );
};
