import React from 'react';
import { createPortal } from 'react-dom';
import { Button, ButtonVariant } from './Button';
import { Icon } from '@phosphor-icons/react';

interface FloatingActionButtonProps {
    icon: Icon;
    onClick: () => void;
    ariaLabel: string;
    show?: boolean;
    variant?: ButtonVariant;
    className?: string;
    iconWeight?: "bold" | "duotone" | "fill" | "light" | "regular" | "thin";
}

/**
 * Standardized Floating Action Button (FAB)
 * 
 * Consistent size: 64x64px (w-16 h-16)
 * Consistent position: bottom-24 left-6 (96px from bottom, 24px from left)
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
    icon,
    onClick,
    ariaLabel,
    show = true,
    variant = "action",
    className = "",
    iconWeight
}) => {
    if (!show) return null;

    return createPortal(
        <Button
            variant={variant}
            size="icon"
            icon={icon}
            iconWeight={iconWeight}
            onClick={onClick}
            className={`fixed bottom-24 md:bottom-12 left-6 md:left-12 2xl:left-[calc(50%-640px+48px)] z-50 !w-16 !h-16 !rounded-full shadow-xl shadow-slate-900/20 hover:scale-110 active:scale-95 transition-all border-2 border-white/20 ${className}`}
            aria-label={ariaLabel}
        />,
        document.body
    );
};
