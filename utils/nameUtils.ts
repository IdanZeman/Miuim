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
