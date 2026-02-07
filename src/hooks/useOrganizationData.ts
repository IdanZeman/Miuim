import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { organizationService } from '../services/organizationService';
import {
    mapPersonFromDB,
    mapTeamFromDB,
    mapRotationFromDB,
    mapAbsenceFromDB,
    mapHourlyBlockageFromDB,
    mapRoleFromDB,
    mapShiftFromDB,
    mapTaskFromDB,
    mapConstraintFromDB,
    mapMissionReportFromDB,
    mapEquipmentFromDB,
    mapEquipmentDailyCheckFromDB,
    mapOrganizationSettingsFromDB
} from '../services/mappers';
import { fetchDailyPresence } from '../services/api';
import { Person, Team, TeamRotation, Absence, Role, Shift, TaskTemplate, SchedulingConstraint, MissionReport, Equipment, OrganizationSettings } from '../types';

export interface OrganizationData {
    people: Person[];
    allPeople: Person[];
    teams: Team[];
    rotations: TeamRotation[];
    absences: Absence[];
    hourlyBlockages: any[];
    roles: Role[];
    shifts: Shift[];
    taskTemplates: TaskTemplate[];
    constraints: SchedulingConstraint[];
    settings: OrganizationSettings | null;
    missionReports: MissionReport[];
    equipment: Equipment[];
    equipmentDailyChecks: any[];
}

export const fetchOrganizationData = async (organizationId: string, permissions?: any, userId?: string): Promise<OrganizationData> => {
    if (!organizationId) throw new Error('No organization ID provided');

    const [bundle, presence] = await Promise.all([
        organizationService.fetchOrgDataBundle(organizationId),
        fetchDailyPresence(organizationId, 
            new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Last 45 days
        )
    ]);


    const {
        people,
        teams,
        rotations,
        absences,
        hourly_blockages,
        roles,
        shifts,
        task_templates: tasks,
        scheduling_constraints: constraints,
        settings,
        mission_reports: reports,
        equipment,
        equipment_daily_checks: checks
    } = bundle;

    let mappedPeople = (people || []).map(mapPersonFromDB);

    // Merge real-time presence into daily availability
    presence.forEach(p => {
        const person = mappedPeople.find(mp => mp.id === p.person_id);
        if (person) {
            if (!person.dailyAvailability) person.dailyAvailability = {};
            const dateKey = p.date;
            if (!person.dailyAvailability[dateKey]) {
                // If no manual entry exists, create a virtual one to hold the actual times
                // This won't override algorithm logic but will provide the 'actual' fields
                person.dailyAvailability[dateKey] = { 
                    isAvailable: true, 
                    startHour: '00:00', 
                    endHour: '23:59', 
                    source: 'algorithm' 
                };
            }
            person.dailyAvailability[dateKey].actual_arrival_at = p.actual_arrival_at;
            person.dailyAvailability[dateKey].actual_departure_at = p.actual_departure_at;
            person.dailyAvailability[dateKey].reported_location_id = p.reported_location_id;
            person.dailyAvailability[dateKey].reported_location_name = p.reported_location_name;
        }
    });

    let mappedAbsences = (absences || []).map(mapAbsenceFromDB);
    let mappedBlockages = (hourly_blockages || []).map(mapHourlyBlockageFromDB);
    let mappedConstraints = (constraints || []).map(mapConstraintFromDB);
    let mappedShifts = (shifts || []).map(mapShiftFromDB);
    let mappedEquipment = (equipment || []).map(mapEquipmentFromDB);
    let mappedReports = (reports || []).map(mapMissionReportFromDB);
    let mappedChecks = (checks || []).map(mapEquipmentDailyCheckFromDB);

    const taskTemplateList = (tasks || []).map(mapTaskFromDB);
    const allMappedPeople = (people || []).map(mapPersonFromDB);
    
    // RE-MERGE presence into allMappedPeople as well
    presence.forEach(p => {
        const person = allMappedPeople.find(mp => mp.id === p.person_id);
        if (person) {
            if (!person.dailyAvailability) person.dailyAvailability = {};
            const dateKey = p.date;
            if (!person.dailyAvailability[dateKey]) {
                person.dailyAvailability[dateKey] = { isAvailable: true, startHour: '00:00', endHour: '23:59', source: 'algorithm' };
            }
            person.dailyAvailability[dateKey].actual_arrival_at = p.actual_arrival_at;
            person.dailyAvailability[dateKey].actual_departure_at = p.actual_departure_at;
            person.dailyAvailability[dateKey].reported_location_id = p.reported_location_id;
            person.dailyAvailability[dateKey].reported_location_name = p.reported_location_name;
        }
    });

    const allMappedShifts = (shifts || []).map(mapShiftFromDB);
    const allMappedAbsences = (absences || []).map(mapAbsenceFromDB);
    const allMappedBlockages = (hourly_blockages || []).map(mapHourlyBlockageFromDB);
    const allMappedTasks = (tasks || []).map(mapTaskFromDB);
    const allMappedTeams = (teams || []).map(mapTeamFromDB);
    const allMappedRoles = (roles || []).map(mapRoleFromDB);

    const scope = permissions?.dataScope;
    const isRestrictedScope = scope && scope !== 'organization';

    if (isRestrictedScope) {
        let targetTeamIds: string[] = [];
        let targetPersonId: string | null = null;

        if (scope === 'my_team' && userId) {
            const myPerson = allMappedPeople.find(p => p.userId === userId || p.id === userId);
            if (myPerson?.teamId) targetTeamIds = [myPerson.teamId];
        } else if (scope === 'team') {
            targetTeamIds = permissions.allowedTeamIds || [];
        } else if (scope === 'personal' && userId) {
            const myPerson = allMappedPeople.find(p => p.userId === userId || p.id === userId);
            if (myPerson) targetPersonId = myPerson.id;
        }

        // Identify current user's direct context for restricted data filtering
        const teamPersonIds = targetTeamIds.length > 0 
            ? new Set(allMappedPeople.filter(p => p.teamId && targetTeamIds.includes(p.teamId)).map(p => p.id))
            : new Set(targetPersonId ? [targetPersonId] : []);
            
        const teamProfileIds = targetTeamIds.length > 0
            ? new Set(allMappedPeople.filter(p => p.teamId && targetTeamIds.includes(p.teamId)).map(p => p.userId).filter(Boolean) as string[])
            : new Set(userId ? [userId] : []);

        // BOARD ENTITIES (Always FULL Visibility)
        const boardData = {
            people: allMappedPeople,
            allPeople: allMappedPeople,
            teams: allMappedTeams,
            rotations: (rotations || []).map(mapRotationFromDB).filter(r => {
                if (!isRestrictedScope) return true;
                if (targetTeamIds.length > 0) return targetTeamIds.includes(r.team_id);
                return true; // For personal scope, show all rotations on board
            }),
            absences: allMappedAbsences,
            hourlyBlockages: allMappedBlockages,
            roles: allMappedRoles,
            shifts: allMappedShifts,
            taskTemplates: allMappedTasks,
            constraints: (constraints || []).map(mapConstraintFromDB),
            settings: settings ? mapOrganizationSettingsFromDB(settings) : null,
        };

        // RESTRICTED ENTITIES (Scoped Visibility)
        const teamShiftIds = new Set(allMappedShifts.filter(s => s.assignedPersonIds.some(pid => teamPersonIds.has(pid))).map(s => s.id));
        
        const filteredReports = mappedReports.filter(r => 
            (r.submitted_by && teamProfileIds.has(r.submitted_by)) || 
            teamShiftIds.has(r.shift_id)
        );

        const filteredEquipment = mappedEquipment.filter(e => e.assigned_to_id && teamPersonIds.has(e.assigned_to_id));
        const teamEquipmentIds = new Set(filteredEquipment.map(e => e.id));
        const filteredChecks = mappedChecks.filter(c => teamEquipmentIds.has(c.equipment_id));

        return {
            ...boardData,
            missionReports: filteredReports,
            equipment: filteredEquipment,
            equipmentDailyChecks: filteredChecks
        };
    }

    return {
        people: allMappedPeople,
        allPeople: allMappedPeople,
        teams: allMappedTeams,
        rotations: (rotations || []).map(mapRotationFromDB),
        absences: allMappedAbsences,
        hourlyBlockages: allMappedBlockages,
        roles: allMappedRoles,
        shifts: allMappedShifts,
        taskTemplates: allMappedTasks,
        constraints: (constraints || []).map(mapConstraintFromDB),
        settings: settings ? mapOrganizationSettingsFromDB(settings) : null,
        missionReports: mappedReports,
        equipment: mappedEquipment,
        equipmentDailyChecks: mappedChecks
    };
};

