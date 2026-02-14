import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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

    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, align: align });

    const updatePosition = useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const scrollY = window.scrollY;
            const scrollX = window.scrollX;

            // On mobile we might want different behavior, but for now let's keep it consistent
            const isMobile = window.innerWidth < 768;
            const dropdownWidth = 224; // w-56 = 14rem = 224px

            let left = align === 'right'
                ? rect.right - dropdownWidth
                : rect.left;

            // Boundary checks
            if (left + dropdownWidth > window.innerWidth - 10) {
                left = window.innerWidth - dropdownWidth - 10;
            }
            if (left < 10) {
                left = 10;
            }

            setPosition({
                top: rect.bottom + scrollY + 8,
                left: left + scrollX,
                width: dropdownWidth,
                align: align
            });
        }
    }, [align]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                // Also check if click is inside the portal (we'll use a data attribute or ref)
                const target = event.target as HTMLElement;
                if (target.closest('[data-dropdown-content]')) return;

                setIsOpen(false);
            }
        };

        if (isOpen) {
            updatePosition();
            document.addEventListener('mousedown', handleClickOutside);
            window.addEventListener('scroll', updatePosition, true);
            window.addEventListener('resize', updatePosition);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [isOpen, updatePosition]);

    return (
        <div className={`relative inline-block ${className}`} ref={containerRef}>
            <div onClick={() => setIsOpen(!isOpen)}>
                {trigger}
            </div>

            {isOpen && createPortal(
                <div
                    data-dropdown-content
                    className={`
                        fixed w-56 p-1.5
                        bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 z-[10000]
                    `}
                    style={{
                        top: position.top,
                        left: position.left,
                    }}
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
                </div>,
                document.body
            )}
        </div>
    );
};
