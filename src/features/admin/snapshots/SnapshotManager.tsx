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
    Clock,
    Plus,
    Trash,
    ArrowsClockwise,
    Eye,
    FileText,
    User,
    Calendar,
    Shield
} from '@phosphor-icons/react';
import { useQueryClient } from '@tanstack/react-query';
import { SnapshotPreviewModal } from './components/SnapshotPreviewModal';
import { SnapshotListSkeleton } from './SnapshotListSkeleton';

const MAX_SNAPSHOTS = 5;
const RESTORE_VERIFICATION_TEXT = 'שחזור';

interface SnapshotManagerProps {
    organizationId: string;
}

export const SnapshotManager: React.FC<SnapshotManagerProps> = ({ organizationId }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const queryClient = useQueryClient();

    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');

    const [previewSnapshot, setPreviewSnapshot] = useState<Snapshot | null>(null);
    const [restoringSnapshot, setRestoringSnapshot] = useState<Snapshot | null>(null);
    const [selectedTables, setSelectedTables] = useState<string[] | undefined>(undefined);
    const [restoreVerification, setRestoreVerification] = useState('');
    const [restoreProgress, setRestoreProgress] = useState<string>('');

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

    const handleRestore = async (snapshot: Snapshot, tables?: string[]) => {
        setRestoringSnapshot(snapshot);
        setSelectedTables(tables);
        setRestoreVerification('');
    };

    const confirmRestore = async () => {
        if (!restoringSnapshot || !user) return;
        if (restoreVerification !== RESTORE_VERIFICATION_TEXT) {
            showToast(`נא להקליד "${RESTORE_VERIFICATION_TEXT}" לאישור`, 'error');
            return;
        }

        setCreating(true);
        setRestoreProgress('🔄 יוצר גיבוי בטיחות...');

        try {
            showToast('🔄 יוצר גיבוי בטיחות...', 'info');

            const result = await snapshotService.restoreSnapshot(
                restoringSnapshot.id,
                organizationId,
                user.id,
                (progress: string) => setRestoreProgress(progress),
                selectedTables
            );

            showToast(
                `הגרסה שוחזרה בהצלחה! ${result.preRestoreSnapshotId ? '\n🔒 נוצר גיבוי אוטומטי של המצב הקודם' : ''}`,
                'success'
            );

            setRestoringSnapshot(null);
            setPreviewSnapshot(null);
            await loadSnapshots();

            // Hard refresh strategy to ensure data is updated
            // 1. Immediate reset to force loading state
            await queryClient.resetQueries({ queryKey: ['organizationData'] });
            await queryClient.resetQueries({ queryKey: ['battalionPresence'] });

            // 2. Scheduled invalidation to catch any replication lag
            setTimeout(() => {
                console.log('🔄 Secondary invalidation for consistency');
                queryClient.invalidateQueries({ queryKey: ['organizationData'] });
                queryClient.invalidateQueries({ queryKey: ['battalionPresence'] });
            }, 1000);

            showToast('הנתונים מתעדכנים...', 'info');
        } catch (error: any) {
            console.error('Error restoring snapshot:', error);
            showToast(error.message || 'שגיאה בשחזור הגרסה', 'error');
        } finally {
            setCreating(false);
            setRestoreProgress('');
        }
    };



    if (loading && snapshots.length === 0) {
        return <SnapshotListSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 md:mb-2">
                <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-800 text-right">גיבויים (Snapshots)</h2>
                    <p className="text-xs md:text-sm text-slate-500 font-bold text-right">שמור ושחזר את מצב המערכת בנקודות זמן שונות</p>
                </div>
                <Button
                    variant="primary"
                    icon={Plus}
                    onClick={() => setShowCreateModal(true)}
                    disabled={snapshots.length >= 5}
                    className="shadow-lg shadow-blue-100 w-full md:w-auto py-3 md:py-2.5"
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
                        <div className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${snapshots.length >= 10 ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            <span dir="ltr">{snapshots.length} / 10</span> גרסאות בשימוש
                        </div>
                    </div>
                    {snapshots.map((snapshot) => (
                        <div key={snapshot.id} className="bg-white border border-slate-200 rounded-[1.5rem] md:rounded-3xl p-4 md:p-5 hover:border-blue-300 transition-all group shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-start gap-3 md:gap-4">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-slate-50 text-slate-400 rounded-xl md:rounded-2xl flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors shrink-0">
                                    <FileText size={20} className="md:w-6 md:h-6" weight="duotone" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-black text-slate-800 text-base md:text-lg leading-tight truncate">{snapshot.name}</h3>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5 md:mt-1">
                                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500 font-bold">
                                            <Calendar size={14} className="shrink-0" />
                                            <span className="whitespace-nowrap">{new Date(snapshot.created_at).toLocaleDateString('he-IL')}</span>
                                            <span className="opacity-50 hidden md:inline">|</span>
                                            <span className="whitespace-nowrap md:hidden">{new Date(snapshot.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className="whitespace-nowrap hidden md:inline">{new Date(snapshot.created_at).toLocaleTimeString('he-IL')}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-500 font-bold">
                                            <User size={14} className="shrink-0" />
                                            <span className="truncate max-w-[80px] md:max-w-none">{snapshot.created_by_name || 'המערכת'}</span>
                                        </div>
                                    </div>
                                    {snapshot.description && (
                                        <p className="text-xs md:text-sm text-slate-500 mt-2 font-medium line-clamp-1 border-r-2 border-slate-100 pr-2">{snapshot.description}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 md:pl-2 w-full md:w-auto border-t md:border-t-0 border-slate-50 pt-3 md:pt-0 mt-1 md:mt-0">
                                <Button
                                    variant="ghost"
                                    icon={Eye}
                                    onClick={() => setPreviewSnapshot(snapshot)}
                                    className="h-10 flex-1 md:flex-none md:px-4 rounded-xl bg-slate-50 md:bg-transparent text-slate-600 hover:text-blue-600 hover:bg-blue-50 font-bold text-xs md:text-sm"
                                >
                                    תצוגה
                                </Button>
                                <Button
                                    variant="ghost"
                                    icon={ArrowsClockwise}
                                    onClick={() => handleRestore(snapshot)}
                                    className="h-10 flex-1 md:flex-none md:px-4 rounded-xl bg-slate-50 md:bg-transparent text-slate-600 hover:text-orange-600 hover:bg-orange-50 font-bold text-xs md:text-sm"
                                >
                                    שחזר
                                </Button>
                                <Button
                                    variant="ghost"
                                    icon={Trash}
                                    onClick={() => handleDeleteSnapshot(snapshot.id)}
                                    className="h-10 w-10 !p-0 rounded-xl bg-slate-50 md:bg-transparent text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
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
