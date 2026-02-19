import { Person, Role, Team, TaskTemplate, Shift, SchedulingConstraint, Absence, Equipment, TeamRotation, HourlyBlockage, MissionReport, DailyPresence, WarClockItem, SchedulingSegment } from '@/types';

// --- Mappers (App Types <-> DB Types) ---

// People
export const mapPersonFromDB = (p: any): Person => {
    let dailyAvailability = p.daily_availability || {};
    if (typeof dailyAvailability === 'string') {
        try { dailyAvailability = JSON.parse(dailyAvailability); } catch (e) { dailyAvailability = {}; }
    }

    let personalRotation = p.personal_rotation || undefined;
    if (typeof personalRotation === 'string') {
        try { personalRotation = JSON.parse(personalRotation); } catch (e) { personalRotation = undefined; }
    }

    let customFields = p.custom_fields || {};
    if (typeof customFields === 'string') {
        try { customFields = JSON.parse(customFields); } catch (e) { customFields = {}; }
    }

    return {
        id: p.id,
        name: p.name || '',
        phone: p.phone,
        email: p.email,
        isActive: p.is_active !== false,
        roleId: p.role_id || (p.role_ids && p.role_ids[0]) || '',
        roleIds: p.role_ids || [],
        teamId: p.team_id,
        userId: p.user_id,
        color: p.color || 'bg-blue-500',
        maxShiftsPerWeek: p.max_shifts_per_week || 5,
        dailyAvailability,
        personalRotation,
        organization_id: p.organization_id,
        customFields,
    };
};

export const mapPersonToDB = (p: Person) => ({
    id: p.id,
    name: p.name,
    phone: p.phone,
    email: p.email,
    is_active: p.isActive,
    role_ids: (p.roleIds && p.roleIds.length > 0) ? p.roleIds : (p.roleId ? [p.roleId] : []),
    team_id: p.teamId || null,
    user_id: p.userId,
    color: p.color,
    max_shifts_per_week: p.maxShiftsPerWeek,
    daily_availability: p.dailyAvailability,
    personal_rotation: p.personalRotation === undefined ? null : p.personalRotation,
    organization_id: p.organization_id,
    custom_fields: p.customFields || {},
});

// Teams
export const mapTeamFromDB = (t: any): Team => ({
    id: t.id,
    name: t.name || '',
    color: t.color || 'border-slate-500',
    organization_id: t.organization_id
});

export const mapTeamToDB = (t: Team) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    organization_id: (t as any).organization_id
});

// Roles
export const mapRoleFromDB = (r: any): Role => ({
    id: r.id,
    name: r.name || '',
    color: r.color || 'bg-slate-200',
    icon: r.icon
});

export const mapRoleToDB = (r: Role) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    icon: r.icon,
    organization_id: (r as any).organization_id
});

// Tasks
export const mapSegmentFromDB = (s: any): SchedulingSegment => {
    // Robust role composition mapping to handle roleId vs role_id
    const roleComposition = (s.role_composition ?? s.roleComposition ?? []).map((rc: any) => ({
        roleId: rc.roleId ?? rc.role_id ?? '',
        count: rc.count ?? 0
    }));

    // Ensure requiredPeople is at least the sum of role composition if it's 0/missing
    const compositionSum = roleComposition.reduce((sum: number, rc: any) => sum + rc.count, 0);
    const requiredPeople = s.required_people ?? s.requiredPeople ?? compositionSum;

    return {
        id: s.id,
        taskId: s.task_id ?? s.taskId,
        name: s.name,
        startTime: s.start_time ?? s.startTime,
        durationHours: s.duration_hours ?? s.durationHours ?? 4,
        frequency: s.frequency,
        daysOfWeek: s.days_of_week ?? s.daysOfWeek,
        specificDate: s.specific_date ?? s.specificDate,
        requiredPeople: requiredPeople === 0 ? compositionSum : requiredPeople,
        roleComposition,
        minRestHoursAfter: s.min_rest_hours_after ?? s.minRestHoursAfter ?? 8,
        isRepeat: s.is_repeat ?? s.isRepeat ?? false
    };
};

