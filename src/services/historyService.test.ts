import { describe, it, expect } from 'vitest';
import { calculateHistoricalLoad } from './historyService';
import { Shift, TaskTemplate } from '../types';

describe('History Service (calculateHistoricalLoad)', () => {
    
  const mockTasks: TaskTemplate[] = [
    { id: 't-easy', name: 'Easy Task', difficulty: 1, organization_id: 'org-1', segments: [], color: 'blue' },
    { id: 't-med', name: 'Med Task', difficulty: 2, organization_id: 'org-1', segments: [], color: 'green' },
    { id: 't-hard', name: 'Hard Task', difficulty: 3, organization_id: 'org-1', segments: [], color: 'red' }
  ];

  it('should calculate load score correctly for a single shift', () => {
    const shifts: Shift[] = [{
      id: 's1',
      taskId: 't-med', // Difficulty 2
      startTime: '2026-01-18T08:00:00Z',
      endTime: '2026-01-18T12:00:00Z', // 4 hours
      assignedPersonIds: ['p1'],
      isLocked: true,
      organization_id: 'org-1'
    }];
    
    const result = calculateHistoricalLoad(shifts, mockTasks, ['p1']);
    
    // 4 hours * 2 difficulty = 8
    expect(result['p1'].totalLoadScore).toBe(8);
    expect(result['p1'].shiftsCount).toBe(1);
    expect(result['p1'].criticalShiftCount).toBe(0);
  });

  it('should identify critical shifts (difficulty >= 3)', () => {
    const shifts: Shift[] = [{
      id: 's1',
      taskId: 't-hard', // Difficulty 3
      startTime: '2026-01-18T08:00:00Z',
      endTime: '2026-01-18T10:00:00Z', // 2 hours
      assignedPersonIds: ['p1'],
      isLocked: true,
      organization_id: 'org-1'
    }];
    
    const result = calculateHistoricalLoad(shifts, mockTasks, ['p1']);
    
    // 2 hours * 3 difficulty = 6
    expect(result['p1'].totalLoadScore).toBe(6);
    expect(result['p1'].criticalShiftCount).toBe(1);
  });

  it('should sum up multiple shifts for multiple users', () => {
    const shifts: Shift[] = [
      {
        id: 's1',
        taskId: 't-easy', // Diff 1
        startTime: '2026-01-18T08:00:00Z',
        endTime: '2026-01-18T10:00:00Z', // 2h
        assignedPersonIds: ['p1', 'p2'],
        isLocked: true,
        organization_id: 'org-1'
      },
      {
        id: 's2',
        taskId: 't-hard', // Diff 3
        startTime: '2026-01-18T12:00:00Z',
        endTime: '2026-01-18T14:00:00Z', // 2h
        assignedPersonIds: ['p1'],
        isLocked: true,
        organization_id: 'org-1'
      }
    ];

    const result = calculateHistoricalLoad(shifts, mockTasks, ['p1', 'p2']);

    // P1: (2*1) + (2*3) = 8. Shifts: 2. Critical: 1
    expect(result['p1'].totalLoadScore).toBe(8);
    expect(result['p1'].shiftsCount).toBe(2);
    expect(result['p1'].criticalShiftCount).toBe(1);

    // P2: (2*1) = 2. Shifts: 1. Critical: 0
    expect(result['p2'].totalLoadScore).toBe(2);
    expect(result['p2'].shiftsCount).toBe(1);
    expect(result['p2'].criticalShiftCount).toBe(0);
  });

  it('should handle tasks not found gracefully', () => {
    const shifts: Shift[] = [{
      id: 's1',
      taskId: 'non-existent',
      startTime: '2026-01-18T08:00:00Z',
      endTime: '2026-01-18T12:00:00Z',
      assignedPersonIds: ['p1'],
      isLocked: true,
      organization_id: 'org-1'
    }];
    
    const result = calculateHistoricalLoad(shifts, mockTasks, ['p1']);
    expect(result['p1'].totalLoadScore).toBe(0);
  });
});
