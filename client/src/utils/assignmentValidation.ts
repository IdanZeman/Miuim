import { Shift, Person, SchedulingConstraint, TeamRotation, Absence, HourlyBlockage, Role } from '@/types';
import { getEffectiveAvailability, isStatusPresent } from './attendanceUtils';

export interface ValidationContext {
    shift: Shift;
    person: Person;
    allShifts?: Shift[]; // For overlap/rest checks
    constraints?: SchedulingConstraint[];
    teamRotations?: TeamRotation[];
    absences?: Absence[];
    hourlyBlockages?: HourlyBlockage[];
    roles?: Role[]; // For role requirements
}

export interface ValidationResult {
    // 1. Hard Constraints (Explicit "Never Assign", "Time Block", "Always Assign")
    isHardConstraintViolation: boolean;
    hardConstraintReason?: string;

    // 2. Attendance (Availability, Arrival/Departure)
    isAttendanceViolation: boolean;
    attendanceReason?: string;

    // 3. Operational (Overlap, Rest, Role Requirements)
    isOperationalViolation: boolean;
    operationalReason?: string;
    
    // Combined helpers
    isValid: boolean; // True if NO violations at all
    hasBlockingIssue: boolean; // True if Hard Constraints exist
}

export const validateAssignment = (context: ValidationContext): ValidationResult => {
    const { 
        shift, 
        person, 
        allShifts = [], 
        constraints = [], 
        teamRotations = [], 
        absences = [], 
        hourlyBlockages = [], 
        roles = [] 
    } = context;

    const result: ValidationResult = {
        isHardConstraintViolation: false,
        isAttendanceViolation: false,
        isOperationalViolation: false,
        isValid: true,
        hasBlockingIssue: false
    };

    // --- 1. Hard Constraints Validation ---
    const userConstraints = constraints.filter(c => c.personId === person.id);
    const shiftStart = new Date(shift.startTime).getTime();
    const shiftEnd = new Date(shift.endTime).getTime();

    // Never Assign
    if (userConstraints.some(c => c.type === 'never_assign' && c.taskId === shift.taskId)) {
        result.isHardConstraintViolation = true;
        result.hardConstraintReason = 'קיים אילוץ "לעולם לא לשבץ" למשימה זו';
    } 
    // Time Block
    else if (userConstraints.some(c => {
        if (c.type === 'time_block' && c.startTime && c.endTime) {
            const blockStart = new Date(c.startTime).getTime();
            const blockEnd = new Date(c.endTime).getTime();
            return shiftStart < blockEnd && shiftEnd > blockStart;
        }
        return false;
    })) {
        result.isHardConstraintViolation = true;
        result.hardConstraintReason = 'החייל חסום בשעות אלו';
    }
    // Always Assign check
    else {
        const exclusiveConstraint = userConstraints.find(c => c.type === 'always_assign');
        if (exclusiveConstraint && exclusiveConstraint.taskId !== shift.taskId) {
            result.isHardConstraintViolation = true;
            result.hardConstraintReason = 'החייל מוגדר כבלעדי למשימה אחרת';
        }
    }

    if (result.isHardConstraintViolation) {
        result.hasBlockingIssue = true;
        result.isValid = false;
        // We can stop here or continue to gather more info. Usually blocking stops flow.
        return result; 
    }


    // --- 2. Attendance Validation ---
    const shiftDate = new Date(shift.startTime);
    const shiftEndDate = new Date(shift.endTime);
    const attendance = getEffectiveAvailability(person, shiftDate, teamRotations, absences, hourlyBlockages);
    
    // Basic Status Check
    if (!attendance.isAvailable) {
        result.isAttendanceViolation = true;
        if (attendance.status === 'home') result.attendanceReason = 'נמצא/ת בבית (סבב/היעדרות)';
        else if (attendance.status === 'arrival') result.attendanceReason = `טרם הגיע/ה ליחידה (צפוי ב-${attendance.startHour})`;
        else if (attendance.status === 'departure') result.attendanceReason = `עוזב/ת את היחידה (יוצא ב-${attendance.endHour})`;
        else result.attendanceReason = 'לא זמין/ה במערכת הנוכחות';
    } else {
        // Detailed Time Check (Arrival/Departure/Hourly Blocks)
        const shiftStartMin = shiftDate.getHours() * 60 + shiftDate.getMinutes();
        let shiftEndMin = shiftEndDate.getHours() * 60 + shiftEndDate.getMinutes();
        // Handle cross-day shift end minute calculation
        const isSameDay = shiftDate.toDateString() === shiftEndDate.toDateString();
        if (!isSameDay && shiftEndMin < shiftStartMin) shiftEndMin += 24 * 60; // Assuming next day
        
        // A. Cross-day or Same-day standard check
        if (!isSameDay) {
             // 1. Check start time on first day
             if (!isStatusPresent(attendance, shiftStartMin)) {
                 result.isAttendanceViolation = true;
                 result.attendanceReason = 'השעות חורגות מזמני ההגעה/יציאה של החייל';
             }
             // 2. Check end time on second day
             const attendanceDay2 = getEffectiveAvailability(person, shiftEndDate, teamRotations, absences, hourlyBlockages);
             // Check just before end time
             if (!result.isAttendanceViolation && !isStatusPresent(attendanceDay2, shiftEndMin - 1)) {
                 result.isAttendanceViolation = true;
                 result.attendanceReason = 'השעות חורגות מזמני ההגעה/יציאה של החייל (ביום העוקב)';
             }
        } else {
             // Same day check
             const isStartOk = isStatusPresent(attendance, shiftStartMin);
             const isEndOk = isStatusPresent(attendance, shiftEndMin - 1);

             if (!isStartOk || !isEndOk) {
                 result.isAttendanceViolation = true;

                 // Try to give specific reason
                 if (attendance.status === 'arrival' && attendance.startHour) {
                     const [ah, am] = attendance.startHour.split(':').map(Number);
                     const arrivalMin = ah * 60 + am;
                     if (shiftStartMin < arrivalMin) {
                        result.attendanceReason = `טרם הגיע/ה ליחידה (צפוי ב-${attendance.startHour})`;
                     }
                 }
                 if (!result.attendanceReason && attendance.status === 'departure' && attendance.endHour) {
                     const [dh, dm] = attendance.endHour.split(':').map(Number);
                     const departureMin = dh * 60 + dm;
                     if (shiftEndMin > departureMin || shiftStartMin >= departureMin) {
                        result.attendanceReason = `עוזב/ת את היחידה בשעה ${attendance.endHour}`;
                     }
                 }
                 
                 if (!result.attendanceReason) {
                     result.attendanceReason = `חריגה משעות נוכחות (${attendance.startHour || '00:00'} - ${attendance.endHour || '23:59'})`;
                 }
             }

             // Check Hourly Blockages Intersection
             if (!result.isAttendanceViolation && attendance.unavailableBlocks && attendance.unavailableBlocks.length > 0) {
                 const hasBlockOverlap = attendance.unavailableBlocks.some(b => {
                     // Only consider blocks that are approved or partially approved
                     // Pending requests should not block assignments
                     if (b.status && b.status !== 'approved' && b.status !== 'partially_approved') {
                         return false;
                     }

                     const [sh, sm] = b.start.split(':').map(Number);
                     const [eh, em] = b.end.split(':').map(Number);
                     const bStart = sh * 60 + sm;
                     let bEnd = eh * 60 + em;
                     if (bEnd < bStart) bEnd += 24 * 60;
                     return shiftStartMin < bEnd && shiftEndMin > bStart;
                 });

                 if (hasBlockOverlap) {
                     result.isAttendanceViolation = true;
                     result.attendanceReason = 'קיימת חסימה שעתית בטווח המשמרת';
                 }
             }
        }
    }

    if (result.isAttendanceViolation) {
        result.isValid = false;
        // Don't return yet, might want to check operational issues too? 
        // But usually attendance is a stronger signal.
    }


    // --- 3. Operational Validation (Overlap, Rest, Role) ---
    
    // A. Overlap
    if (!result.attendanceReason) { // If not already failed by attendance logic
        const hasOverlap = allShifts.some(s =>
            s.id !== shift.id &&
            s.assignedPersonIds.includes(person.id) &&
            !s.isCancelled && // Assuming we only check active shifts
            new Date(s.startTime) < new Date(shift.endTime) && new Date(s.endTime) > new Date(shift.startTime)
        );
        if (hasOverlap) {
            result.isOperationalViolation = true;
            result.operationalReason = 'כבר משובץ/ת במשימה מקבילה';
        }
    }

    // B. Rest Violation
    if (!result.isOperationalViolation && !result.isAttendanceViolation) {
         const minRestRequired = shift.requirements?.minRest || 7;
         const prevShifts = allShifts.filter(s => 
             s.id !== shift.id &&
             s.assignedPersonIds.includes(person.id) && 
             !s.isCancelled &&
             new Date(s.endTime) <= new Date(shift.startTime)
         );
         // Get the *latest* end time of previous shifts
         const lastShift = prevShifts.sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];
         
         if (lastShift) {
             const gapHours = (new Date(shift.startTime).getTime() - new Date(lastShift.endTime).getTime()) / (1000 * 60 * 60);
             if (gapHours < minRestRequired) {
                 result.isOperationalViolation = true;
                 result.operationalReason = `חסר זמן מנוחה (נדרש לפחות ${minRestRequired} שעות)`;
             }
         }
    }

    // C. Role Requirement
    if (!result.isOperationalViolation && !result.isAttendanceViolation && roles.length > 0) {
        if (shift.requirements?.roleComposition && shift.requirements.roleComposition.length > 0) {
            const requiredRoleIds = shift.requirements.roleComposition.map(rc => rc.roleId);
            const personRoleIds = [person.roleId, ...(person.roleIds || [])];
            const hasRequiredRole = personRoleIds.some(rid => requiredRoleIds.includes(rid));

            if (!hasRequiredRole) {
                const roleNames = requiredRoleIds.map(rid => roles.find(r => r.id === rid)?.name).filter(Boolean).join(', ');
                result.isOperationalViolation = true;
                result.operationalReason = `אינו/ה בעל/ת התפקיד הנדרש (נדרש: ${roleNames})`;
            }
        }
    }

    if (result.isOperationalViolation) {
        result.isValid = false;
    }

    return result;
};
