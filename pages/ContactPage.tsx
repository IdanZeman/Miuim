import React, { useState, useRef } from 'react';
import { Mail, Phone, User, Send, MessageSquare, Upload, X, Loader2, Check, Clock, MapPin, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../contexts/ToastContext';
import { v4 as uuidv4 } from 'uuid';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';

export const ContactPage: React.FC = () => {
    const { user } = useAuth();
    const { showToast } = useToast();

    // Form State
    const [subject, setSubject] = useState('general');
    const [name, setName] = useState(user?.user_metadata?.full_name || '');
    const [phone, setPhone] = useState('');
    const [message, setMessage] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    // Drag & Drop Handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setFile(e.dataTransfer.files[0]);
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
                    email: user?.email || null,
                    message: `[Subject: ${subject}]\n\n${message}`,
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

    // Success View
    if (isSuccess) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-8 md:p-12 text-center max-w-md w-full shadow-xl animate-in fade-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="text-green-600" size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-2">ההודעה נשלחה!</h3>
                    <p className="text-slate-500 mb-8 font-medium">תודה שפנית אלינו. נחזור אליך בהקדם האפשרי.</p>
                    <Button
                        onClick={() => setIsSuccess(false)}
                        className="w-full"
                        size="lg"
                    >
                        שלח הודעה נוספת
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen md:min-h-0 bg-slate-50 md:bg-transparent" dir="rtl">

            {/* ================= MOBILE LAYOUT (< md) ================= */}
            <div className="md:hidden">
                {/* 1. White Header Area */}
                <div className="bg-white text-slate-900 pt-10 pb-20 px-6 relative overflow-hidden rounded-b-[2.5rem] shadow-sm ring-1 ring-slate-100">
                    <div className="relative z-10 text-center space-y-3 mb-4">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 shadow-sm mb-2">
                            <Mail size={28} />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">צור קשר</h1>
                        <p className="text-slate-500 font-medium text-base">אנחנו כאן לכל שאלה, רעיון או בעיה.</p>
                    </div>
                </div>

                {/* 2. White Form Card */}
                <div className="mx-4 -mt-10 relative z-20 mb-8">
                    <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-6 space-y-6 border border-slate-100">

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mr-1">נושא הפנייה</label>
                            <Select
                                value={subject}
                                onChange={setSubject}
                                options={[
                                    { value: 'general', label: '💬 פנייה בנושא כללי' },
                                    { value: 'bug', label: '🐛 דיווח על תקלה' },
                                    { value: 'feature', label: '✨ הצעה לפיצ׳ר חדש' },
                                    { value: 'join', label: '🛡️ הצטרפות ליחידה' }
                                ]}
                                placeholder="בחר נושא"
                                className="!bg-slate-50 border-slate-200 h-12"
                            />
                        </div>

                        <Input
                            label="שם מלא"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            icon={User}
                            placeholder="השם שלך"
                            className="!bg-slate-50 border-slate-200 focus:bg-white"
                        />

                        <Input
                            label="טלפון"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            icon={Phone}
                            placeholder="050-0000000"
                            className="!bg-slate-50 border-slate-200 focus:bg-white text-right"
                        />

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mr-1">הודעה</label>
                            <textarea
                                required
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                rows={5}
                                className="w-full p-4 rounded-xl border border-slate-200 !bg-slate-50 focus:!bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none resize-none text-slate-900 text-sm font-medium shadow-sm"
                                placeholder="ספר לנו מה עובר עליך..."
                            ></textarea>
                        </div>

                        {/* File Upload Mobile */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 mr-1">קבצים (אופציונלי)</label>
                            <div className="space-y-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                    id="mobile-file-upload"
                                />
                                <label
                                    htmlFor="mobile-file-upload"
                                    className="w-full cursor-pointer flex items-center justify-center gap-2 p-4 !bg-slate-50 border border-dashed border-slate-300 rounded-xl text-slate-500 hover:bg-slate-100 transition-all active:scale-95 shadow-sm group"
                                >
                                    <div className="bg-white p-1.5 rounded-full shadow-sm text-indigo-500 group-hover:scale-110 transition-transform"><Upload size={16} /></div>
                                    <span className="text-xs font-bold">צרף תמונה / צילום מסך</span>
                                </label>
                                {file && (
                                    <div className="flex items-center justify-between bg-indigo-50 text-indigo-700 px-4 py-3 rounded-xl text-xs font-bold border border-indigo-100 animate-in fade-in slide-in-from-top-1">
                                        <div className="flex items-center gap-2">
                                            <Check size={14} className="text-indigo-500" />
                                            <span className="truncate max-w-[200px]">{file.name}</span>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="p-1 hover:bg-indigo-100 rounded-full transition-colors"><X size={14} /></button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Button Inline */}
                        <div className="pt-2">
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !message || !name}
                                isLoading={isSubmitting}
                                className="w-full bg-slate-900 hover:bg-slate-800 shadow-xl shadow-slate-200 text-white h-14 text-lg rounded-2xl"
                                fullWidth
                            >
                                {isSubmitting ? 'שולח...' : 'שלח הודעה'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>


            {/* ================= DESKTOP LAYOUT (md:flex) ================= */}
            <div className="hidden md:flex justify-center items-center py-12 px-4">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full grid grid-cols-5 min-h-[600px] border border-slate-100">

                    {/* Left Column: Info & Branding */}
                    <div className="col-span-2 bg-slate-900 text-white p-10 flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-500 via-purple-500 to-transparent"></div>

                        <div className="relative z-10 h-full flex flex-col">
                            <h2 className="text-3xl font-black mb-6 leading-tight">בואו נדבר! 👋</h2>

                            <div className="flex-1 flex flex-col justify-center space-y-6">
                                <p className="text-slate-300 text-lg leading-relaxed">
                                    המשוב שלכם חשוב לנו!
                                    <br /><br />
                                    אנחנו עושים מאמצים רבים כדי לייעל ולשפר את המערכת. כל רעיון, דיווח על תקלה או סתם מילה טובה עוזרים לנו לבנות כלי טוב יותר עבורכם.
                                </p>

                            </div>
                        </div>

                        <div className="mt-auto relative z-10 pt-10">
                            <div className="flex gap-3">
                                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Form */}
                    <div className="col-span-3 p-10 bg-white">
                        <form onSubmit={handleSubmit} className="h-full flex flex-col space-y-5">
                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700">נושא הפנייה</label>
                                <Select
                                    value={subject}
                                    onChange={setSubject}
                                    options={[
                                        { value: 'general', label: '💬 פנייה בנושא כללי' },
                                        { value: 'bug', label: '🐛 דיווח על תקלה' },
                                        { value: 'feature', label: '✨ הצעה לפיצ׳ר חדש' },
                                        { value: 'join', label: '🛡️ הצטרפות ליחידה' }
                                    ]}
                                    placeholder="בחר נושא..."
                                    className="bg-slate-50 h-12 border-slate-200"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="שם מלא"
                                    required
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="שמך המלא"
                                    className="bg-slate-50 border-slate-200 h-12 focus:bg-white"
                                />
                                <Input
                                    label="טלפון"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="מספר טלפון"
                                    className="bg-slate-50 border-slate-200 h-12 focus:bg-white text-right"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-bold text-slate-700">הודעה</label>
                                <textarea
                                    required
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    rows={5}
                                    className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all outline-none resize-none text-slate-900 text-sm font-medium"
                                    placeholder="ספר לנו מה עובר עליך..."
                                ></textarea>
                            </div>

                            {/* Drag & Drop Zone */}
                            <div
                                className={`
                                    border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer group
                                    ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'}
                                    ${file ? 'bg-green-50 border-green-200' : ''}
                                `}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                                {file ? (
                                    <div className="flex items-center justify-center gap-2 text-green-700 font-bold">
                                        <div className="w-8 h-8 bg-green-200 rounded-full flex items-center justify-center"><Check size={16} /></div>
                                        <span>קובץ נבחר: {file.name}</span>
                                        <button onClick={(e) => { e.stopPropagation(); setFile(null); }} className="hover:text-red-500 p-1"><X size={16} /></button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform">
                                            <Upload size={24} />
                                        </div>
                                        <p className="text-sm font-bold text-slate-600">גרור קובץ לכאן או לחץ להעלאה</p>
                                        <p className="text-xs text-slate-400 mt-1">PNG, JPG עד 5MB</p>
                                    </>
                                )}
                            </div>

                            <div className="pt-2 mt-auto">
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !message || !name}
                                    isLoading={isSubmitting}
                                    className="w-full py-4 text-base bg-slate-900 hover:bg-slate-800 text-white shadow-xl shadow-slate-200"
                                >
                                    {isSubmitting ? 'שולח...' : 'שלח הודעה'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};
