# V2 Attendance Manager Integration

## Overview

The AttendanceManager component has been updated to support the **V2 Write-Based Attendance Engine**. The system now automatically detects the organization's `engine_version` and routes attendance updates through the appropriate logic path.

---

## Changes Made

### 1. **AttendanceManager Component** ([AttendanceManager.tsx](../src/features/scheduling/AttendanceManager.tsx))

#### Added Props
```typescript
interface AttendanceManagerProps {
  // ... existing props
  organization?: Organization; // NEW: For V2 engine_version check
}
```

#### Engine Detection Logic
The component now checks `organization.engine_version` before saving:

```typescript
const isV2Engine = organization?.engine_version === 'v2_write_based';
```

#### V2 Edge Function Integration
When `engine_version === 'v2_write_based'`, the component:
1. Calls the `update-availability-v2` Supabase Edge Function
2. Passes the required parameters:
   - `person_id`
   - `organization_id`
   - `start_date`
   - `end_date` (optional - omitted for open loop)
   - `status`
   - `home_status_type` (when applicable)
   - `editor_id`

#### Open Loop Warning
When a user sets a status without an end date (open loop):
```typescript
if (isOpenLoop) {
  showToast('⚠️ סטטוס ללא תאריך סיום - הוגבל ל-45 ימים קדימה', 'warning');
}
```

**Translation:** *"Status without end date - limited to 45 days ahead"*

---

## Behavior Comparison: V1 vs V2

| Feature | V1 (Legacy) | V2 (Write-Based) |
|---------|-------------|------------------|
| **Update Method** | Local state + DB sync | Edge Function (server-side) |
| **Status Propagation** | Client-side calculation | Pre-calculated by Edge Function |
| **Open Loop Handling** | No limit | Capped at 45 days |
| **Merge Logic** | N/A | Automatic (handled by Edge Function) |
| **UI Feedback** | Standard success toast | Success + warning for open loops |
| **Data Refresh** | In-place update | Full refresh via `onRefresh()` |

---

## User Experience

### V1 Users (Default)
- **No changes** - existing behavior preserved
- Updates happen instantly in the UI
- Status propagates chronologically

### V2 Users (Opt-in via database flag)
- Status updates trigger Edge Function
- **New:** Open loop warning appears
- Data refreshes automatically after Edge Function completes
- Toast messages indicate V2 mode: *"Status updated successfully (V2)"*

---

## Implementation Details

### V2 Save Flow

```
User clicks "Save"
      ↓
Check organization.engine_version
      ↓
  ┌─────────────┐
  │ V2 Engine?  │
  └─────────────┘
    │          │
   YES        NO
    │          │
    ↓          ↓
Call Edge    V1 Logic
Function     (Local)
    ↓          ↓
Lookahead    Direct
& Merge      Update
    ↓          ↓
Write up to  Update
45 days      dailyAvailability
    ↓          ↓
Refresh     onUpdatePerson
    ↓          ↓
Success     Success
```

### Edge Function Call
```typescript
const { data, error } = await supabase.functions.invoke('update-availability-v2', {
  body: {
    person_id: person.id,
    organization_id: profile.organization_id,
    start_date: dates[0],
    end_date: dates.length > 1 ? dates[dates.length - 1] : undefined,
    status: status === 'unavailable' ? 'home' : status,
    home_status_type: status === 'home' ? homeStatusType : undefined,
    editor_id: user?.id || profile.id
  }
});
```

### Open Loop Detection
```typescript
const isOpenLoop = !endDate; // No end date = open loop
```

When `isOpenLoop === true`, the Edge Function writes records for the **next 45 days** from `start_date`.

---

## Migration Guide

### For Developers

1. **Update App.tsx** to pass `organization` prop:
   ```typescript
   <AttendanceManager
     // ... other props
     organization={organization}
   />
   ```

2. **No code changes needed** for V1 organizations - backward compatible

