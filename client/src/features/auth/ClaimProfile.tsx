import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { Person } from '../../types';
import { User as UserIcon, MagnifyingGlass as SearchIcon, CheckCircle as CheckCircleIcon, WarningCircle as AlertCircleIcon, ArrowLeft as ArrowLeftIcon } from '@phosphor-icons/react';
import { personnelService } from '../../services/personnelService';


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
            const data = await personnelService.fetchUnlinkedPeople(profile.organization_id);
            setPeople(data);
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
            await personnelService.claimProfile(selectedPerson.id, user.id, selectedPerson.name);
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
        <div className="min-h-[100dvh] bg-[#f8fafc] flex flex-col font-sans text-slate-900">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center shadow-sm sticky top-0 z-50">
                <div className="max-w-3xl mx-auto px-4 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                            <UserIcon size={20} className="text-slate-900" weight="bold" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">אימות זהות</span>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 px-4 py-2 rounded-lg"
                    >
                        דילוג
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 pt-8 pb-32 md:pb-12">
                {/* Header Section */}
                <div className="text-center md:text-right mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">מי אתה ברשימה?</h1>
                    <p className="text-lg text-slate-500 font-medium leading-relaxed max-w-xl mx-auto md:mx-0">
                        כדי לראות את המשמרות והנתונים שלך, בחר את השם שלך מרשימת כוח האדם של הפלוגה.
                    </p>
                </div>

                {/* Search Box */}
                <div className="sticky top-[80px] z-40 mb-6 md:mb-8">
                    <div className="relative group shadow-lg shadow-slate-200/50 rounded-2xl">
                        <SearchIcon className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={24} weight="bold" />
                        <input
                            type="text"
                            placeholder="חפש את השם שלך..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-14 pl-4 py-5 rounded-2xl bg-white border-2 border-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 outline-none transition-all text-xl font-bold placeholder:text-slate-300 placeholder:font-normal"
                        />
                    </div>
                </div>

                {/* List Content */}
                <div className="space-y-3 flex-1">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                            <p className="font-bold animate-pulse">טוען רשימת שמות...</p>
                        </div>
                    ) : filteredPeople.length === 0 ? (
                        <div className="py-16 px-6 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <SearchIcon size={32} weight="bold" />
                            </div>
                            <p className="text-slate-900 font-bold text-lg mb-1">לא מצאנו שם כזה</p>
                            <p className="text-slate-400">נסה לחפש שוב או פנה למפקד שיצר את הארגון.</p>
                        </div>
                    ) : (
                        filteredPeople.map(person => (
                            <button
                                key={person.id}
                                onClick={() => setSelectedPerson(person)}
                                className={`w-full p-4 md:p-5 text-right flex items-center justify-between rounded-2xl border-2 transition-all duration-200 group relative overflow-hidden ${selectedPerson?.id === person.id
                                    ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20 scale-[1.02] z-10'
                                    : 'bg-white border-transparent hover:border-slate-200 text-slate-700 shadow-sm hover:shadow-md'
                                    }`}
                            >
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg transition-colors ${selectedPerson?.id === person.id
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                                        }`}>
                                        {person.name.charAt(0)}
                                    </div>
                                    <div>
                                        <span className="text-lg md:text-xl font-bold block leading-tight">{person.name}</span>
                                        {person.email && (
                                            <span className={`text-sm ${selectedPerson?.id === person.id ? 'text-slate-300' : 'text-slate-400'}`}>
                                                {person.email}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {selectedPerson?.id === person.id && (
                                    <div className="bg-emerald-500 rounded-full p-1 text-white animate-in zoom-in spin-in-90 duration-300">
                                        <CheckCircleIcon size={24} className="fill-current" weight="bold" />
                                    </div>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </main>

            {/* Bottom Sticky Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-8 md:pb-6 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50">
                <div className="max-w-3xl mx-auto flex flex-col items-center">
                    {error && (
                        <div className="w-full mb-4 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100 animate-in slide-in-from-bottom-2">
                            <AlertCircleIcon size={20} className="shrink-0" weight="bold" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleClaim}
                        disabled={!selectedPerson || claiming}
                        className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:cursor-not-allowed text-white font-black py-4 md:py-5 rounded-2xl transition-all shadow-lg shadow-slate-900/20 hover:shadow-slate-900/40 hover:-translate-y-1 flex items-center justify-center gap-3 text-xl disabled:text-slate-400 active:scale-95"
                    >
                        {claiming ? (
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>מחבר אותך...</span>
                            </div>
                        ) : (
                            <>
                                אישור וחיבור אישי
                                <ArrowLeftIcon size={24} weight="bold" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};