export const mapSegmentToDB = (s: SchedulingSegment) => ({
    id: s.id,
    task_id: s.taskId,
    name: s.name,
    start_time: s.startTime,
    duration_hours: s.durationHours,
    frequency: s.frequency,
    days_of_week: s.daysOfWeek,
    specific_date: s.specificDate,
    required_people: s.requiredPeople,
    role_composition: (s.roleComposition || []).map(rc => ({
        role_id: rc.roleId, // Persist as role_id for DB consistency
        roleId: rc.roleId,    // Keep roleId for frontend compatibility in JSONB
        count: rc.count
    })),
    min_rest_hours_after: s.minRestHoursAfter,
    is_repeat: s.isRepeat
});

export const mapTaskFromDB = (dbTask: any): TaskTemplate => {
    let rawSegments = [];
    if (typeof dbTask.segments === 'string') {
        try { rawSegments = JSON.parse(dbTask.segments); } catch (e) { rawSegments = []; }
    } else {
        rawSegments = dbTask.segments || [];
    }

    return {
        id: dbTask.id,
        name: dbTask.name || '',
        difficulty: dbTask.difficulty,
        color: dbTask.color,
        startDate: dbTask.start_date,
        endDate: dbTask.end_date,
        organization_id: dbTask.organization_id,
        is247: dbTask.is_24_7,
        segments: rawSegments.map(mapSegmentFromDB),
        assignedTeamId: dbTask.assigned_team_id,
        icon: dbTask.icon
    };
};

export const mapTaskToDB = (task: TaskTemplate) => ({
    id: task.id,
    name: task.name,
    difficulty: task.difficulty,
    color: task.color,
    start_date: task.startDate || null,
    end_date: task.endDate || null,
    organization_id: task.organization_id,
    is_24_7: task.is247,
    segments: (task.segments || []).map(mapSegmentToDB),
    assigned_team_id: task.assignedTeamId || null,
    icon: task.icon || null
});

// Shifts
export const mapShiftFromDB = (dbShift: any): Shift => ({
    id: dbShift.id,
    taskId: dbShift.task_id,
    segmentId: dbShift.segment_id,
    startTime: dbShift.start_time,
    endTime: dbShift.end_time,
    assignedPersonIds: dbShift.assigned_person_ids || [],
    isLocked: dbShift.is_locked,
    organization_id: dbShift.organization_id,
    isCancelled: dbShift.is_cancelled,
    requirements: dbShift.requirements,
    metadata: dbShift.metadata || {} // NEW
});

export const mapShiftToDB = (shift: Shift) => ({
    id: shift.id,
    task_id: shift.taskId,
    segment_id: shift.segmentId,
    start_time: shift.startTime,
    end_time: shift.endTime,
    assigned_person_ids: shift.assignedPersonIds,
    is_locked: shift.isLocked,
    organization_id: shift.organization_id,
    is_cancelled: shift.isCancelled,
    requirements: shift.requirements,
    metadata: shift.metadata // NEW
});

// Constraints
export const mapConstraintFromDB = (dbConstraint: any): SchedulingConstraint => ({
    id: dbConstraint.id,
    personId: dbConstraint.person_id,
    teamId: dbConstraint.team_id,
    roleId: dbConstraint.role_id,
    type: dbConstraint.type,
    taskId: dbConstraint.task_id,
    startTime: dbConstraint.start_time,
    endTime: dbConstraint.end_time,
    organization_id: dbConstraint.organization_id,
    description: dbConstraint.description
});

export const mapConstraintToDB = (constraint: SchedulingConstraint) => ({
    id: constraint.id,
    person_id: constraint.personId,
    team_id: constraint.teamId,
    role_id: constraint.roleId,
    type: constraint.type,
    task_id: constraint.taskId,
    start_time: constraint.startTime,
    end_time: constraint.endTime,
    organization_id: constraint.organization_id,
    description: constraint.description
});

