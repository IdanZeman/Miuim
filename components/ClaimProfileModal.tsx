import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { Person } from '../types';
import { User, Search, CheckCircle, AlertCircle, X, Loader2, UserCircle2 } from 'lucide-react';
import { mapPersonFromDB } from '../services/supabaseClient';

interface ClaimProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ClaimProfileModal: React.FC<ClaimProfileModalProps> = ({ isOpen, onClose }) => {
    const { user, profile, refreshProfile } = useAuth();
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
    const [claiming, setClaiming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchUnlinkedPeople();
            requestAnimationFrame(() => setIsVisible(true));
        } else {
            setIsVisible(false);
        }
    }, [isOpen, profile?.organization_id]);

    const fetchUnlinkedPeople = async () => {
        if (!profile?.organization_id) return;
        setLoading(true);
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

            await supabase
                .from('profiles')
                .update({ full_name: selectedPerson.name })
                .eq('id', user.id);

            localStorage.removeItem('miuim_skip_linking');
            await refreshProfile();
            onClose();
            window.location.reload();
        } catch (err: any) {
            console.error('Error claiming profile:', err);
            setError(err.message || 'שגיאה בחיבור לפרופיל');
        } finally {
            setClaiming(false);
        }
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen) return null;

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return createPortal(
        <div
            className={`fixed inset-0 z-[9999] flex flex-col justify-end md:justify-center md:items-center transition-all duration-300 ${isVisible ? 'bg-slate-900/60 backdrop-blur-sm' : 'bg-transparent'}`}
            onClick={handleBackdropClick}
        >
            <div
                className={`bg-white w-full md:max-w-xl rounded-t-[2.5rem] md:rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] transform transition-all duration-500 ease-out border-t md:border border-slate-200/60 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Mobile Drag Handle */}
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0 md:hidden" />

                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50 md:rounded-t-[2rem]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200/50">
                            <UserCircle2 size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900">מי אתה ברשימה?</h2>
                            <p className="text-slate-500 text-sm font-medium">בחר את השם שלך לסנכרון הפרופיל</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 md:p-8 overflow-y-auto flex-1 space-y-6">
                    <div className="relative group">
                        <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 transition-transform group-focus-within:scale-110" size={20} />
                        <input
                            type="text"
                            placeholder="חפש את השם שלך..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pr-14 pl-6 py-4 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white focus:outline-none text-slate-900 text-lg transition-all font-bold placeholder:font-normal placeholder:text-slate-300 shadow-inner"
                            autoFocus
                        />
                    </div>

                    <div className="border-2 border-slate-100 rounded-2xl bg-white overflow-hidden min-h-[300px] flex flex-col transition-all">
                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4 p-12">
                                <div className="w-12 h-12 border-4 border-slate-100 border-t-emerald-600 rounded-full animate-spin" />
                                <span className="font-bold text-slate-500">טוען רשימת לוחמים...</span>
                            </div>
                        ) : filteredPeople.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center gap-4">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                                    <Search size={32} />
                                </div>
                                <p className="font-bold text-slate-500">{searchTerm ? 'לא נמצאו תוצאות' : 'אין לוחמים זמינים'}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
                                {filteredPeople.map(person => (
                                    <button
                                        key={person.id}
                                        onClick={() => setSelectedPerson(person)}
                                        className={`w-full p-5 text-right flex items-center justify-between hover:bg-emerald-50 transition-all duration-200 group ${selectedPerson?.id === person.id ? 'bg-emerald-50 ring-inset ring-2 ring-emerald-500' : ''}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black transition-all ${selectedPerson?.id === person.id ? 'bg-emerald-500 scale-110 shadow-lg shadow-emerald-500/20' : 'bg-slate-300 group-hover:bg-emerald-400'}`}>
                                                {person.name.charAt(0)}
                                            </div>
                                            <span className={`text-xl transition-colors ${selectedPerson?.id === person.id ? 'text-emerald-900 font-black' : 'text-slate-700 font-bold group-hover:text-emerald-800'}`}>
                                                {person.name}
                                            </span>
                                        </div>
                                        {selectedPerson?.id === person.id && (
                                            <CheckCircle size={28} className="text-emerald-600 animate-in zoom-in duration-300" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 md:p-8 pb-10 md:pb-8 bg-slate-50 border-t border-slate-100 shrink-0">
                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-200">
                            <AlertCircle size={20} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleClaim}
                        disabled={!selectedPerson || claiming}
                        className="w-full h-16 md:h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-600/20 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-4 text-xl"
                    >
                        {claiming ? (
                            <Loader2 className="animate-spin" size={24} />
                        ) : (
                            <>
                                <CheckCircle size={28} />
                                <span>אשר והתחבר</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
