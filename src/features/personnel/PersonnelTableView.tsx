import React, { useState, useRef, useEffect } from 'react';
import { Person, Team, Role, CustomFieldDefinition } from '../../types';
import { Check, User, Users, Shield, Tag, Phone, Envelope, ChartLineUp, CaretDown, X } from '@phosphor-icons/react';
import { getPersonInitials } from '../../utils/nameUtils';

interface PersonnelTableViewProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    customFieldsSchema: CustomFieldDefinition[];
    onUpdatePerson: (person: Person) => void;
    searchTerm: string;
    selectedItemIds: Set<string>;
    toggleSelection: (id: string) => void;
    canEdit: boolean;
    onEditPerson: (person: Person) => void;
}

export const PersonnelTableView: React.FC<PersonnelTableViewProps> = ({
    people,
    teams,
    roles,
    customFieldsSchema,
    onUpdatePerson,
    searchTerm,
    selectedItemIds,
    toggleSelection,
    canEdit,
    onEditPerson
}) => {
    // Sort custom fields by order
    const sortedSchema = [...customFieldsSchema].sort((a, b) => (a.order || 0) - (b.order || 0));

    // Inline Editing State
    const [editingCell, setEditingCell] = useState<{ personId: string, field: string } | null>(null);
    const [editValue, setEditValue] = useState<any>(null);
    const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    // Focus input when editing starts
    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    // Handle Cell Click
    const handleCellClick = (person: Person, field: string, value: any) => {
        if (!canEdit) return;
        setEditingCell({ personId: person.id, field });
        setEditValue(value);
    };

    // Save Changes
    const handleSave = () => {
        if (!editingCell) return;

        const person = people.find(p => p.id === editingCell.personId);
        if (!person) return;

        let updatedPerson = { ...person };
        const { field } = editingCell;

        // Handle different fields
        if (field === 'name') updatedPerson.name = editValue;
        else if (field === 'teamId') updatedPerson.teamId = editValue;
        else if (field === 'roleIds') updatedPerson.roleIds = editValue; // Expecting array
        else if (field === 'phone') updatedPerson.phone = editValue;
        else if (field === 'email') updatedPerson.email = editValue;
        else if (field === 'isActive') updatedPerson.isActive = editValue;
        else {
            // Custom Field
            updatedPerson.customFields = {
                ...updatedPerson.customFields,
                [field]: editValue
            };
        }

        onUpdatePerson(updatedPerson);
        setEditingCell(null);
        setEditValue(null);
    };

    // Handle Key Press (Enter to save, Escape to cancel)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') setEditingCell(null);
    };

    return (
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full relative">
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full border-collapse min-w-[1200px] text-right">
                    <thead className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 shadow-sm">
                        <tr>
                            <th className="px-4 py-3 w-12 text-center sticky right-0 bg-slate-50 z-20 border-l border-slate-100/50">
                                {/* Bulk Selection Header Placeholder */}
                            </th>
                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[200px] sticky right-12 bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                שם מלא
                            </th>
                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[140px]">צוות</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[220px]">תפקידים</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[130px]">טלפון</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[180px]">אימייל</th>
                            <th className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest w-28">סטטוס</th>

                            {/* Dynamic Custom Fields Headers */}
                            {sortedSchema.map(field => (
                                <th key={field.id} className="px-4 py-3 text-xs font-black text-slate-400 uppercase tracking-widest min-w-[140px]">
                                    {field.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {people.map(person => {
                            const team = teams.find(t => t.id === person.teamId);
                            const isSelected = selectedItemIds.has(person.id);

                            return (
                                <tr
                                    key={person.id}
                                    className={`group hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}
                                >
                                    {/* Checkbox (Sticky Left) */}
                                    <td className="px-4 py-3 text-center sticky right-0 bg-white group-hover:bg-slate-50 z-10 border-l border-slate-100/50" onClick={(e) => e.stopPropagation()}>
                                        <div
                                            onClick={() => toggleSelection(person.id)}
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200 bg-white group-hover:border-slate-300'}`}
                                        >
                                            {isSelected && <Check size={12} className="text-white" weight="bold" />}
                                        </div>
                                    </td>

                                    {/* Name (Sticky Left) */}
                                    <td
                                        className="px-4 py-3 sticky right-12 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] cursor-text"
                                        onClick={() => handleCellClick(person, 'name', person.name)}
                                    >
                                        {editingCell?.personId === person.id && editingCell.field === 'name' ? (
                                            <input
                                                ref={inputRef as any}
                                                type="text"
                                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleSave} // Auto-save on blur
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg ${team?.color?.replace('border-', 'bg-') || 'bg-slate-200'} text-white flex items-center justify-center text-[10px] font-black shrink-0`}>
                                                    {getPersonInitials(person.name)}
                                                </div>
                                                <span className="text-sm font-bold text-slate-900 truncate max-w-[150px]">{person.name}</span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Team */}
                                    <td
                                        className="px-4 py-3 cursor-pointer"
                                        onClick={() => handleCellClick(person, 'teamId', person.teamId)}
                                    >
                                        {editingCell?.personId === person.id && editingCell.field === 'teamId' ? (
                                            <select
                                                ref={inputRef as any}
                                                className="w-full bg-white border border-indigo-300 rounded px-1 py-1 text-sm focus:outline-none"
                                                value={editValue || ''}
                                                onChange={(e) => {
                                                    setEditValue(e.target.value);
                                                    // Immediate save for select
                                                    const person = people.find(p => p.id === editingCell.personId);
                                                    if (person) onUpdatePerson({ ...person, teamId: e.target.value === 'no-team' ? null : e.target.value });
                                                    setEditingCell(null);
                                                }}
                                                onBlur={() => setEditingCell(null)}
                                            >
                                                <option value="no-team">ללא צוות</option>
                                                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                            </select>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${team?.color?.replace('border-', 'bg-') || 'bg-slate-200'}`} />
                                                <span className="text-xs font-bold text-slate-600 truncate">{team?.name || 'ללא צוות'}</span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Roles (Multiple Select is complex for inline, simplifying to display mostly, or simplified edit) */}
                                    <td className="px-4 py-3">
                                        {/* For quick MVP inline edit of roles, maybe just click to open full modal or a simplified multiselect. 
                                            For now, keeping it read-only-ish or simple click-to-edit-in-modal is safer unless requested otherwise. 
                                            User requested "edit fields directly", so let's try a simple multiselect or just text for now? 
                                            Actually, better: Click opens the standard edit modal for complex fields like Roles/Tags.
                                        */}
                                        <div
                                            className="flex flex-wrap gap-1 cursor-pointer min-h-[24px]"
                                            onClick={() => onEditPerson(person)}
                                        >
                                            {(person.roleIds || []).map(roleId => {
                                                const role = roles.find(r => r.id === roleId);
                                                if (!role) return null;
                                                return (
                                                    <span key={roleId} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black border border-slate-200/50">
                                                        {role.name}
                                                    </span>
                                                );
                                            })}
                                            {(!person.roleIds || person.roleIds.length === 0) && (
                                                <span className="text-[10px] font-bold text-slate-300">ללא תפקיד</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Phone */}
                                    <td
                                        className="px-4 py-3 cursor-text"
                                        onClick={() => handleCellClick(person, 'phone', person.phone)}
                                    >
                                        {editingCell?.personId === person.id && editingCell.field === 'phone' ? (
                                            <input
                                                ref={inputRef as any}
                                                type="tel"
                                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleSave}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : (
                                            <span className="text-xs font-bold text-slate-500 block min-h-[20px]" dir="ltr">{person.phone || '-'}</span>
                                        )}
                                    </td>

                                    {/* Email */}
                                    <td
                                        className="px-4 py-3 cursor-text"
                                        onClick={() => handleCellClick(person, 'email', person.email)}
                                    >
                                        {editingCell?.personId === person.id && editingCell.field === 'email' ? (
                                            <input
                                                ref={inputRef as any}
                                                type="email"
                                                className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleSave}
                                                onKeyDown={handleKeyDown}
                                            />
                                        ) : (
                                            <span className="text-xs font-bold text-slate-500 truncate max-w-[150px] block min-h-[20px]" dir="ltr">{person.email || '-'}</span>
                                        )}
                                    </td>

                                    {/* Status */}
                                    <td className="px-4 py-3 cursor-pointer" onClick={() => {
                                        onUpdatePerson({ ...person, isActive: !person.isActive });
                                    }}>
                                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-black border transition-colors ${person.isActive !== false ? 'bg-green-50 text-green-700 border-green-100 hover:bg-green-100' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}>
                                            <div className={`w-1.5 h-1.5 rounded-full ${person.isActive !== false ? 'bg-green-500' : 'bg-slate-400'}`} />
                                            {person.isActive !== false ? 'פעיל' : 'לא פעיל'}
                                        </div>
                                    </td>

                                    {/* Dynamic Custom Fields Cells */}
                                    {sortedSchema.map(field => {
                                        const value = person.customFields?.[field.key];
                                        const isEditing = editingCell?.personId === person.id && editingCell.field === field.key;

                                        return (
                                            <td
                                                key={field.id}
                                                className="px-4 py-3 cursor-pointer"
                                                onClick={() => handleCellClick(person, field.key, value)}
                                            >
                                                {isEditing ? (
                                                    field.type === 'boolean' ? (
                                                        <input
                                                            ref={inputRef as any}
                                                            type="checkbox"
                                                            checked={!!editValue}
                                                            onChange={(e) => {
                                                                setEditValue(e.target.checked);
                                                                // Immediate save for checkbox
                                                                onUpdatePerson({
                                                                    ...person,
                                                                    customFields: { ...person.customFields, [field.key]: e.target.checked }
                                                                });
                                                                setEditingCell(null);
                                                            }}
                                                            onBlur={() => setEditingCell(null)}
                                                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                                        />
                                                    ) : field.type === 'select' ? (
                                                        <select
                                                            ref={inputRef as any}
                                                            className="w-full bg-white border border-indigo-300 rounded px-1 py-1 text-xs focus:outline-none"
                                                            value={editValue || ''}
                                                            onChange={(e) => {
                                                                setEditValue(e.target.value);
                                                                onUpdatePerson({
                                                                    ...person,
                                                                    customFields: { ...person.customFields, [field.key]: e.target.value }
                                                                });
                                                                setEditingCell(null);
                                                            }}
                                                            onBlur={() => setEditingCell(null)}
                                                        >
                                                            <option value="">בחר...</option>
                                                            {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                        </select>
                                                    ) : (
                                                        <input
                                                            ref={inputRef as any}
                                                            type={field.type === 'number' ? 'number' : 'text'}
                                                            className="w-full bg-white border border-indigo-300 rounded px-2 py-1 text-xs focus:outline-none"
                                                            value={editValue || ''}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleSave}
                                                            onKeyDown={handleKeyDown}
                                                        />
                                                    )
                                                ) : (
                                                    <div className="text-xs font-bold text-slate-600 truncate max-w-[120px] min-h-[20px]">
                                                        {field.type === 'boolean' ? (
                                                            value ? <Check size={16} className="text-indigo-600" weight="bold" /> : '-'
                                                        ) : Array.isArray(value) ? (
                                                            value.join(', ') || '-'
                                                        ) : (
                                                            value?.toString() || '-'
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {people.length === 0 && (
                            <tr>
                                <td colSpan={7 + sortedSchema.length} className="px-4 py-12 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-400">
                                        <User size={48} weight="duotone" className="mb-4 opacity-20" />
                                        <p className="text-sm font-bold">לא נמצאו תוצאות לחיפוש הנוכחי</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Table Footer info */}
            <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest sticky bottom-0 z-30">
                <div>סה״כ: {people.length} חברים</div>
                {selectedItemIds.size > 0 && (
                    <div className="text-indigo-600">נבחרו {selectedItemIds.size} פריטים</div>
                )}
            </div>
        </div>
    );
};
