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
        <div className="h-screen bg-[#f8fafc] overflow-y-auto font-sans">
            {/* Minimal Navigation */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                            <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">מערכת שיבוץ</span>
                    </div>
                </div>
            </header>

            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 md:p-12">
                <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-200/60 flex flex-col md:flex-row">

                    {/* Branding Side */}
                    <div className="md:w-[400px] bg-slate-900 p-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400 opacity-[0.03] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-green-400 opacity-[0.03] rounded-full translate-y-1/2 -translate-x-1/2"></div>

                        <div className="relative z-10">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/10">
                                <User size={32} className="text-amber-400" />
                            </div>
                            <h1 className="text-4xl font-black mb-6 leading-tight">שלב אחרון.</h1>
                            <p className="text-slate-400 text-lg leading-relaxed">
                                כדי שנוכל לחבר אותך לנתונים האישיים שלך, אנחנו צריכים לדעת מי אתה מתוך הרשימה.
                            </p>
                        </div>

                        <div className="relative z-10 pt-12">
                            <div className="flex items-center gap-4 text-sm text-slate-500 font-bold uppercase tracking-widest bg-white/5 p-4 rounded-2xl border border-white/5">
                                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                                זוהי פעולה חד פעמית
                            </div>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="flex-1 p-6 md:p-16 bg-white flex flex-col">
                        <div className="max-w-xl mx-auto w-full space-y-8 animate-in fade-in slide-in-from-right-10 duration-700">

                            <div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">מי אתה ברשימה?</h2>
                                <p className="text-slate-500 text-lg">חפש את השם שלך ובחר אותו כדי להתחבר.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="חפש את השם שלך..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pr-14 pl-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-slate-900 focus:bg-white focus:outline-none text-slate-900 text-lg transition-all font-bold placeholder:font-normal placeholder:text-slate-300 shadow-inner"
                                    />
                                </div>

                                <div className="h-64 overflow-y-auto border-2 border-slate-100 rounded-2xl bg-white custom-scrollbar">
                                    {loading ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                                            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-900 rounded-full animate-spin"></div>
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
                                                    className={`w-full p-4 text-right flex items-center justify-between hover:bg-slate-50 transition-all duration-200 group ${selectedPerson?.id === person.id ? 'bg-slate-50 ring-inset ring-2 ring-slate-900' : ''}`}
                                                >
                                                    <span className={`text-lg transition-colors ${selectedPerson?.id === person.id ? 'text-slate-900 font-black' : 'text-slate-600 font-medium group-hover:text-slate-900'}`}>
                                                        {person.name}
                                                    </span>
                                                    {selectedPerson?.id === person.id && (
                                                        <CheckCircle size={20} className="text-slate-900" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {error && (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle size={18} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4 pt-4">
                                <button
                                    onClick={handleClaim}
                                    disabled={!selectedPerson || claiming}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 px-8 rounded-2xl transition-all shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 hover:-translate-y-1 flex items-center justify-center gap-4 text-xl disabled:opacity-50 disabled:translate-y-0 active:scale-95"
                                >
                                    {claiming ? (
                                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            <CheckCircle size={24} />
                                            זה אני, חבר אותי למערכת
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleSkip}
                                    className="w-full py-4 text-slate-400 hover:text-slate-600 font-bold transition-all text-sm hover:underline"
                                >
                                    אני לא ברשימה, הכנס אותי כאורח בינתיים
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
