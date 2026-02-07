import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { adminService } from '../../services/adminService';
import { supabase } from '../../services/supabaseClient';
import { useToast } from '../../contexts/ToastContext';
import { FloppyDisk as Save, CheckCircle, Clock, Shield, Link as LinkIcon, Moon, Trash as Trash2, Users, MagnifyingGlass as Search, PencilSimple as Pencil, Info, Copy, ArrowsClockwise as RefreshCw, Gear as Settings, Plus, Gavel, SquaresFour as Layout, UserCircle, Globe, Anchor, Pulse as Activity, CaretLeft as ChevronLeft, Warning as AlertTriangle, Megaphone, IdentificationBadge as Accessibility, PlusIcon, SpeakerHigh, LinkBreak, ClockCounterClockwise, ArrowUp, ArrowDown } from '@phosphor-icons/react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Team, Profile, UserPermissions, UserRole, OrganizationInvite, PermissionTemplate, ViewMode, Role, AuthorizedLocation, HomePageConfig, HomePageWidgetId } from '../../types';
import { PermissionEditor } from './PermissionEditor';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { logger } from '../../services/loggingService';
import { useConfirmation } from '../../hooks/useConfirmation';
import { Select } from '../../components/ui/Select';
import { PermissionEditorContent } from './PermissionEditorContent';
import { PageInfo } from '../../components/ui/PageInfo';
import { OrganizationMessagesManager } from './OrganizationMessagesManager';
import { OrganizationUserManagement } from './OrganizationUserManagement';
import { useTacticalDelete } from '@/hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '@/components/ui/TacticalDeleteWrapper';
import { TimePicker } from '../../components/ui/DatePicker';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';
import { LocationPickerModal } from '../../components/ui/LocationPickerModal';
import { MapPin } from '@phosphor-icons/react';
import { joinBattalion, fetchBattalion, unlinkBattalion } from '../../services/battalionService';
import { Battalion } from '../../types';
import { CustomFieldsManager } from '../personnel/CustomFieldsManager';
import { BattalionSettings } from '../battalion/BattalionSettings';
import { SnapshotManager } from './snapshots/SnapshotManager';
import { Skeleton } from '../../components/ui/Skeleton';
import { HomePageLayoutEditor } from './HomePageLayoutEditor';
import { SettingsSkeleton } from '../../components/ui/SettingsSkeleton';

import { canManageOrganization, getRoleDisplayName, getRoleDescription, SYSTEM_ROLE_PRESETS } from '../../utils/permissions';

const SCREENS: { id: ViewMode; label: string; icon: any }[] = [
    { id: 'dashboard', label: 'לוח שיבוצים', icon: Layout },
    { id: 'personnel', label: 'ניהול כוח אדם', icon: Users },
    { id: 'tasks', label: 'משימות', icon: CheckCircle },
    { id: 'attendance', label: 'נוכחות', icon: UserCircle },
    { id: 'stats', label: 'דוחות ונתונים', icon: Info },
    { id: 'constraints', label: 'ניהול אילוצים', icon: Anchor },
    { id: 'lottery', label: 'הגרלות', icon: Gavel },
    { id: 'equipment', label: 'ניהול אמצעים', icon: Shield },
    { id: 'logs', label: 'יומן פעילות', icon: Activity },
    { id: 'settings', label: 'הגדרות ארגון', icon: Settings },
];

