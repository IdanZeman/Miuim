import { supabase } from '../lib/supabase';
import { AuthorizedLocation, DailyPresence } from '../types';
import { mapDailyPresenceFromDB, mapDailyPresenceToDB } from './mappers';
import { callBackend } from './backendService';

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
    // Use backend API for attendance reporting with location validation and audit logging
    const data = await callBackend('/api/attendance/report', 'POST', {
        p_person_id: personId,
        p_type: type,
        p_location: location,
        p_authorized_locations: authorizedLocations
    });

    if (!data.success) {
        return { success: false, message: data.message };
    }

    return {
        success: true,
        message: data.message,
        data: data.data ? mapDailyPresenceFromDB(data.data) : undefined
    };
};
