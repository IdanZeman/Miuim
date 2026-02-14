import React, { useState } from 'react';
import { MicrosoftExcelLogo, Spinner } from '@phosphor-icons/react';
import { useToast } from '@/contexts/ToastContext';


interface ExportButtonProps {
    onExport: () => Promise<void>;
    label?: string;
    variant?: 'primary' | 'secondary' | 'ghost' | 'premium';
    size?: 'sm' | 'md' | 'lg';
    iconOnly?: boolean;
    className?: string;
    disabled?: boolean;
    title?: string;
    id?: string;
    iconWeight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}

export const ExportButton: React.FC<ExportButtonProps> = ({
    onExport,
    label = 'ייצוא לאקסל',
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    className = '',
    disabled = false,
    title = 'ייצוא נתונים לאקסל',
    id,
    iconWeight = 'bold'
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const { showToast } = useToast();

    const handleExport = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isExporting || disabled) return;

        setIsExporting(true);
        try {
            await onExport();
        } catch (error) {
            console.error('Export failed:', error);
            showToast('ייצוא הנתונים נכשל', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const variants = {
        primary: 'bg-white text-slate-700 hover:bg-slate-50 shadow-sm border border-slate-200',
        secondary: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm',
        ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 border border-transparent',
        premium: 'bg-transparent text-slate-500 hover:bg-slate-50 border border-transparent'
    };

    const sizes = {
        sm: iconOnly ? 'w-9 h-9' : 'h-9 px-3 text-[10px]',
        md: iconOnly ? 'w-11 h-11' : 'h-11 px-5 text-xs',
        lg: iconOnly ? 'w-14 h-14' : 'h-14 px-8 text-sm'
    };

    const baseStyles = 'group inline-flex items-center justify-center gap-2 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <button
            onClick={handleExport}
            disabled={isExporting || disabled}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} ${iconOnly && (variant === 'ghost' || variant === 'premium') ? 'rounded-xl' : iconOnly ? 'rounded-full' : ''} hover:scale-105 active:scale-95`}
            title={title}
            id={id}
        >
            {isExporting ? (
                <Spinner className="animate-spin" size={size === 'sm' ? 18 : size === 'md' ? 24 : 30} weight="bold" />
            ) : (
                <MicrosoftExcelLogo
                    size={size === 'sm' ? 20 : size === 'md' ? 24 : 32}
                    weight={iconWeight}
                    className={`${variant === 'premium' ? 'text-slate-500 group-hover:text-emerald-600' : 'text-emerald-600 group-hover:text-emerald-700'} transition-colors`}
                />
            )}

            {!iconOnly && <span className="tracking-tight">{isExporting ? 'מייצא...' : label}</span>}
        </button>
    );
};