const RoleTemplateManager: React.FC<{
    organizationId: string;
    templates: PermissionTemplate[];
    teams: Team[];
    onRefresh: () => void;
    onRestorePresets?: () => void; // NEW
    isAdmin?: boolean; // NEW
    isCreating: boolean;
    setIsCreating: (v: boolean) => void;
    isHq?: boolean;
}> = ({ organizationId, templates, teams, onRefresh, onRestorePresets, isAdmin, isCreating, setIsCreating, isHq }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [editingTemplate, setEditingTemplate] = useState<PermissionTemplate | null>(null);

    // Tactical Delete Hook
    const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
        async (id: string) => {
            await adminService.deletePermissionTemplate(id);
            showToast('התבנית נמחקה', 'success');
            onRefresh();
        },
        1300
    );

    const handleSaveTemplate = async (templateId: string | null, name: string, permissions: UserPermissions) => {
        const payload = {
            organization_id: organizationId,
            name,
            permissions
        };

        try {
            await adminService.savePermissionTemplate(templateId, payload);
            showToast('התבנית נשמרה בהצלחה' + (templateId ? ' וכל המשתמשים עודכנו' : ''), 'success');
            setIsCreating(false);
            setEditingTemplate(null);
            onRefresh();
        } catch (err) {
            console.error('Error saving template:', err);
            showToast('שגיאה בשמירת התבנית', 'error');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 md:gap-3">
                    <Shield className="text-indigo-600 flex-shrink-0" size={24} weight="bold" />
                    <div>
                        <h2 className="text-lg md:text-xl font-black text-slate-800">תבניות הרשאות</h2>
                        <p className="text-xs md:text-sm text-slate-500 font-bold">הגדר תפקידים מובנים כמו "מפקד מחלקה", "חייל" וכו'</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isAdmin && onRestorePresets && (
                        <Button
                            variant="secondary"
                            icon={RefreshCw}
                            onClick={onRestorePresets}
                            className="hidden md:flex"
                        >
                            שחזר תבניות מערכת
                        </Button>
                    )}
                </div>
            </div>

            {isAdmin && onRestorePresets && (
                <div className="md:hidden">
                    <Button
                        variant="secondary"
                        icon={RefreshCw}
                        onClick={onRestorePresets}
                        className="w-full"
                    >
                        שחזר תבניות מערכת
                    </Button>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(tmp => (
                    <div key={tmp.id} className={`bg-slate-50 border border-slate-200 rounded-2xl p-5 hover:border-blue-300 transition-all group shadow-sm ${isAnimating(tmp.id) ? 'tactical-scramble' : ''}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-black text-slate-800 text-lg">{tmp.name}</h3>
                            <div className="flex items-center gap-2 pl-1">
                                <Button
                                    variant="ghost"
                                    icon={Pencil}
                                    onClick={() => setEditingTemplate(tmp)}
                                    className="h-10 w-10 md:h-8 md:w-8 !p-0 rounded-xl bg-white md:bg-transparent border border-slate-200 md:border-transparent text-slate-500 hover:text-blue-600 shadow-sm md:shadow-none"
                                />
                                <Button
                                    variant="ghost"
                                    icon={Trash2}
                                    className="h-10 w-10 md:h-8 md:w-8 !p-0 rounded-xl bg-white md:bg-transparent border border-slate-200 md:border-transparent text-red-500 hover:bg-red-50 shadow-sm md:shadow-none"
                                    onClick={() => handleTacticalDelete(tmp.id)}
                                />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                                {tmp.permissions.dataScope === 'organization' ? 'כל הארגון' : tmp.permissions.dataScope === 'team' ? 'צוותי' : 'אישי'}
                            </span>
                            {Object.entries(tmp.permissions.screens).filter(([_, level]) => level !== 'none').length > 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold">
                                    {Object.entries(tmp.permissions.screens).filter(([_, level]) => level !== 'none').length} מסכים מורשים
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {(isCreating || editingTemplate) && (
                <TemplateEditorModal
                    isOpen={true}
                    onClose={() => { setIsCreating(false); setEditingTemplate(null); }}
                    template={editingTemplate}
                    onSave={handleSaveTemplate}
                    teams={teams}
                    isHq={isHq}
                />
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};

const TemplateEditorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    template: PermissionTemplate | null;
    onSave: (id: string | null, name: string, permissions: UserPermissions) => void;
    teams: Team[];
    isHq?: boolean;
}> = ({ isOpen, onClose, template, onSave, teams, isHq }) => {
    const [name, setName] = useState(template?.name || '');
    const [permissions, setPermissions] = useState<UserPermissions>(template?.permissions || {
        dataScope: 'organization',
        screens: {},
    });

    const handleSave = () => {
        if (!name.trim()) return;
        onSave(template?.id || null, name, permissions);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Shield size={24} weight="bold" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">{template ? 'עריכת תבנית' : 'יצירת תבנית חדשה'}</h2>
                        <p className="text-sm font-bold text-slate-400">הגדרת הרשאות ותפקידים</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="font-bold text-slate-500 hover:text-slate-700">ביטול</Button>
                    <Button variant="primary" icon={Save} onClick={handleSave} disabled={!name.trim()} className="shadow-none">שמור תבנית</Button>
                </div>
            }
            size="2xl"
        >
            <div className="space-y-6">
                <Input
                    label="שם התבנית"
                    placeholder="למשל: מפקד מחלקה"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="!bg-gray-50 font-black text-lg"
                />

                <div className="border-t border-slate-100 pt-6">
                    <PermissionEditorContent
                        permissions={permissions}
                        setPermissions={setPermissions}
                        teams={teams}
                        isHq={isHq}
                    />
                </div>
            </div>
        </Modal>
    );
};











const GeneralSettings: React.FC<{ organizationId: string; sectionId?: string }> = ({ organizationId, sectionId }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [start, setStart] = useState('22:00');
    const [end, setEnd] = useState('06:00');
    const [viewerDays, setViewerDays] = useState(2);
    const [homeForecastDays, setHomeForecastDays] = useState(30);
    // New Params
    const [daysOn, setDaysOn] = useState(11);
    const [daysOff, setDaysOff] = useState(3);
    const [minStaff, setMinStaff] = useState(0);
    const [rotationStart, setRotationStart] = useState('');
    const [attendanceEnabled, setAttendanceEnabled] = useState(false);
    const [locations, setLocations] = useState<AuthorizedLocation[]>([]);
    const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
    const [activeLocationIdx, setActiveLocationIdx] = useState<number | null>(null);
    const { leaveOrganization } = useAuth();
    const { confirm, modalProps } = useConfirmation();

    const handleLeaveOrg = () => {
        confirm({
            title: 'עזיבת ארגון',
            message: 'האם אתה בטוח שברצונך לעזוב את הארגון? הגישה שלך לנתוני הארגון תיחסם מיד.',
            confirmText: 'כן, עזוב ארגון',
            type: 'danger',
            onConfirm: async () => {
                await leaveOrganization();
                window.location.href = '/';
            }
        });
    };

    useEffect(() => {
        fetchSettings();
    }, [organizationId]);

    const fetchSettings = async () => {
        if (!organizationId) {
            setLoading(false);
            return;
        }
        try {
            const data = await adminService.fetchOrganizationSettings(organizationId);

            if (data) {
                setStart((data.night_shift_start || '22:00').slice(0, 5));
                setEnd((data.night_shift_end || '06:00').slice(0, 5));
                setViewerDays(data.viewer_schedule_days || 2);
                setHomeForecastDays(data.home_forecast_days || 30);
                setDaysOn(data.default_days_on || 11);
                setDaysOff(data.default_days_off || 3);
                setMinStaff(data.min_daily_staff || 0);
                setRotationStart(data.rotation_start_date || '');
                setAttendanceEnabled(data.attendance_reporting_enabled || false);
                setLocations(data.authorized_locations || []);
            }
        } catch (err) {
            console.warn('Failed to fetch settings, using defaults');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                organization_id: organizationId,
                night_shift_start: start,
                night_shift_end: end,
                viewer_schedule_days: viewerDays,
                home_forecast_days: homeForecastDays,
                default_days_on: daysOn,
                default_days_off: daysOff,
                rotation_start_date: rotationStart || null,
                min_daily_staff: minStaff,
                attendance_reporting_enabled: attendanceEnabled,
                authorized_locations: locations
            };

            const { error } = await supabase.rpc('update_organization_settings', payload);
            if (error) throw error;

            setShowSuccess(true);
            showToast('ההגדרות נשמרו בהצלחה', 'success');
            setTimeout(() => setShowSuccess(false), 3000);
        } catch (error) {
            console.error('Error save settings:', error);
            showToast('שגיאה בשמירת ההגדרות', 'error');
        }
        setSaving(false);
    };

    if (loading) return <div className="text-slate-500 text-sm">טוען הגדרות...</div>;

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="flex-1 w-full md:w-auto">
                    <TimePicker
                        label="התחלת לילה"
                        value={start}
                        onChange={setStart}
                    />
                </div>
                <div className="flex-1 w-full md:w-auto">
                    <TimePicker
                        label="סיום לילה"
                        value={end}
                        onChange={setEnd}
                    />
                </div>
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-4">

                <Input
                    type="number"
                    label="חשיפת לו&quot;ז (ימים)"
                    min={1}
                    max={30}
                    value={viewerDays}
                    onChange={e => setViewerDays(parseInt(e.target.value))}
                    className="!bg-gray-50"
                    containerClassName="w-32"
                />

                <Input
                    type="number"
                    label="צפי יציאות הביתה (ימים)"
                    min={7}
                    max={90}
                    value={homeForecastDays}
                    onChange={e => setHomeForecastDays(parseInt(e.target.value))}
                    className="!bg-gray-50"
                    containerClassName="w-32"
                />
            </div>

            <div className="border-t border-slate-100 pt-6 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <Clock size={20} weight="bold" />
                        </div>
                        <div>
                            <h3 className="font-black text-slate-800">דיווח נוכחות (החתמת כרטיס)</h3>
                            <p className="text-xs text-slate-500 font-bold">אפשר לחיילים לדווח כניסה ויציאה מהבסיס בזמן אמת</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={attendanceEnabled}
                            onChange={e => setAttendanceEnabled(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                </div>

                {attendanceEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-black text-slate-700">מוצבים / מיקומים מורשים</h4>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={Plus}
                                onClick={() => {
                                    setActiveLocationIdx(-1);
                                    setIsMapPickerOpen(true);
                                }}
                            >
                                הוסף מיקום
                            </Button>
                        </div>

                        {locations.length === 0 ? (
                            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-6 text-center">
                                <p className="text-sm text-slate-500 font-bold">לא הוגדרו מיקומים. הגדר לפחות מיקום אחד כדי לאפשר דיווח.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-3">
                                {locations.map((loc, idx) => (
                                    <div key={loc.id} className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-end">
                                        <div className="flex-1 space-y-3 w-full">
                                            <Input
                                                label="שם המקום"
                                                value={loc.name}
                                                onChange={e => {
                                                    const newLocs = [...locations];
                                                    newLocs[idx].name = e.target.value;
                                                    setLocations(newLocs);
                                                }}
                                                className="!bg-slate-50"
                                            />
                                            <div className="flex items-center gap-4">
                                                <Input
                                                    label="רדיוס (מטרים)"
                                                    type="number"
                                                    value={loc.radius}
                                                    onChange={e => {
                                                        const newLocs = [...locations];
                                                        newLocs[idx].radius = parseInt(e.target.value);
                                                        setLocations(newLocs);
                                                    }}
                                                    className="!bg-slate-50 text-xs"
                                                    containerClassName="w-32"
                                                />
                                                <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 mt-6 h-10">
                                                    <MapPin size={16} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-500 truncate">
                                                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                icon={MapPin}
                                                title="עדכן מיקום על המפה"
                                                onClick={() => {
                                                    setActiveLocationIdx(idx);
                                                    setIsMapPickerOpen(true);
                                                }}
                                            />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                icon={Trash2}
                                                className="text-red-500 hover:bg-red-50"
                                                onClick={() => setLocations(locations.filter((_, i) => i !== idx))}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4">
                <Button
                    onClick={handleSave}
                    isLoading={saving}
                    icon={Save}
                    variant="primary"
                    className="shadow-none"
                >
                    {saving ? 'שומר...' : 'שמור שינויים'}
                </Button>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-rose-100 pt-8 mt-8">
                <div className="flex items-center gap-3 mb-4">
                    <Trash2 className="text-rose-500" size={20} weight="bold" />
                    <h3 className="text-lg font-black text-slate-800">אזור מסוכן</h3>
                </div>
                <div className="bg-rose-50 rounded-2xl p-6 border border-rose-100">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h4 className="font-bold text-rose-900">עזיבת הארגון</h4>
                            <p className="text-sm text-rose-700 font-medium">פעולה זו תנתק אותך מהארגון הנוכחי. תוכל להצטרף שוב רק באמצעות הזמנה חדשה.</p>
                        </div>
                        <Button
                            variant="danger"
                            icon={LinkBreak}
                            onClick={handleLeaveOrg}
                        >
                            עזוב ארגון
                        </Button>
                    </div>
                </div>
            </div>

            <LocationPickerModal
                isOpen={isMapPickerOpen}
                onClose={() => {
                    setIsMapPickerOpen(false);
                    setActiveLocationIdx(null);
                }}
                onSelect={(lat, lng) => {
                    if (activeLocationIdx === -1) {
                        const newLoc: AuthorizedLocation = {
                            id: crypto.randomUUID(),
                            name: 'מוצב חדש',
                            lat: parseFloat(lat.toFixed(6)),
                            lng: parseFloat(lng.toFixed(6)),
                            radius: 500
                        };
                        setLocations([...locations, newLoc]);
                        showToast('המיקום נוסף בהצלחה', 'success');
                    } else if (activeLocationIdx !== null) {
                        const newLocs = [...locations];
                        newLocs[activeLocationIdx].lat = parseFloat(lat.toFixed(6));
                        newLocs[activeLocationIdx].lng = parseFloat(lng.toFixed(6));
                        setLocations(newLocs);
                        showToast('המיקום עודכן מהמפה', 'success');
                    }
                }}
                initialLat={activeLocationIdx !== null && activeLocationIdx !== -1 ? locations[activeLocationIdx].lat : undefined}
                initialLng={activeLocationIdx !== null && activeLocationIdx !== -1 ? locations[activeLocationIdx].lng : undefined}
                radius={activeLocationIdx !== null && activeLocationIdx !== -1 ? locations[activeLocationIdx].radius : 500}
                title={activeLocationIdx !== null && activeLocationIdx !== -1 ? `בחירת מיקום עבור: ${locations[activeLocationIdx].name}` : 'בחר מיקום על המפה'}
            />
        </div>
    );
};

const BattalionAssociationSettings: React.FC<{ organizationId: string; currentBattalionId: string | null }> = ({ organizationId, currentBattalionId }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [unlinking, setUnlinking] = useState(false);
    const [code, setCode] = useState('');
    const [battalion, setBattalion] = useState<Battalion | null>(null);

    useEffect(() => {
        if (currentBattalionId) {
            loadBattalion();
        } else {
            setLoading(false);
        }
    }, [currentBattalionId]);

    const loadBattalion = async () => {
        try {
            const data = await fetchBattalion(currentBattalionId!);
            setBattalion(data);
        } catch (err) {
            console.error('Error fetching battalion:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleJoin = async () => {
        if (!code.trim()) return;
        setJoining(true);
        try {
            await joinBattalion(code.trim(), organizationId);
            showToast('הצטרפת לגדוד בהצלחה!', 'success');
            // Reload battalion data instead of full page refresh
            // We need to reload the page or trigger a deeper refresh to update the global auth state,
            // but for now we can atleast load the battalion details to show the "Connected" state
            // Note: In a real app we should probably reload window.location.reload() to get fresh permissions/state
            window.location.reload();
        } catch (err: any) {
            showToast('שגיאה בחיבור לגדוד: ' + err.message, 'error');
            setJoining(false);
        }
    };

    const handleUnlink = () => {
        confirm({
            title: 'ביטול שיוך לגדוד',
            message: 'האם אתה בטוח שברצונך לבטל את השיוך לגדוד? הפעולה תנתק את הקשר בין הפלוגה לגדוד.',
            confirmText: 'כן, בטל שיוך',
            type: 'danger',
            onConfirm: async () => {
                setUnlinking(true);
                try {
                    await unlinkBattalion(organizationId);
                    showToast('השיוך לגדוד בוטל בהצלחה', 'success');
                    setBattalion(null);
                    // Reload to clear global state effectively
                    window.location.reload();
                } catch (err: any) {
                    console.error('Unlink error:', err);
                    showToast('שגיאה בביטול השיוך', 'error');
                } finally {
                    setUnlinking(false);
                }
            }
        });
    };

    if (loading) return <div className="text-slate-500 text-sm">טוען נתוני גדוד...</div>;

    return (
        <div className="space-y-8 max-w-2xl">
            {battalion ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-5 md:p-8 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex flex-col sm:flex-row items-center gap-4 md:gap-6 text-center sm:text-right">
                            <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                                <Shield size={32} className="md:w-10 md:h-10" weight="bold" />
                            </div>
                            <div>
                                <p className="text-emerald-600 font-bold text-xs md:text-sm mb-1 uppercase tracking-wider">מחובר לגדוד</p>
                                <h2 className="text-2xl md:text-3xl font-black text-slate-900">{battalion.name}</h2>
                                <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                                    <span className="bg-white/60 px-3 py-1 rounded-lg text-[10px] md:text-xs font-mono font-bold text-slate-500 border border-emerald-200">
                                        קוד גדוד: {battalion.code}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <Button
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50 hover:text-red-700 font-bold shrink-0 w-full md:w-auto py-3 md:py-2"
                            onClick={handleUnlink}
                            isLoading={unlinking}
                            icon={LinkBreak}
                        >
                            ביטול שיוך
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-3xl p-8">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                <Anchor size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-900">חיבור לממשק גדודי</h3>
                                <p className="text-sm text-slate-500 font-bold">הזן את הקוד שקיבלת ממפקד הגדוד</p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                placeholder="הזן קוד גדוד (6 תווים)"
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                className="!bg-white text-center font-mono font-black text-xl tracking-widest h-14"
                                maxLength={6}
                            />
                            <Button
                                onClick={handleJoin}
                                isLoading={joining}
                                disabled={code.length < 6}
                                variant="primary"
                                className="h-14 px-8 shadow-lg shadow-blue-200 shrink-0"
                            >
                                הצטרף לגדוד
                            </Button>
                        </div>
                    </div>

                    <div className="flex gap-4 p-4 text-slate-400 text-sm font-medium">
                        <Info size={16} className="shrink-0 mt-0.5" />
                        <p>חיבור לגדוד מאפשר למפקדי הגדוד לצפות בנתוני הנוכחות והשיבוצים של הפלוגה שלך. תוכל לראות מידע זה גם במבט הגדודי הכללי.</p>
                    </div>
                </div>
            )}
            <ConfirmationModal {...modalProps} />
        </div>
    );
};


type SettingsTab = 'general' | 'home' | 'members' | 'roles' | 'messages' | 'teams' | 'battalion' | 'customFields' | 'snapshots';

export const OrganizationSettings: React.FC<{
    teams: Team[],
    initialTab?: SettingsTab,
    onClearNavigationAction?: () => void
}> = ({
    teams = [],
    initialTab,
    onClearNavigationAction
}) => {
        const { user, profile, organization } = useAuth();
        const [members, setMembers] = useState<Profile[]>([]);
        const [invites, setInvites] = useState<OrganizationInvite[]>([]);
        const [loading, setLoading] = useState(true);

        const [searchTerm, setSearchTerm] = useState('');
        const [templates, setTemplates] = useState<PermissionTemplate[]>([]);
        const [roles, setRoles] = useState<Role[]>([]); // New State
        const [searchParams, setSearchParams] = useSearchParams();
        const tabFromUrl = searchParams.get('tab') as SettingsTab | null;
        const [activeTab, setActiveTab] = useState<SettingsTab>(tabFromUrl || initialTab || 'general');

        useEffect(() => {
            if (activeTab && activeTab !== tabFromUrl) {
                // Keep URL in sync if needed, or just let it be
            }
        }, [activeTab]);

        useEffect(() => {
            if (initialTab) {
                setActiveTab(initialTab);
                onClearNavigationAction?.();
            }
        }, [initialTab]);
        const [organizationSettings, setOrganizationSettings] = useState<any>(null); // New organization settings state
        const [isCreating, setIsCreating] = useState(false);

        const { showToast } = useToast();
        const { confirm, modalProps } = useConfirmation();

        const { checkAccess } = useAuth();
        const isAdmin = profile?.is_super_admin || checkAccess('settings', 'edit');

        useEffect(() => {
            if (organization?.id) {
                loadInitialData();
            } else {
                setLoading(false);
            }
        }, [organization?.id]);

        const loadInitialData = async () => {
            setLoading(true);
            await Promise.all([
                fetchMembers(),
                fetchInvites(),
                fetchTemplates(),
                fetchRoles(),
                fetchOrganizationSettings()
            ]);
            setLoading(false);
        };

        const fetchOrganizationSettings = async () => {
            if (!organization) return;
            try {
                const data = await adminService.fetchOrganizationSettings(organization.id);
                if (data) {
                    setOrganizationSettings({
                        ...data,
                        customFieldsSchema: data.custom_fields_schema || []
                    });
                }
            } catch (error) {
                console.error('Error fetching org settings:', error);
            }
        };

        const fetchTemplates = async () => {
            if (!organization) return;
            try {
                const data = await adminService.fetchPermissionTemplates(organization.id);
                setTemplates(data);
            } catch (error) {
                console.error('Error fetching templates:', error);
            }
        };

        const fetchRoles = async () => {
            if (!organization) return;
            try {
                const data = await adminService.fetchRoles(organization.id);
                if (data) setRoles(data);
            } catch (error) {
                console.error('Error fetching roles:', error);
            }
        };

        const fetchMembers = async () => {
            if (!organization) return;
            try {
                const data = await adminService.fetchMembers(organization.id);
                setMembers(data || []);
            } catch (error) {
                console.error('Error fetching members:', error);
            }
        };

        const fetchInvites = async () => {
            if (!organization || !isAdmin) return;
            try {
                const data = await adminService.fetchInvites(organization.id);
                setInvites(data || []);
            } catch (error) {
                console.error('Error fetching invites:', error);
            }
        };




        const [editingPermissionsFor, setEditingPermissionsFor] = useState<Profile | null>(null);

        const handleOpenPermissionEditor = (member: Profile) => {
            setEditingPermissionsFor(member);
        };

        const handleSavePermissions = async (userId: string, permissions: UserPermissions, templateId?: string | null) => {
            const payload: any = { permissions };

            if (templateId !== undefined) {
                payload.permission_template_id = templateId;
            }

            try {
                await adminService.updateProfile(userId, payload);
                showToast('הרשאות עודכנו בהצלחה', 'success');
                setMembers(prev => prev.map(m => m.id === userId ? {
                    ...m,
                    permissions,
                    permission_template_id: templateId !== undefined ? (templateId || undefined) : m.permission_template_id
                } : m));
            } catch (error) {
                showToast('שגיאה בשמירת הרשאות', 'error');
            }
            setEditingPermissionsFor(null);
        };

        if (!checkAccess('settings', 'edit') && !profile?.is_super_admin) {
            return (
                <div className="bg-white rounded-xl p-8 shadow-sm border border-red-200 text-center">
                    <Shield className="mx-auto text-red-500 mb-4" size={40} weight="bold" />
                    <h2 className="text-xl font-bold text-slate-800 mb-2">אין הרשאה</h2>
                    <p className="text-slate-600">רק מנהלים יכולים לגשת להגדרות הארגון</p>
                </div>
            );
        }

        if (loading) {
            return <SettingsSkeleton />;
        }

        const navigationTabs = [
            { id: 'general', label: 'כללי', icon: Settings },
            ...(organization?.org_type !== 'battalion' ? [{ id: 'home', label: 'דף הבית', icon: Layout }] : []),
            { id: 'roles', label: 'תבניות הרשאות', icon: Shield },
            { id: 'members', label: 'חברים', icon: Users },
            { id: 'messages', label: 'הודעות ועדכונים', icon: SpeakerHigh },
            { id: 'battalion', label: (organization?.org_type === 'battalion' || organization?.is_hq) ? 'הגדרות גדוד' : 'שיוך גדודי', icon: Anchor },
            { id: 'snapshots', label: 'גיבויים', icon: ClockCounterClockwise },
        ];

        return (
            <div className="bg-white rounded-[2rem] border border-slate-100 flex flex-col relative overflow-hidden" dir="rtl">
                {/* === Mobile Layout (< md) === */}
                {/* Header Removed - Content moved to main card */}

                {/* Content Container (Mobile: Pull-up Sheet, Desktop: Split View) */}
                <div className="md:flex flex-1 md:gap-8 md:p-6">

                    {/* === Desktop Sidebar (Left Menu) === */}
                    <div className="hidden md:flex flex-col w-64 shrink-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm h-full">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-lg">
                                    {organization?.name?.charAt(0)}
                                </div>
                                <div className="overflow-hidden">
                                    <h2 className="font-bold text-slate-800 truncate">{organization?.name}</h2>
                                    <p className="text-xs text-slate-500">ניהול מערכת</p>
                                </div>
                            </div>
                        </div>
                        <nav className="flex-1 p-2 space-y-1 overflow-y-auto" role="tablist" aria-orientation="vertical">
                            {navigationTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-indigo-50 text-indigo-700 font-bold border-r-4 border-indigo-600 rounded-r-none'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                        }`}
                                    role="tab"
                                    aria-selected={activeTab === tab.id}
                                    aria-controls={`panel-${tab.id}`}
                                >
                                    <tab.icon size={18} weight="bold" className={activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'} aria-hidden="true" />
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                        <div className="p-4 mt-auto border-t border-slate-100">
                            <a
                                href="/accessibility"
                                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all group"
                            >
                                <Accessibility size={18} weight="bold" className="text-slate-400 group-hover:text-slate-600" aria-hidden="true" />
                                הצהרת נגישות
                            </a>
                        </div>

                    </div>

                    {/* === Active Content Area === */}
                    {/* === Active Content Area === */}
                    <div className="flex-1 relative z-20 md:z-auto md:mt-0 md:mx-0 px-0 md:px-0 pb-20 md:pb-0 overflow-y-auto h-full hide-scrollbar">
                        <div className="bg-white rounded-[2rem] border border-slate-100 p-4 md:p-8">

                            {/* Mobile Only: Organization Info & Tabs */}
                            <div className="md:hidden space-y-6 mb-8">
                                <div className="text-center space-y-2">
                                    <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mb-2 shadow-sm border border-blue-100">
                                        <span className="text-3xl font-black">{organization?.name?.charAt(0) || 'O'}</span>
                                    </div>
                                    <h1 className="text-2xl font-black text-slate-900 flex items-center justify-center gap-2">
                                        {organization?.name}
                                        <PageInfo
                                            title="הגדרות ארגון"
                                            description={
                                                <>
                                                    <p className="mb-2">ניהול מרכזי של הגדרות המערכת והמשתמשים.</p>
                                                    <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                        <li><b>הזמנות:</b> יצירה וניהול של קישורי הצטרפות לארגון.</li>
                                                        <li><b>תבניות הרשאות:</b> הגדרת תפקידים (כמו מ"מ, סמ"פ) ורמות גישה.</li>
                                                        <li><b>משתמשים:</b> ניהול חברי הארגון, עריכת פרטים והרשאות אישיות.</li>
                                                        <li><b>הגדרות כלליות:</b> שעות לילה, הגדרות לו"ז ועוד.</li>
                                                    </ul>
                                                </>
                                            }
                                        />
                                    </h1>
                                    <p className="text-slate-500 font-medium text-sm">הגדרות וניהול מערכת</p>
                                </div>

                                <div className="bg-slate-100/50 p-1.5 rounded-2xl flex border border-slate-200 w-full overflow-x-auto hide-scrollbar">
                                    {navigationTabs.map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id as any)}
                                            className={`flex-1 flex items-center justify-center py-3 px-1 rounded-xl transition-all min-w-[50px] ${activeTab === tab.id
                                                ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200'
                                                : 'text-slate-400 hover:text-slate-600'
                                                }`}
                                            aria-label={tab.label}
                                        >
                                            <tab.icon size={20} weight={activeTab === tab.id ? 'fill' : 'bold'} />
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-slate-100 w-full"></div>
                            </div>

                            {activeTab === 'general' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="hidden md:flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                            <Settings className="text-slate-600" size={28} weight="bold" />
                                            הגדרות וניהול
                                            <PageInfo
                                                title="הגדרות ארגון"
                                                description={
                                                    <>
                                                        <p className="mb-2">ניהול מרכזי של הגדרות המערכת והמשתמשים.</p>
                                                        <ul className="list-disc list-inside space-y-1 mb-2 text-right">
                                                            <li><b>הזמנות:</b> יצירה וניהול של קישורי הצטרפות לארגון.</li>
                                                            <li><b>תבניות הרשאות:</b> הגדרת תפקידים (כמו מ"מ, סמ"פ) ורמות גישה.</li>
                                                            <li><b>משתמשים:</b> ניהול חברי הארגון, עריכת פרטים והרשאות אישיות.</li>
                                                            <li><b>הגדרות כלליות:</b> שעות לילה, הגדרות לו"ז ועוד.</li>
                                                        </ul>
                                                    </>
                                                }
                                            />
                                        </h2>
                                    </div>
                                    <section>
                                        <div className="flex items-center gap-2 mb-4 text-slate-800">
                                            <LinkIcon className="text-blue-500" size={20} weight="bold" />
                                            <h2 className="text-xl font-black">הגדרות הזמנה</h2>
                                        </div>
                                        <InviteLinkSettings
                                            organization={organization}
                                            onUpdate={fetchMembers}
                                            templates={templates}
                                            onViewTemplates={() => setActiveTab('roles')}

                                        />
                                    </section>

                                    {organization?.org_type !== 'battalion' && (
                                        <>
                                            <div className="h-px bg-slate-100 my-6"></div>

                                            <section>
                                                <div className="flex items-center gap-2 mb-4 text-slate-800">
                                                    <Clock className="text-orange-500" size={20} weight="bold" />
                                                    <h2 className="text-xl font-black">הגדרות כלליות</h2>
                                                </div>
                                                <GeneralSettings organizationId={organization?.id || ''} />
                                            </section>
                                        </>
                                    )}
                                </div>
                            )}

                            {activeTab === 'home' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="hidden md:flex items-center gap-2 mb-2 border-b border-slate-100 pb-4">
                                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                            <Layout className="text-blue-500" size={28} />
                                            הגדרות דף הבית
                                        </h2>
                                    </div>
                                    <HomePageLayoutEditor organizationId={organization?.id || ''} />
                                </div>
                            )}

                            {activeTab === 'roles' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <RoleTemplateManager
                                        organizationId={organization?.id || ''}
                                        templates={templates}
                                        teams={teams}
                                        onRefresh={fetchTemplates}
                                        isCreating={isCreating}
                                        setIsCreating={setIsCreating}
                                        isHq={organization?.is_hq}
                                    />
                                </div>
                            )}

                            {activeTab === 'members' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <OrganizationUserManagement teams={teams} />
                                </div>
                            )}


                            {activeTab === 'messages' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <OrganizationMessagesManager teams={teams} roles={roles} />
                                </div>
                            )}

                            {activeTab === 'battalion' && (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="hidden md:flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
                                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                                            <Anchor className="text-blue-500" size={28} />
                                            {(organization?.org_type === 'battalion' || organization?.is_hq) ? 'הגדרות גדוד' : 'שיוך גדודי'}
                                        </h2>
                                    </div>
                                    {(organization?.org_type === 'battalion' || organization?.is_hq) ? (
                                        <BattalionSettings embedded={true} />
                                    ) : (
                                        <BattalionAssociationSettings
                                            organizationId={organization?.id || ''}
                                            currentBattalionId={organization?.battalion_id || null}
                                        />
                                    )}
                                </div>
                            )}
                            {activeTab === 'snapshots' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <SnapshotManager organizationId={organization?.id || ''} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Unified FAB for Organization Settings */}
                <FloatingActionButton
                    icon={Plus}
                    onClick={() => {
                        if (activeTab === 'roles') setIsCreating(true);
                    }}
                    ariaLabel={activeTab === 'roles' ? 'תבנית חדשה' : 'הזמן משתמש'}
                    show={isAdmin && !loading && activeTab === 'roles'}
                />

                {editingPermissionsFor && (
                    <PermissionEditor
                        isOpen={true}
                        onClose={() => setEditingPermissionsFor(null)}
                        user={editingPermissionsFor}
                        onSave={handleSavePermissions}
                        teams={teams}
                        templates={templates}
                        onManageTemplates={() => setActiveTab('roles')}
                        isHq={organization?.is_hq}
                    />
                )}
                <ConfirmationModal {...modalProps} />
            </div>
        );
    };

