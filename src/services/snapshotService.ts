import { supabase } from '../lib/supabase';

export interface Snapshot {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
  snapshot_date: string;
  tables_included: string[];
  record_counts: Record<string, number>;
  metadata: any;
  created_by_name?: string;
}

export const TABLES_TO_SNAPSHOT = [
  'teams',
  'roles',
  'people',
  'task_templates',
  'shifts',
  'absences',
  'daily_presence',
  // 'unified_presence', // Removed - not in use, causes duplicate key issues with triggers
  'hourly_blockages',
  'equipment',
  'equipment_daily_checks',
  'daily_attendance_snapshots',
  'user_load_stats',
  'mission_reports',
  'permission_templates',
  'scheduling_constraints',
  'team_rotations',
  'organization_settings'
];

/**
 * Maps PostgreSQL error codes to user-friendly Hebrew messages
 */
function mapSupabaseError(error: any): string {
  if (!error) return 'שגיאה לא ידועה';
  
  const code = error.code;
  const message = error.message || '';
  
  // PostgreSQL error codes
  switch (code) {
    case '23505': // unique_violation
      return 'גרסה עם שם זה כבר קיימת';
    
    case '23503': // foreign_key_violation
      return 'לא ניתן למחוק גרסה זו - קיימים רשומות תלויות';
    
    case 'P0001': // raise_exception (our custom trigger)
      if (message.includes('מגבלת 15 גרסאות')) {
        return 'הגעת למגבלת 15 גרסאות. נא למחוק גרסה ישנה לפני יצירת חדשה';
      }
      if (message.includes('הרשאה')) {
        return 'אין לך הרשאה לבצע פעולה זו';
      }
      return message;
    
    case '42703': // undefined_column
      return 'שגיאת מבנה נתונים - נא לפנות לתמיכה טכנית';
    
    case '42804': // datatype_mismatch
      return 'שגיאת סוג נתונים - נא לפנות לתמיכה טכנית';
    
    case '42501': // insufficient_privilege
      return 'אין לך הרשאה מספקת לבצע פעולה זו';
    
    case 'PGRST301': // Supabase RLS violation
      return 'אין לך גישה לגרסה זו';
    
    default:
      // Return original message if it's in Hebrew, otherwise generic message
      if (/[\u0590-\u05FF]/.test(message)) {
        return message;
      }
      return `שגיאה: ${message}`;
  }
}

