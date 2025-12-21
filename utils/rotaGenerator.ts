import { Person, Team, OrganizationSettings, TeamRotation, SchedulingConstraint, DailyPresence } from '../types';

// --- CONFIGURATION ---
const WEIGHTS = {
    CONSTRAINT: 1_000_000,
    FATIGUE: 10_000,       // Increased to punish long base stints severely
    FRAGMENTATION: 5_000,  // Increased to force 3-day blocks (prevents 1-day leaves)
    CAPACITY: 100,         // Increased to flatten the curve
    EQUITY: 200            // Penalize deviation from target total home days
};

const SIMULATION_PARAMS = {
    ITERATIONS: 20000,
    INITIAL_TEMP: 100,
    COOLING_RATE: 0.9995
};

export interface RosterGenerationParams {
    startDate: Date;
    endDate: Date;
    people: Person[];
    teams: Team[];
    settings: OrganizationSettings;
    teamRotations: TeamRotation[];
    constraints: SchedulingConstraint[];
    customMinStaff?: number;
    customRotation?: { daysBase: number; daysHome: number; };
}

export interface RosterGenerationResult {
    roster: DailyPresence[];
    stats: {
        totalDays: number;
        avgStaffPerDay: number;
    };
    personStatuses: Record<string, Record<string, string>>;
    warnings?: string[];
}

const toDateKey = (d: Date) => d.toLocaleDateString('en-CA');

// --- OPTIMIZER CLASS ---
class RosterOptimizer {
    private schedule: Map<string, boolean[]>; // true = Base, false = Home
    private dailyCapacity: number[];
    private totalDays: number;
    private people: Person[];
    private personConfigs: Map<string, { daysBase: number, daysHome: number }>;
    private constraints: Map<string, Set<number>>; // Set of day indices that MUST be home
    private startDate: Date;
    private targetCapacity: number;

    constructor(
        people: Person[], 
        startDate: Date, 
        endDate: Date, 
        rotations: Map<string, TeamRotation>, 
        rawConstraints: SchedulingConstraint[],
        targetCapacity: number
    ) {
        this.people = people;
        this.startDate = startDate;
        this.targetCapacity = targetCapacity;
        this.totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        this.schedule = new Map();
        this.dailyCapacity = new Array(this.totalDays).fill(0);
        this.constraints = new Map();
        this.personConfigs = new Map();

        // 1. Setup Person Configs & Constraints
        people.forEach(p => {
            // Config
            const rot = rotations.get(p.id) || { days_on_base: 11, days_at_home: 3 };
            this.personConfigs.set(p.id, { daysBase: rot.days_on_base, daysHome: rot.days_at_home });
            
            // Constraints
            const pConstraints = new Set<number>();
            if (p.dailyAvailability) {
                Object.entries(p.dailyAvailability).forEach(([dateStr, avail]) => {
                    if (!avail.isAvailable && avail.source !== 'algorithm') {
                        const idx = this.getDateIndex(new Date(dateStr));
                        if (idx >= 0 && idx < this.totalDays) pConstraints.add(idx);
                    }
                });
            }
            rawConstraints.forEach(c => {
                if (c.personId === p.id && c.type !== 'always_assign') {
                    const s = Math.max(0, this.getDateIndex(new Date(c.startTime)));
                    const e = Math.min(this.totalDays - 1, this.getDateIndex(new Date(c.endTime)));
                    for (let i = s; i <= e; i++) pConstraints.add(i);
                }
            });
            this.constraints.set(p.id, pConstraints);
            
            // Initialize Schedule Array
            this.schedule.set(p.id, new Array(this.totalDays).fill(true)); // Default to Base
        });
    }

    private getDateIndex(d: Date): number {
        return Math.floor((d.getTime() - this.startDate.getTime()) / (1000 * 60 * 60 * 24));
    }