export const useOrganizationData = (organizationId?: string | null, permissions?: any, userId?: string) => {
    const result = useQuery({
        queryKey: ['organizationData', organizationId, userId],
        queryFn: () => fetchOrganizationData(organizationId!, permissions, userId),
        enabled: !!organizationId,
        staleTime: 1000 * 30, // 30 Seconds - Reduced for better responsiveness
    });

    const queryClient = useQueryClient();

    // --- Real-time Subscription ---
    useEffect(() => {
        if (!organizationId) return;

        // Debounce invalidation to prevent flood during batch updates (like restore)
        let timeoutId: NodeJS.Timeout;
        const debouncedInvalidate = () => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            }, 3000); // 3 second debounce - increased from 1s to prevent read-after-write issues
        };

        // Immediate invalidation for critical real-time updates (attendance)
        const immediateInvalidate = () => {
            queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
        };

        const channel = supabase.channel(`org-updates-${organizationId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'people',
                    filter: `organization_id=eq.${organizationId}`
                },
                () => {
                    debouncedInvalidate();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'absences',
                    filter: `organization_id=eq.${organizationId}`
                },
                () => {
                    debouncedInvalidate();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'hourly_blockages',
                    filter: `organization_id=eq.${organizationId}`
                },
                () => {
                    debouncedInvalidate();
                }
            )
            // --- Expanded Subscriptions (Equipment, Shifts, Teams, etc.) ---
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_daily_checks', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            // For shifts, we also want to know if tasks change
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_reports', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            // Structural changes
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            // CRITICAL: Attendance updates now use debounce to prevent read-after-write issues
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_presence', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .subscribe();

        return () => {
            clearTimeout(timeoutId);
            supabase.removeChannel(channel);
        };
    }, [organizationId, userId, queryClient]);

    return {
        ...result,
        people: result.data?.people || [],
        allPeople: result.data?.allPeople || [],
        teams: result.data?.teams || [],
        teamRotations: result.data?.rotations || [],
        absences: result.data?.absences || [],
        hourlyBlockages: result.data?.hourlyBlockages || [],
        roles: result.data?.roles || [],
        shifts: result.data?.shifts || [],
        taskTemplates: result.data?.taskTemplates || [],
        constraints: result.data?.constraints || [],
        settings: result.data?.settings || null,
        missionReports: result.data?.missionReports || [],
        equipment: result.data?.equipment || [],
        equipmentDailyChecks: result.data?.equipmentDailyChecks || [],
    };
};
