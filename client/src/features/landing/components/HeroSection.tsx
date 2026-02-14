import React, { useRef, useState } from 'react';
import { motion, useScroll, useTransform, Variants } from 'framer-motion';
import { CaretRight, Shield, Lightning } from '@phosphor-icons/react';

// --- Animation Variants ---

const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            delayChildren: 0.3,
        },
    },
};

const wordVariants: Variants = {
    hidden: { opacity: 0, y: 20, filter: 'blur(10px)' },
    visible: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: {
            duration: 0.8,
            ease: [0.2, 0.65, 0.3, 0.9],
        },
    },
};

const fadeUpVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.8, ease: "easeOut" }
    }
};

const HeroBadge = () => (
    <motion.div
        variants={fadeUpVariants}
        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-8 backdrop-blur-sm shadow-[0_0_15px_-3px_rgba(139,92,246,0.3)]"
    >
        <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
        </span>
        New Version 2.0
        <div className="w-px h-3 bg-violet-500/30 mx-1" />
        <span className="text-violet-200/70 flex items-center gap-1">
            See what's new <CaretRight size={10} weight="bold" />
        </span>
    </motion.div>
);

const Spotlight = () => (
    <div className="absolute top-0 left-0 right-0 h-[500px] overflow-hidden pointer-events-none z-0">
        <div className="absolute left-1/2 -translate-x-1/2 top-[-200px] w-[1000px] h-[800px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-600/20 via-[#0B0B0F]/0 to-transparent blur-[80px]" />
        <div className="absolute left-1/2 -translate-x-1/2 top-[-300px] w-[600px] h-[600px] bg-indigo-500/10 blur-[100px]" />
    </div>
);

export const HeroSection: React.FC = () => {
    const headlineText = "Command with Absolute Precision.";
    const words = headlineText.split(" ");

    // Mouse move effect for button
    const btnRef = useRef<HTMLButtonElement>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
        const rect = btnRef.current?.getBoundingClientRect();
        if (rect) {
            setMousePosition({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            });
        }
    };

    return (
        <section className="relative pt-32 pb-20 px-6 min-h-[80vh] flex flex-col items-center justify-center text-center z-10">
            <Spotlight />

            <motion.div
                initial="hidden"
                animate="visible"
                viewport={{ once: true }}
                variants={containerVariants}
                className="relative z-10 max-w-5xl mx-auto flex flex-col items-center"
            >
                <HeroBadge />

                {/* Animated H1 */}
                <motion.h1
                    className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.1]"
                    aria-label={headlineText}
                >
                    {words.map((word, i) => (
                        <motion.span
                            key={i}
                            variants={wordVariants}
                            className={`inline-block mr-[0.2em] ${i > 1
                                ? "text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500"
                                : "text-white"
                                }`}
                        >
                            {word}
                        </motion.span>
                    ))}
                </motion.h1>

                <motion.p
                    variants={fadeUpVariants}
                    className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed"
                >
                    Next-generation command and control interface.
                    Orchestrate personnel, logistics, and operations with
                    <span className="text-violet-300 mx-1">AI-driven foresight</span>.
                </motion.p>

                <motion.div
                    variants={fadeUpVariants}
                    className="flex flex-col sm:flex-row items-center gap-6"
                >
                    {/* High-Quality CTA Button with Inner Glow */}
                    <button
                        ref={btnRef}
                        onMouseMove={handleMouseMove}
                        className="group relative h-14 px-8 rounded-full bg-slate-50 overflow-hidden transition-all hover:scale-105 active:scale-95"
                    >
                        <div
                            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                            style={{
                                background: `radial-gradient(150px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(139, 92, 246, 0.15), transparent 80%)`
                            }}
                        />
                        <div className="relative flex items-center gap-3 text-slate-950 font-bold text-lg">
                            <span>Start Deployment</span>
                            <div className="w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center group-hover:translate-x-1 transition-transform">
                                <CaretRight weight="bold" size={14} />
                            </div>
                        </div>
                    </button>

                    {/* Secondary Button */}
                    <button className="h-14 px-8 rounded-full border border-white/10 text-slate-300 font-medium hover:bg-white/5 hover:text-white transition-all hover:border-white/20 flex items-center gap-2">
                        <Shield className="text-violet-500" size={18} weight="bold" />
                        <span>Security Audit</span>
                    </button>
                </motion.div>

            </motion.div>
        </section>
    );
};
