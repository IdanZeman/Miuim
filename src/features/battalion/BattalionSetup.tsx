import React, { useState } from 'react';
import { Shield, SparkleIcon as Sparkles, Copy, Check, ArrowRight } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../contexts/ToastContext';
import { createBattalion } from '../../services/battalionService';
import { Battalion } from '../../types';

interface BattalionSetupProps {
    onSuccess?: (battalion: Battalion) => void;
}

export const BattalionSetup: React.FC<BattalionSetupProps> = ({ onSuccess }) => {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [createdBattalion, setCreatedBattalion] = useState<Battalion | null>(null);
    const [copied, setCopied] = useState(false);
    const { showToast } = useToast();

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            const battalion = await createBattalion(name.trim());
            setCreatedBattalion(battalion);
            showToast('הגדוד נוצר בהצלחה!', 'success');
            if (onSuccess) onSuccess(battalion);
        } catch (error: any) {
            console.error('Error creating battalion:', error);
            showToast('שגיאה ביצירת הגדוד: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        if (!createdBattalion) return;
        navigator.clipboard.writeText(createdBattalion.code);
        setCopied(true);
        showToast('הקוד הועתק ללוח', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    if (createdBattalion) {
        return (
            <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 max-w-md mx-auto animate-in fade-in zoom-in duration-500">
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 bg-green-50 text-green-600 rounded-3xl mx-auto flex items-center justify-center shadow-sm">
                        <Shield size={40} />
                    </div>

                    <div>
                        <h2 className="text-2xl font-black text-slate-900">גדוד {createdBattalion.name} נוצר!</h2>
                        <p className="text-slate-500 font-bold mt-2">שתף את הקוד הזה עם מנהלי הפלוגות כדי שיצטרפו אליך:</p>
                    </div>

                    <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200 flex items-center justify-between group">
                        <span className="text-4xl font-black text-blue-600 tracking-widest font-mono">
                            {createdBattalion.code}
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={copied ? Check : Copy}
                            onClick={copyCode}
                            className={copied ? 'text-green-600' : 'text-slate-400 group-hover:text-blue-600'}
                        >
                            {copied ? 'הועתק' : 'העתק'}
                        </Button>
                    </div>

                    <div className="pt-4">
                        <p className="text-xs text-slate-400 font-medium">
                            ניתן למצוא את הקוד בכל עת בהגדרות הגדוד.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto py-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-sm">
                    <Shield size={32} strokeWidth={2.5} />
                </div>
                <p className="text-slate-500 font-bold">צור מבט על אחוד עבור כלל הפלוגות של הגדוד.</p>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
                <Input
                    label="שם הגדוד"
                    placeholder="למשל: גדוד 123"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="!bg-gray-50 text-lg font-bold"
                />

                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex gap-3">
                    <Sparkles className="text-blue-500 shrink-0" size={20} />
                    <p className="text-xs text-blue-700 font-medium leading-relaxed">
                        יצירת גדוד תגדיר אותך כ"מפקד גדוד" ותאפשר לך לצפות בנתוני כוח אדם, נוכחות ושיבוצים של כל פלוגה שתתחבר אליך.
                    </p>
                </div>

                <Button
                    type="submit"
                    variant="primary"
                    className="w-full h-12 text-lg shadow-lg shadow-blue-200"
                    isLoading={loading}
                    icon={ArrowRight}
                >
                    צור גדוד והמשך
                </Button>
            </form>
        </div>
    );
};
