import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/adminService';
import { Profile, Team, PermissionTemplate, UserPermissions, Organization } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Users, MagnifyingGlass, PencilSimple, ShieldCheck, Shield, CircleNotch, Buildings as Building } from '@phosphor-icons/react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { UserEditModal } from './UserEditModal';
import { SettingsSkeleton } from '../../components/ui/SettingsSkeleton';

export const GlobalUserManagement: React.FC = () => {
    const { profile: myProfile } = useAuth();
    const { showToast } = useToast();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingUser, setEditingUser] = useState<Profile | null>(null);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [orgMap, setOrgMap] = useState<Record<string, string>>({});

    // For PermissionEditor
    const [allTeams, setAllTeams] = useState<Team[]>([]);
    const [allTemplates, setAllTemplates] = useState<PermissionTemplate[]>([]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [profiles, orgs, teams, templates] = await Promise.all([
                adminService.fetchAllProfiles(),
                adminService.fetchAllOrganizations(),
                adminService.fetchAllTeams(),
                adminService.fetchAllPermissionTemplates()
            ]);

            setProfiles(profiles || []);
            setOrganizations(orgs || []);

            const map: Record<string, string> = {};
            orgs.forEach(org => map[org.id] = org.name);
            setOrgMap(map);

            setAllTeams(teams || []);
            setAllTemplates(templates || []);
        } catch (error: any) {
            console.error('Error fetching data:', error);
            showToast('שגיאה בטעינת נתונים', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (userId: string, updates: Partial<Profile>, linkedPersonId: string | null) => {

        try {
            // 1. Update Profile (Name, Org, Permissions)
            const updatedProfile = await adminService.updateProfile(userId, updates);


            // 2. Handle Linking
            await adminService.updateUserLink(userId, linkedPersonId);


            showToast('המשתמש עודכן בהצלחה', 'success');


            // Update local state
            setProfiles(prev => {
                const updated = prev.map(p => p.id === userId ? { ...p, ...updatedProfile } : p);

                return updated;
            });
            setEditingUser(null);
        } catch (error: any) {
            console.error('💥 [GlobalUserManagement] handleSaveUser FAILED:', error);
            showToast('שגיאה בעדכון המשתמש', 'error');
        }
    };

    const filteredProfiles = profiles.filter(p =>
        (p.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (orgMap[p.organization_id || '']?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Reset to page 1 when searching
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // Scroll to top when page changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const totalPages = Math.ceil(filteredProfiles.length / itemsPerPage);
    const paginatedProfiles = filteredProfiles.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    if (loading) {
        return <SettingsSkeleton />;
    }
    // Render logic remains similar but uses UserEditModal
    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-4 mb-6">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Users size={24} className="text-purple-500" weight="bold" />
                            ניהול משתמשים והרשאות (גלובלי)
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            צפייה בכל המשתמשים במערכת וניהול רמות הגישה שלהם.
                        </p>
                    </div>

                    <div className="relative w-full">
                        <MagnifyingGlass className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <Input
                            placeholder="חפש לפי שם, אימייל או פלוגה..."
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
                                <th className="px-4 py-3 border-b border-slate-100">פלוגה</th>
                                <th className="px-4 py-3 border-b border-slate-100">הרשאות</th>
                                <th className="px-4 py-3 border-b border-slate-100">סטטוס</th>
                                <th className="px-4 py-3 border-b border-slate-100 text-left">פעולות</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedProfiles.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center text-purple-600 font-bold border border-white shadow-sm shrink-0">
                                                {user.email.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-slate-800 truncate">
                                                    {user.full_name || 'ללא שם'}
                                                    {user.id === myProfile?.id && <span className="mr-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded uppercase tracking-tighter">אתה</span>}
                                                </div>
                                                <div className="text-[11px] text-slate-400 truncate">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                            <Building size={14} className="text-slate-400" />
                                            {user.organization_id ? orgMap[user.organization_id] || 'פלוגה לא ידועה' : 'ללא שיוך'}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex flex-wrap gap-1">
                                            {user.is_super_admin && (
                                                <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 border border-amber-200">
                                                    <ShieldCheck size={12} weight="fill" />
                                                    מנהל על
                                                </span>
                                            )}
                                            {user.permission_template_id ? (
                                                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-indigo-200">
                                                    תבנית: {allTemplates.find(t => t.id === user.permission_template_id)?.name || 'לא נמצאה'}
                                                </span>
                                            ) : (
                                                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border border-slate-200">
                                                    מותאם אישית
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${user.organization_id ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {user.organization_id ? 'פעיל בארגון' : 'ממתין לשיוך'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {user.id !== myProfile?.id && (
                                                <Button
                                                    onClick={() => setEditingUser(user)}
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                                                    title="ערוך משתמש"
                                                >
                                                    <PencilSimple size={18} weight="bold" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {paginatedProfiles.map(user => (
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

                            <div className="space-y-2 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">פלוגה:</span>
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                        <Building size={12} className="text-slate-400" />
                                        <span className="text-xs font-medium">{user.organization_id ? orgMap[user.organization_id] || 'לא ידועה' : 'ללא שיוך'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">הרשאות:</span>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                        {user.is_super_admin && (
                                            <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-200">
                                                מנהל על
                                            </span>
                                        )}
                                        {user.permission_template_id ? (
                                            <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                                                {allTemplates.find(t => t.id === user.permission_template_id)?.name || 'תבנית'}
                                            </span>
                                        ) : (
                                            <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
                                                מותאם
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-slate-500 font-medium">סטטוס:</span>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${user.organization_id ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {user.organization_id ? 'פעיל' : 'ממתין'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-2 border-t border-slate-200">
                                {user.id !== myProfile?.id && (
                                    <Button
                                        onClick={() => setEditingUser(user)}
                                        variant="primary"
                                        className="w-full h-10 text-sm font-bold"
                                        icon={PencilSimple}
                                    >
                                        ערוך משתמש
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {filteredProfiles.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        לא נמצאו משתמשים התואמים לחיפוש שלך.
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-100">
                        <div className="text-sm text-slate-500 font-medium">
                            מציג <span className="text-slate-900 font-bold">{Math.min(filteredProfiles.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredProfiles.length, currentPage * itemsPerPage)}</span> מתוך <span className="text-slate-900 font-bold">{filteredProfiles.length}</span> משתמשים
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="font-bold text-xs"
                            >
                                הקודם
                            </Button>
                            <div className="flex items-center gap-1">
                                {[...Array(totalPages)].map((_, i) => {
                                    const page = i + 1;
                                    // Show first, last, and pages around current
                                    if (
                                        page === 1 ||
                                        page === totalPages ||
                                        (page >= currentPage - 1 && page <= currentPage + 1)
                                    ) {
                                        return (
                                            <button
                                                key={page}
                                                onClick={() => setCurrentPage(page)}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page
                                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-200'
                                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                                    }`}
                                            >
                                                {page}
                                            </button>
                                        );
                                    } else if (
                                        page === currentPage - 2 ||
                                        page === currentPage + 2
                                    ) {
                                        return <span key={page} className="text-slate-300 px-1">...</span>;
                                    }
                                    return null;
                                })}
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="font-bold text-xs"
                            >
                                הבא
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {editingUser && (
                <UserEditModal
                    isOpen={true}
                    onClose={() => setEditingUser(null)}
                    user={editingUser}
                    organizations={organizations}
                    onSave={handleSaveUser}
                />
            )}
        </div>
    );
};

