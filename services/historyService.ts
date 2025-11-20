import { supabase, mapShiftFromDB } from './supabaseClient';
import { Shift, TaskTemplate } from '../types';

export interface HistoryScore {
  userId: string;
  totalLoadScore: number;
  shiftsCount: number;
}

/**
 * Fetch shifts from the last 30 days (or specified range)
 */
export const fetchUserHistory = async (endDate: Date, daysBack: number = 30): Promise<Shift[]> => {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  const endDateStr = endDate.toISOString();
  const startDateStr = startDate.toISOString();

  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .gte('start_time', startDateStr)
      .lte('end_time', endDateStr);

    if (error) throw error;
    
    return data.map(mapShiftFromDB);
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
  shifts: Shift[], 
  tasks: TaskTemplate[], 
  allUserIds: string[]
): Record<string, HistoryScore> => {
  const scores: Record<string, HistoryScore> = {};

  // Initialize 0 for everyone
  allUserIds.forEach(uid => {
    scores[uid] = { userId: uid, totalLoadScore: 0, shiftsCount: 0 };
  });

  shifts.forEach(shift => {
    const task = tasks.find(t => t.id === shift.taskId);
    if (!task) return;

    const load = task.durationHours * task.difficulty;

    shift.assignedPersonIds.forEach(uid => {
      if (scores[uid]) {
        scores[uid].totalLoadScore += load;
        scores[uid].shiftsCount += 1;
      }
    });
  });

  return scores;
};
