import { supabase } from '../lib/supabase';
import { TaskTemplate } from '../types';
import { mapTaskFromDB, mapTaskToDB, mapSegmentToDB } from './mappers';
import { callBackend } from './backendService';

const callAdminRpc = async (rpcName: string, params?: any) => {
  const start = Date.now();
  try {
    const result = await callBackend('/api/admin/rpc', 'POST', { rpcName, params });
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow Client RPC: ${rpcName} took ${duration}ms`);
    }
    return result;
  } catch (e) {
    console.error(`RPC Fail: ${rpcName} took ${Date.now() - start}ms`, e);
    throw e;
  }
};

export const taskService = {
  async fetchTasks(organizationId: string): Promise<TaskTemplate[]> {
    const data = await callBackend(`/api/org/tasks?orgId=${organizationId}`, 'GET');
    return (data || []).map(mapTaskFromDB);
  },

  async addTask(task: Omit<TaskTemplate, 'id'>) {
    const taskAny = task as any;

    // Sum up required people and duration from segments if they exist
    let requiredPeople = taskAny.requiredPeople || 1;
    let durationHours = taskAny.durationHours || 4;

    if (taskAny.segments && taskAny.segments.length > 0) {
      requiredPeople = taskAny.segments.reduce((sum: number, s: any) => sum + (s.requiredPeople || 0), 0);
      durationHours = taskAny.segments.reduce((sum: number, s: any) => sum + (s.durationHours || 0), 0);

      // Fallback if sum is 0
      if (requiredPeople === 0) requiredPeople = 1;
      if (durationHours === 0) durationHours = 4;
    }

    const schedulingType = taskAny.scheduling_type ?? taskAny.schedulingType ?? 'continuous';

    const templateData = await callAdminRpc('upsert_task_template', {
      p_id: null,
      p_name: taskAny.name,
      p_color: taskAny.color,
      p_duration_hours: durationHours,
      p_required_people: requiredPeople,
      p_scheduling_type: schedulingType,
      p_difficulty: taskAny.difficulty ?? 3,
      p_assigned_team_id: taskAny.assignedTeamId ?? null,
      p_start_date: taskAny.startDate ?? null,
      p_end_date: taskAny.endDate ?? null,
      p_is_24_7: taskAny.is247 ?? false,
      p_icon: taskAny.icon ?? null
    });
    if (!templateData) throw new Error('Failed to save task template');

    // Persist segments if present
    if (taskAny.segments && taskAny.segments.length > 0) {
      const dbSegments = taskAny.segments.map(mapSegmentToDB);
      await this.updateTaskSegments(templateData.id, dbSegments);
    }

    return mapTaskFromDB({ ...templateData, segments: taskAny.segments });
  },

  async updateTask(task: TaskTemplate) {
    const taskAny = task as any;

    // Sum up required people and duration from segments if they exist
    let requiredPeople = taskAny.requiredPeople || 1;
    let durationHours = taskAny.durationHours || 4;

    if (taskAny.segments && taskAny.segments.length > 0) {
      requiredPeople = taskAny.segments.reduce((sum: number, s: any) => sum + (s.requiredPeople || 0), 0);
      durationHours = taskAny.segments.reduce((sum: number, s: any) => sum + (s.durationHours || 0), 0);

      // Fallback if sum is 0
      if (requiredPeople === 0) requiredPeople = 1;
      if (durationHours === 0) durationHours = 4;
    }

    const schedulingType = taskAny.scheduling_type ?? taskAny.schedulingType ?? 'continuous';

    await callAdminRpc('upsert_task_template', {
      p_id: taskAny.id,
      p_name: taskAny.name,
      p_color: taskAny.color,
      p_duration_hours: durationHours,
      p_required_people: requiredPeople,
      p_scheduling_type: schedulingType,
      p_difficulty: taskAny.difficulty ?? 3,
      p_assigned_team_id: taskAny.assignedTeamId ?? null,
      p_start_date: taskAny.startDate ?? null,
      p_end_date: taskAny.endDate ?? null,
      p_is_24_7: taskAny.is247 ?? false,
      p_icon: taskAny.icon ?? null
    });

    // Persist segments if present
    if (taskAny.segments && taskAny.segments.length > 0) {
      const dbSegments = taskAny.segments.map(mapSegmentToDB);
      await this.updateTaskSegments(taskAny.id, dbSegments);
    }
  },

  async deleteTask(id: string, organizationId: string) {
    await callAdminRpc('delete_task_template_secure', {
      p_id: id
    });
  },

  async updateTaskSegments(taskId: string, segments: any[]) {
    return await callAdminRpc('update_task_segments', {
      p_task_id: taskId,
      p_segments: segments
    });
  }
};
