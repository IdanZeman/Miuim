import React from 'react';
import { Person, Role, Team, OrganizationSettings } from '../../types';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import {
    X, Phone, Envelope, Shield, Users, Info,
    ArrowSquareOut, Browsers, IdentificationCard
} from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';

interface PersonInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person;
    roles: Role[];
    teams: Team[];
    settings?: OrganizationSettings | null;
}

export const PersonInfoModal: React.FC<PersonInfoModalProps> = ({
    isOpen,
    onClose,
    person,
    roles,
    teams,
    settings
}) => {
    const personRoles = roles.filter(r => (person.roleIds || [person.roleId]).includes(r.id));
    const personTeam = teams.find(t => t.id === person.teamId);
    const customFieldsSchema = settings?.customFieldsSchema || [];

    const handleCall = () => {
        if (person.phone) window.open(`tel:${person.phone}`);
    };

    const handleEmail = () => {
        if (person.email) window.open(`mailto:${person.email}`);
    };

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-lg shadow-slate-200 ${person.color}`}>
                        {getPersonInitials(person.name)}
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black text-slate-800 leading-tight">{person.name}</h2>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ">
                            <IdentificationCard size={14} weight="duotone" />
                            פרופיל חייל
                        </span>
                    </div>
                </div>
            }
            size="md"
        >
            <div className="space-y-8 py-2">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100/50">
                        <Users size={16} weight="duotone" />
                        <span className="text-sm font-black">{personTeam?.name || 'ללא צוות'}</span>
                    </div>
                    {personRoles.map(role => (
                        <div key={role.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-xl border border-slate-200/50">
                            <Shield size={16} weight="duotone" />
                            <span className="text-sm font-black">{role.name}</span>
                        </div>
                    ))}
                    {person.isCommander && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/50">
                            <span className="text-[10px] font-black uppercase tracking-tighter">מפקד</span>
                        </div>
                    )}
                </div>

                {/* Contact Section */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">פרטי התקשרות</h3>
                    <div className="grid grid-cols-1 gap-2">
                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-blue-200 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <Phone size={20} weight="duotone" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400">טלפון</span>
                                    <span className="text-sm font-black text-slate-700">{person.phone || 'לא הוזן'}</span>
                                </div>
                            </div>
                            {person.phone && (
                                <button
                                    onClick={handleCall}
                                    className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-100"
                                >
                                    <Phone size={18} weight="fill" />
                                </button>
                            )}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl group hover:border-purple-200 transition-colors">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-500 transition-colors">
                                    <Envelope size={20} weight="duotone" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400">דוא״ל</span>
                                    <span className="text-sm font-black text-slate-700">{person.email || 'לא הוזן'}</span>
                                </div>
                            </div>
                            {person.email && (
                                <button
                                    onClick={handleEmail}
                                    className="p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 active:scale-95 transition-all shadow-md shadow-purple-100"
                                >
                                    <ArrowSquareOut size={18} weight="bold" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Custom Fields Section */}
                {customFieldsSchema.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">מידע נוסף</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {customFieldsSchema.map(field => {
                                const value = person.customFields?.[field.key];
                                if (value === undefined || value === null || value === '') return null;

                                return (
                                    <div key={field.key} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                        <span className="block text-[10px] font-bold text-slate-400 mb-1">{field.label}</span>
                                        <span className="text-sm font-black text-slate-700">
                                            {typeof value === 'boolean' ? (value ? 'כן' : 'לא') :
                                                Array.isArray(value) ? value.join(', ') :
                                                    String(value)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Footer Info */}
                <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] font-bold text-slate-300">
                    <div className="flex items-center gap-1.5">
                        <Info size={12} weight="duotone" />
                        <span>נוסף למערכת ב-{new Date().toLocaleDateString('he-IL')}</span>
                    </div>
                    <span>ID: {person.id.slice(0, 8)}</span>
                </div>

                <div className="flex gap-3 pt-2">
                    <Button
                        variant="primary"
                        onClick={onClose}
                        className="flex-1 py-6 rounded-2xl font-black text-base shadow-xl shadow-blue-100"
                    >
                        סגור
                    </Button>
                </div>
            </div>
        </GenericModal>
    );
};
