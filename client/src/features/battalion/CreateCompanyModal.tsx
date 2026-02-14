import React, { useState } from 'react';
import { Buildings, Plus, CircleNotch } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { createCompanyUnderBattalion } from '../../services/battalionService';

interface CreateCompanyModalProps {
    battalionId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({ battalionId, isOpen, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            await createCompanyUnderBattalion(battalionId, name.trim());
            showToast('הפלוגה נוצרה בהצלחה!', 'success');
            setName('');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error creating company:', error);
            showToast('שגיאה ביצירת הפלוגה: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm">
                            <Buildings size={32} weight="bold" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">הקמת פלוגה חדשה</h2>
                            <p className="text-slate-500 font-bold">הוספת פלוגה חדשה תחת הגדוד שלך</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                        <Input
                            label="שם הפלוגה"
                            placeholder="למשל: פלוגה ג'"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            autoFocus
                            className="text-lg font-bold"
                        />

                        <div className="flex gap-4">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onClose}
                                className="flex-1 h-14 text-lg font-bold"
                            >
                                ביטול
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                isLoading={loading}
                                icon={Plus}
                                className="flex-[1.5] h-14 text-lg font-black shadow-xl shadow-blue-200 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                צור פלוגה
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
