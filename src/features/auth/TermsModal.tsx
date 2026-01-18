import React from 'react';
import { X, Shield, Warning as AlertTriangle } from '@phosphor-icons/react';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';

interface TermsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose }) => {
    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <Shield className="text-blue-600" size={24} weight="bold" />
                    <span className="text-xl font-bold text-slate-800">תנאי שימוש ומדיניות פרטיות</span>
                </div>
            }
            size="2xl"
            footer={(
                <div className="flex justify-end w-full">
                    <Button
                        onClick={onClose}
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
                    >
                        קראתי והבנתי
                    </Button>
                </div>
            )}
        >
            <div className="space-y-6 text-slate-700 leading-relaxed" dir="rtl">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 text-yellow-800">
                    <AlertTriangle className="shrink-0 mt-0.5" size={20} weight="bold" />
                    <div>
                        <span className="font-bold block mb-1">שים לב! איסור העלאת מידע מסווג</span>
                        המערכת פועלת על גבי רשת האינטרנט האזרחית. חל איסור מוחלט להעלות מידע בסיווג "שמור" ומעלה.
                    </div>
                </div>

                <div className="space-y-4">
                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">1. כללי</h3>
                        <p>ברוכים הבאים למערכת "שיבוץ אופטימה" (להלן: "המערכת" או "האתר"). השימוש במערכת, לרבות העלאת נתונים, יצירת שיבוצים וניהול המשתמשים, מהווה הסכמה מלאה ובלתי מסויגת לתנאים המפורטים להלן. אם אינך מסכים לתנאים אלו, עליך להימנע משימוש במערכת.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">2. מהות השירות והגבלת אחריות</h3>
                        <ul className="list-disc list-inside space-y-1 mr-2">
                            <li>המערכת הינה כלי עזר טכנולוגי שנועד לסייע בניהול משמרות וכוח אדם.</li>
                            <li><strong>הבהרה קריטית:</strong> התוצרים של המערכת (לוחות שיבוץ, המלצות) הינם בגדר המלצה בלבד. האחריות הבלעדית לבדיקת השיבוץ, אישורו והפצתו כפקודה מחייבת חלה על המפקדים/המנהלים המשתמשים במערכת.</li>
                            <li>בעלי המערכת ומפעילייה לא יישאו באחריות לכל נזק, ישיר או עקיף, שיגרם כתוצאה מטעות בשיבוץ, באג במערכת, חוסר זמינות של האתר או איבוד מידע.</li>
                            <li>המערכת ניתנת לשימוש כמות שהיא (AS IS). לא תהיה למשתמש כל טענה, תביעה או דרישה כלפי בעלי המערכת בגין תכונות השירות, יכולותיו או התאמתו לצרכיו.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">3. בטחון מידע וסיווג הנתונים (חובה לקרוא!)</h3>
                        <ul className="list-disc list-inside space-y-1 mr-2">
                            <li><strong>איסור העלאת מידע מסווג:</strong> המערכת פועלת על גבי רשת האינטרנט האזרחית (Unclassified). חל איסור מוחלט להעלות למערכת מידע בסיווג "שמור" ומעלה, לרבות: סד"כ מבצעי מדויק בזמן אמת, מיקומי יחידות מסווגים, שמות מבצעים, או כל מידע אחר העלול לפגוע בביטחון המדינה.</li>
                            <li>המשתמש מצהיר כי המידע שהוא מזין למערכת הוא ברמת סיווג "בלמ"ס" (בלתי מסווג) בלבד.</li>
                            <li>האחריות על תוכן המידע המוזן חלה באופן בלעדי על המשתמש. הנהלת האתר רשאית למחוק לאלתר כל מידע שייחשד כרגיש או פוגעני ולחסום את המשתמש.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">4. פרטיות ואבטחת מידע</h3>
                        <ul className="list-disc list-inside space-y-1 mr-2">
                            <li>אנו עושים שימוש בשירותי ענן מתקדמים (כגון Supabase) ובפרוטוקולי אבטחה מקובלים לאבטחת המידע.</li>
                            <li>עם זאת, המשתמש מודע לכך שאין מערכת החסינה לחלוטין מפני פריצות. בעלי המערכת לא יהיו אחראים לכל דליפת מידע שתיגרם כתוצאה ממתקפת סייבר, כוח עליון או רשלנות של המשתמש (כגון מסירת סיסמה לצד ג').</li>
                            <li>המידע הנאסף (שמות, טלפונים, אילוצים) משמש אך ורק לצורך תפעול המערכת וביצוע השיבוצים, ולא יועבר לצדדים שלישיים למטרות מסחריות ללא הסכמה.</li>
                            <li><strong>איסוף כתובות IP ונתוני גלישה:</strong> המערכת אוספת ומתעדת כתובות IP ונתוני שימוש טכניים (כגון סוג דפדפן ומערכת הפעלה) של המשתמשים. מידע זה נאסף לצרכי אבטחת מידע, ניטור פעילות חשודה, ושיפור חווית המשתמש (אנליטיקה). השימוש במערכת מהווה הסכמה לאיסוף נתונים אלו.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">5. התנהגות משתמשים</h3>
                        <ul className="list-disc list-inside space-y-1 mr-2">
                            <li>המשתמש מתחייב לא לבצע כל פעולה העלולה לפגוע בפעילות המערכת, לרבות ניסיונות חדירה, שינוי קוד, או העמסת השרתים (Spam).</li>
                            <li>הגישה למערכת היא אישית. אין להעביר את פרטי ההתחברות לאדם אחר.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">6. קניין רוחני</h3>
                        <p>כל זכויות הקניין הרוחני במערכת, לרבות הקוד, האלגוריתמים, העיצוב ובסיסי הנתונים, הינם רכושו הבלעדי של בעלי המערכת. אין להעתיק, לשכפל או לעשות שימוש מסחרי במידע ללא אישור בכתב.</p>
                    </section>

                    <section>
                        <h3 className="font-bold text-lg text-slate-900 mb-2">7. שינוי תנאים וסמכות שיפוט</h3>
                        <ul className="list-disc list-inside space-y-1 mr-2">
                            <li>הנהלת האתר רשאית למחוק לאלתר כל מידע שייחשד כרגיש או פוגעני ולחסום את המשתמש.</li>
                            <li>על השימוש במערכת יחולו דיני מדינת ישראל בלבד. סמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים במחוז תל-אביב.</li>
                        </ul>
                    </section>
                </div>
            </div>
        </GenericModal>
    );
};
