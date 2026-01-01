import React, { useState, useMemo } from 'react';
import { Person, Team, SchedulingConstraint, TaskTemplate, Role } from '../../types';
import { useToast } from '../../contexts/ToastContext';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { MagnifyingGlass as Search, Funnel as Filter, ShieldWarning as ShieldAlert, Briefcase, User, Users, Shield, Prohibit as Ban, PushPin as Pin, Trash as Trash2, Plus, PencilSimple as Edit2, WarningCircle as AlertCircle } from '@phosphor-icons/react';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { MultiSelect } from '../../components/ui/MultiSelect';
import { GenericModal } from '@/components/ui/GenericModal';
import { Button } from '../../components/ui/Button';
import { PageInfo } from '../../components/ui/PageInfo';
import { cn } from '@/lib/utils';
import { FloatingActionButton } from '../../components/ui/FloatingActionButton';

interface ConstraintsManagerProps {
    people: Person[];
    teams: Team[];
    roles: Role[];
    tasks: TaskTemplate[];
    constraints: SchedulingConstraint[];
    onAddConstraint: (c: Omit<SchedulingConstraint, 'id'>, silent?: boolean) => void;
    onDeleteConstraint: (id: string, silent?: boolean) => void;
    isViewer?: boolean;
    organizationId: string;
}

