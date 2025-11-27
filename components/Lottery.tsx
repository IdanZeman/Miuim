import React, { useState, useEffect, useRef } from 'react';
import { Person, Team, Role } from '../types';
import { getPersonInitials } from '../utils/nameUtils';
import { Trophy, Users, RefreshCw, Sparkles, Shuffle, Dices } from 'lucide-react';

interface LotteryProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
}

type PoolType = 'all' | 'team' | 'role' | 'custom';

export const Lottery: React.FC<LotteryProps> = ({ people, teams, roles }) => {
    const [mode, setMode] = useState<'single' | 'multiple'>('single');
    const [poolType, setPoolType] = useState<PoolType>('all');
    const [selectedPoolId, setSelectedPoolId] = useState<string>('');
    const [customSelection, setCustomSelection] = useState<string[]>([]);
    const [numberOfWinners, setNumberOfWinners] = useState(1);

    const [candidates, setCandidates] = useState<Person[]>([]);
    const [winners, setWinners] = useState<Person[]>([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [rotation, setRotation] = useState(0);
    const [showConfetti, setShowConfetti] = useState(false);

    // Animation states for Multiple Mode (Digital Shuffle)
    const [displayCandidate, setDisplayCandidate] = useState<Person | null>(null);

    // Update candidates when configuration changes
    useEffect(() => {
        let nextCandidates: Person[] = [];

        switch (poolType) {
            case 'all':
                nextCandidates = people;
                break;
            case 'team':
                nextCandidates = people.filter(p => p.teamId === selectedPoolId);
                break;
            case 'role':
                nextCandidates = people.filter(p => p.roleIds.includes(selectedPoolId));
                break;
            case 'custom':
                nextCandidates = people.filter(p => customSelection.includes(p.id));
                break;
        }

        setCandidates(nextCandidates);
        setDisplayCandidate(null);
        setWinners([]);
        setShowConfetti(false);
        setRotation(0);
    }, [poolType, selectedPoolId, customSelection, people]);

    const handleSpin = () => {
        if (candidates.length === 0 || isSpinning) return;

        setIsSpinning(true);
        setWinners([]);
        setShowConfetti(false);

        if (mode === 'single') {
            // Wheel Logic
            const spinDuration = 5000; // 5 seconds
            const randomSpins = 5 + Math.random() * 5; // 5-10 full rotations
            const randomDegree = Math.floor(Math.random() * 360);
            const totalRotation = rotation + (randomSpins * 360) + randomDegree;

            setRotation(totalRotation);

            setTimeout(() => {
                setIsSpinning(false);
                const winnerIndex = Math.floor(Math.random() * candidates.length);
                const winner = candidates[winnerIndex];
                setWinners([winner]);
                setShowConfetti(true);
            }, spinDuration);
        } else {
            // Multiple Winners Logic (Digital Shuffle)
            let remainingCandidates = [...candidates];
            let winnersList: Person[] = [];
            let count = 0;

            const drawNextWinner = () => {
                if (count >= numberOfWinners || remainingCandidates.length === 0) {
                    setIsSpinning(false);
                    setShowConfetti(true);
                    setDisplayCandidate(null);
                    return;
                }

                // Rapid Shuffle Effect
                let shuffleInterval: NodeJS.Timeout;
                let shuffleCount = 0;
                const maxShuffles = 30; // Number of rapid changes before stopping

                shuffleInterval = setInterval(() => {
                    const randomIdx = Math.floor(Math.random() * remainingCandidates.length);
                    setDisplayCandidate(remainingCandidates[randomIdx]);
                    shuffleCount++;

                    if (shuffleCount >= maxShuffles) {
                        clearInterval(shuffleInterval);

                        // Pick actual winner
                        const winnerIndex = Math.floor(Math.random() * remainingCandidates.length);
                        const winner = remainingCandidates[winnerIndex];

                        // Show winner
                        setDisplayCandidate(winner);

                        // Remove from pool
                        remainingCandidates.splice(winnerIndex, 1);

                        // Add to winners list after a "lock-in" pause
                        setTimeout(() => {
                            winnersList.push(winner);
                            setWinners([...winnersList]);
                            count++;

                            // Schedule next draw
                            setTimeout(drawNextWinner, 1000);
                        }, 1000);
                    }
                }, 80); // Speed of shuffle (80ms)
            };

            // Start the draw loop
            drawNextWinner();
        }
    };

    const [searchTerm, setSearchTerm] = useState('');

    // Helper to toggle person in custom selection
    const togglePerson = (id: string) => {
        setCustomSelection(prev =>
            prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
        );
    };

    // Wheel Colors
    const wheelColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

    return (
        <div className="h-full flex flex-col md:flex-row gap-6 p-4 md:p-6 overflow-hidden">
            {/* Configuration Panel */}
            <div className="w-full md:w-1/3 bg-white rounded-2xl shadow-lg p-6 flex flex-col gap-6 overflow-y-auto z-20">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Dices className="text-idf-yellow" />
                        הגדרות הגרלה
                    </h2>

                    {/* Mode Selection */}
                    <div className="flex bg-slate-100 p-1 rounded-lg mb-6">
                        <button
                            onClick={() => setMode('single')}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${mode === 'single' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            זוכים בודדים (גלגל)
                        </button>
                        <button
                            onClick={() => setMode('multiple')}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${mode === 'multiple' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            הגרלה קבוצתית
                        </button>
                    </div>

                    {/* Pool Type */}
                    <div className="space-y-4">
                        <label className="block text-sm font-bold text-slate-700">מתוך מי בוחרים?</label>
                        <select
                            value={poolType}
                            onChange={(e) => {
                                setPoolType(e.target.value as PoolType);
                                setSelectedPoolId('');
                                setCustomSelection([]);
                                setSearchTerm('');
                            }}
                            className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">כל היחידה ({people.length})</option>
                            <option value="team">צוות מסוים</option>
                            <option value="role">תפקיד מסוים</option>
                            <option value="custom">בחירה ידנית</option>
                        </select>

                        {poolType === 'team' && (
                            <select
                                value={selectedPoolId}
                                onChange={(e) => setSelectedPoolId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50"
                            >
                                <option value="">בחר צוות...</option>
                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        )}

                        {poolType === 'role' && (
                            <select
                                value={selectedPoolId}
                                onChange={(e) => setSelectedPoolId(e.target.value)}
                                className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50"
                            >
                                <option value="">בחר תפקיד...</option>
                                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        )}

                        {poolType === 'custom' && (
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="חפש שם..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                                />
                                <div className="border border-slate-200 rounded-xl p-2 max-h-48 overflow-y-auto bg-slate-50">
                                    {people
                                        .filter(p => p.name.includes(searchTerm))
                                        .map(p => (
                                            <div key={p.id} onClick={() => togglePerson(p.id)} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-white transition-colors ${customSelection.includes(p.id) ? 'bg-blue-50' : ''}`}>
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center ${customSelection.includes(p.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 bg-white'}`}>
                                                    {customSelection.includes(p.id) && <div className="w-2 h-2 bg-white rounded-sm" />}
                                                </div>
                                                <span className="text-sm text-slate-700">{p.name}</span>
                                            </div>
                                        ))}
                                </div>
                                <div className="text-xs text-slate-500 text-right">
                                    נבחרו: {customSelection.length}
                                </div>
                            </div>
                        )}
                    </div>

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

                <div className="mt-auto pt-6 border-t border-slate-100">
                    <div className="flex justify-between items-center mb-4 text-sm text-slate-500">
                        <span>משתתפים בהגרלה:</span>
                        <span className="font-bold text-slate-800">{candidates.length}</span>
                    </div>
                    <button
                        onClick={handleSpin}
                        disabled={candidates.length === 0 || isSpinning}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transform transition-all active:scale-95 flex items-center justify-center gap-2
                            ${candidates.length === 0 || isSpinning
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-idf-yellow to-yellow-400 text-slate-900 hover:shadow-xl hover:-translate-y-1'
                            }`}
                    >
                        {isSpinning ? <RefreshCw className="animate-spin" /> : <Sparkles />}
                        {isSpinning ? 'מגריל...' : 'התחל הגרלה!'}
                    </button>
                </div>
            </div>

            {/* Visual Stage */}
            <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-inner relative overflow-hidden flex flex-col items-center justify-center p-8 border border-slate-200">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]"></div>

                {/* Confetti Overlay */}
                {showConfetti && (
                    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
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

                {/* Single Mode: Wheel */}
                {mode === 'single' && candidates.length > 0 && (
                    <div className="relative">
                        {/* Pointer */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20 text-slate-800 filter drop-shadow-lg">
                            <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[30px] border-t-red-500"></div>
                        </div>

                        {/* The Wheel */}
                        <div
                            className="w-80 h-80 md:w-96 md:h-96 rounded-full border-8 border-white shadow-2xl relative transition-transform cubic-bezier(0.2, 0.8, 0.2, 1)"
                            style={{
                                transform: `rotate(${rotation}deg)`,
                                transitionDuration: isSpinning ? '5s' : '0s',
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
                                // Dynamic font size based on number of candidates
                                const fontSize = candidates.length > 50 ? '9px' : candidates.length > 20 ? '11px' : '13px';
                                return (
                                    <div
                                        key={p.id}
                                        className="absolute top-0 left-1/2 h-1/2 w-0 -translate-x-1/2 origin-bottom flex flex-col justify-start items-center pt-8 z-10 pointer-events-none"
                                        style={{
                                            transform: `rotate(${angle}deg)`,
                                        }}
                                    >
                                        <span
                                            className="text-white font-bold truncate max-h-[70%] drop-shadow-md whitespace-nowrap px-1"
                                            style={{
                                                writingMode: 'vertical-rl',
                                                fontSize: fontSize,
                                                textOrientation: 'mixed',
                                                transform: 'rotate(180deg)'
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
                                <Sparkles size={20} />
                            </div>
                        </div>
                    </div>
                )}

                {/* Multiple Mode: Digital Shuffle */}
                {mode === 'multiple' && (
                    <div className="w-full h-full flex flex-col items-center justify-between relative">
                        {/* The Display Screen */}
                        <div className="w-full max-w-2xl h-64 md:h-80 bg-slate-900 rounded-3xl border-8 border-slate-800 shadow-2xl relative overflow-hidden mb-8 flex items-center justify-center">
                            {/* Screen Glare */}
                            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

                            {/* Digital Text */}
                            {displayCandidate ? (
                                <div className="text-center animate-pulse">
                                    <div className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 filter drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]">
                                        {displayCandidate.name}
                                    </div>
                                    <div className="text-slate-400 mt-4 font-mono text-lg">
                                        {isSpinning ? '...מאתר זוכה...' : '!!!זוכה מאושר'}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-slate-600 font-mono text-xl animate-pulse">
                                    {isSpinning ? '...מערבל נתונים...' : 'מוכן להגרלה'}
                                </div>
                            )}
                        </div>

                        {/* Winners Basket */}
                        <div className="w-full max-w-4xl">
                            <h3 className="text-center text-slate-500 font-bold mb-4 flex items-center justify-center gap-2">
                                <Trophy size={18} className="text-yellow-500" />
                                הזוכים המאושרים
                            </h3>
                            <div className="flex flex-wrap justify-center gap-4 min-h-[120px]">
                                {winners.map((w, i) => (
                                    <div
                                        key={w.id}
                                        className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-lg border border-slate-100 animate-pop-in"
                                        style={{ animationDelay: `${i * 100}ms` }}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm ${w.color}`}>
                                            {getPersonInitials(w.name)}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-slate-800">{w.name}</div>
                                            <div className="text-xs text-slate-500">זוכה #{i + 1}</div>
                                        </div>
                                    </div>
                                ))}
                                {winners.length === 0 && !isSpinning && (
                                    <div className="text-slate-400 text-sm italic">
                                        הזוכים יופיעו כאן...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Winner Overlay for Single Mode */}
                {
                    mode === 'single' && winners.length > 0 && (
                        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-30 flex items-center justify-center animate-fade-in">
                            <div className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-2xl transform animate-bounce-in max-w-sm mx-4">
                                <div className="w-24 h-24 mx-auto bg-yellow-100 rounded-full flex items-center justify-center mb-6 text-yellow-600 animate-pulse">
                                    <Trophy size={48} />
                                </div>
                                <h2 className="text-3xl font-bold text-slate-800 mb-2">יש לנו זוכה!</h2>
                                <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
                                    {winners[0].name}
                                </div>
                                <button
                                    onClick={() => setWinners([])}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-full font-bold hover:bg-slate-800 transition-colors"
                                >
                                    סגור
                                </button>
                            </div>
                        </div>
                    )
                }
            </div>

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
            `}</style>
        </div>
    );
};
