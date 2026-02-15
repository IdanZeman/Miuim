import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

// In-memory log buffer for easier production debugging
export const logBuffer: string[] = [];
const bufferLimit = 100;

const logToBuffer = winston.format((info) => {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${info.level.toUpperCase()}: ${info.message}`;
    logBuffer.push(logLine);
    if (logBuffer.length > bufferLimit) logBuffer.shift();
    return info;
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure the logs directory exists relative to the server root
const logsDir = path.join(__dirname, '../../logs');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
    })
);

const transports: any[] = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        )
    })
];

// Only add file logging if not in production (Vercel has read-only filesystem)
// We use a dynamic import here to avoid loading the dependency in production
if (process.env.NODE_ENV !== 'production') {
    try {
        // @ts-ignore
        await import('winston-daily-rotate-file');
        const dailyRotateFileTransport = new (winston.transports as any).DailyRotateFile({
            dirname: logsDir,
            filename: 'application-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
        });
        transports.push(dailyRotateFileTransport);
    } catch (e) {
        console.warn('Failed to initialize file logging:', e);
    }
}

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        logToBuffer(),
        logFormat
    ),
    transports: transports,
});
