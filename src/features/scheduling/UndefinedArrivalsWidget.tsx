import React, { useState } from 'react';
import { Warning, CaretDown, CaretUp, ArrowRight } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Person } from '@/types';

export interface UndefinedArrivalIssue {
    person: Person;
    date: Date;
    targetId: string;
}

interface UndefinedArrivalsWidgetProps {
    issues: UndefinedArrivalIssue[];
    idPrefix?: string;
    onIssueClick?: (issue: UndefinedArrivalIssue) => void;
}

export const UndefinedArrivalsWidget: React.FC<UndefinedArrivalsWidgetProps> = ({ issues, idPrefix = '', onIssueClick }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (issues.length === 0) return null;

    const handleScrollTo = (targetId: string) => {
        const el = document.querySelector(targetId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            // Highlight effect could be added here
        }
    };

    return (
        <div className="fixed bottom-20 left-6 z-[900] font-sans rtl">
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="mb-3 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden w-80 max-h-96 flex flex-col"
                    >
                        <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Warning size={18} className="text-amber-600" weight="fill" />
                                <span className="font-black text-amber-900 text-sm">חוסר דיווח שעת הגעה</span>
                            </div>
                            <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {issues.length}
                            </span>
                        </div>

                        <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {issues.map((issue, idx) => (
                                <button
                                    key={`${issue.person.id}-${issue.date.toISOString()}`}
                                    onClick={() => {
                                        if (onIssueClick) {
                                            onIssueClick(issue);
                                        } else {
                                            handleScrollTo(issue.targetId);
                                        }
                                    }}
                                    className="w-full text-right flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all group border border-transparent hover:border-slate-100"
                                >
                                    <div>
                                        <div className="text-sm font-bold text-slate-800">{issue.person.name}</div>
                                        <div className="text-xs text-slate-500">
                                            {issue.date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' })}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                        <ArrowRight size={14} weight="bold" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                layout
                id={`${idPrefix}undefined-arrivals-widget`}
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-white hover:bg-amber-50 text-slate-800 px-4 py-3 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-3 transition-all group"
            >
                <div className="relative">
                    <div className="absolute inset-0 bg-amber-400 rounded-full animate-ping opacity-20" />
                    <div className="bg-amber-100 text-amber-600 w-8 h-8 rounded-full flex items-center justify-center border border-amber-200">
                        <Warning size={16} weight="fill" />
                    </div>
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                        {issues.length}
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-xs font-black text-slate-900 leading-none mb-0.5">נדרשת תשומת לב</div>
                    <div className="text-[10px] font-bold text-slate-400">הגדרת שעות הגעה חסרות</div>
                </div>

                <div className={`mr-2 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <CaretUp size={14} weight="bold" className="text-slate-400 group-hover:text-amber-600" />
                </div>
            </motion.button>
        </div>
    );
};
