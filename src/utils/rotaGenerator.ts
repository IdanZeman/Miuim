import { Person, Team, OrganizationSettings, TeamRotation, SchedulingConstraint, DailyPresence, Absence, TaskTemplate } from '../types';

// --- TYPES & INTERFACES ---

export interface PersonHistory {
    lastStatus: 'base' | 'home';
    consecutiveDays: number;
}

export interface RosterGenerationParams {
    startDate: Date;
    endDate: Date;
    people: Person[];
    teams: Team[];
    settings: OrganizationSettings; 
    teamRotations: TeamRotation[];
    constraints: SchedulingConstraint[];
    absences: Absence[];
    hourlyBlockages: import('../types').HourlyBlockage[]; // NEW
    customMinStaff?: number;
    customRotation?: { daysBase: number; daysHome: number; };
    history?: Map<string, PersonHistory>;
    tasks?: TaskTemplate[];
}

export interface UnfulfilledConstraint {
    personId: string;
    personName: string;
    date: string;
    type: 'assignment' | 'constraint';
    reason: string;
}

export interface RosterGenerationResult {
    roster: DailyPresence[];
    stats: {
        totalDays: number;
        avgStaffPerDay: number;
        constraintStats?: {
            total: number;
            met: number;
            percentage: number;
        };
    };
    personStatuses: Record<string, Record<string, string>>;
    warnings?: string[];
    unfulfilledConstraints?: UnfulfilledConstraint[];
}

interface SchedulingContext {
    startDate: Date;
    endDate: Date;
    totalDays: number;
    people: Person[];
    constraints: Map<string, Set<number>>; // PersonID -> Set of Day Indices (Unavailable)
    config: Map<string, { daysBase: number, daysHome: number }>; // For Ratio mode
    minStaff: number;
    dailyMinStaff?: number[]; // NEW: Per-day requirements
    history?: Map<string, PersonHistory>;
    warnings: string[];
}

// ...

/**
 * STRATEGY 2: MIN HEADCOUNT ("The Iterative Repair Strategy")
 * פתרון מבוסס חיפוש מקומי למניעת חריגות מהמינימום.
 */
interface ISchedulingStrategy {
    generate(context: SchedulingContext): Record<string, boolean[]>; // PersonID -> Array of booleans (true=Base, false=Home)
}

const toDateKey = (d: Date) => d.toLocaleDateString('en-CA');
const getDayIndex = (d: Date | string, start: Date | string) => {
    const dObj = typeof d === 'string' ? new Date(d) : d;
    const sObj = typeof start === 'string' ? new Date(start) : start;
    const dCopy = new Date(dObj.getFullYear(), dObj.getMonth(), dObj.getDate());
    const sCopy = new Date(sObj.getFullYear(), sObj.getMonth(), sObj.getDate());
    return Math.round((dCopy.getTime() - sCopy.getTime()) / (1000 * 60 * 60 * 24));
};

// --- STRATEGIES ---

