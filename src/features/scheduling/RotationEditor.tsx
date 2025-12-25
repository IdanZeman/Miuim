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

    const footerContent = (
        <div className="flex justify-between items-center gap-4 w-full">
            {existing ? (
                <Button
                    onClick={() => onDeleteRotation?.(existing.id)}
                    variant="danger"
                    icon={Trash2}
                >
                    מחק סבב
                </Button>
            ) : <div></div>}

            <div className="flex gap-3">
                <Button onClick={onClose} variant="ghost">ביטול</Button>
                <Button onClick={handleSave} variant="primary" icon={Save}>שמור הגדרות</Button>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`הגדרות סבב - ${team.name}`}
            size="lg"
            footer={footerContent}
        >
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
                        <Input
                            label="ימים בבסיס"
                            type="number"
                            value={daysOn}
                            onChange={e => setDaysOn(parseInt(e.target.value))}
                            placeholder="11"
                        />
                        <Input
                            label="ימים בבית"
                            type="number"
                            value={daysOff}
                            onChange={e => setDaysOff(parseInt(e.target.value))}
                            placeholder="3"
                        />
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Input
                                type="date"
                                label="תאריך התחלה (עוגן)"
                                value={anchorDate}
                                onChange={e => setAnchorDate(e.target.value)}
                                icon={CalendarDays}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <Input
                                type="date"
                                label="תאריך סיום (אופציונלי)"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                icon={CalendarDays}
                                className="w-full"
                                placeholder="ללא סיום"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Input
                                type="time"
                                label="שעת הגעה (יום 1)"
                                value={arrTime}
                                onChange={e => setArrTime(e.target.value)}
                                icon={Clock}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <Input
                                type="time"
                                label="שעת יציאה (יום אחרון)"
                                value={depTime}
                                onChange={e => setDepTime(e.target.value)}
                                icon={Clock}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
