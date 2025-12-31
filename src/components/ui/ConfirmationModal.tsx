import React, { useEffect, useState } from 'react';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel: () => void;
    children?: React.ReactNode;
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
    children
}) => {
    // Colors and Icons mapping
    const getConfig = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: <ShieldAlert size={24} strokeWidth={2.5} />,
                    iconBg: 'bg-red-50',
                    iconColor: 'text-red-600',
                    buttonVariant: 'danger' as const,
                };
            case 'info':
                return {
                    icon: <Info size={24} strokeWidth={2.5} />,
                    iconBg: 'bg-blue-50',
                    iconColor: 'text-blue-600',
                    buttonVariant: 'primary' as const,
                };
            default: // warning
                return {
                    icon: <AlertTriangle size={24} strokeWidth={2.5} />,
                    iconBg: 'bg-amber-50',
                    iconColor: 'text-amber-600',
                    buttonVariant: 'primary' as const, // Or specific 'warning' variant if available, sticking to primary/destructive usually
                };
        }
    };

    const config = getConfig();

    return (
        <Modal
            isOpen={isOpen}
            onClose={onCancel}
            title={
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0`}>
                        {config.icon}
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{title}</h2>
                    </div>
                </div>
            }
            footer={
                <div className="flex gap-3 w-full">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        className="flex-1 font-bold text-slate-500 hover:text-slate-700"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={config.buttonVariant}
                        onClick={onConfirm}
                        className={`flex-1 shadow-lg ${type === 'danger' ? 'shadow-red-200' : 'shadow-indigo-200'} ${type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white' : ''}`}
                    >
                        {confirmText}
                    </Button>
                </div>
            }
            size="sm"
        >
            <div className="text-slate-600 font-medium leading-relaxed">
                {children ? children : message}
            </div>
        </Modal>
    );
};
