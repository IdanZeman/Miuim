import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Plus, Minus, Maximize, RefreshCcw } from 'lucide-react';

interface LocationMapProps {
    data: { name: string; value: number }[];
    total: number;
}

// Approximate percentage coordinates for major countries on a standard Equirectangular projection
const COUNTRY_COORDS: Record<string, { x: number, y: number }> = {
    'Israel': { x: 58.5, y: 36 },
    'United States': { x: 23, y: 35 },
    'UK': { x: 49, y: 24 },
    'France': { x: 49.5, y: 28 },
    'Germany': { x: 51, y: 26 },
    'Russia': { x: 70, y: 20 },
    'China': { x: 78, y: 35 },
    'India': { x: 72, y: 40 },
    'Brazil': { x: 32, y: 65 },
    'Australia': { x: 85, y: 75 },
    'Canada': { x: 20, y: 20 },
    'Japan': { x: 88, y: 35 },
    'South Korea': { x: 86, y: 35 },
    'Italy': { x: 51, y: 30 },
    'Spain': { x: 48, y: 31 },
    'Mexico': { x: 20, y: 40 },
    'Argentina': { x: 30, y: 75 },
    'South Africa': { x: 54, y: 75 },
    'Unknown': { x: -10, y: -10 }
};

export const LocationMap: React.FC<LocationMapProps> = ({ data }) => {
    // Zoom & Pan State
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [startPan, setStartPan] = useState({ x: 0, y: 0 });

    // Normalize data for dot sizing
    const maxVal = Math.max(...data.map(d => d.value), 1);

    // Filter and map valid points
    const plottedPoints = useMemo(() => {
        return data.map(item => {
            // Fuzzy match country names
            const key = Object.keys(COUNTRY_COORDS).find(k => item.name.includes(k) || k.includes(item.name));
            const coords = key ? COUNTRY_COORDS[key] : null;

            if (!coords) return null;

            return {
                ...item,
                x: coords.x,
                y: coords.y,
                size: Math.max(4, (item.value / maxVal) * 12),
                opacity: 0.5 + (item.value / maxVal) * 0.5
            };
        }).filter(Boolean);
    }, [data, maxVal]);

    // Handlers
    // Note: Wheel listener attached via ref in useEffect to support non-passive behavior
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const scaleAmount = -e.deltaY * 0.001;
            setZoom(prevZoom => {
                const newZoom = Math.min(Math.max(1, prevZoom + scaleAmount), 5);
                // If zooming out to 1, reset offset logic could be added here
                if (newZoom === 1) setOffset({ x: 0, y: 0 });
                return newZoom;
            });
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, []); // Empty dependency array means this effect runs once on mount

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) { // Only allow pan if zoomed in
            setIsDragging(true);
            setStartPan({ x: e.clientX - offset.x, y: e.clientY - offset.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        const newX = e.clientX - startPan.x;
        const newY = e.clientY - startPan.y;

        // Simple bounds check (very rough)
        const limitX = (zoom - 1) * 300;
        const limitY = (zoom - 1) * 200;

        setOffset({
            x: Math.max(Math.min(newX, limitX), -limitX),
            y: Math.max(Math.min(newY, limitY), -limitY)
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const zoomIn = () => setZoom(z => Math.min(z * 1.2, 5));
    const zoomOut = () => {
        setZoom(z => {
            const newZ = Math.max(z / 1.2, 1);
            if (newZ === 1) setOffset({ x: 0, y: 0 });
            return newZ;
        });
    };
    const resetZoom = () => {
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-[1.8] bg-slate-900 rounded-xl border border-slate-800 overflow-hidden group select-none shadow-inner"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Map Container with Transform */}
            <div
                className="w-full h-full transition-transform duration-100 ease-out origin-center will-change-transform"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
                }}
            >
                {/* SVG Background Map */}
                <svg
                    viewBox="0 0 100 50"
                    className="w-full h-full opacity-40 pointer-events-none"
                    preserveAspectRatio="none"
                >
                    <image
                        href="https://upload.wikimedia.org/wikipedia/commons/8/80/World_map_-_low_resolution.svg"
                        x="0"
                        y="0"
                        width="100"
                        height="50"
                        className="grayscale invert brightness-150 contrast-125" // Dark mode map style
                    />
                </svg>

                {/* Data Points */}
                <div className="absolute inset-0 pointer-events-none">
                    {plottedPoints.map((point, i) => point && (
                        <div
                            key={i}
                            className="absolute flex items-center justify-center group/point"
                            style={{
                                left: `${point.x}%`,
                                top: `${point.y}%`,
                                transform: `translate(-50%, -50%) scale(${1 / Math.sqrt(zoom)})` // Counter-scale markers slightly so they don't get huge
                            }}
                        >
                            {/* Ripple */}
                            <div className="absolute w-full h-full bg-emerald-500/30 rounded-full animate-ping"
                                style={{ width: `${point.size * 3}px`, height: `${point.size * 3}px` }}
                            />

                            {/* Dot */}
                            <div
                                className="rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)] border border-white/20 transition-transform relative z-10"
                                style={{
                                    width: `${point.size}px`,
                                    height: `${point.size}px`,
                                    opacity: point.opacity
                                }}
                            />

                            {/* Label (Only visible on hover or high zoom) */}
                            <div className={`absolute top-full mt-1 px-2 py-0.5 bg-black/80 text-white text-[8px] rounded border border-white/10 whitespace-nowrap z-20 transition-opacity ${zoom > 2.5 ? 'opacity-100' : 'opacity-0 group-hover/point:opacity-100'}`}>
                                {point.name} ({point.value})
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-30">
                <button onClick={zoomIn} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-lg border border-slate-700 transition-all active:scale-95" title="Zoom In">
                    <Plus size={16} />
                </button>
                <button onClick={zoomOut} className="p-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-lg border border-slate-700 transition-all active:scale-95" title="Zoom Out">
                    <Minus size={16} />
                </button>
                <button onClick={resetZoom} className="p-2 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white shadow-lg border border-slate-700 transition-all active:scale-95" title="Reset View">
                    <RefreshCcw size={14} />
                </button>
            </div>

            {/* Hint */}
            <div className="absolute top-2 left-2 text-[9px] text-slate-500 font-mono bg-slate-900/80 px-2 py-1 rounded border border-slate-800 pointer-events-none">
                Scroll to Zoom • Drag to Pan
            </div>
        </div>
    );
};
