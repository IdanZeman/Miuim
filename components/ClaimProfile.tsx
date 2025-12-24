import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Person } from '../types';
import { User, Search, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
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
                .is('user_id', null);
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
            const { error: linkError } = await supabase.rpc('claim_person_profile', {
                person_id: selectedPerson.id
            });
            if (linkError) throw linkError;
            await supabase.from('profiles').update({ full_name: selectedPerson.name }).eq('id', user.id);
            await refreshProfile();
            window.location.reload();
        } catch (err: any) {
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
        <div className="min-h-[100dvh] bg-slate-50 flex flex-col font-sans">
            {/* Top Navigation Bar */}
            <nav className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-blue-200">
                            <User size={18} />
                        </div>
                        <span className="font-black text-slate-900 tracking-tight">אימות זהות</span>
                    </div>
                    <button onClick={handleSkip} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors">
                        דילוג
                    </button>
                </div>
            </nav>

            <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-4 pt-8 pb-32">
                {/* Header Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-black text-slate-900 mb-2">מי אתה ברשימה?</h1>
                    <p className="text-slate-500 font-medium">כדי לראות את המשמרות והנתונים שלך, בחר את השם שלך מרשימת כוח האדם של הפלוגה.</p>
                </div>

                {/* Search Box - Floating Style */}
                <div className="sticky top-[73px] z-40 mb-6">
                    <div className="relative group">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="חפש שם..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-12 pl-4 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all text-lg font-bold"
                        />
                    </div>
                </div>

                {/* List Content */}
                <div className="space-y-3">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold">טוען נתונים...</p>
                        </div>
                    ) : filteredPeople.length === 0 ? (
                        <div className="py-16 px-6 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100">
                            <p className="text-slate-400 font-bold">לא מצאנו שם כזה ברשימה</p>
                        </div>
                    ) : (
                        filteredPeople.map(person => (
                            <button
                                key={person.id}
                                onClick={() => setSelectedPerson(person)}
                                className={`w-full p-4 text-right flex items-center justify-between rounded-2xl border-2 transition-all active:scale-[0.98] ${selectedPerson?.id === person.id
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200'
                                    : 'bg-white border-white hover:border-blue-100 text-slate-700 shadow-sm'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm ${selectedPerson?.id === person.id ? 'bg-white/20' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {person.name.charAt(0)}
                                    </div>
                                    <span className="text-lg font-bold">{person.name}</span>
                                </div>
                                {selectedPerson?.id === person.id && <CheckCircle size={22} />}
                            </button>
                        ))
                    )}
                </div>
            </main>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 md:pb-6 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-50">
                <div className="max-w-2xl mx-auto">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold flex items-center gap-2 border border-red-100">
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleClaim}
                        disabled={!selectedPerson || claiming}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-black py-5 rounded-2xl transition-all shadow-xl flex items-center justify-center gap-3 text-xl disabled:text-slate-400"
                    >
                        {claiming ? (
                            <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                אישור וחיבור אישי
                                <ArrowLeft size={20} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};