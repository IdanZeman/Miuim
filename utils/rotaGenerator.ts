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
    settings: OrganizationSettings & { optimizationMode?: 'ratio' | 'min_staff' | 'tasks' }; 
    teamRotations: TeamRotation[];
    constraints: SchedulingConstraint[];
    absences: Absence[];
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
    history?: Map<string, PersonHistory>;
    warnings: string[];
}

interface ISchedulingStrategy {
    generate(context: SchedulingContext): Record<string, boolean[]>; // PersonID -> Array of booleans (true=Base, false=Home)
}

const toDateKey = (d: Date) => d.toLocaleDateString('en-CA');
const getDayIndex = (d: Date, start: Date) => Math.floor((d.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

// --- STRATEGIES ---

/**
 * STRATEGY 1: FIXED RATIO ("The Morale Strategy")
 * Goal: Maintain rigid Base/Home cycles (e.g. 11/3).
 * Prioritizes pattern stability over perfect coverage, but adapts for constraints.
 * REFACTORED: Now uses Greedy Load-Balancing to flatten daily headcount.
 */
class FixedRatioStrategy implements ISchedulingStrategy {
    generate(ctx: SchedulingContext): Record<string, boolean[]> {
        const schedule: Record<string, boolean[]> = {};
        const totalDays = ctx.totalDays;

        // 1. Initialize Global Counters for Load Balancing
        const dailyStaffCounts = new Array(totalDays).fill(0);

        // Sort: Most constrained first
        const sortedPeople = [...ctx.people].sort((a, b) => {
            const sizeA = ctx.constraints.get(a.id)?.size || 0;
            const sizeB = ctx.constraints.get(b.id)?.size || 0;
            return sizeB - sizeA; 
        });

        sortedPeople.forEach(p => {
             const config = ctx.config.get(p.id) || { daysBase: 11, daysHome: 3 };
             const cycleLen = config.daysBase + config.daysHome;
             const hardConstraints = ctx.constraints.get(p.id) || new Set();
             const hist = ctx.history?.get(p.id);

             // Exit Day Logic
             let effectiveBase = config.daysBase;
             let effectiveHome = config.daysHome;
             if (effectiveHome > 0) {
                 effectiveBase += 1;
                 effectiveHome -= 1;
             }

             // History Offset
             let historyOffset = -1;
             if (hist) {
                  if (hist.lastStatus === 'base') {
                        historyOffset = hist.consecutiveDays % cycleLen;
                  } else {
                        historyOffset = (effectiveBase + hist.consecutiveDays) % cycleLen;
                  }
             }

             // 2. Evaluate All Possible Offsets (Smart Placement)
             let bestOffset = 0;
             let maxScore = -Infinity;

             for (let offset = 0; offset < cycleLen; offset++) {
                 let score = 0;

                 if (offset === historyOffset) score += 500; 

                 for (let i = 0; i < totalDays; i++) {
                     const pos = (i + offset) % cycleLen;
                     const isHome = pos >= effectiveBase;
                     const isBase = !isHome;

                     if (hardConstraints.has(i)) {
                         if (isHome) score += 1000; 
                         else score -= 5000; 
                     }

                     // Load Balancing: Penalize peaks
                     if (isBase) {
                         score -= Math.pow(dailyStaffCounts[i], 2); 
                     }
                 }

                 if (score > maxScore) {
                     maxScore = score;
                     bestOffset = offset;
                 }
             }

             // 3. Commit Best Offset
             const finalSched = new Array(totalDays).fill(true);
             for (let i = 0; i < totalDays; i++) {
                 const pos = (i + bestOffset) % cycleLen;
                 const isHome = pos >= effectiveBase;
                 
                 finalSched[i] = !isHome; 

                 if (finalSched[i]) dailyStaffCounts[i]++;

                 // Spot Release if unavoidable
                 if (hardConstraints.has(i) && finalSched[i]) {
                     finalSched[i] = false; 
                     dailyStaffCounts[i]--; 
                 }
             }
             
             schedule[p.id] = finalSched;
        });
        
        return schedule;
    }
}

/**
 * STRATEGY 2: MIN HEADCOUNT ("The Iterative Repair Strategy")
 * פתרון מבוסס חיפוש מקומי למניעת חריגות מהמינימום.
 */
class MinHeadcountStrategy implements ISchedulingStrategy {
    generate(ctx: SchedulingContext): Record<string, boolean[]> {
        const { totalDays, people, minStaff, constraints, warnings } = ctx;
        const schedule: Record<string, boolean[]> = {};
        
        if (people.length === 0) return {};

        // 1. הגדרת מחזור בסיס (מחזור אופטימלי סביב 50-60% נוכחות)
        const baseDays = 8;
        const homeDays = 6; // מחזור 8/6 נותן גמישות טובה יותר מ-8/8
        const cycleLen = baseDays + homeDays;

        // 2. הצבה ראשונית מדורגת (Initial Draft)
        people.forEach((p, i) => {
            schedule[p.id] = new Array(totalDays).fill(false);
            // דירוג מושלם (Spreading)
            const offset = Math.floor(i * (cycleLen / people.length));
            for (let d = 0; d < totalDays; d++) {
                if ((d + offset) % cycleLen < baseDays) {
                    schedule[p.id][d] = true;
                }
            }
        });

        // 3. לולאת תיקון איטרטיבית (Iterative Repair)
        // אנחנו ננסה לתקן את הלוח עד 200 פעמים
        for (let iter = 0; iter < 200; iter++) {
            let changesInIter = 0;

            for (let d = 0; d < totalDays; d++) {
                const currentCount = people.filter(p => schedule[p.id][d]).length;
                
                if (currentCount < minStaff) {
                    // חסרים אנשים! נחפש את הלוחם שהכי כדאי להזיז את הסבב שלו
                    const candidates = people.filter(p => !schedule[p.id][d]);
                    
                    candidates.sort((a, b) => {
                        // עדיפות למי שאין לו אילוץ היום
                        const conA = constraints.get(a.id)?.has(d) ? 1 : 0;
                        const conB = constraints.get(b.id)?.has(d) ? 1 : 0;
                        return conA - conB;
                    });

                    if (candidates.length > 0) {
                        const bestChoice = candidates[0];
                        schedule[bestChoice.id][d] = true; // הקפצה נקודתית
                        changesInIter++;
                    }
                }

                if (currentCount > minStaff + 2) {
                    // יש יותר מדי אנשים! ננסה לשחרר מישהו שיש לו אילוץ
                    const canRelease = people.filter(p => schedule[p.id][d] && constraints.get(p.id)?.has(d));
                    if (canRelease.length > 0) {
                        schedule[canRelease[0].id][d] = false;
                        changesInIter++;
                    }
                }
            }
            if (changesInIter === 0) break; // הפתרון יציב
        }

        // 4. בדיקת ביטחון סופית (The Iron Floor) - מוודא 100% שאין יום מתחת ל-13
        for (let d = 0; d < totalDays; d++) {
            let count = people.filter(p => schedule[p.id][d]).length;
            while (count < minStaff) {
                const stayers = people.filter(p => !schedule[p.id][d]);
                if (stayers.length === 0) break;

                // בוחרים את מי שהכי פחות יפגע (הוגנות)
                stayers.sort((a, b) => {
                    const workA = schedule[a.id].filter(Boolean).length;
                    const workB = schedule[b.id].filter(Boolean).length;
                    return workA - workB;
                });

                schedule[stayers[0].id][d] = true;
                count++;
                
                if (constraints.get(stayers[0].id)?.has(d)) {
                    warnings.push(`אילוץ נשבר ביום ${d+1} עבור ${stayers[0].name} כדי להבטיח מינימום 13.`);
                }
            }
        }

        return schedule;
    }
}
/**
 * STRATEGY 3: TASK DERIVED
 * Calculates requirements then delegates to MinHeadcount.
 */
class TaskDerivedStrategy implements ISchedulingStrategy {
    constructor(private tasks: TaskTemplate[]) {}

    generate(ctx: SchedulingContext): Record<string, boolean[]> {
        // 1. Calculate Required Headcount
        const required = this.calculateRequired(this.tasks);
        console.log(`[TaskDerived] Calculated Min Staff: ${required}`);
        
        // 2. Delegate
        const strategy = new MinHeadcountStrategy();
        // Update context with new min
        const newCtx = { ...ctx, minStaff: Math.max(ctx.minStaff, required) };
        return strategy.generate(newCtx);
    }

    private calculateRequired(tasks: TaskTemplate[]): number {
        let total = 0;
        tasks.forEach(t => {
            t.segments.forEach(seg => {
                if (seg.frequency === 'daily' || seg.isRepeat) {
                    // Formula: (Shift + Rest) / Shift * People
                    const cycle = seg.durationHours + seg.minRestHoursAfter;
                    const req = Math.ceil((cycle / seg.durationHours) * seg.requiredPeople);
                    total += req;
                }
            });
        });
        return total;
    }
}

// --- MAIN SERVICE ---

const generateRoster = (params: RosterGenerationParams): RosterGenerationResult => {
    const { startDate, endDate, people, settings, constraints, absences, history, tasks, customMinStaff } = params;

    // 1. Build Context
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const constraintMap = new Map<string, Set<number>>();
    people.forEach(p => {
        const set = new Set<number>();
        // Add manual availability
         if (p.dailyAvailability) {
            Object.entries(p.dailyAvailability).forEach(([dStr, avail]) => {
                if (!avail.isAvailable && avail.source !== 'algorithm') {
                    set.add(getDayIndex(new Date(dStr), startDate));
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
        // Add Absences
        absences.forEach(a => {
            if (a.person_id === p.id) {
                const s = Math.max(0, getDayIndex(new Date(a.start_date), startDate));
                const e = Math.min(totalDays - 1, getDayIndex(new Date(a.end_date), startDate));
                for(let i=s; i<=e; i++) set.add(i);
            }
        });
        constraintMap.set(p.id, set);
    });

    const configMap = new Map<string, { daysBase: number, daysHome: number }>();
    
    console.log('[RotaGenerator] Params received:', { 
        mode: settings.optimizationMode, 
        hasCustomRotation: !!params.customRotation,
        customRotationVals: params.customRotation 
    });

    if (params.customRotation && settings.optimizationMode === 'ratio') {
        const base = Number(params.customRotation.daysBase);
        const home = Number(params.customRotation.daysHome);
        console.log(`[RotaGenerator] Applying Custom Ratio: ${base}/${home}`);

        people.forEach(p => {
             configMap.set(p.id, { daysBase: base, daysHome: home });
        });
    } else if (params.teamRotations) {
        console.log('[RotaGenerator] Using Team Rotations fallback');
        people.forEach(p => {
            const rot = params.teamRotations.find(r => r.team_id === p.teamId);
            if (rot) configMap.set(p.id, { daysBase: rot.days_on_base, daysHome: rot.days_at_home });
            else configMap.set(p.id, { daysBase: 11, daysHome: 3 });
        });
    } else {
        console.log('[RotaGenerator] Using Absolute Default 11/3');
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

    // 2. Select Strategy
    let strategy: ISchedulingStrategy;
    const mode = settings.optimizationMode || 'ratio';

    if (mode === 'min_staff') {
        strategy = new MinHeadcountStrategy();
    } else if (mode === 'tasks') {
        strategy = new TaskDerivedStrategy(tasks || []);
    } else {
        strategy = new FixedRatioStrategy();
    }

    // 3. Execute
    console.log('[RotaGenerator] Mode:', mode);
    
    const schedule = strategy.generate(ctx);

    // 4. Format Output
    const roster: DailyPresence[] = [];
    const personStatuses: Record<string, Record<string, string>> = {};
    let totalPresence = 0;


    for (let i = 0; i < totalDays; i++) {
        const d = new Date(startDate.getTime() + i * 86400000);
        const dateKey = toDateKey(d);
        personStatuses[dateKey] = {};
        
        people.forEach(p => {
            const isBase = schedule[p.id]?.[i] ?? true; 
            
            // Determine final label
            let label = isBase ? 'base' : 'home';
            
            // Overlay hard constraint label
            if (constraintMap.get(p.id)?.has(i)) {
                if (!isBase) label = 'unavailable'; 
            }
            
            personStatuses[dateKey][p.id] = label === 'unavailable' ? 'unavailable' : (label === 'base' ? 'base' : 'home');

            roster.push({
                date: dateKey,
                person_id: p.id,
                organization_id: settings.organization_id,
                status: label === 'base' ? 'base' : (label === 'unavailable' ? 'unavailable' : 'home'),
                source: 'algorithm'
            });

            if (label === 'base') totalPresence++;
        });
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
                    const dateObj = new Date(startDate.getTime() + dayIndex * 86400000);
                    unfulfilledConstraints.push({
                        personId: p.id,
                        personName: p.name,
                        date: dateObj.toLocaleDateString('he-IL'),
                        type: 'constraint',
                        reason: 'סומן כאילוץ/בית אך שובץ בבסיס'
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