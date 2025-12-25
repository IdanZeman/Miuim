import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from './AuthContext';
import { Building2, Mail, CheckCircle, Sparkles, Shield, FileSpreadsheet, Upload, ArrowLeft, Users, Search, Loader2 } from 'lucide-react';
import { analytics } from '../../services/analytics';
import { useToast } from '../../contexts/ToastContext';
import { ExcelImportWizard } from '../personnel/ExcelImportWizard';
import { Person, Team, Role } from '../../types';
import { v4 as uuidv4 } from 'uuid';

export const Onboarding: React.FC = () => {
    const { user, profile, refreshProfile, signOut } = useAuth();
    const { showToast } = useToast();

    // Safety redirect: If user already has an organization, go to home
    useEffect(() => {
        if (profile?.organization_id) {
            window.location.href = '/';
        }
    }, [profile]);
    const [step, setStep] = useState<'org_name' | 'path_selection' | 'import_wizard' | 'claim_profile'>('org_name');
    const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(true);
    const [pendingInvite, setPendingInvite] = useState<any>(null);
    const [error, setError] = useState('');

    // Local state for the Import Wizard (before saving to DB)
    const [localTeams, setLocalTeams] = useState<Team[]>([]);
    const [localRoles, setLocalRoles] = useState<Role[]>([]);
    const [createdPeople, setCreatedPeople] = useState<any[]>([]); // Store for Claim Profile step
    const [claimSearchTerm, setClaimSearchTerm] = useState('');
    const [selectedClaimPerson, setSelectedClaimPerson] = useState<any>(null);

    // Check for pending invites when component mounts
    useEffect(() => {
        checkForInvite();

        // Check for terms acceptance from Landing Page
        const saveTerms = async () => {
            const timestamp = localStorage.getItem('terms_accepted_timestamp');
            if (user && timestamp) {

                await supabase.from('profiles').update({ terms_accepted_at: timestamp }).eq('id', user.id);
                localStorage.removeItem('terms_accepted_timestamp');
            }
        };
        saveTerms();

    }, [user]);

    const checkForInvite = async () => {

        if (!user?.email) {

            setCheckingInvite(false);
            return;
        }

        try {
            const { data: invites, error } = await supabase
                .from('organization_invites')
                .select('*, organizations(name)')
                .eq('email', user.email.toLowerCase())
                .eq('accepted', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (invites && invites.length > 0) {

                setPendingInvite(invites[0]);
            } else {

            }
        } catch (error) {
            console.error('Error checking for invites:', error);
        } finally {
            setCheckingInvite(false);
        }
    };

    const handleAcceptInvite = async () => {
        if (!pendingInvite || !user) return;

        setLoading(true);
        try {
            // Update profile with organization and role from invite
            const { error: profileError } = await supabase
                .from('profiles')
                .update({
                    organization_id: pendingInvite.organization_id,
                    // role: pendingInvite.role || 'viewer', // DEPRECATED: Causing 400 error
                    permission_template_id: pendingInvite.template_id || null // NEW: Save template ID
                })
                .eq('id', user.id);

            if (profileError) throw profileError;

            // Mark invite as accepted
            const { error: inviteError } = await supabase
                .from('organization_invites')
                .update({ accepted: true })
                .eq('id', pendingInvite.id);

            if (inviteError) throw inviteError;

            // Refresh profile to load organization
            await refreshProfile();
        } catch (error) {
            console.error('Error accepting invite:', error);
            showToast('שגיאה בקבלת ההזמנה. אנא נסה שוב.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOrgName(e.target.value);
        analytics.trackFormFieldEdit('create_organization', 'org_name');
    };

    const handleCreateOrg = async (e: React.FormEvent) => {
        e.preventDefault();
        analytics.trackFormStart('create_organization');

        if (!orgName.trim()) {
            analytics.trackValidationError('create_organization', 'org_name', 'empty');
            setError('נא להזין שם ארגון');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // 1. Create organization
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert({ name: orgName.trim() })
                .select()
                .single();

            if (orgError) throw orgError;
            if (!org) throw new Error('Failed to create organization');

            setCreatedOrgId(org.id);
            analytics.trackSignup(orgName);

            // 2. Do NOT update profile yet. We wait until they choose a path or finish import.
            // This ensures they don't get "in" before finishing all steps.
            setStep('path_selection');

        } catch (error) {
            console.error('Error creating organization:', error);
            analytics.trackFormSubmit('create_organization', false);
            analytics.trackError((error as Error).message, 'CreateOrganization');
            setError('שגיאה ביצירת הארגון');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPath = async (useImport: boolean) => {
        if (useImport) {
            setStep('import_wizard');
            return;
        }

        // Manual setup - Update profile NOW to let them in
        setLoading(true);
        try {
            if (user && createdOrgId) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        organization_id: createdOrgId,
                        // role: 'admin', // DEPRECATED
                        // Grant Full Access (Personal Template) to the creator
                        permissions: { "screens": { "logs": "edit", "stats": "edit", "tasks": "edit", "lottery": "edit", "dashboard": "edit", "equipment": "edit", "personnel": "edit", "attendance": "edit", "constraints": "edit", "settings": "edit", "reports": "edit" }, "dataScope": "organization", "canManageUsers": true, "canManageSettings": true }
                    })
                    .eq('id', user.id);
                if (profileError) throw profileError;
            }

            await refreshProfile();
        } catch (error) {
            console.error('Error finalizing onboarding:', error);
            showToast('שגיאה בהשלמת ההרשמה', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Import Wizard Handlers
    const handleAddTeam = (team: Team) => {
        setLocalTeams(prev => [...prev, team]);
    };

    const handleAddRole = (role: Role) => {
        setLocalRoles(prev => [...prev, role]);
    };

    const handleFinalImport = async (people: Person[], newTeams: Team[] = [], newRoles: Role[] = []) => {
        if (!createdOrgId) return;
        setLoading(true);

        // Merge incoming new items with local state items to ensure we have everything
        const allTeams = [...localTeams, ...newTeams];
        const allRoles = [...localRoles, ...newRoles];

        console.log(`🚀 Starting Final Import. Teams: ${allTeams.length}, Roles: ${allRoles.length}, People: ${people.length}`);

        try {
            // 1. Link User to Organization FIRST (to satisfy RLS for creating teams/roles)
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        organization_id: createdOrgId,
                        // role: 'admin', // DEPRECATED
                        permissions: { "screens": { "logs": "edit", "stats": "edit", "tasks": "edit", "lottery": "edit", "dashboard": "edit", "equipment": "edit", "personnel": "edit", "attendance": "edit", "constraints": "edit", "settings": "edit", "reports": "edit" }, "dataScope": "organization", "canManageUsers": true, "canManageSettings": true }
                    })
                    .eq('id', user.id);

                if (profileError) {
                    console.error("Failed to link profile:", profileError);
                    throw profileError;
                }
                // Refresh profile in context to reflect the change
                // await refreshProfile(); // Commented out to prevent skipping 'Claim Profile' step. Context update will happen after claiming.
            }

            // 2. Map temp IDs to Real UUIDs & Deduplicate
            const idMap = new Map<string, string>(); // 'temp-id' -> 'real-uuid'

            // Deduplicate teams by ID (keep last)
            const uniqueTeams = Array.from(new Map(allTeams.map((t: Team) => [t.id, t])).values());
            const uniqueRoles = Array.from(new Map(allRoles.map((r: Role) => [r.id, r])).values());

            console.log(`Processing ${uniqueTeams.length} unique teams and ${uniqueRoles.length} unique roles.`);

            // Create Teams
            for (const team of uniqueTeams) {
                const t = team as Team;
                const isTemp = t.id.startsWith('temp-') || t.id.startsWith('team-');

                if (!isTemp) {
                    idMap.set(t.id, t.id);
                    continue;
                }

                // Check if we already mapped this exact temporary ID (in case of dupes in source)
                if (idMap.has(team.id)) continue;

                const realId = uuidv4();
                idMap.set(team.id, realId);

                const { error } = await supabase.from('teams').insert({
                    id: realId,
                    name: team.name,
                    color: team.color,
                    organization_id: createdOrgId
                });
                if (error) {
                    console.error("Error creating team:", team.name, error);
                    throw error;
                }
            }

            // Create Roles
            for (const role of uniqueRoles) {
                const isTemp = role.id.startsWith('temp-') || role.id.startsWith('role-');

                if (!isTemp) {
                    idMap.set(role.id, role.id);
                    continue;
                }

                if (idMap.has(role.id)) continue;

                const realId = uuidv4();
                idMap.set(role.id, realId);

                const { error } = await supabase.from('roles').insert({
                    id: realId,
                    name: role.name,
                    color: role.color,
                    organization_id: createdOrgId
                });
                if (error) {
                    console.error("Error creating role:", role.name, error);
                    throw error;
                }
            }

            // 3. Prepare People
            const insertedPeople: any[] = [];

            for (const p of people) {
                // Map teamId
                let teamId = p.teamId;
                if (teamId) {
                    if (idMap.has(teamId)) {
                        teamId = idMap.get(teamId)!;
                    } else if (teamId.startsWith('temp-') || teamId.startsWith('team-')) {
                        teamId = undefined; // Unmapped temp ID -> Null
                    }
                }

                // Map roleIds
                const roleIds = (p.roleIds || [])
                    .map(rid => {
                        if (idMap.has(rid)) return idMap.get(rid);
                        if (rid.startsWith('temp-') || rid.startsWith('role-')) return null;
                        return rid;
                    })
                    .filter(Boolean) as string[];

                // IMPORTANT: DB Schema uses 'role_ids' (array), NOT 'role_id'
                try {
                    const newId = uuidv4();
                    const { error } = await supabase.from('people').insert({
                        id: newId,
                        name: p.name,
                        organization_id: createdOrgId,
                        team_id: teamId || null,
                        role_ids: roleIds,
                        email: p.email || null,
                        phone: p.phone || null,
                        color: p.color
                    });
                    if (error) {
                        if (error.code === '23505') { // Unique violation
                            console.warn(`Duplicate person skipped: ${p.name} (${p.email})`);
                            continue;
                        }
                        throw error;
                    }
                    // Add to success list with the ID we generated
                    insertedPeople.push({ ...p, id: newId });

                } catch (insertError: any) {
                    console.error("Error inserting person:", p.name, insertError);
                    if (insertError.code !== '23505') throw insertError;
                }
            }

            setCreatedPeople(insertedPeople);
            showToast('הייבוא הושלם בהצלחה! כעת בחר מי אתה מהרשימה.', 'success');

            // Move to Claim Step instead of refreshing immediately
            setStep('claim_profile');
            // await refreshProfile(); 
            // window.location.reload();


        } catch (error: any) {
            console.error('Import error full:', error);
            showToast('שגיאה בייבוא הנתונים: ' + (error.details || error.message || error), 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleClaimProfile = async () => {
        if (!selectedClaimPerson || !user) return;
        setLoading(true);
        try {
            await supabase.from('people').update({ user_id: user.id }).eq('id', selectedClaimPerson.id);
            // NOW we finish
            await refreshProfile();
            // Optional: window.location.reload() if needed, but refreshProfile might suffice.
        } catch (error) {
            console.error(error);
            showToast('שגיאה בקישור הפרופיל', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut();
            window.location.reload();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    // If user is already in an organization, don't show onboarding (unless we are processing an invite explicitly?)
    if (user && profile?.organization_id) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-400" />
        </div>;
    }

    if (checkingInvite) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 via-teal-50 to-blue-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4 mx-auto animate-pulse overflow-hidden p-3 border border-slate-100">
                        <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-slate-600 font-medium">בודק הזמנות...</p>
                </div>
            </div>
        );
    }

    // If user has a pending invite, show accept invite screen
    if (pendingInvite) {
        return (
            <div className="h-screen bg-[#f8fafc] overflow-y-auto font-sans">
                {/* Minimal Navigation */}
                <header className="bg-white border-b border-slate-200 h-16 flex items-center shadow-sm sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                                <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-xl font-black text-slate-900 tracking-tight">מערכת לניהול פלוגה</span>
                        </div>
                    </div>
                </header>

                <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 md:p-12">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200/60 flex flex-col md:flex-row">
                        {/* Branding Side */}
                        <div className="md:w-1/3 bg-slate-900 p-12 text-white flex flex-col justify-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400 opacity-5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
                            <div className="relative z-10 text-center md:text-right">
                                <div className="w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto md:mr-0 mb-8 border border-white/10">
                                    <Mail size={40} className="text-amber-400" />
                                </div>
                                <h1 className="text-4xl font-black mb-4 leading-tight">קיבלת הזמנה!</h1>
                                <p className="text-slate-400 text-lg">מישהו רוצה שתצטרף לצוות שלו.</p>
                            </div>
                        </div>

                        {/* Content Side */}
                        <div className="flex-1 p-8 md:p-16 flex flex-col justify-center bg-white">
                            <div className="space-y-10 animate-in fade-in slide-in-from-left-10 duration-700">
                                <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-center md:text-right">
                                    <div className="flex items-center justify-center md:justify-start gap-4 mb-6">
                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-200">
                                            <Building2 size={24} className="text-slate-900" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ארגון</p>
                                            <h3 className="text-2xl font-black text-slate-900">{pendingInvite.organizations?.name || 'ארגון'}</h3>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Shield size={20} className="text-amber-500" />
                                            <span className="text-lg font-bold text-slate-700">
                                                {pendingInvite.role === 'admin' && 'מנהל מערכת'}
                                                {pendingInvite.role === 'editor' && 'עורך'}
                                                {pendingInvite.role === 'shift_manager' && 'מנהל משמרות'}
                                                {pendingInvite.role === 'viewer' && 'צופה'}
                                                {pendingInvite.role === 'attendance_only' && 'נוכחות בלבד'}
                                                {!['admin', 'editor', 'shift_manager', 'viewer', 'attendance_only'].includes(pendingInvite.role) && (pendingInvite.role || 'צופה')}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-slate-400 uppercase">תפקיד</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <button
                                        onClick={handleAcceptInvite}
                                        disabled={loading}
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 px-8 rounded-2xl transition-all shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 hover:-translate-y-1 flex items-center justify-center gap-4 text-xl disabled:opacity-50 disabled:translate-y-0 active:scale-95"
                                    >
                                        {loading ? (
                                            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <>
                                                <CheckCircle size={24} />
                                                קבל הזמנה והצטרף
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={() => setPendingInvite(null)}
                                        className="w-full text-slate-400 hover:text-slate-600 font-bold transition-all text-sm py-2"
                                    >
                                        או צור ארגון חדש משלך →
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: Create new organization
    return (
        <div className="h-screen bg-[#f8fafc] overflow-y-auto font-sans">
            {/* Minimal Navigation */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center shadow-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                            <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">מערכת לניהול פלוגה</span>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="text-slate-500 hover:text-red-600 font-bold text-sm transition-colors flex items-center gap-2 group"
                    >
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">התנתק</span>
                        <div className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                        </div>
                    </button>
                </div>
            </header>

            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-0 md:p-12">
                <div className="bg-white md:rounded-[2.5rem] shadow-2xl max-w-5xl w-full overflow-hidden border-0 md:border border-slate-200/60 flex flex-col md:flex-row h-full md:h-auto">

                    {/* Dark Side Branding (Mobile Top, Desktop Left/Sidebar) */}
                    <div className="w-full md:w-[400px] h-[30vh] md:h-auto bg-emerald-900 p-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden shrink-0">
                        {/* Decorative background elements */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-400 opacity-[0.1] rounded-full -translate-y-1/2 translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-400 opacity-[0.1] rounded-full translate-y-1/2 -translate-x-1/2"></div>

                        <div className="relative z-10 flex flex-col h-full justify-center md:justify-start">
                            <div className="flex items-center gap-4 mb-2 md:mb-8">
                                <div className="w-10 h-10 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center border border-white/10 shrink-0">
                                    <Shield size={20} className="md:w-8 md:h-8 text-emerald-400" />
                                </div>
                                <h1 className="text-2xl md:text-4xl font-black leading-tight md:hidden">
                                    {step === 'org_name' ? 'הקמת ארגון' : 'הגדרות'}
                                </h1>
                            </div>

                            <h1 className="hidden md:block text-4xl font-black mb-6 leading-tight">
                                {step === 'org_name' ? 'יוצאים לדרך חדשה.' :
                                    step === 'import_wizard' ? 'ייבוא נתונים.' :
                                        'הקמה חכמה.'}
                            </h1>
                            <p className="hidden md:block text-emerald-100/70 text-lg leading-relaxed">
                                {step === 'org_name'
                                    ? 'אנחנו כאן כדי לעזור לך לנהל את הפלוגה בצורה מקצועית, שקופה ואפקטיבית יותר.'
                                    : step === 'import_wizard'
                                        ? 'אנא עקוב אחר שלבי הייבוא כדי להכניס את כל הלוחמים למערכת.'
                                        : 'הארגון נוצר! השלב הבא הוא להכניס את האנשים והמשימות למערכת.'}
                            </p>
                        </div>

                        {/* Desktop Step Indicator */}
                        <div className="relative z-10 pt-12 hidden md:block">
                            <div className="flex items-center gap-4 text-sm text-emerald-200 font-bold uppercase tracking-widest bg-emerald-950/30 p-4 rounded-2xl border border-emerald-500/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                                {step === 'org_name' ? 'שלב 1: פרטי ארגון' : 'שלב 2: בחירת מסלול'}
                            </div>
                        </div>
                    </div>

                    {/* Content Section - The "White Sheet" */}
                    <div className="flex-1 p-6 md:p-16 bg-white rounded-t-3xl -mt-6 md:mt-0 relative z-20 flex flex-col animate-in slide-in-from-bottom-6 duration-500">
                        {/* Mobile Step Indicator */}
                        <div className="md:hidden flex justify-center -mt-3 mb-6">
                            <div className="bg-white shadow-lg border border-slate-100 text-xs font-bold text-emerald-800 uppercase tracking-wider py-1.5 px-4 rounded-full flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                {step === 'org_name' ? 'שלב 1: פרטי ארגון' : 'שלב 2: בחירת מסלול'}
                            </div>
                        </div>

                        {step === 'org_name' ? (
                            <div className="max-w-xl mx-auto space-y-6 md:space-y-10">
                                <div>
                                    <h2 className="text-xl md:text-3xl font-black text-slate-800 mb-2 md:mb-4">איך תרצו לקרוא לארגון?</h2>
                                    <p className="text-slate-500 text-base md:text-lg">שם הפלוגה, הגדוד או היחידה שלך.</p>
                                </div>

                                <form onSubmit={handleCreateOrg} className="space-y-6 md:space-y-8 flex-1 flex flex-col">
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Building2 className="absolute right-5 top-1/2 -translate-y-1/2 text-emerald-500" size={24} />
                                            <input
                                                type="text"
                                                value={orgName}
                                                onChange={handleOrgNameChange}
                                                placeholder="שם הארגון..."
                                                className="w-full pr-14 pl-4 py-4 md:pl-6 md:py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-emerald-500 focus:bg-white focus:outline-none text-xl md:text-2xl transition-all font-bold placeholder:font-normal placeholder:text-slate-300 shadow-inner"
                                                required
                                                disabled={loading}
                                                autoFocus
                                            />
                                        </div>
                                        {error && (
                                            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100">
                                                <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                                                {error}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !orgName.trim()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 md:py-5 px-8 rounded-2xl transition-all shadow-xl shadow-emerald-600/20 hover:shadow-emerald-600/40 hover:-translate-y-1 flex items-center justify-center gap-4 text-lg md:text-xl disabled:opacity-50 disabled:translate-y-0 active:scale-95"
                                    >
                                        יצירת ארגון והמשך
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <ArrowLeft size={24} />}
                                    </button>
                                </form>
                            </div>
                        ) : (step === 'path_selection' || step === 'import_wizard') ? (
                            <div className="space-y-8 md:space-y-12 animate-in fade-in slide-in-from-left-10 duration-700 h-full overflow-y-auto">
                                {step === 'import_wizard' && (
                                    <ExcelImportWizard
                                        isOpen={true}
                                        onClose={() => setStep('path_selection')}
                                        onImport={handleFinalImport}
                                        teams={localTeams}
                                        roles={localRoles}
                                        onAddTeam={handleAddTeam}
                                        onAddRole={handleAddRole}
                                        isSaving={loading}
                                    />
                                )}

                                <div className="text-center md:text-right">
                                    <h2 className="text-3xl font-black text-slate-900 mb-4">איך תרצו להקים את הסד"כ?</h2>
                                    <p className="text-slate-500 text-lg">יש שתי דרכים להתחיל. בחר את המתאימה לך ביותר.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Path 1: Manual */}
                                    <button
                                        onClick={() => handleSelectPath(false)}
                                        disabled={loading}
                                        className="flex flex-col text-right bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 hover:border-slate-900 hover:shadow-2xl transition-all group relative"
                                    >
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                                            <Users size={28} />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 mb-3">הקמה ידנית</h3>
                                        <p className="text-slate-500 leading-relaxed mb-8 flex-1">
                                            להתחיל מאפס. הוספת צוותים וחיילים אחד-אחד דרך הממשק. מעולה ליחידות קטנות או לדיוק מקסימלי.
                                        </p>
                                        <div className="flex items-center gap-2 text-slate-900 font-black group-hover:translate-x-[-10px] transition-transform">
                                            <span>התחל הקמה</span>
                                            <ArrowLeft size={20} />
                                        </div>
                                    </button>

                                    {/* Path 2: Import */}
                                    <button
                                        onClick={() => handleSelectPath(true)}
                                        disabled={loading}
                                        className="flex flex-col text-right bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 hover:border-amber-500 hover:shadow-2xl transition-all group relative"
                                    >
                                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-900 transition-all shadow-sm">
                                            <Upload size={28} />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 mb-3">ייבוא מאקסל</h3>
                                        <p className="text-slate-500 leading-relaxed mb-8 flex-1">
                                            יש לכם כבר רשימות? העלו קובץ CSV/Excel והמערכת תבנה את הכל עבורכם בשניות. הכי מהיר.
                                        </p>
                                        <div className="flex items-center gap-2 text-amber-600 font-black group-hover:translate-x-[-10px] transition-transform">
                                            <span>להעלאת קובץ</span>
                                            <ArrowLeft size={20} />
                                        </div>
                                    </button>
                                </div>

                                <button
                                    onClick={() => setStep('org_name')}
                                    className="mx-auto flex items-center gap-2 text-slate-400 font-bold hover:text-slate-600 transition-colors py-2"
                                >
                                    <ArrowLeft className="rotate-180" size={16} />
                                    חזרה לשינוי שם הארגון
                                </button>
                            </div>
                        ) : step === 'claim_profile' ? (
                            <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-10 duration-700">
                                <div>
                                    <h2 className="text-3xl font-black text-slate-900 mb-4">מי אתה מהרשימה?</h2>
                                    <p className="text-slate-500 text-lg">כדי לסיים את ההקמה, אנא בחר את השם שלך מתוך הרשימה שייבאת.</p>
                                </div>

                                <div className="relative">
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                    <input
                                        type="text"
                                        placeholder="חפש את השם שלך..."
                                        value={claimSearchTerm}
                                        onChange={e => setClaimSearchTerm(e.target.value)}
                                        className="w-full pr-12 pl-4 py-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-900 focus:outline-none transition-all font-bold text-lg"
                                    />
                                </div>

                                <div className="border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden max-h-[300px] overflow-y-auto">
                                    {createdPeople.length === 0 && (
                                        <div className="p-8 text-center text-slate-400">
                                            לא נמצאו רשומות. משהו השתבש בייבוא?
                                        </div>
                                    )}
                                    {createdPeople
                                        .filter(p => p.name.toLowerCase().includes(claimSearchTerm.toLowerCase()))
                                        .map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => setSelectedClaimPerson(p)}
                                                className={`w-full p-4 text-right flex items-center justify-between hover:bg-white transition-all border-b border-slate-100 last:border-0 ${selectedClaimPerson?.id === p.id ? 'bg-white ring-inset ring-2 ring-slate-900 z-10' : ''}`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${p.color?.replace('border-', 'bg-') || 'bg-slate-400'}`}>
                                                        {p.name.slice(0, 2)}
                                                    </div>
                                                    <div>
                                                        <div className={`font-bold text-lg ${selectedClaimPerson?.id === p.id ? 'text-slate-900' : 'text-slate-700'}`}>{p.name}</div>
                                                        <div className="text-sm text-slate-500">{p.email || 'ללא אימייל'}</div>
                                                    </div>
                                                </div>
                                                {selectedClaimPerson?.id === p.id && <CheckCircle size={24} className="text-slate-900" />}
                                            </button>
                                        ))}
                                </div>

                                <button
                                    onClick={handleClaimProfile}
                                    disabled={!selectedClaimPerson || loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 px-8 rounded-2xl mt-6 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Sparkles size={24} />}
                                    סיום וכניסה למערכת
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};
