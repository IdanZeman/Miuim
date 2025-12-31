import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/services/supabaseClient';
import { useAuth } from '@/features/auth/AuthContext';
import { Person, Team, Role } from '@/types';
import { getPersonInitials } from '@/utils/nameUtils';
import { Trophy, Users, RefreshCw, Shuffle, Dices, Check, Settings2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { PageInfo } from '@/components/ui/PageInfo';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface LotteryProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    shifts?: import('@/types').Shift[]; // NEW
    absences?: import('@/types').Absence[]; // NEW
    tasks?: import('@/types').TaskTemplate[]; // NEW
}

type PoolType = 'all' | 'team' | 'role' | 'manual';

const WheelView = ({ sizeClass, rotation, isSpinning, candidates, wheelColors }: { sizeClass: string, rotation: number, isSpinning: boolean, candidates: Person[], wheelColors: string[] }) => (
    <div className="relative">
        {/* Pointer */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 text-slate-800 filter drop-shadow-lg" aria-hidden="true">
            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-red-500"></div>
        </div>

        {/* The Wheel */}
        <div
            className={`${sizeClass} rounded-full border-8 border-white shadow-2xl relative transition-transform`}
            style={{
                transform: `rotate(${rotation}deg)`,
                transitionDuration: isSpinning ? '8s' : '0s',
                transitionTimingFunction: 'cubic-bezier(0.1, 0.7, 0.1, 1)',
                background: `conic-gradient(
                        ${candidates.map((_, i) => {
                    const start = (i / candidates.length) * 100;
                    const end = ((i + 1) / candidates.length) * 100;
                    const color = wheelColors[i % wheelColors.length];
                    return `${color} ${start}% ${end}%`;
                }).join(', ')}
                    )`
            }}
        >
            {/* Wheel Segments Text */}
            {candidates.map((p, i) => {
                const angle = (360 / candidates.length) * i + (360 / candidates.length) / 2;
                // Dynamic font size logic via Tailwind classes
                const baseSize = candidates.length > 50 ? 'text-[8px] md:text-[9px]' : candidates.length > 20 ? 'text-[10px] md:text-[11px]' : 'text-[12px] md:text-[14px]';

                return (
                    <div
                        key={p.id}
                        className="absolute top-0 left-1/2 h-1/2 w-0 -translate-x-1/2 origin-bottom flex flex-col justify-start items-center pt-6 md:pt-8 z-10 pointer-events-none"
                        style={{
                            transform: `rotate(${angle}deg)`,
                        }}
                    >
                        <span
                            className={`text-white font-bold truncate max-h-[70%] drop-shadow-md whitespace-nowrap px-1 ${baseSize}`}
                            style={{
                                writingMode: 'vertical-rl',
                                textOrientation: 'mixed',
                                transform: 'rotate(180deg)',
                                fontFamily: 'sans-serif'
                            }}
                        >
                            {p.name}
                        </span>
                    </div>
                );
            })}
        </div>

        {/* Center Hub */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-xl flex items-center justify-center z-10">
            <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center text-white">
                <Dices size={20} />
            </div>
        </div>
    </div >
);

export const Lottery: React.FC<LotteryProps> = ({ people, teams, roles, shifts = [], absences = [], tasks = [] }) => {
    const { organization } = useAuth();

    // History State
    const [history, setHistory] = useState<any[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Core State
    const [mode, setMode] = useState<'single' | 'multiple'>('single');
    const [filterType, setFilterType] = useState<PoolType>('all');
    const [activeFilterId, setActiveFilterId] = useState<string>('');
    const [participatingIds, setParticipatingIds] = useState<Set<string>>(new Set(people.map(p => p.id)));

    // Animation State
    const [rotation, setRotation] = useState(0);
    const [isSpinning, setIsSpinning] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    // NEW: Availability Filter
    const [onlyAvailable, setOnlyAvailable] = useState(false);

    // Helper: Check Availability
    const isPersonAvailableNow = (personId: string) => {
        const now = new Date();
        const dateKey = now.toLocaleDateString('en-CA');
        const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        // 1. Check Absences
        const isAbsent = absences.some(a =>
            a.person_id === personId &&
            a.status === 'approved' &&
            a.start_date <= dateKey &&
            a.end_date >= dateKey
        );
        if (isAbsent) return false;

        // 2. Check Active Shifts (Currently on task)
        // Shift.startTime and Shift.endTime are ISO strings (e.g. 2023-10-27T08:00:00.000Z)
        const nowIso = now.toISOString();

        const activeShift = shifts.find(s =>
            s.assignedPersonIds.includes(personId) &&
            s.startTime <= nowIso &&
            s.endTime >= nowIso
        );
        if (activeShift) return false;

        return true;
    };

    // Multiple Winners State
    const [numberOfWinners, setNumberOfWinners] = useState(1);
    const [winners, setWinners] = useState<Person[]>([]);
    const [displayCandidate, setDisplayCandidate] = useState<Person | null>(null);

    // Advanced Filter UI State
    const [isEditMode, setIsEditMode] = useState(false);
    const [filterSearch, setFilterSearch] = useState('');

    // Update participants when filters change
    useEffect(() => {
        let ids: string[] = [];
        if (filterType === 'all') {
            ids = people.map(p => p.id);
        } else if (filterType === 'team' && activeFilterId) {
            ids = people.filter(p => p.teamId === activeFilterId).map(p => p.id);
        } else if (filterType === 'role' && activeFilterId) {
            // Check both singular and plural role assignments
            ids = people.filter(p => p.roleId === activeFilterId || (p.roleIds && p.roleIds.includes(activeFilterId))).map(p => p.id);
        } else if (filterType === 'manual') {
            // Keep existing selection or start empty? Let's keep current if moving to manual, or reset?
            // User experience: if I switch to manual, I usually want to tweak what I had.
            // But if I switch FROM manual to All, it resets.
            // Just keep current participatingIds if switching TO manual.
            if (participatingIds.size === 0) ids = people.map(p => p.id); // Default to all if empty
            else return; // Don't reset
        }

        if (filterType !== 'manual') {
            // Filter inactive
            let finalIds = people.filter(p => p.isActive !== false && ids.includes(p.id)).map(p => p.id);

            // Filter availability if toggled
            if (onlyAvailable) {
                finalIds = finalIds.filter(id => isPersonAvailableNow(id));
            }

            setParticipatingIds(new Set(finalIds));
        }
    }, [filterType, activeFilterId, people, onlyAvailable, shifts, absences]); // Depend on onlyAvailable

    const candidates = people.filter(p => participatingIds.has(p.id));

    const handleFilterChange = (type: PoolType, id: string = '') => {
        setFilterType(type);
        if (id) setActiveFilterId(id);
        else setActiveFilterId('');
    };

    const togglePerson = (id: string) => {
        setParticipatingIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setParticipatingIds(new Set(people.map(p => p.id)));
    const clearAll = () => setParticipatingIds(new Set());

    // Fetch History
    useEffect(() => {
        if (!organization?.id) return;

        const fetchHistory = async () => {
            const { data } = await supabase
                .from('lottery_history')
                .select('*')
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false })
                .limit(20);
            if (data) setHistory(data);
        };
        fetchHistory();
    }, [organization?.id]);

    const saveToHistory = async (winners: Person[]) => {
        if (!organization?.id) {
            console.error("No organization ID found");
            return;
        }

        const entry = {
            winners: winners.map(w => ({ id: w.id, name: w.name, color: w.color })),
            mode,
            context: filterType === 'team' ? 'הגרלה צוותית' : filterType === 'role' ? 'הגרלת תפקיד' : 'הגרלה כללית',
            organization_id: organization.id
        };

        // Optimistic update
        setHistory(prev => [{ ...entry, created_at: new Date().toISOString() }, ...prev]);

        const { error } = await supabase.from('lottery_history').insert([entry]);
        if (error) {
            console.error("Error saving lottery history:", error);
        }
    };



    const handleSpin = () => {
        if (candidates.length === 0 || isSpinning) return;

        setIsSpinning(true);
        setWinners([]);
        setShowConfetti(false);

        if (mode === 'single') {
            const spinDuration = 8000;
            const winnerIndex = Math.floor(Math.random() * candidates.length);
            const winner = candidates[winnerIndex];
            const segmentSize = 360 / candidates.length;
            const winnerAngle = (winnerIndex * segmentSize) + (segmentSize / 2);
            const jitter = (Math.random() - 0.5) * (segmentSize * 0.8);
            let targetRotation = (360 - winnerAngle + jitter) % 360;
            if (targetRotation < 0) targetRotation += 360;
            const currentRotationMod = rotation % 360;
            let rotationDiff = targetRotation - currentRotationMod;
            if (rotationDiff < 0) rotationDiff += 360;
            const randomSpins = 8 + Math.floor(Math.random() * 5);
            const totalRotation = rotation + (randomSpins * 360) + rotationDiff;

            setRotation(totalRotation);

            setTimeout(() => {
                setIsSpinning(false);
                setWinners([winner]);
                setShowConfetti(true);
                saveToHistory([winner]); // SAVE
            }, spinDuration);
        } else {
            let remainingCandidates = [...candidates];
            let winnersList: Person[] = [];
            let count = 0;

            const drawNextWinner = () => {
                if (count >= numberOfWinners || remainingCandidates.length === 0) {
                    setIsSpinning(false);
                    setShowConfetti(true);
                    setDisplayCandidate(null);
                    saveToHistory(winnersList); // SAVE
                    return;
                }

                let shuffleInterval: NodeJS.Timeout;
                let shuffleCount = 0;
                const maxShuffles = 30;

                shuffleInterval = setInterval(() => {
                    const randomIdx = Math.floor(Math.random() * remainingCandidates.length);
                    setDisplayCandidate(remainingCandidates[randomIdx]);
                    shuffleCount++;

                    if (shuffleCount >= maxShuffles) {
                        clearInterval(shuffleInterval);
                        const winnerIndex = Math.floor(Math.random() * remainingCandidates.length);
                        const winner = remainingCandidates[winnerIndex];
                        setDisplayCandidate(winner);
                        remainingCandidates.splice(winnerIndex, 1);
                        setTimeout(() => {
                            winnersList.push(winner);
                            setWinners([...winnersList]);
                            count++;
                            setTimeout(drawNextWinner, 1000);
                        }, 1000);
                    }
                }, 80);
            };
            drawNextWinner();
        }
    };

    // Wheel Colors
    const wheelColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

    // State for Mobile Settings
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Filter Logic remains the same... (implicit in the component context)

    // Config Panel Content (Reusable)
    const ConfigPanelContent = () => (
        <div className="space-y-4">
            {/* Mode Selection */}
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setMode('single')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${mode === 'single' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    גלגל מזל
                </button>
                <button
                    onClick={() => setMode('multiple')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${mode === 'multiple' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    הגרלה קבוצתית
                </button>
            </div>

            <label className="block text-sm font-bold text-slate-700">מי משתתף?</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
                {(['all', 'team', 'role', 'manual'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => handleFilterChange(type)}
                        className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${filterType === type ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {type === 'all' && 'כולם'}
                        {type === 'team' && 'צוות'}
                        {type === 'role' && 'תפקיד'}
                        {type === 'manual' && 'ידני'}
                    </button>
                ))}
            </div>



            {filterType === 'team' && (
                <Select
                    value={activeFilterId}
                    onChange={(val) => handleFilterChange('team', val)}
                    options={teams.map(t => ({ value: t.id, label: t.name }))}
                    placeholder="בחר צוות..."
                />
            )}

            {filterType === 'role' && (
                <Select
                    value={activeFilterId}
                    onChange={(val) => handleFilterChange('role', val)}
                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                    placeholder="בחר תפקיד..."
                />
            )}

            {/* NEW: Availability Toggle */}
            <div className="flex items-center justify-between bg-slate-100 p-2 rounded-lg">
                <span className="text-xs font-bold text-slate-700">זמינים בבסיס בלבד (לא במשימה/בית)</span>
                <div
                    onClick={() => setOnlyAvailable(!onlyAvailable)}
                    className={`w-10 h-5 rounded-full flex items-center p-1 cursor-pointer transition-colors ${onlyAvailable ? 'bg-blue-600' : 'bg-slate-300'}`}
                >
                    <div className={`w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform ${onlyAvailable ? '-translate-x-5' : 'translate-x-0'}`} />
                </div>
            </div>

            <div className="bg-blue-50/50 rounded-lg p-3 flex items-center justify-between border border-blue-100">
                <span className="text-xs text-blue-800 font-medium">משתתפים: {participatingIds.size}</span>
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="text-xs flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors"
                >
                    <Settings2 size={12} />
                    {isEditMode ? 'סגור' : 'ערוך'}
                </button>
            </div>

            {isEditMode && (
                <div className="flex flex-col border border-slate-200 rounded-xl bg-white animate-fade-in max-h-[200px]">
                    <div className="p-2 border-b border-slate-100">
                        <input
                            type="text"
                            placeholder="חפש..."
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                            className="w-full text-xs px-2 py-1.5 rounded bg-slate-50 border-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
                        {people
                            .filter(p => !filterSearch || p.name.includes(filterSearch))
                            .map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => togglePerson(p.id)}
                                    className={`flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors text-xs ${participatingIds.has(p.id) ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}`}
                                >
                                    <div className={`w-3 h-3 rounded border flex items-center justify-center ${participatingIds.has(p.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                        {participatingIds.has(p.id) && <Check size={8} className="text-white" />}
                                    </div>
                                    <span className={participatingIds.has(p.id) ? 'font-medium text-slate-800' : 'text-slate-500'}>{p.name}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {mode === 'multiple' && (
                <div className="mt-6">
                    <label className="block text-sm font-bold text-slate-700 mb-2">כמה זוכים?</label>
                    <input
                        type="number"
                        min="1"
                        max={candidates.length}
                        value={numberOfWinners}
                        onChange={(e) => setNumberOfWinners(Math.min(candidates.length, Math.max(1, Number(e.target.value))))}
                        className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-center font-bold text-lg"
                    />
                </div>
            )}
        </div>
    )

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-150px)] md:h-[calc(100vh-100px)] relative overflow-hidden" dir="rtl">

            {/* Global Sound Toggle (Visible on both) */}
            {/* Global Sound Toggle Removed */}

            {/* ================= MOBILE VIEW (md:hidden) ================= */}
            <div className="md:hidden flex flex-col h-full overflow-y-auto">
                {/* 1. Header Area */}
                <div className="bg-white text-slate-900 p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-black mb-0.5 flex items-center gap-2">
                            הגרלה
                            <PageInfo
                                title="הגרלה"
                                description={
                                    <>
                                        <p className="mb-2">כלי להגרלת משימות, תורנויות או סתם בשביל הכיף.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>גלגל מזל:</b> בחירת זוכה יחיד בצורה ויזואלית ומהנה.</li>
                                            <li><b>הגרלה קבוצתית:</b> בחירת מספר זוכים במקביל (למשל: 3 תורנים למטבח).</li>
                                            <li><b>סינון:</b> ניתן להגריל מתוך כל הארגון, צוות מסוים, או תפקיד ספציפי.</li>
                                        </ul>
                                    </>
                                }
                            />
                        </h1>
                        <p className="text-slate-500 text-xs font-bold">סובב את הגלגל וגלה מי הזוכה!</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsSettingsOpen(true)}
                            className={`p-3 rounded-xl border bg-slate-50 border-slate-200 text-slate-500 hover:text-indigo-600 transition-all`}
                        >
                            <Settings2 size={20} aria-hidden="true" />
                        </button>
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`p-3 rounded-xl border transition-all ${showHistory ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                        >
                            <Trophy size={20} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-4 flex flex-col">
                    {showHistory ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">זוכים אחרונים</h3>
                            <div className="space-y-3">
                                {history.length === 0 && <p className="text-xs text-slate-400 italic text-center py-8">טרם בוצעו הגרלות</p>}
                                {history.map((h: any, idx: number) => (
                                    <div key={h.id || idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-sm font-bold">
                                                {h.winners[0]?.name ? getPersonInitials(h.winners[0].name) : '?'}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-sm">{h.winners.map((w: any) => w.name).join(', ')}</p>
                                                <p className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                            </div>
                                        </div>
                                        <Trophy size={16} className="text-yellow-400" />
                                    </div>
                                ))}
                            </div>
                            <Button variant="secondary" onClick={() => setShowHistory(false)} className="w-full">חזרה להגרלה</Button>
                        </div>
                    ) : (
                        <>

                            {/* Wheel Section */}
                            <div className="flex justify-center mb-6">
                                {mode === 'single' && candidates.length > 0 ? (
                                    <WheelView sizeClass="w-64 h-64 sm:w-72 sm:h-72" rotation={rotation} isSpinning={isSpinning} candidates={candidates} wheelColors={wheelColors} />
                                ) : mode === 'multiple' ? (
                                    <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-slate-400 font-bold text-center p-4">
                                        {isSpinning ? (
                                            <div className="animate-pulse text-indigo-500 font-bold text-xl" role="status" aria-live="polite">
                                                ...מגריל...
                                            </div>
                                        ) : (
                                            'הגרלה קבוצתית'
                                        )}
                                    </div>
                                ) : (
                                    <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-dashed border-slate-200 flex items-center justify-center text-slate-400 font-bold">
                                        אין משתתפים
                                    </div>
                                )}
                            </div>

                            {/* Winner / Status Display */}
                            <div className="text-center mb-6 min-h-[4rem]">
                                {winners.length > 0 && !isSpinning ? (
                                    <div className="animate-bounce-in" role="alert" aria-live="assertive">
                                        <p className="text-sm font-bold text-slate-400 mb-1">הזוכה הוא:</p>
                                        <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                                            {winners[0].name}
                                        </h2>
                                    </div>
                                ) : isSpinning ? (
                                    <div className="animate-pulse text-indigo-500 font-bold text-xl" role="status">
                                        ...מגריל...
                                    </div>
                                ) : (
                                    <p className="text-slate-400 font-medium">לחץ על הכפתור כדי להתחיל</p>
                                )}
                            </div>

                            {/* Primary Action Button */}
                            <button
                                onClick={handleSpin}
                                disabled={candidates.length === 0 || isSpinning}
                                className={`w-full py-4 rounded-2xl font-black text-xl shadow-xl transform transition-all active:scale-95 flex items-center justify-center gap-3 mb-6
                            ${candidates.length === 0 || isSpinning
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 shadow-yellow-500/30'
                                    }`}
                            >
                                {isSpinning ? <RefreshCw className="animate-spin" size={24} /> : <Dices size={24} />}
                                {isSpinning ? 'מסתובב...' : 'סובב את הגלגל!'}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile Settings Modal */}
            <Modal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                            <Settings2 size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-slate-800">הגדרות הגרלה</h3>
                            <p className="text-sm font-bold text-slate-400">ניהול משתתפים ואפשרויות</p>
                        </div>
                    </div>
                }
                footer={
                    <div className="w-full">
                        <Button
                            onClick={() => setIsSettingsOpen(false)}
                            className="w-full h-12 text-lg font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
                        >
                            שמור וסגור
                        </Button>
                    </div>
                }
                className="md:hidden"
            >
                <div className="space-y-6 pt-2">
                    {ConfigPanelContent()}
                </div>
            </Modal>


            {/* ================= DESKTOP VIEW (hidden md:flex) ================= */}
            <div className="hidden md:flex h-full p-0 flex-1 overflow-hidden">
                {/* LEFT: Hero Wheel Area */}
                <div className="flex-1 bg-gradient-to-br from-indigo-600 to-purple-700 relative overflow-hidden flex flex-col items-center justify-center p-4 lg:p-12 gap-8">
                    {/* Pattern Background */}
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>

                    {/* Relative Title (No Overlap) */}

                    <div className="relative z-10 transform transition-transform shrink-0">
                        {mode === 'single' && candidates.length > 0 ? (
                            <WheelView sizeClass="w-[280px] h-[280px] lg:w-[350px] lg:h-[350px] xl:w-[450px] xl:h-[450px]" rotation={rotation} isSpinning={isSpinning} candidates={candidates} wheelColors={wheelColors} />
                        ) : mode === 'multiple' ? (
                            <div className="w-[280px] h-[280px] lg:w-[350px] lg:h-[350px] xl:w-[450px] xl:h-[450px] rounded-full border-4 border-dashed border-white/30 flex items-center justify-center text-white/50 font-bold text-xl text-center p-8">
                                {isSpinning ? (
                                    <div className="animate-pulse text-white font-bold text-3xl" role="status" aria-live="polite">
                                        ...מגריל...
                                    </div>
                                ) : (
                                    'הגרלה קבוצתית'
                                )}
                            </div>
                        ) : (
                            <div className="w-[280px] h-[280px] lg:w-[350px] lg:h-[350px] xl:w-[450px] xl:h-[450px] rounded-full border-4 border-dashed border-white/30 flex items-center justify-center text-white/50 font-bold text-xl">
                                נא לבחור משתתפים
                            </div>
                        )}
                    </div>

                    {/* Winner Display Desktop */}
                    {winners.length > 0 && !isSpinning && (
                        <div className="absolute bottom-6 lg:bottom-12 z-50 bg-white/10 backdrop-blur-lg border border-white/20 px-8 lg:px-12 py-4 lg:py-6 rounded-2xl text-center animate-bounce-in shadow-xl max-w-[90%]" role="alert" aria-live="assertive">
                            <p className="text-indigo-200 font-bold mb-2 uppercase tracking-widest text-xs lg:text-sm">המנצח הוא</p>
                            <h2 className="text-3xl lg:text-5xl font-black text-white drop-shadow-lg truncate">{winners[0].name}</h2>
                        </div>
                    )}
                </div>

                {/* RIGHT: Controls & History */}
                <div className="w-[320px] lg:w-[400px] bg-white flex flex-col overflow-hidden border-r border-slate-100 shrink-0 transition-all">
                    <div className="p-4 lg:p-6 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-lg lg:text-xl font-bold text-slate-800 flex items-center gap-2 mb-4 lg:mb-6">
                            <Settings2 className="text-indigo-600" />
                            לוח בקרה
                            <PageInfo
                                title="הגרלה"
                                description={
                                    <>
                                        <p className="mb-2">כלי להגרלת משימות, תורנויות או סתם בשביל הכיף.</p>
                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                            <li><b>גלגל מזל:</b> בחירת זוכה יחיד בצורה ויזואלית ומהנה.</li>
                                            <li><b>הגרלה קבוצתית:</b> בחירת מספר זוכים במקביל (למשל: 3 תורנים למטבח).</li>
                                            <li><b>סינון:</b> ניתן להגריל מתוך כל הארגון, צוות מסוים, או תפקיד ספציפי.</li>
                                        </ul>
                                    </>
                                }
                            />
                        </h2>
                        {ConfigPanelContent()}
                    </div>

                    <div className="p-4 lg:p-6">
                        <button
                            onClick={handleSpin}
                            disabled={candidates.length === 0 || isSpinning}
                            className={`w-full py-4 lg:py-5 rounded-2xl font-black text-xl lg:text-2xl shadow-xl transform transition-all active:scale-95 flex items-center justify-center gap-3
                                ${candidates.length === 0 || isSpinning
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-indigo-500/30 hover:-translate-y-1'
                                }`}
                        >
                            {isSpinning ? <RefreshCw className="animate-spin" size={24} /> : <Dices size={24} />}
                            {isSpinning ? 'מגריל...' : 'סובב עכשיו!'}
                        </button>
                    </div>

                    {/* Recent Winners List */}
                    <div className="flex-1 overflow-y-auto px-4 lg:px-6 pb-6 bg-slate-50/30">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 mt-2">זוכים אחרונים</h3>
                        <div className="space-y-3">
                            {history.length === 0 && <p className="text-xs text-slate-400 italic">טרם בוצעו הגרלות</p>}
                            {history.slice(0, 5).map((h: any, idx: number) => (
                                <div key={h.id || idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center text-xs font-bold">
                                            {h.winners[0]?.name ? getPersonInitials(h.winners[0].name) : '?'}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-800 text-sm">{h.winners.map((w: any) => w.name).join(', ')}</p>
                                            <p className="text-[10px] text-slate-400">{new Date(h.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <Trophy size={14} className="text-yellow-400" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Confetti Overlay (Global) */}
            {showConfetti && (
                <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
                    {[...Array(50)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-2 h-2 rounded-full animate-confetti"
                            style={{
                                left: `${Math.random() * 100}%`,
                                top: `-10px`,
                                backgroundColor: wheelColors[Math.floor(Math.random() * wheelColors.length)],
                                animationDuration: `${1 + Math.random() * 2}s`,
                                animationDelay: `${Math.random() * 0.5}s`
                            }}
                        />
                    ))}
                </div>
            )}

            <style>{`
                @keyframes confetti {
                    0% { transform: translateY(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
                }
                .animate-confetti {
                    animation: confetti 2s ease-out forwards;
                }
                @keyframes pop-in {
                    0% { transform: scale(0.5); opacity: 0; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-pop-in {
                    animation: pop-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                @keyframes bounce-in {
                    0% { transform: scale(0.8); opacity: 0; }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); opacity: 1; }
                }
                .animate-bounce-in {
                    animation: bounce-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                @keyframes fade-in {
                    0% { opacity: 0; }
                    100% { opacity: 1; }
                }
                .animate-fade-in {
                    animation: fade-in 0.3s ease-out forwards;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}</style>
        </div>
    );
};
