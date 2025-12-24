import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, BookOpen, Users, CheckCircle, Calendar, Shield, UserCircle, Settings, HelpCircle, Package, Trophy } from 'lucide-react';
import { Input } from './ui/Input';

interface FAQItem {
    question: string;
    answer: React.ReactNode;
}

interface FAQCategory {
    id: string;
    title: string;
    icon: any; // Lucide icon
    items: FAQItem[];
}

export const FAQPage: React.FC<{ onNavigate: (view: any) => void }> = ({ onNavigate }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

    const toggleItem = (categoryIndex: number, itemIndex: number) => {
        const key = `${categoryIndex}-${itemIndex}`;
        setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const categories: FAQCategory[] = [
        {
            id: 'personnel',
            title: '1. ניהול כוח אדם ומבנה ארגוני',
            icon: Users,
            items: [
                {
                    question: 'מה ההבדל בין "צוות" (Team) ל"תפקיד" (Role)?',
                    answer: (
                        <div className="space-y-2">
                            <p className="font-bold">צוות (Team):</p>
                            <p>השיוך האורגני של החייל (לדוגמה: "צוות 1", "חפ״ק"). חייל יכול להיות משויך לצוות אחד בלבד.</p>
                            <p className="font-bold border-t border-slate-100 pt-2 mt-2">תפקיד (Role):</p>
                            <p>הכשרה מקצועית (לדוגמה: "מפקד", "חובש", "נהג"). ניתן לשייך לחייל מספר תפקידים (הסמכות).</p>
                        </div>
                    )
                },

                {
                    question: 'איך מייבאים נתונים באקסל?',
                    answer: 'אשף האקסל מאפשר טעינה מהירה של סד״כ. יש לוודא כי העמודות בקובץ תואמות במדויק להגדרות המערכת (שם, תפקיד, צוות) למניעת שגיאות שיוך.'
                },
                {
                    question: 'מהם שדות מותאמים (Custom Fields)?',
                    answer: 'ניתן להוסיף שדות ייחודיים ליחידה (כגון: מספר נשק, סוג דם, מידת נעל) המסתנכרנים ומופיעים בכל חלקי המערכת, כולל בכרטיס החייל.'
                }
            ]
        },
        {
            id: 'tasks',
            title: '2. אפיון משימות ומשמרות',
            icon: CheckCircle,
            items: [
                {
                    question: 'מה ההבדל בין "משימה" למקטעים (Segments)?',
                    answer: (
                        <div className="space-y-2">
                            <p>המערכת מגדירה <b>"משימה"</b> כמיכל תוכן (הגדרה כללית). תחתיה מייצרים <b>"מקטעים"</b> – אלו המשמרות בפועל המשתבצות בלוח.</p>
                            <div className="bg-slate-50 p-2 rounded text-sm text-slate-600">
                                דוגמה: משימת "סיור גדר" (משימה) יכולה להכיל 3 מקטעים של 8 שעות כל אחד ביממה.
                            </div>
                        </div>
                    )
                },
                {
                    question: 'מה זה הרכב תפקידים (Role Composition)?',
                    answer: 'לכל מקטע ניתן להגדיר בדיוק כמה אנשים נדרשים מכל תפקיד. המערכת לא תאשר שיבוץ "ירוק" (תקין) אם חסר תפקיד קריטי (למשל: חובש בסיור).',
                },
                {
                    question: 'איך משפיע מדד הקושי (Difficulty Level)?',
                    answer: 'כל משימה מדורגת מ-1 עד 5. נתון זה הוא ה"דלק" של מדד ההוגנות – חייל שביצע משימה בקושי 5 יקבל תיעוד עומס גבוה יותר מחייל שביצע משימה בקושי 1.'
                }
            ]
        },
        {
            id: 'scheduling',
            title: '3. לוח שיבוצים ומנגנון ה"קוסם"',
            icon: Calendar,
            items: [
                {
                    question: 'איך עובד השיבוץ האוטומטי (Smart Assign)?',
                    answer: (
                        <ul className="list-decimal list-inside space-y-1">
                            <li><b>כשירות:</b> בעל התפקיד המתאים.</li>
                            <li><b>זמינות:</b> לא בחופש/אילוץ ולא במשמרת חופפת.</li>
                            <li><b>מנוחה:</b> בעל זמן המנוחה הארוך ביותר מהמשימה האחרונה.</li>
                            <li><b>הוגנות:</b> חייל עם "ניקוד עומס" נמוך יותר בהיסטוריה של 30 הימים האחרונים.</li>
                        </ul>
                    )
                },
                {
                    question: 'מה משמעות צבעי ההתראות בלוח?',
                    answer: (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                                <span className="font-bold text-red-700">אדום ("קונפליקט חמור"):</span>
                            </div>
                            <p className="text-sm pr-5">חייל משובץ פעמיים באותו זמן, או נמצא בבית (לא זמין).</p>

                            <div className="flex items-center gap-2 mt-2">
                                <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm" />
                                <span className="font-bold text-orange-700">כתום ("אזהרה"):</span>
                            </div>
                            <p className="text-sm pr-5">חריגה מחוקי מנוחה (פחות מ-6 שעות) או אי-התאמה בין תפקיד החייל לדרישת המשימה.</p>
                        </div>
                    )
                }
            ]
        },
        {
            id: 'attendance',
            title: '4. אשף הסבבים',
            icon: UserCircle,
            items: [
                {
                    question: 'מהם מצבי האופטימיזציה בסבבים?',
                    answer: (
                        <div className="space-y-3">
                            <div>
                                <p className="font-bold text-indigo-700">1. יחס קבוע (Fixed Ratio):</p>
                                <p className="text-sm">שמירה על מחזוריות קשיחה (לדוגמה 11/3). המערכת תדאג שכל חייל יצא בזמן שלו תוך שמירה על רציפות.</p>
                            </div>
                            <div>
                                <p className="font-bold text-indigo-700">2. מינימום סד״כ (Min Headcount):</p>
                                <p className="text-sm">המפקד קובע "רצפה" (למשל 20 לוחמים). המערכת תוציא הביתה את כל השאר לפי תור הוגן.</p>
                            </div>
                            <div>
                                <p className="font-bold text-indigo-700">3. נגזרת משימות (Task Derived):</p>
                                <p className="text-sm">המערכת בודקת כמה אנשים צריך לשיבוץ המלא ביום נתון, ומשאירה בבסיס רק את הכמות הנדרשת + רזרבה מוגדרת.</p>
                            </div>
                        </div>
                    )
                },
                {
                    question: 'למה חשוב להזין היעדרויות?',
                    answer: 'ניהול ההיעדרויות הוא ה"דלק" של אשף הסבבים. כאשר מסמנים חייל בחופש, קורס או מחלה, האלגוריתם מזהה זאת אוטומטית, מדלג עליו בשיבוץ, ומשלים את החוסר מתוך הסד״כ הזמין. ללא הזנת היעדרויות - השיבוץ האוטומטי ישבץ רנודמלי את האנשים בלי להתחשב בצרכים האישיים של כל אחד.'
                }
            ]
        },
        {
            id: 'equipment',
            title: '5. ניהול אמצעים ואמל"ח (צלם)',
            icon: Package,
            items: [
                {
                    question: 'איך עובדת החתימה הדיגיטלית?',
                    answer: 'ניתן לשייך אמצעי (נשק, אופטיקה, קשר) לחייל ספציפי באופן דיגיטלי. זה יוצר "כרטיס ציוד" אישי לכל לוחם.'
                },
                {
                    question: 'מהו אימות נתונים וסטטוס אמצעי?',
                    answer: 'המערכת שומרת "תאריך אימות אחרון". אם ציוד לא אומת זמן רב - תופיע התראה. כמו כן, ניתן לעקוב אחר סטטוס תקינות (תקין / בתיקון / אבוד) בזמן אמת.'
                }
            ]
        },
        {
            id: 'reports',
            title: '6. דוחות ואנליטיקה',
            icon: Trophy,
            items: [
                {
                    question: 'מהו "ניקוד עומס"?',
                    answer: 'חישוב מתמטי המשקלל את שעות המשימה כפול רמת הקושי. דוח זה מאפשר לראות אובייקטיבית מי הלוחמים ש"טוחנים" ומי נמצא בתת-פעילות.'
                },
                {
                    question: 'מהו ניתוח סד״כ?',
                    answer: 'גרף המציג את הפער בין כוח האדם הזמין בבסיס לבין דרישות המשימה המבצעית בכל יום נתון.'
                }
            ]
        }
    ];

    const filteredCategories = categories.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
            item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (typeof item.answer === 'string' && item.answer.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    })).filter(cat => cat.items.length > 0);

    return (
        <div className="h-full overflow-y-auto" dir="rtl">
            <div className="max-w-5xl mx-auto p-4 md:p-8 pb-20">

                {/* Header */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12 mb-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 text-indigo-600 rounded-2xl mb-6 shadow-sm rotate-3">
                        <HelpCircle size={40} />
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 mb-3 tracking-tight">מרכז עזרה ומדריכים</h1>
                    <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
                        כאן תמצאו תשובות לשאלות נפוצות, מדריכים מפורטים, וטיפים לשימוש יעיל במערכת.
                    </p>

                    <div className="max-w-2xl mx-auto relative group">
                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                            <Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        </div>
                        <Input
                            placeholder="חפש נושא, שאלה או מדריך..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="!bg-slate-50 hover:!bg-white focus:!bg-white border-slate-200 focus:border-indigo-500 h-14 text-lg pr-12 rounded-2xl shadow-sm transition-all duration-300"
                        />
                    </div>
                </div>

                {/* Categories */}
                <div className="space-y-6">
                    {filteredCategories.length === 0 ? (
                        <div className="text-center py-20 opacity-60">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-full mb-4 text-slate-400">
                                <Search size={24} />
                            </div>
                            <p className="text-xl font-bold text-slate-700">לא נמצאו תוצאות לחיפוש "{searchTerm}"</p>
                            <p className="text-slate-500 mt-2">נסה מילות מפתח אחרות או עיין בקטגוריות למטה</p>
                        </div>
                    ) : (
                        filteredCategories.map((category, catIdx) => (
                            <div key={category.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow duration-300 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${catIdx * 0.05}s` }}>
                                <div className="bg-slate-50/50 p-5 border-b border-slate-100 flex items-center gap-4">
                                    <div className={`p-2 rounded-xl bg-white shadow-sm text-indigo-600`}>
                                        <category.icon size={22} />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-800 tracking-tight">{category.title}</h2>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    {category.items.map((item, itemIdx) => {
                                        const isOpen = openItems[`${catIdx}-${itemIdx}`];
                                        return (
                                            <div key={itemIdx} className={`transition-colors duration-200 ${isOpen ? 'bg-indigo-50/10' : 'hover:bg-slate-50/50'}`}>
                                                <button
                                                    onClick={() => toggleItem(catIdx, itemIdx)}
                                                    className="w-full text-right p-5 flex items-start justify-between group"
                                                >
                                                    <span className={`font-bold text-slate-700 text-lg leading-snug pl-8 transition-colors ${isOpen ? 'text-indigo-700' : 'group-hover:text-slate-900'}`}>
                                                        {item.question}
                                                    </span>
                                                    <div className={`shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                                        {isOpen ? <ChevronUp className="text-indigo-500" /> : <ChevronDown className="text-slate-400 group-hover:text-slate-600" />}
                                                    </div>
                                                </button>
                                                <div
                                                    className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                                                >
                                                    <div className="px-5 pb-6 pt-0 text-slate-600 leading-relaxed">
                                                        <div className="bg-white p-5 rounded-xl border border-indigo-100/50 text-base shadow-sm">
                                                            {item.answer}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-slate-400 text-sm mb-2">עדיין זקוקים לעזרה?</p>
                    <button onClick={() => onNavigate('contact')} className="text-indigo-600 font-bold hover:underline">צור קשר</button>
                </div>
            </div>
        </div>
    );
};
