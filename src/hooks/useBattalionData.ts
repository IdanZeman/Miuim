import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchBattalion, fetchBattalionCompanies, fetchBattalionPresenceSummary } from '../services/battalionService';
import { fetchOrganizationData } from '../hooks/useOrganizationData';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { Organization, Person, Team, TeamRotation, Absence, Role, Shift, TaskTemplate, SchedulingConstraint, MissionReport, Equipment, DailyPresence } from '../types';

/**
 * useBattalionData aggregates data from all organizations within a battalion.
 * It leverages the prefetching done by BackgroundPrefetcher to provide
 * instant access to battalion-wide data.
 */
export const useBattalionData = (battalionId?: string | null, date?: string) => {
    // 0. Fetch battalion metadata (for settings like morning_report_time)
    const { data: battalion, isLoading: isLoadingBattalion } = useQuery({
        queryKey: ['battalion', battalionId],
        queryFn: () => fetchBattalion(battalionId!),
        enabled: !!battalionId,
        staleTime: 1000 * 60 * 30,
    });

    // 1. Fetch battalion companies metadata
    const { data: companies = [], isLoading: isLoadingCompanies } = useQuery({
        queryKey: ['battalionCompanies', battalionId],
        queryFn: () => fetchBattalionCompanies(battalionId!),
        enabled: !!battalionId,
        staleTime: 1000 * 60 * 30, // Organizations list changes rarely
    });

    // 2. Fetch specific organization data for each company in parallel
    const companyQueries = useQueries({
        queries: companies.map(company => ({
            queryKey: ['organizationData', company.id],
            queryFn: () => fetchOrganizationData(company.id),
            staleTime: 1000 * 60 * 5,
        }))
    });

    const isAnyCompanyLoading = companyQueries.some(q => q.isLoading);

    // 3. Fetch Battalion Presence Summary (For the specific date)
    const { data: presenceSummary = [], isLoading: isLoadingPresence } = useQuery({
        queryKey: ['battalionPresence', battalionId, date],
        queryFn: () => fetchBattalionPresenceSummary(battalionId!, date),
        enabled: !!battalionId,
        staleTime: 1000 * 60 * 1, // Presence updates frequently
    });

    // 4. Aggregate all data
    const aggregatedData = useMemo(() => {
        // Log loading state
        if (companies.length > 0 && isAnyCompanyLoading) {
            console.log('useBattalionData: Waiting for companies to load...', {
                total: companies.length,
                loading: companyQueries.filter(q => q.isLoading).length
            });
            return {
                companies: [],
                people: [],
                teams: [],
                teamRotations: [],
                absences: [],
                hourlyBlockages: [],
                roles: [],
                shifts: [],
                taskTemplates: [],
                constraints: [],
                missionReports: [],
                equipment: [],
                equipmentDailyChecks: [],
                presenceSummary: [],
                unifiedPresence: [],
                computedStats: { totalActive: 0, totalPresent: 0, totalHome: 0, unreportedCount: 0, companyStats: {} },
                battalion: null
            };
        }

        const people: Person[] = [];
        const teams: Team[] = [];
        const teamRotations: TeamRotation[] = [];
        const absences: Absence[] = [];
        const hourlyBlockages: any[] = [];
        const roles: Role[] = [];
        const shifts: Shift[] = [];
        const taskTemplates: TaskTemplate[] = [];
        const constraints: SchedulingConstraint[] = [];
        const missionReports: MissionReport[] = [];
        const equipment: Equipment[] = [];
        const equipmentDailyChecks: any[] = [];
        const unifiedPresence: DailyPresence[] = [];

        companyQueries.forEach((query, index) => {
            const data = query.data;
            if (!data) {
                if (query.error) {
                    console.error(`useBattalionData: Error fetching company ${companies[index]?.id}:`, query.error);
                }
                return;
            }

            if (data.people) people.push(...data.people);
            if (data.teams) teams.push(...data.teams);
            if (data.rotations) {
                if (data.rotations.length > 0) {
                    console.log(`[useBattalionData] Found ${data.rotations.length} rotations for company ${companies[index]?.name}`);
                }
                teamRotations.push(...data.rotations);
            }
            if (data.absences) absences.push(...data.absences);
            if (data.hourlyBlockages) hourlyBlockages.push(...data.hourlyBlockages);
            if (data.roles) roles.push(...data.roles);
            if (data.shifts) shifts.push(...data.shifts);
            if (data.taskTemplates) taskTemplates.push(...data.taskTemplates);
            if (data.constraints) constraints.push(...data.constraints);
            if (data.missionReports) missionReports.push(...data.missionReports);
            if (data.equipment) equipment.push(...data.equipment);
            if (data.equipmentDailyChecks) equipmentDailyChecks.push(...data.equipmentDailyChecks);
            if (data.unifiedPresence) unifiedPresence.push(...data.unifiedPresence);
        });

        // Compute Effective Presence Stats (Synchronized with Attendance Log)
        const targetDate = date ? new Date(date) : new Date();
        const SECTOR_STATUSES = ['base', 'full', 'arrival', 'departure'];

        const companyStats: Record<string, { present: number; total: number; home: number }> = {};
        let totalPresent = 0;
        let totalHome = 0;
        let totalActive = 0;

        companies.forEach(c => {
            companyStats[c.id] = { present: 0, total: 0, home: 0 };
        });

        people.forEach(p => {
            if (p.isActive === false) return;
            totalActive++;

            const dateStr = targetDate.toLocaleDateString('en-CA');
            const presence = unifiedPresence.find(up => up.person_id === p.id && up.date === dateStr);

            // Fallback to getEffectiveAvailability if data for this date isn't in unifiedPresence cache
            const status = presence ? presence.status : getEffectiveAvailability(p, targetDate, teamRotations, absences, hourlyBlockages).status;
            const isPresent = SECTOR_STATUSES.includes(status);

            if (isPresent) totalPresent++;
            else totalHome++;

            if (p.organization_id && companyStats[p.organization_id]) {
                companyStats[p.organization_id].total++;
                if (isPresent) companyStats[p.organization_id].present++;
                else companyStats[p.organization_id].home++;
            }
        });

        const computedStats = {
            totalActive,
            totalPresent,
            totalHome,
            unreportedCount: Math.max(0, totalActive - (presenceSummary?.length || 0)),
            companyStats
        };

        console.log('useBattalionData: Aggregation Complete', {
            companiesCount: companies.length,
            peopleCount: people.length,
            presenceSummaryCount: presenceSummary?.length,
            computedPresent: totalPresent
        });

        return {
            companies,
            people,
            teams,
            teamRotations,
            absences,
            hourlyBlockages,
            roles,
            shifts,
            taskTemplates,
            constraints,
            missionReports,
            equipment,
            equipmentDailyChecks,
            presenceSummary,
            unifiedPresence,
            computedStats,
            battalion
        };
    }, [companyQueries, companies, isAnyCompanyLoading, presenceSummary, date, battalion]);

    return {
        ...aggregatedData,
        isLoading: isLoadingBattalion || isLoadingCompanies || isAnyCompanyLoading || isLoadingPresence
    };
};