class PatternBasedMinStaffStrategy implements ISchedulingStrategy {
    generate(ctx: SchedulingContext): Record<string, boolean[]> {
        const { totalDays, people, minStaff, constraints, warnings, history } = ctx;
        const schedule: Record<string, boolean[]> = {};
        
        if (people.length === 0) return {};

        // 1. Pattern Selection - Ensure ratio covers minStaff
        const ratio = minStaff / people.length;
        let baseDays = 9;
        let homeDays = 5;

        // Pick the smallest baseDays such that baseDays/14 >= ratio
        const targetBase = Math.ceil(ratio * 14);
        if (targetBase > 11 && targetBase < 14) {
            baseDays = targetBase;
            homeDays = 14 - baseDays;
            if (baseDays > 11) {
                warnings.push(`סבב נבחר: ${baseDays}/${homeDays} (סד"כ גבוה במיוחד).`);
            }
        } else if (targetBase >= 14) {
            baseDays = 13; homeDays = 1;
            warnings.push(`אזהרה: הסד"כ המבוקש גבוה מדי. נבחר סבב מקסימלי 13/1.`);
        } else {
            baseDays = Math.max(1, targetBase);
            homeDays = 14 - baseDays;
        }

        const cycleLen = 14; 

        // 2. Balanced Phase Distribution
        const phaseSlots = new Array(cycleLen).fill(0).map(() => [] as string[]);
        const maxPerPhase = Math.ceil(people.length / cycleLen);
        
        // Sort people: prioritize those with history (must align) then those with more leave requests
        const sortedPeople = [...people].sort((a, b) => {
            const hasHA = history?.has(a.id) ? 1 : 0;
            const hasHB = history?.has(b.id) ? 1 : 0;
            if (hasHA !== hasHB) return hasHB - hasHA;
            
            const countA = constraints.get(a.id)?.size || 0;
            const countB = constraints.get(b.id)?.size || 0;
            return countB - countA;
        });

        sortedPeople.forEach(p => {
            const pConstraints = constraints.get(p.id) || new Set();
            const pHistory = history?.get(p.id);
            let bestOffset = -1;
            let bestScore = -Infinity;

            if (pHistory) {
                // CONTINUITY: Calculate offset that matches history exactly
                // We want: ((-1) + offset) % 14 is the state they were in yesterday.
                // Status yesterday was pHistory.lastStatus.
                // If lastStatus was 'base' and pHistory.consecutiveDays was K.
                // This means yesterday was the Kst day of a Base streak.
                // In our cycle [0..base-1] is Base.
                // So ((-1) + offset) % 14 should be (K-1).
                // offset = K-1 + 1 = K.
                
                if (pHistory.lastStatus === 'base') {
                    let yesterdayIdx = (pHistory.consecutiveDays - 1) % baseDays;
                    bestOffset = (yesterdayIdx + 1) % cycleLen;
                } else {
                    // Home
                    let yesterdayIdx = baseDays + ((pHistory.consecutiveDays - 1) % homeDays);
                    bestOffset = (yesterdayIdx + 1) % cycleLen;
                }
            } else {
                // GREEDY: Try all offsets
                for (let offset = 0; offset < cycleLen; offset++) {
                    if (phaseSlots[offset].length >= maxPerPhase) continue;

                    let score = 0;
                    for (let d = 0; d < totalDays; d++) {
                        const isBase = (d + offset) % cycleLen < baseDays;
                        if (pConstraints.has(d)) {
                            if (!isBase) score += 1000;
                            else score -= 5000;
                        }
                    }
                    
                    score -= phaseSlots[offset].length * 10;

                    if (score > bestScore) {
                        bestScore = score;
                        bestOffset = offset;
                    }
                }
            }

            if (bestOffset === -1) {
                bestOffset = phaseSlots.reduce((minIdx, current, idx) => 
                    current.length < phaseSlots[minIdx].length ? idx : minIdx, 0);
            }

            phaseSlots[bestOffset].push(p.id);

            const pSched = new Array(totalDays).fill(false);
            for (let d = 0; d < totalDays; d++) {
                if ((d + bestOffset) % cycleLen < baseDays) {
                    pSched[d] = true;
                }
            }
            schedule[p.id] = pSched;
        });

        return schedule;
    }
}

// --- MAIN SERVICE ---

