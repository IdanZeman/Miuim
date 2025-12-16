import React, { useState, useRef, useMemo } from 'react';
import { ChevronDown, Check, Search, LucideIcon } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    icon?: LucideIcon;
    className?: string;
    disabled?: boolean;
    searchable?: boolean; // NEW PROP
}

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    icon: Icon,
    className = '',
    disabled = false,
    searchable = false // Default off unless requested
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState(''); // NEW STATE
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null); // NEW REF

    useClickOutside(containerRef, () => {
        setIsOpen(false);
        setSearchTerm(''); // Reset search on close
    });

    const selectedOption = options.find(opt => opt.value === value);

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm));
    }, [options, searchTerm]);

    const handleSelect = (val: string) => {
        onChange(val);
        setIsOpen(false);
        setSearchTerm('');
    };

    // Auto-focus search input when opening
    React.useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, searchable]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full py-3 pr-10 pl-10 rounded-xl border bg-white flex items-center justify-between transition-all shadow-sm text-slate-700 font-medium text-right
                    ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : 'border-slate-300 hover:border-slate-400'}
                    ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
                `}
            >
                <span className={`block truncate ${!selectedOption ? 'text-slate-400' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>

                {/* Left Icon (if provided) */}
                {Icon && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Icon size={18} />
                    </div>
                )}

                {/* Chevron Icon */}
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown size={18} />
                </div>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top">

                    {/* Search Input (Conditionally Rendered) */}
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <div className="relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="חיפוש..."
                                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all font-sans"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    )}

                    <div className="p-1 overflow-y-auto custom-scrollbar">
                        {filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={`w-full text-right px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group
                                    ${option.value === value
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }
                                `}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    {option.icon && <span className="text-slate-400 group-hover:text-slate-500">{option.icon}</span>}
                                    {option.label}
                                </span>
                                {option.value === value && (
                                    <Check size={16} className="text-blue-600" />
                                )}
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="px-3 py-8 text-center text-slate-400 text-sm italic">
                                {searchTerm ? 'לא נמצאו תוצאות' : 'אין אפשרויות זמינות'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
