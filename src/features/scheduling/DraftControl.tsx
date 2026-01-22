import React from 'react';
import { Button } from '@/components/ui/Button';
import { Warning as AlertTriangle, Trash as Trash2, FloppyDisk as Save, X, Flask } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface DraftControlProps {
    isVisible: boolean;
    changeCount: number;
    onPublish: () => void;
    onDiscard: () => void;
    isPublishing: boolean;
    onExit: () => void; // Added onExit to allow closing the mode cleanly
}

export const DraftControl: React.FC<DraftControlProps> = ({
    isVisible,
    changeCount,
    onPublish,
    onDiscard,
    isPublishing,
    onExit
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">

                    {/* Status Capsule */}
                    <motion.div
                        initial={{ y: 100, opacity: 0, scale: 0.9 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 100, opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        className="pointer-events-auto bg-slate-900/95 backdrop-blur-md text-white p-2 pl-3 pr-2 rounded-full shadow-2xl shadow-blue-900/40 border border-slate-700/50 flex items-center gap-3 md:gap-4 max-w-[95vw] overflow-hidden"
                    >
                        {/* Icon & Label */}
                        <div className="flex items-center gap-3 pl-2 border-l border-slate-700/50">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500 rounded-full blur-md opacity-50 animate-pulse" />
                                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-full w-8 h-8 flex items-center justify-center relative shadow-lg shadow-blue-500/30">
                                    <Flask size={16} weight="fill" className="text-white" />
                                </div>
                                {/* Change Count Badge */}
                                {changeCount > 0 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-slate-900">
                                        {changeCount}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="font-bold text-sm leading-none text-white">מצב טיוטה</span>
                                <span className="text-[10px] font-medium text-slate-400">
                                    {changeCount === 0 ? 'אין שינויים שממתינים לשמירה' :
                                        changeCount === 1 ? 'שינוי אחד ממתין' :
                                            `${changeCount} שינויים ממתינים לשמירה`}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            {changeCount > 0 ? (
                                <>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={onDiscard}
                                        disabled={isPublishing}
                                        className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full px-3 h-8 text-xs font-bold"
                                    >
                                        ביטול
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={onPublish}
                                        isLoading={isPublishing}
                                        className="bg-white text-slate-900 hover:bg-blue-50 border-transparent rounded-full px-4 h-8 text-xs font-black shadow-lg shadow-white/10"
                                    >
                                        <Save size={14} className="ml-1.5" weight="bold" />
                                        שמור שינויים
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={onExit}
                                    className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 p-0 flex items-center justify-center"
                                    title="יציאה ממצב טיוטה"
                                >
                                    <X size={16} weight="bold" />
                                </Button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
