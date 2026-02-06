import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    canEdit?: boolean;
    noAccessText?: string;
    className?: string;
}

export const EmptyStateCard: React.FC<EmptyStateCardProps> = ({
    title,
    description,
    icon,
    canEdit = true,
    noAccessText = 'אין לך הרשאות יצירה',
    className
}) => {
    return (
        <div
            className={cn(
                "col-span-full bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200 rounded-3xl p-8 md:p-10 text-center flex flex-col items-center gap-3",
                className
            )}
        >
            <div className="w-14 h-14 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center text-blue-600">
                {icon}
            </div>
            <h3 className="text-lg md:text-xl font-black text-slate-800">{title}</h3>
            <p className="text-sm md:text-base text-slate-500 font-medium">{description}</p>
            {!canEdit && noAccessText && (
                <p className="text-xs text-slate-400 font-bold">{noAccessText}</p>
            )}
        </div>
    );
};
