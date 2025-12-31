import React, { useState } from 'react';
import { Team, TeamRotation } from '@/types';
import { Settings, CalendarDays, Trash2, Save, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

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

    const modalTitle = (
        <div className="flex flex-col pr-2 text-right">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">הגדרות סבב - {team.name}</h2>
            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 font-bold uppercase tracking-wider">
                <Settings size={14} className="text-slate-400" />
                <span>ניהול מחזוריות צוותית</span>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex justify-between items-center gap-4 w-full">
            {existing ? (
                <Button
                    onClick={() => onDeleteRotation?.(existing.id)}
                    variant="danger"
                    icon={Trash2}
                    className="font-bold opacity-80 hover:opacity-100"
                >
                    מחק סבב
                </Button>
            ) : <div />}

            <div className="flex gap-3">
                <Button onClick={onClose} variant="ghost" className="font-bold text-slate-500">ביטול</Button>
                <Button onClick={handleSave} variant="primary" icon={Save} className="font-bold px-8 shadow-lg shadow-blue-200">שמור הגדרות</Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={modalTitle}
            size="lg"
            footer={modalFooter}
        >
            <div className="space-y-6">
                {/* Guidance Note */}
                <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 text-sm text-blue-800 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                        <CalendarDays className="text-blue-600" size={20} />
                    </div>
                    <div>
                        <strong className="block text-blue-900 mb-1 font-black">הגדרת סבב יציאות:</strong>
                        <p className="opacity-90 leading-relaxed font-bold text-xs md:text-sm">
                            כאן מגדירים את המחזוריות הקבועה של הצוות. המערכת תחשב אוטומטית מי נמצא ומי בבית.<br />
                            <span className="text-blue-600">ימים בבסיס:</span> כולל יום ההגעה עד יום היציאה.<br />
                            <span className="text-blue-600">תאריך התחלה:</span> יום ההגעה הראשון שממנו מתחילים לספור את המחזור עבור *כל* הצוות.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <Input
                            label="ימים בבסיס"
                            type="number"
                            value={daysOn}
                            onChange={e => setDaysOn(parseInt(e.target.value))}
                            placeholder="11"
                            className="bg-slate-50/50 border-slate-200"
                        />
                        <Input
                            label="ימים בבית"
                            type="number"
                            value={daysOff}
                            onChange={e => setDaysOff(parseInt(e.target.value))}
                            placeholder="3"
                            className="bg-slate-50/50 border-slate-200"
                        />
                    </div>

                    <div className="space-y-6">
                        <div>
                            <Input
                                type="date"
                                label="תאריך התחלה (עוגן)"
                                value={anchorDate}
                                onChange={e => setAnchorDate(e.target.value)}
                                icon={CalendarDays}
                                className="w-full bg-slate-50/50 border-slate-200"
                            />
                        </div>
                        <div>
                            <Input
                                type="date"
                                label="תאריך סיום (אופציונלי)"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                icon={CalendarDays}
                                className="w-full bg-slate-50/50 border-slate-200"
                                placeholder="ללא סיום"
                            />
                        </div>
                    </div>

                    <div className="space-y-6 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <Input
                                type="time"
                                label="שעת הגעה (יום 1)"
                                value={arrTime}
                                onChange={e => setArrTime(e.target.value)}
                                icon={Clock}
                                className="w-full bg-slate-50/50 border-slate-200"
                            />
                        </div>
                        <div>
                            <Input
                                type="time"
                                label="שעת יציאה (יום אחרון)"
                                value={depTime}
                                onChange={e => setDepTime(e.target.value)}
                                icon={Clock}
                                className="w-full bg-slate-50/50 border-slate-200"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
