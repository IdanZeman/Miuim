import React, { useState, useEffect } from 'react';
import { User, Envelope as Mail, Pulse as Activity, Users, Shield, Tag, Plus, Trash, X } from '@phosphor-icons/react';
import { Person, Team, Role, CustomFieldDefinition, LocationStatus } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { logger } from '../../services/loggingService';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { GenericModal } from '../../components/ui/GenericModal';
import { ROLE_ICONS } from '../../constants';
import { formatPhoneNumber } from '../../utils/nameUtils';
import { useQueryClient } from '@tanstack/react-query';

interface PersonEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    person: Person | null; // Null means adding a new person
    organizationId: string;
    teams: Team[];
    roles: Role[];
    onSuccess?: () => void;
}

export const PersonEditorModal: React.FC<PersonEditorModalProps> = ({
    isOpen,
    onClose,
    person,
    organizationId,
    teams,
    roles,
    onSuccess
}) => {
    const { organization: currentOrg } = useAuth();
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    // -- Form State --
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [teamId, setTeamId] = useState('');
    const [roleIds, setRoleIds] = useState<string[]>([]);
    const [customFields, setCustomFields] = useState<Record<string, any>>({});
    const [isSaving, setIsSaving] = useState(false);

    // -- Custom Fields Schema --
    const [customFieldsSchema, setCustomFieldsSchema] = useState<CustomFieldDefinition[]>([]);
    const [isCreatingField, setIsCreatingField] = useState(false);
    const [creatingFieldData, setCreatingFieldData] = useState({
        label: '',
        type: 'text',
        optionsString: ''
    });

    // Initialize form when person or isOpen changes
    useEffect(() => {
        if (isOpen) {
            if (person) {
                setName(person.name);
                setEmail(person.email || '');
                setPhone(person.phone || '');
                setIsActive(person.isActive !== false);
                setTeamId(person.teamId || '');
                setRoleIds(person.roleIds || []);
                setCustomFields(person.customFields || {});
            } else {
                setName('');
                setEmail('');
                setPhone('');
                setIsActive(true);
                setTeamId('');
                setRoleIds([]);
                setCustomFields({});
            }
        }
    }, [isOpen, person]);

    // Fetch Custom Fields Schema for the specific organization
    useEffect(() => {
        const fetchSchema = async () => {
            if (!organizationId || !isOpen) return;
            try {
                const { data, error } = await supabase
                    .from('organization_settings')
                    .select('custom_fields_schema')
                    .eq('organization_id', organizationId)
                    .maybeSingle(); // Use maybeSingle() to handle missing rows gracefully

                if (error) throw error;
                if (data?.custom_fields_schema) {
                    setCustomFieldsSchema(data.custom_fields_schema);
                } else {
                    setCustomFieldsSchema([]);
                }
            } catch (err) {
                console.error('Error fetching custom fields schema:', err);
                setCustomFieldsSchema([]); // Fallback to empty schema
            }
        };
        fetchSchema();
    }, [organizationId, isOpen]);

    const handleSave = async () => {
        if (!name.trim()) {
            showToast('נא להזין שם', 'error');
            return;
        }

        // Only validate team if there are teams available for this company
        if (!teamId && teams.length > 0) {
            showToast('נא לבחור צוות', 'error');
            return;
        }

        // Validate Required Custom Fields
        for (const field of customFieldsSchema) {
            const val = customFields[field.key];
            if (field.required && (val === undefined || val === null || (typeof val === 'string' && val.trim() === ''))) {
                showToast(`נא להזין ${field.label}`, 'error');
                return;
            }
        }

        setIsSaving(true);
        try {
            const cleanedCustomFields = { ...customFields };

            // Normalize phone numbers in custom fields
            customFieldsSchema.forEach(field => {
                if (field.type === 'phone' && cleanedCustomFields[field.key]) {
                    cleanedCustomFields[field.key] = formatPhoneNumber(cleanedCustomFields[field.key]);
                }
            });

            const personData: Partial<Person> = {
                name: name.trim(),
                email: email.trim() || null,
                phone: formatPhoneNumber(phone),
                isActive,
                teamId: teamId || null,
                roleIds,
                customFields: cleanedCustomFields,
                organization_id: organizationId,
                color: person?.color || 'bg-blue-500' // Preserve existing color or default
            };

            // Map to database column names (snake_case)
            const dbData = {
                name: personData.name,
                email: personData.email,
                phone: personData.phone,
                is_active: personData.isActive,
                team_id: personData.teamId,
                role_ids: personData.roleIds,
                custom_fields: personData.customFields,
                organization_id: personData.organization_id,
                color: personData.color
            };

            if (person) {
                // Update
                const { error } = await supabase
                    .from('people')
                    .update(dbData)
                    .eq('id', person.id);

                if (error) throw error;
                logger.logUpdate('person', person.id, person.name, person, personData);
                showToast('החייל עודכן בהצלחה', 'success');
            } else {
                // Create
                const { error } = await supabase
                    .from('people')
                    .insert([{ ...dbData, id: crypto.randomUUID() }]);

                if (error) throw error;
                logger.logCreate('person', 'new', personData.name!, personData);
                showToast('החייל נוסף בהצלחה', 'success');
            }

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['organizationData', organizationId] });
            queryClient.invalidateQueries({ queryKey: ['battalionPresence'] });

            if (onSuccess) onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error saving person:', err);
            showToast(err.message || 'שגיאה בשמירה', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateField = async () => {
        if (!creatingFieldData.label || !organizationId) return;

        const newField: CustomFieldDefinition = {
            id: crypto.randomUUID(),
            key: creatingFieldData.label,
            label: creatingFieldData.label,
            type: creatingFieldData.type as any,
            order: customFieldsSchema.length,
            options: creatingFieldData.type === 'select' || creatingFieldData.type === 'multiselect'
                ? creatingFieldData.optionsString.split(',').map(s => s.trim()).filter(Boolean)
                : undefined
        };

        const updatedSchema = [...customFieldsSchema, newField];

        try {
            const { error } = await supabase
                .from('organization_settings')
                .update({ custom_fields_schema: updatedSchema })
                .eq('organization_id', organizationId);

            if (error) throw error;

            setCustomFieldsSchema(updatedSchema);
            setIsCreatingField(false);
            setCreatingFieldData({ label: '', type: 'text', optionsString: '' });
            showToast('שדה חדש נוסף בהצלחה', 'success');
        } catch (err) {
            console.error('Error saving custom schema:', err);
            showToast('שגיאה בהוספת שדה', 'error');
        }
    };

    const handleDeleteFieldGlobally = (key: string) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק שדה זה עבור כל הארגון?')) return;

        const updatedSchema = customFieldsSchema.filter(f => f.key !== key);

        const performDelete = async () => {
            try {
                const { error } = await supabase
                    .from('organization_settings')
                    .update({ custom_fields_schema: updatedSchema })
                    .eq('organization_id', organizationId);

                if (error) throw error;

                setCustomFieldsSchema(updatedSchema);
                showToast('השדה נמחק בהצלחה', 'success');
            } catch (err) {
                console.error('Error deleting custom field:', err);
                showToast('שגיאה במחיקת שדה', 'error');
            }
        };

        performDelete();
    };

    const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    const sortedRoles = [...roles].sort((a, b) => a.name.localeCompare(b.name, 'he'));

    return (
        <GenericModal
            isOpen={isOpen}
            onClose={onClose}
            title={person ? 'עריכת חייל' : 'הוספת חייל חדש'}
            size="md"
            footer={
                <div className="flex gap-3 w-full">
                    <Button
                        variant="primary"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 h-12 rounded-2xl font-black text-base shadow-lg shadow-blue-100"
                    >
                        {isSaving ? 'שומר...' : 'שמור שינויים'}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex-1 h-12 rounded-2xl font-black text-base"
                    >
                        ביטול
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 py-2 overflow-y-auto max-h-[60vh] pr-1">
                {/* Essential Info Group */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">פרטים אישיים</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                        {/* Name */}
                        <div className="flex items-center px-5 py-4 group">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                <User size={18} weight="duotone" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">שם מלא</label>
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="ישראל ישראלי"
                                    className="block w-full bg-transparent border-none p-0 outline-none text-slate-900 font-bold text-base placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                        {/* Phone */}
                        <div className="flex items-center px-5 py-4 group">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                <div className="text-sm font-black">#</div>
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">טלפון</label>
                                <input
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                    placeholder="050-0000000"
                                    type="tel"
                                    className="block w-full bg-transparent border-none p-0 outline-none text-slate-900 font-bold text-base placeholder:text-slate-300"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        {/* Email */}
                        <div className="flex items-center px-5 py-4 group">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                <Mail size={18} weight="duotone" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">אימייל</label>
                                <input
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    type="email"
                                    className="block w-full bg-transparent border-none p-0 outline-none text-slate-900 font-bold text-base placeholder:text-slate-300"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Team & Status Group */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">שיוך וסטטוס</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden divide-y divide-slate-100">
                        {/* Team Selector */}
                        <div className="flex items-center px-5 py-4 group bg-white relative">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0 ml-4 group-focus-within:bg-indigo-50 group-focus-within:text-indigo-600 transition-colors">
                                <Users size={18} weight="duotone" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-tight mb-0.5">צוות</label>
                                <Select
                                    value={teamId}
                                    onChange={(val) => setTeamId(val)}
                                    options={sortedTeams.map(t => ({ value: t.id, label: t.name }))}
                                    placeholder="בחר צוות"
                                    className="bg-transparent border-none shadow-none hover:bg-slate-50 pr-0 h-auto py-0 font-bold text-base"
                                    containerClassName="w-full"
                                />
                            </div>
                        </div>

                        {/* Active Status */}
                        <div
                            className="flex items-center justify-between px-5 py-4 cursor-pointer active:bg-slate-50 transition-colors"
                            onClick={() => setIsActive(!isActive)}
                            role="switch"
                            aria-checked={isActive}
                        >
                            <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-4 transition-colors ${isActive ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                                    <Activity size={18} weight="duotone" />
                                </div>
                                <div>
                                    <div className="text-sm font-black text-slate-900">סטטוס פעיל</div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase">מופיע בחיפושים ושיבוצים</div>
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full transition-all relative ${isActive ? 'bg-green-500' : 'bg-slate-200'}`}>
                                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${isActive ? 'left-1' : 'left-7'}`} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Roles Group */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">תפקידים והכשרות</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5">
                        <div className="flex flex-wrap gap-2.5">
                            {sortedRoles.map(role => {
                                const isSelected = roleIds.includes(role.id);
                                const Icon = role.icon && ROLE_ICONS[role.icon] ? ROLE_ICONS[role.icon] : Shield;
                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => {
                                            if (isSelected) setRoleIds(roleIds.filter(id => id !== role.id));
                                            else setRoleIds([...roleIds, role.id]);
                                        }}
                                        className={`h-11 px-4 rounded-2xl text-xs font-black border-2 transition-all flex items-center gap-2.5 active:scale-95 ${isSelected
                                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-md shadow-indigo-100'
                                            : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'
                                            }`}
                                    >
                                        <Icon size={16} strokeWidth={isSelected ? 3 : 2} className={isSelected ? 'text-indigo-600' : 'text-slate-400'} />
                                        {role.name}
                                    </button>
                                );
                            })}
                        </div>
                        {roles.length === 0 && (
                            <p className="text-xs font-bold text-slate-400 text-center py-4">אין תפקידים מוגדרים במערכת</p>
                        )}
                    </div>
                </div>

                {/* Custom Fields Group */}
                <div className="space-y-3">
                    <h3 className="text-[10px] font-black text-slate-400 px-4 uppercase tracking-widest">נתונים נוספים</h3>
                    <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden p-5 space-y-4">
                        {customFieldsSchema
                            .sort((a, b) => (a.order || 0) - (b.order || 0))
                            .map(field => {
                                const value = customFields[field.key];

                                return (
                                    <div key={field.key} className="space-y-1.5 group">
                                        <div className="flex items-center justify-between">
                                            <label className="block text-xs font-bold text-slate-700">
                                                {field.label}
                                                {field.required && <span className="text-red-500 mr-1">*</span>}
                                            </label>
                                            <button
                                                onClick={() => handleDeleteFieldGlobally(field.key)}
                                                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash size={14} weight="bold" />
                                            </button>
                                        </div>

                                        {field.type === 'boolean' ? (
                                            <div
                                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
                                                onClick={() => setCustomFields({ ...customFields, [field.key]: !value })}
                                            >
                                                <div className={`w-10 h-6 rounded-full transition-all relative ${value ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${value ? 'left-1' : 'left-5'}`} />
                                                </div>
                                                <span className="text-sm font-medium text-slate-600">{value ? 'כן' : 'לא'}</span>
                                            </div>
                                        ) : field.type === 'select' ? (
                                            <Select
                                                value={value}
                                                onChange={(val) => setCustomFields({ ...customFields, [field.key]: val })}
                                                options={[
                                                    { value: '', label: field.placeholder || 'בחר...' },
                                                    ...(field.options || []).map(opt => ({ value: opt, label: opt }))
                                                ]}
                                                className="bg-slate-50 border-slate-200 rounded-xl"
                                            />
                                        ) : field.type === 'multiselect' ? (
                                            <div className="space-y-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {((value as string[]) || []).map((val: string) => (
                                                        <span key={val} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">
                                                            {val}
                                                            <button
                                                                onClick={() => {
                                                                    const current = (value as string[]) || [];
                                                                    setCustomFields({
                                                                        ...customFields,
                                                                        [field.key]: current.filter(v => v !== val)
                                                                    });
                                                                }}
                                                            >
                                                                <X size={12} weight="bold" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium"
                                                    onChange={(e) => {
                                                        if (!e.target.value) return;
                                                        const current = (value as string[]) || [];
                                                        if (!current.includes(e.target.value)) {
                                                            setCustomFields({
                                                                ...customFields,
                                                                [field.key]: [...current, e.target.value]
                                                            });
                                                        }
                                                        e.target.value = '';
                                                    }}
                                                >
                                                    <option value="">{field.placeholder || "הוסף אפשרות..."}</option>
                                                    {(field.options || []).filter(opt => !((value as string[]) || []).includes(opt)).map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <Input
                                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                                                value={value || ''}
                                                onChange={(e) => setCustomFields({ ...customFields, [field.key]: e.target.value })}
                                                placeholder={field.placeholder}
                                                className="bg-slate-50 border-slate-200 rounded-xl"
                                            />
                                        )}
                                    </div>
                                );
                            })}

                        {/* New Field Creator */}
                        <div className="pt-4 border-t border-slate-100">
                            <button
                                onClick={() => setIsCreatingField(true)}
                                className="w-full py-3 border border-dashed border-slate-300 rounded-xl text-slate-500 text-xs font-bold hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all flex items-center justify-center gap-2 group"
                            >
                                <Plus size={14} weight="bold" />
                                <span>הוסף שדה מותאם חדש</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Field Creation Modal */}
            <GenericModal
                isOpen={isCreatingField}
                onClose={() => setIsCreatingField(false)}
                title="הגדרת שדה חדש"
                size="sm"
                footer={
                    <div className="flex gap-3 w-full">
                        <Button
                            variant="primary"
                            onClick={handleCreateField}
                            disabled={!creatingFieldData.label}
                            className="flex-1"
                        >
                            שמור שדה
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => setIsCreatingField(false)}
                            className="flex-1"
                        >
                            ביטול
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">שם השדה</label>
                        <Input
                            placeholder="לדוגמה: מידת נעליים"
                            value={creatingFieldData.label}
                            onChange={e => setCreatingFieldData({ ...creatingFieldData, label: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">סוג שדה</label>
                        <Select
                            value={creatingFieldData.type}
                            onChange={val => setCreatingFieldData({ ...creatingFieldData, type: val })}
                            options={[
                                { value: 'text', label: 'טקסט חופשי' },
                                { value: 'number', label: 'מספר' },
                                { value: 'phone', label: 'טלפון' },
                                { value: 'email', label: 'אימייל' },
                                { value: 'date', label: 'תאריך' },
                                { value: 'boolean', label: 'כן/לא' },
                                { value: 'select', label: 'רשימת בחירה' },
                                { value: 'multiselect', label: 'בחירה מרובה' },
                                { value: 'textarea', label: 'טקסט ארוך' }
                            ]}
                        />
                    </div>
                    {(creatingFieldData.type === 'select' || creatingFieldData.type === 'multiselect') && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">אפשרויות בחירה</label>
                            <Input
                                placeholder="הפרד בפסיק (דוגמה: S,M,L,XL)"
                                value={creatingFieldData.optionsString}
                                onChange={e => setCreatingFieldData({ ...creatingFieldData, optionsString: e.target.value })}
                            />
                        </div>
                    )}
                </div>
            </GenericModal>
        </GenericModal>
    );
};