const InviteLinkSettings: React.FC<{
    organization: any;
    onUpdate: () => void;
    templates: PermissionTemplate[];
    onViewTemplates: () => void;
}> = ({ organization, onUpdate, templates, onViewTemplates }) => {
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isActive, setIsActive] = useState(organization?.is_invite_link_active || false);
    const [templateId, setTemplateId] = useState<string | null>(organization?.invite_link_template_id || null);
    const [inviteToken, setInviteToken] = useState(organization?.invite_token || '');

    useEffect(() => {
        if (organization) {
            setIsActive(organization.is_invite_link_active);
            setTemplateId(organization.invite_link_template_id || null);
            setInviteToken(organization.invite_token);
        }
    }, [organization]);

    const handleToggleActive = async () => {
        setLoading(true);
        try {
            let token = inviteToken;
            if (!isActive && !token) {
                token = await adminService.generateInviteToken();
                setInviteToken(token);
            }

            await adminService.updateOrganizationInviteConfig(organization.id, { is_invite_link_active: !isActive, invite_token: token });
            setIsActive(!isActive);
        } catch (error) {
            console.error('Error toggling invite link:', error);
            showToast('שגיאה בעדכון סטטוס קישור', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        confirm({
            title: 'יצירת קישור חדש',
            message: 'הקישור הקיים יבוטל. האם להמשיך?',
            confirmText: 'כן, צור חדש',
            type: 'warning',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const data = await adminService.generateInviteToken();
                    setInviteToken(data);
                    setIsActive(true);
                    showToast('קישור חדש נוצר', 'success');
                } catch (error) {
                    showToast('שגיאה ביצירה', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleTemplateChange = async (e: any) => {
        const tid = e.target ? e.target.value : e;
        setTemplateId(tid);
        setLoading(true);
        try {
            await adminService.updateOrganizationInviteConfig(organization.id, { invite_link_template_id: tid || null });
            showToast('תבנית עודכנה', 'success');
        } catch (error) {
            showToast('שגיאה בעדכון תבנית', 'error');
        } finally {
            setLoading(false);
        }
    };

    const copyToClipboard = () => {
        const link = `${window.location.origin}/join/${inviteToken}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link);
            setCopied(true);
            showToast('הועתק!', 'success');
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="space-y-6">
            {/* --- Link Invite Section --- */}
            <div className="bg-gray-50 border border-slate-200 rounded-2xl p-4 md:p-6 space-y-6">
                {/* 1. Toggle Row */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">סטטוס קישור הצטרפות</h3>
                        <p className="text-xs text-slate-500">אפשר למשתמשים להצטרף באופן עצמאי</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={isActive}
                            onChange={handleToggleActive}
                            disabled={loading}
                        />
                        <div className="w-12 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>

                {/* 2. Active State Controls */}
                {isActive && inviteToken && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-1">
                        {/* Template Selector - Compact */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                                <Shield size={12} weight="bold" /> תבנית הרשאות למצטרפים (דרך הקישור)
                            </label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Select
                                        value={templateId || ''}
                                        onChange={handleTemplateChange}
                                        options={[
                                            { value: '', label: 'ללא (צפייה בלבד)' },
                                            ...templates.map(t => ({ value: t.id, label: t.name }))
                                        ]}
                                        className="!bg-white !h-10 text-base"
                                        placeholder="בחר תבנית..."
                                    />
                                </div>
                                <button onClick={onViewTemplates} className="bg-white border border-slate-200 rounded-lg px-3 hover:bg-slate-50 text-slate-500">
                                    <Settings size={16} weight="bold" />
                                </button>
                            </div>
                        </div>

                        {/* Copy Link Button */}
                        <div>
                            <label className="text-xs font-bold text-slate-600 mb-1.5 block">קישור ייחודי</label>
                            <button
                                onClick={copyToClipboard}
                                className="w-full flex items-center justify-between bg-white border-2 border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 rounded-xl p-3 transition-all group"
                            >
                                <span className="text-base font-mono truncate dir-ltr px-2 opacity-80 group-hover:opacity-100">
                                    {window.location.origin}/join/{inviteToken.slice(0, 8)}...
                                </span>
                                <div className="flex items-center gap-2 font-bold text-sm bg-slate-100 px-3 py-1.5 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-700">
                                    {copied ? <CheckCircle size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                                    <span>{copied ? 'הועתק' : 'העתק'}</span>
                                </div>
                            </button>
                        </div>

                        <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100/50">
                            <div className="flex gap-2">
                                <Info size={16} className="text-blue-500 shrink-0 mt-0.5" weight="bold" />
                                <div className="space-y-1">
                                    <p className="text-xs font-bold text-blue-900">טיפ: ניתן להזין קוד ידנית</p>
                                    <p className="text-[11px] text-blue-700 leading-relaxed font-medium">
                                        במקום לשלוח קישור מלא, ניתן לשלוח רק את הקוד <b>{inviteToken}</b>. המשתמשים יוכלו להזין אותו ידנית במסך ההרשמה תחת "קיבלת קוד הצטרפות?".
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <button onClick={handleRegenerate} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                                <RefreshCw size={10} weight="bold" /> אפס קישור קיים
                            </button>
                        </div>
                    </div>
                )}
                <ConfirmationModal {...modalProps} />
                <TacticalDeleteStyles />
            </div>


        </div>
    );
};
