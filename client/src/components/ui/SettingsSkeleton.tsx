import React from 'react';
import { Skeleton } from './Skeleton';

export const SettingsSkeleton: React.FC = () => {
    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col md:flex-row md:gap-8 md:p-6 overflow-hidden min-h-[600px]" dir="rtl">
            {/* Sidebar Skeleton */}
            <div className="hidden md:flex flex-col w-64 shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full">
                <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-3">
                        <Skeleton className="w-10 h-10 rounded-lg" />
                        <div className="space-y-2 flex-1">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                        </div>
                    </div>
                </div>
                <div className="p-2 space-y-2">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <Skeleton key={i} className="h-10 w-full rounded-xl" />
                    ))}
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="flex-1 p-6 md:p-8 bg-white rounded-[2rem] border border-slate-100">
                <div className="space-y-8 animate-pulse">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-8 w-48 rounded-lg" />
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-32 rounded" />
                            <div className="flex gap-4">
                                <Skeleton className="h-12 flex-1 rounded-xl" />
                                <Skeleton className="h-12 flex-1 rounded-xl" />
                            </div>
                        </div>

                        <div className="space-y-4 pt-6 border-t border-slate-100">
                            <Skeleton className="h-4 w-24 rounded" />
                            <Skeleton className="h-20 w-full rounded-2xl" />
                        </div>

                        <div className="flex justify-end pt-4">
                            <Skeleton className="h-12 w-32 rounded-xl" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
