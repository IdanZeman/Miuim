import { Shift, TaskTemplate } from '../types';
import { callBackend } from './backendService';
import { shiftService } from './shiftService';

interface LoadStatsCache {
  id: string;
  organization_id: string;
  person_id: string;
  total_load_score: number;
  shifts_count: number;
  critical_shift_count: number;
  calculation_period_start: string;
  calculation_period_end: string;
  last_updated: string;
  created_at: string;
}

export interface HistoryScore {
  userId: string;
  totalLoadScore: number;
  shiftsCount: number;
  criticalShiftCount: number;
}

/**
 * Fetch shifts from the last 30 days (or specified range) for a specific organization
 */
export const fetchUserHistory = async (organizationId: string, endDate: Date, daysBack: number = 30): Promise<Shift[]> => {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  const endDateStr = endDate.toISOString();
  const startDateStr = startDate.toISOString();

  try {
    return await shiftService.fetchShifts(organizationId, {
      startDate: startDateStr,
      endDate: endDateStr
    });
  } catch (e) {
    console.warn("Failed to fetch history:", e);
    return [];
  }
};

/**
 * Calculate load score for each user based on past shifts.
 * Load Score = Sum(Duration * Difficulty)
 */
export const calculateHistoricalLoad = (
  historyShifts: Shift[],
  tasks: TaskTemplate[],
  userIds: string[]
): Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> => {
  const scores: Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> = {};

  userIds.forEach(uid => {
    scores[uid] = { totalLoadScore: 0, shiftsCount: 0, criticalShiftCount: 0 };
  });

  historyShifts.forEach(shift => {
    const task = tasks.find(t => t.id === shift.taskId);
    if (!task) return;

    // Difficulty mapping: handle both descriptive strings and direct numbers
    const diffMap: Record<string, number> = { 'easy': 1, 'medium': 2, 'hard': 3 };
    const difficultyScore = typeof task.difficulty === 'number'
      ? task.difficulty
      : (diffMap[String(task.difficulty)] || 1);

    // Duration Calc
    const start = new Date(shift.startTime).getTime();
    const end = new Date(shift.endTime).getTime();
    const durationHours = (end - start) / (1000 * 60 * 60);

    const isCritical = difficultyScore >= 3;

    shift.assignedPersonIds.forEach(pid => {
      if (scores[pid]) {
        scores[pid].totalLoadScore += (durationHours * difficultyScore);
        scores[pid].shiftsCount += 1;
        if (isCritical) {
          scores[pid].criticalShiftCount += 1;
        }
      }
    });
  });

  return scores;
};

/**
 * Fetch cached load scores from database
 * Returns null if cache doesn't exist or is stale (>5 minutes old)
 */
export const getCachedLoadScores = async (
  organizationId: string,
  maxAgeMinutes: number = 5
): Promise<Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> | null> => {
  try {
    const staleThreshold = new Date();
    staleThreshold.setMinutes(staleThreshold.getMinutes() - maxAgeMinutes);

    const data = await callBackend('/api/history/load-stats', 'GET', {
      orgId: organizationId,
      lastUpdated: staleThreshold.toISOString()
    });

    if (!data || data.length === 0) return null;

    // Convert to expected format
    const scores: Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }> = {};
    data.forEach((row: any) => {
      scores[row.person_id] = {
        totalLoadScore: Number(row.total_load_score),
        shiftsCount: Number(row.shifts_count),
        criticalShiftCount: Number(row.critical_shift_count)
      };
    });

    return scores;
  } catch (e) {
    console.warn('Failed to fetch cached load scores:', e);
    return null;
  }
};

/**
 * Update or initialize load cache for an organization
 * If incremental=true, only processes shifts since last update
 */
export const updateLoadCache = async (
  organizationId: string,
  tasks: TaskTemplate[],
  userIds: string[],
  incremental: boolean = true
): Promise<void> => {
  try {
    // Determine time range
    const endDate = new Date();
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 30); // Default: last 30 days

    if (incremental) {
      // Get the load stats to check for last_updated
      const existingCache = await callBackend('/api/history/load-stats', 'GET', {
        orgId: organizationId
      });

      if (existingCache && existingCache.length > 0) {
        // Sort to find oldest or just take first - the controller doesn't sort by last_updated yet but it's fine for now
        startDate = new Date(existingCache[0].last_updated);
      }
    }

    // Fetch shifts in the relevant time range
    const orgShifts = await fetchUserHistory(organizationId, endDate, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    // Calculate scores
    const scores = calculateHistoricalLoad(orgShifts, tasks, userIds);

    // Upsert to database
    const records = Object.entries(scores).map(([personId, stats]) => ({
      organization_id: organizationId,
      person_id: personId,
      total_load_score: stats.totalLoadScore,
      shifts_count: stats.shiftsCount,
      critical_shift_count: stats.criticalShiftCount,
      calculation_period_start: startDate.toISOString(),
      calculation_period_end: endDate.toISOString(),
      last_updated: new Date().toISOString()
    }));

    if (records.length > 0) {
      await callBackend('/api/history/load-stats', 'POST', records);
    }
  } catch (e) {
    console.error('Failed to update load cache:', e);
    throw e;
  }
};

/**
 * Get load scores with automatic cache management
 * Falls back to real-time calculation if cache is unavailable
 */
export const getLoadScoresWithCache = async (
  organizationId: string,
  tasks: TaskTemplate[],
  userIds: string[]
): Promise<Record<string, { totalLoadScore: number, shiftsCount: number, criticalShiftCount: number }>> => {
  // Try to get from cache first
  const cached = await getCachedLoadScores(organizationId);
  if (cached) {
    return cached;
  }

  // Cache miss or stale - update cache in background and return calculated values
  const endDate = new Date();
  const orgShifts = await fetchUserHistory(organizationId, endDate, 30);
  const scores = calculateHistoricalLoad(orgShifts, tasks, userIds);

  // Update cache asynchronously (don't wait)
  updateLoadCache(organizationId, tasks, userIds, false).catch(e =>
    console.warn('Background cache update failed:', e)
  );

  return scores;
};
