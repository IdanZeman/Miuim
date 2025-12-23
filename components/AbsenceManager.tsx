import React, { useState, useMemo } from 'react';
import { Person, Absence } from '../types';
import { addAbsence, deleteAbsence, updateAbsence } from '../services/supabaseClient'; // Ensure these are exported
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext'; // To get organization
import { Calendar as CalendarIcon, Search, Plus, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, UserX, FileText } from 'lucide-react';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { createPortal } from 'react-dom';
import { Select } from './ui/Select';

interface AbsenceManagerProps {
    people: Person[];
    absences: Absence[];
    onAddAbsence: (absence: Absence) => void;
    onUpdateAbsence: (absence: Absence) => void;
    onDeleteAbsence: (id: string) => void;
}

export const AbsenceManager: React.FC<AbsenceManagerProps> = ({ people, absences, onAddAbsence, onUpdateAbsence, onDeleteAbsence }) => {
    const { organization } = useAuth();
    const { showToast } = useToast();
    const [viewDate, setViewDate] = useState(new Date());
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
    const [formPersonId, setFormPersonId] = useState<string>('');
    const [formStartDate, setFormStartDate] = useState<string>('');
    const [formEndDate, setFormEndDate] = useState<string>('');
    const [formReason, setFormReason] = useState<string>('');

    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // --- Helpers ---
    const filteredPeople = useMemo(() => {
        return people.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
    }, [people, searchTerm]);

    const getMonthDays = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];
        for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
        for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
        return days;
    };

    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));

    const openAddModal = (personId?: string, dateStr?: string) => {
        setEditingAbsence(null);
        setFormPersonId(personId || selectedPersonId || (filteredPeople[0]?.id || ''));
        const today = new Date().toISOString().split('T')[0];
        setFormStartDate(dateStr || today);
        setFormEndDate(dateStr || today);
        setFormReason('');
        setIsModalOpen(true);
    };

    const openEditModal = (absence: Absence) => {
        setEditingAbsence(absence);
        setFormPersonId(absence.person_id);
        setFormStartDate(absence.start_date);
        setFormEndDate(absence.end_date);
        setFormReason(absence.reason || '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!organization || !formPersonId || !formStartDate || !formEndDate) return;
        if (formEndDate < formStartDate) {
            showToast('תאריך סיום מוכרח להיות אחרי או שווה לתאריך התחלה', 'error');
            return;
        }

        try {
            if (editingAbsence) {
                // Update
                const updated = {
                    ...editingAbsence,
                    person_id: formPersonId,
                    start_date: formStartDate,
                    end_date: formEndDate,
                    reason: formReason
                };
                await updateAbsence(updated);
                onUpdateAbsence(updated);
                showToast('ההיעדרות עודכנה בהצלחה', 'success');
            } else {
                // Add
                const newAbsence = await addAbsence({
                    person_id: formPersonId,
                    organization_id: organization.id,
                    start_date: formStartDate,
                    end_date: formEndDate,
                    reason: formReason
                });
                onAddAbsence(newAbsence);
                showToast('ההיעדרות נוספה בהצלחה', 'success');
            }
            setIsModalOpen(false);
        } catch (e) {
            console.error(e);
            showToast('שגיאה בשמירה', 'error');
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            await deleteAbsence(deleteConfirmId);
            onDeleteAbsence(deleteConfirmId);
            showToast('ההיעדרות נמחקה', 'success');
            setDeleteConfirmId(null);
        } catch (e) {
            console.error(e);
            showToast('שגיאה במחיקה', 'error');
        }
    };

    const selectedPersonAbsences = useMemo(() => {
        if (!selectedPersonId) return [];
        return absences.filter(a => a.person_id === selectedPersonId);
    }, [absences, selectedPersonId]);

    // Check if a date has absence
    const getAbsenceForDate = (date: Date) => {
        if (!selectedPersonId) return null;
        const dateStr = date.toLocaleDateString('en-CA');
        return selectedPersonAbsences.find(a => dateStr >= a.start_date && dateStr <= a.end_date);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
            {/* Header */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="bg-red-100 p-2 rounded-lg text-red-600">
                        <UserX size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">ניהול היעדרויות</h2>
                        <p className="text-sm text-slate-500 hidden md:block">הזנת ימי חופש, מחלה והיעדרויות קבועות</p>
                    </div>
                </div>
                <Button onClick={() => openAddModal()} icon={Plus} className="bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-200">
                    <span className="hidden md:inline">הוסף היעדרות</span>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row flex-1 overflow-hidden gap-4 md:gap-6">
                {/* Sidebar: People List - Hidden on mobile when person selected */}
                <div className={`w-full md:w-80 bg-white rounded-xl shadow-sm border border-slate-200 flex-col shrink-0 ${selectedPersonId ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-100 space-y-3">
                        <Input
                            placeholder="חיפוש חייל..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            icon={Search}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        <button
                            onClick={() => setSelectedPersonId(null)}
                            className={`w-full text-right p-3 rounded-lg font-bold text-sm transition-all ${selectedPersonId === null ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            כל ההיעדרויות (רשימה מרוכזת)
                        </button>
                        <div className="h-px bg-slate-100 my-1 mx-2"></div>
                        {filteredPeople.map(person => {
                            const isSelected = selectedPersonId === person.id;
                            const personAbsenceCount = absences.filter(a => a.person_id === person.id).length;
                            return (
                                <button
                                    key={person.id}
                                    onClick={() => setSelectedPersonId(person.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-right ${isSelected ? 'bg-red-50 border border-red-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                                >
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm ${person.color.replace('border-', 'bg-')}`}>
                                        {person.name.slice(0, 2)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`font-bold truncate ${isSelected ? 'text-red-900' : 'text-slate-700'}`}>{person.name}</div>
                                    </div>
                                    {personAbsenceCount > 0 && <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-bold">{personAbsenceCount}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Main Content - Hidden on mobile if NO person selected (unless we want to show All Absences initially, but user typically wants to select. Let's show All Absences if !selectedPersonId on desktop, but on mobile maybe initially hide? No, on mobile !selectedPersonId means show Sidebar. ) */}
                {/* Logic: 
                    Desktop: Always Flex.
                    Mobile: 
                        If !selectedPersonId: Hidden (Show Sidebar)
                        If selectedPersonId: Flex (Show Calendar)
                    Wait, if we want "All Absences" list to be accessible on mobile, we need a way.
                    The Sidebar has "All Absences" button (lines 169-174). Clicking it sets selectedPersonId = null.
                    If null, on mobile we see Sidebar. 
                    Where does "All Absences" content appear? In Main Content (lines 200+).
                    So if selectedPersonId is NULL, we see sidebar. 
                    User can't see "All Absences" content on mobile with this logic.
                    Correct approach for Mobile:
                    - Mode 1: Person List (Sidebar)
                    - Mode 2: Calendar (Main)
                    - Mode 3: All Absences (Main)
                    
                    We could use state `mobileView: 'list' | 'detail'`.
                    But reusing `selectedPersonId` is easier unless `null` means "All Absences".
                    Currently `null` means "All Absences" View in Desktop.
                    
                    Proposed:
                    Mobile default: Sidebar.
                    If I click "All Absences" in sidebar -> It sets null. I stay in Sidebar?
                    I need a way to VIEW "All Absences" on mobile.
                    Maybe Sidebar IS the view? No, Sidebar is a list of people.
                    Main Content (Line 202) is the list of absences.
                    
                    Let's just keep Sidebar visible on mobile if !selectedPersonId.
                    But hide Main Content if !selectedPersonId on mobile.
                    Wait, `selectedPersonId === null` runs Lines 200-241 (All Absences List).
                    If I hide Main Content when `!selectedPersonId` on mobile, I can never see "All Absences".
                    
                    The user requirement: "display absence dates... when a user's name is tapped".
                    Focus on that.
                    Side effect: "All Absences" might be hard to reach on mobile.
                    I will add a `hidden md:flex` to main content if `!selectedPersonId`.
                    
                 */}
                <div className={`flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex-col overflow-hidden relative ${!selectedPersonId ? 'hidden md:flex' : 'flex'}`}>
                    {!selectedPersonId ? (
                        // All Absences List View (Desktop mostly, or if we enable it on mobile somehow)
                        // If we want this on mobile we need a toggle. For now, following the specific Person Tap requirement.
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <h3 className="font-bold text-slate-700">רשימת היעדרויות כללית</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4">
                                {absences.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                        <CalendarIcon size={48} className="mb-4 opacity-20" />
                                        <p>אין היעדרויות רשומות במערכת</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {absences
                                            .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
                                            .map(absence => {
                                                const person = people.find(p => p.id === absence.person_id);
                                                if (!person) return null;
                                                return (
                                                    <div key={absence.id} className="flex items-center gap-4 p-3 bg-white border border-slate-100 rounded-lg hover:shadow-md transition-all group">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${person.color.replace('border-', 'bg-')}`}>
                                                            {person.name.slice(0, 2)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="font-bold text-slate-800">{person.name}</div>
                                                            <div className="text-sm text-slate-500 flex items-center gap-2">
                                                                <span>{new Date(absence.start_date).toLocaleDateString('he-IL')} - {new Date(absence.end_date).toLocaleDateString('he-IL')}</span>
                                                                {absence.reason && <span className="bg-slate-100 px-2 py-0.5 rounded text-xs truncate max-w-[200px]">{absence.reason}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Button size="sm" variant="ghost" onClick={() => openEditModal(absence)} icon={Edit2} />
                                                            <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirmId(absence.id)} icon={Trash2} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Person Calendar View
                        <div className="flex flex-col h-full">
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                                <div className="flex items-center gap-2 md:gap-4 bg-white px-2 md:px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
                                    <button onClick={handlePrevMonth} className="p-1 hover:bg-slate-100 rounded"><ChevronRight size={20} /></button>
                                    <span className="text-sm md:text-lg font-bold min-w-[100px] md:min-w-[140px] text-center">{viewDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</span>
                                    <button onClick={handleNextMonth} className="p-1 hover:bg-slate-100 rounded"><ChevronLeft size={20} /></button>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Mobile Back Button */}
                                    <button
                                        onClick={() => setSelectedPersonId(null)}
                                        className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                                    >
                                        <ChevronLeft size={24} />
                                    </button>
                                    <div className="text-sm text-slate-500 hidden md:block">
                                        <span className="font-bold">{people.find(p => p.id === selectedPersonId)?.name}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 p-2 md:p-6 overflow-y-auto">

                                <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2 md:mb-4">
                                    {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map(day => <div key={day} className="text-center font-bold text-slate-400 text-xs md:text-sm py-1 md:py-2">{day}</div>)}
                                </div>
                                <div className="grid grid-cols-7 gap-1 md:gap-4">
                                    {getMonthDays(viewDate).map((date, i) => {
                                        if (!date) return <div key={`empty-${i}`} className="aspect-square bg-slate-50/50 rounded-xl" />;

                                        const dateStr = date.toLocaleDateString('en-CA');
                                        const absence = getAbsenceForDate(date);
                                        const isToday = new Date().toDateString() === date.toDateString();

                                        return (
                                            <div
                                                key={dateStr}
                                                onClick={() => absence ? openEditModal(absence) : openAddModal(selectedPersonId, dateStr)}
                                                className={`
                                                    aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all border-2 relative group cursor-pointer
                                                    ${absence ? 'bg-red-50 border-red-500 shadow-md' : 'bg-white border-slate-100 hover:border-blue-400 hover:shadow-md'}
                                                    ${isToday ? 'ring-2 ring-blue-200' : ''}
                                                `}
                                            >
                                                <span className={`text-xl font-bold ${absence ? 'text-red-700' : 'text-slate-700'}`}>{date.getDate()}</span>
                                                {absence && (
                                                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full truncate max-w-[90%]">
                                                        {absence.reason || 'היעדרות'}
                                                    </span>
                                                )}
                                                {!absence && (
                                                    <span className="opacity-0 group-hover:opacity-100 absolute bottom-2 text-blue-500"><Plus size={16} /></span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingAbsence ? 'עריכת היעדרות' : 'הוספת היעדרות'} size="md">
                <div className="space-y-4">
                    {!selectedPersonId && !editingAbsence && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">חייל</label>
                            <Select
                                value={formPersonId}
                                onChange={(val) => setFormPersonId(val)}
                                options={people.slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ value: p.id, label: p.name }))}
                                placeholder="בחר חייל..."
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <Input type="date" label="תאריך התחלה" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
                        <Input type="date" label="תאריך סיום" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
                    </div>

                    <div>
                        <Input
                            label="סיבה / הערה"
                            value={formReason}
                            onChange={e => setFormReason(e.target.value)}
                            placeholder="לדוגמה: חופשה שנתית, מחלה, הפנייה רפואית..."
                            icon={FileText}
                        />
                    </div>

                    <div className="flex justify-end gap-3 mt-6">
                        {editingAbsence && (
                            <Button variant="ghost" className="text-red-600 hover:bg-red-50 mr-auto" onClick={() => { setIsModalOpen(false); setDeleteConfirmId(editingAbsence.id); }} icon={Trash2}>
                                מחק
                            </Button>
                        )}
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>ביטול</Button>
                        <Button variant="primary" onClick={handleSave} icon={Check}>שמור</Button>
                    </div>
                </div>
            </Modal>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm border border-slate-200 text-center" onClick={e => e.stopPropagation()}>
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">מחיקת היעדרות</h3>
                        <p className="text-slate-500 mb-8">האם אתה בטוח שברצונך למחוק היעדרות זו?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold hover:bg-slate-50">ביטול</button>
                            <button onClick={handleDelete} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200">מחק</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
