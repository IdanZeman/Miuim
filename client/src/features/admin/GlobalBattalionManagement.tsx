import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Battalion } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { Buildings, MagnifyingGlass, ShieldCheck, ToggleRight, ToggleLeft } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { SettingsSkeleton } from '../../components/ui/SettingsSkeleton';

export const GlobalBattalionManagement: React.FC = () => {
    const { showToast } = useToast();
    const [battalions, setBattalions] = useState<Battalion[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        fetchBattalions();
    }, []);

    const fetchBattalions = async () => {
        setLoading(true);
        try {
            const data = await adminService.fetchAllBattalions();
            setBattalions(data || []);
        } catch (error) {
            console.error('Error fetching battalions:', error);
            showToast('שגיאה בטעינת גדודים', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleFeature = async (battalionId: string, enabled: boolean) => {
        setUpdatingId(battalionId);
        try {
            await adminService.updateBattalion(battalionId, {
                is_company_switcher_enabled: enabled
            });

            setBattalions(prev => prev.map(b =>
                b.id === battalionId ? { ...b, is_company_switcher_enabled: enabled } : b
            ));

            showToast(`הפיצ'ר ${enabled ? 'הופעל' : 'כובה'} בהצלחה`, 'success');
        } catch (error) {
            console.error('Error updating battalion:', error);
            showToast('שגיאה בעדכון הגדוד', 'error');
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredBattalions = battalions.filter(b =>
        b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-4 mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Buildings size={24} className="text-blue-500" weight="bold" />
                            ניהול גדודים
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            ניהול הגדרות ופיצ'רים ברמת הגדוד (Super Admin בלבד).
                        </p>
                    </div>

                    <div className="relative w-full">
                        <MagnifyingGlass className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="חפש לפי שם גדוד או קוד..."
                            className="!bg-slate-50 border-slate-200 rounded-xl pr-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBattalions.map(battalion => (
                        <div key={battalion.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-all group shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg">{battalion.name}</h3>
                                    <span className="text-xs font-mono text-slate-400">קוד: {battalion.code}</span>
                                </div>
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm border border-slate-100 italic">
                                    <ShieldCheck size={20} weight="duotone" />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-200/60">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-700">מעבר בין פלוגות</span>
                                        <span className="text-[10px] text-slate-500">אפשר למפקדים נבחרים לדלג בין פלוגות הגדוד</span>
                                    </div>
                                    <Switch
                                        checked={battalion.is_company_switcher_enabled || false}
                                        onChange={(val) => handleToggleFeature(battalion.id, val)}
                                        disabled={updatingId === battalion.id}
                                        size="sm"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredBattalions.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        לא נמצאו גדודים התואמים לחיפוש שלך.
                    </div>
                )}
            </div>
        </div>
    );
};