    // --- PHASE 1: SMART SEEDING (CORRECTED) ---
    public initialize() {
        this.people.forEach(p => {
            const sched = this.schedule.get(p.id)!;
            const hardConstraints = this.constraints.get(p.id)!;
            const config = this.personConfigs.get(p.id)!;
            
            const cycleLength = config.daysBase + config.daysHome;

            // 1. Generate Ideal Pattern (The Rhythm)
            // We stagger the start based on person ID or random to avoid everyone having same cycle initially
            const offset = Math.floor(Math.random() * cycleLength);

            for (let i = 0; i < this.totalDays; i++) {
                const cyclePos = (i + offset) % cycleLength;
                
                // First part of cycle is Base, last part is Home
                if (cyclePos < config.daysBase) {
                    sched[i] = true; // Base
                } else {
                    sched[i] = false; // Home
                }
            }

            // 2. Overlay Hard Constraints
            // Constraints ALWAYS win.
            hardConstraints.forEach(dayIdx => {
                sched[dayIdx] = false; // Force Home
            });
            
            // Note: This might create "double homes" (pattern home + constraint home)
            // or "short bases". The optimization loop will fix the fragmentation later.
        });

        this.recalculateCapacity();
    }

    private recalculateCapacity() {
        this.dailyCapacity.fill(0);
        this.schedule.forEach((sched) => {
            for (let i = 0; i < this.totalDays; i++) {
                if (sched[i]) this.dailyCapacity[i]++;
            }
        });
    }

    // --- COST FUNCTION ---
    public calculateCost(): number {
        let cost = 0;

        // 1. Capacity Variance
        for (let i = 0; i < this.totalDays; i++) {
            const diff = this.dailyCapacity[i] - this.targetCapacity;
            cost += (diff * diff) * WEIGHTS.CAPACITY;
        }

        // 2. Person Costs (Fatigue, Fragmentation, Constraints)
        this.schedule.forEach((sched, pid) => {
            const config = this.personConfigs.get(pid)!;
            const hard = this.constraints.get(pid)!;

            let fatigue = 0;
            let homeBlockLen = 0;
            let actualHomeDays = 0;

            for (let i = 0; i < this.totalDays; i++) {
                // Constraint Check
                if (hard.has(i) && sched[i]) {
                    cost += WEIGHTS.CONSTRAINT; // Should not happen in Smart Seed + Valid Mutations
                }

                if (sched[i]) { // Base
                    fatigue++;
                    if (homeBlockLen > 0 && homeBlockLen < config.daysHome) {
                        cost += WEIGHTS.FRAGMENTATION;
                    }
                    homeBlockLen = 0;

                    if (fatigue > config.daysBase) {
                        cost += WEIGHTS.FATIGUE;
                    }
                } else { // Home
                    actualHomeDays++;
                    fatigue = Math.max(0, fatigue - 1); // Slow decay or fast reset?
                    // User logic: Full reset only on full block. 
                    // Let's simplify cost: just penalize streak > limit.
                    homeBlockLen++;
                    
                    if (homeBlockLen >= config.daysHome) fatigue = 0;
                }
            }
            // Check last block
            if (homeBlockLen > 0 && homeBlockLen < config.daysHome) {
                 cost += WEIGHTS.FRAGMENTATION;
            }

            // 3. Equity Cost (Fairness)
            // Target = TotalDays * (Home / Cycle)
            const cycle = config.daysBase + config.daysHome;
            const expectedHomeDays = (this.totalDays * config.daysHome) / cycle;
            const diff = actualHomeDays - expectedHomeDays;
            cost += (diff * diff) * WEIGHTS.EQUITY;
        });

        return cost;
    }

