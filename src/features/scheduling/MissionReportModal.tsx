import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Shift, TaskTemplate, Person, Role } from '../../types';
import { Modal as GenericModal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import {
    X, Clock, Calendar as CalendarIcon, History, MessageSquare, Send,
    FileText, CheckCircle, Users, Shield, AlertTriangle, Info, MessageCircle, ChevronDown, ChevronUp, Pencil
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
        points_to_improve: ''
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
                points_to_improve: report.points_to_improve || ''
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
            className="p-0 overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] print:max-h-none print:h-auto print:overflow-visible"
        >
            {/* --- PRINT LAYOUT (Hidden on Screen) --- */}
            <div className="hidden print:block print:p-8 print:w-full font-sans" dir="rtl">
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
                </div>

                <div className="mt-8 text-center text-xs text-slate-400">
                    הופק ע"י המערכת בתאריך {new Date().toLocaleString('he-IL')}
                </div>
            </div>

            {/* --- CUSTOM HEADER (Sticky) - Screen Only --- */}
            <div className="bg-white border-b border-slate-200 p-3 md:p-4 shrink-0 z-40 shadow-sm flex justify-between items-center print:hidden">
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg md:text-xl font-black text-slate-800 leading-none flex items-center gap-2">
                            {task.name}
                        </h2>

                        {/* Status Badge in Header */}
                        {report?.submitted_at ? (
                            <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <CheckCircle size={12} />
                                <span>הוגש</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full text-[10px] font-bold animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span>פעיל</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 text-xs md:text-sm text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                            <CalendarIcon size={14} className="text-slate-400" />
                            {new Date(shift.startTime).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1.5 font-mono">
                            {new Date(shift.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            -
                            {new Date(shift.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Print Button in Header */}
                    <button
                        onClick={() => window.print()}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors flex items-center gap-2 group"
                        title="הדפס / יצא ל-PDF"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:scale-110 transition-transform"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    </button>

                    <div className="h-8 w-px bg-slate-200" />

                    {/* Mobile Tabs Switcher */}
                    <div className="md:hidden flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveMobileTab('timeline')}
                            className={`p-1.5 rounded-md transition-all ${activeMobileTab === 'timeline' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                        >
                            <History size={16} />
                        </button>
                        <button
                            onClick={() => setActiveMobileTab('report')}
                            className={`p-1.5 rounded-md transition-all ${activeMobileTab === 'report' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}
                        >
                            <FileText size={16} />
                        </button>
                    </div>

                    <Button variant="ghost" size="sm" onClick={onClose}>
                        <X size={20} />
                    </Button>
                </div>
            </div>

            {/* --- MAIN BODY --- */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative print:hidden">

                {/* 1. LEFT COLUMN: CONTEXT & CREW (Desktop: 20%, Mobile: Hidden/Collapsed usually, but let's show as top bar or similar? For now, Desktop only or very compact on mobile) */}
                <div className="hidden md:flex md:w-[20%] md:min-w-[180px] bg-slate-50 border-l border-slate-200 p-3 flex-col gap-4 overflow-y-auto shrink-0 z-30">
                    <div>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Users size={12} /> צוות המשימה
                        </h4>
                        <div className="space-y-1">
                            {assignedCrew.map(p => (
                                <div key={p.id} className="flex items-center gap-2 p-1.5 bg-white border border-slate-100 rounded-md shadow-sm">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${p.color}`}>
                                        {getPersonInitials(p.name)}
                                    </div>
                                    <div className="flex flex-col leading-none">
                                        <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                        <span className="text-[9px] text-slate-400 scale-90 origin-right">
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
                    <div className="p-2 border-b border-slate-100 flex justify-between items-center text-xs bg-white/95 backdrop-blur sticky top-0 z-20">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <History size={14} className="text-blue-500" /> יומן מבצעים
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

                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1 rounded">
                                                    {new Date(note.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[11px] font-bold text-slate-700">
                                                    {note.user_name || 'מערכת'}
                                                </span>
                                            </div>
                                            <div className="text-sm text-slate-800 bg-white p-2 rounded-r-lg rounded-bl-lg border border-slate-200 shadow-sm leading-relaxed">
                                                {note.text}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={logEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    {!isViewer && (
                        <div className="p-2 bg-white border-t border-slate-200">
                            <div className="flex gap-2 items-end">
                                <textarea
                                    value={noteText}
                                    onChange={(e) => setNoteText(e.target.value)}
                                    placeholder={report?.submitted_at ? "הדוח הוגש - לא ניתן להוסיף דיווחים" : "הקלד דיווח..."}
                                    disabled={!!report?.submitted_at}
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 outline-none resize-none min-h-[44px] max-h-[100px] disabled:opacity-60 disabled:cursor-not-allowed"
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
                                    disabled={!noteText.trim() || !!report?.submitted_at}
                                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm shrink-0 w-[44px] h-[44px] disabled:bg-slate-300 disabled:text-slate-500"
                                >
                                    <Send size={18} />
                                </Button>
                            </div>
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
                    <div className="p-2 border-b border-slate-200 flex justify-between items-center text-xs bg-slate-100 sticky top-0 z-20">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                            <FileText size={14} className="text-emerald-600" /> סיכום משימה
                        </span>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        {/* Metadata Info Box */}
                        {report?.submitted_at && (
                            <div className="bg-white p-2 rounded-lg border border-slate-200 text-[10px] space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">הוגש ע"י:</span>
                                    {/* Ideally we'd map ID to name, but we might not have a lookup for all users. Using ID fallback or stored name if we had it. */}
                                    <span className="font-bold text-slate-700">
                                        {report.submitted_by ? people.find(p => p.userId === report.submitted_by)?.name || 'משתמש לא ידוע' : 'משתמש לא ידוע'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">תאריך הגשה:</span>
                                    <span className="font-mono text-slate-700">
                                        {new Date(report.submitted_at).toLocaleDateString('he-IL')} {new Date(report.submitted_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        )}

                        {!report?.submitted_at && report?.last_editor_id && (
                            <div className="text-[9px] text-right text-slate-400 italic px-1">
                                נערך לאחרונה ע"י {people.find(p => p.userId === report.last_editor_id)?.name || 'משתמש מערכת'}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">חריגים</label>
                            <textarea
                                value={reportForm.exceptional_events}
                                onChange={e => setReportForm({ ...reportForm, exceptional_events: e.target.value })}
                                disabled={!!report?.submitted_at}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 min-h-[60px] disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="אין חריגים"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">סיכום מפקד</label>
                            <textarea
                                value={reportForm.summary}
                                onChange={e => setReportForm({ ...reportForm, summary: e.target.value })}
                                disabled={!!report?.submitted_at}
                                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 min-h-[80px] disabled:bg-slate-50 disabled:text-slate-500"
                                placeholder="סיכום כללי..."
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-emerald-600 uppercase">שימור</label>
                                <textarea
                                    value={reportForm.points_to_preserve}
                                    onChange={e => setReportForm({ ...reportForm, points_to_preserve: e.target.value })}
                                    disabled={!!report?.submitted_at}
                                    className="w-full text-xs p-2 rounded-lg border border-emerald-100 bg-emerald-50/50 focus:ring-1 focus:ring-emerald-500 min-h-[80px] text-emerald-900 disabled:opacity-70"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-amber-600 uppercase">שיפור</label>
                                <textarea
                                    value={reportForm.points_to_improve}
                                    onChange={e => setReportForm({ ...reportForm, points_to_improve: e.target.value })}
                                    disabled={!!report?.submitted_at}
                                    className="w-full text-xs p-2 rounded-lg border border-amber-100 bg-amber-50/50 focus:ring-1 focus:ring-amber-500 min-h-[80px] text-amber-900 disabled:opacity-70"
                                />
                            </div>
                        </div>

                    </div>

                    {!isViewer && !isReportLoading && (
                        <div className="p-3 bg-white border-t border-slate-200 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            {!report?.submitted_at ? (
                                <>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="secondary"
                                            onClick={() => upsertReport({ ...reportForm })} // Save without submitting
                                            isLoading={isReportLoading}
                                            className="flex-1 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold shadow-sm"
                                        >
                                            שמור טיוטה
                                        </Button>
                                        <Button
                                            onClick={handleSubmitReport}
                                            isLoading={isReportLoading}
                                            className="flex-[2] bg-slate-800 hover:bg-slate-900 text-white font-bold shadow-lg text-xs"
                                        >
                                            הגש דוח סופי
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <Button
                                    variant="outline"
                                    onClick={() => upsertReport({ submitted_at: null as any })}
                                    isLoading={isReportLoading}
                                    className="w-full border-dashed border-slate-300 text-slate-500 hover:text-slate-800 hover:border-slate-400"
                                >
                                    <Pencil size={12} className="mr-1.5" /> ערוך דוח (בטל הגשה)
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

        </GenericModal >
    );
};
