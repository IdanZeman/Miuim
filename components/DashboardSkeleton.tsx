import React from 'react';

export const DashboardSkeleton: React.FC = () => {
    return (
        <div className="flex flex-col h-screen bg-slate-50 overflow-hidden" dir="rtl">
            {/* Header Skeleton */}
            <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between animate-pulse">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-slate-200 rounded-lg"></div>
                    <div className="w-32 h-6 bg-slate-200 rounded"></div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                    <div className="w-24 h-8 bg-slate-200 rounded-lg"></div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Skeleton */}
                <div className="w-64 bg-white border-l border-slate-200 hidden md:flex flex-col p-4 gap-4 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-2">
                            <div className="w-6 h-6 bg-slate-200 rounded"></div>
                            <div className="w-32 h-4 bg-slate-200 rounded"></div>
                        </div>
                    ))}
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        {/* Stat Cards */}
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
                                <div className="w-10 h-10 bg-slate-200 rounded-full mb-4"></div>
                                <div className="w-20 h-4 bg-slate-200 rounded mb-2"></div>
                                <div className="w-16 h-8 bg-slate-200 rounded"></div>
                            </div>
                        ))}
                    </div>

                    {/* Chart/Table Area */}
                    <div className="h-96 bg-white rounded-2xl border border-slate-200 animate-pulse"></div>
                </div>
            </div>
        </div>
    );
};
