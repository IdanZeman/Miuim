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

    const [
        { data: people },
        { data: teams },
        { data: rotations },
        { data: absences },
        { data: hourlyBlockages },
        { data: roles },
        { data: shifts },
        { data: tasks },
        { data: constraints },
        { data: settings },
        { data: reports },
        { data: equipment },
        { data: checks }
    ] = await Promise.all([
        supabase.from('people').select('*').eq('organization_id', organizationId),
        supabase.from('teams').select('*').eq('organization_id', organizationId),
        supabase.from('team_rotations').select('*').eq('organization_id', organizationId),
        supabase.from('absences').select('*').eq('organization_id', organizationId),
        supabase.from('hourly_blockages').select('*').eq('organization_id', organizationId),
        supabase.from('roles').select('*').eq('organization_id', organizationId),
        supabase.from('shifts').select('*').eq('organization_id', organizationId),
        supabase.from('task_templates').select('*').eq('organization_id', organizationId),
        supabase.from('scheduling_constraints').select('*').eq('organization_id', organizationId),
        supabase.from('organization_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
        supabase.from('mission_reports').select('*').eq('organization_id', organizationId),
        supabase.from('equipment').select('*').eq('organization_id', organizationId),
        supabase.from('equipment_daily_checks').select('*').eq('organization_id', organizationId)
    ]);

    let mappedPeople = (people || []).map(mapPersonFromDB);
    let mappedAbsences = (absences || []).map(mapAbsenceFromDB);
    let mappedBlockages = (hourlyBlockages || []).map(mapHourlyBlockageFromDB);
    let mappedConstraints = (constraints || []).map(mapConstraintFromDB);
    let mappedShifts = (shifts || []).map(mapShiftFromDB);
    let mappedEquipment = (equipment || []).map(mapEquipmentFromDB);
    let mappedReports = (reports || []).map(mapMissionReportFromDB);
    let mappedChecks = (checks || []).map(mapEquipmentDailyCheckFromDB);

    const taskTemplateList = (tasks || []).map(mapTaskFromDB);
    const allMappedPeople = (people || []).map(mapPersonFromDB);
    const allMappedShifts = (shifts || []).map(mapShiftFromDB);
    const allMappedAbsences = (absences || []).map(mapAbsenceFromDB);
    const allMappedBlockages = (hourlyBlockages || []).map(mapHourlyBlockageFromDB);
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
                    // Invalidate query to refetch fresh data
                    console.log('Realtime update detected: people');
                    queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
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
                    console.log('Realtime update detected: absences');
                    queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
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
                    queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
                }
            )
            // --- Expanded Subscriptions (Equipment, Shifts, Teams, etc.) ---
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: equipment');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_daily_checks', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: equipment_daily_checks');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: shifts');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            })
            // For shifts, we also want to know if tasks change
            .on('postgres_changes', { event: '*', schema: 'public', table: 'task_templates', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: task_templates');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_reports', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: mission_reports');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            })
            // Structural changes
            .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: teams');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'roles', filter: `organization_id=eq.${organizationId}` }, () => {
                console.log('Realtime update detected: roles');
                queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId, userId] });
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
