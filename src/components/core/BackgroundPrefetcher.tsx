import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/AuthContext';
import { fetchOrganizationData } from '../../hooks/useOrganizationData';
import { fetchBattalionCompanies, fetchBattalionPresenceSummary } from '../../services/battalionService';

/**
 * BackgroundPrefetcher handles universal data pre-loading for the application.
 * It prefetches data for the current organization and, for HQ users, 
 * all companies in their battalion.
 */
export const BackgroundPrefetcher = () => {
    const { organization, profile } = useAuth();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (!organization?.id || !profile) return;

        // 1. Always prefetch current organization data
        queryClient.prefetchQuery({
            queryKey: ['organizationData', organization.id],
            queryFn: () => fetchOrganizationData(organization.id),
            staleTime: 1000 * 60 * 5, // Keep for 5 minutes
        });

        // 2. If HQ user, prefetch all battalion companies
        if (organization.is_hq && organization.battalion_id) {
            const prefetchBattalion = async () => {
                try {
                    const companies = await fetchBattalionCompanies(organization.battalion_id!);

                    // 2b. Prefetch battalion-wide presence summary
                    queryClient.prefetchQuery({
                        queryKey: ['battalionPresence', organization.battalion_id],
                        queryFn: () => fetchBattalionPresenceSummary(organization.battalion_id!),
                        staleTime: 1000 * 60 * 1,
                    });

                    // Limit concurrency to avoid overloading the DB/Network
                    for (const company of companies) {
                        // Skip if it's the current org (already prefetching/prefetched)
                        if (company.id === organization.id) continue;

                        queryClient.prefetchQuery({
                            queryKey: ['organizationData', company.id],
                            queryFn: () => fetchOrganizationData(company.id),
                            staleTime: 1000 * 60 * 5,
                        });
                    }
                } catch (error) {
                    console.error('[BackgroundPrefetcher] Failed to prefetch battalion data:', error);
                }
            };

            prefetchBattalion();
        }
    }, [organization?.id, organization?.battalion_id, organization?.is_hq, profile, queryClient]);

    // This component renders nothing, just handles side effects
    return null;
};
