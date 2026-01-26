import React, { useEffect, useRef, useState, ReactNode } from 'react';

interface AutoSizerProps {
    children: (size: { width: number; height: number }) => ReactNode;
    className?: string;
    style?: React.CSSProperties;
    defaultHeight?: number;
    defaultWidth?: number;
}

export default function AutoSizer({
    children,
    className = '',
    style = {},
    defaultHeight = 0,
    defaultWidth = 0,
}: AutoSizerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                // Use contentRect for precise content box size, or offsetWidth/Height
                // contentRect is usually preferred for ResizeObserver
                const { width, height } = entry.contentRect;

                // If we need to support padding, we might need to adjust, but typically AutoSizer fills 100%
                setSize({ width, height });
            }
        });

        // Set initial size immediately if possible
        if (element.offsetWidth && element.offsetHeight) {
            // We can check this, but Observer will fire anyway.
            // Setting it here might avoid a flash of 0/0.
            setSize({ width: element.offsetWidth, height: element.offsetHeight });
        }

        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                ...style
            }}
        >
            {children(size)}
        </div>
    );
}
