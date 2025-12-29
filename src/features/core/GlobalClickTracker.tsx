import React, { useEffect } from 'react';
import { logger } from '../../lib/logger';

export const GlobalClickTracker: React.FC = () => {
    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // Find closest interactive element
            const interactiveElement = target.closest('button, a, input[type="submit"], input[type="button"], [role="button"]');

            if (interactiveElement) {
                const element = interactiveElement as HTMLElement;

                // Try to get a meaningful label
                let label = element.getAttribute('aria-label') ||
                    element.getAttribute('data-tracking-label') ||
                    element.innerText ||
                    (element as HTMLInputElement).value ||
                    element.id ||
                    'Unknown Element';

                // Truncate if too long (e.g. big blocks of text)
                if (label.length > 50) label = label.substring(0, 47) + '...';

                // Identify component context if possible (e.g. data-component attribute)
                const component = element.closest('[data-component]')?.getAttribute('data-component') || 'Global';

                logger.logClick(label, component);
            }
        };

        // Use capture to ensure we get the event before stopPropagation stops it
        window.addEventListener('click', handleClick, { capture: true });

        return () => {
            window.removeEventListener('click', handleClick, { capture: true });
        };
    }, []);

    return null; // Renderless component
};
