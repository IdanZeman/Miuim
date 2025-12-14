import { supabase, mapShiftFromDB } from './supabaseClient';
import { Shift, TaskTemplate } from '../types';

export interface HistoryScore {
  userId: string;
  totalLoadScore: number;
  shiftsCount: number;
  criticalShiftCount: number;
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

    // Difficulty mapping
    const diffMap: Record<string, number> = { 'easy': 1, 'medium': 2, 'hard': 3 };
    const difficultyScore = diffMap[task.difficulty as string] || 1;

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
