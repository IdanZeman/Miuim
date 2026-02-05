# Attendance Strategy Pattern - Implementation Guide

## Overview

This implementation introduces the **Strategy Pattern** for attendance calculation, allowing the Miuim system to support both:
- **V1 (Legacy)**: Read-time propagation logic
- **V2 (Write-Based)**: Deterministic write-based logic

The strategy is selected automatically based on the organization's `engine_version` field.

---

## Architecture

### The Strategy Pattern

```
                    ┌──────────────────────────┐
                    │  AttendanceStrategy      │
                    │  (Interface)             │
                    └──────────────────────────┘
                               △
                               │
                ┌──────────────┴──────────────┐
                │                             │
┌───────────────────────────┐   ┌───────────────────────────┐
│ LegacyPropagationStrategy │   │   WriteBasedStrategy      │
│      (V1 Logic)           │   │      (V2 Logic)           │
└───────────────────────────┘   └───────────────────────────┘
```

### Factory Function

```typescript
createAttendanceStrategy(engineVersion: 'v1_legacy' | 'v2_write_based'): AttendanceStrategy
```

The factory automatically selects the correct strategy implementation.

---

## Files Created

### 1. `attendanceStrategy.ts` (Main Implementation)

**Exports:**
- `AttendanceStrategy` - Interface defining the contract
- `LegacyPropagationStrategy` - V1 implementation
- `WriteBasedStrategy` - V2 implementation
- `createAttendanceStrategy` - Factory function

### 2. `attendanceStrategy.example.ts` (Usage Examples)

Contains 5 practical examples:
1. Basic usage with factory
2. Batch processing for multiple people
3. Migration from V1 to V2
4. Direct strategy usage (advanced)
5. Integration with existing code

### 3. Updated `types.ts`

Added `engine_version` field to `Organization` interface:
```typescript
engine_version?: 'v1_legacy' | 'v2_write_based';
```

---

## Key Differences: V1 vs V2

| Aspect | V1 (Legacy) | V2 (Write-Based) |
|--------|-------------|------------------|
| **Calculation** | On-demand (read-time) | Pre-calculated (write-time) |
| **Propagation** | Chronological from past entries | No propagation needed |
| **Performance** | Slower (recursive logic) | Faster (direct DB read) |
| **Complexity** | High (many edge cases) | Low (simple fetch) |
| **Data Source** | In-memory calculation | Database records |
| **Lookahead** | N/A | Up to 45 days |

---

## The "3 Layers of Truth" (V2)

V2 enforces this priority order:

1. **Layer 1 (Reality)**: Manual Overrides & Approved Absences
2. **Layer 2 (The Plan)**: Rotations (e.g., 11/3)
3. **Layer 3 (Fallback)**: System Default (Base)

---

## Usage

### Basic Usage

```typescript
import { createAttendanceStrategy } from '@/utils/attendanceStrategy';

// Get organization data
const organization = await fetchOrganization(orgId);

// Create strategy
const strategy = createAttendanceStrategy(
  organization.engine_version || 'v1_legacy'
);

// Calculate availability
const availability = strategy.getEffectiveAvailability(
  person,
  date,
  teamRotations,
  absences,
  hourlyBlockages
);
```

### Integration with Existing Code

Replace existing calls to `getEffectiveAvailability`:

**Before:**
```typescript
import { getEffectiveAvailability } from '@/utils/attendanceUtils';

const avail = getEffectiveAvailability(person, date, rotations, absences, blockages);
```

**After:**
```typescript
import { createAttendanceStrategy } from '@/utils/attendanceStrategy';

const strategy = createAttendanceStrategy(org.engine_version || 'v1_legacy');
const avail = strategy.getEffectiveAvailability(person, date, rotations, absences, blockages);
```

---

## Migration Path: V1 → V2

### Step 1: Database Update

```sql
-- Update organization to V2
UPDATE organizations 
SET engine_version = 'v2_write_based' 
WHERE id = 'your-org-id';
```

### Step 2: Populate Records

