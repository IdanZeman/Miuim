
import React, { useState, useEffect } from 'react';
import { Shield, Copy, Check, Info, Buildings, Users } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../features/auth/AuthContext';
import { Battalion, Organization } from '@/types';
import { fetchBattalion, fetchBattalionCompanies, updateBattalionMorningReportTime } from '../../services/battalionService';

export const BattalionSettings: React.FC = () => {
    const { profile, organization } = useAuth();
    const { showToast } = useToast();
    const [battalion, setBattalion] = useState<Battalion | null>(null);
    const [companies, setCompanies] = useState<Organization[]>([]);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedTime, setSelectedTime] = useState('09:00');

    useEffect(() => {
        if (organization?.battalion_id) {
            loadBattalionData();
        } else {
            setLoading(false);
        }
    }, [organization?.battalion_id]);

    const loadBattalionData = async () => {
        if (!organization?.battalion_id) return;
        try {
            const [battalionData, companiesData] = await Promise.all([
                fetchBattalion(organization.battalion_id),
                fetchBattalionCompanies(organization.battalion_id)
            ]);
            setBattalion(battalionData);
            setCompanies(companiesData);
            if (battalionData.morning_report_time) {
                setSelectedTime(battalionData.morning_report_time);
            }
        } catch (error) {
            console.error('Failed to load battalion data:', error);
            showToast('שגיאה בטעינת נתוני הגדוד', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        if (!battalion?.code) return;
        navigator.clipboard.writeText(battalion.code);
        setCopied(true);
        showToast('הקוד הועתק ללוח', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleTimeChange = async (newTime: string) => {
        if (!battalion?.id) return;

        try {
            setSaving(true);
            setSelectedTime(newTime);
            await updateBattalionMorningReportTime(battalion.id, newTime);
            showToast('שעת הדוח עודכנה בהצלחה', 'success');
        } catch (error) {
            console.error('Failed to update morning report time:', error);
            showToast('שגיאה בעדכון שעת הדוח', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm animate-pulse">
                    <div className="h-8 bg-slate-200 rounded w-1/3 mb-6"></div>
                    <div className="space-y-4">
                        <div className="h-12 bg-slate-100 rounded"></div>
                        <div className="h-12 bg-slate-100 rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!battalion) return <div className="text-center text-slate-500 mt-8">שגיאה בטעינת נתוני הגדוד</div>;

    const hqCompany = companies.find(c => c.is_hq);
    const regularCompanies = companies.filter(c => !c.is_hq);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* General Info Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Shield size={20} />
                    </div>
                    <span className="font-black text-slate-900">פרטי הגדוד והגדרות חיבור</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">שם הגדוד</label>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-bold text-lg">
                            {battalion.name}
                        </div>
                        {organization?.is_hq && (
                            <div className="mt-2 flex items-center gap-2 text-xs font-bold text-indigo-600">
                                <Shield size={14} />
                                <span>ארגון זה הוא פלוגת המפקדה של הגדוד</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                        <label className="block text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                            קוד חיבור פלוגות
                            <Info size={14} className="text-blue-400" />
                        </label>

                        <div className="bg-white rounded-xl p-4 border-2 border-dashed border-blue-200 flex items-center justify-between group hover:border-blue-400 transition-colors">
                            <span className="text-3xl font-black text-blue-600 tracking-widest font-mono">
                                {battalion.code}
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon={copied ? Check : Copy}
                                onClick={copyCode}
                                className={copied ? 'text-green-600' : 'text-slate-400 group-hover:text-blue-600'}
                            >
                                {copied ? 'הועתק' : 'העתק'}
                            </Button>
                        </div>
                        <p className="text-xs text-blue-600/80 mt-3 font-medium leading-relaxed">
                            שתף קוד זה עם מנהלי הפלוגות. עליהם להזין אותו תחת "הגדרות ארגון" בלשונית "גדוד" כדי להתחבר אליך.
                        </p>
                    </div>
                </div>
            </div>

            {/* Reports & Status Settings */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <Info size={20} weight="bold" />
                    </div>
                    <span className="font-black text-slate-900">דוחות וסטטוס</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">שעת דוח בוקר</label>
                        <p className="text-xs text-slate-500 mb-3">
                            המערכת תצלם את תמונת המצב של כל הפלוגות בשעה זו באופן אוטומטי.
                        </p>
                        <div className="relative">
                            <input
                                type="time"
                                className={`w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-bold focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none appearance-none ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                                value={selectedTime}
                                disabled={saving}
                                onChange={(e) => handleTimeChange(e.target.value)}
                            />
                            {saving && (
                                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                                    <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Companies List Card */}
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <Buildings size={20} weight="bold" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-900">פלוגות משויכות</h3>
                            <p className="text-xs text-slate-500 font-medium">רשימת כל הפלוגות המחוברות לגדוד</p>
                        </div>
                    </div>
                    <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-sm font-black border border-emerald-100">
                        {companies.length} {companies.length === 1 ? 'פלוגה' : 'פלוגות'}
                    </div>
                </div>

                {companies.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <Buildings size={48} className="mx-auto mb-4 text-slate-300" weight="bold" />
                        <p className="text-slate-500 font-bold">אין פלוגות משויכות כרגע</p>
                        <p className="text-xs text-slate-400 mt-1">שתף את קוד החיבור עם מנהלי הפלוגות</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* HQ Company First */}
                        {hqCompany && (
                            <div className="group p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl border-2 border-indigo-200 hover:border-indigo-300 transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 bg-indigo-500 text-white rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                                            <Shield size={20} weight="fill" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-slate-900 text-lg truncate">{hqCompany.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-black text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                                    פלוגת מפקדה
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Regular Companies */}
                        {regularCompanies.map((company) => (
                            <div key={company.id} className="group p-5 bg-slate-50 hover:bg-white rounded-2xl border border-slate-200 hover:border-emerald-200 hover:shadow-md transition-all">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-12 h-12 bg-white group-hover:bg-emerald-50 border-2 border-slate-200 group-hover:border-emerald-200 rounded-xl flex items-center justify-center shrink-0 transition-all">
                                            <Buildings size={20} className="text-slate-400 group-hover:text-emerald-600 transition-colors" weight="bold" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-slate-900 text-lg truncate">{company.name}</h4>
                                            <p className="text-xs text-slate-500 font-medium mt-0.5">פלוגה רגילה</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
