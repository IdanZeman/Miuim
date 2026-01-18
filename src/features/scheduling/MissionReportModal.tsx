import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, TaskTemplate, Person, Role } from '../../types';
import { GenericModal } from '../../components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import {
    Clock, CalendarBlank as CalendarIcon, ClockCounterClockwise as History, Chat as MessageSquare, PaperPlaneRight as Send,
    FileText, CheckCircle, Users, Shield, Warning as AlertTriangle, Info, ChatCircle as MessageCircle, PencilSimple as Pencil, Printer,
    PaperPlaneRightIcon
} from '@phosphor-icons/react';
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

    const [isSubmitLoading, setIsSubmitLoading] = useState(false);

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
        setIsSubmitLoading(true);
        try {
            await upsertReport({
                ...reportForm,
                submitted_at: new Date().toISOString()
            });
            showToast('דוח משימה הוגש בהצלחה', 'success');
            onRefreshData?.();
        } finally {
            setIsSubmitLoading(false);
        }
    };

    // Auto-scroll to bottom of log
    const logEndRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (report?.ongoing_log) {
            logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [report?.ongoing_log]);


    // --- UI HELPERS FOR UNIFIED MODAL ---
    const modalTitle = (
        <div className="flex flex-col gap-1 pr-2">
            <h2 className="text-xl font-black text-slate-900 leading-none">{task.name}</h2>
            <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500 font-bold whitespace-nowrap overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-1.5 shrink-0">
                    <CalendarIcon size={14} className="text-slate-400" weight="bold" />
                    <span>{new Date(shift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}</span>
                </div>
                <span className="text-slate-200">|</span>
                <div className="flex items-center gap-1.5 font-mono shrink-0">
                    <Clock size={14} className="text-slate-400" weight="bold" />
                    <span>
                        {new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        -
                        {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                {report?.submitted_at && (
                    <>
                        <span className="text-slate-200">|</span>
                        <div className="flex items-center gap-1.5 text-emerald-600 font-black shrink-0">
                            <CheckCircle size={14} weight="fill" />
                            <span>הוגש</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    const modalHeaderActions = (
        <button
            onClick={() => window.print()}
            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-colors"
            title="הדפס / יצא ל-PDF"
        >
            <Printer size={20} weight="bold" />
        </button>
    );

    // --- Report Form Renderer (Shared between Desktop Sidebar and Mobile Sheet) ---
    const renderReportForm = (isSheet = false) => (
        <div className={`space-y-4 ${isSheet ? 'pb-8' : ''}`}>
            {!isSheet && (
                <div className="space-y-3 mb-6">
                    {report?.submitted_at && (
                        <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5 shadow-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-bold">הוגש ע"י</span>
                                <span className="font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded">
                                    {report.submitted_by ? people.find(p => p.userId === report.submitted_by)?.name || 'לא ידוע' : 'לא ידוע'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-500 font-bold">תאריך</span>
                                <span className="font-mono font-bold text-slate-700">
                                    {new Date(report.submitted_at).toLocaleDateString('he-IL')} {new Date(report.submitted_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="space-y-3">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">חריגים</label>
                    <textarea
                        value={reportForm.exceptional_events}
                        onChange={e => setReportForm({ ...reportForm, exceptional_events: e.target.value })}
                        disabled={!!report?.submitted_at}
                        className="w-full text-sm p-3 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-none"
                        placeholder="אין חריגים"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">סיכום מפקד</label>
                    <textarea
                        value={reportForm.summary}
                        onChange={e => setReportForm({ ...reportForm, summary: e.target.value })}
                        disabled={!!report?.submitted_at}
                        className="w-full text-sm p-3 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 min-h-[80px] resize-none"
                        placeholder="סיכום כללי..."
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest px-1 mb-1 block">לשימור</label>
                        <textarea
                            value={reportForm.points_to_preserve}
                            onChange={e => setReportForm({ ...reportForm, points_to_preserve: e.target.value })}
                            disabled={!!report?.submitted_at}
                            className="w-full text-sm p-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-emerald-100 focus:ring-2 focus:ring-emerald-500 min-h-[80px] resize-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-black text-amber-600 uppercase tracking-widest px-1 mb-1 block">לשיפור</label>
                        <textarea
                            value={reportForm.points_to_improve}
                            onChange={e => setReportForm({ ...reportForm, points_to_improve: e.target.value })}
                            disabled={!!report?.submitted_at}
                            className="w-full text-sm p-2 rounded-xl border-0 bg-white shadow-sm ring-1 ring-amber-100 focus:ring-2 focus:ring-amber-500 min-h-[80px] resize-none"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-1 block">מסירת מידע להמשך</label>
                    <textarea
                        value={reportForm.cumulative_info}
                        onChange={e => setReportForm({ ...reportForm, cumulative_info: e.target.value })}
                        disabled={!!report?.submitted_at}
                        className="w-full text-sm p-3 rounded-xl border-0 bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 min-h-[60px] resize-none"
                        placeholder="מידע חשוב..."
                    />
                </div>
            </div>
        </div>
    );

    const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);

    const modalFooter = (
        <div className="flex items-center justify-between w-full gap-4">
            {/* Mobile: Open Report Sheet Button */}
            <div className="md:hidden">
                <Button
                    variant="secondary"
                    onClick={() => setIsReportSheetOpen(true)}
                    className="font-bold text-slate-600 bg-slate-100"
                    icon={FileText}
                >
                    דוח וסיכום
                </Button>
            </div>

            <div className="flex items-center justify-end gap-3 flex-1">
                <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">
                    {isViewer ? 'סגור' : 'שמור להמשך'}
                </Button>
                {!isViewer && (
                    <Button
                        variant="primary"
                        icon={PaperPlaneRightIcon}
                        onClick={handleSubmitReport}
                        disabled={isSubmitLoading}
                        className="font-bold shadow-md shadow-blue-200 px-6 md:px-8 [&>svg]:-scale-x-100"
                    >
                        {report?.submitted_at ? 'עדכן' : 'הגש'}
                    </Button>
                )}
            </div>
        </div>
    );

    if (!task) return null;

    return (
        <GenericModal
            isOpen={true}
            onClose={onClose}
            title={modalTitle}
            headerActions={modalHeaderActions}
            footer={modalFooter}
            size="2xl"
            scrollableContent={false}
            className="p-0 overflow-hidden flex flex-col h-[85vh] md:max-h-[90vh] print:fixed print:inset-0 print:max-h-none print:h-full print:m-0 print:rounded-none print:shadow-none print:z-[99999]"
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

            {/* ... Print Section (omitted for brevity, unchanged) ... */}
            <div id="print-section" className="hidden print:block print:p-8 print:w-full font-sans" dir="rtl">
                {/* Re-using the same print structure as before - assumed to be part of the surrounding code or I should keep it if I'm replacing a chunk. 
                     Wait, I am replacing a chunk that starts BEFORE the print section... 
                     The Target StartLine is 148 (modalFooter). 
                     The ReplacementContent MUST include the print section if I overlap it? 
                     No, I'm replacing lines 148-459.
                     This covers modalFooter, the return statement, and the entire body including the print section.
                     I need to include the Print Section in my replacement content!
                 */}
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

            {/* --- MAIN BODY --- */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative print:hidden bg-slate-50">

                {/* 1. LEFT COLUMN: CONTEXT & CREW (Desktop Only) */}
                <div className="hidden md:flex flex-col gap-4 w-60 border-l border-slate-200 bg-white p-4 overflow-y-auto shrink-0 z-10">
                    <div>
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Users size={14} weight="bold" /> צוות המשימה
                        </h4>
                        <div className="space-y-2">
                            {assignedCrew.map(p => (
                                <div key={p.id} className="flex items-center gap-2">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-sm ${p.color}`}>
                                        {getPersonInitials(p.name)}
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-sm font-bold text-slate-700">{p.name}</span>
                                        <span className="text-[10px] text-slate-400 font-bold mt-0.5">
                                            {roles.find(r => (p.roleIds || [p.roleId]).includes(r.id))?.name}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {assignedCrew.length === 0 && (
                                <span className="text-xs text-slate-400 font-medium">אין משובצים למשימה זו</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. MIDDLE: TIMELINE & INPUT */}
                <div className="flex-1 flex flex-col min-w-0 bg-white border-l border-slate-200">
                    <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-20 shadow-sm">
                        <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                            <History size={18} className="text-indigo-600" weight="bold" /> יומן מבצעים
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                        {report?.ongoing_log.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                <MessageCircle size={32} weight="bold" className="mb-2 opacity-50" />
                                <span className="text-xs font-bold">אין רישומים ביומן</span>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {report?.ongoing_log.map((note, idx) => (
                                    <div key={idx} className="flex gap-3 group">
                                        <div className="flex flex-col items-center shrink-0 w-10 pt-1">
                                            <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-md mb-1">
                                                {new Date(note.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                            <div className="w-px h-full bg-slate-100 group-last:hidden" />
                                        </div>
                                        <div className="flex-1 pb-4">
                                            <div className="flex items-baseline justify-between mb-1">
                                                <span className="text-xs font-black text-slate-700">{note.user_name || 'מערכת'}</span>
                                            </div>
                                            <div className="text-sm text-slate-800 bg-white p-2.5 rounded-r-xl rounded-bl-xl border border-slate-200 shadow-sm leading-relaxed">
                                                {note.text}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        )}
                    </div>

                    {!isViewer && (
                        <div className="p-3 bg-white border-t border-slate-200">
                            {report?.submitted_at ? (
                                <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-3 rounded-xl text-slate-500 text-sm font-bold justify-center">
                                    <Shield size={16} weight="bold" />
                                    דוח זה הוגש וננעל לעריכה
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        value={noteText}
                                        onChange={(e) => setNoteText(e.target.value)}
                                        placeholder="הקלד דיווח מהיר..."
                                        className="flex-1 bg-slate-50 border-none rounded-xl px-4 h-11 text-sm font-medium focus:ring-2 focus:ring-indigo-500/20"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleAddNote();
                                        }}
                                    />
                                    <Button
                                        size="icon"
                                        onClick={handleAddNote}
                                        disabled={!noteText.trim()}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 w-11 h-11 rounded-xl shadow-lg shadow-indigo-200"
                                    >
                                        <Send size={20} weight="fill" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 3. RIGHT: REPORT FORM (Desktop) */}
                <div className="hidden md:flex w-80 flex-col bg-slate-50 overflow-hidden border-l border-slate-200">
                    <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-white sticky top-0 z-20">
                        <span className="text-sm font-black text-slate-700 flex items-center gap-2">
                            <FileText size={18} className="text-slate-500" weight="bold" /> טופס סיכום
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                        {renderReportForm(false)}
                    </div>
                </div>

                {/* 4. SHEET MODAL (Mobile) */}
                {/* 4. SHEET MODAL (Mobile) */}
                <GenericModal
                    isOpen={isReportSheetOpen}
                    onClose={() => setIsReportSheetOpen(false)}
                    title="דוח סיכום משמרת"
                    size="full"
                    footer={
                        <div className="w-full">
                            <Button
                                variant="primary"
                                onClick={() => setIsReportSheetOpen(false)}
                                className="w-full font-bold shadow-md"
                                size="lg"
                            >
                                שמור וחזור ליומן
                            </Button>
                        </div>
                    }
                >
                    <div className="p-4 bg-slate-50 min-h-full">
                        {renderReportForm(true)}
                        <div className="h-4" />
                    </div>
                </GenericModal>

            </div>
        </GenericModal>
    );
};
