import React from 'react';
import { Skeleton } from './Skeleton';

export const TableSkeleton: React.FC = () => {
    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col overflow-hidden animate-pulse" dir="rtl">
            {/* Header / Action Bar Skeleton */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-32 rounded" />
                        <Skeleton className="h-3 w-48 rounded" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="w-24 h-9 rounded-xl" />
                    <Skeleton className="w-32 h-9 rounded-xl" />
                </div>
            </div>

            {/* List Items Skeleton */}
            <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <Skeleton className="w-12 h-12 rounded-full" />
                            <div className="space-y-2 flex-1">
                                <Skeleton className="h-4 w-1/4 rounded" />
                                <Skeleton className="h-3 w-1/3 rounded" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Skeleton className="w-20 h-8 rounded-lg" />
                            <Skeleton className="w-6 h-6 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
