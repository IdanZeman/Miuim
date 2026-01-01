import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from '@phosphor-icons/react';

export interface GenericModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    footer?: React.ReactNode;
    // Actions shown in the header, usually to the left of the close button
    headerActions?: React.ReactNode;
    closeIcon?: 'close' | 'back' | 'none';
    className?: string;
    // Specific design triggers
    scrollableContent?: boolean;
    hideDefaultHeader?: boolean;
}

export const GenericModal: React.FC<GenericModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    footer,
    headerActions,
    closeIcon = 'close',
    className = '',
    scrollableContent = true,
    hideDefaultHeader = false,
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
        } else {
            setIsVisible(false);
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!mounted) return null;
    if (!isOpen && !isVisible) return null;

    const getSizeClasses = () => {
        switch (size) {
            // Apply max-width only on desktop (md:). On mobile, we want full width (bottom sheet style).
            case 'sm': return 'md:max-w-md';
            case 'md': return 'md:max-w-lg';
            case 'lg': return 'md:max-w-2xl';
            case 'xl': return 'md:max-w-4xl';
            case '2xl': return 'md:max-w-6xl';
            case 'full': return 'max-w-full md:max-w-7xl md:m-4';
            default: return 'md:max-w-lg';
        }
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-end md:items-center justify-center transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className={`
                bg-white 
                md:rounded-2xl rounded-t-[2.5rem] 
                shadow-2xl 
                w-full 
                flex flex-col 
                overflow-hidden 
                transform transition-all duration-300 ease-out
                ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-full md:translate-y-4 md:scale-95'}
                ${size === 'full' ? 'h-[92vh] md:h-[90vh]' : 'max-h-[85vh]'}
                ${getSizeClasses()}
                ${className}
            `}>
                {/* 1. Header (Sticky) */}
                {!hideDefaultHeader && (
                    <div className="flex items-center justify-between gap-4 p-4 md:p-6 border-b border-slate-100 bg-white z-10 shrink-0">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {closeIcon === 'back' && (
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                                >
                                    <ArrowRight size={24} weight="duotone" />
                                </button>
                            )}

                            {/* Typography Enforcement */}
                            {typeof title === 'string' ? (
                                <h2 className="text-xl md:text-2xl font-bold text-slate-800 truncate">
                                    {title}
                                </h2>
                            ) : (
                                <div className="text-xl md:text-2xl font-bold text-slate-800 truncate">
                                    {title}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {headerActions && (
                                <div className="flex items-center gap-2 border-l border-slate-100 pl-2 ml-1">
                                    {headerActions}
                                </div>
                            )}

                            {closeIcon === 'close' && (
                                <button
                                    onClick={onClose}
                                    className="p-2.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all active:scale-90 bg-slate-50"
                                    aria-label="Close"
                                >
                                    <X size={22} weight="bold" />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* 2. Main Content (Body) */}
                <div className={`
                    p-4 md:p-6 
                    bg-white 
                    flex-1 
                    ${scrollableContent ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden flex flex-col'}
                `}>
                    {children}
                </div>

                {/* 3. Footer (Sticky) */}
                {footer && (
                    <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl z-10">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
