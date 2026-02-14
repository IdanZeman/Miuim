import { Skeleton } from '@/components/ui/Skeleton';

export const AdminLogsSkeleton = () => {
    return (
        <div className="flex-1 overflow-hidden relative flex flex-col h-full animate-pulse">
            {/* Desktop Table Skeleton */}
            <div className="hidden md:block flex-1 overflow-visible">
                <div className="border-b border-slate-100 flex p-4 gap-4">
                    <Skeleton className="w-40 h-8 rounded" />
                    <Skeleton className="w-24 h-8 rounded" />
                    <Skeleton className="w-40 h-8 rounded" />
                    <Skeleton className="flex-1 h-8 rounded" />
                </div>
                <div className="divide-y divide-slate-50">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex items-center p-4 gap-4">
                            <div className="w-40 flex flex-col items-end gap-1">
                                <Skeleton className="w-24 h-4 rounded" />
                                <Skeleton className="w-16 h-3 rounded" />
                            </div>
                            <Skeleton className="w-24 h-6 rounded-lg" />
                            <Skeleton className="w-40 h-4 rounded" />
                            <Skeleton className="flex-1 h-4 rounded" />
                            <div className="w-48 flex items-center gap-3">
                                <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                                <div className="flex-1 space-y-1">
                                    <Skeleton className="w-24 h-3 rounded" />
                                    <Skeleton className="w-32 h-3 rounded" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Mobile List Skeleton */}
            <div className="md:hidden flex-1 p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                        <div className="flex justify-between">
                            <Skeleton className="w-20 h-6 rounded-lg" />
                            <Skeleton className="w-32 h-4 rounded" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="w-2/3 h-5 rounded" />
                            <Skeleton className="w-full h-4 rounded" />
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-6 h-6 rounded-full" />
                                <Skeleton className="w-24 h-3 rounded" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
