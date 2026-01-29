import { supabase } from '../lib/supabase';
import { AuthorizedLocation, DailyPresence } from '../types';
import { mapDailyPresenceFromDB, mapDailyPresenceToDB } from './mappers';

/**
 * Calculates the distance between two points in meters using the Haversine formula
 */
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
};

/**
 * Finds the closest authorized location within its radius
 */
export const findNearestLocation = (lat: number, lng: number, locations: AuthorizedLocation[]): { location: AuthorizedLocation, distance: number } | null => {
    let nearest: { location: AuthorizedLocation, distance: number } | null = null;

    for (const loc of locations) {
        const dist = calculateDistance(lat, lng, loc.lat, loc.lng);
        if (dist <= loc.radius) {
            if (!nearest || dist < nearest.distance) {
                nearest = { location: loc, distance: dist };
            }
        }
    }

    return nearest;
};

/**
 * Reports attendance (Arrival or Departure)
 */
export const reportAttendance = async (
    personId: string,
    organizationId: string,
    type: 'arrival' | 'departure',
    location: { lat: number, lng: number },
    authorizedLocations: AuthorizedLocation[]
): Promise<{ success: boolean; message: string; data?: DailyPresence }> => {
    const nearest = findNearestLocation(location.lat, location.lng, authorizedLocations);

    if (authorizedLocations.length > 0 && !nearest) {
        return { success: false, message: 'הנך מחוץ לטווח הדיווח המותר' };
    }

    const todayIso = new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    // 1. Fetch existing presence for today
    const { data: existing, error: fetchError } = await supabase
        .from('daily_presence')
        .select('*')
        .eq('person_id', personId)
        .eq('date', todayIso)
        .eq('organization_id', organizationId)
        .maybeSingle();

    if (fetchError) {
        console.error('Error fetching presence:', fetchError);
        return { success: false, message: 'שגיאה בשליפת נתוני נוכחות' };
    }

    const updates: any = {
        ...existing,
        organization_id: organizationId,
        person_id: personId,
        date: todayIso,
        status: 'base', // Reporting presence implies being on base
        source: 'manual'
    };

    if (type === 'arrival') {
        updates.actual_arrival_at = nowIso;
    } else {
        updates.actual_departure_at = nowIso;
    }

    if (nearest) {
        updates.reported_location_id = nearest.location.id;
        updates.reported_location_name = nearest.location.name;
    }

    const { data, error } = await supabase
        .from('daily_presence')
        .upsert(updates, { onConflict: 'date,person_id,organization_id' })
        .select()
        .single();

    if (error) {
        console.error('Error reporting attendance:', error);
        return { success: false, message: 'שגיאה בדיווח הנוכחות' };
    }

    return { 
        success: true, 
        message: type === 'arrival' ? 'נרשמה כניסה בהצלחה' : 'נרשמה יציאה בהצלחה',
        data: mapDailyPresenceFromDB(data)
    };
};
