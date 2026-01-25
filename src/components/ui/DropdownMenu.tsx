import React, { useState, useRef, useEffect } from 'react';
import { CaretDown } from '@phosphor-icons/react';

interface DropdownMenuItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    variant?: 'default' | 'danger' | 'success' | 'warning' | 'info';
    active?: boolean;
}

interface DropdownMenuProps {
    trigger: React.ReactNode;
    items: DropdownMenuItem[];
    align?: 'left' | 'right';
    className?: string;
}

export const DropdownMenu: React.FC<DropdownMenuProps> = ({ trigger, items, align = 'right', className = '' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    return (
        <div className={`relative inline-block ${className}`} ref={containerRef}>
            <div onClick={() => setIsOpen(!isOpen)}>
                {trigger}
            </div>

            {isOpen && (
                <div
                    className={`
                        absolute top-full mt-2 w-56 p-1.5
                        bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 z-[1001]
                        animate-in fade-in zoom-in-95 duration-200
                        ${align === 'right' ? 'right-0' : 'left-0'}
                    `}
                >
                    <div className="flex flex-col gap-1">
                        {items.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    item.onClick();
                                    setIsOpen(false);
                                }}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all
                                    ${item.active
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-slate-700 hover:bg-slate-50 active:bg-slate-100'}
                                    ${item.variant === 'danger' && !item.active ? 'hover:text-red-600 hover:bg-red-50' : ''}
                                `}
                            >
                                <div className={`shrink-0 ${item.active ? 'text-white' : item.variant === 'danger' ? 'text-red-500' : 'text-slate-400'}`}>
                                    {item.icon}
                                </div>
                                <span className="flex-1 text-right">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
