import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Check } from '@phosphor-icons/react';
import { createPortal } from 'react-dom';

export interface TourStep {
    targetId: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
}

interface FeatureTourProps {
    steps: TourStep[];
    tourId: string; // Used to track completion in localStorage
    onStepChange?: (stepIndex: number) => void;
    onComplete?: () => void;
}

export const FeatureTour: React.FC<FeatureTourProps> = ({ steps, tourId, onStepChange, onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [tooltipStyles, setTooltipStyles] = useState({
        left: 0,
        top: 0,
        x: '-50%',
        y: '0%',
        arrowOffset: '50%',
        actualPosition: 'bottom' as 'top' | 'bottom' | 'left' | 'right'
    });

    // Initial check: Has user seen this tour?
    useEffect(() => {
        const hasSeen = localStorage.getItem(`tour_completed_${tourId}`);
        if (!hasSeen) {
            // Delay slightly to ensure elements are rendered
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [tourId]);

    useEffect(() => {
        if (!isVisible) return;

        let intervalId: number;

        const update = () => {
            const step = steps[currentStep];
            if (!step) return;

            const el = document.querySelector(step.targetId);
            if (el) {
                const rect = el.getBoundingClientRect();
                setTargetRect(rect);

                // Calculate position logic
                const screenPadding = 20;
                const tooltipWidth = 320;
                let left = rect.x + rect.width / 2;
                let top = 0;
                let xPerc = -50;
                let yPerc = 0;

                if (step.position === 'bottom') {
                    top = rect.y + rect.height + 20;
                } else if (step.position === 'top') {
                    top = rect.y - 20;
                    yPerc = -100;
                } else if (step.position === 'right') {
                    left = rect.x + rect.width + 20;
                    top = rect.y + rect.height / 2;
                    xPerc = 0;
                    yPerc = -50;
                } else if (step.position === 'left') {
                    left = rect.x - 20;
                    top = rect.y + rect.height / 2;
                    xPerc = -100;
                    yPerc = -50;
                }

                // Horizontal Clamping
                let arrowOffset = 50;
                if (step.position === 'top' || step.position === 'bottom') {
                    const idealLeft = left;
                    const minLeft = tooltipWidth / 2 + screenPadding;
                    const maxLeft = window.innerWidth - tooltipWidth / 2 - screenPadding;
                    left = Math.max(minLeft, Math.min(left, maxLeft));

                    if (left !== idealLeft) {
                        const diff = idealLeft - left;
                        arrowOffset = 50 + (diff / tooltipWidth) * 100;
                        arrowOffset = Math.max(10, Math.min(90, arrowOffset));
                    }
                }

                // Vertical Clamping & Flip Logic
                const estimatedTooltipHeight = 280;
                let actualPosition = step.position || 'bottom';

                if (actualPosition === 'bottom' && (top + estimatedTooltipHeight > window.innerHeight)) {
                    // Flip to Top
                    top = rect.y - 20;
                    yPerc = -100;
                    actualPosition = 'top';
                } else if (actualPosition === 'top' && (top - estimatedTooltipHeight < 0)) {
                    // Flip to Bottom
                    top = rect.y + rect.height + 20;
                    yPerc = 0;
                    actualPosition = 'bottom';
                }

                setTooltipStyles({
                    left,
                    top,
                    x: `${xPerc}%`,
                    y: `${yPerc}%`,
                    arrowOffset: `${arrowOffset}%`,
                    actualPosition
                });
            } else {
                setTargetRect(null);
            }
        };

        update();

        // Polling is essential for elements that might be animating or rendered conditionally
        intervalId = window.setInterval(update, 100);

        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);

        return () => {
            clearInterval(intervalId);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [isVisible, currentStep, steps]);

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            const nextIdx = currentStep + 1;
            setCurrentStep(nextIdx);
            onStepChange?.(nextIdx);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            const prevIdx = currentStep - 1;
            setCurrentStep(prevIdx);
            onStepChange?.(prevIdx);
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        localStorage.setItem(`tour_completed_${tourId}`, 'true');
        onComplete?.();
    };

    const step = steps[currentStep];

    if (!isVisible || !step) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
            {/* Overlay Mask */}
            <AnimatePresence>
                {targetRect && (
                    <motion.svg
                        className="absolute inset-0 w-full h-full pointer-events-auto"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <defs>
                            <mask id="tour-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                <motion.rect
                                    initial={false}
                                    animate={{
                                        x: targetRect.x - 8,
                                        y: targetRect.y - 8,
                                        width: targetRect.width + 16,
                                        height: targetRect.height + 16,
                                        rx: 12
                                    }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                                    fill="black"
                                />
                            </mask>
                        </defs>
                        <rect
                            x="0"
                            y="0"
                            width="100%"
                            height="100%"
                            fill="rgba(15, 23, 42, 0.7)"
                            mask="url(#tour-mask)"
                            onClick={handleComplete}
                        />
                    </motion.svg>
                )}
            </AnimatePresence>

            {/* Tooltip Content */}
            <AnimatePresence mode="wait">
                {targetRect && (
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            left: tooltipStyles.left,
                            top: tooltipStyles.top,
                            x: tooltipStyles.x,
                            y: tooltipStyles.y
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                        className="absolute z-[10000] pointer-events-auto"
                        style={{
                            left: 0,
                            top: 0
                        }}
                    >
                        <div className="bg-white rounded-3xl shadow-2xl p-6 w-80 border border-slate-100 relative group">
                            {/* Connector Arrow */}
                            <div
                                className={`absolute w-4 h-4 bg-white rotate-45 border-slate-100 ${tooltipStyles.actualPosition === 'bottom' ? 'top-[-8px] border-t border-l' :
                                    tooltipStyles.actualPosition === 'top' ? 'bottom-[-8px] border-b border-r' : ''
                                    }`}
                                style={{
                                    left: tooltipStyles.arrowOffset,
                                    transform: 'translateX(-50%) rotate(45deg)'
                                }}
                            />

                            <button
                                onClick={handleComplete}
                                className="absolute top-4 left-4 p-1 hover:bg-slate-50 rounded-full transition-colors text-slate-400"
                            >
                                <X size={16} weight="bold" />
                            </button>

                            <div className="mb-4">
                                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black uppercase tracking-wider mb-2">
                                    <span>שלב {currentStep + 1} מתוך {steps.length}</span>
                                </div>
                                <h4 className="text-lg font-black text-slate-800 leading-tight">{step.title}</h4>
                            </div>

                            <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                                {step.content}
                            </p>

                            <div className="flex items-center justify-between gap-3">
                                {currentStep > 0 ? (
                                    <button
                                        onClick={handleBack}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <ArrowRight size={14} weight="bold" />
                                        חזרה
                                    </button>
                                ) : <div />}

                                <button
                                    onClick={handleNext}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-sm hover:bg-slate-800 transition-all shadow-lg shadow-indigo-500/10 hover:-translate-y-0.5"
                                >
                                    {currentStep === steps.length - 1 ? (
                                        <>סיום הדרכה <Check size={16} weight="bold" /></>
                                    ) : (
                                        <>המשך <ArrowLeft size={16} weight="bold" /></>
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
};
