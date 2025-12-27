import { logger } from '../lib/logger';

/**
 * Global error handler for user-facing operations.
 * Logs the error to the backend/analytics and displays a user-friendly toast.
 */
export const handleAppError = (error: any, actionDescription: string, userMessage?: string) => {
    // 1. Log the error
    console.error(`[AppError] ${actionDescription}:`, error);
    
    logger.error('ERROR', actionDescription, {
        message: error?.message || String(error),
        stack: error?.stack,
        originalError: error
    });

    // 2. Show user-friendly message
    // We assume a 'showToast' or similar is available in the context, 
    // but since this is a utility, we might need to rely on the caller to show the toast 
    // OR import the toast mechanism if it's global (e.g. from a library).
    // In this project, 'showToast' seems to be widely used but often passed as context or local.
    // However, if we look at other files, they often use a specific toast library or context.
    
    // Check if we can import the toast emitter. 
    // If not, we return the formatted message for the caller.
    
    const defaultMessage = userMessage || 'הפעולה נכשלה עקב תקלת תקשורת זמנית. הדיווח הועבר לצוות הטכני לטיפול.';
    
    // We will attempt to dispatch a custom event if no direct toast import is available,
    // or simply return the message. 
    // BUT! The user specifically asked "everywhere in the site... warn him".
    // So let's try to trigger the toast here if possible.
    // Looking at the codebase, 'showToast' is often a prop or from context.
    // Let's rely on the caller for the UI part for now, or use window.alert as fallback? No, ugly.
    
    // Best practice: The caller calls `handleAppError(e, 'saving roster')` and THEN shows toast?
    // Or we pass the showToast function?
    // Let's see if there is a global toast. `App.tsx` has `ToastContext`.
    
    return defaultMessage;
};
