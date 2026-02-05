/**
 * AttendanceStrategy Usage Examples
 * 
 * This file demonstrates how to use the Strategy Pattern for attendance calculation.
 */

import { createAttendanceStrategy } from './attendanceStrategy';
import { Person, Organization, TeamRotation, Absence, HourlyBlockage } from '@/types';

// =============================================================================
// Example 1: Basic Usage with Factory
// =============================================================================

function calculateAttendance(
  organization: Organization,
  person: Person,
  date: Date,
  teamRotations: TeamRotation[],
  absences: Absence[],
  hourlyBlockages: HourlyBlockage[]
) {
  // Create the appropriate strategy based on organization's engine version
  const strategy = createAttendanceStrategy(
    organization.engine_version || 'v1_legacy' // Default to v1_legacy if not set
  );

  // Use the strategy to get effective availability
  const availability = strategy.getEffectiveAvailability(
    person,
    date,
    teamRotations,
    absences,
    hourlyBlockages
  );

  return availability;
}

// =============================================================================
// Example 2: Batch Processing for Multiple People
// =============================================================================

function calculateBatchAttendance(
  organization: Organization,
  people: Person[],
  dates: Date[],
  teamRotations: TeamRotation[],
  absences: Absence[],
  hourlyBlockages: HourlyBlockage[]
) {
  // Create strategy once for efficiency
  const strategy = createAttendanceStrategy(
    organization.engine_version || 'v1_legacy'
  );

  const results = new Map<string, Map<string, any>>();

  people.forEach(person => {
    const personResults = new Map<string, any>();
    
    dates.forEach(date => {
      const dateKey = date.toLocaleDateString('en-CA');
      
      // Filter relevant absences and blockages for this person
      const personAbsences = absences.filter(a => a.person_id === person.id);
      const personBlockages = hourlyBlockages.filter(b => b.person_id === person.id);
      
      const availability = strategy.getEffectiveAvailability(
        person,
        date,
        teamRotations,
        personAbsences,
        personBlockages
      );
      
      personResults.set(dateKey, availability);
    });
    
    results.set(person.id, personResults);
  });

  return results;
}

// =============================================================================
// Example 3: Migrating from V1 to V2
// =============================================================================

/**
 * When migrating an organization from V1 to V2:
 * 1. Update the organization.engine_version in the database
 * 2. Run the V2 Edge Function to pre-populate daily_presence records
 * 3. The strategy pattern will automatically use the new logic
 */

async function migrateOrganizationToV2(
  organizationId: string,
  supabase: any // Your Supabase client
) {
  // Step 1: Update engine_version
  const { error } = await supabase
    .from('organizations')
    .update({ engine_version: 'v2_write_based' })
    .eq('id', organizationId);

  if (error) {
    console.error('Failed to update engine version:', error);
    return;
  }

  // Step 2: Trigger V2 Edge Function to populate records
  // This would call your update-availability-v2 edge function
  // to write ahead for all people in the organization
  
  console.log(`Organization ${organizationId} migrated to V2`);
}

// =============================================================================
// Example 4: Using Strategy Directly (Advanced)
// =============================================================================

import { LegacyPropagationStrategy, WriteBasedStrategy } from './attendanceStrategy';

function compareStrategies(
  person: Person,
  date: Date,
  teamRotations: TeamRotation[],
  absences: Absence[],
  hourlyBlockages: HourlyBlockage[]
) {
  // Create both strategies
  const v1Strategy = new LegacyPropagationStrategy();
  const v2Strategy = new WriteBasedStrategy();

  // Calculate with both
  const v1Result = v1Strategy.getEffectiveAvailability(
    person,
    date,
    teamRotations,
    absences,
    hourlyBlockages
  );

  const v2Result = v2Strategy.getEffectiveAvailability(
    person,
    date,
    teamRotations,
    absences,
    hourlyBlockages
  );

  // Compare results (useful for testing/validation during migration)
  console.log('V1 Result:', v1Result);
  console.log('V2 Result:', v2Result);
  console.log('Match:', v1Result.status === v2Result.status);

  return { v1Result, v2Result };
}

// =============================================================================
// Example 5: Integration with Existing Code
// =============================================================================

/**
 * Drop-in replacement for existing getEffectiveAvailability calls
 */
function getEffectiveAvailabilityWithStrategy(
  organization: Organization,
  person: Person,
  date: Date,
  teamRotations: TeamRotation[],
  absences: Absence[] = [],
  hourlyBlockages: HourlyBlockage[] = []
) {
  const strategy = createAttendanceStrategy(
    organization.engine_version || 'v1_legacy'
  );

  return strategy.getEffectiveAvailability(
    person,
    date,
    teamRotations,
    absences,
    hourlyBlockages
  );
}

// Export for use in other modules
export {
  calculateAttendance,
  calculateBatchAttendance,
  migrateOrganizationToV2,
  compareStrategies,
  getEffectiveAvailabilityWithStrategy
};
