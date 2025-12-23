import React, { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: LucideIcon;
    containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, error, icon: Icon, containerClassName = '', ...props }, ref) => {
        return (
        return (
            <div className={`w-full min-w-0 ${containerClassName}`}>
                {label && (
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 truncate">
                        {label}
                    </label>
                )}
                <div className="relative">
                    {Icon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Icon size={18} />
                        </div>
                    )}
                    <input
                        ref={ref}
                        className={`
                            w-full 
                            ${Icon ? 'pr-10 pl-4' : (props.type === 'time' ? 'px-1' : 'px-3 md:px-4')} 
                            py-2.5 
                            bg-white 
                            border 
                            ${error ? 'border-red-500 focus:ring-red-200' : 'border-slate-300 focus:ring-blue-100 focus:border-blue-500'} 
                            rounded-xl 
                            text-slate-900 
                            text-base md:text-sm 
                            placeholder:text-slate-400 
                            focus:outline-none 
                            focus:ring-4 
                            transition-all 
                            shadow-sm
                            disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-50
                            ${className}
                        `}
                        {...props}
                        dir={props.type === 'date' || props.type === 'time' || props.type === 'datetime-local' ? 'ltr' : props.dir}
                    />
                </div>
                {error && (
                    <p className="mt-1 text-sm text-red-500 font-medium animate-in slide-in-from-top-1">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = 'Input';
