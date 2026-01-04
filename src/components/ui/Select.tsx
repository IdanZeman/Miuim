import React, { useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CaretDown as ChevronDownIcon, Check as CheckIcon, MagnifyingGlass as SearchIcon, Funnel as FilterIcon, Icon } from '@phosphor-icons/react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { logger } from '../../lib/logger';
import { analytics, trackEvent } from '../../services/analytics';

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    label?: string; // Added label prop
    placeholder?: string;
    icon?: Icon;
    className?: string;
    containerClassName?: string;
    disabled?: boolean;
    searchable?: boolean;
    direction?: 'top' | 'bottom';
    triggerMode?: 'default' | 'icon';
}

export const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    label,
    placeholder = 'Select...',
    icon: Icon,
    className = '',
    containerClassName = '',
    disabled = false,
    searchable = false,
    direction = 'bottom',
    triggerMode = 'default'
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [position, setPosition] = useState({ top: 0, left: 0, width: 0, isTop: false });
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null); // NEW: Ref for portal
    const searchInputRef = useRef<HTMLInputElement>(null);

    useClickOutside(containerRef, (e) => {
        // Simple Debug
        const isInsideDropdown = dropdownRef.current && dropdownRef.current.contains(e.target as Node);
        // If click is inside the dropdown portal, ignore it
        if (isInsideDropdown) {
            return;
        }
        setIsOpen(false);
        setSearchTerm('');
    });

    const selectedOption = options.find(opt => opt.value === value);

    // Filter options based on search term
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerTerm = searchTerm.toLowerCase();
        return options.filter(opt => opt.label.toLowerCase().includes(lowerTerm));
    }, [options, searchTerm]);

    const handleSelect = (val: string) => {
        const option = options.find(o => o.value === val);
        logger.info('UPDATE', `Selected ${option?.label || val} in ${label || 'Select'}`, {
            category: 'ui',
            label,
            value: val
        });
        trackEvent('select_change', 'UI', `${label || 'select'}:${option?.label || val}`);

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

    // Calculate position on open
    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            const MENU_HEIGHT = 200; // Estimated max height

            // Decide direction: prefer bottom unless space below is small AND space above is larger
            const showTop = (spaceBelow < MENU_HEIGHT && spaceAbove > spaceBelow);

            // Determine width and left position
            const dropdownWidth = triggerMode === 'icon' ? 220 : rect.width;
            let left = rect.left;

            // Prevent going off right screen edge
            if (left + dropdownWidth > window.innerWidth) {
                left = window.innerWidth - dropdownWidth - 16; // 16px buffer
            }
            // Prevent going off left screen edge
            if (left < 0) {
                left = 16;
            }


            setPosition({
                top: showTop ? rect.top - 4 : rect.bottom + 4,
                left: left,
                width: dropdownWidth,
                isTop: showTop
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

    // Update position on scroll/resize if open
    React.useEffect(() => {
        if (!isOpen) return;

        const handleScroll = () => {
            updatePosition();
        };

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [isOpen]);

    return (
        <div className={`relative ${triggerMode === 'default' ? 'w-full' : 'w-auto'} ${containerClassName}`} ref={containerRef}>
            {label && (
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    {label}
                </label>
            )}

            {triggerMode === 'icon' ? (
                <button
                    type="button"
                    onClick={toggleOpen}
                    disabled={disabled}
                    className={`p-2.5 rounded-xl border transition-all shadow-sm flex items-center justify-center
                        ${isOpen ? 'ring-2 ring-blue-100 border-blue-500 bg-white text-blue-600' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-white hover:border-slate-300 hover:text-slate-700'}
                        ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                        ${className}
                    `}
                    title={placeholder}
                    aria-label={label || placeholder}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                >
                    {Icon ? <Icon size={20} aria-hidden="true" weight="duotone" /> : <FilterIcon size={20} aria-hidden="true" weight="duotone" />}
                </button>
            ) : (
                <button
                    type="button"
                    onClick={toggleOpen}
                    disabled={disabled}
                    className={`w-full py-2.5 ${Icon ? 'pr-11' : 'pr-4'} pl-10 rounded-xl border bg-slate-50 flex items-center justify-between transition-all shadow-sm text-slate-700 text-base font-bold text-right
                        ${isOpen ? 'ring-2 ring-blue-100 border-blue-500 bg-white' : 'border-slate-200 hover:border-slate-300 hover:bg-white'}
                        ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'cursor-pointer'}
                        ${className}
                    `}
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-label={label || placeholder}
                >
                    <span className={`block truncate ${!selectedOption ? 'text-slate-400 font-normal' : ''}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>

                    {/* Left Icon */}
                    {Icon && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Icon size={18} aria-hidden="true" weight="duotone" />
                        </div>
                    )}

                    {/* Chevron Icon */}
                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`}>
                        <ChevronDownIcon size={18} aria-hidden="true" weight="bold" />
                    </div>
                </button>
            )}

            {/* Portal Dropdown Menu */}
            {isOpen && createPortal(
                <div
                    ref={dropdownRef} // NEW: Attach ref here
                    className="fixed z-[100000] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top"
                    role="listbox"
                    aria-label={label || placeholder}
                    style={{
                        top: position.isTop ? 'auto' : position.top,
                        bottom: position.isTop ? (window.innerHeight - position.top) : 'auto',
                        left: position.left,
                        width: position.width,
                        maxHeight: '200px'
                    }}
                >
                    {/* Search Input */}
                    {searchable && (
                        <div className="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <div className="relative">
                                <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} aria-hidden="true" weight="bold" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="חיפוש..."
                                    className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                    aria-label="חיפוש באפשרויות"
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
                                className={`w-full text-right px-3 py-2.5 rounded-lg text-base font-medium transition-colors flex items-center justify-between group
                                    ${option.value === value
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-slate-700 hover:bg-slate-50'
                                    }
                                `}
                                role="option"
                                aria-selected={option.value === value}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    {option.icon && <span className="text-slate-400 group-hover:text-slate-500" aria-hidden="true">{option.icon}</span>}
                                    {option.label}
                                </span>
                                {option.value === value && (
                                    <CheckIcon size={16} className="text-blue-600" aria-hidden="true" weight="bold" />
                                )}
                            </button>
                        ))}
                        {filteredOptions.length === 0 && (
                            <div className="px-3 py-8 text-center text-slate-400 text-sm italic">
                                {searchTerm ? 'לא נמצאו תוצאות' : 'אין אפשרויות זמינות'}
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
