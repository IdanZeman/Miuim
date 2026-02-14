import React from 'react';
import { Icon } from '@phosphor-icons/react';
import { logger } from '../../lib/logger';
import { analytics } from '../../services/analytics';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'action';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: Icon;
    iconWeight?: "bold" | "bold" | "fill" | "light" | "regular" | "thin";
    isLoading?: boolean;
    fullWidth?: boolean;
    trackingComponent?: string;
}

const VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-amber-400 hover:bg-amber-500 text-slate-900 border-transparent shadow-sm',
    action: 'bg-indigo-600 hover:bg-indigo-700 text-white border-transparent shadow-lg shadow-indigo-100',
    secondary: 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm',
    outline: 'bg-transparent border-slate-300 hover:bg-slate-50 text-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white border-transparent shadow-lg shadow-red-100',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-600 border-transparent',
};

const SIZES: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs font-bold',
    md: 'px-6 py-2.5 text-sm font-bold', // Default
    lg: 'px-8 py-3 text-base font-bold',
    icon: 'p-2.5', // specialized for icon-only
};

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconWeight,
    isLoading = false,
    fullWidth = false,
    className = '',
    disabled,
    onClick,
    trackingComponent,
    ...props
}) => {
    // Default to 'bold' for action buttons to avoid bold 'shadow' effect, 
    // otherwise default to 'bold'.
    const effectiveIconWeight = iconWeight || 'bold';
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        // Track the click
        let label = '';
        if (typeof children === 'string') {
            label = children;
        } else if (props.title) {
            label = props.title;
        } else if (props['aria-label']) {
            label = props['aria-label'];
        } else {
            label = 'icon-button';
        }

        const component = trackingComponent || 'Button';
        logger.logClick(label, component);
        analytics.trackButtonClick(label, window.location.pathname);

        if (onClick) {
            onClick(e);
        }
    };

    return (
        <button
            disabled={disabled || isLoading}
            onClick={handleClick}
            className={`
                flex items-center justify-center gap-2 
                rounded-full 
                border 
                transition-all 
                active:scale-95 disabled:active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed
                ${VARIANTS[variant]} 
                ${SIZES[size]} 
                ${fullWidth ? 'w-full' : ''}
                ${className}
            `}
            {...props}
        >
            {isLoading && <span className="animate-spin mr-1">⌛</span>}
            {!isLoading && Icon && <Icon size={size === 'sm' ? 14 : 18} weight={effectiveIconWeight} />}
            {children}
        </button>
    );
};
