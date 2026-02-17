import React, { useState } from 'react';
import { Poll, PollQuestion, PollResponse } from '../types';
import { Button } from './ui/Button';
import { Star, CheckCircle, ListBullets, TextAlignLeft, ArrowRight, X, ArrowLeft, CaretLeft } from '@phosphor-icons/react';
import { useToast } from '../contexts/ToastContext';
import { submitPollResponse } from '../services/pollService';
import { useAuth } from '../features/auth/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    poll: Poll;
    onComplete?: () => void;
    onExit?: () => void;
}

export const PollRenderer: React.FC<Props> = ({ poll, onComplete, onExit }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [responses, setResponses] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [direction, setDirection] = useState(1); // 1 for next, -1 for prev

    const questions = poll.config;
    const currentQuestion = questions[currentStep];

    const handleRating = (questionId: string, rating: number) => {
        setResponses(prev => ({ ...prev, [questionId]: rating }));
    };

    const handleChoice = (questionId: string, choice: string) => {
        setResponses(prev => ({ ...prev, [questionId]: choice }));
    };

    const handleText = (questionId: string, text: string) => {
        setResponses(prev => ({ ...prev, [questionId]: text }));
    };

    const goToNext = () => {
        setDirection(1);
        if (currentStep < questions.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleSubmit();
        }
    };

    const goToPrev = () => {
        setDirection(-1);
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleSkip = () => {
        setDirection(1);
        // Clear response for this question if skipping
        setResponses(prev => ({ ...prev, [currentQuestion.id]: undefined }));
        goToNext();
    };

    const handleSubmit = async () => {
        // Validate required questions
        const missingRequired = questions.filter(q => q.required && (responses[q.id] === undefined || responses[q.id] === ''));
        if (missingRequired.length > 0) {
            showToast('אנא מלא את כל שאלות החובה', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await submitPollResponse({
                poll_id: poll.id,
                user_id: user!.id,
                responses: responses
            });
            showToast('התגובה נשלחה בהצלחה!', 'success');
            setIsSubmitted(true);
            setTimeout(() => {
                if (onComplete) onComplete();
            }, 2000);
        } catch (error) {
            console.error('Error submitting poll:', error);
            showToast('שגיאה בשליחת התגובה', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-100"
                >
                    <CheckCircle size={56} weight="fill" />
                </motion.div>
                <motion.h3
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-black text-slate-800 mb-2"
                >
                    תודה על המשוב!
                </motion.h3>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-slate-500 font-bold"
                >
                    התגובה שלך נשמרה במערכת. המידע עוזר לנו להשתפר עבורכם.
                </motion.p>
            </div>
        );
    }

    const isAnswered = responses[currentQuestion.id] !== undefined && responses[currentQuestion.id] !== '';
    const canGoNext = !currentQuestion.required || isAnswered;

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0
        }),
        center: {
            x: 0,
            opacity: 1
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 50 : -50,
            opacity: 0
        })
    };

    return (
        <div className="relative flex flex-col h-full overflow-hidden" dir="rtl">
            {/* Header / Exit */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">סקר פעיל</span>
                    <h2 className="text-lg font-black text-slate-800 leading-tight">{poll.title}</h2>
                </div>
                <button
                    onClick={onExit}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                    <X size={20} weight="bold" />
                </button>
            </div>

            {/* Progress Bar Container */}
            <div className="mb-10 px-1">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">
                        שאלה {currentStep + 1} מתוך {questions.length}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                        {Math.round(((currentStep + 1) / questions.length) * 100)}% הושלם
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-l from-indigo-500 to-blue-600"
                        initial={{ width: 0 }}
                        animate={{ width: `${((currentStep + 1) / questions.length) * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            {/* Question Area */}
            <div className="flex-1 overflow-hidden relative min-h-[320px] md:min-h-[280px]">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentStep}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="absolute inset-0 flex flex-col"
                    >
                        <h3 className="text-xl md:text-2xl font-black text-slate-900 leading-tight mb-8">
                            {currentQuestion.question}
                            {currentQuestion.required && <span className="text-red-500 mr-2 text-sm">* חובה</span>}
                        </h3>

                        <div className="flex-1 overflow-y-auto px-1 custom-scrollbar">
                            {currentQuestion.type === 'rating' && (
                                <div className="flex flex-wrap justify-center gap-2 md:gap-4 py-4">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <motion.button
                                            key={star}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={() => handleRating(currentQuestion.id, star)}
                                            className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex flex-col items-center justify-center transition-all ${responses[currentQuestion.id] >= star
                                                    ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/30'
                                                    : 'bg-white border-2 border-slate-100 text-slate-300 hover:border-amber-200 hover:text-amber-400'
                                                }`}
                                        >
                                            <Star size={32} weight={responses[currentQuestion.id] >= star ? "fill" : "bold"} />
                                            {responses[currentQuestion.id] === star && (
                                                <span className="text-[10px] font-black mt-1 opacity-80">{star}</span>
                                            )}
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {currentQuestion.type === 'choice' && (
                                <div className="grid grid-cols-1 gap-3 py-2">
                                    {currentQuestion.options?.map((option, idx) => (
                                        <motion.button
                                            key={idx}
                                            whileHover={{ x: -4 }}
                                            whileTap={{ scale: 0.99 }}
                                            onClick={() => handleChoice(currentQuestion.id, option)}
                                            className={`w-full px-6 py-4 rounded-2xl border-2 text-right font-black transition-all ${responses[currentQuestion.id] === option
                                                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm shadow-indigo-100'
                                                    : 'border-slate-50 bg-slate-50/50 text-slate-600 hover:border-slate-200 hover:bg-white'
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-4">
                                                <span className="flex-1">{option}</span>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${responses[currentQuestion.id] === option
                                                        ? 'border-indigo-600 bg-indigo-600 text-white'
                                                        : 'border-slate-300 bg-white'
                                                    }`}>
                                                    {responses[currentQuestion.id] === option && <CheckCircle size={14} weight="bold" />}
                                                </div>
                                            </div>
                                        </motion.button>
                                    ))}
                                </div>
                            )}

                            {currentQuestion.type === 'text' && (
                                <div className="py-2">
                                    <textarea
                                        value={responses[currentQuestion.id] || ''}
                                        onChange={e => handleText(currentQuestion.id, e.target.value)}
                                        placeholder="הקלד את תשובתך המפורטת כאן..."
                                        className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] h-40 text-slate-800 font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-slate-300"
                                    />
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Navigation Footer */}
            <div className="pt-8 flex items-center justify-between border-t border-slate-100 mt-auto bg-white/80 backdrop-blur-sm">
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        onClick={goToPrev}
                        disabled={currentStep === 0}
                        className="font-black text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-0"
                    >
                        <ArrowRight className="ml-2" size={18} weight="bold" />
                        הקודם
                    </Button>
                </div>

                <div className="flex gap-3">
                    {!currentQuestion.required && (
                        <Button
                            variant="ghost"
                            onClick={handleSkip}
                            className="font-black text-slate-400 hover:bg-slate-50"
                        >
                            דלג
                        </Button>
                    )}

                    <Button
                        onClick={goToNext}
                        disabled={!canGoNext || isSubmitting}
                        isLoading={isSubmitting}
                        className={`min-w-[150px] font-black shadow-xl transition-all h-14 rounded-2xl ${currentStep === questions.length - 1
                                ? 'bg-green-500 hover:bg-green-600 shadow-green-200'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                            }`}
                        icon={currentStep === questions.length - 1 ? CheckCircle : CaretLeft}
                        iconWeight="bold"
                    >
                        {currentStep === questions.length - 1 ? 'סיים ושלח' : 'לשאלה הבאה'}
                    </Button>
                </div>
            </div>
        </div>
    );
};
