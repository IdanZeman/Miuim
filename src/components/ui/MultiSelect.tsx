import React, { useState, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';

export interface MultiSelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface MultiSelectProps {
    value: string[];
    onChange: (value: string[]) => void;
    options: MultiSelectOption[];
    label?: string;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    searchable?: boolean;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
    value,
    onChange,
    options,
    label,
    placeholder = 'Select...',
    className = '',
    disabled = false,
    searchable = true
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // NEW: Ref for portal content
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });

    useClickOutside(containerRef, (e) => {
        // If click is inside the dropdown portal, ignore it
        if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
            return;
        }
        setIsOpen(false);
        setSearchTerm('');
    });

    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lower = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lower));
    }, [options, searchTerm]);

    const handleSelect = (val: string) => {
        if (value.includes(val)) {
            onChange(value.filter(v => v !== val));
        } else {
            onChange([...value, val]);
        }
        // Do not close on multi-select click, ideally.
        // But user said "doesn't react", likely referring to selecting items not sticking.
        // Actually for multi-select, we usually keep it open.
    };

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: rect.width
            });
        }
    };

    const toggleOpen = () => {
        if (disabled) return;
        if (!isOpen) {
            updatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            window.addEventListener('resize', updatePosition);
            window.addEventListener('scroll', updatePosition, true);
            return () => {
                window.removeEventListener('resize', updatePosition);
                window.removeEventListener('scroll', updatePosition, true);
            };
        }
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="block text-sm font-bold text-slate-700 mb-1.5">{label}</label>}

            <button
                type="button"
                onClick={toggleOpen}
                disabled={disabled}
                className={`w-full py-2 px-3 rounded-xl border bg-white flex items-center justify-between transition-all shadow-sm text-right min-h-[42px]
                    ${isOpen ? 'ring-2 ring-blue-100 border-blue-500' : 'border-slate-300 hover:border-slate-400'}
                    ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
                    ${className}
                `}
            >
                <div className="flex flex-wrap gap-1 flex-1">
                    {value.length === 0 ? (
                        <span className="text-slate-400 text-sm">{placeholder}</span>
                    ) : (
                        <div className="flex flex-wrap gap-1">
                            {value.length > 3 ? (
                                <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-100">
                                    {value.length} נבחרו
                                </span>
                            ) : (
                                value.map(val => {
                                    const opt = options.find(o => o.value === val);
                                    return (
                                        <span key={val} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold border border-blue-100 flex items-center gap-1">
                                            {opt?.label}
                                            <span
                                                className="cursor-pointer hover:text-blue-900"
                                                onClick={(e) => { e.stopPropagation(); handleSelect(val); }}
                                            >
                                                <X size={12} />
                                            </span>
                                        </span>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
                <ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef} // NEW: Attach ref here
                    className="fixed z-[9999] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col"
                    style={{ top: position.top, left: position.left, width: position.width, maxHeight: '300px' }}
                >
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="חיפוש..."
                                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}
                    <div className="overflow-y-auto custom-scrollbar p-1">
                        {filteredOptions.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-400">לא נמצאו תוצאות</div>
                        ) : (
                            filteredOptions.map(opt => {
                                const isSelected = value.includes(opt.value);
                                return (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group mb-0.5
                                            ${isSelected ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        <span className="flex items-center gap-2 truncate">
                                            {opt.icon && <span className="text-slate-400">{opt.icon}</span>}
                                            {opt.label}
                                        </span>
                                        {isSelected && <Check size={16} className="text-blue-600" />}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
