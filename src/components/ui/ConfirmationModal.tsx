import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'אישור',
    cancelText = 'ביטול',
    type = 'warning',
    onConfirm,
    onCancel,
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    if (!isOpen && !isVisible) return null;

    const getColors = () => {
        switch (type) {
            case 'danger':
                return {
                    iconBg: 'bg-red-100',
                    iconColor: 'text-red-600',
                    buttonBg: 'bg-red-600 hover:bg-red-700',
                    buttonRing: 'focus:ring-red-500',
                };
            case 'info':
                return {
                    iconBg: 'bg-blue-100',
                    iconColor: 'text-blue-600',
                    buttonBg: 'bg-blue-600 hover:bg-blue-700',
                    buttonRing: 'focus:ring-blue-500',
                };
            default: // warning
                return {
                    iconBg: 'bg-yellow-100',
                    iconColor: 'text-yellow-600',
                    buttonBg: 'bg-yellow-600 hover:bg-yellow-700',
                    buttonRing: 'focus:ring-yellow-500',
                };
        }
    };

    const colors = getColors();

    if (typeof document === 'undefined') return null;

    return createPortal(
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            ></div>

            {/* Modal */}
            <div className={`bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-200 ${isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className={`flex-shrink-0 w-12 h-12 rounded-full ${colors.iconBg} flex items-center justify-center`}>
                            <AlertTriangle className={`w-6 h-6 ${colors.iconColor}`} />
                        </div>
                        <div className="flex-1 text-right">
                            <h3 className="text-lg font-bold text-slate-900 mb-2">
                                {title}
                            </h3>
                            <p className="text-slate-600 leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-4 flex gap-3">
                    <button
                        onClick={() => {
                            console.log('[ConfirmationModal] Confirm button clicked');
                            onConfirm();
                        }}
                        className={`flex-1 px-4 py-2 rounded-xl text-white font-medium shadow-sm transition-all transform hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 ${colors.buttonBg} ${colors.buttonRing}`}
                    >
                        {confirmText}
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
