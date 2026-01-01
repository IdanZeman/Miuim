import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, DeviceMobile, ListChecks, CarProfile, UsersThree, ArrowsClockwise } from '@phosphor-icons/react';

interface BentoCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    className?: string;
    graphic?: React.ReactNode;
}

const BentoCard: React.FC<BentoCardProps> = ({ title, description, icon: Icon, className = "", graphic }) => {
    return (
        <motion.div
            whileHover={{ y: -2 }}
            className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}
        >
            <div className="relative z-10 flex h-full flex-col justify-between gap-2">
                <div>
                    <div className="mb-2 inline-flex rounded-lg bg-blue-50 p-2 text-blue-600">
                        <Icon size={20} weight="duotone" />
                    </div>
                    <h3 className="mb-1 text-lg font-bold text-slate-800">{title}</h3>
                    <p className="text-sm leading-tight text-slate-500">{description}</p>
                </div>

                {graphic && (
                    <div className="mt-3 flex items-center justify-center rounded-lg overflow-hidden border border-slate-100 shadow-inner bg-slate-50 relative group">
                        {graphic}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

// Ultra Compact version
export const BentoGrid: React.FC = () => {
    return (
        <section className="bg-slate-50 px-4 py-8 scroll-mt-32" dir="rtl" id="features">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6 text-center">
                    <h2 className="text-2xl font-black text-slate-900 md:text-3xl">כל הכלים שהמפקד צריך</h2>
                    <p className="mt-1 text-lg text-slate-500 max-w-xl mx-auto">מעטפת שלמה לניהול מהש"ג ועד המרפאה.</p>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4 md:auto-rows-[14rem]">

                    {/* Col 1 (Right): Requests (Tall) */}
                    <BentoCard
                        title="ניהול אישורים"
                        description="בקשות יציאה, תורים לרופא, הכל במקום אחד."
                        icon={ListChecks}
                        className="md:col-span-1 md:row-span-2"
                        graphic={
                            <div className="w-full h-full relative min-h-[300px]">
                                <img
                                    src="/landing/requests.webp"
                                    alt="Requests Interface"
                                    className="absolute inset-0 w-full h-full object-cover object-top"
                                />
                            </div>
                        }
                    />

                    {/* Col 2 (Middle): Rota Generator (Tall) - NEW */}
                    <BentoCard
                        title="מחולל סבבים"
                        description="יצירת סבבי יציאות אוטומטית לפי בקשות."
                        icon={ArrowsClockwise}
                        className="md:col-span-1 md:row-span-2"
                        graphic={
                            <div className="w-full h-full relative min-h-[300px]">
                                <img
                                    src="/landing/rota-generator.webp"
                                    alt="Rota Generator"
                                    className="absolute inset-0 w-full h-full object-cover object-left-top"
                                />
                            </div>
                        }
                    />

                    {/* Col 3 (Left): Gate Control & Fairness (Stacked) */}
                    <div className="flex flex-col gap-3 md:col-span-1 md:row-span-2">
                        {/* Gate Control */}
                        <BentoCard
                            title="בקרת שער"
                            description="רישום כניסות דיגיטלי."
                            icon={CarProfile}
                            className="flex-1"
                            graphic={
                                <div className="w-full h-16 overflow-hidden relative">
                                    <img src="/landing/gate-control.webp" alt="Gate" className="w-full h-full object-cover opacity-90" />
                                </div>
                            }
                        />
                        {/* Fairness */}
                        <BentoCard
                            title="הוגנות ושקיפות"
                            description="שיבוץ הוגן לכולם."
                            icon={UsersThree}
                            className="flex-1"
                            graphic={
                                <div className="w-full bg-slate-50 p-3 h-16 flex items-center gap-2">
                                    <div className="flex-1 h-2 bg-blue-500 rounded-full"></div>
                                    <div className="flex-1 h-2 bg-blue-500 rounded-full"></div>
                                </div>
                            }
                        />
                    </div>

                </div>
            </div>
        </section>
    );
};
