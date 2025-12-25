import React from 'react';
import { LucideIcon } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: LucideIcon;
    isLoading?: boolean;
    fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-idf-yellow hover:bg-idf-yellow-hover text-slate-900 border-transparent shadow-sm',
    secondary: 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700 shadow-sm',
    outline: 'bg-transparent border-slate-300 hover:bg-slate-50 text-slate-700',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border-transparent',
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
    isLoading = false,
    fullWidth = false,
    className = '',
    disabled,
    ...props
}) => {
    return (
        <button
            disabled={disabled || isLoading}
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
            {!isLoading && Icon && <Icon size={size === 'sm' ? 14 : 18} />}
            {children}
        </button>
    );
};
