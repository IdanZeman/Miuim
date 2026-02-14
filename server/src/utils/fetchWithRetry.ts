import { logger } from './logger.js';

export const fetchWithRetry = async (url: string | URL | Request, options: any = {}): Promise<Response> => {
    const timeout = options.timeout || 30000; // 30 seconds default
    const retries = options.retries || 3;
    const retryDelay = 1000;

    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);

            const config = {
                ...options,
                signal: controller.signal
            };

            // Remove custom properties not valid for fetch
            delete config.timeout;
            delete config.retries;

            const response = await fetch(url, config);
            clearTimeout(id);
            return response;
        } catch (error: any) {
            const isLastAttempt = i === retries - 1;
            const isTimeout = error.name === 'AbortError' || error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.cause?.code === 'UND_ERR_CONNECT_TIMEOUT';

            if (isLastAttempt) {
                logger.error(`Fetch failed after ${retries} attempts: ${error.message}`, { url: typeof url === 'string' ? url : 'RequestObject' });
                throw error;
            }

            logger.warn(`Fetch attempt ${i + 1} failed (${error.message}). Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    throw new Error('Unreachable code');
};
