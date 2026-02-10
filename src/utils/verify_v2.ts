import { SimplifiedV2Strategy } from './SimplifiedV2Strategy';

async function runTest() {
    const mockPerson: any = {
        id: 'test-person',
        dailyAvailability: {
            '2026-02-10': {
                v2_state: 'base',
                v2_sub_state: 'full_day',
                status: 'full_day'
            }
        }
    };

    const strategy = new SimplifiedV2Strategy();
    const result = strategy.getEffectiveAvailability(mockPerson, new Date('2026-02-10'), [], [], []);

    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.v2_state === 'base' && result.v2_sub_state === 'full_day' && result.isAvailable === true) {
        console.log('✅ SUCCESS: Base Full Day logic verified');
    } else {
        console.error('❌ FAILURE: Base Full Day logic mismatch');
        process.exit(1);
    }

    // Test Not Defined
    const emptyResult = strategy.getEffectiveAvailability(mockPerson, new Date('2026-02-11'), [], [], []);
    console.log('Empty Result:', JSON.stringify(emptyResult, null, 2));
    if (emptyResult.status === 'not_defined' && emptyResult.isAvailable === false) {
        console.log('✅ SUCCESS: Not Defined logic verified');
    } else {
        console.error('❌ FAILURE: Not Defined logic mismatch');
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
