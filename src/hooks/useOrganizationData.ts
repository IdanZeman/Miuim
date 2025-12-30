import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../features/auth/AuthContext';
import { 
    Person, Shift, TaskTemplate, Role, Team, 
    SchedulingConstraint, TeamRotation, Absence, Equipment, MissionReport 
} from '../types';
import { 
    mapPersonFromDB, mapShiftFromDB, mapTaskFromDB, 
    mapRoleFromDB, mapTeamFromDB, mapConstraintFromDB, 
    mapRotationFromDB, mapAbsenceFromDB, mapEquipmentFromDB, mapHourlyBlockageFromDB, mapMissionReportFromDB
} from '../services/supabaseClient';

// Helper to calculate data scoping (Duplicated from App.tsx for safety)
const applyDataScoping = (
    profile: any, 
    user: any, 
    people: Person[], 
    shifts: Shift[], 
    equipment: Equipment[]
) => {
    const dataScope = profile?.permissions?.dataScope || 'organization';
    const allowedTeamIds = profile?.permissions?.allowedTeamIds || [];

    if (dataScope === 'organization') {
        return { scopedPeople: people, scopedShifts: shifts, scopedEquipment: equipment };
    } 
    
    if (dataScope === 'team') {
        const scopedPeople = people.filter(p =>
            (p.teamId && allowedTeamIds.includes(p.teamId)) ||
            p.userId === user?.id ||
            (p as any).email === user?.email
        );
        const visiblePersonIds = scopedPeople.map(p => p.id);
        const scopedShifts = shifts.filter(s =>
            s.assignedPersonIds.some(pid => visiblePersonIds.includes(pid)) ||
            s.assignedPersonIds.length === 0
        );
        const scopedEquipment = equipment.filter(e =>
            !e.assigned_to_id || visiblePersonIds.includes(e.assigned_to_id)
        );
        return { scopedPeople, scopedShifts, scopedEquipment };
    } 
    
    if (dataScope === 'personal') {
        const myPerson = people.find(p => p.userId === user?.id || (p as any).email === user?.email);
        if (myPerson) {
            return {
                scopedPeople: [myPerson],
                scopedShifts: shifts.filter(s => s.assignedPersonIds.includes(myPerson.id)),
                scopedEquipment: equipment.filter(e => e.assigned_to_id === myPerson.id)
            };
        }
        return { scopedPeople: [], scopedShifts: [], scopedEquipment: [] };
    }

    return { scopedPeople: people, scopedShifts: shifts, scopedEquipment: equipment };
};

export const useOrganizationData = () => {
    const { organization, profile, user } = useAuth();
    const queryClient = useQueryClient();

    const isEnabled = !!organization?.id;

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['organizationData', organization?.id],
        queryFn: async () => {
            if (!organization) throw new Error('No organization');

            // 1. Parallel Fetch of ALL required data
            const [
                peopleRes, tasksRes, rolesRes, teamsRes, settingsRes,
                constraintsRes, rotationsRes, absencesRes, equipmentRes,
                hourlyBlockagesRes, shiftsRes, missionReportsRes
            ] = await Promise.all([
                supabase.from('people').select('*').eq('organization_id', organization.id),
                supabase.from('task_templates').select('*').eq('organization_id', organization.id),
                supabase.from('roles').select('*').eq('organization_id', organization.id),
                supabase.from('teams').select('*').eq('organization_id', organization.id),
                supabase.from('organization_settings').select('*').eq('organization_id', organization.id).maybeSingle(),
                supabase.from('scheduling_constraints').select('*').eq('organization_id', organization.id),
                supabase.from('team_rotations').select('*').eq('organization_id', organization.id),
                supabase.from('absences').select('*').eq('organization_id', organization.id),
                supabase.from('equipment').select('*').eq('organization_id', organization.id),
                supabase.from('hourly_blockages').select('*').eq('organization_id', organization.id),
                // Fetch last 3 months of shifts for history
                supabase.from('shifts').select('*')
                    .eq('organization_id', organization.id)
                    .eq('organization_id', organization.id)
                    .gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
                supabase.from('mission_reports').select('*').eq('organization_id', organization.id)
            ]);

            return {
                people: peopleRes.data || [],
                shifts: shiftsRes.data || [],
                tasks: tasksRes.data || [],
                roles: rolesRes.data || [],
                teams: teamsRes.data || [],
                settings: settingsRes.data || null,
                constraints: constraintsRes.data || [],
                rotations: rotationsRes.data || [],
                absences: absencesRes.data || [],
                equipment: equipmentRes.data || [],
                hourlyBlockages: hourlyBlockagesRes.data || [],
                missionReports: missionReportsRes.data || []
            };
        },
        enabled: isEnabled,
        staleTime: 1000 * 60 * 5, // 5 Minutes
    });

    // 2. Map & Scope Data (Memoized)
    const processedData = React.useMemo(() => {
        if (!data) return null;

        const rawPeople = (data.people || []).map(mapPersonFromDB);
        const rawShifts = (data.shifts || []).map(mapShiftFromDB);
        const rawEquipment = (data.equipment || []).map(mapEquipmentFromDB);

        const { scopedPeople, scopedShifts, scopedEquipment } = applyDataScoping(
            profile, user, rawPeople, rawShifts, rawEquipment
        );

        return {
            people: scopedPeople,
            allPeople: rawPeople,
            shifts: scopedShifts,
            taskTemplates: (data.tasks || []).map(mapTaskFromDB),
            roles: (data.roles || []).map(mapRoleFromDB),
            teams: (data.teams || []).map(mapTeamFromDB),
            settings: (data.settings as any) || null,
            constraints: (data.constraints || []).map(mapConstraintFromDB),
            teamRotations: (data.rotations || []).map(mapRotationFromDB),
            absences: (data.absences || []).map(mapAbsenceFromDB),
            hourlyBlockages: (data.hourlyBlockages || []).map(mapHourlyBlockageFromDB),
            missionReports: (data.missionReports || []).map(mapMissionReportFromDB),
            equipment: scopedEquipment
        };
    }, [data, profile, user]);

    return {
        ...processedData,
        // Safe fallbacks if processing hasn't happened yet
        people: processedData?.people || [],
        allPeople: processedData?.allPeople || [],
        shifts: processedData?.shifts || [],
        taskTemplates: processedData?.taskTemplates || [],
        roles: processedData?.roles || [],
        teams: processedData?.teams || [],
        settings: processedData?.settings || null,
        constraints: processedData?.constraints || [],
        teamRotations: processedData?.teamRotations || [],
        absences: processedData?.absences || [],
        missionReports: processedData?.missionReports || [],
        equipment: processedData?.equipment || [],
        isLoading,
        error,
        refetch
    };
};
