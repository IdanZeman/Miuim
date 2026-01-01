import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Envelope, Phone, User, PaperPlaneRight, CircleNotch, ArrowRight, UploadSimple, X } from '@phosphor-icons/react';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../services/loggingService';

export const ContactUsPage: React.FC = () => {
    const { showToast } = useToast();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        logger.log({ action: 'CLICK', entityType: 'button', entityName: 'submit_contact_form', category: 'ui' });

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
                    email, // email field might be new or replace phone in some versions, here we use both
                    message,
                    image_url: imageUrl,
                    user_id: null // Guest user
                });

            if (insertError) throw insertError;

            setIsSuccess(true);
            setMessage('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            showToast('ההודעה נשלחה בהצלחה!', 'success');

            logger.log({
                action: 'SUBMIT',
                entityType: 'form',
                entityName: 'contact_form',
                category: 'data',
                metadata: { hasImage: !!imageUrl }
            });

        } catch (error: any) {
            console.error('Error submitting contact form:', error);
            showToast('שגיאה בשליחת ההודעה. אנא נסה שוב מאוחר יותר.', 'error');
            logger.logError(error, 'ContactPage:Submit');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col items-center justify-center p-6" dir="rtl">

            <a href="/landing-v2" className="absolute top-8 right-8 flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-bold">
                <ArrowRight weight="bold" />
                חזרה לדף הבית
            </a>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden"
            >
                <div className="bg-slate-900 p-8 text-white text-center">
                    <h1 className="text-3xl font-black mb-2">צור קשר</h1>
                    <p className="text-slate-400">יש לך שאלה? מעוניין בהדגמה? אנחנו כאן.</p>
                </div>

                <div className="p-8">
                    {isSuccess ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <PaperPlaneRight size={32} weight="fill" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 mb-2">ההודעה נשלחה!</h3>
                            <p className="text-slate-500 mb-6">תודה שפנית אלינו, נחזור אליך בהקדם.</p>
                            <button onClick={() => setIsSuccess(false)} className="text-blue-600 font-bold hover:underline">
                                שליחת הודעה נוספת
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">שם מלא</label>
                                    <div className="relative">
                                        <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                        <input
                                            type="text"
                                            required
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="ישראל ישראלי"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">טלפון</label>
                                    <div className="relative">
                                        <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                        <input
                                            type="tel"
                                            required
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-right"
                                            placeholder="050-0000000"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">אימייל</label>
                                <div className="relative">
                                    <Envelope className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-10 pl-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                        placeholder="your@email.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">הודעה</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    placeholder="כתוב לנו כאן..."
                                ></textarea>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700">צרף תמונה (אופציונלי)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                        id="file-upload-contact"
                                    />
                                    <label
                                        htmlFor="file-upload-contact"
                                        className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl transition-all font-medium"
                                    >
                                        <UploadSimple size={18} weight="duotone" />
                                        בחר קובץ
                                    </label>
                                    {file && (
                                        <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm border border-blue-100 animate-in fade-in slide-in-from-right-2">
                                            <span className="truncate max-w-[200px] font-medium">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFile(null);
                                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                                }}
                                                className="hover:bg-blue-100 rounded-full p-1 transition-colors"
                                            >
                                                <X size={14} weight="bold" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 hover:-translate-y-1"
                            >
                                {isSubmitting ? (
                                    <>
                                        <CircleNotch size={24} className="animate-spin" />
                                        <span>שולח...</span>
                                    </>
                                ) : (
                                    <>
                                        <PaperPlaneRight size={20} weight="duotone" />
                                        <span>שלח הודעה</span>
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
