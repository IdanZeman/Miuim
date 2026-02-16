import { supabase } from '../lib/supabase';
import { getApiUrl } from '../utils/envUtils';

export const callBackend = async (endpoint: string, method: 'GET' | 'POST' | 'DELETE' | 'PUT' = 'GET', body?: any) => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
            throw new Error('No active session found');
        }

        const options: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };

        if (body && (method === 'POST' || method === 'DELETE' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        let response = await fetch(`${getApiUrl()}${endpoint}`, options);

        // 401 Retry Logic
        if (response.status === 401) {
            console.warn(`⚠️ [backendService] 401 on ${method} ${endpoint}, attempting token refresh...`);
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

            if (refreshData.session && !refreshError) {
                console.log('✅ [backendService] Token refreshed, retrying request...');
                const newToken = refreshData.session.access_token;

                // Update header with new token
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${newToken}`
                };

                response = await fetch(`${getApiUrl()}${endpoint}`, options);
            } else {
                console.error('❌ [backendService] Token refresh failed:', refreshError);
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Backend call failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`❌ [backendService] ${method} ${endpoint} failed:`, error);
        throw error;
    }
};
