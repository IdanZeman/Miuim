import { Skeleton } from '@/components/ui/Skeleton';

export const SnapshotListSkeleton = () => {
    return (
        <div className="space-y-4">
            {/* Header mimic */}
            <div className="flex items-center justify-between mb-8">
                <div className="space-y-2">
                    <Skeleton className="w-64 h-8 rounded" />
                    <Skeleton className="w-96 h-4 rounded" />
                </div>
                <Skeleton className="w-40 h-12 rounded-xl" />
            </div>

            {/* List Items */}
            <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                            <div className="space-y-3 flex-1 max-w-md">
                                <Skeleton className="w-48 h-6 rounded" />
                                <div className="flex gap-4">
                                    <Skeleton className="w-32 h-4 rounded" />
                                    <Skeleton className="w-24 h-4 rounded" />
                                </div>
                                <Skeleton className="w-full h-4 rounded" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="w-28 h-10 rounded-xl" />
                            <Skeleton className="w-24 h-10 rounded-xl" />
                            <Skeleton className="w-10 h-10 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
