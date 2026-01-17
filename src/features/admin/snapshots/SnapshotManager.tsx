import React, { useState, useEffect } from 'react';
import { snapshotService, Snapshot } from '../../../services/snapshotService';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationModal } from '../../../components/ui/ConfirmationModal';
import { useConfirmation } from '../../../hooks/useConfirmation';
import {
    mapPersonFromDB,
    mapTeamFromDB,
    mapRoleFromDB,
    mapTaskFromDB,
    mapShiftFromDB,
    mapAbsenceFromDB,
    mapHourlyBlockageFromDB,
    mapEquipmentFromDB,
    mapEquipmentDailyCheckFromDB
} from '../../../services/mappers';
import { Clock, Plus, Trash, ArrowsClockwise, Eye, FileText, User, Calendar, Shield, Users, CheckCircle, Package, UserCircle } from '@phosphor-icons/react';

const getTableLabel = (name: string) => {
    const labels: Record<string, string> = {
        'people': 'כוח אדם',
        'teams': 'צוותים',
        'roles': 'תפקידים',
        'task_templates': 'משימות',
        'shifts': 'שיבוצים',
        'absences': 'בקשות יציאה',
        'daily_presence': 'נוכחות',
        'unified_presence': 'נוכחות מאוחדת',
        'hourly_blockages': 'חסימות (אילוצים)',
        'equipment': 'ציוד ואמצעים',
        'equipment_daily_checks': 'בדיקות ציוד'
    };
    return labels[name] || name;
};

const MAX_SNAPSHOTS = 5;
const RESTORE_VERIFICATION_TEXT = 'שחזור';

interface SnapshotManagerProps {
    organizationId: string;
}

