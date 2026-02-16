import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { getEffectiveAvailability } from '../utils/attendanceUtils';
import { mapPersonFromDB } from './mappers';
import { Person } from '@/types';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

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
  'organization_settings',
  'organizations'
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
      if (message.includes('מגבלת 30 גרסאות')) {
        return 'הגעת למגבלת 30 גרסאות. נא למחוק גרסה ישנה לפני יצירת חדשה';
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
    const data = await callBackend(`/api/admin/snapshots?organizationId=${organizationId}`, 'GET');
    return (data || []).map((snapshot: any) => ({
      ...snapshot,
      created_by_name: (snapshot as any).profiles?.full_name || 'מערכת'
    }));
  },

  async createSnapshot(organizationId: string, name: string, description: string, userId: string) {
    // Start telemetry logging
    const logData = await callAdminRpc('log_snapshot_operation_start', {
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
          .eq(tableName === 'organizations' ? 'id' : 'organization_id', organizationId);

        // Filter inactive people if requested
        if (tableName === 'people') {
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
      const snapshot = await callAdminRpc('create_snapshot_v2', {
        p_organization_id: organizationId,
        p_name: name,
        p_description: description,
        p_created_by: userId,
        p_payload: payload
      });

      // Log success
      const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + count, 0);
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success',
          p_records_affected: totalRecords
        });
      }

      return snapshot;
    } catch (error: any) {
      // Log failure
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'failed',
          p_error_message: error.message,
          p_error_code: error.code
        });
      }
      throw error;
    }
  },

  /**
   * New Server-Side Snapshot Creation (V3)
   * Offloads all calculation and data gathering to the server.
   */
  async createSnapshotV3(organizationId: string, name: string, description: string, userId: string) {
    // Start telemetry logging
    const logData = await callAdminRpc('log_snapshot_operation_start', {
      p_organization_id: organizationId,
      p_operation_type: 'create',
      p_snapshot_id: null,
      p_snapshot_name: name,
      p_user_id: userId
    });
    const logId = logData;

    try {
      const snapshot = await callAdminRpc('create_snapshot_v3', {
        p_organization_id: organizationId,
        p_name: name,
        p_description: description,
        p_created_by: userId
      });

      // Log success
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success',
          p_records_affected: 0 // Server calculates this internally usually
        });
      }

      return snapshot;
    } catch (error: any) {
      // Log failure
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
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
    const data = await callBackend(`/api/admin/snapshots/data?snapshotId=${snapshotId}&tableName=dummy`, 'GET'); // Preview usually just needs counts
    // Actually the RPC 'get_snapshot_table_data_info' is already used in fetchSnapshotTableData.
    // For preview, we should probably add a dedicated endpoint if needed, but let's use the info RPC.
    return await callAdminRpc('get_snapshot_table_data_info', { p_snapshot_id: snapshotId });
  },

  /**
   * Generates a comprehensive set of daily_presence records for a snapshot,
   * including those that were previously derived from propagation (e.g. "Base").
   * This is used to "freeze" the state of attendance during restoration.
   */
  async consolidatePropagatedStatuses(snapshotId: string, organizationId: string, targetMonth: string, personIds?: string[]) {
    logger.info('UPDATE', `[SnapshotService] Consolidating propagated statuses for ${targetMonth}${personIds ? ` for ${personIds.length} people` : ''}`);

    // 1. Fetch data bundle needed for calculation
    const bundle = await this.fetchSnapshotDataBundle(snapshotId, [
      'people',
      'teams',
      'team_rotations',
      'absences',
      'hourly_blockages',
      'daily_presence',
      'organization_settings',
      'organizations'
    ]);

    if (!bundle || !bundle.people) return [];

    // Filter people if needed
    const peopleToCalculate = personIds
      ? bundle.people.filter((p: any) => personIds.includes(p.id))
      : bundle.people;

    // 2. Identify date range (full month of targetMonth)
    const [year, month] = targetMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const dates: Date[] = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }

    // 3. Setup context maps
    const absences = bundle.absences || [];
    const rotations = bundle.team_rotations || [];
    const blockages = bundle.hourly_blockages || [];

    // Engine version is stored on organizations, but check settings as fallback
    const engineVersion = bundle.organizations?.[0]?.engine_version ||
      bundle.organization_settings?.[0]?.engine_version ||
      'v1_legacy';

    // Map existing presence to people for calculation (Reconstruct as a MAP keyed by date)
    const presenceByPerson: Record<string, Record<string, any>> = {};
    (bundle.daily_presence || []).forEach((p: any) => {
      const pid = p.person_id || p.personId;
      if (!presenceByPerson[pid]) presenceByPerson[pid] = {};

      let dateKey = p.date || p.start_date || p.startDate;
      if (dateKey && dateKey.includes('T')) dateKey = dateKey.split('T')[0];

      if (dateKey) {
        presenceByPerson[pid][dateKey] = {
          status: p.status,
          isAvailable: p.is_available ?? p.isAvailable,
          startHour: p.start_time ?? p.startTime ?? p.startHour,
          endHour: p.end_time ?? p.endTime ?? p.endHour,
          v2_state: p.v2_state,
          v2_sub_state: p.v2_sub_state,
          source: p.source,
          homeStatusType: p.home_status_type ?? p.homeStatusType,
          unavailableBlocks: p.unavailable_blocks ?? p.unavailableBlocks
        };
      }
    });

    const consolidatedRecords: any[] = [];

    // 4. Calculate for each person and date
    peopleToCalculate.forEach((rawPerson: any) => {
      const person = mapPersonFromDB({
        ...rawPerson,
        daily_availability: presenceByPerson[rawPerson.id] || {}
      });

      dates.forEach((date: Date) => {
        const avail = getEffectiveAvailability(
          person as Person,
          date,
          rotations,
          absences,
          blockages,
          engineVersion
        );

        // We save EVERY record that has a clear status, forcing it to manual.
        // If the status is 'not_defined', we skip it to avoid cluttering.
        if (avail.status && avail.status !== 'not_defined') {
          // IMPORTANT: Generate date string safely without UTC shift
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');
          const dateKey = `${y}-${m}-${d}`;

          // Safely map status to one of the allowed legacy values: home, base, unavailable, leave
          let dbStatus: 'home' | 'base' | 'unavailable' | 'leave' = avail.isAvailable ? 'base' : 'home';
          if (['unavailable', 'leave'].includes(avail.status || '')) {
            dbStatus = avail.status as any;
          }

          consolidatedRecords.push({
            organization_id: organizationId,
            person_id: person.id,
            date: dateKey,
            status: dbStatus,
            start_time: avail.startHour || '00:00',
            end_time: avail.endHour || '23:59',
            v2_state: avail.v2_state,
            v2_sub_state: avail.v2_sub_state,
            source: 'manual', // FREEZE it as manual
            home_status_type: avail.homeStatusType
          });
        }
      });
    });

    return consolidatedRecords;
  },

  async restoreSnapshot(
    snapshotId: string,
    organizationId: string,
    userId: string,
    onProgress?: (message: string) => void,
    tableNames?: string[]
  ) {
    // Get snapshot data for logging
    const snapshotDetails = await callBackend(`/api/admin/snapshots/details?snapshotId=${snapshotId}`, 'GET');

    // Start telemetry logging
    const logData = await callAdminRpc('log_snapshot_operation_start', {
      p_organization_id: organizationId,
      p_operation_type: 'restore',
      p_snapshot_id: snapshotId,
      p_snapshot_name: snapshotDetails?.name || 'Unknown',
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
      // Rotate if needed (delete oldest)
      const existingSnapshots = await callBackend(`/api/admin/snapshots?organizationId=${organizationId}`, 'GET');

      if (existingSnapshots && existingSnapshots.length >= 30) {
        const oldestSnapshot = existingSnapshots[existingSnapshots.length - 1]; // Sorted desc, so last is oldest
        console.log('🗑️ Auto-rotating: Deleting oldest snapshot', oldestSnapshot.id);
        onProgress?.('🗑️ מוחק גרסה ישנה...');
        await callBackend(`/api/admin/snapshots`, 'DELETE', { snapshotId: oldestSnapshot.id });
      }

      onProgress?.('💾 יוצר גיבוי בטיחות...');
      const preRestoreSnapshot = await this.createSnapshotV3(
        organizationId,
        `🔒 גיבוי בטיחות - ${timestamp}`,
        'גיבוי בטיחות שנוצר אוטומטית לפני שחזור מערכת',
        userId
      );
      preRestoreSnapshotId = preRestoreSnapshot.id;

      console.log('✅ Pre-restore backup created:', preRestoreSnapshotId);

      onProgress?.('🧹 מנקה נתונים קיימים...');

      // Phase 1: Clean up all relevant data in one go to avoid FK violations during batched insertion
      await callAdminRpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: null, // null means all tables the RPC knows about
        p_operation: 'delete_only'
      });

      // Phase 2: Perform restoration in batches

      onProgress?.('⚡ משחזר הגדרות ליבה (שלב 1/3)...');
      // Batch 1: Core metadata and structure
      const batch1 = ['organization_settings', 'teams', 'roles', 'permission_templates'];
      await callAdminRpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: batch1.filter(t => !tableNames || tableNames.includes(t)),
        p_operation: 'insert_only'
      });

      onProgress?.('👥 משחזר כוח אדם ושיבוצים (שלב 2/3)...');
      // Batch 2: Personnel and core planning
      const batch2 = ['people', 'task_templates', 'team_rotations', 'scheduling_constraints'];
      await callAdminRpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: batch2.filter(t => !tableNames || tableNames.includes(t)),
        p_operation: 'insert_only'
      });

      onProgress?.('📊 משחזר נוכחות ודוחות (שלב 3/3)...');
      // Batch 3: Heavy dynamic data
      const batch3 = ['shifts', 'absences', 'daily_presence', 'hourly_blockages', 'equipment', 'equipment_daily_checks', 'daily_attendance_snapshots', 'user_load_stats', 'mission_reports', 'unified_presence'];

      await callAdminRpc('restore_snapshot', {
        p_snapshot_id: snapshotId,
        p_organization_id: organizationId,
        p_table_names: batch3.filter(t => !tableNames || tableNames.includes(t)),
        p_operation: 'insert_only'
      });

      // Special Post-processing for daily_presence to "Freeze" the current effective state
      if (!tableNames || tableNames.includes('daily_presence')) {
        try {
          onProgress?.('❄️ מקפיא נתוני נוכחות...');
          const snapshot = await callBackend(`/api/admin/snapshots/details?snapshotId=${snapshotId}`, 'GET');
          if (snapshot) {
            const snapMonth = (snapshot.created_at || snapshot.createdAt).slice(0, 7);
            const consolidated = await this.consolidatePropagatedStatuses(snapshotId, organizationId, snapMonth);
            if (consolidated.length > 0) {
              await this.restoreRecords('daily_presence', consolidated);
            }
          }
        } catch (err) {
          console.error('[SnapshotService] Failed to consolidate statuses during full restore:', err);
          // Don't fail the whole restore if consolidation fails
        }
      }

      // Log success
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success',
          p_pre_restore_backup_id: preRestoreSnapshotId
        });
      }

      return { preRestoreSnapshotId };
    } catch (error: any) {
      // Log failure
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
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
    // Start telemetry logging
    const logData = await callAdminRpc('log_snapshot_operation_start', {
      p_organization_id: organizationId,
      p_operation_type: 'delete',
      p_snapshot_id: snapshotId,
      p_snapshot_name: 'Deletion',
      p_user_id: userId
    });
    const logId = logData;

    try {
      await callAdminRpc('delete_snapshot_v2', {
        p_organization_id: organizationId,
        p_snapshot_id: snapshotId
      });

      // Log success
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'success'
        });
      }
    } catch (error: any) {
      // Log failure
      if (logId) {
        await callAdminRpc('log_snapshot_operation_complete', {
          p_log_id: logId,
          p_status: 'failed',
          p_error_message: error.message,
          p_error_code: error.code
        });
      }
      throw error;
    }
  },

  async fetchSnapshotTableData(snapshotId: string, tableName: string, onProgress?: (percent: number) => void) {
    // 1. Get total record count first
    const info = await callAdminRpc('get_snapshot_table_data_info', {
      p_snapshot_id: snapshotId,
      p_table_name: tableName
    });

    const totalCount = info?.total_count || 0;
    if (totalCount === 0) {
      // Fallback or double check: some legacy snapshots might not have row_count set correctly in specific fields
      // though our schema usually has it.
      const data = await callBackend(`/api/admin/snapshots/data?snapshotId=${snapshotId}&tableName=${tableName}`, 'GET');
      return data?.data || [];
    }

    // 2. Fetch in chunks if count > 0
    const CHUNK_SIZE = 1000;
    let allRecords: any[] = [];

    for (let offset = 0; offset < totalCount; offset += CHUNK_SIZE) {
      const chunk = await callAdminRpc('get_snapshot_table_data_chunk', {
        p_snapshot_id: snapshotId,
        p_table_name: tableName,
        p_offset: offset,
        p_limit: CHUNK_SIZE
      });

      if (chunk && Array.isArray(chunk)) {
        allRecords = [...allRecords, ...chunk];
      }

      if (onProgress) {
        const percent = Math.min(100, Math.round((allRecords.length / totalCount) * 100));
        onProgress(percent);
      }
    }

    return allRecords;
  },

  async fetchSnapshotDataBundle(snapshotId: string, tableNames: string[]) {
    return await callAdminRpc('get_snapshot_data_bundle', {
      p_snapshot_id: snapshotId,
      p_table_names: tableNames
    });
  },

  async restoreRecords(tableName: string, records: any[]) {
    if (!records || records.length === 0) return;

    logger.info('UPDATE', `[SnapshotService] Restoring ${records.length} records to ${tableName}`);

    // Pre-processing for daily_presence: Delete existing records in the target range to ensure a clean restore
    if (tableName === 'daily_presence' && records.length > 0) {
      try {
        const orgId = records[0].organization_id || records[0].organizationId;
        if (orgId) {
          const personIds = [...new Set(records.map(r => r.person_id || r.personId))].filter(Boolean);
          const dates = records
            .map(r => {
              const d = r.date || r.startDate || r.start_date;
              return typeof d === 'string' ? d.split('T')[0] : null;
            })
            .filter(Boolean)
            .sort();

          if (personIds.length > 0 && dates.length > 0) {
            const minDate = dates[0];
            const maxDate = dates[dates.length - 1];

            logger.info('UPDATE', `[SnapshotService] Pre-restore cleanup: Deleting daily_presence for ${personIds.length} people from ${minDate} to ${maxDate}`);

            await callAdminRpc('exec_sql', {
              query: `DELETE FROM daily_presence 
                      WHERE organization_id = '${orgId}' 
                      AND person_id = '${records[0].person_id}' 
                      AND date >= '${minDate}' 
                      AND date <= '${maxDate}'`
            });
          }
        }
      } catch (err) {
        console.error('[SnapshotService] Error during pre-restore cleanup:', err);
      }
    }

    const CONFLICT_TARGETS: Record<string, string> = {
      'daily_presence': 'date, person_id, organization_id',
      'organization_settings': 'organization_id'
    };

    const onConflict = CONFLICT_TARGETS[tableName] || 'id';

    const sanitizedRecords = records.map(r => {
      if (['daily_presence', 'organization_settings'].includes(tableName)) {
        const { id, created_at, updated_at, ...rest } = r;

        let cleanDate = rest.date;
        if (tableName === 'daily_presence' && cleanDate && typeof cleanDate === 'string' && cleanDate.includes('T')) {
          cleanDate = cleanDate.split('T')[0];
        }

        const overrides: any = {
          date: cleanDate,
          updated_at: new Date().toISOString()
        };

        if (tableName === 'daily_presence') {
          // Defensive status mapping to satisfy daily_presence_status_check
          const {
            is_available, unavailable_blocks, isAvailable, unavailableBlocks,
            ...dbFields
          } = rest;

          let safeStatus = dbFields.status;
          const allowedStatuses = ['home', 'base', 'unavailable', 'leave'];
          if (!safeStatus || !allowedStatuses.includes(safeStatus)) {
            // Map based on existence of V2 state or isAvailable flag
            const isAvail = rest.is_available ?? rest.isAvailable ?? (rest.v2_state === 'base');
            safeStatus = isAvail ? 'base' : 'home';
          }

          return {
            ...dbFields,
            date: cleanDate,
            status: safeStatus,
            source: 'manual',
            updated_at: new Date().toISOString()
          };
        }

        return {
          ...rest,
          ...overrides
        };
      }
      return r;
    });

    await callAdminRpc('upsert_daily_presence', {
      p_presence_records: sanitizedRecords
    });
  },

  async createAutoSnapshot(organizationId: string, userId: string, reason: string) {
    const timestamp = new Date().toLocaleString('he-IL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    const name = `🤖 גיבוי אוטומטי - ${timestamp}`;
    const description = `גיבוי מערכת אוטומטי לפני פעולה רגישה: ${reason}`;

    try {
      const snapshots = await callBackend(`/api/admin/snapshots?organizationId=${organizationId}`, 'GET');
      if (snapshots && snapshots.length >= 30) {
        const oldestId = snapshots[snapshots.length - 1].id;
        await callBackend(`/api/admin/snapshots`, 'DELETE', { snapshotId: oldestId });
      }
    } catch (err) {
      console.warn('Failed to rotate snapshots', err);
    }

    return this.createSnapshotV3(organizationId, name, description, userId);
  }
};
