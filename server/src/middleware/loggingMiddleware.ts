import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export const loggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const { method, url, body, headers } = req;

    // Create a unique request ID for correlation if needed
    const reqId = Math.random().toString(36).substring(7);

    // Filter sensitive data from body if necessary (e.g., passwords)
    const sanitizedBody = { ...body };
    if (sanitizedBody.password) sanitizedBody.password = '***';

    logger.info(`Request [${reqId}]: ${method} ${url}`, {
        type: 'request',
        id: reqId,
        method,
        url,
        body: sanitizedBody,
        userAgent: headers['user-agent']
    });

    // Intercept response to log completion
    const originalJson = res.json;
    res.json = function (data) {
        const duration = Date.now() - start;
        const dataStr = data ? JSON.stringify(data) : '';
        const size = dataStr.length;

        // Strip large data from log but keep it in the response
        const loggedData = size > 2048 ? { _info: 'Body too large to log', size } : data;

        logger.info(`Response [${reqId}]: ${res.statusCode} (${duration}ms)`, {
            type: 'response',
            id: reqId,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            responseBody: loggedData
        });
        return originalJson.call(this, data);
    };

    next();
};
