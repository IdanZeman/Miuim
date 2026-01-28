import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabaseClient';
import { Profile, Person, UserPermissions, Team, PermissionTemplate } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Users, MagnifyingGlass, PencilSimple, Link as LinkIcon, LinkBreak, Trash, DotsThreeVertical } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PermissionEditor } from './PermissionEditor';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { DropdownMenu } from '../../components/ui/DropdownMenu';
import { useQueryClient } from '@tanstack/react-query';
import { SettingsSkeleton } from '../../components/ui/SettingsSkeleton';

interface OrganizationUserManagementProps {
    teams: Team[];
}

export const OrganizationUserManagement: React.FC<OrganizationUserManagementProps> = ({ teams }) => {
    const { profile: myProfile, organization } = useAuth();
    const { showToast } = useToast();
    const queryClient = useQueryClient();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [people, setPeople] = useState<Person[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<Profile | null>(null);
    const [linkingUser, setLinkingUser] = useState<Profile | null>(null);
    const [userToRemove, setUserToRemove] = useState<Profile | null>(null);
    const [templates, setTemplates] = useState<PermissionTemplate[]>([]);

    useEffect(() => {
        if (organization?.id) {
            fetchData();
        }
    }, [organization?.id]);

    const fetchData = async () => {
        if (!organization?.id) return;

        setLoading(true);
        try {
            const [profilesRes, peopleRes, templatesRes] = await Promise.all([
                supabase.from('profiles').select('*').eq('organization_id', organization.id).order('full_name'),
                supabase.from('people').select('*').eq('organization_id', organization.id),
                supabase.from('permission_templates').select('*').eq('organization_id', organization.id)
            ]);

            if (profilesRes.error) throw profilesRes.error;
            setProfiles(profilesRes.data || []);
            setPeople((peopleRes.data || []).map(p => ({
                ...p,
                userId: p.user_id // Map database field to interface field
            })));
            setTemplates(templatesRes.data || []);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            showToast('שגיאה בטעינת נתונים', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePermissions = async (userId: string, permissions: UserPermissions, templateId?: string | null) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    permissions,
                    permission_template_id: templateId || null
                })
                .eq('id', userId);

            if (error) throw error;

            showToast('הרשאות עודכנו בהצלחה', 'success');
            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, permissions, permission_template_id: templateId || undefined } : p));
        } catch (error: any) {
            console.error('Error saving permissions:', error);
            showToast('שגיאה בשמירת הרשאות', 'error');
        }
    };

    const handleRemoveUserFromOrg = async (userId: string) => {
        try {
            setLoading(true);

            // 1. Unlink any person linked to this user
            const { error: unlinkError } = await supabase
                .from('people')
                .update({ user_id: null })
                .eq('user_id', userId);

            if (unlinkError) throw unlinkError;

            // 2. Remove user from organization (set organization_id to null)
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ organization_id: null })
                .eq('id', userId);

            if (profileError) throw profileError;

            showToast('המשתמש הוסר מהארגון בהצלחה', 'success');

            // Update local state
            setProfiles(prev => prev.filter(p => p.id !== userId));
            setPeople(prev => prev.map(p => p.userId === userId ? { ...p, userId: undefined } : p));

            // Invalidate global cache
            queryClient.invalidateQueries({ queryKey: ['organizationData'] });

        } catch (error: any) {
            console.error('Error removing user:', error);
            showToast('שגיאה בהסרת המשתמש', 'error');
        } finally {
            setLoading(false);
            setUserToRemove(null);
        }
    };

    const handleLinkToPerson = async (profileId: string, personId: string | null) => {
        try {
            if (personId) {
                // Check if this person is already linked to another profile
                const existingLink = people.find(p => p.id === personId && p.userId && p.userId !== profileId);
                if (existingLink) {
                    showToast('אדם זה כבר מקושר למשתמש אחר', 'error');
                    return;
                }

                // Link person to profile
                const { error } = await supabase
                    .from('people')
                    .update({ user_id: profileId })
                    .eq('id', personId);

                if (error) throw error;
                showToast('הקישור בוצע בהצלחה', 'success');

                // Update local state immediately
                setPeople(prev => prev.map(p =>
                    p.id === personId ? { ...p, userId: profileId } : p
                ));

                // Invalidate global cache
                queryClient.invalidateQueries({ queryKey: ['organizationData'] });

                // If linking self, reload to update App state
                if (profileId === myProfile?.id) {
                    window.location.reload();
                }

            } else {
                // Unlink - find the person linked to this profile and remove the link
                const personToUnlink = people.find(p => p.userId === profileId);

                const targetId = personToUnlink?.id;

                let query = supabase.from('people').update({ user_id: null });

                if (targetId) {
                    query = query.eq('id', targetId);
                } else {
                    query = query.eq('user_id', profileId);
                }

                const { error } = await query;

                if (error) throw error;

                // Also reset the profile name to remove stale 'Abraham' data
                const userProfile = profiles.find(p => p.id === profileId);
                const defaultName = userProfile?.email?.split('@')[0] || 'משתמש';

                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({ full_name: defaultName })
                    .eq('id', profileId);

                if (profileError) {
                    console.error('Error resetting profile name:', profileError);
                } else {
                    // Update local profiles state
                    setProfiles(prev => prev.map(p =>
                        p.id === profileId ? { ...p, full_name: defaultName } : p
                    ));
                }

                showToast('הקישור הוסר בהצלחה והפרופיל אופס', 'success');

                // Update local state immediately
                setPeople(prev => prev.map(p =>
                    p.userId === profileId ? { ...p, userId: undefined } : p
                ));

                // Invalidate global cache to force App.tsx to see the unlink
                queryClient.invalidateQueries({ queryKey: ['organizationData'] });

                // If unlinking self, reload to force "Claim Profile" screen
                if (profileId === myProfile?.id) {
                    window.location.reload();
                }
            }


            setLinkingUser(null);
        } catch (error: any) {
            console.error('Error linking user:', error);
            showToast('שגיאה בעדכון קישור', 'error');
        }
    };

    // Performance Optimization: Create a map for faster person lookup
    const peopleMap = useMemo(() => {
        const map = new Map<string, Person>();
        people.forEach(p => {
            if (p.userId) map.set(p.userId, p);
        });
        return map;
    }, [people]);

    const getLinkedPerson = (profileId: string) => {
        return peopleMap.get(profileId);
    };

    const filteredProfiles = useMemo(() => {
        return profiles
            .filter(p => {
                // Hide Super Admins from non-Super Admins
                if (p.is_super_admin && !myProfile?.is_super_admin) {
                    return false;
                }
                return true;
            })
            .filter(p => {
                const search = searchTerm.toLowerCase();
                const fullName = (p.full_name || '').toLowerCase();
                const email = (p.email || '').toLowerCase();
                return fullName.includes(search) || email.includes(search);
            });
    }, [profiles, searchTerm, myProfile?.is_super_admin]);

    if (loading) {
        return <SettingsSkeleton />;
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-4 mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Users size={24} className="text-purple-500" weight="bold" />
                            משתמשי הארגון
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-slate-500">
                                ניהול משתמשים, הרשאות וקישור לאנשי הצוות
                            </p>
                        </div>
                    </div>

                    <div className="relative w-full">
                        <MagnifyingGlass className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="חפש לפי שם או אימייל..."
                            className="!bg-slate-50 border-slate-200 rounded-xl pr-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-right">
                        <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-wider">
                                <th className="px-4 py-3 border-b border-slate-100">משתמש</th>
                                <th className="px-4 py-3 border-b border-slate-100">מקושר לאדם</th>
                                <th className="px-4 py-3 border-b border-slate-100">הרשאות</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-left">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredProfiles.map(user => {
                                const linkedPerson = getLinkedPerson(user.id);
                                return (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-purple-600 font-bold border border-white shadow-sm shrink-0">
                                                    {user.email.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="font-bold text-slate-800 truncate flex items-center gap-2">
                                                        {user.full_name || 'ללא שם'}
                                                        {user.id === myProfile?.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">אתה</span>}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            {linkedPerson ? (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                                                        <LinkIcon size={14} weight="bold" />
                                                        <span className="font-bold">{linkedPerson.name}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-sm flex items-center gap-1.5">
                                                    <LinkBreak size={14} />
                                                    לא מקושר
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex flex-wrap gap-1">
                                                {user.is_super_admin && (
                                                    <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 border border-amber-200">
                                                        מנהל על
                                                    </span>
                                                )}
                                                {user.permission_template_id ? (
                                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-indigo-200">
                                                        {templates.find(t => t.id === user.permission_template_id)?.name || 'תבנית'}
                                                    </span>
                                                ) : (
                                                    <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-slate-200">
                                                        מותאם אישית
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <DropdownMenu
                                                    trigger={
                                                        <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                                                            <DotsThreeVertical size={20} weight="bold" />
                                                        </Button>
                                                    }
                                                    items={[
                                                        {
                                                            id: 'link',
                                                            label: 'נהל קישור',
                                                            icon: <LinkIcon size={18} weight="bold" />,
                                                            onClick: () => setLinkingUser(user)
                                                        },
                                                        ...(user.id !== myProfile?.id ? [
                                                            {
                                                                id: 'edit',
                                                                label: 'ערוך הרשאות',
                                                                icon: <PencilSimple size={18} weight="bold" />,
                                                                onClick: () => setEditingUser(user)
                                                            },
                                                            {
                                                                id: 'remove',
                                                                label: 'הסר מהארגון',
                                                                icon: <Trash size={18} weight="bold" />,
                                                                onClick: () => setUserToRemove(user),
                                                                variant: 'danger' as const
                                                            }
                                                        ] : [])
                                                    ]}
                                                    align="left"
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {filteredProfiles.map(user => {
                        const linkedPerson = getLinkedPerson(user.id);
                        return (
                            <div key={user.id} className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-purple-600 font-bold border-2 border-white shadow-sm shrink-0">
                                        {user.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 truncate flex items-center gap-2">
                                            {user.full_name || 'ללא שם'}
                                            {user.id === myProfile?.id && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">אתה</span>}
                                        </div>
                                        <div className="text-xs text-slate-400 truncate">{user.email}</div>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm pt-2 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 font-medium text-xs">קישור:</span>
                                        {linkedPerson ? (
                                            <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2 py-1 rounded-lg border border-green-100">
                                                <LinkIcon size={12} weight="bold" />
                                                <span className="font-bold text-[11px]">{linkedPerson.name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-[11px] flex items-center gap-1">
                                                <LinkBreak size={12} />
                                                לא מקושר
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-500 font-medium text-xs">הרשאות:</span>
                                        <div className="flex flex-wrap gap-1 justify-end">
                                            {user.is_super_admin && (
                                                <span className="bg-amber-100 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-200">
                                                    מנהל על
                                                </span>
                                            )}
                                            {user.permission_template_id ? (
                                                <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-indigo-200">
                                                    {templates.find(t => t.id === user.permission_template_id)?.name || 'תבנית'}
                                                </span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
                                                    מותאם
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-wider">ניהול משתמש</div>
                                    <div className="flex gap-2">
                                        <DropdownMenu
                                            trigger={
                                                <Button variant="secondary" size="sm" className="h-9 w-9 !p-0 rounded-xl" icon={DotsThreeVertical} />
                                            }
                                            items={[
                                                {
                                                    id: 'link',
                                                    label: 'נהל קישור',
                                                    icon: <LinkIcon size={18} weight="bold" />,
                                                    onClick: () => setLinkingUser(user)
                                                },
                                                ...(user.id !== myProfile?.id ? [
                                                    {
                                                        id: 'edit',
                                                        label: 'ערוך הרשאות',
                                                        icon: <PencilSimple size={18} weight="bold" />,
                                                        onClick: () => setEditingUser(user)
                                                    },
                                                    {
                                                        id: 'remove',
                                                        label: 'הסר מהארגון',
                                                        icon: <Trash size={18} weight="bold" />,
                                                        onClick: () => setUserToRemove(user),
                                                        variant: 'danger' as const
                                                    }
                                                ] : [])
                                            ]}
                                            align="left"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {filteredProfiles.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        לא נמצאו משתמשים התואמים לחיפוש שלך.
                    </div>
                )}
            </div>

            {/* Link Person Modal */}
            {linkingUser && (
                <LinkPersonModal
                    user={linkingUser}
                    people={people}
                    currentLinkedPerson={getLinkedPerson(linkingUser.id)}
                    onClose={() => setLinkingUser(null)}
                    onSave={handleLinkToPerson}
                />
            )}

            {/* Permission Editor Modal */}
            {editingUser && (
                <PermissionEditor
                    isOpen={true}
                    onClose={() => setEditingUser(null)}
                    user={editingUser}
                    onSave={handleSavePermissions}
                    teams={teams}
                    templates={templates}
                />
            )}

            {/* Remove User Confirmation Modal */}
            {userToRemove && (
                <Modal
                    isOpen={true}
                    onClose={() => setUserToRemove(null)}
                    title={
                        <div className="flex items-center gap-3 text-red-600">
                            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                <Trash size={24} weight="bold" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black">הסרת משתמש מהארגון</h2>
                                <p className="text-sm font-medium text-slate-500">
                                    פעולה זו תנתק את המשתמש מהארגון
                                </p>
                            </div>
                        </div>
                    }
                    footer={
                        <div className="flex justify-end gap-3 w-full">
                            <Button variant="ghost" onClick={() => setUserToRemove(null)} className="font-bold">
                                ביטול
                            </Button>
                            <Button
                                variant="primary"
                                onClick={() => handleRemoveUserFromOrg(userToRemove.id)}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-red-200"
                                icon={Trash}
                            >
                                אשר ומחק
                            </Button>
                        </div>
                    }
                >
                    <div className="space-y-4">
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-800 text-sm">
                            האם אתה בטוח שברצונך להסיר את המשתמש <strong>{userToRemove.full_name}</strong> ({userToRemove.email}) מהארגון?
                            <br /><br />
                            משתמש זה לא יוכל לגשת יותר לנתוני הארגון, וכל הקישורים שלו לאנשי צוות יבוטלו.
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const LinkPersonModal: React.FC<{
    user: Profile;
    people: Person[];
    currentLinkedPerson?: Person;
    onClose: () => void;
    onSave: (profileId: string, personId: string | null) => void;
}> = ({ user, people, currentLinkedPerson, onClose, onSave }) => {
    const [selectedPersonId, setSelectedPersonId] = useState<string>(currentLinkedPerson?.id || '');

    const availablePeople = people.filter(p => !p.userId || p.userId === user.id);

    const personOptions = availablePeople.map(person => ({
        value: person.id,
        label: `${person.name}${person.userId === user.id ? ' (מקושר כעת)' : ''}`
    }));

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                        <LinkIcon size={24} weight="bold" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-800">קישור משתמש לאדם</h2>
                        <p className="text-sm font-bold text-slate-400">
                            עבור: <span className="text-slate-600">{user.full_name || user.email}</span>
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-end gap-3 w-full">
                    <Button variant="ghost" onClick={onClose} className="font-bold">
                        ביטול
                    </Button>
                    {currentLinkedPerson && (
                        <Button
                            variant="secondary"
                            onClick={() => {
                                onSave(user.id, null);
                            }}
                            icon={LinkBreak}
                            className="font-bold"
                        >
                            הסר קישור
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        onClick={() => onSave(user.id, selectedPersonId)}
                        disabled={!selectedPersonId || selectedPersonId === currentLinkedPerson?.id}
                        icon={LinkIcon}
                        className="font-bold shadow-none"
                    >
                        שמור קישור
                    </Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-sm text-blue-800 font-medium">
                        קישור משתמש לאדם מאפשר למשתמש לראות את המשמרות והנתונים של האדם המקושר.
                        כל משתמש יכול להיות מקושר רק לאדם אחד.
                    </p>
                </div>

                <Select
                    label="בחר אדם לקישור"
                    value={selectedPersonId}
                    onChange={setSelectedPersonId}
                    options={personOptions}
                    placeholder="-- בחר אדם --"
                    searchable={true}
                    className="!bg-slate-50"
                />

                {availablePeople.length === 0 && (
                    <div className="text-center py-4 text-slate-400 text-sm">
                        כל האנשים כבר מקושרים למשתמשים אחרים
                    </div>
                )}
            </div>
        </Modal>
    );
};