export const snapshotService = {
  supabase,
  async fetchSnapshots(organizationId: string): Promise<Snapshot[]> {
    const { data, error } = await supabase
      .from('organization_snapshots')
      .select(`
        *,
        profiles:created_by (full_name)
      `)
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(mapSupabaseError(error));

    return data.map(snapshot => ({
      ...snapshot,
      created_by_name: (snapshot as any).profiles?.full_name || 'מערכת'
    }));
  },

  async createSnapshot(organizationId: string, name: string, description: string, userId: string) {
    // Start telemetry logging
    const { data: logData } = await supabase.rpc('log_snapshot_operation_start', {
      p_organization_id: organizationId,
      p_operation_type: 'create',
      p_snapshot_id: null,
      p_snapshot_name: name,
      p_user_id: userId
    });
    const logId = logData;

    try {
      // 1. Fetch data from all tables
      const tableData: Record<string, any[]> = {};
      const recordCounts: Record<string, number> = {};

      for (const tableName of TABLES_TO_SNAPSHOT) {
        let query = supabase
          .from(tableName)
          .select('*')
          .eq(tableName === 'equipment' ? 'organization_id' : (tableName === 'organizations' ? 'id' : 'organization_id'), organizationId);

        // Filter inactive people if requested
        if (tableName === 'people') {
             query = query.neq('is_active', false); // Use neq false to include nulls if any, or eq true. Typically default is true. Safe to say neq false or eq true. Let's use eq true to be strict as requested.
             // Actually, usually is_active defaults to true. If null, it's active?
             // User said "don't show inactive". 
             // Let's use .eq('is_active', true) if we trust the column is boolean.
             // Or better: .not('is_active', 'eq', false)
             query = query.eq('is_active', true);
        }

        const { data, error } = await query.limit(100000);

        if (error) {
          console.error(`Error fetching data for table ${tableName}:`, error);
          throw error;
        }

        tableData[tableName] = data || [];
        recordCounts[tableName] = data?.length || 0;
      }

      // 2. Prepare payload for RPC
      const payload = TABLES_TO_SNAPSHOT.map(tableName => ({
        table_name: tableName,
        data: tableData[tableName],
        row_count: recordCounts[tableName]
      }));

      // 3. Create snapshot via RPC (Transactional)
      const { data: snapshot, error: snapshotError } = await supabase.rpc('create_snapshot_v2', {
        p_organization_id: organizationId,
        p_name: name,
        p_description: description,
        p_created_by: userId,
        p_payload: payload
      });

      if (snapshotError) throw new Error(mapSupabaseError(snapshotError));

      // Log success
      const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);
      if (logId) {
        await supabase.rpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success',
          p_records_affected: totalRecords
        });
      }

      return snapshot;
    } catch (error: any) {
      // Log failure
      if (logId) {
        await supabase.rpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'failed',
          p_error_message: error.message,
          p_error_code: error.code
        });
      }
      throw error;
    }
  },

  async getSnapshotPreview(snapshotId: string) {
    const { data, error } = await supabase
      .from('snapshot_table_data')
      .select('table_name, row_count')
      .eq('snapshot_id', snapshotId);

    if (error) throw new Error(mapSupabaseError(error));
    return data;
  },

  async restoreSnapshot(
    snapshotId: string, 
    organizationId: string, 
    userId: string,
    onProgress?: (message: string) => void,
    tableNames?: string[]
  ) {
    // Get snapshot name for logging
    const { data: snapshotData } = await supabase
      .from('organization_snapshots')
      .select('name')
      .eq('id', snapshotId)
      .single();

    // Start telemetry logging
    const { data: logData } = await supabase.rpc('log_snapshot_operation_start', {
      p_organization_id: organizationId,
      p_operation_type: 'restore',
      p_snapshot_id: snapshotId,
      p_snapshot_name: snapshotData?.name || 'Unknown',
      p_user_id: userId
    });
    const logId = logData;

    // CRITICAL: Create automatic pre-restore backup for safety
    const timestamp = new Date().toLocaleString('he-IL', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    let preRestoreSnapshotId: string | null = null;
    
    try {
      // Check if we need to rotate (delete oldest) before creating pre-restore backup
      const { data: existingSnapshots } = await supabase
        .from('organization_snapshots')
        .select('id, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });
      
      // If we have 10 snapshots, delete the oldest one to make room for pre-restore backup
      if (existingSnapshots && existingSnapshots.length >= 10) {
        const oldestSnapshot = existingSnapshots[0];
        console.log('🗑️ Auto-rotating: Deleting oldest snapshot to make room for pre-restore backup:', oldestSnapshot.id);
        onProgress?.('🗑️ מוחק גרסה ישנה...');
        
        await supabase
          .from('organization_snapshots')
          .delete()
          .eq('id', oldestSnapshot.id);
      }
      
      onProgress?.('💾 יוצר גיבוי בטיחות...');
      
      // Create safety backup
      const preRestoreSnapshot = await this.createSnapshot(
        organizationId,
        `🔒 גיבוי אוטומטי - ${timestamp}`,
        'גיבוי בטיחות שנוצר אוטומטית לפני שחזור מערכת',
        userId
      );
      preRestoreSnapshotId = preRestoreSnapshot.id;
      
      console.log('✅ Pre-restore backup created:', preRestoreSnapshotId);
      
      onProgress?.('🧹 מנקה נתונים קיימים...');
      
      // Phase 1: Clean up all relevant data in one go to avoid FK violations during batched insertion
      const { error: cleanError } = await supabase.rpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: null, // null means all tables the RPC knows about
        p_operation: 'delete_only'
      });

      if (cleanError) {
        console.error('Cleanup RPC error:', cleanError);
        throw cleanError;
      }

      // Phase 2: Perform restoration in batches
      
      onProgress?.('⚡ משחזר הגדרות ליבה (שלב 1/3)...');
      // Batch 1: Core metadata and structure
      const batch1 = ['organization_settings', 'teams', 'roles', 'permission_templates'];
      const { error: error1 } = await supabase.rpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: batch1.filter(t => !tableNames || tableNames.includes(t)),
        p_operation: 'insert_only'
      });
      if (error1) throw error1;

      onProgress?.('👥 משחזר כוח אדם ושיבוצים (שלב 2/3)...');
      // Batch 2: Personnel and core planning
      const batch2 = ['people', 'task_templates', 'team_rotations', 'scheduling_constraints'];
      const { error: error2 } = await supabase.rpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: batch2.filter(t => !tableNames || tableNames.includes(t)),
        p_operation: 'insert_only'
      });
      if (error2) throw error2;

      onProgress?.('📊 משחזר נוכחות ודוחות (שלב 3/3)...');
      // Batch 3: Heavy dynamic data
      const batch3 = ['shifts', 'absences', 'daily_presence', 'hourly_blockages', 'equipment', 'equipment_daily_checks', 'daily_attendance_snapshots', 'user_load_stats', 'mission_reports', 'unified_presence'];
      const { error: error3 } = await supabase.rpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: batch3.filter(t => !tableNames || tableNames.includes(t)),
        p_operation: 'insert_only'
      });
      if (error3) throw error3;

      // Log success
      if (logId) {
        await supabase.rpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success',
          p_pre_restore_backup_id: preRestoreSnapshotId
        });
      }
      
      return { preRestoreSnapshotId };
    } catch (error: any) {
      // Log failure
      if (logId) {
        await supabase.rpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'failed',
          p_error_message: error.message,
          p_error_code: error.code,
          p_pre_restore_backup_id: preRestoreSnapshotId
        });
      }
      
      // If restore failed, we still have the pre-restore backup
      console.error('Restoration failed. Pre-restore backup preserved:', preRestoreSnapshotId);
      throw error;
    }
  },

  async deleteSnapshot(snapshotId: string, organizationId: string, userId: string) {
    // Get snapshot name for logging
    const { data: snapshotData } = await supabase
      .from('organization_snapshots')
      .select('name')
      .eq('id', snapshotId)
      .single();

    // Start telemetry logging
    const { data: logData } = await supabase.rpc('log_snapshot_operation_start', {
      p_organization_id: organizationId,
      p_operation_type: 'delete',
      p_snapshot_id: snapshotId,
      p_snapshot_name: snapshotData?.name || 'Unknown',
      p_user_id: userId
    });
    const logId = logData;

    try {
      const { error } = await supabase.rpc('delete_snapshot_v2', {
        p_organization_id: organizationId,
        p_snapshot_id: snapshotId
      });

      if (error) throw new Error(mapSupabaseError(error));

      // Log success
      if (logId) {
        await supabase.rpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success'
        });
      }
    } catch (error: any) {
      // Log failure
      if (logId) {
        await supabase.rpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'failed',
          p_error_message: error.message,
          p_error_code: error.code
        });
      }
      throw error;
    }
  },

  async fetchSnapshotTableData(snapshotId: string, tableName: string) {
    const { data, error } = await supabase
      .from('snapshot_table_data')
      .select('data')
      .eq('snapshot_id', snapshotId)
      .eq('table_name', tableName)
      .single();

    if (error) throw new Error(mapSupabaseError(error));
    return data.data;
  },

  async fetchSnapshotDataBundle(snapshotId: string, tableNames: string[]) {
    const { data, error } = await supabase.rpc('get_snapshot_data_bundle', {
      p_snapshot_id: snapshotId,
      p_table_names: tableNames
    });

    if (error) throw new Error(mapSupabaseError(error));
    return data;
  },

  async restoreRecords(tableName: string, records: any[]) {
    if (!records || records.length === 0) return;

    // Use upsert to update existing or insert new
    const { error } = await supabase
      .from(tableName)
      .upsert(records, { onConflict: 'id' });

    if (error) throw new Error(mapSupabaseError(error));
    return { count: records.length };
  }
};
