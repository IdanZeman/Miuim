import React from 'react';
import { Button } from '@/components/ui/Button';
import { Warning as AlertTriangle, CheckCircle, Trash as Trash2, FloppyDisk as Save, X } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

interface DraftBannerProps {
    isVisible: boolean;
    changeCount: number;
    onPublish: () => void;
    onDiscard: () => void;
    isPublishing: boolean;
}

export const DraftBanner: React.FC<DraftBannerProps> = ({
    isVisible,
    changeCount,
    onPublish,
    onDiscard,
    isPublishing
}) => {
    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="bg-blue-600 border-b border-blue-500 overflow-hidden sticky top-0 z-[60]"
                >
                    <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg">
                                <AlertTriangle size={18} className="text-white" weight="bold" />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-sm leading-tight">מצב טיוטה פעיל</h3>
                                <p className="text-blue-100 text-[10px] font-bold uppercase tracking-wider">
                                    ישנם {changeCount} שינויים שממתינים לפרסום
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDiscard}
                                disabled={isPublishing}
                                className="text-white hover:bg-white/10 border-transparent text-xs font-black"
                            >
                                <Trash2 size={16} className="ml-1.5" />
                                בטל שינויים
                            </Button>
                            <Button
                                size="sm"
                                onClick={onPublish}
                                isLoading={isPublishing}
                                className="bg-white text-blue-600 hover:bg-blue-50 border-white shadow-lg shadow-blue-900/20 text-xs font-black"
                            >
                                <Save size={16} className="ml-1.5" />
                                פרסם ללוח
                            </Button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
