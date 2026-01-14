import React from 'react';
import { HomeStatusType } from '@/types';
import { House, Calendar, UserMinus, CalendarDots, XCircle } from '@phosphor-icons/react';

interface HomeStatusSelectorProps {
    value?: HomeStatusType;
    onChange: (value: HomeStatusType) => void;
    required?: boolean;
    disabled?: boolean;
    className?: string;
}

const HOME_STATUS_OPTIONS: { value: HomeStatusType; label: string; icon: React.ElementType; color: string }[] = [
    { value: 'leave_shamp', label: 'חופשה בשמפ', icon: Calendar, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
    { value: 'gimel', label: 'ג\'', icon: House, color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' },
    { value: 'absent', label: 'נפקד', icon: UserMinus, color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
    { value: 'organization_days', label: 'ימי התארגנות', icon: CalendarDots, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
    { value: 'not_in_shamp', label: 'לא בשמ"פ', icon: XCircle, color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
];

export const HomeStatusSelector: React.FC<HomeStatusSelectorProps> = ({
    value,
    onChange,
    required = false,
    disabled = false,
    className = '',
}) => {
    return (
        <div className={`space-y-2 ${className}`}>
            <label className="block text-sm font-bold text-slate-700">
                סוג סטטוס בית {required && <span className="text-red-500">*</span>}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {HOME_STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = value === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => !disabled && onChange(option.value)}
                            disabled={disabled}
                            className={`
                relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                ${isSelected
                                    ? 'ring-2 ring-blue-500 ring-offset-2 shadow-md scale-[1.02]'
                                    : 'hover:scale-[1.01]'
                                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                ${option.color}
              `}
                        >
                            <Icon size={20} weight={isSelected ? 'fill' : 'duotone'} />
                            <span className="text-sm font-bold flex-1 text-right">{option.label}</span>
                            {isSelected && (
                                <div className="absolute top-1 left-1 w-2 h-2 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
            {required && !value && (
                <p className="text-xs text-red-600 font-medium">יש לבחור סוג סטטוס בית</p>
            )}
        </div>
    );
};

// Helper function to get label for a home status type
export const getHomeStatusLabel = (type?: HomeStatusType): string => {
    if (!type) return '';
    const option = HOME_STATUS_OPTIONS.find(o => o.value === type);
    return option?.label || '';
};

// Helper function to get icon for a home status type
export const getHomeStatusIcon = (type?: HomeStatusType): React.ElementType | null => {
    if (!type) return null;
    const option = HOME_STATUS_OPTIONS.find(o => o.value === type);
    return option?.icon || null;
};

// Helper function to get color for a home status type
export const getHomeStatusColor = (type?: HomeStatusType): string => {
    if (!type) return 'bg-slate-100 text-slate-600';
    const option = HOME_STATUS_OPTIONS.find(o => o.value === type);
    return option?.color || 'bg-slate-100 text-slate-600';
};