export const ConstraintsManager: React.FC<ConstraintsManagerProps> = ({
    people,
    teams,
    roles,
    tasks,
    constraints,
    onAddConstraint,
    onDeleteConstraint,
    isViewer = false,
    organizationId
}) => {
    const activePeople = people.filter(p => p.isActive !== false);
    const { showToast } = useToast();

    // --- State for Task Rules ---
    const [ruleTargetType, setRuleTargetType] = useState<'person' | 'team' | 'role'>('person');
    const [ruleTargetIds, setRuleTargetIds] = useState<string[]>([]); // MultiSelect
    const [ruleTargetIdSingle, setRuleTargetIdSingle] = useState<string>(''); // Single Select (Team/Role)
    const [ruleTaskIds, setRuleTaskIds] = useState<string[]>([]); // MultiSelect for Tasks
    const [ruleType, setRuleType] = useState<'never_assign' | 'always_assign'>('never_assign');
    const [rulesSearch, setRulesSearch] = useState('');

    // Modal State
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

    // --- Helpers / Derived State ---

    const taskConstraintsGrouped = useMemo(() => {
        const groups: Record<string, {
            id: string; // use first ID as key or create composite
            targetId: string;
            targetType: 'person' | 'team' | 'role';
            type: string;
            taskIds: string[];
            ids: string[]; // Keep track of all real DB IDs in this group
        }> = {};

        constraints
            .filter(c => !c.personId || activePeople.some(p => p.id === c.personId))
            .forEach(c => {
                // Apply Filters first
                if (rulesSearch) {
                    let taskMatch = false;
                    if (c.taskId) {
                        const task = tasks.find(t => t.id === c.taskId);
                        taskMatch = task?.name.toLowerCase().includes(rulesSearch.toLowerCase()) || false;
                    } else {
                        taskMatch = "כללי".includes(rulesSearch) || "general".includes(rulesSearch.toLowerCase());
                    }

                    let targetName = '';
                    if (c.personId) targetName = people.find(p => p.id === c.personId)?.name || '';
                    else if (c.teamId) targetName = teams.find(t => t.id === c.teamId)?.name || '';
                    else if (c.roleId) targetName = roles.find(r => r.id === c.roleId)?.name || '';

                    const targetMatch = targetName.toLowerCase().includes(rulesSearch.toLowerCase());

                    if (!taskMatch && !targetMatch) return;
                }

                // Create Group Key
                let targetType: 'person' | 'team' | 'role' = 'person';
                let targetId = '';
                if (c.personId) { targetType = 'person'; targetId = c.personId; }
                else if (c.teamId) { targetType = 'team'; targetId = c.teamId; }
                else if (c.roleId) { targetType = 'role'; targetId = c.roleId; }

                const key = `${targetType}-${targetId}-${c.type}`;

                if (!groups[key]) {
                    groups[key] = {
                        id: c.id,
                        targetId,
                        targetType,
                        type: c.type,
                        taskIds: [],
                        ids: []
                    };
                }

                if (c.taskId) groups[key].taskIds.push(c.taskId);
                groups[key].ids.push(c.id);
            });

        return Object.values(groups);
    }, [constraints, tasks, people, teams, roles, rulesSearch]);

    const getTargetNameFromGroup = (group: { targetId: string, targetType: 'person' | 'team' | 'role' }) => {
        if (group.targetType === 'person') {
            const p = people.find(x => x.id === group.targetId);
            return { name: p?.name || 'Unknown', icon: User, type: 'person' };
        }
        if (group.targetType === 'team') {
            const t = teams.find(x => x.id === group.targetId);
            return { name: t?.name || 'Unknown', icon: Users, type: 'team' };
        }
        if (group.targetType === 'role') {
            const r = roles.find(x => x.id === group.targetId);
            return { name: r?.name || 'Unknown', icon: Shield, type: 'role' };
        }
        return { name: 'Unknown', icon: User, type: 'unknown' };
    };

    // --- Handlers ---

    const openRuleModal = (group?: typeof taskConstraintsGrouped[0]) => {
        if (isViewer) return;

        if (group) {
            // Edit Mode
            setEditingRuleId(group.id); // We store the PRIMARY ID, or we need a way to track the group
            // Ideally we track the group key properties, but 'editingRuleId' implies singular
            // Let's store the IDs we need to delete!
            // But state expects 'editingRuleId' as string. 
            // We can trick it: We use group.id for "editing mode" flag.
            // AND we need to know that we are editing a group. 
            // Let's rely on `ruleTargetIds` and `ruleType` to find what to replace in `handleSaveRule`? No, that's risky if user changes target.

            // BETTER: We will look up the original target+type using `editingRuleId` in `constraints` before saving? 
            // Actually, simplest is to pass the IDs to delete.
            // But we don't have a state for that.

            // Let's just set the form values.
            setRuleTaskIds(group.taskIds);
            setRuleType(group.type as any);

            if (group.targetType === 'person') {
                setRuleTargetType('person');
                setRuleTargetIds([group.targetId]);
            } else if (group.targetType === 'team') {
                setRuleTargetType('team');
                setRuleTargetIdSingle(group.targetId);
            } else if (group.targetType === 'role') {
                setRuleTargetType('role');
                setRuleTargetIdSingle(group.targetId);
            }
        } else {
            // Add Mode - Reset
            setEditingRuleId(null);
            setRuleTargetIds([]);
            setRuleTargetIdSingle('');
            setRuleTaskIds([]);
            setRuleType('never_assign');
            // Default target type to person if not set
            if (!ruleTargetType) setRuleTargetType('person');
        }
        setIsRuleModalOpen(true);
    };

    // State for Confirmation Modal
    const [groupToDelete, setGroupToDelete] = useState<typeof taskConstraintsGrouped[0] | null>(null);

    const handleDeleteGroup = (group: typeof taskConstraintsGrouped[0]) => {
        if (isViewer) return;
        setGroupToDelete(group);
    };

    const confirmDelete = () => {
        if (groupToDelete) {
            groupToDelete.ids.forEach(id => onDeleteConstraint(id, true)); // Silent
            showToast('החוקים נמחקו בהצלחה', 'success');
            setGroupToDelete(null);
        }
    };

    const handleSaveRule = () => {
        if (isViewer) return;
        if (ruleTaskIds.length === 0) {
            showToast('נא לבחור לפחות משימה אחת', 'error');
            return;
        }

        const targets = [];
        if (ruleTargetType === 'person') {
            if (ruleTargetIds.length === 0) {
                showToast('נא לבחור חיילים', 'error');
                return;
            }
            targets.push(...ruleTargetIds.map(id => ({ type: 'person', id })));
        } else {
            if (!ruleTargetIdSingle) {
                showToast('נא לבחור יעד', 'error');
                return;
            }
            targets.push({ type: ruleTargetType, id: ruleTargetIdSingle });
        }

        // Handle Edit Mode:
        // If we are editing, we must delete the OLD constraints for this target/type?
        // But `editingRuleId` only points to ONE of them. 
        // We need to find the "Original" target/type that was being edited.
        // LIMITATION: If we only have `editingRuleId`, we can find that ONE constraint, see its personId/type, and assuming we are in "Group Edit Mode", deletes all matching.

        if (editingRuleId) {
            const originalC = constraints.find(c => c.id === editingRuleId);
            if (originalC) {
                // Find all siblings that matched the ORIGINAL Group
                const siblings = constraints.filter(c => {
                    const matchType = c.type === originalC.type;
                    const matchPerson = c.personId === originalC.personId;
                    const matchTeam = c.teamId === originalC.teamId;
                    const matchRole = c.roleId === originalC.roleId;
                    return matchType && matchPerson && matchTeam && matchRole;
                });
                // Delete them all silently
                siblings.forEach(s => onDeleteConstraint(s.id, true));
            }
        }

        let addedCount = 0;

        // Nested Loop: For each Target AND For each Task
        targets.forEach(target => {
            ruleTaskIds.forEach(taskId => {
                const newConstraint: Omit<SchedulingConstraint, 'id'> = {
                    organization_id: organizationId,
                    taskId: taskId,
                    type: ruleType,
                    description: 'Task Rule'
                };

                if (target.type === 'person') newConstraint.personId = target.id;
                else if (target.type === 'team') newConstraint.teamId = target.id;
                else if (target.type === 'role') newConstraint.roleId = target.id;

                // Check Duplicate (We already deleted siblings if editing SAME target, but user might have CHANGED target)
                // If user CHANGED target in edit, we deleted old, no conflict.
                // If user ADDING new, we check.
                const exists = constraints.find(c =>
                    // Exclude the ones we just deleted?
                    // No, `constraints` prop hasn't updated yet! 
                    // But `handleSaveRule` is typically async or batched? 
                    // `onDeleteConstraint` usually updates parent state. 
                    // If parent state update is slow, we might see "exists".
                    // Ideally we blindly add, assuming we trust the "Delete + Add" flow.
                    // But let's keep the check but ignore if we know we just deleted it?
                    // Hard to know. 
                    // Let's trust that if we deleted siblings, they are logically gone.
                    c.taskId === taskId &&
                    c.type === ruleType &&
                    (
                        (target.type === 'person' && c.personId === target.id) ||
                        (target.type === 'team' && c.teamId === target.id) ||
                        (target.type === 'role' && c.roleId === target.id)
                    )
                );

                // If editing, we know we deleted the old ones (conceptually). 
                // However, React state might not reflect update yet. 
                // If 'exists' is found, and it was one of the 'siblings', we should proceed (re-add).
                // If 'exists' is unrelated (e.g. user selected a DIFFERENT person who already has this rule), we should skip/warn.

                let isReplacing = false;
                if (editingRuleId) {
                    const originalC = constraints.find(c => c.id === editingRuleId);
                    if (originalC) {
                        const sameTarget =
                            (target.type === 'person' && originalC.personId === target.id) ||
                            (target.type === 'team' && originalC.teamId === target.id) ||
                            (target.type === 'role' && originalC.roleId === target.id);
                        if (sameTarget && ruleType === originalC.type) {
                            isReplacing = true;
                        }
                    }
                }

                if (!exists || isReplacing) {
                    onAddConstraint(newConstraint, true); // Silent add
                    addedCount++;
                }
            });
        });

        if (addedCount > 0) {
            showToast(editingRuleId ? 'החוקים עודכנו בהצלחה' : `${addedCount} חוקים נוספו בהצלחה`, 'success');
            setIsRuleModalOpen(false);
            setRuleTargetIds([]);
            setRuleTargetIdSingle('');
            setRuleTaskIds([]);
        } else {
            showToast('לא בוצעו שינויים (אולי החוקים כבר קיימים?)', 'info');
            setIsRuleModalOpen(false); // Close anyway
        }
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl md:shadow-portal border border-slate-100 flex flex-col h-[calc(100vh-11rem)] md:h-[calc(100vh-8rem)] overflow-hidden relative">
            {/* Header Section */}
            <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col gap-4 bg-white/50 backdrop-blur-sm z-10 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldAlert className="text-blue-600" size={32} weight="duotone" />
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 leading-none">ניהול אילוצים</h2>
                            <p className="text-xs md:text-sm font-bold text-slate-400 mt-1">
                                {taskConstraintsGrouped.length} חוקים פעילים
                            </p>
                        </div>
                    </div>
                    {/* Add Button - Desktop Only (Legacy/Alternative position, but we prefer FAB usually. Keeping hidden to rely on FAB or show for specific desktop preference if needed. For now, FAB is the standard) */}
                    {/* Actually, Golden Standard uses FAB for primary action. We'll stick to FAB. */}
                </div>

                {/* Search Bar */}
                <div className="w-full">
                    <div className="relative group">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} weight="duotone" />
                        <input
                            type="text"
                            placeholder="חיפוש חוק לפי שם משימה, חייל או תפקיד..."
                            value={rulesSearch}
                            onChange={(e) => setRulesSearch(e.target.value)}
                            className="w-full h-12 pr-12 pl-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 placeholder:font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 relative scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                {taskConstraintsGrouped.length > 0 ? (
                    taskConstraintsGrouped.map(group => {
                        const { name, icon: Icon, type } = getTargetNameFromGroup(group);
                        const taskNames = group.taskIds
                            .map(tid => tasks.find(t => t.id === tid)?.name)
                            .filter(Boolean)
                            .join(', ');

                        return (
                            <div key={group.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group relative overflow-hidden">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative z-10">
                                    {/* Icon Box */}
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${type === 'person' ? 'bg-blue-50 text-blue-600' : type === 'team' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'}`}>
                                        <Icon size={24} weight="duotone" />
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0 w-full">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                                            <div>
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">
                                                        {type === 'person' ? 'חייל' : type === 'team' ? 'צוות' : 'תפקיד'}
                                                    </span>
                                                    {isViewer && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">צפייה בלבד</span>}
                                                </div>
                                                <h3 className="text-lg font-black text-slate-800 leading-tight truncate">{name}</h3>
                                            </div>

                                            {/* Badge */}
                                            <span className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 w-fit ${group.type === 'never_assign' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                {group.type === 'never_assign' ? <Ban size={14} weight="duotone" /> : <Pin size={14} weight="duotone" />}
                                                {group.type === 'never_assign' ? 'לעולם לא לשבץ' : 'שבץ רק לזה'}
                                            </span>
                                        </div>

                                        <div className="flex items-start gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                                            <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${group.type === 'never_assign' ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                            <div>
                                                <span className="text-xs font-bold text-slate-400 block mb-0.5">משימות ({group.taskIds.length})</span>
                                                <p className="text-sm font-medium text-slate-600 leading-relaxed line-clamp-2 md:line-clamp-1" title={taskNames}>
                                                    {taskNames || '---'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    {!isViewer && (
                                        <div className="flex md:flex-col gap-2 shrink-0 w-full md:w-auto mt-2 md:mt-0 border-t md:border-t-0 p-2 md:p-0 border-slate-50">
                                            <button
                                                onClick={() => openRuleModal(group)}
                                                className="flex-1 md:flex-none p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                                title="ערוך חוק"
                                            >
                                                <Edit2 size={18} className="mx-auto" weight="duotone" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteGroup(group)}
                                                className="flex-1 md:flex-none p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                                title="מחק חוק"
                                            >
                                                <Trash2 size={18} className="mx-auto" weight="duotone" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                        <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                            <Shield className="text-slate-200" size={40} weight="duotone" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-400">לא נמצאו חוקים פעילים</h3>
                        <p className="text-sm text-slate-400 max-w-xs mt-2">השתמש בכפתור הפלוס כדי להוסיף אילוצי שיבוץ למערכת</p>
                    </div>
                )}
            </div>

            {/* Standard FAB */}
            <FloatingActionButton
                show={!isViewer && !isRuleModalOpen}
                onClick={() => openRuleModal()}
                icon={Plus}
                ariaLabel="הוסף חוק חדש"
            />

            {/* Task Rule Modal */}
            <GenericModal
                isOpen={isRuleModalOpen}
                onClose={() => setIsRuleModalOpen(false)}
                title={
                    <div className="flex flex-col gap-0.5">
                        <h3 className="text-xl font-black text-slate-800 leading-tight">
                            {editingRuleId ? 'עריכת חוק משימה' : 'הוספת חוק משימה חדש'}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-bold uppercase tracking-wider">
                            <ShieldAlert size={12} className="text-blue-500" weight="duotone" />
                            <span>הגדרת מגבלות לאלגוריתם השיבוץ</span>
                        </div>
                    </div>
                }
                size="lg"
                footer={
                    <div className="flex gap-3 w-full">
                        <Button
                            variant="ghost"
                            onClick={() => setIsRuleModalOpen(false)}
                            className="flex-1 h-12 md:h-10 text-base md:text-sm font-bold"
                        >
                            ביטול
                        </Button>
                        <Button
                            onClick={handleSaveRule}
                            className="flex-1 h-12 md:h-10 text-base md:text-sm font-black bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
                        >
                            {editingRuleId ? 'שמור שינויים' : 'הוסף חוק למערכת'}
                        </Button>
                    </div>
                }
            >
                <div className="flex flex-col gap-6 py-2">
                    {/* Target Type Selector */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">סוג היעד (על מי חל החוק?)</label>
                        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                            {([['person', 'חייל', User], ['team', 'צוות', Users], ['role', 'תפקיד', Shield]] as const).map(([type, label, Icon]) => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        if (type !== ruleTargetType) {
                                            setRuleTargetType(type);
                                            setRuleTargetIds([]);
                                            setRuleTargetIdSingle('');
                                        }
                                    }}
                                    className={cn(
                                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all",
                                        ruleTargetType === type
                                            ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200"
                                            : "text-slate-500 hover:text-slate-700"
                                    )}
                                >
                                    <Icon size={14} weight="duotone" />
                                    <span>{label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target Selection */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">
                            {ruleTargetType === 'person' ? 'בחירת חיילים' : ruleTargetType === 'team' ? 'בחירת צוות' : 'בחירת תפקיד'}
                        </label>
                        {ruleTargetType === 'person' ? (
                            <MultiSelect
                                value={ruleTargetIds}
                                onChange={setRuleTargetIds}
                                options={activePeople.map(p => ({ value: p.id, label: p.name }))}
                                placeholder="חפש ובחר חיילים..."
                            />
                        ) : (
                            <Select
                                value={ruleTargetIdSingle}
                                onChange={setRuleTargetIdSingle}
                                options={ruleTargetType === 'team' ? teams.map(t => ({ value: t.id, label: t.name })) : roles.map(r => ({ value: r.id, label: r.name }))}
                                placeholder="בחר מהרשימה..."
                            />
                        )}
                        {ruleTargetType === 'person' && editingRuleId && (
                            <div className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold uppercase tracking-wide px-1">
                                <AlertCircle size={10} weight="duotone" />
                                <span>עריכת יחיד: החלפת החייל תעדכן את החוק הזה בלבד</span>
                            </div>
                        )}
                    </div>

                    {/* Task & Rule Parameters */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">משימות ליישום</label>
                            <MultiSelect
                                value={ruleTaskIds}
                                onChange={setRuleTaskIds}
                                options={tasks.map(t => ({ value: t.id, label: t.name }))}
                                placeholder="בחר משימות..."
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-black text-slate-500 uppercase tracking-wider px-1">סוג החוק</label>
                            <Select
                                value={ruleType}
                                onChange={val => setRuleType(val as any)}
                                options={[
                                    { value: 'never_assign', label: 'לעולם לא לשבץ (חסום)' },
                                    { value: 'always_assign', label: 'שבץ רק למשימה זו (מובל)' },
                                ]}
                                placeholder="בחר סוג חוק..."
                            />
                        </div>
                    </div>

                    {/* Information Box */}
                    <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50 flex gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Briefcase size={20} weight="duotone" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-black text-blue-900 leading-tight mb-0.5">מידע על החוק הנבחר</h4>
                            <p className="text-xs text-blue-700/80 font-bold leading-relaxed">
                                {ruleType === 'never_assign'
                                    ? 'מערכת השיבוץ האוטומטית תדלג על היעדים שנבחרו ותמנע שיבוצם למשימות אלו, גם אם יש חוסר בכוח אדם.'
                                    : 'החיילים שנבחרו ישובצו *אך ורק* למשימה זו אם הם זמינים, ותימנע מהם גישה למשימות אחרות באותו זמן.'
                                }
                            </p>
                        </div>
                    </div>
                </div>
            </GenericModal>

            <ConfirmationModal
                isOpen={!!groupToDelete}
                title="מחיקת חוקים"
                message="האם אתה בטוח שברצונך למחוק את החוקים לקבוצה זו?"
                confirmText="מחק"
                cancelText="ביטול"
                type="danger"
                onConfirm={confirmDelete}
                onCancel={() => setGroupToDelete(null)}
            />
        </div>
    );
};
