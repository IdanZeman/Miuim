import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Organization } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Buildings, MagnifyingGlass, CheckCircle, ArrowRight, ClockCounterClockwise } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { SettingsSkeleton } from '../../components/ui/SettingsSkeleton';

const RECENT_ORGS_KEY = 'recent_organizations';
const MAX_RECENT = 4;

export const SuperAdminOrgSwitcher: React.FC = () => {
    const { profile, refreshProfile } = useAuth();
    const { showToast } = useToast();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [recentIds, setRecentIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [switchingId, setSwitchingId] = useState<string | null>(null);

    useEffect(() => {
        fetchOrganizations();
        loadRecentOrgs();
    }, []);

    const loadRecentOrgs = () => {
        const saved = localStorage.getItem(RECENT_ORGS_KEY);
        if (saved) {
            try {
                setRecentIds(JSON.parse(saved));
            } catch (e) {
                console.error('Error parsing recent orgs:', e);
            }
        }
    };

    const addToRecent = (id: string) => {
        const updated = [id, ...recentIds.filter(rid => rid !== id)].slice(0, MAX_RECENT);
        setRecentIds(updated);
        localStorage.setItem(RECENT_ORGS_KEY, JSON.stringify(updated));
    };

    const fetchOrganizations = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('organizations')
                .select('*')
                .order('name');

            if (error) throw error;
            setOrganizations(data || []);
        } catch (error: any) {
            console.error('Error fetching organizations:', error);
            showToast('שגיאה בטעינת פלוגות', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSwitch = async (orgId: string) => {
        if (!profile) return;

        try {
            setSwitchingId(orgId);
            const { error } = await supabase
                .from('profiles')
                .update({ organization_id: orgId })
                .eq('id', profile.id);

            if (error) throw error;

            addToRecent(orgId);
            showToast('המעבר בוצע בהצלחה, מרענן מערכת...', 'success');
            await refreshProfile();

            // Hard refresh to ensure all system states, caches and data are fully re-initialized for the new company
            setTimeout(() => {
                window.location.reload();
            }, 800);
        } catch (error: any) {
            console.error('Error switching organization:', error);
            showToast('שגיאה במעבר בין פלוגות', 'error');
        } finally {
            setSwitchingId(null);
        }
    };

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const recentOrgs = organizations.filter(org => recentIds.includes(org.id))
        .sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));

    if (loading) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm shadow-blue-100 italic">
                                <Buildings size={28} weight="duotone" />
                            </div>
                            ניהול שיוך פלוגתי
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-2">
                            בחר פלוגה מהרשימה כדי לשייך את החשבון שלך אליה.
                        </p>
                    </div>

                    <div className="relative w-full md:w-80">
                        <MagnifyingGlass className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} weight="bold" />
                        <input
                            type="text"
                            placeholder="חפש פלוגה..."
                            className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-[1.25rem] focus:ring-4 focus:ring-blue-500/10 focus:bg-white outline-none transition-all text-sm font-bold"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Recent Organizations Section */}
                {!searchTerm && recentOrgs.length > 0 && (
                    <div className="mb-10 animate-in fade-in slide-in-from-top-2 duration-500">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <ClockCounterClockwise size={14} weight="bold" />
                            פלוגות בשימוש אחרון
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {recentOrgs.map(org => (
                                <OrgCard
                                    key={`recent-${org.id}`}
                                    org={org}
                                    isActive={profile?.organization_id === org.id}
                                    isSwitching={switchingId === org.id}
                                    onSwitch={handleSwitch}
                                    disabled={switchingId !== null}
                                />
                            ))}
                        </div>
                        <div className="mt-8 border-b border-slate-100" />
                    </div>
                )}

                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">
                    {searchTerm ? `תוצאות חיפוש (${filteredOrgs.length})` : 'כל הפלוגות'}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrgs.map(org => (
                        <OrgCard
                            key={org.id}
                            org={org}
                            isActive={profile?.organization_id === org.id}
                            isSwitching={switchingId === org.id}
                            onSwitch={handleSwitch}
                            disabled={switchingId !== null}
                        />
                    ))}
                </div>

                {filteredOrgs.length === 0 && (
                    <div className="text-center py-20 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200 shadow-sm">
                            <MagnifyingGlass size={32} />
                        </div>
                        <p className="text-slate-400 font-bold">לא נמצאו פלוגות התואמות לחיפוש שלך.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const OrgCard: React.FC<{
    org: Organization,
    isActive: boolean,
    isSwitching: boolean,
    onSwitch: (id: string) => void,
    disabled: boolean
}> = ({ org, isActive, isSwitching, onSwitch, disabled }) => (
    <div
        className={`p-5 rounded-[1.5rem] border-2 transition-all group relative overflow-hidden ${isActive
            ? 'bg-blue-50 border-blue-200 shadow-md shadow-blue-100/50'
            : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-xl hover:-translate-y-1'
            }`}
    >
        {/* Glow effect */}
        {isActive && <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/10 blur-3xl rounded-full -mr-12 -mt-12" />}

        <div className="flex justify-between items-start mb-3 relative z-10">
            <div className="font-black text-slate-800 text-sm truncate pr-2 group-hover:text-blue-600 transition-colors" title={org.name}>
                {org.name}
            </div>
            {isActive && (
                <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter shrink-0 shadow-sm shadow-blue-200">
                    פעיל כעת
                </span>
            )}
        </div>

        <div className="text-[10px] font-mono text-slate-400 mb-6 select-all flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
            <span className="font-bold uppercase tracking-tight">ID:</span>
            {org.id}
        </div>

        <Button
            onClick={() => onSwitch(org.id)}
            disabled={isActive || disabled}
            className={`w-full py-3 h-auto text-[11px] font-black rounded-xl transition-all relative z-10 ${isActive
                ? 'bg-transparent text-blue-600 border-2 border-blue-200 hover:bg-transparent shadow-none'
                : 'bg-slate-900 text-white hover:bg-blue-600 hover:scale-[1.02] shadow-lg shadow-slate-200'
                }`}
        >
            {isSwitching ? (
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    עובר...
                </div>
            ) : isActive ? (
                <div className="flex items-center gap-1.5">
                    <CheckCircle size={16} weight="fill" />
                    משויך
                </div>
            ) : (
                <div className="flex items-center gap-1.5">
                    עבור לפלוגה
                    <ArrowRight size={14} weight="bold" />
                </div>
            )}
        </Button>
    </div>
);
