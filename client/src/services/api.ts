import { SchedulingConstraint, Absence, HourlyBlockage } from '@/types';
import { mapAbsenceFromDB, mapAbsenceToDB, mapHourlyBlockageFromDB, mapHourlyBlockageToDB, mapConstraintFromDB, mapConstraintToDB, mapDailyPresenceFromDB } from './mappers';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

// Constraints
export const fetchConstraints = async (organizationId: string): Promise<SchedulingConstraint[]> => {
    const data = await callBackend('/api/scheduling/constraints', 'GET', { orgId: organizationId });
    return data.map(mapConstraintFromDB);
};

export const addConstraint = async (constraint: Omit<SchedulingConstraint, 'id'>) => {
    const dbPayload = mapConstraintToDB(constraint as SchedulingConstraint);
    const data = await callAdminRpc('upsert_constraint', {
        p_id: null,
        p_person_id: dbPayload.person_id ?? null,
        p_team_id: dbPayload.team_id ?? null,
        p_role_id: dbPayload.role_id ?? null,
        p_type: dbPayload.type,
        p_start_time: dbPayload.start_time ?? null,
        p_end_time: dbPayload.end_time ?? null,
        p_task_id: dbPayload.task_id,
        p_description: dbPayload.description
    });

    return mapConstraintFromDB(data);
};

export const deleteConstraint = async (id: string) => {
    await callAdminRpc('delete_constraint_secure', { p_constraint_id: id });
};

// Absences CRUD
export const fetchAbsences = async (organizationId: string): Promise<Absence[]> => {
    const data = await callBackend('/api/scheduling/absences', 'GET', { orgId: organizationId });
    return data.map(mapAbsenceFromDB);
};

export const addAbsence = async (absence: Omit<Absence, 'id'>) => {
    const data = await callAdminRpc('upsert_absence', {
        p_id: null,
        p_person_id: absence.person_id,
        p_start_date: absence.start_date,
        p_end_date: absence.end_date,
        p_reason: absence.reason,
        p_status: absence.status,
        p_type: null
    });

    return mapAbsenceFromDB(data);
};

export const updateAbsence = async (absence: Absence) => {
    await callAdminRpc('upsert_absence', {
        p_id: absence.id,
        p_person_id: absence.person_id,
        p_start_date: absence.start_date,
        p_end_date: absence.end_date,
        p_reason: absence.reason,
        p_status: absence.status,
        p_type: null
    });
};

export const deleteAbsence = async (id: string) => {
    await callAdminRpc('delete_absence_secure', { p_absence_id: id });
};
// Daily Presence
export const upsertDailyPresence = async (updates: any[]) => {
    if (updates.length === 0) return;
    return await callBackend('/api/attendance/upsert', 'POST', updates);
};

export const fetchDailyPresence = async (organizationId: string, startDate?: string, endDate?: string): Promise<import('@/types').DailyPresence[]> => {
    const data = await callBackend('/api/attendance', 'GET', { orgId: organizationId, startDate, endDate });
    return (data || []).map(mapDailyPresenceFromDB);
};

// Hourly Blockages CRUD
export const fetchHourlyBlockages = async (organizationId: string): Promise<HourlyBlockage[]> => {
    const data = await callBackend('/api/scheduling/blockages', 'GET', { orgId: organizationId });
    return data.map(mapHourlyBlockageFromDB);
};

export const addHourlyBlockage = async (block: Omit<HourlyBlockage, 'id'>) => {
    const dbPayload = mapHourlyBlockageToDB(block as HourlyBlockage);
    const data = await callAdminRpc('upsert_hourly_blockage', {
        p_id: null,
        p_person_id: dbPayload.person_id,
        p_date: dbPayload.date,
        p_start_time: dbPayload.start_time,
        p_end_time: dbPayload.end_time,
        p_reason: dbPayload.reason || null
    });

    return mapHourlyBlockageFromDB(data);
};

export const updateHourlyBlockage = async (block: HourlyBlockage) => {
    const dbPayload = mapHourlyBlockageToDB(block);
    const data = await callAdminRpc('upsert_hourly_blockage', {
        p_id: block.id,
        p_person_id: dbPayload.person_id,
        p_date: dbPayload.date,
        p_start_time: dbPayload.start_time,
        p_end_time: dbPayload.end_time,
        p_reason: dbPayload.reason || null
    });

    return mapHourlyBlockageFromDB(data);
};

export const deleteHourlyBlockage = async (id: string) => {
    await callAdminRpc('delete_hourly_blockage_secure', { p_blockage_id: id });
};
