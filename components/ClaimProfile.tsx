import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Person } from '../types';
import { User, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { mapPersonFromDB } from '../services/supabaseClient';

export const ClaimProfile: React.FC = () => {
    const { user, profile, refreshProfile } = useAuth();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUnlinkedPeople();
    }, [profile?.organization_id]);

    const fetchUnlinkedPeople = async () => {
        if (!profile?.organization_id) return;

        try {
            const { data, error } = await supabase
                .from('people')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .is('user_id', null); // Only fetch people not yet linked to a user

            if (error) throw error;

            setPeople((data || []).map(mapPersonFromDB));
        } catch (err) {
            console.error('Error fetching people:', err);
            setError('שגיאה בטעינת רשימת האנשים');
        } finally {
            setLoading(false);
        }
    };

    const handleClaim = async () => {
        if (!selectedPerson || !user) return;

        setClaiming(true);
        setError(null);

        try {
            // 1. Link person to user using secure RPC
            const { error: linkError } = await supabase.rpc('claim_person_profile', {
                person_id: selectedPerson.id
            });

            if (linkError) throw linkError;

            // 2. Update profile name to match person name (optional but good for consistency)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ full_name: selectedPerson.name })
                .eq('id', user.id);

            if (profileError) console.warn('Error updating profile name:', profileError);

            // 3. Refresh everything
            await refreshProfile();
            window.location.reload(); // Force reload to ensure all contexts update

        } catch (err: any) {
            console.error('Error claiming profile:', err);
            setError(err.message || 'שגיאה בחיבור לפרופיל');
        } finally {
            setClaiming(false);
        }
    };

    const handleSkip = () => {
        localStorage.setItem('miuim_skip_linking', 'true');
        window.location.reload();
    };

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="h-screen bg-[#f0f4f8] flex flex-col font-sans overflow-y-auto" dir="rtl">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 shadow-sm flex-none">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-sm overflow-hidden p-1.5 border border-slate-100">
                        <img src="/favicon.png" alt="Miuim Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="text-xl font-bold text-slate-800">מערכת שיבוץ משימות</span>
                </div>
            </div>

            <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-white/50">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-[#82d682] to-[#6cc16c] p-8 text-center text-white relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full bg-white/10 backdrop-blur-[1px]"></div>
                        <div className="relative z-10">
                            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-md shadow-inner border border-white/30">
                                <User size={40} className="text-white drop-shadow-md" />
                            </div>
                            <h1 className="text-3xl font-bold mb-2 tracking-tight">מי אתה ברשימה?</h1>
                            <p className="text-green-50 font-medium text-lg opacity-90">
                                כדי שנוכל לחבר אותך לנתונים שלך
                            </p>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="relative mb-6">
                            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder="חפש את השם שלך..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pr-12 pl-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-[#82d682] focus:bg-white outline-none transition-all text-slate-700 font-medium placeholder:text-slate-400"
                            />
                        </div>

                        <div className="max-h-64 overflow-y-auto mb-6 border border-slate-100 rounded-2xl bg-slate-50/50 custom-scrollbar">
                            {loading ? (
                                <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-3">
                                    <div className="w-8 h-8 border-4 border-slate-200 border-t-[#82d682] rounded-full animate-spin"></div>
                                    <span className="font-medium">טוען רשימה...</span>
                                </div>
                            ) : filteredPeople.length === 0 ? (
                                <div className="p-8 text-center text-slate-500 font-medium">
                                    {searchTerm ? 'לא נמצאו תוצאות' : 'אין אנשים פנויים ברשימה'}
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredPeople.map(person => (
                                        <button
                                            key={person.id}
                                            onClick={() => setSelectedPerson(person)}
                                            className={`w-full p-4 text-right flex items-center justify-between hover:bg-white transition-all duration-200 group ${selectedPerson?.id === person.id ? 'bg-white shadow-sm z-10' : ''
                                                }`}
                                        >
                                            <span className={`font-medium transition-colors ${selectedPerson?.id === person.id ? 'text-[#6cc16c] font-bold' : 'text-slate-600 group-hover:text-slate-800'}`}>
                                                {person.name}
                                            </span>
                                            {selectedPerson?.id === person.id && (
                                                <div className="w-6 h-6 bg-[#82d682] rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-200">
                                                    <CheckCircle size={14} className="text-white" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-3 text-sm border border-red-100 shadow-sm">
                                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                <span className="font-medium">{error}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            <button
                                onClick={handleClaim}
                                disabled={!selectedPerson || claiming}
                                className="w-full bg-gradient-to-r from-[#82d682] to-[#6cc16c] hover:from-[#75c975] hover:to-[#5fb45f] disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 active:translate-y-0 flex items-center justify-center gap-2"
                            >
                                {claiming ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>מתחבר...</span>
                                    </>
                                ) : (
                                    <span>זה אני! חבר אותי</span>
                                )}
                            </button>

                            <button
                                onClick={handleSkip}
                                className="w-full py-3 text-slate-500 hover:text-slate-700 font-medium text-sm transition-colors hover:bg-slate-50 rounded-xl"
                            >
                                אני לא ברשימה (הכנס כאורח)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
