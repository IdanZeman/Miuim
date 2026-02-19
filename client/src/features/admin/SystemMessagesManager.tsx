import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { SystemMessage, Team, Role, Poll, Organization } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { CircleNotch as Loader2, Plus, Trash as Trash2, PencilSimple as Edit2, FloppyDisk as Save, X, Megaphone, CheckCircle, XCircle, Users, ChartBar, Buildings, User as UserIcon, MagnifyingGlass } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirmation } from '@/hooks/useConfirmation';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { DashboardSkeleton } from '@/components/ui/DashboardSkeleton';
import { useTacticalDelete } from '@/hooks/useTacticalDelete';
import { TacticalDeleteStyles } from '@/components/ui/TacticalDeleteWrapper';

export const SystemMessagesManager: React.FC = () => {
    const { organization, user } = useAuth();
    const { showToast } = useToast();
    const { confirm, modalProps } = useConfirmation();
    const [messages, setMessages] = useState<SystemMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [teams, setTeams] = useState<Team[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [polls, setPolls] = useState<Poll[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [allPeople, setAllPeople] = useState<any[]>([]);
    const [personSearch, setPersonSearch] = useState('');
    const [orgSearch, setOrgSearch] = useState('');

    // Tactical Delete Hook
    const { handleTacticalDelete, isAnimating } = useTacticalDelete<string>(
        async (id: string) => {
            const { error } = await supabase
                .from('system_messages')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('ההודעה נמחקה בהצלחה', 'success');
            setMessages(prev => prev.filter(m => m.id !== id));
        },
        1300
    );

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [targetTeams, setTargetTeams] = useState<string[]>([]);
    const [targetRoles, setTargetRoles] = useState<string[]>([]);
    const [targetOrgs, setTargetOrgs] = useState<string[]>([]);
    const [targetPeople, setTargetPeople] = useState<string[]>([]);
    const [pollId, setPollId] = useState<string | null>(null);
    const [messageType, setMessageType] = useState<'POPUP' | 'BULLETIN'>('POPUP');

    useEffect(() => {
        if (organization) {
            fetchMessages();
        }
    }, [organization]);

    const fetchMessages = async () => {
        setIsLoading(true);
        try {
            // Check if user is super admin
            const { data: profileData } = await supabase
                .from('profiles')
                .select('is_super_admin')
                .eq('id', user?.id)
                .single();

            const isSuperAdmin = profileData?.is_super_admin || false;

            // Fetch messages - Super admins see all, regular admins see only their org
            let query = supabase.from('system_messages').select('*');

            if (!isSuperAdmin && organization) {
                // Regular admin: filter by organization_id OR messages targeting this org
                query = query.or(`organization_id.eq.${organization.id},organization_id.is.null`);
            }
            // Super admin: no filter, see everything

            const { data: messagesData, error: messagesError } = await query.order('created_at', { ascending: false });

            if (messagesError) throw messagesError;
            setMessages(messagesData || []);

            // Fetch metadata for targeting/polls
            const [teamsRes, rolesRes, pollsRes, orgsRes, peopleRes] = await Promise.all([
                organization ? supabase.from('teams').select('*').eq('organization_id', organization.id) : supabase.from('teams').select('*'),
                organization ? supabase.from('roles').select('*').eq('organization_id', organization.id) : supabase.from('roles').select('*'),
                organization ? supabase.from('polls').select('*').eq('organization_id', organization.id) : supabase.from('polls').select('*'),
                supabase.from('organizations').select('*').order('name'),
                supabase.from('people').select('id, name, organization_id').order('name')
            ]);

            if (teamsRes.data) setTeams(teamsRes.data);
            if (rolesRes.data) setRoles(rolesRes.data);
            if (pollsRes.data) setPolls(pollsRes.data);
            if (orgsRes.data) setOrganizations(orgsRes.data);
            if (peopleRes.data) setAllPeople(peopleRes.data);
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast('שגיאה בטעינת נתונים', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!message.trim()) {
            showToast('חובה להזין תוכן להודעה', 'error');
            return;
        }

        try {
            // For global system messages: organization_id should be null
            // For org-specific: use the current org or first targeted org
            const orgId = targetOrgs.length > 0 ? null : (organization?.id || null);

            const payload = {
                organization_id: orgId,
                title,
                message,
                is_active: isActive,
                message_type: messageType,
                poll_id: pollId,
                target_team_ids: targetTeams.length > 0 ? targetTeams : null,
                target_role_ids: targetRoles.length > 0 ? targetRoles : null,
                target_org_ids: targetOrgs.length > 0 ? targetOrgs : null,
                target_person_ids: targetPeople.length > 0 ? targetPeople : null
            };

            if (editingId) {
                const { error } = await supabase
                    .from('system_messages')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                showToast('ההודעה עודכנה בהצלחה', 'success');
            } else {
                const { error } = await supabase
                    .from('system_messages')
                    .insert(payload);
                if (error) throw error;
                showToast('ההודעה נוצרה בהצלחה', 'success');
            }

            resetForm();
            fetchMessages();
        } catch (error) {
            console.error('Error saving message:', error);
            showToast('שגיאה בשמירת ההודעה', 'error');
        }
    };



    const handleEdit = (msg: SystemMessage) => {
        setEditingId(msg.id);
        setTitle(msg.title || '');
        setMessage(msg.message);
        setIsActive(msg.is_active);
        setMessageType(msg.message_type || 'POPUP');
        setPollId(msg.poll_id || null);
        setTargetTeams(msg.target_team_ids || []);
        setTargetRoles(msg.target_role_ids || []);
        setTargetOrgs((msg as any).target_org_ids || []);
        setTargetPeople((msg as any).target_person_ids || []);
        setIsEditing(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setMessage('');
        setIsActive(true);
        setMessageType('POPUP');
        setPollId(null);
        setTargetTeams([]);
        setTargetRoles([]);
        setTargetOrgs([]);
        setTargetPeople([]);
        setIsEditing(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <Megaphone size={20} weight="bold" className="text-blue-600" />
                    הודעות מערכת (פופאפים)
                </h2>
                <Button
                    onClick={() => setIsEditing(true)}
                    variant="primary"
                    icon={Plus}
                    iconWeight="bold"
                >
                    הודעה חדשה
                </Button>
            </div>

            <Modal
                isOpen={isEditing}
                onClose={resetForm}
                title={editingId ? 'עריכת הודעת מערכת' : 'הודעת מערכת חדשה'}
                size="xl"
                footer={
                    <div className="flex gap-3 justify-end w-full">
                        <Button variant="ghost" onClick={resetForm} className="font-black">ביטול</Button>
                        <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-black px-8 shadow-lg shadow-blue-200">
                            {editingId ? 'עדכן הודעה' : 'צור הודעה'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">כותרת (אופציונלי)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="למשל: עדכון חשוב"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">תוכן ההודעה</label>
                            <textarea
                                value={message}
                                onChange={e => setMessage(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl min-h-[120px] text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="הזן את תוכן ההודעה שתוצג למשתמשים..."
                            />
                        </div>
                    </div>

                    {/* Settings Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">סוג הודעה</label>
                            <select
                                value={messageType}
                                onChange={e => setMessageType(e.target.value as any)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="POPUP">פופאפ (Popup)</option>
                                <option value="BULLETIN">לוח מודעות (Bulletin)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <ChartBar size={14} /> צירוף סקר
                            </label>
                            <select
                                value={pollId || ''}
                                onChange={e => setPollId(e.target.value || null)}
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">ללא סקר</option>
                                {polls.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">סטטוס</label>
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${isActive ? 'bg-green-500' : 'bg-slate-300'}`} onClick={() => setIsActive(!isActive)}>
                                    <div className={`bg-white w-4 h-4 rounded-full transform transition-transform ${isActive ? 'translate-x-[-16px]' : ''}`} />
                                </div>
                                <span className="text-sm font-bold text-slate-700">{isActive ? 'פעיל' : 'לא פעיל'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Targeting Section */}
                    <div className="space-y-4 pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wider">
                            <Users size={18} />
                            הגדרת קהל יעד
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Organizations Searchable Dropdown */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <Buildings size={14} /> פלוגות / ארגונים
                                </label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <MagnifyingGlass size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="חפש פלוגה..."
                                            value={orgSearch}
                                            onChange={e => setOrgSearch(e.target.value)}
                                            className="w-full pr-10 pl-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        />
                                    </div>

                                    {orgSearch.length > 0 && (
                                        <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg p-1 custom-scrollbar">
                                            {organizations
                                                .filter(org => org.name.toLowerCase().includes(orgSearch.toLowerCase()) && !targetOrgs.includes(org.id))
                                                .slice(0, 10)
                                                .map(org => (
                                                    <button
                                                        key={org.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTargetOrgs(prev => [...prev, org.id]);
                                                            setOrgSearch('');
                                                        }}
                                                        className="w-full text-right px-3 py-2 text-xs hover:bg-slate-50 rounded-lg transition-colors font-bold"
                                                    >
                                                        {org.name}
                                                    </button>
                                                ))}
                                            {organizations.filter(org => org.name.toLowerCase().includes(orgSearch.toLowerCase()) && !targetOrgs.includes(org.id)).length === 0 && (
                                                <p className="text-xs text-slate-400 text-center py-2">לא נמצאו תוצאות</p>
                                            )}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {targetOrgs.map(id => {
                                            const org = organizations.find(o => o.id === id);
                                            return (
                                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg">
                                                    {org?.name}
                                                    <X size={12} className="cursor-pointer hover:text-red-200" onClick={() => setTargetOrgs(prev => prev.filter(oid => oid !== id))} />
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* People Search */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <UserIcon size={14} /> אנשים ספציפיים
                                </label>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <MagnifyingGlass size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="חפש שם..."
                                            value={personSearch}
                                            onChange={e => setPersonSearch(e.target.value)}
                                            className="w-full pr-10 pl-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        />
                                    </div>

                                    {personSearch.length > 1 && (
                                        <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-lg p-1 custom-scrollbar">
                                            {allPeople
                                                .filter(p => p.full_name?.toLowerCase().includes(personSearch.toLowerCase()) && !targetPeople.includes(p.id))
                                                .slice(0, 10)
                                                .map(person => (
                                                    <button
                                                        key={person.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setTargetPeople(prev => [...prev, person.id]);
                                                            setPersonSearch('');
                                                        }}
                                                        className="w-full text-right px-3 py-2 text-xs hover:bg-slate-50 rounded-lg transition-colors flex justify-between items-center font-bold"
                                                    >
                                                        <span>{person.full_name}</span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {organizations.find(o => o.id === person.organization_id)?.name}
                                                        </span>
                                                    </button>
                                                ))}
                                        </div>
                                    )}

                                    <div className="flex flex-wrap gap-2">
                                        {targetPeople.map(id => {
                                            const p = allPeople.find(person => person.id === id);
                                            return (
                                                <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg shrink-0">
                                                    {p?.full_name || 'לא ידוע'}
                                                    <X
                                                        size={12}
                                                        className="cursor-pointer hover:text-red-400 ml-1"
                                                        onClick={() => setTargetPeople(prev => prev.filter(pId => pId !== id))}
                                                    />
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                            <p className="text-[10px] text-blue-700 font-bold leading-relaxed">
                                💡 <strong>חוקיות חשיפה:</strong> ההודעה תוצג למשתמש אם הוא עונה על <strong>אחד</strong> מהקריטריונים הבאים:
                                <br />
                                1. מופיע ברשימת "אנשים ספציפיים".
                                <br />
                                2. שייך לאחת ה"פלוגות" שנבחרו <strong>וגם</strong> (אם נבחרו צוותים/תפקידים) שייך לאחד הצוותים/תפקידים.
                                <br />
                                3. אם לא נבחר דבר, ההודעה תוצג לכולם {organization ? `ב-${organization.name}` : 'במערכת'}.
                            </p>
                        </div>
                    </div>
                </div>
            </Modal>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {isLoading ? (
                    <DashboardSkeleton />
                ) : messages.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Megaphone size={48} weight="bold" className="mx-auto mb-3 opacity-20" />
                        <p>לא נמצאו הודעות מערכת.</p>
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-slate-500 text-sm">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">סטטוס</th>
                                        <th className="px-6 py-3 font-medium">סוג</th>
                                        <th className="px-6 py-3 font-medium">כותרת</th>
                                        <th className="px-6 py-3 font-medium">תוכן</th>
                                        <th className="px-6 py-3 font-medium">נוצר בתאריך</th>
                                        <th className="px-6 py-3 font-medium">פעולות</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {messages.map(msg => (
                                        <tr key={msg.id} className={`hover:bg-slate-50 transition-colors ${isAnimating(msg.id) ? 'tactical-scramble' : ''}`}>
                                            <td className="px-6 py-4">
                                                {msg.is_active ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                        <CheckCircle size={12} weight="bold" />
                                                        פעיל
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                        <XCircle size={12} weight="bold" />
                                                        לא פעיל
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${msg.message_type === 'POPUP' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {msg.message_type === 'POPUP' ? 'פופאפ' : 'בולטין'}
                                                    {msg.poll_id && <ChartBar size={12} weight="bold" className="ml-1" />}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-slate-800">
                                                {msg.title || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 max-w-md truncate">
                                                {msg.message}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-sm">
                                                {format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        onClick={() => handleEdit(msg)}
                                                        variant="ghost"
                                                        size="icon"
                                                        icon={Edit2}
                                                        className="text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                                    />
                                                    <Button
                                                        onClick={() => handleTacticalDelete(msg.id)}
                                                        variant="ghost"
                                                        size="icon"
                                                        icon={Trash2}
                                                        className="text-slate-500 hover:text-red-500 hover:bg-red-50"
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile List View */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {messages.map(msg => (
                                <div key={msg.id} className={`p-4 bg-white active:bg-slate-50 transition-all ${isAnimating(msg.id) ? 'tactical-scramble' : ''}`}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            {msg.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                                    <CheckCircle size={12} weight="bold" />
                                                    פעיל
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                                    <XCircle size={12} weight="bold" />
                                                    לא פעיל
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {format(new Date(msg.created_at), 'dd/MM/yyyy')}
                                        </span>
                                    </div>

                                    <div className="mb-3 space-y-1">
                                        {msg.title && <div className="font-bold text-slate-800">{msg.title}</div>}
                                        <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{msg.message}</div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-2 border-t border-slate-50">
                                        <Button
                                            onClick={() => handleEdit(msg)}
                                            variant="secondary"
                                            size="sm"
                                            icon={Edit2}
                                            className="text-blue-600 bg-blue-50 border-blue-100"
                                        >
                                            ערוך
                                        </Button>
                                        <Button
                                            onClick={() => handleTacticalDelete(msg.id)}
                                            variant="secondary"
                                            size="sm"
                                            icon={Trash2}
                                            className="text-red-600 bg-red-50 border-red-100"
                                        >
                                            מחק
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <ConfirmationModal {...modalProps} />
            <TacticalDeleteStyles />
        </div>
    );
};
