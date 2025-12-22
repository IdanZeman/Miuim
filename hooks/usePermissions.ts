import { useAuth } from '../contexts/AuthContext';
import { ViewMode, AccessLevel, DataScope, Person, Shift, TaskTemplate } from '../types';

export const usePermissions = () => {
    const { profile } = useAuth();

    /**
     * Checks if the user can view a specific screen.
     */
    const canView = (screen: ViewMode): boolean => {
        if (!profile) return false;
        if (profile.is_super_admin) return true;
        if (screen === 'home' || screen === 'contact') return true;

        // Custom Permissions Check
        if (profile.permissions?.screens?.[screen]) {
            return profile.permissions.screens[screen] !== 'none';
        }

        // Role-based fallbacks (Backward Compatibility)
        const role = profile.role;
        switch (role) {
            case 'admin': return true;
            case 'editor': return screen !== 'settings' && screen !== 'system' && screen !== 'logs';
            case 'viewer': return ['dashboard', 'stats', 'lottery', 'equipment'].includes(screen);
            case 'attendance_only': return ['attendance', 'dashboard'].includes(screen);
            default: return false;
        }
    };

    /**
     * Checks if the user can edit on a specific screen.
     */
    const canEdit = (screen: ViewMode): boolean => {
        if (!profile) return false;
        if (profile.is_super_admin) return true;

        // Custom Permissions Check
        if (profile.permissions?.screens?.[screen]) {
            return profile.permissions.screens[screen] === 'edit';
        }

        // Role-based fallbacks (Backward Compatibility)
        const role = profile.role;
        switch (role) {
            case 'admin': return true;
            case 'editor': return !['settings', 'system', 'logs'].includes(screen);
            case 'attendance_only': return screen === 'attendance';
            case 'viewer': return false;
            default: return false;
        }
    };

    /**
     * Filters a list of items based on the user's data scope (Organization, Team, or Personal).
     */
    const getScopedData = <T extends { teamId?: string; id?: string; personId?: string; assignedPersonIds?: string[]; assigned_to_id?: string | null }>(
        items: T[],
        personnel: Person[] = []
    ): T[] => {
        if (!profile) return [];
        if (profile.is_super_admin) return items;

        const scope = profile.permissions?.dataScope || 'organization';
        const allowedTeams = profile.permissions?.allowedTeamIds || [];

        if (scope === 'organization') return items;

        if (scope === 'team') {
            return items.filter(item => {
                const teamId = item.teamId;
                if (teamId && allowedTeams.includes(teamId)) return true;
                
                // If it's a person/soldier
                if (item.hasOwnProperty('teamId')) {
                   return allowedTeams.includes((item as any).teamId);
                }

                // If it's a shift
                if (item.assignedPersonIds) {
                    return item.assignedPersonIds.some(pid => {
                        const p = personnel.find(pers => pers.id === pid);
                        return p && p.teamId && allowedTeams.includes(p.teamId);
                    });
                }

                return false;
            });
        }

        if (scope === 'personal' || scope === 'my_team') {
            const currentPerson = personnel.find(p => p.userId === profile.id);
            if (!currentPerson) return [];

            // For 'my_team', we use the person's teamId as the allowed team
            const targetTeamIds = scope === 'my_team' 
                ? (currentPerson.teamId ? [currentPerson.teamId] : [])
                : [];

            return items.filter(item => {
                if (scope === 'my_team') {
                    // Check if item belongs to the user's team
                    const itemTeamId = item.teamId || (item as any).personId ? personnel.find(p => p.id === (item as any).personId)?.teamId : null;
                    if (itemTeamId && targetTeamIds.includes(itemTeamId)) return true;

                    // If it's a person/soldier
                    if (item.hasOwnProperty('teamId')) {
                        return targetTeamIds.includes((item as any).teamId);
                    }

                    // If it's a shift
                    if (item.assignedPersonIds) {
                        return item.assignedPersonIds.some(pid => {
                            const p = personnel.find(pers => pers.id === pid);
                            return p && p.teamId && targetTeamIds.includes(p.teamId);
                        });
                    }
                }

                if (scope === 'personal') {
                    // If it's the person record itself
                    if (item.id === currentPerson.id) return true;
                    
                    // If it's an assignment (Shift, Equipment)
                    if (item.assignedPersonIds?.includes(currentPerson.id)) return true;
                    if (item.personId === currentPerson.id) return true;
                    if ((item as any).assigned_to_id === currentPerson.id) return true;
                }

                return false;
            });
        }

        return items;
    };

    return {
        profile,
        canView,
        canEdit,
        getScopedData,
        isAdmin: profile?.role === 'admin' || profile?.is_super_admin
    };
};