    // --- OPTIMIZATION LOOP ---
    public optimize() {
        let currentCost = this.calculateCost();
        let bestCost = currentCost;
        // We can backup best schedule if needed, but for now just modify in place.
        
        // Temperature Schedule
        let temp = SIMULATION_PARAMS.INITIAL_TEMP;

        for (let iter = 0; iter < SIMULATION_PARAMS.ITERATIONS; iter++) {
            // Pick a random person
            const pIdx = Math.floor(Math.random() * this.people.length);
            const person = this.people[pIdx];
            const pid = person.id;
            const sched = this.schedule.get(pid)!;
            const hard = this.constraints.get(pid)!;

            // Pick a Move: Shift or Resize a home block
            // 1. Identify Home Blocks
            const blocks: {start: number, end: number}[] = [];
            let start = -1;
            for(let i=0; i<this.totalDays; i++) {
                if(!sched[i]) {
                    if(start === -1) start = i;
                } else {
                    if(start !== -1) {
                        blocks.push({start, end: i-1});
                        start = -1;
                    }
                }
            }
            if (start !== -1) blocks.push({start, end: this.totalDays-1});

            if (blocks.length === 0) continue; // No home blocks to move (unlikely)

            const blockIdx = Math.floor(Math.random() * blocks.length);
            const block = blocks[blockIdx];
            const moveType = Math.random() > 0.5 ? 'SHIFT' : 'RESIZE';

            // Backup State
            const originalBlock = {...block};
            const originalSchedFragment: boolean[] = []; // Store only changed days? 
            // Simpler: Snapshot is expensive. We just reverse the move if rejected.
            // But we need to apply move first.
            
            // Proposed Mutation
            let newStart = block.start;
            let newEnd = block.end;

            if (moveType === 'SHIFT') {
                const shift = Math.random() > 0.5 ? 1 : -1;
                newStart += shift;
                newEnd += shift;
            } else {
                // Resize (Expand/Contract)
                if (Math.random() > 0.5) { // Expand
                     if (Math.random() > 0.5) newEnd++; else newStart--;
                } else { // Shrink
                    if (newEnd > newStart) { // Don't vanish fully
                        if (Math.random() > 0.5) newEnd--; else newStart++;
                    }
                }
            }

            // Bounds Check
            if (newStart < 0 || newEnd >= this.totalDays) continue;

            // Constraint Validity Check (Crucial: Don't move Base onto a Constraint)
            // If we are changing a day from Home -> Base, we must ensure it's not a Constraint.
            // "Home -> Base" happens when we shrink or shift away.
            // Old Range: [block.start, block.end] is Home.
            // New Range: [newStart, newEnd] is Home.
            // Days becoming Base: (Old - New). Check if any are in `hard`.
            
            let invalidMove = false;
            // Check days changing from Home to Base
            for (let i = block.start; i <= block.end; i++) {
                if (i < newStart || i > newEnd) { // Was Home, Now Base
                    if (hard.has(i)) { invalidMove = true; break; }
                }
            }
            if (invalidMove) continue;

            // Apply Move (Temporarily)
            const oldDays: {[key:number]: boolean} = {};
            // Determine affected range
            const min = Math.min(block.start, newStart);
            const max = Math.max(block.end, newEnd);
            
            for (let i = min; i <= max; i++) {
                oldDays[i] = sched[i];
                // Set New State
                if (i >= newStart && i <= newEnd) {
                    if (sched[i]) { // Was Base, Now Home
                        sched[i] = false;
                        this.dailyCapacity[i]--;
                    }
                } else {
                    if (!sched[i]) { // Was Home, Now Base
                        sched[i] = true;
                        this.dailyCapacity[i]++;
                    }
                }
            }

            // Calculate New Cost
            // Optimization: Delta calculation is better but full calc is safer for now.
            // Given iteration count (20k) and simple cost logic, full calc might be acceptable (~1-2ms).
            // Let's try full calc first.
            const newCost = this.calculateCost();
            const delta = newCost - currentCost;

            // Acceptance Probability
            if (delta < 0 || Math.random() < Math.exp(-delta / temp)) {
                // Accept
                currentCost = newCost;
                if (currentCost < bestCost) bestCost = currentCost;
            } else {
                // Reject - Revert
                for (let i = min; i <= max; i++) {
                    const wasBase = oldDays[i];
                    const isBase = sched[i];
                    if (wasBase !== isBase) {
                        sched[i] = wasBase;
                        if (wasBase) this.dailyCapacity[i]++;
                        else this.dailyCapacity[i]--;
                    }
                }
            }

            // Cool down
            temp *= SIMULATION_PARAMS.COOLING_RATE;
        }
    }

    public getResult(): Record<string, Record<string, string>> {
        const result: Record<string, Record<string, string>> = {};
        const msPerDay = 1000*60*60*24;
        
        for(let i=0; i<this.totalDays; i++) {
            const d = new Date(this.startDate.getTime() + (i * msPerDay));
            const key = toDateKey(d);
            result[key] = {};
            
            this.schedule.forEach((sched, pid) => {
                const hard = this.constraints.get(pid)!;
                if (hard.has(i)) {
                    // Was it manual unavailable or task? We treat all 'hard' as unavailable if they came from constraints?
                    // Actually, the wrapper maps them properly. We just say 'home'.
                    // Wait, the wrapper needs 'home', 'base', or 'unavailable'.
                    // Our optimizer treated hard constraints as 'home' to satisfy them.
                    // The wrapper logic will re-check the source constraints to label 'unavailable'.
                    // So here we stick to 'home'/'base'.
                    result[key][pid] = 'home'; 
                } else {
                    result[key][pid] = sched[i] ? 'base' : 'home';
                }
            });
        }
        return result;
    }
}