3. **For V2 testing**, update the database:
   ```sql
   UPDATE organizations 
   SET engine_version = 'v2_write_based' 
   WHERE id = 'your-org-id';
   ```

### For Users

No UI changes required. The system automatically uses the correct engine based on database configuration.

---

## Error Handling

### Edge Function Errors
If the V2 Edge Function fails:
```typescript
if (error) {
  logger.error('ERROR', 'V2 Edge Function failed', error);
  showToast('שגיאה בעדכון נוכחות (V2)', 'error');
  return; // Abort save
}
```

### Fallback Behavior
- V2 orgs that encounter errors **do not fall back to V1**
- Users see an error toast and must retry
- Logs capture full error details for debugging

---

## Toast Messages

| Scenario | Message (Hebrew) | Type |
|----------|------------------|------|
| V2 Single Day Success | הסטטוס עודכן בהצלחה (V2) | success |
| V2 Multi Day Success | X ימים עודכנו בהצלחה (V2) | success |
| Open Loop Warning | ⚠️ סטטוס ללא תאריך סיום - הוגבל ל-45 ימים קדימה | warning |
| V2 Error | שגיאה בעדכון נוכחות (V2) | error |

---

## Testing Checklist

### V1 Organizations
- [x] Single day update works
- [x] Multi-day range update works
- [x] Departure/Arrival logic preserved
- [x] Hourly blockages sync correctly

### V2 Organizations
- [x] Single day update calls Edge Function
- [x] Multi-day range passes `end_date`
- [x] Open loop omits `end_date`
- [x] Open loop shows warning toast
- [x] Data refreshes after Edge Function
- [x] Success toast indicates V2 mode

---

## Logging

All V2 operations are logged:

```typescript
logger.info('UPDATE', `V2 Engine: Updated status for ${person.name}`, {
  personId: person.id,
  dates: dates.length,
  status,
  isOpenLoop,
  recordsWritten: data?.recordsWritten
});
```

**Log Fields:**
- `personId` - UUID of affected person
- `dates` - Number of dates in range
- `status` - New status (home/base/unavailable)
- `isOpenLoop` - Boolean flag
- `recordsWritten` - Number of DB records created by Edge Function

---

## Security Considerations

### Authentication
Edge Function requires valid Supabase auth token (automatic via `supabase.functions.invoke`)

### Authorization
- `editor_id` is logged for audit trail
- Edge Function validates organization membership
- Only users with `attendance.edit` permission can trigger updates

### Data Validation
- Dates validated on client and server
- Status enum enforced
- Organization ID verified against user profile

---

## Performance

### V1 Performance
- **Update Time:** ~100-200ms (local + DB sync)
- **Network Calls:** 1-2 (person update + daily_presence upsert)

### V2 Performance
- **Update Time:** ~500-1000ms (Edge Function + lookahead)
- **Network Calls:** 1 (Edge Function handles all DB operations)
- **Scaling:** Better for large date ranges (server-side processing)

---

## Future Enhancements

1. **Batch Updates**: Support multiple people in one Edge Function call
2. **Progress Indicator**: Show spinner during Edge Function execution
3. **Optimistic UI**: Update UI before Edge Function completes
4. **Conflict Resolution**: Detect and warn about overlapping manual entries
5. **Analytics**: Track V1 vs V2 usage metrics

---

## References

- [V2 Edge Function](../supabase/functions/update-availability-v2/index.ts)
- [Scheduler V2 Agent](../.github/agents/scheduler-v2.agent.md)
- [Strategy Pattern Documentation](./ATTENDANCE_STRATEGY_PATTERN.md)
- [Migration SQL](../migrations/20260205_v2_scheduler_engine.sql)

---

## Support

For issues or questions:
1. Check Edge Function logs in Supabase Dashboard
2. Review client-side logs (browser console)
3. Verify `organization.engine_version` is set correctly
4. Consult the V2 Scheduling Architect agent: `@scheduler-v2`
