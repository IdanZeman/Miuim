export const LOCAL_API_URL = 'http://localhost:3001';
export const PROD_API_URL = 'https://server-chi-taupe-75.vercel.app';

export const getApiUrl = (): string => {
    // Priority: 
    // 1. VITE_API_URL env var
    // 2. Default Production URL
    return import.meta.env.VITE_API_URL || PROD_API_URL;
};

export const isLocal = (): boolean => {
    return getApiUrl() === LOCAL_API_URL;
};
