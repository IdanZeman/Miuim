import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { 
    Person, Shift, TaskTemplate, Role, Team, 
    SchedulingConstraint, TeamRotation, Absence, Equipment 
} from '../types';
import { 
    mapPersonFromDB, mapShiftFromDB, mapTaskFromDB, 
    mapRoleFromDB, mapTeamFromDB, mapConstraintFromDB, 
    mapRotationFromDB, mapAbsenceFromDB, mapEquipmentFromDB 
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
                shiftsRes
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
                // Fetch last 3 months of shifts for history
                supabase.from('shifts').select('*')
                    .eq('organization_id', organization.id)
                    .gte('start_time', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            ]);

            // 2. Map Raw Data
            const rawPeople = (peopleRes.data || []).map(mapPersonFromDB);
            const rawShifts = (shiftsRes.data || []).map(mapShiftFromDB);
            const rawEquipment = (equipmentRes.data || []).map(mapEquipmentFromDB);

            // 3. Apply Scoping
            const { scopedPeople, scopedShifts, scopedEquipment } = applyDataScoping(
                profile, user, rawPeople, rawShifts, rawEquipment
            );

            return {
                people: scopedPeople,
                allPeople: rawPeople, // For admins/lottery
                shifts: scopedShifts,
                taskTemplates: (tasksRes.data || []).map(mapTaskFromDB),
                roles: (rolesRes.data || []).map(mapRoleFromDB),
                teams: (teamsRes.data || []).map(mapTeamFromDB),
                settings: (settingsRes.data as any) || null,
                constraints: (constraintsRes.data || []).map(mapConstraintFromDB),
                teamRotations: (rotationsRes.data || []).map(mapRotationFromDB),
                absences: (absencesRes.data || []).map(mapAbsenceFromDB),
                equipment: scopedEquipment
            };
        },
        enabled: isEnabled,
        staleTime: 1000 * 60 * 5, // 5 Minutes
    });

    return {
        ...data,
        isLoading,
        error,
        refetch
    };
};
