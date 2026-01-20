import { useAuth } from '@/features/auth/AuthContext';
import { TourStep } from '@/components/ui/FeatureTour';
import { useMemo } from 'react';

export type UserTourRole = 'admin' | 'editor' | 'viewer' | 'attendance';

interface RoleBasedTourConfig {
    tourId: string;
    steps: (TourStep & { roles?: UserTourRole[] })[];
}

export const useRoleBasedTour = (config: RoleBasedTourConfig) => {
    const { profile } = useAuth();

    // Map profile permissions to tour roles
    const userRole: UserTourRole = useMemo(() => {
        if (profile?.is_super_admin) return 'admin';
        if (profile?.role === 'admin') return 'admin';
        if (profile?.role === 'editor') return 'editor';
        if (profile?.role === 'attendance_only') return 'attendance';
        return 'viewer';
    }, [profile]);

    const filteredSteps = useMemo(() => {
        return config.steps.filter(step => {
            if (!step.roles) return true;
            return step.roles.includes(userRole);
        }).map(({ roles, ...step }) => step as TourStep);
    }, [config.steps, userRole]);

    return {
        steps: filteredSteps,
        tourId: `${config.tourId}_${userRole}`,
        userRole,
        shouldShow: filteredSteps.length > 0
    };
};
