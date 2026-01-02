import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchBattalionCompanies, fetchBattalionPresenceSummary } from '../services/battalionService';
import { fetchOrganizationData } from './useOrganizationData';
import { Organization, Person, Team, TeamRotation, Absence } from '../types';
import {
    mapPersonFromDB,
    mapTeamFromDB,
    mapRotationFromDB,
    mapAbsenceFromDB,
    mapHourlyBlockageFromDB,
    mapRoleFromDB
} from '../services/mappers';

/**
 * useBattalionData aggregates data from all organizations within a battalion.
 * It leverages the prefetching done by BackgroundPrefetcher to provide
 * instant access to battalion-wide data.
 */
export const useBattalionData = (battalionId?: string | null) => {
    // 1. Fetch battalion companies metadata
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['battalionCompanies', battalionId],
        queryFn: () => fetchBattalionCompanies(battalionId!),
        enabled: !!battalionId,
        staleTime: 1000 * 60 * 30, // Organizations list changes rarely
    });

    // 2. Fetch specific organization data for each company in parallel
    // These keys match exactly what BackgroundPrefetcher logic uses
    const companyQueries = useQueries({
        queries: companies.map(company => ({
            queryKey: ['organizationData', company.id],
            queryFn: () => fetchOrganizationData(company.id),
            staleTime: 1000 * 60 * 5,
        }))
    });

    const isAnyCompanyLoading = companyQueries.some(q => q.isLoading);

    // 3. Fetch Battalion Presence Summary (Today)
    const { data: presenceSummary = [], isLoading: isLoadingPresence } = useQuery({
        queryKey: ['battalionPresence', battalionId],
        queryFn: () => fetchBattalionPresenceSummary(battalionId!),
        enabled: !!battalionId,
        staleTime: 1000 * 60 * 1, // Presence updates frequently
    });

    // 4. Aggregate all data
    const aggregatedData = useMemo(() => {
        // If we have companies but haven't finished loading their data yet, wait
        if (companies.length > 0 && isAnyCompanyLoading) return null;

        const people: Person[] = [];
        const teams: Team[] = [];
        const teamRotations: TeamRotation[] = [];
        const absences: Absence[] = [];
        const hourlyBlockages: any[] = [];
        const roles: any[] = [];

        companyQueries.forEach((query) => {
            const data = query.data;
            if (!data) return;

            if (data.people) people.push(...data.people.map(mapPersonFromDB));
            if (data.teams) teams.push(...data.teams.map(mapTeamFromDB));
            if (data.rotations) teamRotations.push(...data.rotations.map(mapRotationFromDB));
            if (data.absences) absences.push(...data.absences.map(mapAbsenceFromDB));
            if (data.hourlyBlockages) hourlyBlockages.push(...data.hourlyBlockages.map(mapHourlyBlockageFromDB));
            if (data.roles) roles.push(...data.roles.map(mapRoleFromDB));
        });

        return {
            companies,
            people,
            teams,
            teamRotations,
            absences,
            hourlyBlockages,
            roles,
            presenceSummary
        };
    }, [companyQueries, companies, isAnyCompanyLoading, presenceSummary]);

    return {
        ...aggregatedData,
        isLoading: isLoadingCompanies || isAnyCompanyLoading || isLoadingPresence
    };
};
