import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from './AuthContext';
import { Person } from '../../types';
import { UserCircle as UserIcon, MagnifyingGlass as SearchIcon, CheckCircle as CheckCircleIcon, WarningCircle as AlertCircleIcon, CircleNotch as LoaderIcon } from '@phosphor-icons/react';
import { mapPersonFromDB } from '../../services/supabaseClient';
import { GenericModal } from '../../components/ui/GenericModal';

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

    useEffect(() => {
        if (isOpen) {
            fetchUnlinkedPeople();
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

    const filteredPeople = people.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const modalTitle = (
        <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-200/50">
                <UserIcon size={24} weight="bold" />
            </div>
            <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900">מי אתה ברשימה?</h2>
                <p className="text-slate-500 text-sm font-medium">בחר את השם שלך לסנכרון הפרופיל</p>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex flex-col w-full gap-4">
            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-200 w-full" dir="rtl">
                    <AlertCircleIcon size={20} className="shrink-0" weight="bold" />
                    {error}
                </div>
            )}
            <button
                onClick={handleClaim}
                disabled={!selectedPerson || claiming}
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-emerald-600/20 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 disabled:translate-y-0 flex items-center justify-center gap-4 text-xl"
            >
                {claiming ? (
                    <LoaderIcon className="animate-spin" size={24} />
                ) : (
                    <>
                        <CheckCircleIcon size={28} weight="bold" />
                        <span>אשר והתחבר</span>
                    </>
                )}
            </button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            footer={modalFooter}
            size="lg"
        >
            <div className="space-y-6" dir="rtl">
                <div className="relative group sticky top-0 z-10">
                    <SearchIcon className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500 transition-transform group-focus-within:scale-110" size={20} weight="bold" />
                    <input
                        type="text"
                        placeholder="חפש את השם שלך..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pr-14 pl-6 py-4 rounded-2xl bg-white border-2 border-slate-100 focus:border-emerald-500 focus:outline-none text-slate-900 text-lg transition-all font-bold placeholder:font-normal placeholder:text-slate-300 shadow-sm focus:shadow-md"
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
                                <SearchIcon size={32} weight="bold" />
                            </div>
                            <p className="font-bold text-slate-500">{searchTerm ? 'לא נמצאו תוצאות' : 'אין לוחמים זמינים'}</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px] custom-scrollbar">
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
                                        <CheckCircleIcon size={28} className="text-emerald-600 animate-in zoom-in duration-300" weight="bold" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};