// --- MAIN WRAPPER ---
export const generateRoster = (params: RosterGenerationParams): RosterGenerationResult => {
    const { startDate, endDate, people, teamRotations, constraints, settings, customMinStaff, customRotation } = params;
    
    const minDailyStaff = customMinStaff ?? settings.min_daily_staff ?? 0;

    // 1. Prepare Data
    const rotMap = new Map<string, TeamRotation>();
    const effectiveRotations = teamRotations.length > 0 ? teamRotations : []; 
    // If custom rotation provided (Wizard Mode)
    people.forEach(p => {
        let r: TeamRotation | undefined;
        if (customRotation) {
            r = {
                id: 'custom', organization_id: settings.organization_id, team_id: p.teamId || 'global',
                days_on_base: customRotation.daysBase, days_at_home: customRotation.daysHome, cycle_length: customRotation.daysBase + customRotation.daysHome,
                start_date: startDate.toISOString(), arrival_time: '10:00', departure_time: '14:00'
            };
        } else {
            r = effectiveRotations.find(rt => rt.team_id === p.teamId);
        }
        if(!r) r = { id: 'def', organization_id: '', team_id: '', days_on_base: 11, days_at_home: 3, cycle_length: 14, start_date: '', arrival_time:'', departure_time:''};
        rotMap.set(p.id, r);
    });

    // Target Capacity
    const totalPeople = people.length;
    // Calculate ideal based on average ratio
    let totalTheoreticalCapacity = 0;
    const warnings: string[] = [];

    people.forEach(p => {
        const r = rotMap.get(p.id)!;
        const cycle = r.days_on_base + r.days_at_home;
        totalTheoreticalCapacity += (r.days_on_base / cycle);
    });
    const targetCapacity = Math.round(totalTheoreticalCapacity); 

    // Feasibility Check
    if (totalTheoreticalCapacity < minDailyStaff) {
        warnings.push('בהינתן היחס יציאות הביתה ובהינתן הסד"כ הקיים לא ניתן לעמוד במינימום הנדרש');
    }

    // 2. Initialize Optimizer
    const optimizer = new RosterOptimizer(people, startDate, endDate, rotMap, constraints, targetCapacity);
    
    // 3. Run Optimization
    console.time('SimulatedAnnealing');
    optimizer.initialize();
    optimizer.optimize();
    console.timeEnd('SimulatedAnnealing');

    // 4. Format Result
    const optimizationResult = optimizer.getResult();
    
    // Convert to App Format
    // We need to re-layer 'unavailable' status for display purposes
    const resultPersonStatuses: Record<string, Record<string, string>> = {};
    const roster: DailyPresence[] = [];
    let totalPresence = 0;
    let daysCount = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dateKey = toDateKey(d);
        resultPersonStatuses[dateKey] = {};
        let dailyCount = 0;

        people.forEach(p => {
             // Check manual unavailability for distinct label
             let label = optimizationResult[dateKey]?.[p.id] || 'base';
             
             // Check if strict constraint (never_assign) or manual unavailable
             const isStrict = constraints.some(c => c.personId === p.id && c.type === 'never_assign' && 
                new Date(c.startTime) <= d && new Date(c.endTime) >= d
             );
             const isManual = p.dailyAvailability?.[dateKey]?.isAvailable === false && p.dailyAvailability?.[dateKey]?.source !== 'algorithm';

             if (isStrict || isManual) {
                 label = 'unavailable';
             }

             resultPersonStatuses[dateKey][p.id] = label;
             
             roster.push({
                 date: dateKey,
                 person_id: p.id,
                 organization_id: settings.organization_id,
                 status: label === 'base' ? 'base' : (label === 'unavailable' ? 'unavailable' : 'home'),
                 source: 'algorithm'
             });

             if (label === 'base') dailyCount++;
        });
        totalPresence += dailyCount;
        daysCount++;
    }

    return {
        roster,
        stats: {
            totalDays: daysCount,
            avgStaffPerDay: daysCount > 0 ? (totalPresence / daysCount) : 0
        },
        personStatuses: resultPersonStatuses,
        warnings
    };
};
