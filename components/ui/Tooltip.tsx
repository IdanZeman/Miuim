import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    children: React.ReactNode;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + 8, // 8px Offset below the element
                left: rect.left + rect.width / 2
            });
            setIsVisible(true);
        }
    };

    return (
        <div
            ref={triggerRef}
            className="inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && createPortal(
                <div
                    className="fixed z-[10000] px-3 py-2 bg-slate-800 text-white text-xs rounded-lg shadow-xl max-w-xs text-center pointer-events-none transition-opacity duration-200 animate-in fade-in"
                    style={{
                        top: coords.top,
                        left: coords.left,
                        transform: 'translateX(-50%)'
                    }}
                >
                    {content}
                    {/* Arrow pointing up */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-slate-800"></div>
                </div>,
                document.body
            )}
        </div>
    );
};
