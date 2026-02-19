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
import { Person, Team, TeamRotation, Absence, Role, Shift, TaskTemplate, SchedulingConstraint, MissionReport, Equipment, OrganizationSettings, SystemMessage } from '../types';

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
    systemMessages: SystemMessage[];
}

export const fetchOrganizationData = async (organizationId: string, permissions?: any, userId?: string, dateRange?: { startDate: string, endDate: string }): Promise<OrganizationData> => {
    if (!organizationId) throw new Error('No organization ID provided');

    // Pass date range if exists
    const bundle = await organizationService.fetchOrgDataBundle(organizationId, dateRange?.startDate, dateRange?.endDate);

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
        equipment_daily_checks: checks,
        presence,
        system_messages: systemMessages
    } = bundle;

    let mappedPeople = (people || []).map(mapPersonFromDB);

    // CRITICAL FIX: Clear dailyAvailability before merging to prevent stale data
    // The presence data from the RPC is the source of truth, so we start fresh
    mappedPeople.forEach(person => {
        person.dailyAvailability = {};
    });

    // Merge real-time presence into daily availability
    // IMPORTANT: daily_presence is the source of truth for V1 - always use its data
    presence.forEach(p => {
        const person = mappedPeople.find(mp => mp.id === p.person_id);
        if (person) {
            if (!person.dailyAvailability) person.dailyAvailability = {};
            const dateKey = p.date;

            // USE V2 STATE IF PRESENT (Source of truth for attendance consistency)
            const effectiveStatus = p.v2_state || p.status;
            const isAvailable = effectiveStatus === 'base' || effectiveStatus === 'full' || effectiveStatus === 'arrival' || effectiveStatus === 'departure';

            person.dailyAvailability[dateKey] = {
                status: effectiveStatus,
                startHour: p.start_time || '00:00',
                endHour: p.end_time || '23:59',
                source: p.source || 'algorithm',
                homeStatusType: p.home_status_type,
                isAvailable: isAvailable,
                // Actual times
                actual_arrival_at: p.actual_arrival_at,
                actual_departure_at: p.actual_departure_at,
                reported_location_id: p.reported_location_id,
                reported_location_name: p.reported_location_name,
                unavailableBlocks: [],
                v2_state: p.v2_state,
                v2_sub_state: p.v2_sub_state
            };
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

    // CRITICAL FIX: Clear dailyAvailability before merging
    allMappedPeople.forEach(person => {
        person.dailyAvailability = {};
    });

    // RE-MERGE presence into allMappedPeople as well
    // IMPORTANT: daily_presence is the source of truth for V1 - always use its data
    presence.forEach(p => {
        const person = allMappedPeople.find(mp => mp.id === p.person_id);
        if (person) {
            if (!person.dailyAvailability) person.dailyAvailability = {};
            const dateKey = p.date;

            // USE V2 STATE IF PRESENT
            const effectiveStatus = p.v2_state || p.status;
            const isAvailable = effectiveStatus === 'base' || effectiveStatus === 'full' || effectiveStatus === 'arrival' || effectiveStatus === 'departure';

            person.dailyAvailability[dateKey] = {
                status: effectiveStatus,
                startHour: p.start_time || '00:00',
                endHour: p.end_time || '23:59',
                source: p.source || 'algorithm',
                homeStatusType: p.home_status_type,
                isAvailable: isAvailable,
                actual_arrival_at: p.actual_arrival_at,
                actual_departure_at: p.actual_departure_at,
                reported_location_id: p.reported_location_id,
                reported_location_name: p.reported_location_name,
                unavailableBlocks: [],
                v2_state: p.v2_state,
                v2_sub_state: p.v2_sub_state
            };
        }
    });

    const allMappedShifts = (shifts || []).map(mapShiftFromDB);
    const allMappedAbsences = (absences || []).map(mapAbsenceFromDB);
    const allMappedBlockages = (hourly_blockages || []).map(mapHourlyBlockageFromDB);
    const allMappedTasks = (tasks || []).map(mapTaskFromDB);
    const allMappedTeams = (teams || []).map(mapTeamFromDB);
    const allMappedRoles = (roles || []).map(mapRoleFromDB);

    const scope = permissions?.dataScope;
    const isRestrictedScope = scope && scope !== 'organization' && scope !== 'battalion';



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

        // Equipment filtering based on scope:
        // - personal: Only equipment assigned to me
        // - my_team/team: Equipment assigned to team members OR unassigned (available to all)
        const filteredEquipment = mappedEquipment.filter(e => {
            if (scope === 'personal') {
                // Personal scope: only my assigned equipment
                return e.assigned_to_id === targetPersonId;
            } else {
                // Team scope: team members' equipment OR unassigned equipment
                return !e.assigned_to_id || teamPersonIds.has(e.assigned_to_id);
            }
        });



        const teamEquipmentIds = new Set(filteredEquipment.map(e => e.id));
        const filteredChecks = mappedChecks.filter(c => teamEquipmentIds.has(c.equipment_id));



        return {
            ...boardData,
            missionReports: filteredReports,
            equipment: filteredEquipment,
            equipmentDailyChecks: filteredChecks,
            systemMessages: systemMessages || []
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
        equipmentDailyChecks: mappedChecks,
        systemMessages: systemMessages || []
    };
};

export const useOrganizationData = (organizationId?: string | null, permissions?: any, userId?: string, dateRange?: { startDate: string, endDate: string }) => {
    const result = useQuery({
        queryKey: ['organizationData', organizationId, userId, dateRange?.startDate, dateRange?.endDate],
        queryFn: () => fetchOrganizationData(organizationId!, permissions, userId, dateRange),
        enabled: !!organizationId,
        staleTime: 1000 * 60 * 5, // 5 Minutes (increased since we have realtime)
        placeholderData: (previousData) => previousData, // Keep previous data while fetching new range
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
            }, 1000); // Reduced from 3s to 1s for better responsiveness
        };

        // Immediate invalidation for critical real-time updates (attendance, shifts)
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
            // CRITICAL: Shifts updates now use immediateInvalidate
            .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `organization_id=eq.${organizationId}` }, () => {
                immediateInvalidate();
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
            // NEW: Add missing structural subscriptions
            .on('postgres_changes', { event: '*', schema: 'public', table: 'team_rotations', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduling_constraints', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organization_settings', filter: `organization_id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations', filter: `id=eq.${organizationId}` }, () => {
                debouncedInvalidate();
            })
            // CRITICAL: Attendance updates now use immediateInvalidate for better user experience
            .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_presence', filter: `organization_id=eq.${organizationId}` }, () => {
                immediateInvalidate();
            })
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`✅ [Realtime] Subscribed to org-updates-${organizationId}`);
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`❌ [Realtime] Subscription error for org-${organizationId}:`, err);
                    // Fallback: Force invalidation if realtime fails so user gets data
                    immediateInvalidate();
                } else if (status === 'TIMED_OUT') {
                    console.warn(`⚠️ [Realtime] Subscription timed out for org-${organizationId}`);
                    immediateInvalidate();
                } else if (status === 'CLOSED') {
                    console.log(`[Realtime] Channel closed for org-${organizationId}`);
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
        systemMessages: result.data?.systemMessages || [],
    };
};
