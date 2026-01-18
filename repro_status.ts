
const { getEffectiveAvailability } = require('./src/utils/attendanceUtils');

// Mock Person
const person = {
    id: '1',
    name: 'Test Person',
    dailyAvailability: {
        '2026-01-01': {
            isAvailable: false,
            status: 'home',
            homeStatusType: 'leave_shamp',
            source: 'manual'
        }
    }
};

const date1 = new Date('2026-01-01');
const date2 = new Date('2026-01-02');

// Mock other data
const teams = [];
const teamRotations = [];
const absences = [];

console.log('--- Checking Day 1 (Manual Home) ---');
const result1 = getEffectiveAvailability(person, date1, teamRotations, absences, []);
console.log('Day 1 Status:', result1.status);
console.log('Day 1 IsAvailable:', result1.isAvailable);

console.log('--- Checking Day 2 (No Entry - Should Default to Base currently) ---');
const result2 = getEffectiveAvailability(person, date2, teamRotations, absences, []);
console.log('Day 2 Status:', result2.status);
console.log('Day 2 IsAvailable:', result2.isAvailable);
