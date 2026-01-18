import React, { useState } from 'react';
import { CustomFieldDefinition, CustomFieldType } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import {
    Plus,
    Trash,
    PencilSimple,
    Copy,
    TextT,
    TextAlignLeft,
    Hash,
    ToggleLeft,
    ListBullets,
    CalendarBlank,
    Phone,
    At
} from '@phosphor-icons/react';

interface CustomFieldsManagerProps {
    fields: CustomFieldDefinition[];
    onFieldsChange: (fields: CustomFieldDefinition[]) => void;
}

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string; icon: any }[] = [
    { value: 'text', label: 'טקסט קצר', icon: TextT },
    { value: 'textarea', label: 'טקסט ארוך', icon: TextAlignLeft },
    { value: 'number', label: 'מספר', icon: Hash },
    { value: 'boolean', label: 'כן/לא', icon: ToggleLeft },
    { value: 'select', label: 'בחירה יחידה', icon: ListBullets },
    { value: 'multiselect', label: 'בחירה מרובה', icon: ListBullets },
    { value: 'date', label: 'תאריך', icon: CalendarBlank },
    { value: 'phone', label: 'טלפון', icon: Phone },
    { value: 'email', label: 'אימייל', icon: At },
];

export const CustomFieldsManager: React.FC<CustomFieldsManagerProps> = ({ fields, onFieldsChange }) => {
    const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleAddField = () => {
        const newField: CustomFieldDefinition = {
            id: `field_${Date.now()}`,
            key: '',
            label: '',
            type: 'text',
            required: false,
            order: fields.length,
        };
        setEditingField(newField);
        setIsCreating(true);
    };

    const handleEditField = (field: CustomFieldDefinition) => {
        setEditingField({ ...field });
        setIsCreating(false);
    };

    const handleDuplicateField = (field: CustomFieldDefinition) => {
        const duplicatedField: CustomFieldDefinition = {
            ...field,
            id: `field_${Date.now()}`,
            key: `${field.key}_copy`,
            label: `${field.label} (עותק)`,
            order: fields.length,
        };
        onFieldsChange([...fields, duplicatedField]);
    };

    const handleDeleteField = (fieldId: string) => {
        if (confirm('האם אתה בטוח שברצונך למחוק שדה זה?')) {
            onFieldsChange(fields.filter(f => f.id !== fieldId));
        }
    };

    const handleSaveField = (field: CustomFieldDefinition) => {
        if (isCreating) {
            onFieldsChange([...fields, field]);
        } else {
            onFieldsChange(fields.map(f => f.id === field.id ? field : f));
        }
        setEditingField(null);
        setIsCreating(false);
    };

    const moveField = (index: number, direction: 'up' | 'down') => {
        const newFields = [...fields];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newFields.length) return;

        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
        newFields.forEach((f, i) => f.order = i);

        onFieldsChange(newFields);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-black text-slate-800">שדות מותאמים אישית</h3>
                    <p className="text-sm text-slate-500">הגדר שדות נוספים לחיילים</p>
                </div>
                <Button
                    onClick={handleAddField}
                    variant="primary"
                    icon={Plus}
                    className="font-bold"
                >
                    הוסף שדה
                </Button>
            </div>

            {fields.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-400 mb-4">לא הוגדרו שדות מותאמים אישית</p>
                    <Button onClick={handleAddField} variant="secondary" icon={Plus}>
                        הוסף שדה ראשון
                    </Button>
                </div>
            ) : (
                <div className="space-y-2">
                    {fields.sort((a, b) => (a.order || 0) - (b.order || 0)).map((field, index) => {
                        const TypeIcon = FIELD_TYPE_OPTIONS.find(opt => opt.value === field.type)?.icon || TextT;
                        return (
                            <div
                                key={field.id}
                                className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group"
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                                        <TypeIcon size={20} weight="bold" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 truncate">{field.label}</div>
                                        <div className="text-xs text-slate-400 truncate">
                                            {FIELD_TYPE_OPTIONS.find(opt => opt.value === field.type)?.label} • {field.key}
                                            {field.required && ' • נדרש'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {index > 0 && (
                                        <Button
                                            onClick={() => moveField(index, 'up')}
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-400 hover:text-slate-600"
                                            title="הזז למעלה"
                                        >
                                            ↑
                                        </Button>
                                    )}
                                    {index < fields.length - 1 && (
                                        <Button
                                            onClick={() => moveField(index, 'down')}
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-400 hover:text-slate-600"
                                            title="הזז למטה"
                                        >
                                            ↓
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => handleDuplicateField(field)}
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-blue-600"
                                        title="שכפל שדה"
                                    >
                                        <Copy size={16} weight="bold" />
                                    </Button>
                                    <Button
                                        onClick={() => handleEditField(field)}
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-green-600"
                                        title="ערוך שדה"
                                    >
                                        <PencilSimple size={16} weight="bold" />
                                    </Button>
                                    <Button
                                        onClick={() => handleDeleteField(field.id)}
                                        variant="ghost"
                                        size="sm"
                                        className="text-slate-400 hover:text-red-600"
                                        title="מחק שדה"
                                    >
                                        <Trash size={16} weight="bold" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editingField && (
                <FieldEditorModal
                    field={editingField}
                    isCreating={isCreating}
                    onClose={() => {
                        setEditingField(null);
                        setIsCreating(false);
                    }}
                    onSave={handleSaveField}
                    existingKeys={fields.filter(f => f.id !== editingField.id).map(f => f.key)}
                />
            )}
        </div>
    );
};

interface FieldEditorModalProps {
    field: CustomFieldDefinition;
    isCreating: boolean;
    onClose: () => void;
    onSave: (field: CustomFieldDefinition) => void;
    existingKeys: string[];
}

const FieldEditorModal: React.FC<FieldEditorModalProps> = ({ field, isCreating, onClose, onSave, existingKeys }) => {
    const [editedField, setEditedField] = useState<CustomFieldDefinition>(field);
    const [optionsText, setOptionsText] = useState(field.options?.join('\n') || '');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateField = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!editedField.label.trim()) {
            newErrors.label = 'שם השדה הוא שדה חובה';
        }

        if (!editedField.label.trim()) {
            newErrors.label = 'שם השדה הוא שדה חובה';
        }

        if ((editedField.type === 'select' || editedField.type === 'multiselect') && !optionsText.trim()) {
            newErrors.options = 'יש להגדיר לפחות אפשרות אחת';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = () => {
        if (!validateField()) return;

        const options = (editedField.type === 'select' || editedField.type === 'multiselect')
            ? optionsText.split('\n').map(opt => opt.trim()).filter(Boolean)
            : undefined;

        let key = editedField.key;
        if (!key) {
            // Generate a technical key from the label (if English) or using a random ID
            const slug = editedField.label.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
            key = slug && /^[a-z]/.test(slug) ? `cf_${slug}` : `cf_${Math.random().toString(36).substr(2, 9)}`;
        }

        onSave({
            ...editedField,
            key,
            options,
            updated_at: new Date().toISOString(),
        });
    };

    const TypeIcon = FIELD_TYPE_OPTIONS.find(opt => opt.value === editedField.type)?.icon || TextT;

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                        <TypeIcon size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">
                            {isCreating ? 'הוסף שדה חדש' : 'ערוך שדה'}
                        </h2>
                        <p className="text-sm text-slate-400">הגדר את מאפייני השדה</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="font-bold">
                        ביטול
                    </Button>
                    <Button variant="primary" onClick={handleSave} className="font-bold">
                        {isCreating ? 'צור שדה' : 'שמור שינויים'}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <Input
                    label="שם השדה *"
                    value={editedField.label}
                    onChange={(e) => setEditedField({ ...editedField, label: e.target.value })}
                    placeholder="לדוגמה: מספר אישי"
                    error={errors.label}
                />



                <Select
                    label="סוג השדה *"
                    value={editedField.type}
                    onChange={(value) => setEditedField({ ...editedField, type: value as CustomFieldType })}
                    options={FIELD_TYPE_OPTIONS.map(opt => ({
                        value: opt.value,
                        label: opt.label,
                    }))}
                />

                {(editedField.type === 'select' || editedField.type === 'multiselect') && (
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            אפשרויות * (אחת בכל שורה)
                        </label>
                        <textarea
                            value={optionsText}
                            onChange={(e) => setOptionsText(e.target.value)}
                            placeholder="אפשרות 1&#10;אפשרות 2&#10;אפשרות 3"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-base font-medium resize-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:bg-white outline-none"
                            rows={5}
                        />
                        {errors.options && <p className="text-xs text-red-600 mt-1">{errors.options}</p>}
                    </div>
                )}

                <Input
                    label="טקסט עזרה (אופציונלי)"
                    value={editedField.helpText || ''}
                    onChange={(e) => setEditedField({ ...editedField, helpText: e.target.value })}
                    placeholder="הסבר קצר על השדה"
                />

                <Input
                    label="Placeholder (אופציונלי)"
                    value={editedField.placeholder || ''}
                    onChange={(e) => setEditedField({ ...editedField, placeholder: e.target.value })}
                    placeholder="טקסט שיופיע בשדה ריק"
                />

                <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                    <input
                        type="checkbox"
                        id="required"
                        checked={editedField.required || false}
                        onChange={(e) => setEditedField({ ...editedField, required: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label htmlFor="required" className="text-sm font-bold text-slate-700 cursor-pointer">
                        שדה חובה
                    </label>
                </div>
            </div>
        </Modal>
    );
};
