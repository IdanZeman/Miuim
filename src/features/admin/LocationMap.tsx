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

                // 1. Direct or Static Lookup with improved matching
                if (!lat || !lon) {
                    const searchName = item.name.trim();

                    // Normalize function for better matching
                    const normalize = (str: string) => str.toLowerCase()
                        .replace(/['\-\s]/g, '')  // Remove apostrophes, hyphens, spaces
                        .replace(/^q/i, 'k')       // Q -> K (Qatzrin -> Katzrin)
                        .replace(/^c/i, 'k');      // C -> K (Caesarea)

                    const normalizedSearch = normalize(searchName);

                    // Try exact match first
                    let found = ISRAEL_CITIES[searchName];

                    // Try case-insensitive exact match
                    if (!found) {
                        const exactKey = Object.keys(ISRAEL_CITIES).find(k => k.toLowerCase() === searchName.toLowerCase());
                        if (exactKey) found = ISRAEL_CITIES[exactKey];
                    }

                    // Try normalized fuzzy match
                    if (!found) {
                        const fuzzyKey = Object.keys(ISRAEL_CITIES).find(k => {
                            const normalizedKey = normalize(k);
                            return normalizedKey === normalizedSearch ||
                                normalizedKey.includes(normalizedSearch) ||
                                normalizedSearch.includes(normalizedKey);
                        });
                        if (fuzzyKey) found = ISRAEL_CITIES[fuzzyKey];
                    }

                    // Check WORLD_COUNTRIES
                    if (!found) {
                        const key = Object.keys(WORLD_COUNTRIES).find(k =>
                            k.toLowerCase() === searchName.toLowerCase() ||
                            k.includes(searchName) ||
                            searchName.includes(k)
                        );
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
        <div className="relative w-full h-[350px] bg-slate-50 rounded-2xl border border-slate-200/60 overflow-hidden shadow-sm z-0">
            <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                scrollWheelZoom={true}
                className="w-full h-full z-0"
                style={{ background: '#f8fafc', height: '100%', width: '100%' }} // Match slate-50
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <style>{`
                    .leaflet-container {
                        font-family: inherit;
                    }
                    /* Custom controls style */
                     .leaflet-control-custom-button {
                        background-color: #ffffff;
                        color: #475569;
                        border: 1px solid #e2e8f0;
                        cursor: pointer;
                        border-radius: 8px;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                    }
                    .leaflet-control-custom-button:hover {
                         background-color: #f8fafc;
                         color: #0f172a;
                         transform: translateY(-1px);
                         box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }
                `}</style>

                {points.map((point, i) => (
                    <CircleMarker
                        key={`${point.name}-${i}`}
                        center={[point.lat, point.lon]}
                        radius={point.radius}
                        pathOptions={{
                            color: '#059669', // Emerald-600
                            fillColor: '#10b981', // Emerald-500
                            fillOpacity: 0.6,
                            weight: 2
                        }}
                    >
                        <Tooltip direction="top" offset={[0, -5]} opacity={1} className="custom-map-tooltip">
                            <div className="text-center font-sans">
                                <span className="font-bold block text-slate-800">{point.name}</span>
                                <span className="text-xs text-slate-500 font-medium">{point.value} visits</span>
                            </div>
                        </Tooltip>
                    </CircleMarker>
                ))}

                <MapUpdater center={defaultCenter} zoom={defaultZoom} />
                <LocateControl />
            </MapContainer>

            {/* Overlay Hint */}
            <div className="absolute top-3 left-14 z-[400] text-[10px] text-slate-500 font-bold bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-200 shadow-sm pointer-events-none uppercase tracking-wider">
                Live Map
            </div>
        </div>
    );
};
