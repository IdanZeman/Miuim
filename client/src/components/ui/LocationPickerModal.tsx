import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Modal } from './Modal';
import { Button } from './Button';
import { MapPin, NavigationArrow, CheckCircle, X, MagnifyingGlass, Globe, RoadHorizon } from '@phosphor-icons/react';
import L from 'leaflet';

// Fix Leaflet marker icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (lat: number, lng: number) => void;
    initialLat?: number;
    initialLng?: number;
    radius?: number;
    title?: string;
}

const MapEvents = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
    useMapEvents({
        click(e) {
            onMapClick(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
};

const MapController = ({ center }: { center: [number, number] }) => {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, map.getZoom());
    }, [center, map]);
    return null;
};

const MapResizer = () => {
    const map = useMap();
    useEffect(() => {
        const timer = setTimeout(() => {
            map.invalidateSize();
        }, 300);
        return () => clearTimeout(timer);
    }, [map]);
    return null;
};

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
    isOpen,
    onClose,
    onSelect,
    initialLat,
    initialLng,
    radius = 500,
    title = 'בחר מיקום על המפה'
}) => {
    const [tempPos, setTempPos] = useState<[number, number] | null>(
        (initialLat !== undefined && initialLng !== undefined) ? [initialLat, initialLng] : [32.0853, 34.7818]
    );
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [mapType, setMapType] = useState<'m' | 'y'>('m'); // m = roadmap, y = hybrid

    const handleMapClick = useCallback((lat: number, lng: number) => {
        setTempPos([lat, lng]);
    }, []);

    const handleConfirm = () => {
        if (tempPos) {
            onSelect(tempPos[0], tempPos[1]);
            onClose();
        }
    };

    const handleLocateMe = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((pos) => {
                setTempPos([pos.coords.latitude, pos.coords.longitude]);
            });
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setIsSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery + ', Israel')}&format=json&limit=1`);
            const json = await res.json();
            if (json && json.length > 0) {
                setTempPos([parseFloat(json[0].lat), parseFloat(json[0].lon)]);
            }
        } catch (err) {
            console.error('Search failed', err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="xl"
        >
            <div className="flex flex-col h-[70vh]">
                {/* Search Bar */}
                <div className="p-4 bg-slate-50 border-b border-slate-100 flex gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="חפש מיקום (למשל: תל אביב, הקריה...)"
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button
                        variant="secondary"
                        onClick={handleSearch}
                        isLoading={isSearching}
                        className="rounded-xl px-6 h-10 font-bold"
                    >
                        חפש
                    </Button>
                </div>

                {/* Map Area */}
                <div className="flex-1 relative bg-slate-100 overflow-hidden">
                    <MapContainer
                        center={tempPos || [32.0853, 34.7818]}
                        zoom={13}
                        className="w-full h-full z-0"
                        attributionControl={false}
                    >
                        <TileLayer
                            url={`https://{s}.google.com/vt/lyrs=${mapType}&x={x}&y={y}&z={z}`}
                            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
                        />
                        <div className="leaflet-bottom leaflet-left !z-[400] pointer-events-none">
                            <div className="bg-white/70 backdrop-blur-sm px-1.5 py-0.5 text-[8px] text-slate-400 font-bold border-tr border-slate-200">
                                &copy; Google Maps
                            </div>
                        </div>
                        <MapResizer />
                        <MapEvents onMapClick={handleMapClick} />
                        {tempPos && (
                            <>
                                <Marker position={tempPos} />
                                <Circle
                                    center={tempPos}
                                    radius={radius}
                                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1 }}
                                />
                                <MapController center={tempPos} />
                            </>
                        )}
                    </MapContainer>

                    {/* Floating Controls */}
                    <div className="absolute bottom-6 right-6 z-[400] flex flex-col gap-3">
                        <button
                            onClick={() => setMapType(mapType === 'm' ? 'y' : 'm')}
                            className="w-12 h-12 bg-white text-slate-700 rounded-full shadow-2xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all active:scale-95"
                            title={mapType === 'm' ? 'עבור לתצוגת לוויין' : 'עבור לתצוגת מפה'}
                        >
                            {mapType === 'm' ? <Globe size={24} weight="bold" /> : <RoadHorizon size={24} weight="bold" />}
                        </button>
                        <button
                            onClick={handleLocateMe}
                            className="w-12 h-12 bg-white text-slate-700 rounded-full shadow-2xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-all active:scale-95"
                            title="השתמש במיקום הנוכחי שלי"
                        >
                            <NavigationArrow size={24} weight="fill" />
                        </button>
                    </div>

                    {/* Instructions Overlay */}
                    <div className="absolute top-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md text-white text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-full shadow-lg pointer-events-none tracking-tight">
                        לחץ על המפה לבחירת מיקום המחסום
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center">
                    <div className="hidden sm:block">
                        {tempPos && (
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {tempPos[0].toFixed(5)}, {tempPos[1].toFixed(5)}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1 sm:flex-none rounded-xl font-bold h-12 px-8"
                            icon={X}
                        >
                            ביטול
                        </Button>
                        <Button
                            variant="primary"
                            onClick={handleConfirm}
                            className="flex-1 sm:flex-none rounded-xl font-black h-12 px-8 shadow-lg shadow-blue-600/20"
                            icon={CheckCircle}
                        >
                            אישור מיקום
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
