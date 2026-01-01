import React, { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { CalendarCheck, Gavel, ChartPieSlice } from '@phosphor-icons/react';

const content = [
    {
        id: 1,
        title: "לוח שיבוצים חכם",
        description: "אלגוריתם מתקדם שבונה את הלוח עבורך בשניות. מתחשב בכל האילוצים, ההכשרות והבקשות של החיילים, ומייצר שיבוץ אופטימלי והוגן.",
        icon: CalendarCheck,
        color: "from-emerald-500 to-teal-500",
        image: "/landing/schedule-board.webp"
    },
    {
        id: 2,
        title: "מנוע חוקים ואילוצים",
        description: "הגדר חוקים חכמים לשיבוץ: מי לא יכול לשמור עם מי, הגבלת שעות רצופות, ומניעת טעויות אנוש לפני שהן קורות.",
        icon: Gavel,
        color: "from-blue-500 to-indigo-500",
        image: "/landing/task-rules.webp"
    },
    {
        id: 3,
        title: "תמונת מצב בזמן אמת",
        description: "דשבורד נוכחות שמראה לך בדיוק מי נמצא, מי בבית, ומה אחוזי האיוש העתידיים. קבל החלטות מבוססות נתונים.",
        icon: ChartPieSlice,
        color: "from-amber-500 to-orange-500",
        image: "/landing/attendance-graphs.webp"
    }
];

const FeatureText = ({ item, setFeatureId }: { item: typeof content[0], setFeatureId: (id: number) => void }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { margin: "-50% 0px -50% 0px" });

    useEffect(() => {
        if (isInView) setFeatureId(item.id);
    }, [isInView, item.id, setFeatureId]);

    return (
        <motion.div
            ref={ref}
            className={`min-h-[60vh] md:min-h-[80vh] flex flex-col justify-center transition-opacity duration-500 ${isInView ? 'opacity-100' : 'opacity-30'}`}
        >
            <div className={`w-14 h-14 mb-6 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-lg`}>
                <item.icon size={32} weight="fill" />
            </div>
            <h3 className="text-3xl md:text-5xl font-bold text-slate-800 mb-6 leading-tight">
                {item.title}
            </h3>

            {/* Mobile Only Image */}
            <div className="block md:hidden w-full mb-6 rounded-2xl overflow-hidden shadow-lg border border-slate-100">
                <img src={item.image} alt={item.title} className="w-full h-auto object-cover" />
            </div>

            <p className="text-xl text-slate-600 leading-relaxed max-w-md">
                {item.description}
            </p>
        </motion.div>
    );
};

export const StickyScrollFeatures = () => {
    const [featureId, setFeatureId] = useState(1);

    return (
        // Removed overflow-hidden to fix sticky behavior
        <section className="bg-white text-slate-900 py-20 relative" dir="rtl">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row gap-8 lg:gap-20">

                {/* Visual Column - Right Side (Order 1 in RTL) */}
                <div className="hidden md:block w-1/2 relative order-1">
                    <div className="sticky top-1/4 min-h-[50vh] flex items-center justify-center">
                        <div className="relative w-full aspect-[4/3] max-w-[600px] bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 p-2">

                            {/* Browser Mockup Header */}
                            <div className="h-8 bg-slate-50 border-b border-slate-100 flex items-center px-4 gap-2 mb-1 rounded-t-2xl">
                                <div className="w-3 h-3 rounded-full bg-red-400/80"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-400/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400/80"></div>
                                <div className="ml-4 flex-1 bg-white h-5 rounded-md border border-slate-200 shadow-sm opacity-50"></div>
                            </div>

                            <div className="relative h-full w-full bg-slate-50 rounded-xl overflow-hidden shadow-inner border border-slate-100/50">
                                <AnimatePresence mode="wait">
                                    {content.map((item) => (
                                        item.id === featureId && (
                                            <motion.div
                                                key={item.id}
                                                initial={{ opacity: 0, x: 50 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -50 }}
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                                className="absolute inset-0"
                                            >
                                                <img
                                                    src={item.image}
                                                    alt={item.title}
                                                    className="w-full h-full object-cover object-top"
                                                />
                                                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-50 to-transparent"></div>
                                            </motion.div>
                                        )
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Text Column - Left Side (Order 2 in RTL) */}
                <div className="w-full md:w-1/2 py-[10vh] order-2 flex flex-col items-end">
                    {content.map((item) => (
                        <FeatureText key={item.id} item={item} setFeatureId={setFeatureId} />
                    ))}
                </div>

            </div>
        </section>
    );
};