export const SnapshotManager: React.FC<SnapshotManagerProps> = ({ organizationId }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();

    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);
    const [restoringSnapshot, setRestoringSnapshot] = useState<Snapshot | null>(null);
    const [restoreVerification, setRestoreVerification] = useState('');
    const [restoreProgress, setRestoreProgress] = useState<string>('');
    const [isRotationConfirmed, setIsRotationConfirmed] = useState(false);

    useEffect(() => {
        loadSnapshots();
    }, [organizationId]);

    const loadSnapshots = async () => {
        try {
            setLoading(true);
            const data = await snapshotService.fetchSnapshots(organizationId);
            setSnapshots(data);
        } catch (error) {
            console.error('Error loading snapshots:', error);
            showToast('שגיאה בטעינת הגרסאות', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSnapshot = async (forceRotate = false) => {
        if (!newName.trim()) {
            showToast('נא להזין שם לגרסה', 'error');
            return;
        }

        if (snapshots.length >= MAX_SNAPSHOTS && !forceRotate) {
            confirm({
                title: 'הגעת למכסת הגרסאות',
                message: `המכסה המקסימלית היא ${MAX_SNAPSHOTS} גרסאות. יצירת גרסה חדשה תגרום למחיקת הגרסה הישנה ביותר באופן אוטומטי. האם להמשיך?`,
                confirmText: 'כן, צור ומחק ישנה',
                type: 'warning',
                onConfirm: () => handleCreateSnapshot(true)
            });
            return;
        }

        try {
            setCreating(true);

            // If rotating, delete the oldest first
            if (snapshots.length >= MAX_SNAPSHOTS) {
                const oldest = snapshots[snapshots.length - 1];
                await snapshotService.deleteSnapshot(oldest.id, organizationId, user?.id || '');
            }

            await snapshotService.createSnapshot(organizationId, newName, newDescription, user?.id || '');
            showToast('הגרסה נשמרה בהצלחה', 'success');
            setShowCreateModal(false);
            setNewName('');
            setNewDescription('');
            loadSnapshots();
        } catch (error: any) {
            console.error('Error creating snapshot:', error);
            showToast(error.message || 'שגיאה ביצירת הגרסה', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteSnapshot = (snapshotId: string) => {
        confirm({
            title: 'מחיקת גרסה',
            message: 'האם אתה בטוח שברצונך למחוק גרסה זו? פעולה זו אינה ניתנת לביטול.',
            confirmText: 'מחק',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await snapshotService.deleteSnapshot(snapshotId, organizationId, user?.id || '');
                    showToast('הגרסה נמחקה', 'success');
                    loadSnapshots();
                } catch (error) {
                    console.error('Error deleting snapshot:', error);
                    showToast('שגיאה במחיקת הגרסה', 'error');
                }
            }
        });
    };

    const handleRestore = async (snapshot: Snapshot) => {
        setRestoringSnapshot(snapshot);
        setRestoreVerification('');
    };

    const confirmRestore = async () => {
        if (!restoringSnapshot) return;
        if (!restoringSnapshot || !user) return;
        if (restoreVerification !== RESTORE_VERIFICATION_TEXT) {
            showToast(`נא להקליד "${RESTORE_VERIFICATION_TEXT}" לאישור`, 'error');
            return;
        }

        setCreating(true);
        setRestoreProgress('🔄 יוצר גיבוי בטיחות...');

        try {
            // Show initial message
            showToast('🔄 יוצר גיבוי בטיחות...', 'info');

            // Call restore with userId - this will create automatic pre-restore backup
            const result = await snapshotService.restoreSnapshot(
                restoringSnapshot.id,
                organizationId,
                user.id,
                (progress: string) => setRestoreProgress(progress)
            );

            // Show success message with info about pre-restore backup
            showToast(
                `הגרסה שוחזרה בהצלחה! ${result.preRestoreSnapshotId ? '\n🔒 נוצר גיבוי אוטומטי של המצב הקודם' : ''}`,
                'success'
            );

            setRestoringSnapshot(null);
            setPreviewSnapshot(null); // Close preview modal if open
            await loadSnapshots(); // Refresh the list of snapshots

            // Force page reload to reflect restored data
            setTimeout(() => window.location.reload(), 1000);
        } catch (error: any) {
            console.error('Error restoring snapshot:', error);
            showToast(error.message || 'שגיאה בשחזור הגרסה', 'error');
        } finally {
            setCreating(false);
            setRestoreProgress('');
        }
    };

    if (loading && snapshots.length === 0) {
        return <div className="text-slate-500 text-sm animate-pulse">טוען גרסאות...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-black text-slate-800">גרסאות מערכת (Snapshots)</h2>
                    <p className="text-sm text-slate-500 font-bold">שמור ושחזר את מצב המערכת בנקודות זמן שונות</p>
                </div>
                <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setShowCreateModal(true)}
                    disabled={snapshots.length >= 5}
                    className="shadow-lg shadow-blue-100"
                >
                    צור גרסה חדשה
                </Button>
            </div>

            {snapshots.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Clock size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">אין גרסאות שמורות</h3>
                    <p className="text-slate-500 max-w-sm mx-auto">צור את הגרסה הראשונה שלך כדי שתוכל לשחזר נתונים במידת הצורך.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${snapshots.length >= 5 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            5 / {snapshots.length} גרסאות בשימוש
                        </div>
                    </div>
                    {snapshots.map((snapshot) => (
                        <div key={snapshot.id} className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-blue-300 transition-all group shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                                    <FileText size={24} weight="duotone" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 text-lg leading-tight">{snapshot.name}</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                            <Calendar size={14} />
                                            {new Date(snapshot.created_at).toLocaleString('he-IL')}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold">
                                            <User size={14} />
                                            {snapshot.created_by_name || 'המערכת'}
                                        </div>
                                    </div>
                                    {snapshot.description && (
                                        <p className="text-sm text-slate-500 mt-2 font-medium line-clamp-1">{snapshot.description}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:pl-2">
                                <Button
                                    variant="ghost"
                                    icon={Eye}
                                    onClick={() => setPreviewSnapshot(snapshot)}
                                    className="h-10 px-4 rounded-xl bg-slate-50 md:bg-transparent text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-bold"
                                >
                                    תצוגה מקדימה
                                </Button>
                                <Button
                                    variant="ghost"
                                    icon={ArrowsClockwise}
                                    onClick={() => handleRestore(snapshot)}
                                    className="h-10 px-4 rounded-xl bg-slate-50 md:bg-transparent text-slate-600 hover:text-orange-600 hover:bg-orange-50 font-bold"
                                >
                                    שחזר
                                </Button>
                                <Button
                                    variant="ghost"
                                    icon={Trash}
                                    onClick={() => handleDeleteSnapshot(snapshot.id)}
                                    className="h-10 w-10 !p-0 rounded-xl bg-slate-50 md:bg-transparent text-red-400 hover:text-red-600 hover:bg-red-50"
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Plus size={24} weight="bold" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800">יצירת גרסה חדשה</h2>
                            <p className="text-sm font-bold text-slate-400">גיבוי מלא של נתוני הארגון</p>
                        </div>
                    </div>
                }
                footer={
                    <div className="flex justify-end gap-3 w-full">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)} className="font-bold text-slate-500">ביטול</Button>
                        <Button
                            variant="primary"
                            icon={FileText}
                            onClick={() => handleCreateSnapshot()}
                            isLoading={creating}
                            disabled={!newName.trim()}
                            className="shadow-lg shadow-blue-100"
                        >
                            שמור גרסה
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="שם הגרסה (חובה)"
                        placeholder="שם העדכון"
                        value={newName}
                        onChange={e => setNewName(e.target.value)}
                        className="!bg-slate-50 font-black"
                    />
                    <Input
                        label="תיאור (אופציונלי)"
                        placeholder="הוסף פרטים נוספים על הגרסה..."
                        value={newDescription}
                        onChange={e => setNewDescription(e.target.value)}
                        className="!bg-slate-50"
                    />
                    <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
                        <Shield size={20} className="text-blue-500 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-700 leading-relaxed font-bold">
                            יצירת גרסה תשמור את כל נתוני כוח האדם, המשימות, הנוכחות, האילוצים והציוד של הארגון.
                            ניתן יהיה לשחזר נתונים אלו בכל עת.
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Preview Modal */}
            {previewSnapshot && (
                <SnapshotPreviewModal
                    snapshot={previewSnapshot}
                    onClose={() => setPreviewSnapshot(null)}
                    onRestore={() => handleRestore(previewSnapshot)}
                />
            )}

            <ConfirmationModal {...modalProps} />

            {/* Destruction Safety Confirmation Modal for Restore */}
            {restoringSnapshot && (
                <ConfirmationModal
                    isOpen={true}
                    title="אישור שחזור מערכת"
                    type="danger"
                    confirmText={creating ? "⏳ מבצע שחזור..." : "שחזר כעת"}
                    disabled={creating}
                    onConfirm={() => {
                        if (!creating) {
                            confirmRestore();
                        }
                    }}
                    onCancel={() => {
                        if (!creating) {
                            setRestoringSnapshot(null);
                            setRestoreProgress('');
                        }
                    }}
                >
                    <div className="space-y-4">
                        {creating && restoreProgress ? (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                <div className="flex items-center gap-3">
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                    <p className="text-sm font-bold text-blue-700">{restoreProgress}</p>
                                </div>
                                <p className="text-xs text-blue-600 mt-2 font-medium">נא לא לסגור את החלון...</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm font-bold text-slate-700">
                                    נא שים לב: שחזור לגרסה <span className="text-red-600">"{restoringSnapshot.name}"</span> ימחק את כל המידע הנוכחי במערכת ויחליף אותו במידע הישן.
                                </p>
                                <p className="text-xs text-slate-500 font-bold">
                                    פעולה זו היא הפיכה כי לפני השחזור, נא הקלד את המילה <span className="text-red-600 bg-red-50 px-1 rounded">"שחזור"</span> בשדה לסגור:
                                </p>
                                <Input
                                    value={restoreVerification}
                                    onChange={e => setRestoreVerification(e.target.value)}
                                    placeholder="שחזור"
                                    className="text-center font-bold"
                                    disabled={creating}
                                />
                            </>
                        )}
                    </div>
                </ConfirmationModal>
            )}
        </div>
    );
};

// --- Internal Sub-components ---

interface SnapshotPreviewModalProps {
    snapshot: Snapshot;
    onClose: () => void;
    onRestore: () => void;
}

const TableDataViewer: React.FC<{
    tableName: string;
    data: any[];
    onBack: () => void;
    peopleMap?: Record<string, any>;
    teamsMap?: Record<string, any>;
    rolesMap?: Record<string, any>;
    tasksMap?: Record<string, any>;
    equipmentMap?: Record<string, any>;
}> = ({ tableName, data, onBack, peopleMap, teamsMap, rolesMap, tasksMap, equipmentMap }) => {
    const [selectedItem, setSelectedItem] = useState<any | null>(null);

    const getPersonalId = (item: any) => {
        if (item.personalId) return item.personalId;
        if (item.personal_id) return item.personal_id;

        // Search custom fields for common Hebrew keys for personal ID (M.A.)
        if (item.customFields) {
            const commonKeys = ['מ.א', 'מ.א.', 'מספר אישי', 'מספר_אישי', 'personal_id', 'personalId', 'ma'];
            for (const key of commonKeys) {
                if (item.customFields[key]) return item.customFields[key];
            }
        }
        return '';
    };

    const renderAttendanceGrid = () => {
        // Group by person
        const personAttendance: Record<string, Record<string, any>> = {};
        const datesSet = new Set<string>();

        data.forEach(p => {
            if (!personAttendance[p.person_id]) personAttendance[p.person_id] = {};
            personAttendance[p.person_id][p.date] = p;
            datesSet.add(p.date);
        });

        const sortedDates = Array.from(datesSet).sort();
        // Limit to 31 days to avoid crazy horizontal scroll if something is wrong
        const displayDates = sortedDates.slice(0, 31);

        return (
            <div className="overflow-x-auto border border-slate-100 rounded-2xl bg-white shadow-sm">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="p-3 text-xs font-black text-slate-500 sticky right-0 bg-slate-50 z-10 w-40 min-w-40">חייל</th>
                            {displayDates.map(date => (
                                <th key={date} className="p-2 text-[10px] font-black text-slate-400 border-r border-slate-100 min-w-[40px] text-center">
                                    {new Date(date).getDate()}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(personAttendance).map(personId => (
                            <tr key={personId} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 text-xs font-bold text-slate-700 sticky right-0 bg-white/90 backdrop-blur z-10 border-l border-slate-50">
                                    {peopleMap?.[personId]?.name || `חייל (${personId.slice(0, 4)})`}
                                </td>
                                {displayDates.map(date => {
                                    const entry = personAttendance[personId][date];
                                    return (
                                        <td key={date} className="p-1 border-r border-slate-50 text-center">
                                            {entry ? (
                                                <div className={`
                                                    w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] font-black
                                                    ${entry.status === 'base' ? 'bg-emerald-100 text-emerald-700' :
                                                        entry.status === 'home' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'}
                                                `}>
                                                    {entry.status === 'base' ? 'ב' : entry.status === 'home' ? 'ח' : '?'}
                                                </div>
                                            ) : (
                                                <div className="w-1 h-1 bg-slate-100 rounded-full mx-auto" />
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderItem = (item: any, idx: number) => {
        if (tableName === 'people') {
            return (
                <button
                    key={item.id || idx}
                    onClick={() => setSelectedItem(item)}
                    className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 hover:border-blue-300 hover:shadow-md transition-all text-right w-full group"
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm ${item.color || 'bg-slate-400'}`}>
                        {item.name?.slice(0, 2)}
                    </div>
                    <div className="flex flex-col text-right">
                        <div className="font-black text-slate-800 text-sm">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold">
                            {getPersonalId(item)}{getPersonalId(item) ? ' • ' : ''}{teamsMap?.[item.teamId]?.name || 'ללא צוות'}
                        </div>
                    </div>
                    <Eye size={14} className="mr-auto text-slate-200 group-hover:text-blue-400 transition-colors" />
                </button>
            );
        }

        if (tableName === 'teams' || tableName === 'roles') {
            const isTeam = tableName === 'teams';
            const colorClass = item.color || (isTeam ? 'border-slate-200' : 'bg-slate-200');

            return (
                <div key={item.id || idx} className={`
                    bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden
                    ${isTeam ? `border-r-4 ${colorClass}` : ''}
                `}>
                    {!isTeam && <div className={`absolute top-0 right-0 bottom-0 w-1 ${colorClass}`} />}
                    {!isTeam && (
                        <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white shadow-sm ${colorClass}`}>
                            {item.icon ? <Shield size={16} /> : item.name?.slice(0, 1)}
                        </div>
                    )}
                    <div className="flex flex-col text-right">
                        <div className="font-black text-slate-800">{item.name}</div>
                        {isTeam && item.memberCount !== undefined && (
                            <span className="text-[10px] text-slate-400 font-bold">{item.memberCount} חברים</span>
                        )}
                    </div>
                </div>
            );
        }

        if (tableName === 'task_templates') {
            return (
                <button
                    key={item.id || idx}
                    onClick={() => setSelectedItem(item)}
                    className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm hover:border-blue-300 hover:shadow-md transition-all text-right w-full group"
                >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        <Package size={20} />
                    </div>
                    <div className="text-right flex-1">
                        <div className="font-black text-slate-800 group-hover:text-blue-600 transition-colors">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {item.category || 'כללי'} • רמה {item.difficulty || 1} • {item.segments?.length || 0} סגמנטים
                        </div>
                    </div>
                    <Eye size={14} className="mr-auto text-slate-200 group-hover:text-blue-400 transition-colors" />
                </button>
            );
        }

        if (tableName === 'shifts') {
            const task = tasksMap?.[item.taskId];
            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col gap-2 shadow-sm border-r-4 border-r-blue-100">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{task?.name || 'משימה כללית'}</span>
                            <span className="text-xs font-black text-slate-800">{new Date(item.startTime).toLocaleDateString('he-IL')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100 text-[10px] font-bold text-slate-400">
                            <Clock size={12} />
                            {new Date(item.startTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} - {new Date(item.endTime).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {item.assignedPersonIds?.map((pid: string) => (
                            <span key={pid} className="px-2 py-0.5 bg-blue-50/50 rounded text-[9px] font-black text-blue-600 border border-blue-100/30">
                                {peopleMap?.[pid]?.name || pid.slice(0, 4)}
                            </span>
                        ))}
                        {(!item.assignedPersonIds || item.assignedPersonIds.length === 0) && (
                            <span className="text-[10px] text-slate-300 italic">טרם שובצו אנשים</span>
                        )}
                    </div>
                </div>
            );
        }

        if (tableName === 'absences' || tableName === 'hourly_blockages') {
            const isAbsence = tableName === 'absences';
            const person = peopleMap?.[item.personId || item.person_id];
            const colorClass = isAbsence ? 'border-r-red-400' : 'border-r-amber-400';

            return (
                <div key={item.id || idx} className={`bg-white border border-slate-100 rounded-xl p-3 flex flex-col gap-2 shadow-sm border-r-4 ${colorClass}`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black ${person?.color || 'bg-slate-400'}`}>
                                {person?.name?.slice(0, 2)}
                            </div>
                            <span className="text-xs font-black text-slate-800">{person?.name || 'חייל לא ידוע'}</span>
                        </div>
                        {isAbsence && (
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black shadow-sm ${item.status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-orange-100 text-orange-700'}`}>
                                {item.status === 'approved' ? 'מאושר' : 'ממתין'}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-50">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={12} className="text-slate-300" />
                            {isAbsence
                                ? `${item.start_date}${item.end_date !== item.start_date ? ` - ${item.end_date}` : ''}`
                                : item.date
                            }
                        </div>
                        <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-300" />
                            {item.start_time} - {item.end_time}
                        </div>
                    </div>

                    {item.reason && (
                        <div className="text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-lg border border-slate-50/50 italic">
                            "{item.reason}"
                        </div>
                    )}
                </div>
            );
        }

        if (tableName === 'equipment') {
            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex items-center justify-between shadow-sm">
                    <div className="text-right">
                        <div className="font-black text-slate-800 text-sm">{item.name}</div>
                        <div className="text-[10px] text-slate-400 font-bold">
                            #{item.serial_number || 'ללא מספר'} • {peopleMap?.[item.assigned_to_id]?.name || 'לא משויך'}
                        </div>
                    </div>
                    <div className={`text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm ${item.status === 'present' || item.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                        {item.status === 'present' || item.status === 'ok' ? 'תקין' : 'חסר/תקול'}
                    </div>
                </div>
            );
        }

        if (tableName === 'equipment_daily_checks') {
            const equip = equipmentMap?.[item.equipment_id] || equipmentMap?.[item.equipmentId];
            return (
                <div key={item.id || idx} className="bg-white border border-slate-100 rounded-xl p-3 flex flex-col gap-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-right">
                            <div className="font-black text-slate-800 text-xs">{equip?.type || equip?.name || 'ציוד לא ידוע'}</div>
                            <div className="text-[10px] text-slate-400 font-bold">#{equip?.serial_number || equip?.serialNumber || '---'}</div>
                        </div>
                        <div className={`px-2 py-0.5 rounded text-[10px] font-black ${item.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                            {item.status === 'ok' ? 'תקין' : 'לא תקין'}
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold border-t border-slate-50 pt-1.5 mt-0.5">
                        <User size={12} className="text-slate-300" />
                        <span>נבדק ע"י: {peopleMap?.[item.checked_by || item.checkedBy]?.name || 'לא ידוע'}</span>
                        <span className="mr-auto opacity-50">{new Date(item.check_date || item.checkDate).toLocaleDateString('he-IL')}</span>
                    </div>
                </div>
            );
        }

        // Default generic row
        return (
            <div key={idx} className="bg-white border border-slate-100 rounded-xl p-3 text-[10px] font-mono overflow-hidden whitespace-nowrap overflow-ellipsis opacity-60">
                {JSON.stringify(item)}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-800">{getTableLabel(tableName)}</h3>
                    <span className="text-xs text-slate-400">({data.length} רשומות)</span>
                </div>
                <Button variant="ghost" onClick={onBack} size="sm" className="text-blue-600 font-bold hover:bg-blue-50">
                    חזרה לסיכום
                </Button>
            </div>

            {selectedItem ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-black ${selectedItem.color || 'bg-slate-400'}`}>
                                {selectedItem.name?.slice(0, 2)}
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-slate-800">{selectedItem.name}</h4>
                                <p className="text-xs text-slate-400 font-bold">{getPersonalId(selectedItem)}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedItem(null)} className="text-slate-400 font-bold">X</Button>
                    </div>
                    <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">צוות</span>
                            <span className="text-sm font-bold text-slate-700">{teamsMap?.[selectedItem.teamId]?.name || 'לא משויך'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">תפקידים</span>
                            <div className="flex flex-wrap gap-1">
                                {(selectedItem.roleIds && selectedItem.roleIds.length > 0) ? (
                                    selectedItem.roleIds.map((rid: string) => (
                                        <span key={rid} className="px-2 py-0.5 bg-slate-100 rounded text-xs font-bold text-slate-700">
                                            {rolesMap?.[rid]?.name || rid}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-sm font-bold text-slate-700">{rolesMap?.[selectedItem.roleId]?.name || 'לא הוגדר'}</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">טלפון</span>
                            <span className="text-sm font-bold text-slate-700">{selectedItem.phone || 'אין'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">דוא"ל</span>
                            <span className="text-sm font-bold text-slate-700">{selectedItem.email || 'אין'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">מפקד</span>
                            <span className={`text-sm font-bold ${selectedItem.isCommander ? 'text-blue-600' : 'text-slate-700'}`}>{selectedItem.isCommander ? 'כן' : 'לא'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block mb-1">סטטוס</span>
                            <span className={`text-sm font-bold ${selectedItem.isActive === false ? 'text-red-500' : 'text-emerald-500'}`}>{selectedItem.isActive === false ? 'לא פעיל' : 'פעיל'}</span>
                        </div>
                    </div>

                    {tableName === 'task_templates' && selectedItem.segments && (
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h5 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4">סגמנטים ושיבוצים ({selectedItem.segments.length})</h5>
                            <div className="space-y-3">
                                {selectedItem.segments.map((seg: any, sIdx: number) => (
                                    <div key={seg.id || sIdx} className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                        <div>
                                            <div className="font-black text-slate-800 text-sm mb-1">{seg.name || `סגמנט ${sIdx + 1}`}</div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                    <Clock size={12} />
                                                    {seg.startTime} ({seg.durationHours} שעות)
                                                </div>
                                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
                                                    <Users size={12} />
                                                    {seg.requiredPeople} אנשים
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
                                            {seg.roleComposition?.map((rc: any, rcIdx: number) => (
                                                <span key={rcIdx} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-black text-slate-500">
                                                    {rolesMap?.[rc.roleId]?.name || rc.roleId}: {rc.count}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className={`
                    ${(tableName === 'daily_presence' || tableName === 'unified_presence') ? 'block' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2'}
                    max-h-[500px] overflow-y-auto p-1
                `}>
                    {data.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-slate-400 font-bold italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">אין נתונים להציג בגרסה זו</div>
                    ) : (
                        (tableName === 'daily_presence' || tableName === 'unified_presence')
                            ? renderAttendanceGrid()
                            : data.map((item, idx) => renderItem(item, idx))
                    )}
                </div>
            )}
        </div>
    );
};

const SnapshotPreviewModal: React.FC<SnapshotPreviewModalProps> = ({ snapshot, onClose, onRestore }) => {
    const [viewingTable, setViewingTable] = React.useState<string | null>(null);
    const [tableData, setTableData] = React.useState<any[]>([]);
    const [loadingData, setLoadingData] = React.useState(false);

    // Maps for lookups
    const [peopleMap, setPeopleMap] = React.useState<Record<string, any>>({});
    const [teamsMap, setTeamsMap] = React.useState<Record<string, any>>({});
    const [rolesMap, setRolesMap] = React.useState<Record<string, any>>({});
    const [tasksMap, setTasksMap] = React.useState<Record<string, any>>({});
    const [equipmentMap, setEquipmentMap] = React.useState<Record<string, any>>({});

    const handleViewTable = async (tableName: string) => {
        try {
            setLoadingData(true);
            setViewingTable(tableName);

            const data = await snapshotService.fetchSnapshotTableData(snapshot.id, tableName);

            // Map the auxiliary data if it was just fetched
            if (Object.keys(peopleMap).length === 0 && tableName !== 'people') {
                const pData = await snapshotService.fetchSnapshotTableData(snapshot.id, 'people');
                const pMap: Record<string, any> = {};
                pData?.forEach((p: any) => {
                    const mapped = mapPersonFromDB(p);
                    pMap[mapped.id] = mapped;
                });
                setPeopleMap(pMap);
            }
            if (Object.keys(teamsMap).length === 0 && tableName !== 'teams') {
                const tData = await snapshotService.fetchSnapshotTableData(snapshot.id, 'teams');
                const tMap: Record<string, any> = {};
                tData?.forEach((t: any) => {
                    const mapped = mapTeamFromDB(t);
                    tMap[mapped.id] = mapped;
                });
                setTeamsMap(tMap);
            }
            if (Object.keys(rolesMap).length === 0 && tableName !== 'roles') {
                const rData = await snapshotService.fetchSnapshotTableData(snapshot.id, 'roles');
                const rMap: Record<string, any> = {};
                rData?.forEach((r: any) => {
                    const mapped = mapRoleFromDB(r);
                    rMap[mapped.id] = mapped;
                });
                setRolesMap(rMap);
            }
            if (Object.keys(tasksMap).length === 0 && tableName !== 'task_templates') {
                const taskData = await snapshotService.fetchSnapshotTableData(snapshot.id, 'task_templates');
                const tMap: Record<string, any> = {};
                taskData?.forEach((t: any) => {
                    const mapped = mapTaskFromDB(t);
                    tMap[mapped.id] = mapped;
                });
                setTasksMap(tMap);
            }
            if (Object.keys(equipmentMap).length === 0 && tableName === 'equipment_daily_checks') {
                const eData = await snapshotService.fetchSnapshotTableData(snapshot.id, 'equipment');
                const eMap: Record<string, any> = {};
                eData?.forEach((e: any) => {
                    const mapped = mapEquipmentFromDB(e);
                    eMap[mapped.id] = mapped;
                });
                setEquipmentMap(eMap);
            }

            // Map the primary table data
            let mappedData = data || [];
            if (data) {
                switch (tableName) {
                    case 'people': mappedData = data.map(mapPersonFromDB); break;
                    case 'teams': mappedData = data.map(mapTeamFromDB); break;
                    case 'roles': mappedData = data.map(mapRoleFromDB); break;
                    case 'task_templates': mappedData = data.map(mapTaskFromDB); break;
                    case 'shifts': mappedData = data.map(mapShiftFromDB); break;
                    case 'absences': mappedData = data.map(mapAbsenceFromDB); break;
                    case 'hourly_blockages': mappedData = data.map(mapHourlyBlockageFromDB); break;
                    case 'equipment': mappedData = data.map(mapEquipmentFromDB); break;
                    case 'equipment_daily_checks': mappedData = data.map(mapEquipmentDailyCheckFromDB); break;
                }
            }

            setTableData(mappedData);
        } catch (error) {
            console.error('Error fetching table data:', error);
            setViewingTable(null);
        } finally {
            setLoadingData(false);
        }
    };
    const getTableIcon = (tableName: string) => {
        switch (tableName) {
            case 'people': return <Users size={20} weight="duotone" className="text-blue-500" />;
            case 'task_templates':
            case 'shifts': return <CheckCircle size={20} weight="duotone" className="text-green-500" />;
            case 'daily_presence':
            case 'unified_presence': return <UserCircle size={20} weight="duotone" className="text-orange-500" />;
            case 'equipment':
            case 'equipment_daily_checks': return <Shield size={20} weight="duotone" className="text-purple-500" />;
            case 'absences': return <Calendar size={20} weight="duotone" className="text-red-500" />;
            case 'hourly_blockages': return <Clock size={20} weight="duotone" className="text-amber-500" />;
            default: return <FileText size={20} weight="duotone" className="text-slate-400" />;
        }
    };

    const groups = [
        { title: 'כוח אדם והרשאות', tables: ['people', 'teams', 'roles'] },
        { title: 'משימות ושיבוצים', tables: ['task_templates', 'shifts'] },
        { title: 'נוכחות ויציאות', tables: ['daily_presence', 'unified_presence', 'absences', 'hourly_blockages'] },
        { title: 'ציוד ואמצעים', tables: ['equipment', 'equipment_daily_checks'] }
    ];

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center shrink-0">
                        <FileText size={24} weight="duotone" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">תצוגה מקדימה: {snapshot.name}</h2>
                        <p className="text-sm font-bold text-slate-400">פרטי המידע השמורים בגרסה זו</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500">סגור</Button>
                    <Button
                        variant="primary"
                        icon={ArrowsClockwise}
                        onClick={onRestore}
                        className="shadow-lg shadow-orange-100"
                    >
                        שחזר לגרסה זו
                    </Button>
                </div>
            }
            size="lg"
        >
            <div className="space-y-6">
                <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                        <Calendar size={18} className="text-slate-400" />
                        תאריך יצירה: <span className="text-slate-900">{new Date(snapshot.created_at).toLocaleString('he-IL')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                        <User size={18} className="text-slate-400" />
                        נוצר על ידי: <span className="text-slate-900">{snapshot.created_by_name}</span>
                    </div>
                    {snapshot.description && (
                        <div className="md:col-span-2 flex items-start gap-2 text-sm text-slate-600 font-bold">
                            <FileText size={18} className="text-slate-400 mt-0.5" />
                            תיאור: <span className="text-slate-900 font-normal">{snapshot.description}</span>
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <h3 className="text-base font-black text-slate-800">סיכום נתונים</h3>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">לחץ על טבלה לצפייה בנתונים</span>
                    </div>

                    {viewingTable ? (
                        loadingData ? (
                            <div className="h-40 flex items-center justify-center text-slate-400 animate-pulse font-bold">טוען נתונים...</div>
                        ) : (
                            <TableDataViewer
                                tableName={viewingTable}
                                data={tableData}
                                onBack={() => setViewingTable(null)}
                                peopleMap={peopleMap}
                                teamsMap={teamsMap}
                                rolesMap={rolesMap}
                                tasksMap={tasksMap}
                                equipmentMap={equipmentMap}
                            />
                        )
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {groups.map(group => (
                                <div key={group.title} className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{group.title}</h4>
                                    <div className="space-y-2">
                                        {group.tables.map(tableName => {
                                            const count = snapshot.record_counts[tableName] || 0;
                                            return (
                                                <button
                                                    key={tableName}
                                                    onClick={() => count > 0 && handleViewTable(tableName)}
                                                    className={`
                                                        w-full flex items-center justify-between border rounded-xl p-3 shadow-sm transition-all
                                                        ${count > 0
                                                            ? 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-md cursor-pointer'
                                                            : 'bg-slate-50 border-slate-100 opacity-60 cursor-default'
                                                        }
                                                    `}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        {getTableIcon(tableName)}
                                                        <span className="text-sm font-bold text-slate-700">{getTableLabel(tableName)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-xs font-black">
                                                            {count.toLocaleString()}
                                                        </span>
                                                        {count > 0 && <Eye size={12} className="text-slate-300" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-4">
                    <Clock size={24} weight="duotone" className="text-orange-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="text-sm font-black text-orange-800">שימו לב: שחזור הנתונים מחליף את המצב הנוכחי</h4>
                        <p className="text-xs text-orange-700 leading-relaxed font-bold">
                            פעולת השחזור תמחק את כל המידע הקיים בארגון כרגע ותחליף אותו במידע שנשמר בגרסה זו. מומלץ ליצור גרסה של המצב הנוכחי לפני השחזור.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

