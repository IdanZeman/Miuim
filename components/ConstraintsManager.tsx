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
    onAddConstraint: (c: Omit<SchedulingConstraint, 'id'>) => void;
    onDeleteConstraint: (id: string) => void;
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
    const [ruleTaskId, setRuleTaskId] = useState<string>('');
    const [ruleType, setRuleType] = useState<'never_assign' | 'always_assign'>('never_assign');
    const [rulesSearch, setRulesSearch] = useState('');

    // Modal State
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

    // --- Helpers / Derived State ---

    const taskConstraints = useMemo(() => {
        return constraints.filter(c => {
            // Allow global constraints (no taskId) to be shown
            // if (!c.taskId) return false; 

            if (rulesSearch) {
                let taskMatch = false;
                if (c.taskId) {
                    const task = tasks.find(t => t.id === c.taskId);
                    taskMatch = task?.name.toLowerCase().includes(rulesSearch.toLowerCase()) || false;
                } else {
                    // Match "Global" or "General" for legacy/global constraints
                    taskMatch = "כללי".includes(rulesSearch) || "general".includes(rulesSearch.toLowerCase());
                }

                let targetName = '';
                if (c.personId) targetName = people.find(p => p.id === c.personId)?.name || '';
                else if (c.teamId) targetName = teams.find(t => t.id === c.teamId)?.name || '';
                else if (c.roleId) targetName = roles.find(r => r.id === c.roleId)?.name || '';

                const targetMatch = targetName.toLowerCase().includes(rulesSearch.toLowerCase());

                return taskMatch || targetMatch;
            }
            return true;
        });
    }, [constraints, tasks, people, teams, roles, rulesSearch]);

    const getTargetName = (c: SchedulingConstraint) => {
        if (c.personId) {
            const p = people.find(x => x.id === c.personId);
            return { name: p?.name || 'Unknown', icon: User, type: 'person' };
        }
        if (c.teamId) {
            const t = teams.find(x => x.id === c.teamId);
            return { name: t?.name || 'Unknown', icon: Users, type: 'team' };
        }
        if (c.roleId) {
            const r = roles.find(x => x.id === c.roleId);
            return { name: r?.name || 'Unknown', icon: Shield, type: 'role' };
        }
        return { name: 'Unknown', icon: User, type: 'unknown' };
    };

    // --- Handlers ---

    const openRuleModal = (constraint?: SchedulingConstraint) => {
        if (isViewer) return;

        if (constraint) {
            // Edit Mode
            setEditingRuleId(constraint.id);
            setRuleTaskId(constraint.taskId || '');
            setRuleType(constraint.type as any);

            if (constraint.personId) {
                setRuleTargetType('person');
                setRuleTargetIds([constraint.personId]);
            } else if (constraint.teamId) {
                setRuleTargetType('team');
                setRuleTargetIdSingle(constraint.teamId);
            } else if (constraint.roleId) {
                setRuleTargetType('role');
                setRuleTargetIdSingle(constraint.roleId);
            }
        } else {
            // Add Mode - Reset
            setEditingRuleId(null);
            setRuleTargetIds([]);
            setRuleTargetIdSingle('');
            setRuleTaskId('');
            setRuleType('never_assign');
            // Default target type to person if not set
            if (!ruleTargetType) setRuleTargetType('person');
        }
        setIsRuleModalOpen(true);
    };

    const handleSaveRule = () => {
        if (isViewer) return;
        if (!ruleTaskId) {
            showToast('נא לבחור משימה', 'error');
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

        // Handle Edit Mode (Delete old first)
        if (editingRuleId) {
            onDeleteConstraint(editingRuleId);
        }

        let addedCount = 0;

        // Loop through targets and add them
        targets.forEach(target => {
            const newConstraint: Omit<SchedulingConstraint, 'id'> = {
                organization_id: organizationId,
                taskId: ruleTaskId,
                type: ruleType,
                description: 'Task Rule'
            };

            if (target.type === 'person') newConstraint.personId = target.id;
            else if (target.type === 'team') newConstraint.teamId = target.id;
            else if (target.type === 'role') newConstraint.roleId = target.id;

            // Check Duplicate
            const exists = constraints.find(c =>
                (c.id !== editingRuleId) &&
                c.taskId === ruleTaskId &&
                c.type === ruleType &&
                (
                    (target.type === 'person' && c.personId === target.id) ||
                    (target.type === 'team' && c.teamId === target.id) ||
                    (target.type === 'role' && c.roleId === target.id)
                )
            );

            if (!exists) {
                onAddConstraint(newConstraint);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            showToast(editingRuleId ? 'החוק עודכן בהצלחה' : `${addedCount} חוקים נוספו בהצלחה`, 'success');
            setIsRuleModalOpen(false);
            setRuleTargetIds([]);
            setRuleTargetIdSingle('');
        } else {
            showToast('החוק כבר קיים במערכת', 'info');
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
                        <h4 className="font-bold text-slate-700">רשימת חוקים פעילים ({taskConstraints.length})</h4>
                        <div className="w-full md:w-64"><Input placeholder="חיפוש חוקים..." value={rulesSearch} onChange={(e) => setRulesSearch(e.target.value)} icon={Search} /></div>
                    </div>
                    <div className="space-y-3">
                        {taskConstraints.map(c => {
                            const { name, icon: Icon, type } = getTargetName(c);
                            const task = tasks.find(t => t.id === c.taskId);
                            return (
                                <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-start md:items-center gap-4 group">
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
                                            <button onClick={() => openRuleModal(c)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg"><Edit2 size={18} /></button>
                                            <button onClick={() => onDeleteConstraint(c.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><Trash2 size={18} /></button>
                                        </div>
                                    </div>

                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 w-full">
                                        <div className="hidden md:block">
                                            <div className="text-xs font-bold text-slate-400 uppercase">{type === 'person' ? 'חייל' : type === 'team' ? 'צוות' : 'תפקיד'}</div>
                                            <div className="font-bold text-slate-800 text-lg truncate">{name}</div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className={`h-1 w-8 rounded-full hidden md:block ${c.type === 'never_assign' ? 'bg-red-200' : 'bg-green-200'}`} />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-slate-400 uppercase">משימה</div>
                                                <div className="font-bold text-slate-700 truncate">{task?.name || '---'}</div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between md:justify-start">
                                            <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 w-fit ${c.type === 'never_assign' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                {c.type === 'never_assign' ? <Ban size={14} /> : <Pin size={14} />}
                                                {c.type === 'never_assign' ? 'לא לשבץ לעולם' : 'שבץ רק למשימה זו'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Desktop Actions */}
                                    <div className="hidden md:flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openRuleModal(c)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={20} /></button>
                                        <button onClick={() => onDeleteConstraint(c.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={20} /></button>
                                    </div>
                                </div>
                            );
                        })}
                        {taskConstraints.length === 0 && <div className="text-center py-12 text-slate-400"><Shield size={48} className="mx-auto mb-4 opacity-20" /><p>לא נמצאו חוקים פעילים</p></div>}
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
                                <label className="text-sm font-bold text-slate-700 mb-2 block">המשימה</label>
                                <Select value={ruleTaskId} onChange={setRuleTaskId} options={tasks.map(t => ({ value: t.id, label: t.name }))} placeholder="בחר משימה" />
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
