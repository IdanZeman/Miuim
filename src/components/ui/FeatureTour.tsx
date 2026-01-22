import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTourStore } from '../../stores/tourStore';
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
        actualPosition: 'bottom' as 'top' | 'bottom' | 'left' | 'right',
        width: 320
    });

    // Initial check: Has user seen this tour?
    const { activeTourId, registerTour, completeTour, skipTour } = useTourStore();

    // Register tour on mount
    useEffect(() => {
        registerTour(tourId);
    }, [tourId, registerTour]);

    // React to active state from store
    useEffect(() => {
        if (activeTourId === tourId) {
            // Small delay to ensure UI is ready
            const timer = setTimeout(() => setIsVisible(true), 500);
            return () => clearTimeout(timer);
        } else {
            setIsVisible(false);
        }
    }, [activeTourId, tourId]);

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
                // Calculate position logic
                const screenPadding = 16;
                const tooltipWidth = Math.min(320, window.innerWidth - (screenPadding * 2)); // Responsive width
                const estimatedTooltipHeight = 200; // Approximate

                let actualPosition = step.position || 'bottom';

                // Smart Flip Logic
                // validSpace checks if there is enough room for the tooltip in a given direction
                const validSpace = {
                    top: rect.y > estimatedTooltipHeight + 20,
                    bottom: (window.innerHeight - (rect.y + rect.height)) > estimatedTooltipHeight + 20,
                    left: rect.x > tooltipWidth + 20,
                    right: (window.innerWidth - (rect.x + rect.width)) > tooltipWidth + 20
                };

                // 1. Forced Flip if out of bounds
                if (actualPosition === 'left' && !validSpace.left) {
                    actualPosition = validSpace.right ? 'right' : 'bottom';
                } else if (actualPosition === 'right' && !validSpace.right) {
                    actualPosition = validSpace.left ? 'left' : 'bottom';
                } else if (actualPosition === 'top' && !validSpace.top) {
                    actualPosition = validSpace.bottom ? 'bottom' : 'bottom'; // Fallback to bottom usually safest
                } else if (actualPosition === 'bottom' && !validSpace.bottom) {
                    actualPosition = validSpace.top ? 'top' : 'top';
                }

                // 2. Calculate Coordinates based on FINAL position
                let left = 0;
                let top = 0;
                let xPerc = 0;
                let yPerc = 0;
                let arrowOffset = 50;

                if (actualPosition === 'bottom') {
                    left = rect.x + rect.width / 2;
                    top = rect.y + rect.height + 16;
                    xPerc = -50;
                    yPerc = 0;
                } else if (actualPosition === 'top') {
                    left = rect.x + rect.width / 2;
                    top = rect.y - 16;
                    xPerc = -50;
                    yPerc = -100;
                } else if (actualPosition === 'right') {
                    left = rect.x + rect.width + 16;
                    top = rect.y + rect.height / 2;
                    xPerc = 0;
                    yPerc = -50;
                } else if (actualPosition === 'left') {
                    left = rect.x - 16;
                    top = rect.y + rect.height / 2;
                    xPerc = -100;
                    yPerc = -50;
                }

                // 3. Clamping (Keep it on screen)
                // Horizontal Clamping for Top/Bottom positions
                if (actualPosition === 'top' || actualPosition === 'bottom') {
                    const idealLeft = left;
                    const minLeft = (tooltipWidth / 2) + screenPadding;
                    const maxLeft = window.innerWidth - (tooltipWidth / 2) - screenPadding;
                    left = Math.max(minLeft, Math.min(left, maxLeft));

                    // Adjust arrow to point to target if we shifted the body
                    if (left !== idealLeft) {
                        const diff = idealLeft - left; // How much we shifted relative to center
                        // arrowOffset is percentage. Center is 50%.
                        // If we shifted LEFT (diff positive), arrow needs to move RIGHT (add)
                        arrowOffset = 50 + (diff / tooltipWidth) * 100;
                        arrowOffset = Math.max(10, Math.min(90, arrowOffset));
                    }
                }

                // Vertical Clamping for Left/Right positions
                if (actualPosition === 'left' || actualPosition === 'right') {
                    const idealTop = top;
                    const minTop = (estimatedTooltipHeight / 2) + screenPadding;
                    const maxTop = window.innerHeight - (estimatedTooltipHeight / 2) - screenPadding;
                    top = Math.max(minTop, Math.min(top, maxTop));

                    if (top !== idealTop) {
                        const diff = idealTop - top;
                        arrowOffset = 50 + (diff / estimatedTooltipHeight) * 100;
                        arrowOffset = Math.max(10, Math.min(90, arrowOffset));
                    }
                }

                // Extra Safe Guard for Mobile Width
                const finalTooltipWidth = Math.min(320, window.innerWidth - 32);

                setTooltipStyles({
                    left,
                    top,
                    x: `${xPerc}%`,
                    y: `${yPerc}%`,
                    arrowOffset: `${arrowOffset}%`,
                    actualPosition,
                    width: finalTooltipWidth
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
        completeTour(tourId);
        onComplete?.();
    };

    const handleSkip = () => {
        setIsVisible(false);
        skipTour(tourId);
        onComplete?.(); // Treat skip as complete for callback purposes usually
    };

    const step = steps[currentStep];

    if (!isVisible || !step) return null;

    return createPortal(
        <div className="fixed inset-0 z-[10000000] pointer-events-none overflow-hidden">
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
                            onClick={handleSkip}
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
                        <div
                            className="bg-white rounded-3xl shadow-2xl p-6 border border-slate-100 relative group"
                            style={{ width: tooltipStyles.width }}
                        >
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
                                onClick={handleSkip}
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
