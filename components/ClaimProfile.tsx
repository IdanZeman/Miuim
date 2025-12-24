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
        <div className="min-h-[100dvh] bg-[#f8fafc] flex flex-col font-sans">
            {/* Minimal Navigation */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                            <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">מערכת לניהול פלוגה</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center p-0 md:p-12">
                <div className="bg-white md:rounded-[2.5rem] shadow-2xl max-w-5xl w-full overflow-hidden border-0 md:border border-slate-200/60 flex flex-col md:flex-row min-h-full md:min-h-0">

                    {/* Dark Side Branding (Mobile Top, Desktop Left) */}
                    <div className="w-full md:w-[400px] h-[25vh] md:h-auto bg-emerald-900 p-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 opacity-[0.1] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-400 opacity-[0.1] rounded-full translate-y-1/2 -translate-x-1/2"></div>

                        <div className="relative z-10 flex flex-col h-full justify-center md:justify-start">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 md:mb-8 border border-white/10 shrink-0">
                                <User size={32} className="text-emerald-400" />
                            </div>
                            <h1 className="text-2xl md:text-4xl font-black mb-2 md:mb-6 leading-tight">חיבור אישי.</h1>
                            <p className="hidden md:block text-emerald-100/70 text-lg leading-relaxed">
                                לכל חייל יש פרופיל במערכת. כעת נותר רק לחבר בין המשתמש שלך לפרופיל שלך.
                            </p>
                        </div>

                        <div className="relative z-10 pt-12 hidden md:block">
                            <div className="flex items-center gap-4 text-sm text-emerald-200 font-bold uppercase tracking-widest bg-emerald-950/30 p-4 rounded-2xl border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                פעולה חד פעמית לסנכרון
                            </div>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="flex-1 p-6 md:p-16 bg-white rounded-t-3xl -mt-6 md:mt-0 relative z-20 flex flex-col animate-in slide-in-from-bottom-6 duration-500 overflow-hidden">
                        <div className="max-w-xl mx-auto w-full flex flex-col h-full md:h-auto md:block">

                            <div className="shrink-0 mb-4 md:mb-8">
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 md:mb-4">מי אתה ברשימה?</h2>
                                <p className="text-slate-600 text-sm md:text-lg leading-relaxed">
                                    המערכת עדיין לא יודעת איזה מהשמות ברשימה שייך לך. בחר את השם שלך כדי שנוכל להציג לך את המידע שרלוונטי עבורך.
                                </p>
                            </div>

                            <div className="flex-1 flex flex-col min-h-0 md:min-h-auto space-y-4 md:space-y-6">
                                <div className="relative shrink-0">
                                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                                    <input
                                        type="text"
                                        placeholder="חפש את השם שלך..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pr-14 pl-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white focus:outline-none text-slate-900 text-lg transition-all font-bold placeholder:font-normal placeholder:text-slate-300 shadow-inner"
                                    />
                                </div>

                                <div className="flex-1 md:h-64 overflow-y-auto border-2 border-slate-100 rounded-2xl bg-white custom-scrollbar min-h-[200px] md:min-h-[250px]">
                                    {loading ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                            <span className="font-medium">טוען רשימה...</span>
                                        </div>
                                    ) : filteredPeople.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-slate-400 font-medium p-4 text-center">
                                            {searchTerm ? 'לא נמצאו תוצאות' : 'אין אנשים פנויים ברשימה'}
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {filteredPeople.map(person => (
                                                <button
                                                    key={person.id}
                                                    onClick={() => setSelectedPerson(person)}
                                                    className={`w-full p-4 text-right flex items-center justify-between hover:bg-emerald-50 transition-all duration-200 group ${selectedPerson?.id === person.id ? 'bg-emerald-50 ring-inset ring-2 ring-emerald-500' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs ${selectedPerson?.id === person.id ? 'bg-emerald-500' : 'bg-slate-300 group-hover:bg-emerald-400'}`}>
                                                            {person.name.charAt(0)}
                                                        </div>
                                                        <span className={`text-lg transition-colors ${selectedPerson?.id === person.id ? 'text-emerald-900 font-black' : 'text-slate-700 font-medium group-hover:text-emerald-700'}`}>
                                                            {person.name}
                                                        </span>
                                                    </div>
                                                    {selectedPerson?.id === person.id && (
                                                        <CheckCircle size={24} className="text-emerald-600" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="shrink-0 mt-4 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle size={18} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="shrink-0 space-y-4 pt-4 pb-12 md:pb-0 mt-auto md:mt-6">
                                <button
                                    onClick={handleClaim}
                                    disabled={!selectedPerson || claiming}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 md:py-5 px-8 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:-translate-y-1 flex items-center justify-center gap-4 text-xl disabled:opacity-50 disabled:translate-y-0 active:scale-95"
                                >
                                    {claiming ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle size={24} />
                                            סיימנו, חבר אותי
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleSkip}
                                    className="w-full py-2 text-slate-400 hover:text-emerald-600 font-bold transition-all text-sm hover:underline"
                                >
                                    אני לא מופיע ברשימה, המשך כאורח
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
