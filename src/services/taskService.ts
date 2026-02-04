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
    const dbPayload = mapTaskToDB(task as TaskTemplate);
    delete (dbPayload as any).id;

    const { data, error } = await supabase
      .from('task_templates')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapTaskFromDB(data);
  },

  async updateTask(task: TaskTemplate) {
    const { error } = await supabase
      .from('task_templates')
      .update(mapTaskToDB(task))
      .eq('id', task.id);

    if (error) throw error;
  },

  async deleteTask(id: string, organizationId: string) {
    const { error } = await supabase
      .from('task_templates')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

    if (error) throw error;
  },

  async updateTaskSegments(taskId: string, segments: any[]) {
    const { error } = await supabase
      .from('task_templates')
      .update({ segments })
      .eq('id', taskId);

    if (error) throw error;
  }
};
