import React, { useState } from 'react';
import { MicrosoftExcelLogo, Spinner } from '@phosphor-icons/react';
import { useToast } from '@/contexts/ToastContext';


interface ExportButtonProps {
    onExport: () => Promise<void>;
    label?: string;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    iconOnly?: boolean;
    className?: string;
    disabled?: boolean;
    title?: string;
}

const ExcelIcon = ({ size }: { size: number }) => (
    <img
        src="/images/excel.svg"
        alt="Excel"
        width={size}
        height={size}
        className="object-contain"
    />
);




export const ExportButton: React.FC<ExportButtonProps> = ({
    onExport,
    label = 'ייצוא לאקסל',
    variant = 'primary',
    size = 'md',
    iconOnly = false,
    className = '',
    disabled = false,
    title = 'ייצוא נתונים לאקסל'
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
        primary: 'bg-white text-slate-700 hover:bg-slate-50 shadow-md border-slate-200',
        secondary: 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200 shadow-sm',
        ghost: 'bg-transparent text-slate-700 hover:bg-slate-50 border-transparent'
    };


    const sizes = {
        sm: iconOnly ? 'w-9 h-9' : 'h-9 px-3 text-[10px]',
        md: iconOnly ? 'w-11 h-11' : 'h-11 px-5 text-xs',
        lg: iconOnly ? 'w-14 h-14' : 'h-14 px-8 text-sm'
    };

    const baseStyles = 'group inline-flex items-center justify-center gap-2 rounded-xl border font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    const iconSize = size === 'sm' ? 24 : size === 'md' ? 32 : 40;

    return (
        <button
            onClick={handleExport}
            disabled={isExporting || disabled}
            className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className} ${iconOnly ? 'rounded-full px-0' : ''}`}
            title={title}
        >
            {isExporting ? (
                <Spinner className="animate-spin" size={size === 'sm' ? 18 : size === 'md' ? 24 : 30} weight="bold" />
            ) : (
                variant === 'ghost' ? <MicrosoftExcelLogo size={24} weight="duotone" className="text-emerald-600" /> : <ExcelIcon size={iconSize} />
            )}

            {!iconOnly && <span className="tracking-tight">{isExporting ? 'מייצא...' : label}</span>}
        </button>
    );
};



