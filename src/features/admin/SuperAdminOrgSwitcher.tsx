import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Organization } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Buildings, MagnifyingGlass, CheckCircle, ArrowRight, CircleNotch } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';

export const SuperAdminOrgSwitcher: React.FC = () => {
    const { profile, refreshProfile } = useAuth();
    const { showToast } = useToast();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [switchingId, setSwitchingId] = useState<string | null>(null);

    useEffect(() => {
        fetchOrganizations();
    }, []);

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

            showToast('המעבר בוצע בהצלחה, מרענן נתונים...', 'success');
            await refreshProfile();
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 italic text-slate-400">
                <CircleNotch size={32} className="animate-spin mb-4" />
                <p>טוען רשימת פלוגות...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Buildings size={24} className="text-blue-500" />
                            ניהול שיוך פלוגתי
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            בחר פלוגה מהרשימה כדי לשייך את החשבון שלך אליה.
                        </p>
                    </div>

                    <div className="relative w-full md:w-72">
                        <MagnifyingGlass className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="חפש פלוגה לפי שם או ID..."
                            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all text-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredOrgs.map(org => {
                        const isActive = profile?.organization_id === org.id;
                        const isSwitching = switchingId === org.id;

                        return (
                            <div
                                key={org.id}
                                className={`p-4 rounded-2xl border transition-all ${isActive
                                    ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100'
                                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-white hover:shadow-md'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-bold text-slate-800 truncate pr-2" title={org.name}>
                                        {org.name}
                                    </div>
                                    {isActive && (
                                        <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                                            נוכחי
                                        </span>
                                    )}
                                </div>

                                <div className="text-[10px] font-mono text-slate-400 mb-4 select-all">
                                    ID: {org.id}
                                </div>

                                <Button
                                    onClick={() => handleSwitch(org.id)}
                                    disabled={isActive || switchingId !== null}
                                    className={`w-full py-2 h-auto text-xs font-bold rounded-xl transition-all ${isActive
                                        ? 'bg-white text-blue-600 border border-blue-200 shadow-none'
                                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900'
                                        }`}
                                >
                                    {isSwitching ? (
                                        <CircleNotch size={16} className="animate-spin" />
                                    ) : isActive ? (
                                        <div className="flex items-center gap-1">
                                            <CheckCircle size={16} weight="fill" />
                                            משויך כעת
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            עבור לפלוגה
                                            <ArrowRight size={14} />
                                        </div>
                                    )}
                                </Button>
                            </div>
                        );
                    })}
                </div>

                {filteredOrgs.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        לא נמצאו פלוגות התואמות לחיפוש שלך.
                    </div>
                )}
            </div>
        </div>
    );
};
