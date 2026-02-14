// Utility function to format person names as initials
// Example: "אורי בנג'ו" -> "א.ב"
// Example: "איתמר אילשטיין" -> "א.א"

export const getPersonInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0);

    // Get first letter of first name and first letter of last name
    const firstInitial = parts[0].charAt(0);
    const lastInitial = parts[parts.length - 1].charAt(0);

    return `${firstInitial}.${lastInitial}`;
};

// Get full initials including middle names if needed
export const getPersonFullInitials = (fullName: string): string => {
    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 0) return '';

    return parts.map(part => part.charAt(0)).join('.');
};

// Format name for display with option to show initials or full name
export const formatPersonName = (fullName: string, useInitials: boolean = false): string => {
    return useInitials ? getPersonInitials(fullName) : fullName;
};

// Normalize and format phone numbers, preserving leading zeros for Israeli numbers
export const formatPhoneNumber = (phone: string | number | undefined): string => {
    if (!phone) return '';
    const s = phone.toString().trim().replace(/[-\s]/g, '');
    // Israeli mobile: 9 digits starting with 5 (e.g. 501234567)
    if (/^5[0-9]{8}$/.test(s)) return '0' + s;
    // Israeli landline with area code: 8 digits starting with 2,3,4,8,9 (e.g. 31234567)
    if (/^[23489][0-9]{7}$/.test(s)) return '0' + s;
    return s;
};
