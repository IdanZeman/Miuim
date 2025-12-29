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
    // 1. Prepare data with coordinates
    const plottedPoints = useMemo(() => {
        const maxVal = Math.max(...data.map(d => d.value), 1);

        return data.map(item => {
            let lat = item.lat;
            let lon = item.lon;

            // If no direct coords, try lookup
            if (!lat || !lon) {
                // Try Israel Cities First (Exact match or includes)
                // Normalize string for better matching (optional)
                const searchName = item.name.trim();

                let found = ISRAEL_CITIES[searchName];

                // If not found, try fuzzy search in Israel Cities
                if (!found) {
                    const key = Object.keys(ISRAEL_CITIES).find(k => k.includes(searchName) || searchName.includes(k));
                    if (key) found = ISRAEL_CITIES[key];
                }

                // If not found, try World Countries
                if (!found) {
                    const key = Object.keys(WORLD_COUNTRIES).find(k => k.includes(searchName) || searchName.includes(k));
                    if (key) found = WORLD_COUNTRIES[key];
                }

                if (found) {
                    lat = found.lat;
                    lon = found.lon;
                }
            }

            if (lat && lon) {
                return {
                    ...item,
                    lat,
                    lon,
                    // Dynamic size based on value relative to max, with min/max caps
                    radius: Math.max(5, (item.value / maxVal) * 20),
                    color: '#10b981', // emerald-500
                };
            }
            return null;
        }).filter(Boolean) as (typeof data[0] & { lat: number, lon: number, radius: number, color: string })[];
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

                {plottedPoints.map((point, i) => (
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
