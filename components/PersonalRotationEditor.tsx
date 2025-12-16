import React, { useState, useEffect } from 'react';
import { Person } from '../types';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Switch } from './ui/Switch';

interface PersonalRotationEditorProps {
    person: Person;
    isOpen: boolean;
    onClose: () => void;
    onSave: (rotationSettings: any) => void;
}

export const PersonalRotationEditor: React.FC<PersonalRotationEditorProps> = ({ person, isOpen, onClose, onSave }) => {
    // Personal Rotation State
    const [personalRotation, setPersonalRotation] = useState({
        isActive: person.personalRotation?.isActive || false,
        daysOn: person.personalRotation?.daysOn || 11,
        daysOff: person.personalRotation?.daysOff || 3,
        startDate: person.personalRotation?.startDate || new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        setPersonalRotation({
            isActive: person.personalRotation?.isActive || false,
            daysOn: person.personalRotation?.daysOn || 11,
            daysOff: person.personalRotation?.daysOff || 3,
            startDate: person.personalRotation?.startDate || new Date().toISOString().split('T')[0]
        });
    }, [person]);

    const handleSave = () => {
        onSave(personalRotation);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`הגדרת סבב יציאות אישי - ${person.name}`}
            size="sm"
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-700">סבב אישי פעיל</span>
                    <Switch
                        checked={personalRotation.isActive}
                        onChange={(checked) => setPersonalRotation(prev => ({ ...prev, isActive: checked }))}
                    />
                </div>

                {personalRotation.isActive && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">ימים בבסיס</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={personalRotation.daysOn}
                                    onChange={e => setPersonalRotation(prev => ({ ...prev, daysOn: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">ימים בבית</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={personalRotation.daysOff}
                                    onChange={e => setPersonalRotation(prev => ({ ...prev, daysOff: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 mb-1 block">תאריך התחלת סבב (יום ראשון בבסיס)</label>
                            <input
                                type="date"
                                value={personalRotation.startDate}
                                onChange={e => setPersonalRotation(prev => ({ ...prev, startDate: e.target.value }))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                            הגדרת סבב אישי תגבר על הסבב הצוותי המוגדר.
                        </div>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={onClose}>ביטול</Button>
                    <Button variant="primary" onClick={handleSave}>שמור הגדרות</Button>
                </div>
            </div>
        </Modal>
    );
};