// Team Rotations
export const mapRotationFromDB = (dbRot: any): import('@/types').TeamRotation => ({
    id: dbRot.id,
    organization_id: dbRot.organization_id,
    team_id: dbRot.team_id,
    days_on_base: dbRot.days_on_base,
    days_at_home: dbRot.days_at_home,
    cycle_length: dbRot.cycle_length,
    start_date: dbRot.start_date,
    end_date: dbRot.end_date,
    arrival_time: dbRot.arrival_time,
    departure_time: dbRot.departure_time
});

export const mapRotationToDB = (rot: TeamRotation) => ({
    id: rot.id,
    organization_id: rot.organization_id,
    team_id: rot.team_id,
    days_on_base: rot.days_on_base,
    days_at_home: rot.days_at_home,
    cycle_length: rot.cycle_length,
    start_date: rot.start_date,
    end_date: rot.end_date,
    arrival_time: rot.arrival_time,
    departure_time: rot.departure_time
});

// Absences
export const mapAbsenceFromDB = (dbAbsence: any): Absence => ({
    id: dbAbsence.id,
    person_id: dbAbsence.person_id,
    organization_id: dbAbsence.organization_id,
    start_date: dbAbsence.start_date,
    end_date: dbAbsence.end_date,
    start_time: dbAbsence.start_time || '00:00',
    end_time: dbAbsence.end_time || '23:59',
    reason: dbAbsence.reason,
    status: dbAbsence.status || 'pending',
    approved_by: dbAbsence.approved_by,
    approved_at: dbAbsence.approved_at,
    created_at: dbAbsence.created_at
});

export const mapAbsenceToDB = (absence: Absence) => ({
    id: absence.id,
    person_id: absence.person_id,
    organization_id: absence.organization_id,
    start_date: absence.start_date,
    end_date: absence.end_date,
    start_time: absence.start_time || '00:00',
    end_time: absence.end_time || '23:59',
    reason: absence.reason,
    status: absence.status || 'pending',
    approved_by: absence.approved_by,
    approved_at: absence.approved_at
});

// Equipment Mappers
export const mapEquipmentFromDB = (e: any): Equipment => ({
    id: e.id,
    organization_id: e.organization_id,
    type: e.type || '',
    serial_number: e.serial_number || '',
    assigned_to_id: e.assigned_to_id,
    signed_at: e.signed_at,
    last_verified_at: e.last_verified_at,
    status: e.status,
    notes: e.notes,
    created_by: e.created_by
});

export const mapEquipmentToDB = (e: Equipment) => ({
    id: e.id,
    organization_id: e.organization_id,
    type: e.type,
    serial_number: e.serial_number,
    assigned_to_id: e.assigned_to_id,
    signed_at: e.signed_at,
    last_verified_at: e.last_verified_at,
    status: e.status,
    notes: e.notes,
    created_by: e.created_by
});

// Equipment Daily Checks Mappers
export const mapEquipmentDailyCheckFromDB = (c: any): import('@/types').EquipmentDailyCheck => ({
    id: c.id,
    equipment_id: c.equipment_id,
    organization_id: c.organization_id,
    check_date: c.check_date,
    status: c.status,
    checked_by: c.checked_by,
    created_at: c.created_at,
    updated_at: c.updated_at
});

export const mapEquipmentDailyCheckToDB = (c: import('@/types').EquipmentDailyCheck) => ({
    id: c.id,
    equipment_id: c.equipment_id,
    organization_id: c.organization_id,
    check_date: c.check_date,
    status: c.status,
    checked_by: c.checked_by,
    created_at: c.created_at,
    updated_at: c.updated_at
});

// Hourly Blockages
export const mapHourlyBlockageFromDB = (dbBlock: any): HourlyBlockage => ({
    id: dbBlock.id,
    person_id: dbBlock.person_id,
    organization_id: dbBlock.organization_id,
    date: dbBlock.date,
    start_time: dbBlock.start_time,
    end_time: dbBlock.end_time,
    reason: dbBlock.reason,
    created_at: dbBlock.created_at
});

