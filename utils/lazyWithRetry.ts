import { lazy, ComponentType } from 'react';

/**
 * A wrapper around React.lazy that attempts to reload the page once if the chunk fails to load.
 * This is useful for clearing stale cache after a new deployment.
 */
export const lazyWithRetry = <T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
) => {
    return lazy(() => {
        return factory().catch((error) => {
            // Check if the error is a dynamic import failure
            const message = error.message || '';
            const isChunkError = message.includes('dynamically imported module') || message.includes('Importing a module script failed');

            if (isChunkError) {
                // Check if we already retried to avoid infinite loops
                const hasRetried = window.sessionStorage.getItem('retry-lazy-refreshed');
                if (!hasRetried) {
                    window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
                    console.warn('Chunk load failed, reloading page to get fresh assets...', error);
                    window.location.reload();
                    // Return a never-resolving promise to wait for reload
                    return new Promise(() => {});
                }
            }

            // If not a chunk error or already retried, propagate the error
            throw error;
        });
    });
};
