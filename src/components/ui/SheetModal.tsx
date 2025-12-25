import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ArrowRight } from 'lucide-react';
import { Button } from './Button';

interface SheetModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    isSaving?: boolean;
    saveLabel?: string;
    onSave?: () => void;
    zIndex?: number;
    closeIcon?: 'close' | 'back';
}

export const SheetModal: React.FC<SheetModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    isSaving = false,
    saveLabel = 'שמור',
    onSave,
    zIndex = 100,
    closeIcon = 'close'
}) => {
    const [shouldRender, setShouldRender] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            document.body.style.overflow = 'hidden';
        } else {
            const timer = setTimeout(() => setShouldRender(false), 300); // Wait for animation
            document.body.style.overflow = '';
            return () => clearTimeout(timer);
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!shouldRender) return null;

    return createPortal(
        <div
            className={`fixed inset-0 flex flex-col justify-end md:justify-center md:items-center transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{ zIndex }}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Sheet Container */}
            <div className={`bg-slate-50 w-full h-auto max-h-[85vh] md:max-h-[85vh] md:max-w-lg md:rounded-2xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden relative z-10 transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0 md:scale-100' : 'translate-y-full md:translate-y-0 md:scale-95'}`}>

                {/* Header */}
                <div className="bg-white px-4 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 sticky top-0 z-20">
                    {closeIcon === 'back' ? (
                        <button onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                            <ArrowRight size={24} />
                        </button>
                    ) : (
                        <div className="w-10" />
                    )}

                    <h2 className="text-lg font-bold text-slate-800">{title}</h2>

                    {closeIcon === 'close' ? (
                        <button onClick={onClose} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
                            <X size={24} />
                        </button>
                    ) : (
                        <div className="w-10" />
                    )}
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-8 md:pb-6" dir="rtl">
                    {children}
                </div>

                {/* Sticky Footer */}
                {(footer || onSave) && (
                    <div className="bg-white border-t border-slate-100 p-4 shrink-0 pb-8 md:pb-6 sticky bottom-0 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        {footer ? footer : (
                            <Button
                                onClick={onSave}
                                disabled={isSaving}
                                className="w-full h-12 text-lg font-bold rounded-xl shadow-md bg-idf-yellow hover:bg-yellow-400 text-slate-900"
                            >
                                {isSaving ? <Loader2 className="animate-spin" /> : saveLabel}
                            </Button>
                        )}
                    </div>
                )}

            </div>
        </div>,
        document.body
    );
};
