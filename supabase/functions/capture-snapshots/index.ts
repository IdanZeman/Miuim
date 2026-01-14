import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Ported logic from attendanceUtils.ts
const getRotationStatusForDate = (date: Date, rotation: any) => {
    const start = new Date(rotation.start_date);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    const diffTime = d.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return null;

    const cycleLength = rotation.days_on_base + rotation.days_at_home;
    const dayInCycle = diffDays % cycleLength;

    if (dayInCycle === 0) return 'arrival';
    if (dayInCycle < rotation.days_on_base - 1) return 'full';
    if (dayInCycle === rotation.days_on_base - 1) return 'departure';
    return 'home';
};

const getEffectiveAvailability = (
    person: any,
    date: Date,
    teamRotations: any[],
    absences: any[] = [],
    hourlyBlockages: any[] = [],
    unifiedPresence: any[] = []
) => {
    const dateKey = date.toISOString().split('T')[0];

    // 1. Unified Presence (Manual Overrides)
    const entry = unifiedPresence.find(up => up.person_id === person.id && up.date === dateKey);
    if (entry) {
        return {
            status: entry.status,
            startHour: entry.start_time || '00:00',
            endHour: entry.end_time || '23:59'
        };
    }

    // 2. Absences
    const fullDayAbsence = absences.find(a =>
        a.person_id === person.id &&
        a.status === 'approved' &&
        dateKey >= a.start_date &&
        dateKey <= a.end_date &&
        (a.start_date !== dateKey || (a.start_time || '00:00') === '00:00') &&
        (a.end_date !== dateKey || (a.end_time || '23:59') === '23:59')
    );
    if (fullDayAbsence) return { status: 'home', startHour: '00:00', endHour: '23:59' };

    // 3. Rotation
    const rotation = teamRotations.find(r => r.team_id === person.team_id);
    if (rotation) {
        const rotationStatus = getRotationStatusForDate(date, rotation);
        if (rotationStatus) {
            return {
                status: rotationStatus === 'full' ? 'base' : rotationStatus,
                startHour: rotationStatus === 'arrival' ? rotation.arrival_time : '00:00',
                endHour: rotationStatus === 'departure' ? rotation.departure_time : '23:59'
            };
        }
    }

    // Default
    return { status: 'base', startHour: '00:00', endHour: '23:59' };
};

Deno.serve(async (req) => {
    const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    try {
        const now = new Date();
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const todayKey = now.toISOString().split('T')[0];

        console.log(`[Snapshot Automation] Running at ${todayKey} ${currentTime}`);

        // 1. Find battalions that match the report time
        // We check if the morning_report_time matches or if it's within the last 15 minutes
        const { data: battalions } = await supabase
            .from('battalions')
            .select('*')
            .not('morning_report_time', 'is', null);

        if (!battalions) return new Response('No battalions found', { status: 200 });

        const matchingBattalions = battalions.filter(b => {
            // Basic match (approximate check for 15-min intervals)
            return b.morning_report_time === currentTime;
        });

        if (matchingBattalions.length === 0) {
            return new Response(`No battalions matching time ${currentTime}`, { status: 200 });
        }

        for (const battalion of matchingBattalions) {
            console.log(`[Snapshot Automation] Capturing for battalion: ${battalion.name}`);

            // A. Get Companies
            const { data: companies } = await supabase.from('organizations').select('id').eq('battalion_id', battalion.id);
            if (!companies) continue;
            const orgIds = companies.map(c => c.id);

            // B. Fetch Data
            const [
                { data: people },
                { data: rotations },
                { data: unifiedPresence },
                { data: absences },
                { data: blockages }
            ] = await Promise.all([
                supabase.from('people').select('*').in('organization_id', orgIds).eq('is_active', true),
                supabase.from('team_rotations').select('*').in('organization_id', orgIds),
                supabase.from('unified_presence').select('*').in('organization_id', orgIds).eq('date', todayKey),
                supabase.from('absences').select('*').in('organization_id', orgIds).eq('status', 'approved').gte('end_date', todayKey).lte('start_date', todayKey),
                supabase.from('hourly_blockages').select('*').in('organization_id', orgIds).eq('date', todayKey)
            ]);

            // C. Calculate & Insert
            const snapshots = (people || []).map(person => {
                const effective = getEffectiveAvailability(person, now, rotations || [], absences || [], blockages || [], unifiedPresence || []);
                return {
                    organization_id: person.organization_id,
                    person_id: person.id,
                    date: todayKey,
                    status: effective.status,
                    start_time: effective.startHour,
                    end_time: effective.endHour,
                    captured_at: now.toISOString(),
                    snapshot_definition_time: currentTime
                };
            });

            if (snapshots.length > 0) {
                const { error } = await supabase.from('daily_attendance_snapshots').insert(snapshots);
                if (error) console.error(`Failed to insert snapshots for ${battalion.name}:`, error);
            }
        }

        return new Response('Success', { status: 200 });

    } catch (err) {
        console.error(err);
        return new Response(err.message, { status: 500 });
    }
})
