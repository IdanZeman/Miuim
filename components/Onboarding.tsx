import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Building2 } from 'lucide-react';

export const Onboarding: React.FC = () => {
    const { user, refreshProfile } = useAuth();
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim() || !user) return;

        setLoading(true);
        try {
            // Create organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName.trim() })
                .select()
                .single();

            if (orgError) throw orgError;

            // Update user profile with organization_id
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ organization_id: org.id })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Refresh profile to get the new organization
            await refreshProfile();
        } catch (error) {
            console.error('Error creating organization:', error);
            alert('שגיאה ביצירת הארגון. אנא נסה שוב.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-yellow-50">
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="bg-white p-12 rounded-3xl shadow-xl max-w-lg w-full border-2 border-emerald-200">
                    {/* Icon */}
                    <div className="flex justify-center mb-8">
                        <div className="bg-gradient-to-br from-emerald-400 to-green-500 p-5 rounded-2xl shadow-lg">
                            <Building2 size={48} className="text-white" />
                        </div>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-bold text-slate-800 mb-3">ברוך הבא!</h1>
                        <p className="text-slate-600 text-lg">בוא ניצור את הארגון הראשון שלך</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleCreateOrg} className="space-y-6">
                        <div>
                            <label className="block text-slate-700 font-medium mb-3 text-right text-lg">
                                שם הארגון / היחידה
                            </label>
                            <input
                                type="text"
                                value={orgName}
                                onChange={(e) => setOrgName(e.target.value)}
                                placeholder="לדוגמה: פלוגה א׳, מחלקת IT..."
                                className="w-full px-4 py-4 rounded-xl bg-white border-2 border-slate-200 focus:border-emerald-400 focus:outline-none text-slate-800 placeholder-slate-400 text-right text-lg transition-colors"
                                required
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !orgName.trim()}
                            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed text-lg"
                        >
                            {loading ? 'יוצר ארגון...' : 'צור ארגון והמשך'}
                        </button>
                    </form>

                    {/* Info */}
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4 text-right mt-6">
                        <p className="text-sm text-emerald-800">
                            💡 תוכל להוסיף חברי צוות, להגדיר תפקידים וליצור משמרות מיד לאחר היצירה
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
