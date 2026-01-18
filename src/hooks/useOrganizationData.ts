import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
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

    console.time('⚡ fetchOrganizationData (RPC)');
    const { data: bundle, error } = await supabase.rpc('get_org_data_bundle', { p_org_id: organizationId });
    console.timeEnd('⚡ fetchOrganizationData (RPC)');

    if (error) throw error;

    // Log payload size for performance analysis
    const sizeInKB = Math.round(JSON.stringify(bundle).length / 1024);
    console.log(`📦 Data Bundle Size: ~${sizeInKB}KB`);

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
    let mappedAbsences = (absences || []).map(mapAbsenceFromDB);
    let mappedBlockages = (hourly_blockages || []).map(mapHourlyBlockageFromDB);
    let mappedConstraints = (constraints || []).map(mapConstraintFromDB);
    let mappedShifts = (shifts || []).map(mapShiftFromDB);
    let mappedEquipment = (equipment || []).map(mapEquipmentFromDB);
    let mappedReports = (reports || []).map(mapMissionReportFromDB);
    let mappedChecks = (checks || []).map(mapEquipmentDailyCheckFromDB);

    const scope = permissions?.dataScope;
    const isRestrictedScope = scope && scope !== 'organization';

    if (isRestrictedScope) {
        let targetTeamIds: string[] = [];
        let targetPersonId: string | null = null;

        if (scope === 'my_team' && userId) {
            const myPerson = mappedPeople.find(p => p.userId === userId || p.id === userId);
            if (myPerson?.teamId) targetTeamIds = [myPerson.teamId];
        } else if (scope === 'team') {
            targetTeamIds = permissions.allowedTeamIds || [];
        } else if (scope === 'personal' && userId) {
            const myPerson = mappedPeople.find(p => p.userId === userId || p.id === userId);
            if (myPerson) {
                targetPersonId = myPerson.id;
                // For personal scope, we still want to see the team's tasks on the board
                if (myPerson.teamId) targetTeamIds = [myPerson.teamId];
            }
        }

        const taskTemplateList = (tasks || []).map(mapTaskFromDB);
        const filteredTasks = taskTemplateList.filter(t => {
            if (!t.assignedTeamId) return true; // Everyone
            if (targetTeamIds.length > 0) return targetTeamIds.includes(t.assignedTeamId);
            return false;
        });

        if (targetTeamIds.length > 0) {
            // Filter People by Team
            mappedPeople = mappedPeople.filter(p => p.teamId && targetTeamIds.includes(p.teamId));

            // Filter Data by Team Members
            const teamPersonIds = new Set(mappedPeople.map(p => p.id));
            const teamProfileIds = new Set(mappedPeople.map(p => p.userId).filter(Boolean) as string[]);

            mappedAbsences = mappedAbsences.filter(a => teamPersonIds.has(a.person_id));
            mappedBlockages = mappedBlockages.filter(b => teamPersonIds.has(b.person_id));
            mappedConstraints = mappedConstraints.filter(c => c.personId && teamPersonIds.has(c.personId));
            mappedShifts = mappedShifts.filter(s => s.assignedPersonIds.some(pid => teamPersonIds.has(pid)));
            mappedEquipment = mappedEquipment.filter(e => e.assigned_to_id && teamPersonIds.has(e.assigned_to_id));

            const teamShiftIds = new Set(mappedShifts.map(s => s.id));
            mappedReports = mappedReports.filter(r =>
                (r.submitted_by && teamProfileIds.has(r.submitted_by)) ||
                teamShiftIds.has(r.shift_id)
            );

            const teamEquipmentIds = new Set(mappedEquipment.map(e => e.id));
            mappedChecks = mappedChecks.filter(c => teamEquipmentIds.has(c.equipment_id));

            return {
                people: mappedPeople,
                allPeople: (people || []).map(mapPersonFromDB), // Unscoped for lottery
                teams: (teams || []).map(mapTeamFromDB).filter(t => targetTeamIds.includes(t.id)),
                rotations: (rotations || []).map(mapRotationFromDB).filter(r => targetTeamIds.includes(r.team_id)),
                absences: mappedAbsences,
                hourlyBlockages: mappedBlockages,
                roles: (roles || []).map(mapRoleFromDB), // Roles are generally organization-wide but entries are scoped
                shifts: mappedShifts,
                taskTemplates: filteredTasks,
                constraints: mappedConstraints,
                settings: settings ? mapOrganizationSettingsFromDB(settings) : null,
                missionReports: mappedReports,
                equipment: mappedEquipment,
                equipmentDailyChecks: mappedChecks
            };
        } else if (targetPersonId) {
            // Filter People to just me
            mappedPeople = mappedPeople.filter(p => p.id === targetPersonId);

            // Filter Data to just me
            mappedAbsences = mappedAbsences.filter(a => a.person_id === targetPersonId);
            mappedBlockages = mappedBlockages.filter(b => b.person_id === targetPersonId);
            mappedConstraints = mappedConstraints.filter(c => c.personId === targetPersonId);
            mappedShifts = mappedShifts.filter(s => s.assignedPersonIds.includes(targetPersonId));
            mappedEquipment = mappedEquipment.filter(e => e.assigned_to_id === targetPersonId);

            const myShiftIds = new Set(mappedShifts.map(s => s.id));
            mappedReports = mappedReports.filter(r =>
                (userId && r.submitted_by === userId) ||
                myShiftIds.has(r.shift_id)
            );

            const myEquipmentIds = new Set(mappedEquipment.map(e => e.id));
            mappedChecks = mappedChecks.filter(c => myEquipmentIds.has(c.equipment_id));

            return {
                people: mappedPeople,
                allPeople: (people || []).map(mapPersonFromDB), // Unscoped for lottery
                teams: (teams || []).map(mapTeamFromDB).filter(t => mappedPeople.some(p => p.teamId === t.id)),
                rotations: (rotations || []).map(mapRotationFromDB).filter(r => mappedPeople.some(p => p.teamId === r.team_id)),
                absences: mappedAbsences,
                hourlyBlockages: mappedBlockages,
                roles: (roles || []).map(mapRoleFromDB),
                shifts: mappedShifts,
                taskTemplates: filteredTasks,
                constraints: mappedConstraints,
                settings: settings ? mapOrganizationSettingsFromDB(settings) : null,
                missionReports: mappedReports,
                equipment: mappedEquipment,
                equipmentDailyChecks: mappedChecks
            };
        } else {
            return {
                people: [],
                allPeople: (people || []).map(mapPersonFromDB),
                teams: [],
                rotations: [],
                absences: [],
                hourlyBlockages: [],
                roles: [],
                shifts: [],
                taskTemplates: [],
                constraints: [],
                settings: null,
                missionReports: [],
                equipment: [],
                equipmentDailyChecks: []
            };
        }
    }

    return {
        people: mappedPeople,
        allPeople: (people || []).map(mapPersonFromDB),
        teams: (teams || []).map(mapTeamFromDB),
        rotations: (rotations || []).map(mapRotationFromDB),
        absences: mappedAbsences,
        hourlyBlockages: mappedBlockages,
        roles: (roles || []).map(mapRoleFromDB),
        shifts: mappedShifts,
        taskTemplates: (tasks || []).map(mapTaskFromDB),
        constraints: mappedConstraints,
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
                console.log('🔄 Realtime update: Refetching organization data...');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            }, 1000); // 1 second debounce
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
                    console.log('Realtime update detected');
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
                    console.log('Realtime update detected: hourly_blockages');
                    debouncedInvalidate();
                }
            )
            // --- Expanded Subscriptions (Equipment, Shifts, Teams, etc.) ---
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: equipment');
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_daily_checks', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: equipment_daily_checks');
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: shifts');
                debouncedInvalidate();
            })
            // For shifts, we also want to know if tasks change
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: task_templates');
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_reports', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: mission_reports');
                debouncedInvalidate();
            })
            // Structural changes
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: teams');
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: roles');
                debouncedInvalidate();
            })
            .subscribe((status) => {
                console.log(`Supabase Realtime Connection Status: ${status}`);
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ Listening for changes on ALL tables for org: ${organizationId}`);
                }
                if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Realtime connection failed. Check your network or Supabase settings.');
                }
            });

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