export const mapHourlyBlockageToDB = (block: HourlyBlockage) => ({
    id: block.id,
    person_id: block.person_id,
    organization_id: block.organization_id,
    date: block.date,
    start_time: block.start_time,
    end_time: block.end_time,
    reason: block.reason,
    // created_at is automatic
});

// Mission Reports
export const mapMissionReportFromDB = (db: any): MissionReport => ({
    id: db.id,
    organization_id: db.organization_id,
    shift_id: db.shift_id,
    summary: db.summary,
    exceptional_events: db.exceptional_events,
    points_to_preserve: db.points_to_preserve,
    points_to_improve: db.points_to_improve,
    cumulative_info: db.cumulative_info,
    ongoing_log: db.ongoing_log || [],
    submitted_by: db.submitted_by,
    last_editor_id: db.last_editor_id,
    submitted_at: db.submitted_at,
    created_at: db.created_at,
    updated_at: db.updated_at
});

export const mapMissionReportToDB = (report: MissionReport) => ({
    id: report.id,
    organization_id: report.organization_id,
    shift_id: report.shift_id,
    summary: report.summary,
    exceptional_events: report.exceptional_events,
    points_to_preserve: report.points_to_preserve,
    points_to_improve: report.points_to_improve,
    cumulative_info: report.cumulative_info,
    ongoing_log: report.ongoing_log,
    submitted_by: report.submitted_by,
    last_editor_id: report.last_editor_id,
    submitted_at: report.submitted_at
});

// Organization Settings
export const mapOrganizationSettingsFromDB = (s: any): import('@/types').OrganizationSettings => ({
    organization_id: s.organization_id,
    night_shift_start: s.night_shift_start,
    night_shift_end: s.night_shift_end,
    viewer_schedule_days: s.viewer_schedule_days,
    rotation_cycle_days: s.rotation_cycle_days,
    default_days_on: s.default_days_on,
    default_days_off: s.default_days_off,
    rotation_start_date: s.rotation_start_date,
    min_daily_staff: s.min_daily_staff,
    optimization_mode: s.optimization_mode,
    customFieldsSchema: typeof s.custom_fields_schema === 'string' ? JSON.parse(s.custom_fields_schema) : (s.custom_fields_schema || []),
    home_forecast_days: s.home_forecast_days,
    interPersonConstraints: typeof s.inter_person_constraints === 'string' ? JSON.parse(s.inter_person_constraints) : (s.inter_person_constraints || []),
    morning_report_time: s.morning_report_time,
    attendance_reporting_enabled: s.attendance_reporting_enabled || false,
    authorized_locations: typeof s.authorized_locations === 'string' ? JSON.parse(s.authorized_locations) : (s.authorized_locations || []),
    home_page_config: typeof s.home_page_config === 'string' ? JSON.parse(s.home_page_config) : (s.home_page_config || {}),
    engine_version: s.engine_version
});

export const mapDailyPresenceFromDB = (p: any): DailyPresence => ({
    id: p.id,
    date: p.date,
    person_id: p.person_id,
    organization_id: p.organization_id,
    status: p.status,
    homeStatusType: p.home_status_type,
    source: p.source,
    created_at: p.created_at,
    updated_at: p.updated_at,
    start_time: p.start_time,
    end_time: p.end_time,
    arrival_date: p.arrival_date,
    departure_date: p.departure_date,
    actual_arrival_at: p.actual_arrival_at,
    actual_departure_at: p.actual_departure_at,
    reported_location_id: p.reported_location_id,
    reported_location_name: p.reported_location_name,
    v2_state: p.v2_state,
    v2_sub_state: p.v2_sub_state
});

