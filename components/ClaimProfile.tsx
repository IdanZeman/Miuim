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
        <div className="fixed inset-0 h-[100dvh] w-full bg-[#f8fafc] md:bg-slate-50 flex flex-col font-sans overflow-hidden">
            {/* Mobile Background (Dark Overlay style with Image) */}
            <div className="absolute inset-0 z-0 md:hidden">
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-10" />
                <img
                    src="https://images.unsplash.com/photo-1542204165-65926c4cc58f?auto=format&fit=crop&q=80&w=2000"
                    className="w-full h-full object-cover opacity-20 filter grayscale"
                    alt="Background"
                />
            </div>

            {/* Desktop Navigation */}
            <header className="hidden md:flex bg-white border-b border-slate-200 h-16 items-center shadow-sm sticky top-0 z-50 shrink-0">
                <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                            <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">מערכת לניהול פלוגה</span>
                    </div>
                </div>
            </header>

            <div className="flex-1 flex max-h-[100dvh] md:items-center justify-center p-0 md:p-12 relative z-10 overflow-hidden">
                {/* Main Card Container */}
                <div className="bg-white md:rounded-[2.5rem] shadow-2xl max-w-5xl w-full md:border border-slate-200/60 flex flex-col md:flex-row h-full md:h-auto md:max-h-[85vh] animate-in slide-in-from-bottom-10 duration-500 overflow-hidden">

                    {/* Dark Side Branding (Desktop Only) */}
                    <div className="hidden md:flex w-full md:w-[400px] bg-emerald-900 p-12 text-white flex-col justify-between relative overflow-hidden shrink-0">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 opacity-[0.1] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-400 opacity-[0.1] rounded-full translate-y-1/2 -translate-x-1/2"></div>

                        <div className="relative z-10 flex flex-col h-full justify-start">
                            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mb-8 border border-white/10 shrink-0">
                                <User size={32} className="text-emerald-400" />
                            </div>
                            <h1 className="text-4xl font-black mb-6 leading-tight">חיבור אישי.</h1>
                            <p className="text-emerald-100/70 text-lg leading-relaxed">
                                לכל חייל יש פרופיל במערכת. כעת נותר רק לחבר בין המשתמש שלך לפרופיל שלך.
                            </p>
                        </div>
                    </div>

                    {/* Content Side */}
                    <div className="flex-1 flex flex-col bg-white h-full relative overflow-hidden">

                        {/* Mobile Header (Fixed at top) */}
                        <div className="px-6 pt-12 pb-4 md:hidden shrink-0 text-center bg-white border-b border-slate-50 relative">
                            {/* Decorative Handle for "Sheet" look */}
                            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-slate-100 rounded-full" />

                            <h2 className="text-2xl font-black text-slate-900 mb-1">מי אתה ברשימה?</h2>
                            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
                                בחר את השם שלך כדי לסנכרן את הפרופיל.
                            </p>
                        </div>

                        {/* Desktop Header */}
                        <div className="hidden md:block p-8 pb-0 shrink-0">
                            <h2 className="text-3xl font-black text-slate-900 mb-3">מי אתה ברשימה?</h2>
                            <p className="text-slate-600 text-lg leading-relaxed">
                                בחר את השם שלך כדי שנוכל להציג לך את המידע שרלוונטי עבורך.
                            </p>
                        </div>

                        {/* Search Area (Sticky / Fixed) */}
                        <div className="px-6 md:px-8 py-4 shrink-0 bg-white z-10">
                            <div className="relative">
                                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                                <input
                                    type="text"
                                    placeholder="חפש את השם שלך..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="w-full pr-12 pl-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:border-emerald-500 focus:bg-white focus:outline-none text-slate-900 font-bold transition-all shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Scrollable List Area */}
                        <div className="flex-1 overflow-y-auto px-6 md:px-8 pb-4 custom-scrollbar">
                            <div className="space-y-2 pb-24 md:pb-0"> {/* Extra padding for mobile fixed footer */}
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                                        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
                                        <span className="font-medium">טוען רשימה...</span>
                                    </div>
                                ) : filteredPeople.length === 0 ? (
                                    <div className="flex items-center justify-center text-slate-400 font-medium py-12 text-center bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                        {searchTerm ? 'לא נמצאו תוצאות' : 'אין אנשים פנויים ברשימה'}
                                    </div>
                                ) : (
                                    filteredPeople.map(person => (
                                        <button
                                            key={person.id}
                                            onClick={() => setSelectedPerson(person)}
                                            className={`w-full p-3.5 text-right flex items-center justify-between rounded-xl border transition-all duration-200 group ${selectedPerson?.id === person.id
                                                ? 'bg-emerald-50 border-emerald-500 shadow-sm ring-1 ring-emerald-500'
                                                : 'bg-white border-slate-100 hover:border-emerald-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 transition-colors ${selectedPerson?.id === person.id ? 'bg-emerald-500' : 'bg-slate-200 group-hover:bg-emerald-400'}`}>
                                                    {person.name.charAt(0)}
                                                </div>
                                                <span className={`text-base transition-colors ${selectedPerson?.id === person.id ? 'text-emerald-900 font-black' : 'text-slate-700 font-bold group-hover:text-emerald-900'}`}>
                                                    {person.name}
                                                </span>
                                            </div>
                                            {selectedPerson?.id === person.id && (
                                                <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Footer Actions (Fixed at bottom for mobile) */}
                        <div className="absolute md:relative bottom-0 left-0 right-0 p-6 md:p-8 bg-white border-t border-slate-100 md:border-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] md:shadow-none z-20">
                            {error && (
                                <div className="mb-3 bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
                                    <AlertCircle size={16} className="shrink-0" />
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleClaim}
                                disabled={!selectedPerson || claiming}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 active:scale-[0.98] flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:active:scale-100"
                            >
                                {claiming ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <CheckCircle size={20} />
                                        סיימנו, חבר אותי
                                    </>
                                )}
                            </button>

                            <button
                                onClick={handleSkip}
                                className="w-full mt-3 py-2 text-slate-400 hover:text-emerald-600 font-bold transition-all text-sm hover:underline"
                            >
                                אני לא מופיע ברשימה, המשך כאורח
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
