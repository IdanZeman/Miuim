import LogRocket from 'logrocket';

const LOGROCKET_APP_ID = import.meta.env.VITE_LOGROCKET_ID;

export const initLogRocket = () => {
    if (LOGROCKET_APP_ID) {
        LogRocket.init(LOGROCKET_APP_ID);
        console.log('🚀 LogRocket initialized');
    } else {
        console.warn('⚠️ LogRocket ID not found in environment variables');
    }
};

export const identifyUser = (user: { id: string; email: string; name?: string; role?: string }) => {
    if (!LOGROCKET_APP_ID) return;

    LogRocket.identify(user.id, {
        name: user.name,
        email: user.email,
        role: user.role, // Custom field
    });
    console.log('👤 LogRocket user identified:', user.id);
};
