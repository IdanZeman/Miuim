import React, { useState } from 'react';
import { Team, TeamRotation } from '../types';
import { Settings, CalendarDays, Trash2, Save } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from './ui/Modal';

interface RotationEditorProps {
    team: Team;
    existing?: TeamRotation;
    onClose: () => void;
    onAddRotation?: (r: TeamRotation) => void;
    onUpdateRotation?: (r: TeamRotation) => void;
    onDeleteRotation?: (id: string) => void;
}

export const RotationEditor: React.FC<RotationEditorProps> = ({ team, existing, onClose, onAddRotation, onUpdateRotation, onDeleteRotation }) => {
    // State for form
    const [daysOn, setDaysOn] = useState(existing?.days_on_base || 11);
    const [daysOff, setDaysOff] = useState(existing?.days_at_home || 3);
    const [anchorDate, setAnchorDate] = useState(existing?.start_date || new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(existing?.end_date || '');
    const [arrTime, setArrTime] = useState(existing?.arrival_time || '10:00');
    const [depTime, setDepTime] = useState(existing?.departure_time || '14:00');

    const handleSave = () => {
        const rot: TeamRotation = {
            id: existing?.id || uuidv4(),
            organization_id: team.organization_id || '',
            team_id: team.id,
            days_on_base: daysOn,
            days_at_home: daysOff,
            cycle_length: daysOn + daysOff,
            start_date: anchorDate,
            end_date: endDate || undefined,
            arrival_time: arrTime,
            departure_time: depTime
        };

        if (existing) onUpdateRotation?.(rot);
        else onAddRotation?.(rot);
        onClose();
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={`הגדרות סבב - ${team.name}`} size="lg">
            <div className="space-y-6">
                {/* Guidance Note */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-sm text-blue-800 flex items-start gap-3">
                    <CalendarDays className="shrink-0 mt-0.5 text-blue-600" size={20} />
                    <div>
                        <strong className="block text-blue-900 mb-1">הגדרת סבב יציאות:</strong>
                        <p className="opacity-90 leading-relaxed">
                            כאן מגדירים את המחזוריות הקבועה של הצוות. המערכת תחשב אוטומטית מי נמצא ומי בבית.<br />
                            <strong>ימים בבסיס:</strong> כולל יום ההגעה עד יום היציאה.<br />
                            <strong>תאריך התחלה:</strong> יום ההגעה הראשון שממנו מתחילים לספור את המחזור עבור *כל* הצוות.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">ימים בבסיס</label>
                            <div className="relative">
                                <input type="number" value={daysOn} onChange={e => setDaysOn(parseInt(e.target.value))} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="11" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">ימים בבית</label>
                            <div className="relative">
                                <input type="number" value={daysOff} onChange={e => setDaysOff(parseInt(e.target.value))} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" placeholder="3" />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">תאריך התחלה (עוגן)</label>
                            <input type="date" value={anchorDate} onChange={e => setAnchorDate(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">תאריך סיום (אופציונלי)</label>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">שעת הגעה (יום 1)</label>
                            <input type="time" value={arrTime} onChange={e => setArrTime(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm ltr-input focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1.5">שעת יציאה (יום אחרון)</label>
                            <input type="time" value={depTime} onChange={e => setDepTime(e.target.value)} className="w-full pl-4 pr-4 py-2.5 rounded-lg border border-slate-300 text-sm ltr-input focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all" />
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-between items-center gap-4">
                    {existing ? (
                        <button onClick={() => onDeleteRotation?.(existing.id)} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                            <Trash2 size={16} /> מחק סבב
                        </button>
                    ) : <div></div>}

                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-6 py-2 text-slate-600 hover:bg-white hover:shadow-sm rounded-lg text-sm font-bold border border-transparent hover:border-slate-200 transition-all">ביטול</button>
                        <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 shadow-md hover:shadow-lg flex items-center gap-2 transition-all">
                            <Save size={16} /> שמור הגדרות
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
