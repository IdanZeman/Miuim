import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    scrollableContent?: boolean; // If false, content container will be overflow-hidden (bring your own scroll)
    footer?: React.ReactNode; // Content for sticky footer
    headerActions?: React.ReactNode; // Content to show next to close button
    closeIcon?: 'close' | 'back' | 'none';
    hideDefaultHeader?: boolean;
    className?: string; // Additional classes for the modal container
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    scrollableContent = true,
    footer,
    headerActions,
    closeIcon = 'close',
    hideDefaultHeader = false,
    className = ''
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
            case 'sm': return 'max-w-md';
            case 'md': return 'max-w-lg';
            case 'lg': return 'max-w-2xl';
            case 'xl': return 'max-w-4xl';
            case '2xl': return 'max-w-6xl';
            case 'full': return 'max-w-full md:max-w-7xl md:m-4';
            default: return 'max-w-lg';
        }
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-end md:items-center justify-center transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className={`
                bg-white md:rounded-2xl rounded-t-[2.5rem] shadow-2xl w-full 
                flex flex-col overflow-hidden transform transition-all duration-300 ease-out
                ${size === 'full' ? 'h-[92dvh] md:h-[90dvh]' : 'max-h-[85dvh]'}
                ${getSizeClasses()} 
                ${isOpen ? 'translate-y-0 scale-100' : 'translate-y-full md:translate-y-4 md:scale-95'}
                ${className}
            `}>
                {/* Header */}
                {!hideDefaultHeader && (
                    <div className="flex items-center justify-between gap-4 p-4 md:p-6 border-b border-slate-100 flex-shrink-0 bg-white z-10">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {closeIcon === 'back' && (
                                <button
                                    onClick={onClose}
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors shrink-0"
                                >
                                    <ArrowRight size={24} />
                                </button>
                            )}

                            <div className="text-xl md:text-2xl font-bold text-slate-800 truncate">
                                {title}
                            </div>
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
                                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:scale-90"
                                >
                                    <X size={26} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className={`p-4 md:p-6 ${scrollableContent ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden flex flex-col'} flex-1`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
                        <div className="flex items-center justify-between gap-3">
                            {footer}
                        </div>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
