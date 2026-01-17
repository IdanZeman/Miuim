import React from 'react';
import { Warning as AlertTriangle, Info, WarningCircle as ShieldAlert } from '@phosphor-icons/react';
import { GenericModal } from './GenericModal';
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
    disabled?: boolean;
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
    children,
    disabled = false
}) => {
    // Colors and Icons mapping
    const getConfig = () => {
        switch (type) {
            case 'danger':
                return {
                    icon: <ShieldAlert size={28} weight="duotone" />,
                    iconBg: 'bg-red-50',
                    iconColor: 'text-red-600',
                    buttonVariant: 'danger' as const,
                };
            case 'info':
                return {
                    icon: <Info size={28} weight="duotone" />,
                    iconBg: 'bg-blue-50',
                    iconColor: 'text-blue-600',
                    buttonVariant: 'primary' as const,
                };
            default: // warning
                return {
                    icon: <AlertTriangle size={28} weight="duotone" />,
                    iconBg: 'bg-amber-50',
                    iconColor: 'text-amber-600',
                    buttonVariant: 'primary' as const,
                };
        }
    };

    const config = getConfig();

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onCancel}
            title={
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${config.iconBg} ${config.iconColor} flex items-center justify-center shrink-0`}>
                        {config.icon}
                    </div>
                    <span>{title}</span>
                </div>
            }
            footer={
                <div className="flex gap-3 w-full">
                    <Button
                        variant="ghost"
                        onClick={onCancel}
                        disabled={disabled}
                        className="flex-1 font-bold text-slate-500 hover:text-slate-700 h-12 rounded-xl"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        variant={config.buttonVariant}
                        onClick={onConfirm}
                        disabled={disabled}
                        className="flex-1 h-12 rounded-xl text-base font-bold shadow-lg"
                    >
                        {confirmText}
                    </Button>
                </div>
            }
            size="sm"
            closeIcon="none" // Standard confirmation usually doesn't need an X if it has massive buttons
        >
            <div className="text-slate-600 font-medium leading-relaxed text-base pt-2">
                {children ? children : message}
            </div>
        </GenericModal>
    );
};
