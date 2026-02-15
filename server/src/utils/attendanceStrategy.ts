
import { AttendanceStrategy } from './attendanceStrategyTypes.js';
import { LegacyV1Strategy } from './LegacyV1Strategy.js';
import { WriteBasedStrategy } from './WriteBasedStrategy.js';
import { SimplifiedV2Strategy } from './SimplifiedV2Strategy.js';

export { type AttendanceStrategy } from './attendanceStrategyTypes.js';

/**
 * AttendanceStrategyFactory
 * 
 * Factory function that selects the appropriate strategy based on the organization's engine version.
 * 
 * @param engineVersion - The organization's engine_version ('v1_legacy', 'v2_write_based', or 'v2_simplified')
 * @returns The appropriate AttendanceStrategy implementation
 */
export function createAttendanceStrategy(engineVersion: 'v1_legacy' | 'v2_write_based' | 'v2_simplified'): AttendanceStrategy {
    switch (engineVersion) {
        case 'v2_simplified':
            return new SimplifiedV2Strategy();
        case 'v2_write_based':
            return new WriteBasedStrategy();
        case 'v1_legacy':
        default:
            return new LegacyV1Strategy();
    }
}
