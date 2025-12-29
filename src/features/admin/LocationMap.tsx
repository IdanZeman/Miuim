import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ISRAEL_CITIES, WORLD_COUNTRIES } from '../../utils/IsraelCityCoordinates';

interface LocationMapProps {
    data: { name: string; value: number; lat?: number; lon?: number }[];
    total: number;
}

// Component to handle map bounds updates and invalidation
const MapUpdater: React.FC<{ center: [number, number], zoom: number, triggerResize?: boolean }> = ({ center, zoom, triggerResize }) => {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
        if (triggerResize) {
            map.invalidateSize();
        }
    }, [center, zoom, map, triggerResize]);

    // Invalidate size on mount just in case
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 100);
        return () => clearTimeout(timer);
    }, [map]);

    return null;
};

// "Locate Me" Button Control
const LocateControl = () => {
    const map = useMap();

    const handleLocate = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        map.locate().on("locationfound", function (e: any) {
            map.flyTo(e.latlng, map.getZoom());
        });
    };

    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control leaflet-bar">
                <a
                    href="#"
                    role="button"
                    title="Show My Location"
                    className="leaflet-control-custom-button flex items-center justify-center bg-white hover:bg-slate-100 text-slate-800 w-[30px] h-[30px]"
                    onClick={handleLocate}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <line x1="1" y1="12" x2="23" y2="12"></line>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </a>
            </div>
        </div>
    );
};

export const LocationMap: React.FC<LocationMapProps> = ({ data }) => {
    // State for dynamic points (merged static + fetched)
    const [points, setPoints] = React.useState<(typeof data[0] & { lat: number, lon: number, radius: number, color: string })[]>([]);

    useEffect(() => {
        const resolveCoordinates = async () => {
            const maxVal = Math.max(...data.map(d => d.value), 1);
            const resolvedPoints = await Promise.all(data.map(async (item) => {
                let lat = item.lat;
                let lon = item.lon;
                let usedCache = false;

                // 1. Direct or Static Lookup
                if (!lat || !lon) {
                    const searchName = item.name.trim();

                    // Check ISRAEL_CITIES
                    let found = ISRAEL_CITIES[searchName] ||
                        Object.values(ISRAEL_CITIES).find((_, i) => Object.keys(ISRAEL_CITIES)[i] === searchName); // Values check is wrong, keys check

                    if (!found) {
                        const key = Object.keys(ISRAEL_CITIES).find(k => k.toLowerCase() === searchName.toLowerCase() || k.includes(searchName) || searchName.includes(k));
                        if (key) found = ISRAEL_CITIES[key];
                    }

                    // Check WORLD_COUNTRIES
                    if (!found) {
                        const key = Object.keys(WORLD_COUNTRIES).find(k => k.toLowerCase() === searchName.toLowerCase() || k.includes(searchName) || searchName.includes(k));
                        if (key) found = WORLD_COUNTRIES[key];
                    }

                    if (found) {
                        lat = found.lat;
                        lon = found.lon;
                    }

                    // 2. Check Local Cache
                    if (!lat || !lon) {
                        try {
                            const cache = JSON.parse(localStorage.getItem('city_coords_cache') || '{}');
                            if (cache[searchName]) {
                                lat = cache[searchName].lat;
                                lon = cache[searchName].lon;
                                usedCache = true;
                            }
                        } catch (e) { }
                    }

                    // 3. Fetch from Nominatim (OpenStreetMap) if still missing
                    if ((!lat || !lon)) {
                        try {
                            console.log(`Fetching coordinates for: ${searchName}`);
                            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchName + ', Israel')}&format=json&limit=1`, {
                                headers: { 'Accept-Language': 'en' }
                            });
                            const json = await res.json();
                            if (json && json.length > 0) {
                                lat = parseFloat(json[0].lat);
                                lon = parseFloat(json[0].lon);

                                // Update Cache
                                const cache = JSON.parse(localStorage.getItem('city_coords_cache') || '{}');
                                cache[searchName] = { lat, lon };
                                localStorage.setItem('city_coords_cache', JSON.stringify(cache));
                            }
                        } catch (err) {
                            console.error(`Failed to geocode ${searchName}`, err);
                        }
                    }
                }

                if (lat && lon) {
                    return {
                        ...item,
                        lat,
                        lon,
                        radius: Math.max(5, (item.value / maxVal) * 20),
                        color: '#10b981',
                    };
                }
                return null;
            }));

            setPoints(resolvedPoints.filter(Boolean) as any);
        };

        resolveCoordinates();
    }, [data]);

    // Default Center: Israel
    const defaultCenter: [number, number] = [32.0853, 34.7818]; // Tel Aviv
    const defaultZoom = 7;

    return (
        <div className="relative w-full h-[350px] bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-inner z-0">
            <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                scrollWheelZoom={true}
                className="w-full h-full z-0"
                style={{ background: '#0f172a', height: '100%', width: '100%' }} // Match slate-900
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    className="map-tiles-dark" // We can try to filter this with CSS for dark mode
                />

                {/* Custom CSS to Darken the Map Tiles */}
                <style>{`
                    .leaflet-tile {
                        filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%);
                    }
                    .leaflet-container {
                        background: #0f172a !important;
                        height: 100%;
                        width: 100%;
                    }
                    /* Ensure controls are visible on dark map */
                     .leaflet-control-custom-button {
                        background-color: #1e293b;
                        color: #e2e8f0;
                        border: 1px solid #334155;
                        cursor: pointer;
                        border-radius: 4px;
                        transition: all 0.2s;
                    }
                    .leaflet-control-custom-button:hover {
                         background-color: #334155;
                         color: #ffffff;
                    }
                `}</style>

                {points.map((point, i) => (
                    <CircleMarker
                        key={`${point.name}-${i}`}
                        center={[point.lat, point.lon]}
                        radius={point.radius}
                        pathOptions={{
                            color: point.color,
                            fillColor: point.color,
                            fillOpacity: 0.6,
                            weight: 1
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -5]} opacity={1}>
                            <div className="text-center">
                                <span className="font-bold block">{point.name}</span>
                                <span className="text-xs">{point.value} visits</span>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                ))}

                <MapUpdater center={defaultCenter} zoom={defaultZoom} />
                <LocateControl />
            </MapContainer>

            {/* Overlay Hint */}
            <div className="absolute top-2 left-12 z-[400] text-[9px] text-slate-500 font-mono bg-slate-900/80 px-2 py-1 rounded border border-slate-800 pointer-events-none">
                Live Map Enabled
            </div>
        </div>
    );
};
