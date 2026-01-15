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

const TABLES_TO_SNAPSHOT = [
  'teams',
  'roles',
  'people',
  'task_templates',
  'shifts',
  'absences',
  'daily_presence',
  'unified_presence',
  'hourly_blockages',
  'equipment',
  'equipment_daily_checks',
  'daily_attendance_snapshots',
  'user_load_stats',
  'mission_reports',
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
      if (message.includes('מגבלת 5 גרסאות')) {
        return 'הגעת למגבלת 5 גרסאות. נא למחוק גרסה ישנה לפני יצירת חדשה';
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
    // 1. Fetch data from all tables
    const tableData: Record<string, any[]> = {};
    const recordCounts: Record<string, number> = {};

    for (const tableName of TABLES_TO_SNAPSHOT) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(tableName === 'equipment' ? 'organization_id' : (tableName === 'organizations' ? 'id' : 'organization_id'), organizationId);

      // Handle table-specific organization_id column names if necessary
      // Based on schema, most have organization_id. Equipment has organization_id as text.
      
      if (error) {
        console.error(`Error fetching data for table ${tableName}:`, error);
        throw error;
      }

      tableData[tableName] = data || [];
      recordCounts[tableName] = data?.length || 0;
    }

    // 2. Create snapshot record
    const { data: snapshot, error: snapshotError } = await supabase
      .from('organization_snapshots')
      .insert({
        organization_id: organizationId,
        name,
        description,
        created_by: userId,
        tables_included: TABLES_TO_SNAPSHOT,
        record_counts: recordCounts
      })
      .select()
      .single();

    if (snapshotError) throw new Error(mapSupabaseError(snapshotError));

    // 3. Save table data
    const snapshotTableData = TABLES_TO_SNAPSHOT.map(tableName => ({
      snapshot_id: snapshot.id,
      table_name: tableName,
      data: tableData[tableName],
      row_count: recordCounts[tableName]
    }));

    const { error: dataError } = await supabase
      .from('snapshot_table_data')
      .insert(snapshotTableData);

    if (dataError) {
      // Rollback snapshot record if data fails
      await supabase.from('organization_snapshots').delete().eq('id', snapshot.id);
      throw new Error(mapSupabaseError(dataError));
    }

    return snapshot;
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
    onProgress?: (message: string) => void
  ) {
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
      
      // If we have 5 snapshots, delete the oldest one to make room for pre-restore backup
      if (existingSnapshots && existingSnapshots.length >= 5) {
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
      
      onProgress?.('⚡ משחזר מערכת...');
      
      // Perform restoration
      const { error } = await supabase.rpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId
      });

      if (error) throw new Error(mapSupabaseError(error));
      
      return { preRestoreSnapshotId };
    } catch (error) {
      // If restore failed, we still have the pre-restore backup
      console.error('Restoration failed. Pre-restore backup preserved:', preRestoreSnapshotId);
      throw error;
    }
  },

  async deleteSnapshot(snapshotId: string) {
    const { error } = await supabase
      .from('organization_snapshots')
      .delete()
      .eq('id', snapshotId);

    if (error) throw new Error(mapSupabaseError(error));
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
  }
};
