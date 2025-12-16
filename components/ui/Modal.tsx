import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    scrollableContent?: boolean; // If false, content container will be overflow-hidden (bring your own scroll)
    footer?: React.ReactNode; // Content for sticky footer
}

export const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    scrollableContent = true,
    footer
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
            case 'full': return 'max-w-full m-4';
            default: return 'max-w-lg';
        }
    };

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal */}
            <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90dvh] flex flex-col overflow-hidden transform transition-all duration-200 ${getSizeClasses()} ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-slate-100 flex-shrink-0 bg-white z-10">
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800">{title}</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className={`p-4 md:p-6 ${scrollableContent ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden flex flex-col'} flex-1`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="p-4 md:p-6 border-t border-slate-100 bg-slate-50 flex-shrink-0 rounded-b-2xl">
                        {footer}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
