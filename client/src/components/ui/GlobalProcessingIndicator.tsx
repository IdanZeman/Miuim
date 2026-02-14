import React from 'react';
import { useProcessing } from '@/contexts/ProcessingContext';
import { CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export const GlobalProcessingIndicator: React.FC = () => {
    const { state } = useProcessing();

    if (!state.isProcessing) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
            {/* Top Progress Bar */}
            <div className="h-1 bg-slate-100 w-full overflow-hidden">
                <div
                    className={cn(
                        "h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 transition-all duration-500 ease-out",
                        state.progress === undefined ? "animate-[progress-shimmer_2s_infinite] w-full" : "w-0"
                    )}
                    style={state.progress !== undefined ? { width: `${state.progress}%` } : {}}
                >
                </div>
            </div>

            {/* Floating Status Card */}
            <div className="flex justify-center mt-6">
                <div className="bg-white/90 backdrop-blur-xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-2xl px-6 py-4 flex items-center gap-5 animate-in fade-in slide-in-from-top-4 duration-500 pointer-events-auto">
                    <div className="relative flex items-center justify-center">
                        <CircleNotch size={28} className="text-blue-600 animate-spin" weight="bold" />
                        <div className="absolute inset-0 bg-blue-400 blur-xl opacity-30 animate-pulse" />
                    </div>

                    <div className="flex flex-col min-w-[120px]">
                        <span className="text-sm font-black text-slate-800 leading-tight">
                            {state.message}
                        </span>
                        {state.progress !== undefined && (
                            <div className="mt-1.5 flex flex-col gap-1">
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest leading-none">
                                    {Math.round(state.progress)}% הושלם
                                </span>
                                <div className="h-1 bg-slate-100 rounded-full w-full overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${state.progress}%` }} />
                                </div>
                            </div>
                        )}
                        {state.progress === undefined && (
                            <div className="flex items-center gap-1 mt-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes progress-shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </div>
    );
};
