import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from './AuthContext';
import { Buildings as Building2, Envelope as Mail, CheckCircle, Sparkle as Sparkles, Shield, FileXls as FileSpreadsheet, UploadSimple as Upload, ArrowLeft, Users, MagnifyingGlass as Search, CircleNotch as Loader2 } from '@phosphor-icons/react';
import { analytics } from '../../services/analytics';
import { useToast } from '../../contexts/ToastContext';
import { ExcelImportWizard } from '../personnel/ExcelImportWizard';
import { Person, Team, Role } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../services/loggingService';

// Unified Layout Component to avoid code duplication across flows
const OnboardingLayout = ({
    sidebarContent,
    mainContent,
    decorativeColor = 'emerald',
    showLogout,
    onLogout
}: {
    sidebarContent: React.ReactNode,
    mainContent: React.ReactNode,
    decorativeColor?: 'emerald' | 'amber' | 'blue',
    showLogout?: boolean,
    onLogout?: () => void
}) => {
    const bgColors = {
        emerald: 'bg-emerald-900',
        amber: 'bg-slate-900',
        blue: 'bg-blue-900'
    };

    const accentColors = {
        emerald: 'bg-emerald-400',
        amber: 'bg-amber-400',
        blue: 'bg-blue-400'
    };

    return (
        <div className="h-screen bg-[#f8fafc] overflow-y-auto font-sans flex flex-col">
            {/* Minimal Navigation */}
            <header className="bg-white border-b border-slate-200 h-16 flex items-center shadow-sm sticky top-0 z-50 shrink-0">
                <div className="max-w-7xl mx-auto px-4 w-full flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100 p-1.5">
                            <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">מערכת לניהול פלוגה</span>
                    </div>
                    {showLogout && onLogout && (
                        <button
                            onClick={onLogout}
                            className="text-slate-500 hover:text-red-600 font-bold text-sm transition-colors flex items-center gap-2 group"
                        >
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity hidden md:inline">התנתק</span>
                            <div className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                                <ArrowLeft size={20} className="rotate-180" weight="bold" />
                            </div>
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center p-0 md:p-6 lg:p-12 min-h-0">
                <div className="bg-white md:rounded-[2.5rem] shadow-2xl max-w-6xl w-full overflow-hidden border-0 md:border border-slate-200/60 flex flex-col md:flex-row h-full md:h-[min(800px,85vh)]">

                    {/* Branding Side */}
                    <div className={`w-full md:w-[400px] lg:w-[450px] ${bgColors[decorativeColor]} p-8 md:p-12 text-white flex flex-col justify-between relative overflow-hidden shrink-0 transition-colors duration-500`}>
                        {/* Decorative background elements */}
                        <div className={`absolute top-0 right-0 w-64 h-64 ${accentColors[decorativeColor]} opacity-[0.1] rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl`} />
                        <div className={`absolute bottom-0 left-0 w-48 h-48 bg-white opacity-[0.05] rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl`} />

                        <div className="relative z-10 flex flex-col h-full justify-center md:justify-start">
                            {sidebarContent}
                        </div>
                    </div>

                    {/* Content Section */}
                    <div className="flex-1 bg-white rounded-t-[2rem] -mt-6 md:mt-0 relative z-20 flex flex-col min-h-0">
                        {mainContent}
                    </div>
                </div>
            </div>
        </div>
    );
};



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
            logger.error('AUTH', 'Failed to check for invites in onboarding', error);
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
            logger.error('AUTH', 'Failed to accept invitation during onboarding', error);
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
            logger.error('CREATE', 'Failed to create organization in onboarding', error);
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
                        permissions: {
                            "screens": {
                                "logs": "edit", "stats": "edit", "tasks": "edit", "lottery": "edit",
                                "dashboard": "edit", "equipment": "edit", "personnel": "edit",
                                "attendance": "edit", "constraints": "edit", "settings": "edit",
                                "reports": "edit", "gate": "edit", "absences": "edit",
                                "planner": "edit", "tickets": "edit"
                            },
                            "dataScope": "organization",
                            "canManageRotaWizard": true,
                            "canManageGateAuthorized": true,
                            "canApproveRequests": true
                        }
                    })
                    .eq('id', user.id);
                if (profileError) throw profileError;
            }

            await refreshProfile();
        } catch (error) {
            console.error('Error finalizing onboarding:', error);
            showToast('שגיאה בהשלמת ההרשמה', 'error');
            logger.error('SIGNUP', 'Failed to finalize manual onboarding path', error);
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

        console.log(`🚀 Starting Final Import.Teams: ${allTeams.length}, Roles: ${allRoles.length}, People: ${people.length} `);

        try {
            // 1. Link User to Organization FIRST (to satisfy RLS for creating teams/roles)
            if (user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        organization_id: createdOrgId,
                        // role: 'admin', // DEPRECATED
                        permissions: {
                            "screens": {
                                "logs": "edit", "stats": "edit", "tasks": "edit", "lottery": "edit",
                                "dashboard": "edit", "equipment": "edit", "personnel": "edit",
                                "attendance": "edit", "constraints": "edit", "settings": "edit",
                                "reports": "edit", "gate": "edit", "absences": "edit",
                                "planner": "edit", "tickets": "edit"
                            },
                            "dataScope": "organization",
                            "canManageRotaWizard": true,
                            "canManageGateAuthorized": true,
                            "canApproveRequests": true
                        }
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
            logger.error('IMPORT_DATA', 'Bulk import failed during onboarding', error);
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
            logger.error('AUTH', 'Failed to claim profile in onboarding', error);
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
            <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>;
    }



    if (checkingInvite) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center animate-pulse">
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg mb-4 mx-auto p-4 border border-slate-100">
                        <img src="/favicon.png" alt="App Logo" className="w-full h-full object-contain" />
                    </div>
                    <p className="text-slate-400 font-bold text-sm tracking-widest uppercase">טוען נתונים...</p>
                </div>
            </div>
        );
    }

    // --- INVITE FLOW ---
    if (pendingInvite) {
        return (
            <OnboardingLayout
                decorativeColor="amber"
                showLogout={!!user}
                onLogout={handleLogout}
                sidebarContent={
                    <>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                                <Mail size={24} className="text-amber-400" weight="duotone" />
                            </div>
                        </div>
                        <h1 className="text-3xl md:text-5xl font-black mb-6 leading-tight">
                            הוזמנת להצטרף.
                        </h1>
                        <p className="text-slate-300 text-lg leading-relaxed max-w-xs">
                            מישהו מהצוות שלך הוסיף אותך למערכת. כל שנשאר זה לאשר ולהתחיל לעבוד.
                        </p>
                    </>
                }
                mainContent={
                    <div className="flex-1 p-8 md:p-16 flex flex-col justify-center overflow-y-auto">
                        <div className="max-w-md mx-auto w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                            <div className="text-center md:text-right">
                                <h2 className="text-3xl font-black text-slate-900 mb-2">ברוכים הבאים!</h2>
                                <p className="text-slate-500">אנא אשרו את ההצטרפות לארגון.</p>
                            </div>

                            <div className="bg-slate-50 hover:bg-white border-2 border-slate-100 hover:border-amber-200 hover:shadow-lg hover:shadow-amber-100/50 rounded-3xl p-8 transition-all duration-300 group">
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                                        <Building2 size={28} className="text-slate-900" weight="duotone" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">הוזמנת לארגון</p>
                                        <h3 className="text-2xl font-black text-slate-900">{pendingInvite.organizations?.name || 'ארגון'}</h3>
                                    </div>
                                </div>

                                <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                            <Shield size={20} weight="duotone" />
                                        </div>
                                        <span className="text-base font-bold text-slate-700">
                                            {pendingInvite.role === 'admin' && 'מנהל מערכת'}
                                            {pendingInvite.role === 'editor' && 'עורך'}
                                            {pendingInvite.role === 'shift_manager' && 'מנהל משמרות'}
                                            {pendingInvite.role === 'viewer' && 'צופה'}
                                            {pendingInvite.role === 'attendance_only' && 'נוכחות בלבד'}
                                            {!['admin', 'editor', 'shift_manager', 'viewer', 'attendance_only'].includes(pendingInvite.role) && (pendingInvite.role || 'צופה')}
                                        </span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">תפקיד</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4">
                                <button
                                    onClick={handleAcceptInvite}
                                    disabled={loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 rounded-2xl transition-all shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 hover:-translate-y-0.5 flex items-center justify-center gap-3 text-lg disabled:opacity-70 active:scale-95"
                                >
                                    {loading ? (
                                        <Loader2 className="animate-spin" size={24} />
                                    ) : (
                                        <>
                                            <CheckCircle size={24} weight="bold" />
                                            אשר הצטרפות
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={() => setPendingInvite(null)}
                                    className="w-full text-slate-400 hover:text-slate-600 font-bold transition-all text-sm py-3 hover:bg-slate-50 rounded-xl"
                                >
                                    התעלם וצור ארגון חדש ←
                                </button>
                            </div>
                        </div>
                    </div>
                }
            />
        );
    }

    // --- CREATE ORG FLOW ---
    return (
        <OnboardingLayout
            decorativeColor="emerald"
            showLogout={!!user}
            onLogout={handleLogout}
            sidebarContent={
                <>
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10">
                            <Shield size={24} className="text-emerald-400" weight="duotone" />
                        </div>
                    </div>

                    <div className="space-y-6">
                        <h1 className="text-3xl md:text-5xl font-black leading-tight">
                            {step === 'org_name' ? 'יוצאים לדרך חדשה.' :
                                step === 'import_wizard' ? 'ייבוא נתונים.' :
                                    step === 'path_selection' ? 'איך ממשיכים?' :
                                        'כמעט סיימנו.'}
                        </h1>
                        <p className="text-emerald-100/80 text-lg leading-relaxed max-w-xs">
                            {step === 'org_name'
                                ? 'מערכת הניהול שחיכית לה. פשוטה, חכמה ויעילה.'
                                : step === 'import_wizard'
                                    ? 'הדרך המהירה ביותר להכניס את כולם לעניינים.'
                                    : 'בחר את הדרך הנוחה לך ביותר להקים את היחידה.'}
                        </p>
                    </div>

                    {/* Desktop Step Indicator */}
                    <div className="hidden md:flex gap-2 mt-12 bg-emerald-950/30 p-2 rounded-2xl w-fit backdrop-blur-sm border border-emerald-500/10">
                        {['org_name', 'path_selection', 'claim_profile'].map((s, idx) => {
                            const currentIdx = ['org_name', 'path_selection', 'import_wizard', 'claim_profile'].indexOf(step);
                            const stepIdx = ['org_name', 'path_selection', 'claim_profile'].indexOf(s);
                            const active = step === s || (s === 'path_selection' && step === 'import_wizard');

                            return (
                                <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${active ? 'w-8 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'w-2 bg-white/20'}`} />
                            );
                        })}
                    </div>
                </>
            }
            mainContent={
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    {/* Mobile Step Indicator */}
                    <div className="md:hidden flex justify-center py-6">
                        <div className="flex gap-2">
                            {['org_name', 'path_selection', 'claim_profile'].map((s) => {
                                const active = step === s || (s === 'path_selection' && step === 'import_wizard');
                                return (
                                    <div key={s} className={`h-1.5 rounded-full transition-all ${active ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-200'}`} />
                                );
                            })}
                        </div>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 lg:p-16">
                        {step === 'org_name' ? (
                            <div className="max-w-lg mx-auto h-full flex flex-col justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-8 md:mb-10 text-center md:text-right">
                                    <h2 className="text-2xl md:text-4xl font-black text-slate-900 mb-3">שם הארגון החדש</h2>
                                    <p className="text-slate-500 text-lg">איך נקרא לפלוגה או ליחידה שלך?</p>
                                </div>

                                <form onSubmit={handleCreateOrg} className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-slate-700 mr-1">שם הארגון</label>
                                        <div className="relative group">
                                            <Building2 className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={24} weight="duotone" />
                                            <input
                                                type="text"
                                                value={orgName}
                                                onChange={handleOrgNameChange}
                                                placeholder="לדוגמה: פלוגת חוד 13"
                                                className="w-full h-14 pr-12 pl-4 rounded-2xl bg-slate-50 border border-slate-200 text-lg font-bold text-slate-900 placeholder:text-slate-300 placeholder:font-normal focus:outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all shadow-sm"
                                                required
                                                disabled={loading}
                                                autoFocus
                                            />
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-bold flex items-center gap-3 border border-red-100 animate-in shake">
                                            <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={loading || !orgName.trim()}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-14 rounded-2xl transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-300 hover:-translate-y-0.5 flex items-center justify-center gap-3 text-lg disabled:opacity-50 disabled:shadow-none disabled:translate-y-0 active:scale-95 mt-4"
                                    >
                                        {loading ? <Loader2 className="animate-spin" size={24} /> :
                                            <>
                                                המשך לשלב הבא
                                                <ArrowLeft size={20} weight="bold" />
                                            </>}
                                    </button>
                                </form>
                            </div>
                        ) : (step === 'path_selection' || step === 'import_wizard') ? (
                            <div className="h-full flex flex-col">
                                {step === 'import_wizard' && (
                                    <ExcelImportWizard
                                        isOpen={true}
                                        onClose={() => setStep('path_selection')}
                                        onImport={handleFinalImport}
                                        teams={localTeams}
                                        roles={localRoles}
                                        people={[]} // No existing people in new org
                                        onAddTeam={handleAddTeam}
                                        onAddRole={handleAddRole}
                                        isSaving={loading}
                                    />
                                )}

                                <div className="text-center md:text-right mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <button
                                        onClick={() => setStep('org_name')}
                                        className="inline-flex items-center gap-2 text-slate-400 font-bold hover:text-slate-600 transition-colors mb-4 text-sm"
                                    >
                                        <ArrowLeft className="rotate-180" size={16} />
                                        חזרה
                                    </button>
                                    <h2 className="text-3xl font-black text-slate-900 mb-3">הקמת הסד"כ</h2>
                                    <p className="text-slate-500 text-lg">בחר את הדרך הנוחה ביותר עבורך.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-75">
                                    {/* Path 1: Manual */}
                                    <button
                                        onClick={() => handleSelectPath(false)}
                                        disabled={loading}
                                        className="flex flex-col text-right bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-slate-800 hover:ring-4 hover:ring-slate-50 transition-all group relative overflow-hidden"
                                    >
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 shadow-sm">
                                            <Users size={32} weight="duotone" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2">הקמה ידנית</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1">
                                            הוספת לוחמים וצוותים אחד-אחד. מתאים להקמות קטנות או לדיוק מירבי.
                                        </p>
                                        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm bg-slate-50 w-fit px-4 py-2 rounded-xl group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                            <span>בחר ידני</span>
                                            <ArrowLeft size={16} weight="bold" />
                                        </div>
                                    </button>

                                    {/* Path 2: Import */}
                                    <button
                                        onClick={() => handleSelectPath(true)}
                                        disabled={loading}
                                        className="flex flex-col text-right bg-white border border-slate-200 rounded-[2rem] p-8 hover:border-emerald-500 hover:ring-4 hover:ring-emerald-50 transition-all group relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-50 rounded-br-[100%] rounded-tl-[2rem] -translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-500" />

                                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 z-10 relative group-hover:scale-110 transition-transform">
                                            <Upload size={32} weight="duotone" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 mb-2 relative z-10">ייבוא מאקסל</h3>
                                        <p className="text-slate-500 text-sm leading-relaxed mb-8 flex-1 relative z-10">
                                            הדרך המהירה ביותר. טען קובץ מוכן והמערכת תקים הכל בשניות.
                                        </p>
                                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 w-fit px-4 py-2 rounded-xl relative z-10 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                            <span>העלה קובץ</span>
                                            <ArrowLeft size={16} weight="bold" />
                                        </div>
                                    </button>
                                </div>
                            </div>
                        ) : step === 'claim_profile' ? (
                            <div className="max-w-lg mx-auto h-full flex flex-col pt-4 animate-in fade-in slide-in-from-right-8 duration-500">
                                <div className="text-center md:text-right mb-8">
                                    <h2 className="text-3xl font-black text-slate-900 mb-3">זהו אתם?</h2>
                                    <p className="text-slate-500 text-lg">כדי לסיים, סמנו את הכרטיס שלכם ברשימה.</p>
                                </div>

                                <div className="relative mb-6">
                                    <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} weight="bold" />
                                    <input
                                        type="text"
                                        placeholder="חיפוש לפי שם..."
                                        value={claimSearchTerm}
                                        onChange={e => setClaimSearchTerm(e.target.value)}
                                        className="w-full h-12 pr-12 pl-4 rounded-xl bg-slate-50 border border-slate-200 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all font-bold text-base"
                                    />
                                </div>

                                <div className="flex-1 border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm flex flex-col min-h-0">
                                    <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
                                        {createdPeople.length === 0 && (
                                            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-2"><Users size={24} weight="duotone" className="opacity-50" /></div>
                                                לא נמצאו אנשים. <br />האם הוספתם מישהו?
                                            </div>
                                        )}
                                        {createdPeople
                                            .filter(p => p.name.toLowerCase().includes(claimSearchTerm.toLowerCase()))
                                            .map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => setSelectedClaimPerson(p)}
                                                    className={`w-full p-3 rounded-xl text-right flex items-center justify-between transition-all group ${selectedClaimPerson?.id === p.id
                                                        ? 'bg-emerald-50 border border-emerald-200 shadow-sm'
                                                        : 'hover:bg-slate-50 border border-transparent'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-sm shadow-black/10 transition-transform group-hover:scale-105 ${p.color?.replace('border-', 'bg-') || 'bg-slate-400'}`}>
                                                            {p.name.slice(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className={`font-bold text-base ${selectedClaimPerson?.id === p.id ? 'text-slate-900' : 'text-slate-700'}`}>{p.name}</div>
                                                            <div className="text-xs text-slate-400 font-mono mt-0.5">{p.email || 'ללא אימייל'}</div>
                                                        </div>
                                                    </div>
                                                    {selectedClaimPerson?.id === p.id && (
                                                        <div className="bg-emerald-500 text-white rounded-full p-1 shadow-sm animate-in zoom-in duration-200">
                                                            <CheckCircle size={16} weight="bold" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                    </div>
                                </div>

                                <button
                                    onClick={handleClaimProfile}
                                    disabled={!selectedClaimPerson || loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-14 rounded-2xl mt-6 transition-all shadow-xl shadow-slate-900/10 hover:shadow-slate-900/20 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                                >
                                    {loading ? <Loader2 className="animate-spin" size={24} /> :
                                        <>
                                            סיום וכניסה
                                            <Sparkles size={20} weight="duotone" className="text-amber-400" />
                                        </>}
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            }
        />
    );
};
