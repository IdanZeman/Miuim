import { Skeleton } from '@/components/ui/Skeleton';

export const PersonnelListSkeleton = () => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm flex items-center gap-4 h-24">
                    <Skeleton className="w-12 h-12 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="w-32 h-4 rounded" />
                        <div className="flex gap-2">
                            <Skeleton className="w-16 h-3 rounded" />
                            <Skeleton className="w-12 h-3 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
