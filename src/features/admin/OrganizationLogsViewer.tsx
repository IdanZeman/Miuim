
import React from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { Shield as ShieldIcon } from '@phosphor-icons/react';
import { UserActivityStats } from './UserActivityStats';

interface OrganizationLogsViewerProps {
    limit?: number; // Kept for interface compatibility but not used
}

export const OrganizationLogsViewer: React.FC<OrganizationLogsViewerProps> = () => {
    const { organization, profile } = useAuth();

    // Check permissions
    const canView = profile?.is_super_admin ||
        profile?.role === 'admin' ||
        profile?.permissions?.screens?.['logs'] === 'view' ||
        profile?.permissions?.screens?.['logs'] === 'edit';

    if (!canView || !organization) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                <ShieldIcon size={48} className="mb-4 opacity-20 text-slate-500" weight="bold" />
                <h3 className="text-lg font-bold text-slate-600 mb-2">אין הרשאת גישה</h3>
                <p className="text-sm">איזור זה מוגבל למנהלי מערכת בלבד.</p>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <UserActivityStats />
        </div>
    );
};
