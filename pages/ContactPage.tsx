import React, { useState, useRef } from 'react';
import { Mail, Phone, User, Send, MessageSquare, Upload, X, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

export const ContactPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [name, setName] = useState(user?.user_metadata?.full_name || '');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            let imageUrl = null;

            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${uuidv4()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('contact_uploads')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('contact_uploads')
                    .getPublicUrl(filePath);

                imageUrl = publicUrl;
            }

            const { error: insertError } = await supabase
                .from('contact_messages')
                .insert({
                    name,
                    phone,
                    message,
                    image_url: imageUrl,
                    user_id: user?.id || null
                });

            if (insertError) throw insertError;

            setIsSuccess(true);
            setMessage('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error) {
            console.error('Error submitting contact form:', error);
            showToast('שגיאה בשליחת ההודעה. אנא נסה שוב מאוחר יותר.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Mail className="text-blue-600" />
                        צור קשר
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">
                        יש לכם הצעה לשיפור? נתקלתם בבעיה? נשמח לשמוע מכם!
                    </p>
                </div>

                {isSuccess ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Send className="text-green-600" size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">ההודעה נשלחה בהצלחה!</h3>
                        <p className="text-slate-600 mb-6">נחזור אליך בהקדם האפשרי</p>
                        <Button
                            onClick={() => setIsSuccess(false)}
                            variant="primary"
                            className="w-full sm:w-auto"
                        >
                            שלח הודעה נוספת
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div>
                            <Input
                                label="שם מלא"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                icon={User}
                                placeholder="השם שלך"
                            />
                        </div>

                        <div>
                            <Input
                                label="טלפון (אופציונלי)"
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                icon={Phone}
                                placeholder="מספר נייד לחזרה"
                                className="text-right"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">תוכן ההודעה</label>
                            <div className="relative">
                                <MessageSquare className="absolute right-3 top-3 text-slate-400" size={18} />
                                <textarea
                                    required
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none resize-none text-slate-900 text-base md:text-sm"
                                    placeholder="כתבו כאן את ההודעה..."
                                ></textarea>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">צרף תמונה (אופציונלי)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                    id="file-upload"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                                >
                                    <Upload size={16} />
                                    בחר קובץ
                                </label>
                                {file && (
                                    <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm">
                                        <span className="truncate max-w-[200px]">{file.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFile(null);
                                                if (fileInputRef.current) fileInputRef.current.value = '';
                                            }}
                                            className="hover:bg-blue-100 rounded-full p-0.5"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                isLoading={isSubmitting}
                                className="w-full shadow-lg shadow-blue-200"
                                size="lg"
                                icon={Send}
                            >
                                שלח הודעה
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
