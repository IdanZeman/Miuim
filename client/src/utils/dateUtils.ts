/**
 * Formats a date or ISO string into YYYY-MM-DD format using Israel's timezone.
 * This ensures that logs and filters match the application's business day in Israel,
 * regardless of the client's local timezone or UTC offsets.
 */
export const formatIsraelDate = (dateOrStr: Date | string): string => {
    try {
        const date = typeof dateOrStr === 'string' ? new Date(dateOrStr) : dateOrStr;
        
        // Use Intl.DateTimeFormat with Asia/Jerusalem timezone
        // en-CA locale naturally produces YYYY-MM-DD with the 2-digit options
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Jerusalem',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date);
    } catch (e) {
        console.error('Error formatting Israel date:', e);
        // Fallback to simpler split if Intl fails, though it shouldn't
        return typeof dateOrStr === 'string' ? dateOrStr.split('T')[0] : dateOrStr.toISOString().split('T')[0];
    }
};

/**
 * Gets the current time in Israel as a Date object or ISO string.
 */
export const getIsraelNow = (): Date => {
    // Current time but adjusted if we ever need to spoof or fix local clock issues
    return new Date();
};
