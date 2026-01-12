import React, { useState } from 'react';
import { MagnifyingGlass as Search, X, Funnel as Filter, DotsThreeVertical as MoreVertical } from '@phosphor-icons/react';
import { Select, SelectOption } from './Select';
import { ExportButton } from './ExportButton';
import { GenericModal } from './GenericModal';
import { Button } from './Button';
import { MicrosoftExcelLogo } from '@phosphor-icons/react';

interface FilterConfig {
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    icon?: any;
    searchable?: boolean;
}

interface ActionBarProps {
    // Search
    searchTerm: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder?: string;

    // Filters
    filters?: FilterConfig[];

    // Actions
    onExport?: () => Promise<void>;
    exportTitle?: string;

    // Custom Actions (e.g., for three-dots menu or additional buttons)
    rightActions?: React.ReactNode;
    centerActions?: React.ReactNode;
    leftActions?: React.ReactNode;

    // Layout
    className?: string;
    isSearchExpandedDefault?: boolean;
    isSearchHidden?: boolean;
    mobileMoreActions?: React.ReactNode;
    testId?: string;
}

export const ActionBar: React.FC<ActionBarProps> = ({
    searchTerm,
    onSearchChange,
    searchPlaceholder = "חיפוש...",
    filters = [],
    onExport,
    exportTitle = "ייצוא לאקסל",
    rightActions,
    centerActions,
    leftActions,
    className = "",
    isSearchExpandedDefault = false,
    isSearchHidden = false,
    mobileMoreActions,
    testId
}) => {
    const [isSearchExpanded, setIsSearchExpanded] = useState(isSearchExpandedDefault || !!searchTerm);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const activeFiltersCount = filters.filter(f => f.value && f.value !== 'all').length;

    return (
        <div className={`shrink-0 z-50 relative bg-white/50 backdrop-blur-sm border-b border-slate-100 ${className}`}>
            {/* 1. Mobile Layout - Clean & Minimalist */}
            <div className="md:hidden flex flex-col py-2 px-3">
                {/* Top Row: Title & Entry Points */}
                <div className="flex items-center justify-between gap-1 h-12">
                    {/* Right side (RTL) - Title */}
                    {!isSearchExpanded && (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 pl-2">
                            {leftActions}
                        </div>
                    )}

                    {/* Search Bar (Expanded) */}
                    {!isSearchHidden && isSearchExpanded && (
                        <div className="flex-1 transition-all duration-300 px-1">
                            <div className="relative w-full">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder={searchPlaceholder}
                                    value={searchTerm}
                                    onChange={(e) => onSearchChange(e.target.value)}
                                    onBlur={() => { if (!searchTerm && !isSearchExpandedDefault) setIsSearchExpanded(false); }}
                                    className="w-full h-10 pr-9 pl-8 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none text-right shadow-inner"
                                />
                                <button
                                    onClick={() => { onSearchChange(''); setIsSearchExpanded(false); }}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 p-1"
                                >
                                    <X size={14} weight="bold" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Unified Entry Point (Left side in RTL) */}
                    {!isSearchExpanded && (
                        <div className="flex items-center gap-1 shrink-0">
                            {/* Search Trigger */}
                            {!isSearchHidden && (
                                <button
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-100/50 rounded-xl text-slate-500 active:bg-white transition-all"
                                >
                                    <Search size={20} weight="duotone" />
                                </button>
                            )}

                            {/* Main Menu Button (3 Dots) */}
                            <button
                                onClick={() => setIsMobileMenuOpen(true)}
                                className={`w-10 h-10 flex items-center justify-center rounded-xl border relative transition-all ${activeFiltersCount > 0 ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-100' : 'bg-white text-slate-500 border-slate-200 active:bg-slate-50'}`}
                            >
                                <MoreVertical size={22} weight="bold" />
                                {activeFiltersCount > 0 && <span className="absolute -top-1 -left-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white">{activeFiltersCount}</span>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Mobile Tabs Row */}
                {centerActions && !isSearchExpanded && (
                    <div className="w-full overflow-x-auto custom-scrollbar-hide flex items-center justify-center py-1.5 mt-0.5">
                        <div className="inline-flex min-w-0 bg-slate-100/50 p-1 rounded-xl">
                            {centerActions}
                        </div>
                    </div>
                )}
            </div>

            {/* 2. Desktop Layout - Grouped for Clarity */}
            <div className={`hidden md:flex items-center justify-between gap-4 py-4 px-6 ${className}`}>
                {/* Right Side (RTL) - Title/Brand */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    {leftActions}
                </div>

                {/* Center Section - View Switchers/Tabs */}
                <div className="flex justify-center min-w-0 flex-1">
                    {centerActions && (
                        <div className="flex items-center justify-center shrink-0">
                            {centerActions}
                        </div>
                    )}
                </div>

                {/* Left side in RTL - Consolidated Actions (Search, Filters, Navigator, Export) */}
                <div className="flex items-center gap-3 justify-end min-w-0 flex-1">
                    {/* 1. Filters (Consolidated) */}
                    {filters.length > 0 && (
                        <div className="flex items-center gap-2">
                            {/* Desktop Filters (Large only) */}
                            <div className="hidden 4xl:flex items-center gap-2">
                                {filters.map((filter) => (
                                    <div key={filter.id} className="w-36">
                                        <Select
                                            value={filter.value}
                                            onChange={filter.onChange}
                                            options={filter.options}
                                            placeholder={filter.placeholder}
                                            icon={filter.icon}
                                            searchable={filter.searchable}
                                            className="bg-slate-100/50 border-transparent rounded-xl h-10"
                                        />
                                    </div>
                                ))}
                            </div>

                            {/* Filter Trigger Modal (Mobile/Smaller Desktop) */}
                            <div className="flex 4xl:hidden">
                                <button
                                    onClick={() => setIsMobileMenuOpen(true)}
                                    data-testid={testId ? `${testId}__filter-trigger` : undefined}
                                    className={`h-10 px-3 rounded-xl border flex items-center gap-2 transition-all shrink-0 ${activeFiltersCount > 0 ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100/50 text-slate-500 border-slate-200 hover:bg-white'}`}
                                >
                                    <Filter size={18} weight={activeFiltersCount > 0 ? "fill" : "bold"} />
                                    {activeFiltersCount > 0 && <span className="bg-white text-blue-600 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">{activeFiltersCount}</span>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* 2. Custom Right Actions (e.g. Date Navigator) */}
                    {rightActions}

                    {/* 3. Search Bar */}
                    {!isSearchHidden && (
                        <div className={`relative transition-all duration-300 ease-in-out ${isSearchExpanded || searchTerm ? 'md:w-56 xl:w-64' : 'w-10'}`}>
                            {isSearchExpanded || searchTerm ? (
                                <div className="relative w-full">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        autoFocus
                                        type="text"
                                        placeholder={searchPlaceholder}
                                        value={searchTerm}
                                        onChange={(e) => onSearchChange(e.target.value)}
                                        onBlur={() => { if (!searchTerm && !isSearchExpandedDefault) setIsSearchExpanded(false); }}
                                        className="w-full h-10 pr-9 pl-8 bg-slate-100/50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-right"
                                    />
                                    {searchTerm && (
                                        <button
                                            onClick={() => { onSearchChange(''); if (!isSearchExpandedDefault) setIsSearchExpanded(false); }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            <X size={12} weight="bold" />
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsSearchExpanded(true)}
                                    className="w-10 h-10 flex items-center justify-center bg-slate-100/50 hover:bg-white border border-slate-200 rounded-xl text-slate-500 transition-all"
                                >
                                    <Search size={20} weight="duotone" />
                                </button>
                            )}
                        </div>
                    )}

                    {/* 5. Export Button */}
                    {onExport && (
                        <ExportButton
                            onExport={onExport}
                            iconOnly
                            className="h-10 w-10 rounded-xl border border-slate-200 shadow-sm"
                            title={exportTitle}
                        />
                    )}
                </div>
            </div>

            {/* Mobile Actions & Filters Modal */}
            <GenericModal
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                title="פעולות וסינון"
                size="sm"
                footer={
                    <Button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black shadow-lg shadow-emerald-100"
                    >
                        החל סינון
                    </Button>
                }
            >
                <div className="space-y-8 py-2">
                    {/* 1. Actions Section - Only show on mobile or when not in 'filter-only' mode */}
                    <div className="space-y-4 md:hidden">
                        <SectionHeader title="פעולות מהירות" />

                        <div className="space-y-2">
                            {/* Export as a regular list item */}
                            {onExport && (
                                <ActionListItem
                                    icon={MicrosoftExcelLogo}
                                    label={exportTitle}
                                    color="bg-emerald-50 text-emerald-600"
                                    onClick={onExport}
                                />
                            )}

                            {/* Personnel Manager uses mobileMoreActions for its specific items */}
                            {mobileMoreActions}

                            {/* Generic rightActions (e.g. Sort, Delete) - Only show in modal on mobile */}
                            {rightActions && (
                                <div className="space-y-2">
                                    {rightActions}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-b border-slate-100 mx-1" />

                    {/* 2. Filters Section */}
                    {filters.length > 0 && (
                        <div className="space-y-4">
                            <SectionHeader title="סינון נתונים" />

                            <div className="space-y-5">
                                {filters.map((filter) => (
                                    <div key={filter.id} className="space-y-2">
                                        {filter.placeholder && (
                                            <label className="text-xs font-black text-slate-600 px-1">
                                                {filter.placeholder}
                                            </label>
                                        )}
                                        <Select
                                            value={filter.value}
                                            onChange={(val) => filter.onChange(val)}
                                            options={filter.options}
                                            placeholder={filter.placeholder}
                                            icon={filter.icon}
                                            searchable={filter.searchable}
                                            className="bg-slate-50 border-transparent rounded-2xl h-12 text-sm font-bold"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeFiltersCount > 0 && (
                        <button
                            onClick={() => {
                                filters.forEach(f => f.onChange('all'));
                                setIsMobileMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-center gap-2 py-4 text-xs font-black text-rose-500 bg-rose-50/50 hover:bg-rose-50 rounded-2xl transition-all border border-rose-100/50 mt-4"
                        >
                            <X size={16} weight="bold" />
                            נקה את כל המסננים
                        </button>
                    )}
                </div>
            </GenericModal>
        </div>
    );
};

// --- Sub-components for better organization ---

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
        {title}
    </h3>
);

export const ActionListItem: React.FC<{
    icon: any;
    label: string;
    onClick?: () => void | Promise<void>;
    extra?: React.ReactNode;
    color?: string;
    description?: string;
}> = ({ icon: Icon, label, onClick, extra, color = "bg-slate-100 text-slate-500", description }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        if (!onClick || isLoading) return;
        const result = onClick();
        if (result instanceof Promise) {
            setIsLoading(true);
            try {
                await result;
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={isLoading}
            className="w-full flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-[1.25rem] hover:bg-slate-50 active:scale-[0.98] transition-all group text-right"
        >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0 shadow-sm border border-black/5`}>
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Icon size={20} weight="duotone" />
                    )}
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-black text-slate-800 leading-tight">
                        {isLoading ? 'בביצוע...' : label}
                    </span>
                    {description && <span className="text-[10px] font-bold text-slate-400 mt-0.5">{description}</span>}
                </div>
            </div>
            <div className="flex items-center gap-2">
                {extra || <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-slate-400 transition-colors">
                    <MoreVertical size={16} />
                </div>}
            </div>
        </button>
    );
};
