import React from 'react';
import { Users, ClipboardText, Shield, ArrowLeft, Plus, FileXls, Sparkle, CheckCircle } from '@phosphor-icons/react';
import { motion } from 'framer-motion';

interface EmptyStateGuideProps {
    hasTasks: boolean;
    hasPeople: boolean;
    hasRoles: boolean;
    onNavigate: (view: 'personnel' | 'tasks', tab?: 'people' | 'roles' | 'teams') => void;
    onImport: () => void;
}

const IconBadge: React.FC<{
    imageSrc: string;
    isActive: boolean;
}> = ({ imageSrc, isActive }) => {
    return (
        <div className="relative group">
            {/* Ambient Glow */}
            <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 opacity-20 ${isActive ? 'bg-blue-400 group-hover:opacity-40 scale-125' : 'bg-slate-200 opacity-0'}`} />

            {/* Glass Container */}
            <motion.div
                className={`w-40 h-40 flex items-center justify-center relative z-10 transition-all duration-500
                    ${isActive ? 'scale-100' : 'opacity-40 grayscale'}`}
                whileHover={isActive ? { scale: 1.05 } : {}}
            >
                <motion.img
                    src={imageSrc}
                    alt="Section Icon"
                    animate={isActive ? {
                        scale: [1, 1.02, 1],
                    } : {}}
                    transition={{
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="w-full h-full object-contain transition-all duration-500 mix-blend-multiply"
                />
            </motion.div>
        </div>
    );
};

export const EmptyStateGuide: React.FC<EmptyStateGuideProps> = ({ hasTasks, hasPeople, hasRoles, onNavigate, onImport }) => {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.15
            }
        }
    } as const;

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: {
            opacity: 1,
            y: 0,
            transition: {
                type: "spring" as const,
                stiffness: 100
            }
        }
    } as const;

    return (
        <div className="w-full">
            <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10"
            >
                {/* Step 1: Roles */}
                <motion.div variants={item} className="h-full">
                    <div className={`h-full p-6 rounded-[2.5rem] border-2 transition-all duration-500 bg-white relative group flex flex-col ${!hasRoles ? 'border-blue-500 shadow-[0_30px_60px_rgba(59,130,246,0.12)] scale-105 ring-8 ring-blue-50/50' : 'border-slate-100 opacity-60'}`}>
                        <div className="mb-2 flex justify-center">
                            <IconBadge imageSrc="/onBoarding/rules.png" isActive={!hasRoles} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2 text-center">1. הגדרת תפקידים</h3>
                        <p className="text-slate-500 font-medium mb-4 leading-relaxed text-center px-4">
                            הגדר את התפקידים השונים בפלוגה. השלב הראשון בבניית כוח האדם.
                        </p>

                        <div className="mt-auto">
                            {!hasRoles ? (
                                <motion.button
                                    onClick={() => onNavigate('personnel', 'roles')}
                                    whileHover={{ scale: 1.02, backgroundColor: "#2563eb" }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 group shadow-[0_10px_30px_rgba(15,23,42,0.15)] hover:shadow-blue-500/20"
                                >
                                    הגדר תפקידים
                                    <Plus size={20} weight="bold" className="group-hover:rotate-90 transition-transform" />
                                </motion.button>
                            ) : (
                                <div className="flex items-center justify-center gap-3 text-emerald-600 font-black bg-emerald-50 py-4 rounded-2xl border border-emerald-100">
                                    <CheckCircle size={24} weight="fill" />
                                    <span>בוצע בהצלחה</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Step 2: People */}
                <motion.div variants={item} className="h-full">
                    <div className={`h-full p-6 rounded-[2.5rem] border-2 transition-all duration-500 bg-white relative group flex flex-col ${!hasPeople ? 'border-blue-500 shadow-[0_30px_60px_rgba(59,130,246,0.12)] scale-105 ring-8 ring-blue-50/50' : 'border-slate-100 opacity-60'}`}>
                        <div className="mb-2 flex justify-center">
                            <IconBadge imageSrc="/onBoarding/people.png" isActive={!hasPeople} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2 text-center">2. מצבת כוח אדם</h3>
                        <p className="text-slate-500 font-medium mb-4 leading-relaxed text-center px-4">
                            הזן את החיילים והחיילות שלך. שייך אותם לצוותים והענק להם תפקידים.
                        </p>

                        <div className="mt-auto">
                            {!hasPeople ? (
                                <motion.button
                                    onClick={() => onNavigate('personnel', 'people')}
                                    whileHover={{ scale: 1.02, backgroundColor: "#2563eb" }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 group shadow-[0_10px_30px_rgba(15,23,42,0.15)] hover:shadow-blue-500/20"
                                >
                                    הוסף חיילים
                                    <Plus size={20} weight="bold" className="group-hover:rotate-90 transition-transform" />
                                </motion.button>
                            ) : (
                                <div className="flex items-center justify-center gap-3 text-emerald-600 font-black bg-emerald-50 py-4 rounded-2xl border border-emerald-100">
                                    <CheckCircle size={24} weight="fill" />
                                    <span>בוצע בהצלחה</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>

                {/* Step 3: Tasks */}
                <motion.div variants={item} className="h-full">
                    <div className={`h-full p-6 rounded-[2.5rem] border-2 transition-all duration-500 bg-white relative group flex flex-col ${!hasTasks ? 'border-blue-500 shadow-[0_30px_60px_rgba(59,130,246,0.12)] scale-105 ring-8 ring-blue-50/50' : 'border-slate-100 opacity-60'}`}>
                        <div className="mb-2 flex justify-center">
                            <IconBadge imageSrc="/onBoarding/tasks.png" isActive={!hasTasks} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-2 text-center">3. שגרת פעילות</h3>
                        <p className="text-slate-500 font-medium mb-4 leading-relaxed text-center px-4">
                            הגדר את המשימות, השמירות והסיורים. קבע דרישות ואילוצים.
                        </p>

                        <div className="mt-auto">
                            {!hasTasks ? (
                                <motion.button
                                    onClick={() => onNavigate('tasks')}
                                    whileHover={{ scale: 1.02, backgroundColor: "#2563eb" }}
                                    whileTap={{ scale: 0.98 }}
                                    className="w-full py-4 px-6 bg-slate-900 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 group shadow-[0_10px_30px_rgba(15,23,42,0.15)] hover:shadow-blue-500/20"
                                >
                                    בניית משימות
                                    <Plus size={20} weight="bold" className="group-hover:rotate-90 transition-transform" />
                                </motion.button>
                            ) : (
                                <div className="flex items-center justify-center gap-3 text-emerald-600 font-black bg-emerald-50 py-4 rounded-2xl border border-emerald-100">
                                    <CheckCircle size={24} weight="fill" />
                                    <span>בוצע בהצלחה</span>
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            {/* Parallel Option: Import - Advanced Gradient Hero */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
                className="mt-8 w-full rounded-[2.5rem] overflow-hidden relative group"
            >
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 to-blue-900 transition-all duration-500 group-hover:scale-[1.02]" />
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.4),transparent)]" />

                <div className="relative p-10 md:p-14 flex flex-col md:flex-row items-center justify-between gap-10">
                    <div className="flex items-center gap-10 relative z-10 text-right w-full md:w-auto">
                        <div className="hidden md:flex w-36 h-36 bg-white/10 backdrop-blur-md rounded-[2.5rem] items-center justify-center shrink-0 border border-white/20 shadow-2xl">
                            <FileXls size={64} weight="duotone" className="text-white drop-shadow-lg" />
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 text-blue-300 font-black text-sm uppercase tracking-[0.2em]">
                                <Sparkle size={20} weight="fill" className="text-yellow-400" />
                                ייבוא נתונים מהיר
                            </div>
                            <h3 className="text-4xl font-black text-white">יש לך כבר רשימות באקסל?</h3>
                            <p className="text-blue-50/70 text-xl font-medium max-w-xl">
                                חסוך זמן יקר וייבא את כל הנתונים במכה אחת. מהיר, קל ואינטואיטיבי.
                            </p>
                        </div>
                    </div>

                    <motion.button
                        onClick={onImport}
                        whileHover={{ scale: 1.02, backgroundColor: "#2563eb" }}
                        whileTap={{ scale: 0.98 }}
                        className="relative z-10 whitespace-nowrap px-12 py-6 bg-slate-900 text-white rounded-3xl font-black text-2xl transition-all flex items-center gap-5 group overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                        <ArrowLeft size={28} weight="bold" className="group-hover:translate-x-[-8px] transition-transform" />
                        התחל ייבוא חכם
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};
