/**
 * Formats a phone number for WhatsApp wa.me links.
 * Standardizes by removing non-digits and adding 972 prefix for Israeli numbers.
 */
export const getWhatsAppLink = (phone: string, message?: string): string => {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // If it starts with 0, replace it with 972 (Israeli standard)
    // Most numbers in this app are expected to be Israeli.
    const internationalPhone = cleanPhone.startsWith('0') 
        ? '972' + cleanPhone.substring(1) 
        : cleanPhone.startsWith('972')
            ? cleanPhone
            : '972' + cleanPhone; // Assume Israeli if no prefix and doesn't start with 0
    
    const baseUrl = `https://wa.me/${internationalPhone}`;
    return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
};
