import React, { useState, useMemo } from 'react';
import { Person, Team, SchedulingConstraint, TaskTemplate, Role } from '../types';
import { useToast } from '../contexts/ToastContext';
import { Search, Filter, ShieldAlert, Briefcase, User, Users, Shield, Ban, Pin, Trash2, Plus, Edit2, AlertCircle } from 'lucide-react';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { MultiSelect } from './ui/MultiSelect';
import { Modal } from './ui/Modal';

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

        constraints.forEach(c => {
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

    const handleDeleteGroup = (group: typeof taskConstraintsGrouped[0]) => {
        if (isViewer) return;
        if (confirm('האם למחוק את חוקי המשימות לקבוצה זו?')) {
            group.ids.forEach(id => onDeleteConstraint(id, true)); // Silent
            showToast('החוקים נמחקו בהצלחה', 'success');
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
        <div className="flex flex-col h-[calc(100vh-100px)] gap-4">
            {/* Top Control Bar */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between shrink-0">
                <h2 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2">
                    <ShieldAlert className="text-blue-600" size={24} />
                    <span className="hidden md:inline">ניהול אילוצים</span>
                    <span className="md:hidden">אילוצים</span>
                </h2>
                <div className="text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1 rounded-md">
                    אילוצי משימות בלבד
                </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-slate-800">הגדרת חוקי משימות</h3>
                    <button
                        onClick={() => openRuleModal()}
                        className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-sm transition-colors text-sm"
                    >
                        <Plus size={18} />
                        <span className="hidden md:inline">הוסף חוק חדש</span>
                        <span className="md:hidden">חדש</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-3">
                        <h4 className="font-bold text-slate-700">רשימת חוקים פעילים ({taskConstraintsGrouped.length})</h4>
                        <div className="w-full md:w-64"><Input placeholder="חיפוש חוקים..." value={rulesSearch} onChange={(e) => setRulesSearch(e.target.value)} icon={Search} /></div>
                    </div>
                    <div className="space-y-3">
                        {taskConstraintsGrouped.map(group => {
                            const { name, icon: Icon, type } = getTargetNameFromGroup(group);
                            const taskNames = group.taskIds
                                .map(tid => tasks.find(t => t.id === tid)?.name)
                                .filter(Boolean)
                                .join(', ');

                            return (
                                <div key={group.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center gap-4 group">
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${type === 'person' ? 'bg-blue-100 text-blue-600' : type === 'team' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="md:hidden flex-1">
                                            <div className="text-xs font-bold text-slate-400 uppercase">{type === 'person' ? 'חייל' : type === 'team' ? 'צוות' : 'תפקיד'}</div>
                                            <div className="font-bold text-slate-800 text-lg">{name}</div>
                                        </div>
                                        {/* Mobile Actions */}
                                        <div className="flex md:hidden gap-2">
                                            <button onClick={() => openRuleModal(group)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Edit2 size={18} /></button>
                                            <button onClick={() => handleDeleteGroup(group)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={18} /></button>
                                        </div>
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                                        <div className="hidden md:block">
                                            <div className="text-xs font-bold text-slate-400 uppercase">{type === 'person' ? 'חייל' : type === 'team' ? 'צוות' : 'תפקיד'}</div>
                                            <div className="font-bold text-slate-800 text-lg truncate">{name}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className={`h-1 w-8 rounded-full hidden md:block ${group.type === 'never_assign' ? 'bg-red-200' : 'bg-green-200'}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-400 uppercase">משימות ({group.taskIds.length})</div>
                                                <div className="font-bold text-slate-700 truncate" title={taskNames}>{taskNames || '---'}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-start">
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 w-fit ${group.type === 'never_assign' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {group.type === 'never_assign' ? <Ban size={14} /> : <Pin size={14} />}
                                                {group.type === 'never_assign' ? 'לא לשבץ לעולם' : 'שבץ רק למשימה זו'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desktop Actions */}
                                    <div className="hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openRuleModal(group)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={20} /></button>
                                        <button onClick={() => handleDeleteGroup(group)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={20} /></button>
                                    </div>
                                </div>
                            );
                        })}
                        {taskConstraintsGrouped.length === 0 && <div className="text-center py-12 text-slate-400"><Shield size={48} className="mx-auto mb-4 opacity-20" /><p>לא נמצאו חוקים פעילים</p></div>}
                    </div>
                </div>

                {/* Task Rule Modal */}
                <Modal
                    isOpen={isRuleModalOpen}
                    onClose={() => setIsRuleModalOpen(false)}
                    title={editingRuleId ? "עריכת חוק משימה" : "הוספת חוק משימה חדש"}
                    size="lg"
                    footer={
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setIsRuleModalOpen(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">ביטול</button>
                            <button onClick={handleSaveRule} className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-md">
                                {editingRuleId ? 'שמור שינויים' : 'הוסף חוק'}
                            </button>
                        </div>
                    }
                >
                    <div className="space-y-6 py-2">
                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-2 block">סוג היעד (על מי חל החוק?)</label>
                            <div className="flex bg-slate-100 p-1 rounded-lg gap-2">
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
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-bold transition-all ${ruleTargetType === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Icon size={16} />{label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-slate-700 mb-2 block">
                                {ruleTargetType === 'person' ? 'בחר חיילים' : ruleTargetType === 'team' ? 'בחר צוות' : 'בחר תפקיד'}
                            </label>
                            {ruleTargetType === 'person' ? (
                                <MultiSelect
                                    value={ruleTargetIds}
                                    onChange={setRuleTargetIds}
                                    options={people.map(p => ({ value: p.id, label: p.name }))}
                                    placeholder="בחר חיילים..."
                                />
                            ) : (
                                <Select
                                    value={ruleTargetIdSingle}
                                    onChange={setRuleTargetIdSingle}
                                    options={ruleTargetType === 'team' ? teams.map(t => ({ value: t.id, label: t.name })) : roles.map(r => ({ value: r.id, label: r.name }))}
                                    placeholder="-- בחר --"
                                />
                            )}
                            {ruleTargetType === 'person' && editingRuleId && <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1"><AlertCircle size={12} /> עריכת יחיד (החלפת החייל תעדכן את החוק הזה בלבד)</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-2 block">משימות (ניתן לבחור מספר משימות)</label>
                                <MultiSelect
                                    value={ruleTaskIds} // Correct state variable
                                    onChange={setRuleTaskIds}
                                    options={tasks.map(t => ({ value: t.id, label: t.name }))}
                                    placeholder="בחר משימות..."
                                />
                            </div>

                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-2 block">סוג החוק</label>
                                <Select
                                    value={ruleType}
                                    onChange={val => setRuleType(val as any)}
                                    options={[
                                        { value: 'never_assign', label: 'לעולם לא לשבץ' },
                                        { value: 'always_assign', label: 'שבץ רק למשימה זו' },
                                    ]}
                                    placeholder="סוג"
                                />
                            </div>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-xl flex gap-3 text-blue-800 text-sm">
                            <div className="shrink-0 mt-0.5"><Briefcase size={16} /></div>
                            <p>
                                {ruleType === 'never_assign'
                                    ? 'מערכת השיבוץ האוטומטית לא תשבץ את היעדים שנבחרו למשימה זו בשום מצב.'
                                    : 'כאשר היעדים שנבחרו ישובצו במשמרת, הם ישובצו *אך ורק* למשימה זו (אם היא נדרשת).'
                                }
                            </p>
                        </div>
                    </div>
                </Modal>
            </div>
        </div>
    );
};
