import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, TaskTemplate, Person, Role } from '../../types';
import { Modal as GenericModal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
    X, Clock, Calendar as CalendarIcon, History, MessageSquare, Send,
    FileText, CheckCircle, Users, Shield, AlertTriangle, Info, MessageCircle, ChevronDown, ChevronUp, Pencil, Printer
} from 'lucide-react';
import { useMissionReports } from '../../hooks/useMissionReports';
import { useToast } from '../../contexts/ToastContext';
import { getPersonInitials } from '../../utils/nameUtils';

interface MissionReportModalProps {
    shift: Shift;
    task: TaskTemplate;
    people: Person[]; // Added for Crew Manifest
    roles: Role[];   // Added for Crew Manifest
    isViewer: boolean;
    onClose: () => void;
    onRefreshData?: () => void;
}

export const MissionReportModal: React.FC<MissionReportModalProps> = ({
    shift,
    task,
    people = [],
    roles = [],
    isViewer,
    onClose,
    onRefreshData
}) => {
    const { showToast } = useToast();
    const { report, isLoading: isReportLoading, fetchReport, addNote, upsertReport } = useMissionReports(shift.id);
    const [noteText, setNoteText] = useState('');
    const [reportForm, setReportForm] = useState({
        summary: '',
        exceptional_events: '',
        points_to_preserve: '',
        points_to_improve: '',
        cumulative_info: ''
    });

    // Mobile Tabs State
    const [activeMobileTab, setActiveMobileTab] = useState<'timeline' | 'report'>('timeline');

    // Fetch report on mount
    useEffect(() => {
        if (shift.id) {
            fetchReport(shift.id);
        }
    }, [shift.id, fetchReport]);

    // Sync report form when report is loaded
    useEffect(() => {
        if (report) {
            setReportForm({
                summary: report.summary || '',
                exceptional_events: report.exceptional_events || '',
                points_to_preserve: report.points_to_preserve || '',
                points_to_improve: report.points_to_improve || '',
                cumulative_info: report.cumulative_info || ''
            });
        }
    }, [report]);

    const isMissionStarted = useMemo(() => new Date(shift.startTime) <= new Date(), [shift.startTime]);
    const isMissionEnded = useMemo(() => new Date(shift.endTime) <= new Date(), [shift.endTime]);

    // Crew Manifest
    const assignedCrew = useMemo(() => {
        return shift.assignedPersonIds
            .map(id => people.find(p => p.id === id))
            .filter(Boolean) as Person[];
    }, [shift.assignedPersonIds, people]);

    const handleAddNote = async () => {
        if (!noteText.trim()) return;
        await addNote(noteText);
        setNoteText('');
        showToast('הערה נוספה לציר הזמן', 'success');
    };

    const handleSubmitReport = async () => {
        await upsertReport({
            ...reportForm,
            submitted_at: new Date().toISOString()
        });
        showToast('דוח משימה הוגש בהצלחה', 'success');
        onRefreshData?.();
    };

    // Auto-scroll to bottom of log
    const logEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (report?.ongoing_log) {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [report?.ongoing_log, activeMobileTab]);


    if (!task) return null;

    return (
        <GenericModal
            isOpen={true}
            onClose={onClose}
            closeIcon="back"
            title={null}
            hideDefaultHeader={true}
            size="2xl"
            scrollableContent={false}
            className="p-0 overflow-hidden flex flex-col h-[90vh] md:h-[85vh] md:max-h-[85vh] print:fixed print:inset-0 print:max-h-none print:h-full print:m-0 print:rounded-none print:shadow-none print:z-[99999]" // Rule 5: Uniform height & Print fix
        >
            <style dangerouslySetInnerHTML={{
                __html: `
                @media print {
                    body * { visibility: hidden !important; overflow: visible !important; }
                    #print-section, #print-section * { visibility: visible !important; }
                    #print-section { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
                    .print\\:hidden { display: none !important; }
                    @page { size: portrait; margin: 1cm; }
                }
            `}} />
            {/* --- PRINT LAYOUT (Hidden on Screen) --- */}
            <div id="print-section" className="hidden print:block print:p-8 print:w-full font-sans" dir="rtl">
                <div className="text-center mb-6 border-b-2 border-slate-800 pb-4">
                    <h1 className="text-2xl font-black text-slate-900 mb-1">דוח סיכום משמרת</h1>
                    <div className="flex justify-center gap-4 text-sm text-slate-600 font-bold">
                        <span>{task.name}</span>
                        <span>|</span>
                        <span>{new Date(shift.startTime).toLocaleDateString('he-IL')}</span>
                        <span>|</span>
                        <span>{new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                {/* Print Metadata */}
                <div className="grid grid-cols-2 gap-8 mb-6 text-sm">
                    <div className="border border-slate-300 p-4 rounded-lg">
                        <h3 className="font-bold border-b border-slate-200 pb-2 mb-2">פרטי הגשה</h3>
                        <div className="space-y-1">
                            <p><span className="text-slate-500">הוגש ע"י:</span> <b>{report?.submitted_by ? people.find(p => p.userId === report.submitted_by)?.name : 'לא ידוע'}</b></p>
                            <p><span className="text-slate-500">תאריך:</span> {report?.submitted_at ? new Date(report.submitted_at).toLocaleString('he-IL') : 'טרם הוגש'}</p>
                        </div>
                    </div>
                    <div className="border border-slate-300 p-4 rounded-lg">
                        <h3 className="font-bold border-b border-slate-200 pb-2 mb-2">צוות משמרת</h3>
                        <div className="flex flex-wrap gap-2">
                            {assignedCrew.map(p => (
                                <span key={p.id} className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-xs font-bold">
                                    {p.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Print Live Log (Now Second Section) */}
                {report?.ongoing_log && report.ongoing_log.length > 0 && (
                    <div className="mb-8 border border-slate-300 rounded-lg overflow-hidden break-inside-avoid shadow-sm print:shadow-none">
                        <div className="bg-slate-50 px-4 py-2 font-bold border-b border-slate-300 text-slate-800 flex items-center gap-2">
                            <History size={16} /> יומן מבצעים
                        </div>
                        <table className="w-full text-xs text-right">
                            <thead className="bg-white border-b border-slate-200">
                                <tr>
                                    <th className="p-2 w-20 border-l border-slate-100 text-slate-500 font-medium">שעה</th>
                                    <th className="p-2 w-32 border-l border-slate-100 text-slate-500 font-medium">מדווח</th>
                                    <th className="p-2 text-slate-500 font-medium">דיווח</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {report.ongoing_log.map((note, idx) => (
                                    <tr key={idx}>
                                        <td className="p-2 font-mono text-slate-500 border-l border-slate-100 align-top">
                                            {new Date(note.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="p-2 font-bold text-slate-700 border-l border-slate-100 align-top">
                                            {note.user_name || 'מערכת'}
                                        </td>
                                        <td className="p-2 text-slate-900 align-top whitespace-pre-wrap">
                                            {note.text}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Print Summary Sections (Now Third/Bottom Section) */}
                <div className="space-y-4 mb-6 text-sm break-inside-avoid">
                    <div className="flex items-center gap-2 text-lg font-bold text-slate-800 mb-2 border-b border-slate-300 pb-1">
                        <FileText size={18} /> סיכום משימה
                    </div>

                    <div className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid">
                        <div className="bg-slate-50 px-3 py-1.5 font-bold border-b border-slate-300 text-slate-700 text-xs uppercase">סיכום מפקד</div>
                        <div className="p-3 min-h-[40px] whitespace-pre-wrap">{reportForm.summary || 'אין תוכן'}</div>
                    </div>

                    <div className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid">
                        <div className="bg-slate-50 px-3 py-1.5 font-bold border-b border-slate-300 text-slate-700 text-xs uppercase">חריגים</div>
                        <div className="p-3 min-h-[40px] whitespace-pre-wrap">{reportForm.exceptional_events || 'אין חריגים'}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid">
                            <div className="bg-emerald-50 px-3 py-1.5 font-bold border-b border-emerald-200 text-emerald-800 text-xs uppercase">שימור</div>
                            <div className="p-3 min-h-[40px] whitespace-pre-wrap">{reportForm.points_to_preserve || '-'}</div>
                        </div>
                        <div className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid">
                            <div className="bg-amber-50 px-3 py-1.5 font-bold border-b border-amber-200 text-amber-800 text-xs uppercase">שיפור</div>
                            <div className="p-3 min-h-[40px] whitespace-pre-wrap">{reportForm.points_to_improve || '-'}</div>
                        </div>
                    </div>

                    <div className="border border-slate-300 rounded-lg overflow-hidden break-inside-avoid">
                        <div className="bg-blue-50 px-3 py-1.5 font-bold border-b border-blue-200 text-blue-800 text-xs uppercase">מידע מצטבר</div>
                        <div className="p-3 min-h-[40px] whitespace-pre-wrap">{reportForm.cumulative_info || '-'}</div>
                    </div>
                </div>

                <div className="mt-8 text-center text-xs text-slate-400">
                    הופק ע"י המערכת בתאריך {new Date().toLocaleString('he-IL')}
                </div>
            </div>

            {/* --- CUSTOM HEADER (Sticky) - Screen Only --- */}
            <div className="bg-white border-b border-slate-200 p-3.5 md:p-4 shrink-0 z-40 shadow-sm flex flex-col gap-3 print:hidden">
                {/* Row 1: Title, Status and Close */}
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-none truncate">
                            {task.name}
                        </h2>

                        {/* Status Badge */}
                        <div className="shrink-0">
                            {report?.submitted_at ? (
                                <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-black border border-emerald-100 uppercase tracking-wider">
                                    <CheckCircle size={14} />
                                    <span>הוגש</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-[10px] md:text-xs font-black border border-blue-100 animate-pulse uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                                    <span>פעיל</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Standard Modal Close Button (Ghost Style) */}
                    <button
                        onClick={onClose}
                        className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all active:scale-90 shrink-0"
                        title="סגור"
                    >
                        <X size={26} />
                    </button>
                </div>

                {/* Row 2: Metadata, Tabs and Print */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 md:gap-4 text-sm md:text-lg text-slate-500 font-bold whitespace-nowrap">
                        <div className="flex items-center gap-2">
                            <CalendarIcon size={18} className="text-slate-400" />
                            <span>{new Date(shift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</span>
                        </div>
                        <span className="text-slate-200">|</span>
                        <div className="flex items-center gap-2 font-mono">
                            <Clock size={18} className="text-slate-400" />
                            <span>
                                {new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                -
                                {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        {/* Mobile Tabs Switcher */}
                        <div className="md:hidden flex bg-slate-100 p-1 rounded-xl items-center border border-slate-200/50">
                            <button
                                onClick={() => setActiveMobileTab('timeline')}
                                className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all ${activeMobileTab === 'timeline' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                            >
                                <History size={18} />
                            </button>
                            <button
                                onClick={() => setActiveMobileTab('report')}
                                className={`w-10 h-9 flex items-center justify-center rounded-lg transition-all ${activeMobileTab === 'report' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
                            >
                                <FileText size={18} />
                            </button>
                        </div>

                        {/* Print Button */}
                        <button
                            onClick={() => window.print()}
                            className="w-10 h-9 md:w-11 md:h-11 flex items-center justify-center bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 transition-all shadow-sm active:scale-95"
                        >
                            <Printer size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* --- MAIN BODY --- */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative print:hidden">

                {/* 1. LEFT COLUMN: CONTEXT & CREW (Desktop: 20%, Mobile: Hidden/Collapsed usually, but let's show as top bar or similar? For now, Desktop only or very compact on mobile) */}
                <div className="hidden md:flex md:w-[20%] md:min-w-[180px] bg-slate-50 border-l border-slate-200 p-4 flex-col gap-6 overflow-y-auto shrink-0 z-30"> {/* Rule 5: ergonomic padding */}
                    <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2"> {/* Rule 2: legible labels */}
                            <Users size={14} /> צוות המשימה
                        </h4>
                        <div className="space-y-2"> {/* Rule 5: more breathing room */}
                            {assignedCrew.map(p => (
                                <div key={p.id} className="flex items-center gap-2.5 p-2 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm ${p.color}`}>
                                        {getPersonInitials(p.name)}
                                    </div>
                                    <div className="flex flex-col leading-tight">
                                        <span className="text-sm font-bold text-slate-800">{p.name}</span> {/* Rule 2: 14px names */}
                                        <span className="text-[10px] text-slate-500 font-medium">
                                            {roles.find(r => (p.roleIds || [p.roleId]).includes(r.id))?.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {assignedCrew.length === 0 && (
                                <span className="text-xs text-slate-400 italic">אין משובצים</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. MIDDLE COLUMN: LIVE TIMELINE (Desktop: 50%, Mobile: Full if Tab Active) */}
                <div className={`
                    flex-1 bg-white flex flex-col min-h-0 overflow-hidden relative transition-all
                    ${activeMobileTab === 'timeline' ? 'flex' : 'hidden md:flex'}
                `}>
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white/95 backdrop-blur sticky top-0 z-20"> {/* Rule 5: more padding */}
                        <span className="text-base font-black text-slate-800 flex items-center gap-2"> {/* Rule 2: 16px header */}
                            <History size={18} className="text-blue-600" /> יומן מבצעים
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4 bg-slate-50/50">
                        {report?.ongoing_log.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                                <MessageCircle size={32} strokeWidth={1.5} className="mb-2" />
                                <span className="text-xs">אין רישומים ביומן</span>
                            </div>
                        ) : (
                            <div className="relative border-r border-slate-200 mr-2 space-y-6 pr-4 min-h-[50px]">
                                {report?.ongoing_log.map((note, idx) => (
                                    <div key={idx} className="relative group">
                                        {/* Timeline Node */}
                                        <div className="absolute -right-[21px] top-0 w-2.5 h-2.5 rounded-full bg-slate-300 border-2 border-white group-hover:bg-blue-500 transition-colors" />

                                        <div className="flex flex-col gap-1.5"> {/* Rule 2: spacing */}
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-sm font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded"> {/* Rule 2: 14px timestamps */}
                                                    {new Date(note.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-base font-bold text-slate-900"> {/* Rule 2: 16px names */}
                                                    {note.user_name || 'מערכת'}
                                                </span>
                                            </div>
                                            <div className="text-base text-slate-800 bg-white p-3 rounded-xl border border-slate-200 shadow-sm leading-relaxed"> {/* Rule 2: 16px body */}
                                                {note.text}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area / Locked State */}
                    {!isViewer && (
                        <div className="p-3 bg-white border-t border-slate-200">
                            {report?.submitted_at ? (
                                /* Locked State Bar */
                                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-emerald-800">
                                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        <Shield size={22} className="text-emerald-600" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-base font-bold">דוח זה הוגש וננעל</span> {/* Rule 2: high contrast */}
                                        <span className="text-sm opacity-80">לא ניתן להוסיף דיווחים חדשים לציר הזמן.</span>
                                    </div>
                                    <div className="mr-auto">
                                        <CheckCircle size={20} className="text-emerald-500" />
                                    </div>
                                </div>
                            ) : (
                                /* Active Input Area */
                                <div className="flex gap-2 items-end">
                                    <textarea
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="הקלד דיווח..."
                                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-blue-500 outline-none resize-none min-h-[52px] max-h-[120px]" // Rule 1 & 2
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddNote();
                                            }
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={handleAddNote}
                                        disabled={!noteText.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shrink-0 w-[52px] h-[52px] rounded-xl" // Rule 1: 48px+
                                    >
                                        <Send size={24} />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. RIGHT COLUMN: FINAL REPORT (Desktop: 30%, Mobile: Full if Tab Active) */}
                <div
                    className={`
                    md:w-[32%] md:border-r border-slate-200 bg-slate-50
                    flex flex-col overflow-hidden print-visible
                    ${activeMobileTab === 'report' ? 'flex flex-1' : 'hidden md:flex'}
                `}>
                    <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-100 sticky top-0 z-20"> {/* Rule 5: unified padding */}
                        <span className="text-base font-black text-slate-800 flex items-center gap-2"> {/* Rule 2: 16px header */}
                            <FileText size={18} className="text-emerald-600" /> סיכום משימה
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        {/* Metadata Info Box */}
                        {report?.submitted_at && (
                            <div className="bg-white p-4 rounded-xl border border-slate-200 text-sm space-y-2 shadow-sm"> {/* Rule 2: 14px text */}
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">הוגש ע"י:</span>
                                    <span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded">
                                        {report.submitted_by ? people.find(p => p.userId === report.submitted_by)?.name || 'משתמש לא ידוע' : 'משתמש לא ידוע'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-500 font-medium">תאריך הגשה:</span>
                                    <span className="font-mono font-bold text-slate-700">
                                        {new Date(report.submitted_at).toLocaleDateString('he-IL')} {new Date(report.submitted_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!report?.submitted_at && report?.last_editor_id && (
                            <div className="text-xs text-right text-slate-500 font-bold bg-slate-100/50 p-2 rounded-lg border border-slate-200/50"> {/* Rule 2: 12px+ legible metadata */}
                                🕒 נערך לאחרונה ע"י {people.find(p => p.userId === report.last_editor_id)?.name || 'משתמש מערכת'}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-600 uppercase px-1">חריגים</label>
                            <textarea
                                value={reportForm.exceptional_events}
                                onChange={e => setReportForm({ ...reportForm, exceptional_events: e.target.value })}
                                disabled={!!report?.submitted_at}
                                className="w-full text-base p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 min-h-[80px] shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="אין חריגים"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-600 uppercase px-1">סיכום מפקד</label>
                            <textarea
                                value={reportForm.summary}
                                onChange={e => setReportForm({ ...reportForm, summary: e.target.value })}
                                disabled={!!report?.submitted_at}
                                className="w-full text-base p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 min-h-[100px] shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="סיכום כללי..."
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-emerald-700 uppercase px-1">שימור</label>
                                <textarea
                                    value={reportForm.points_to_preserve}
                                    onChange={e => setReportForm({ ...reportForm, points_to_preserve: e.target.value })}
                                    disabled={!!report?.submitted_at}
                                    className="w-full text-base p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500 min-h-[100px] text-emerald-900 shadow-sm disabled:opacity-70"
                                    placeholder="נקודות לשימור..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-bold text-amber-700 uppercase px-1">שיפור</label>
                                <textarea
                                    value={reportForm.points_to_improve}
                                    onChange={e => setReportForm({ ...reportForm, points_to_improve: e.target.value })}
                                    disabled={!!report?.submitted_at}
                                    className="w-full text-base p-3 rounded-xl border border-amber-200 bg-amber-50/50 focus:ring-2 focus:ring-amber-500 min-h-[100px] text-amber-900 shadow-sm disabled:opacity-70"
                                    placeholder="נקודות לשיפור..."
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5 pt-2">
                            <label className="text-sm font-bold text-slate-600 uppercase px-1">מידע מצטבר</label>
                            <textarea
                                value={reportForm.cumulative_info}
                                onChange={e => setReportForm({ ...reportForm, cumulative_info: e.target.value })}
                                disabled={!!report?.submitted_at}
                                className="w-full text-base p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 min-h-[100px] shadow-sm disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="מידע שעשוי לצבור ערך למשמרות הבאות..."
                            />
                        </div>
                    </div>

                    {!isViewer && !isReportLoading && (
                        <div className="p-4 bg-white border-t border-slate-200 z-10 shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.1)]">
                            {!report?.submitted_at ? (
                                <div className="flex gap-3">
                                    <Button
                                        variant="secondary"
                                        onClick={() => upsertReport({ ...reportForm })} // Save without submitting
                                        isLoading={isReportLoading}
                                        className="flex-1 h-12 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-base font-bold shadow-sm rounded-xl"
                                    >
                                        שמור טיוטה
                                    </Button>
                                    <Button
                                        onClick={handleSubmitReport}
                                        isLoading={isReportLoading}
                                        className="flex-[2] h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-lg text-base rounded-xl"
                                    >
                                        הגש דוח סופי
                                    </Button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => upsertReport({ submitted_at: null as any })}
                                    disabled={isReportLoading}
                                    className="w-full h-12 border-2 border-dashed border-slate-300 text-slate-600 hover:text-slate-900 hover:border-slate-500 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                                >
                                    <Pencil size={16} /> <span>ערוך דוח (בטל הגשה)</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </GenericModal>
    );
};