Call the `update-availability-v2` Edge Function to pre-populate daily_presence records:

```typescript
// This writes ahead for up to 45 days
await supabase.functions.invoke('update-availability-v2', {
  body: {
    person_id: person.id,
    start_date: '2026-02-06',
    status: 'home',
    organization_id: org.id
  }
});
```

### Step 3: Verify

The strategy pattern will automatically use V2 logic once `engine_version` is updated.

---

## Testing Strategy

### Unit Tests

Test each strategy independently:

```typescript
describe('AttendanceStrategy', () => {
  describe('LegacyPropagationStrategy', () => {
    it('should propagate manual status chronologically', () => {
      // Test V1 logic
    });
  });

  describe('WriteBasedStrategy', () => {
    it('should fetch records from database', () => {
      // Test V2 logic
    });
  });

  describe('Factory', () => {
    it('should return correct strategy based on engine_version', () => {
      // Test factory
    });
  });
});
```

### Integration Tests

Compare V1 and V2 results during migration:

```typescript
const v1Strategy = new LegacyPropagationStrategy();
const v2Strategy = new WriteBasedStrategy();

const v1Result = v1Strategy.getEffectiveAvailability(...);
const v2Result = v2Strategy.getEffectiveAvailability(...);

expect(v1Result.status).toBe(v2Result.status);
```

---

## Performance Considerations

### V1 (Legacy)
- **Pros**: Works without pre-calculation
- **Cons**: Slow for large date ranges (O(n) propagation)

### V2 (Write-Based)
- **Pros**: Fast O(1) lookups
- **Cons**: Requires write-ahead population

**Recommendation**: Migrate to V2 for organizations with >50 people or long-term planning needs.

---

## Anti-Patterns to Avoid

### ❌ Don't: Hardcode Strategy Selection

```typescript
// BAD
const strategy = new LegacyPropagationStrategy();
```

### ✅ Do: Use Factory Function

```typescript
// GOOD
const strategy = createAttendanceStrategy(org.engine_version || 'v1_legacy');
```

### ❌ Don't: Mix V1 and V2 Logic

```typescript
// BAD
if (org.engine_version === 'v2_write_based') {
  // Custom V2 logic
} else {
  // Custom V1 logic
}
```

### ✅ Do: Use Strategy Pattern

```typescript
// GOOD
const strategy = createAttendanceStrategy(org.engine_version || 'v1_legacy');
const result = strategy.getEffectiveAvailability(...);
```

---

## Stopping Rules (From scheduler-v2.agent.md)

When implementing V2 logic:
- **NEVER** use recursive functions to calculate daily status in V2
- **NEVER** overwrite existing "Manual" records without explicit user intent (unless merging identical statuses)
- **NEVER** forget to check the `organization.engine_version` flag

---

## Future Enhancements

1. **Caching Layer**: Add Redis cache for V1 calculations
2. **Hybrid Mode**: Allow per-person strategy selection
3. **Analytics**: Track which strategy is used most
4. **Auto-Migration**: Automatically suggest V2 migration when performance degrades

---

## Troubleshooting

### Issue: V2 returns empty availability

**Cause**: Records not pre-populated in database

**Solution**: Run Edge Function to populate records:
```typescript
await supabase.functions.invoke('update-availability-v2', { ... });
```

### Issue: Inconsistent results between V1 and V2

**Cause**: Data desync or migration incomplete

**Solution**: 
1. Verify `engine_version` is correct
2. Re-populate V2 records
3. Compare results using `compareStrategies` function

---

## References

- [Scheduler V2 Agent](../.github/agents/scheduler-v2.agent.md)
- [Attendance Logic Documentation](../docs/ATTENDANCE_LOGIC.md)
- [V2 Migration SQL](../migrations/20260205_v2_scheduler_engine.sql)

---

## Contact

For questions or issues with the Strategy Pattern implementation, refer to:
- **Agent**: `@scheduler-v2`
- **Documentation**: This file
- **Examples**: `attendanceStrategy.example.ts`
