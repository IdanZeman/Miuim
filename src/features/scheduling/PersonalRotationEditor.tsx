import React, { useState, useEffect } from 'react';
import { Person } from '@/types';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { Gear as Settings } from '@phosphor-icons/react';
import { DatePicker } from '@/components/ui/DatePicker';

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

    const modalTitle = (
        <div className="flex flex-col pr-2 text-right">
            <h2 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">סבב אישי - {person.name}</h2>
            <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 font-bold uppercase tracking-wider">
                <Settings size={14} className="text-slate-400" weight="duotone" />
                <span>הגדרת מחזוריות אישית</span>
            </div>
        </div>
    );

    const modalFooter = (
        <div className="flex justify-between items-center w-full">
            <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">ביטול</Button>
            <Button variant="primary" onClick={handleSave} className="font-bold px-8 shadow-none">שמור הגדרות</Button>
        </div>
    );

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={modalTitle}
            footer={modalFooter}
            size="sm"
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="font-black text-slate-700">סבב אישי פעיל</span>
                    <Switch
                        checked={personalRotation.isActive}
                        onChange={(checked) => setPersonalRotation(prev => ({ ...prev, isActive: checked }))}
                    />
                </div>

                {personalRotation.isActive && (
                    <div className="space-y-5 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">ימים בבסיס</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={personalRotation.daysOn}
                                    onChange={e => setPersonalRotation(prev => ({ ...prev, daysOn: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-slate-400 mb-1.5 block uppercase tracking-wider">ימים בבית</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={personalRotation.daysOff}
                                    onChange={e => setPersonalRotation(prev => ({ ...prev, daysOff: parseInt(e.target.value) || 0 }))}
                                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-black focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>
                        </div>
                        <DatePicker
                            label="תאריך התחלת סבב"
                            value={personalRotation.startDate}
                            onChange={(val) => setPersonalRotation(prev => ({ ...prev, startDate: val }))}
                        />
                        <div className="bg-blue-50/50 p-4 rounded-xl text-xs text-blue-700 font-bold border border-blue-100/50 leading-relaxed">
                            הגדרת סבב אישי תגבר על הסבב הצוותי המוגדר עבור חייל זה.
                        </div>
                    </div>
                )}
            </div>
        </GenericModal>
    );
};