const generateRoster = (params: RosterGenerationParams): RosterGenerationResult => {
    const { startDate, endDate, settings, constraints, absences, history, tasks, customMinStaff, hourlyBlockages } = params;
    const people = params.people.filter(p => p.isActive !== false);

    // 1. Build Context
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const constraintMap = new Map<string, Set<number>>();
    people.forEach(p => {
        const set = new Set<number>();
        // Add manual availability & propagate intents (Sequence Gap Repair)
         if (p.dailyAvailability) {
            const sortedEntries = Object.entries(p.dailyAvailability)
                .filter(([_, v]) => v.source !== 'algorithm')
                .sort((a, b) => a[0].localeCompare(b[0]));

            sortedEntries.forEach(([dStr, avail], idx) => {
                const dayIndex = getDayIndex(new Date(dStr), startDate);
                if (dayIndex < 0 || dayIndex >= totalDays) return;

                // 1. Direct Constraint (Home/Unavailable)
                if (!avail.isAvailable) {
                    set.add(dayIndex);
                }

                // 2. Intent Propagation (Forward from Departure/Home)
                // If this is a Departure or Home day, propagate "Home" intent until next manual Arrival/Base
                const isDeparture = avail.status === 'departure' || (avail.endHour && avail.endHour !== '23:59' && avail.isAvailable !== false);
                const isHome = !avail.isAvailable || avail.status === 'home';
                
                if (isDeparture || isHome) {
                    const nextManual = sortedEntries.slice(idx + 1).find(([_, v]) => {
                        const isArrival = v.status === 'arrival' || (v.startHour && v.startHour !== '00:00' && v.isAvailable !== false);
                        const isBase = v.status === 'base' || v.status === 'full' || (v.isAvailable && !v.startHour && !v.endHour);
                        return isArrival || isBase;
                    });

                    const stopDay = nextManual 
                        ? getDayIndex(new Date(nextManual[0]), startDate)
                        : totalDays;

                    for (let i = dayIndex + 1; i < stopDay; i++) {
                        if (i >= 0 && i < totalDays) set.add(i);
                    }
                }
            });
        }
        // Add Constraints
        constraints.forEach(c => {
            if (c.personId === p.id && c.type !== 'always_assign') {
                const s = Math.max(0, getDayIndex(new Date(c.startTime), startDate));
                const e = Math.min(totalDays - 1, getDayIndex(new Date(c.endTime), startDate));
                for(let i=s; i<=e; i++) set.add(i);
            }
        });
        // Add Absences (Approved AND Pending)
        absences.forEach(a => {
            if (a.person_id === p.id && (a.status === 'approved' || a.status === 'pending')) {
                const s = Math.max(0, getDayIndex(new Date(a.start_date), startDate));
                const e = Math.min(totalDays - 1, getDayIndex(new Date(a.end_date), startDate));
                for(let i=s; i<=e; i++) set.add(i);
            }
        });
        
        // Add Full-Day Hourly Blockages (NEW)
        hourlyBlockages.forEach(hb => {
             if (hb.person_id === p.id && hb.start_time === '00:00' && hb.end_time === '23:59') {
                 const dayIndex = getDayIndex(new Date(hb.date), startDate);
                 if (dayIndex >= 0 && dayIndex < totalDays) {
                     set.add(dayIndex);
                 }
             }
        });
        
        constraintMap.set(p.id, set);
    });

    const configMap = new Map<string, { daysBase: number, daysHome: number }>();
    

    if (params.customRotation && settings.optimization_mode === 'ratio') {
        const base = Number(params.customRotation.daysBase);
        const home = Number(params.customRotation.daysHome);

        people.forEach(p => {
             configMap.set(p.id, { daysBase: base, daysHome: home });
        });
    } else if (params.teamRotations) {
        people.forEach(p => {
            const rot = params.teamRotations.find(r => r.team_id === p.teamId);
            if (rot) configMap.set(p.id, { daysBase: rot.days_on_base, daysHome: rot.days_at_home });
            else configMap.set(p.id, { daysBase: 11, daysHome: 3 });
        });
    } else {
        people.forEach(p => configMap.set(p.id, { daysBase: 11, daysHome: 3 }));
    }

    const ctx: SchedulingContext = {
        startDate,
        endDate,
        totalDays,
        people,
        constraints: constraintMap,
        config: configMap,
        minStaff: customMinStaff || settings.min_daily_staff || 0,
        history,
        warnings: []
    };

    // 2. Select Strategy (Default to PatternBasedMinStaffStrategy)
    const strategy = new PatternBasedMinStaffStrategy();

    // 3. Execute
    
    const schedule = strategy.generate(ctx);

    // 4. Military Weekend Transition Rules (No Exit/Entry on Shabbat)
    // Rule: Handle Saturday transitions by moving to Friday (if SADAK allows) or Sunday.
    for (let d = 1; d < totalDays; d++) {
        const currentDate = new Date(startDate.getTime() + d * 86400000);
        if (currentDate.getDay() === 6) { // Saturday
            people.forEach(p => {
                const sched = schedule[p.id];
                const fri = d - 1;
                const sat = d;
                const sun = d + 1;

                // EXIT on Saturday (Base on Fri, Home on Sat)
                if (sched[fri] === true && sched[sat] === false) {
                    // Ignore if hard constraint
                    if (constraintMap.get(p.id)?.has(fri)) {
                        // If constrained to be home on fri anyway, it's not a sat exit usually, 
                        // but if we are here it's because logic generated a gap.
                    }

                    // Try move to Friday
                    const dailyTarget = ctx.dailyMinStaff ? (ctx.dailyMinStaff[fri] || ctx.minStaff) : ctx.minStaff;
                    const currentFriStaff = people.filter(pers => schedule[pers.id][fri]).length;
                    
                    if (currentFriStaff - 1 >= dailyTarget && !constraintMap.get(p.id)?.has(fri)) {
                        // Move to Friday
                        sched[fri] = false;
                        // Optional return adjust (try matching original length)
                        // Find original return
                        for (let r = sat + 1; r < totalDays; r++) {
                            if (sched[r] === true) {
                                // Original return at r. Try move to r-1 if SADAK allowed
                                const rMinus1Target = ctx.dailyMinStaff ? (ctx.dailyMinStaff[r-1] || ctx.minStaff) : ctx.minStaff;
                                const currentR1Staff = people.filter(pers => schedule[pers.id][r-1]).length;
                                if (currentR1Staff - 1 >= rMinus1Target && !constraintMap.get(p.id)?.has(r-1)) {
                                    sched[r-1] = true; // Wait, actually moving return EARLIER means more staff at r-1. Always OK.
                                    // Actually no, moving return EARLIER means person is at BASE at r-1.
                                }
                                break;
                            }
                        }
                    } else {
                        // Move to Sunday (Stay Sat)
                        sched[sat] = true;
                        if (sun < totalDays) {
                            // Already home on Sun? Then we successfully moved exit to Sun.
                            // If base on Sun? We just pushed the problem to Sunday.
                        }
                        // Optional return adjust (push 1 day later)
                        for (let r = sat + 1; r < totalDays; r++) {
                            if (sched[r] === true) {
                                const rStaff = people.filter(pers => schedule[pers.id][r]).length;
                                const rTarget = ctx.dailyMinStaff ? (ctx.dailyMinStaff[r] || ctx.minStaff) : ctx.minStaff;
                                if (rStaff - 1 >= rTarget && !constraintMap.get(p.id)?.has(r)) {
                                    sched[r] = false;
                                }
                                break;
                            }
                        }
                    }
                }

                // ENTRY on Saturday (Home on Fri, Base on Sat)
                else if (sched[fri] === false && sched[sat] === true) {
                    // Move to Friday (Always better for SADAK)
                    if (!constraintMap.get(p.id)?.has(fri)) {
                        sched[fri] = true;
                    } else {
                        // If forced home on Fri, move entry to Sunday
                        sched[sat] = false;
                        if (sun < totalDays && !constraintMap.get(p.id)?.has(sun)) {
                            sched[sun] = true;
                        }
                    }
                }
            });
        }
    }

    // 5. Verify Constraints & Calculate Stats
    const unfulfilledConstraints: UnfulfilledConstraint[] = [];
    let totalConstraintsToCheck = 0;
    let metConstraints = 0;

    people.forEach(p => {
        const pConstraints = constraintMap.get(p.id);
        if (pConstraints && pConstraints.size > 0) {
            totalConstraintsToCheck += pConstraints.size;
            
            pConstraints.forEach(dayIndex => {
                const isAssignedBase = schedule[p.id]?.[dayIndex]; // true = base
                
                if (isAssignedBase) {
                    // Violation! Constraint said "No Base" (Home/Unavailable), but Schedule said "Base"
                    const dateObj = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + dayIndex);
                    unfulfilledConstraints.push({
                        personId: p.id,
                        personName: p.name,
                        date: toDateKey(dateObj),
                        type: 'constraint',
                        reason: 'שים לב שבקשת היציאה לא התקבלה עקב אילוצי סד"כ'
                    });
                } else {
                    metConstraints++;
                }
            });
        }
    });

    const constraintPercentage = totalConstraintsToCheck > 0 
        ? Math.round((metConstraints / totalConstraintsToCheck) * 100) 
        : 100;

    // 5. Format Output
    const roster: DailyPresence[] = [];
    const personStatuses: Record<string, Record<string, string>> = {};
    let totalPresence = 0;

    // Build final roster with correct statuses
    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
        const dateKey = toDateKey(d);
        personStatuses[dateKey] = {};
        
        people.forEach(p => {
            const isBase = schedule[p.id]?.[i] ?? true; 
            const hasConstraint = constraintMap.get(p.id)?.has(i);
            
            // Determine final label
            let label = isBase ? 'base' : (hasConstraint ? 'unavailable' : 'home');
            
            personStatuses[dateKey][p.id] = label;

            roster.push({
                date: dateKey,
                person_id: p.id,
                organization_id: settings.organization_id,
                status: label as any,
                source: 'algorithm'
            });

            if (label === 'base') totalPresence++;
        });
    }

    return {
        roster,
        stats: {
             totalDays,
             avgStaffPerDay: totalPresence / (totalDays * people.length || 1),
             constraintStats: {
                 total: totalConstraintsToCheck,
                 met: metConstraints,
                 percentage: constraintPercentage
             }
        },
        personStatuses,
        warnings: ctx.warnings,
        unfulfilledConstraints
    };
};

export { generateRoster };