export const mapDailyPresenceToDB = (p: DailyPresence) => ({
    id: p.id,
    date: p.date,
    person_id: p.person_id,
    organization_id: p.organization_id,
    status: p.status,
    home_status_type: p.homeStatusType,
    source: p.source,
    start_time: p.start_time,
    end_time: p.end_time,
    arrival_date: p.arrival_date,
    departure_date: p.departure_date,
    actual_arrival_at: p.actual_arrival_at,
    actual_departure_at: p.actual_departure_at,
    reported_location_id: p.reported_location_id,
    reported_location_name: p.reported_location_name,
    v2_state: p.v2_state,
    v2_sub_state: p.v2_sub_state
});

export const mapOrganizationSettingsToDB = (s: import('@/types').OrganizationSettings) => ({
    organization_id: s.organization_id,
    night_shift_start: s.night_shift_start,
    night_shift_end: s.night_shift_end,
    viewer_schedule_days: s.viewer_schedule_days,
    rotation_cycle_days: s.rotation_cycle_days,
    default_days_on: s.default_days_on,
    default_days_off: s.default_days_off,
    rotation_start_date: s.rotation_start_date,
    min_daily_staff: s.min_daily_staff,
    optimization_mode: s.optimization_mode,
    custom_fields_schema: s.customFieldsSchema || [],
    home_forecast_days: s.home_forecast_days,
    inter_person_constraints: s.interPersonConstraints || [],
    morning_report_time: s.morning_report_time,
    attendance_reporting_enabled: s.attendance_reporting_enabled,
    authorized_locations: s.authorized_locations || [],
    home_page_config: s.home_page_config || {}
});

export const mapWarClockItemFromDB = (wc: any): import('@/types').WarClockItem => ({
    id: wc.id,
    startTime: wc.start_time,
    endTime: wc.end_time,
    description: wc.description,
    targetType: wc.target_type,
    targetId: wc.target_id,
    daysOfWeek: wc.days_of_week || [],
    startDate: wc.start_date,
    endDate: wc.end_date,
    organization_id: wc.organization_id
});

export const mapWarClockItemToDB = (wc: import('@/types').WarClockItem) => ({
    id: wc.id,
    start_time: wc.startTime,
    end_time: wc.endTime,
    description: wc.description,
    target_type: wc.targetType,
    target_id: wc.targetId,
    days_of_week: wc.daysOfWeek,
    start_date: wc.startDate,
    end_date: wc.endDate,
    organization_id: wc.organization_id
});
// Carpool Rides
export const mapCarpoolRideFromDB = (cr: any): import('@/types').CarpoolRide => ({
    id: cr.id,
    organization_id: cr.organization_id,
    creator_id: cr.creator_id,
    driver_name: cr.driver_name,
    driver_phone: cr.driver_phone,
    type: cr.type,
    direction: cr.direction,
    date: cr.date,
    time: cr.time,
    location: cr.location,
    seats: cr.seats,
    notes: cr.notes,
    created_at: cr.created_at,
    is_full: cr.is_full
});

export const mapCarpoolRideToDB = (cr: import('@/types').CarpoolRide) => ({
    id: cr.id,
    organization_id: cr.organization_id,
    creator_id: cr.creator_id,
    driver_name: cr.driver_name,
    driver_phone: cr.driver_phone,
    type: cr.type,
    direction: cr.direction,
    date: cr.date,
    time: cr.time,
    location: cr.location,
    seats: cr.seats,
    notes: cr.notes,
    created_at: cr.created_at,
    is_full: cr.is_full
});

// Lottery History
export const mapLotteryHistoryFromDB = (h: any): import('@/types').LotteryHistory => ({
    id: h.id,
    winners: h.winners || [],
    mode: h.mode,
    context: h.context,
    organization_id: h.organization_id,
    created_at: h.created_at
});

export const mapLotteryHistoryToDB = (h: Partial<import('@/types').LotteryHistory>) => ({
    id: h.id,
    winners: h.winners,
    mode: h.mode,
    context: h.context,
    organization_id: h.organization_id,
    created_at: h.created_at
});
