import { supabase } from '../lib/supabase';
import { TaskTemplate } from '../types';
import { mapTaskFromDB, mapTaskToDB } from './mappers';

export const taskService = {
  async fetchTasks(organizationId: string): Promise<TaskTemplate[]> {
    const { data, error } = await supabase
      .from('task_templates')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapTaskFromDB);
  },

  async addTask(task: Omit<TaskTemplate, 'id'>) {
    const taskAny = task as any;
    const durationHours = taskAny.duration_hours ?? taskAny.durationHours ?? taskAny.segments?.[0]?.durationHours ?? 4;
    const requiredPeople = taskAny.required_people ?? taskAny.requiredPeople ?? taskAny.segments?.[0]?.requiredPeople ?? 1;
    const schedulingType = taskAny.scheduling_type ?? taskAny.schedulingType ?? 'continuous';

    const { data, error } = await supabase.rpc('upsert_task_template', {
      p_id: null,
      p_name: taskAny.name,
      p_color: taskAny.color,
      p_duration_hours: durationHours,
      p_required_people: requiredPeople,
      p_scheduling_type: schedulingType
    });

    if (error) throw error;
    if (!data) throw new Error('Failed to save task template');
    return mapTaskFromDB(data);
  },

  async updateTask(task: TaskTemplate) {
    const taskAny = task as any;
    const durationHours = taskAny.duration_hours ?? taskAny.durationHours ?? taskAny.segments?.[0]?.durationHours ?? 4;
    const requiredPeople = taskAny.required_people ?? taskAny.requiredPeople ?? taskAny.segments?.[0]?.requiredPeople ?? 1;
    const schedulingType = taskAny.scheduling_type ?? taskAny.schedulingType ?? 'continuous';

    const { error } = await supabase.rpc('upsert_task_template', {
      p_id: taskAny.id,
      p_name: taskAny.name,
      p_color: taskAny.color,
      p_duration_hours: durationHours,
      p_required_people: requiredPeople,
      p_scheduling_type: schedulingType
    });

    if (error) throw error;
  },

  async deleteTask(id: string, organizationId: string) {
    const { error } = await supabase.rpc('delete_task_template_secure', {
      p_id: id
    });

    if (error) throw error;
  },

  async updateTaskSegments(taskId: string, segments: any[]) {
    const { data, error } = await supabase.rpc('update_task_segments', {
      p_task_id: taskId,
      p_segments: segments
    });

    if (error) throw error;
    return data;
  }
};
