import { useQuery } from '@tanstack/react-query';
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

export const fetchOrganizationData = async (organizationId: string): Promise<OrganizationData> => {
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

    const mappedPeople = (people || []).map(mapPersonFromDB);

    return {
        people: mappedPeople,
        allPeople: mappedPeople, // For lottery, usually same unless a broader fetch is needed
        teams: (teams || []).map(mapTeamFromDB),
        rotations: (rotations || []).map(mapRotationFromDB),
        absences: (absences || []).map(mapAbsenceFromDB),
        hourlyBlockages: (hourlyBlockages || []).map(mapHourlyBlockageFromDB),
        roles: (roles || []).map(mapRoleFromDB),
        shifts: (shifts || []).map(mapShiftFromDB),
        taskTemplates: (tasks || []).map(mapTaskFromDB),
        constraints: (constraints || []).map(mapConstraintFromDB),
        settings: settings ? mapOrganizationSettingsFromDB(settings) : null,
        missionReports: (reports || []).map(mapMissionReportFromDB),
        equipment: (equipment || []).map(mapEquipmentFromDB),
        equipmentDailyChecks: (checks || []).map(mapEquipmentDailyCheckFromDB)
    };
};

export const useOrganizationData = (organizationId?: string | null) => {
    return useQuery({
        queryKey: ['organizationData', organizationId],
        queryFn: () => fetchOrganizationData(organizationId!),
        enabled: !!organizationId,
        staleTime: 1000 * 30, // 30 Seconds - Reduced for better responsiveness
    });
};
