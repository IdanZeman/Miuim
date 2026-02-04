import React, { useState, useEffect } from 'react';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { useAuth } from './AuthContext';
import { Buildings as Building2, Envelope as Mail, CheckCircle, Sparkle as Sparkles, Shield, FileXls as FileSpreadsheet, UploadSimple as Upload, ArrowLeft, Users, MagnifyingGlass as Search, CircleNotch, CircleNotchIcon, ArrowLeftIcon, Link as LinkIcon } from '@phosphor-icons/react';
import { analytics } from '../../services/analytics';
import { useToast } from '../../contexts/ToastContext';
import { ExcelImportWizard } from '../personnel/ExcelImportWizard';
import { Person, Team, Role } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../services/loggingService';
import { createBattalion } from '../../services/battalionService';
import { authService } from '../../services/authService';
import { organizationService } from '../../services/organizationService';
import { personnelService } from '../../services/personnelService';

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
    const [entityType, setEntityType] = useState<'organization' | 'battalion'>('organization');
    const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingInvite, setCheckingInvite] = useState(true);
    const [pendingInvite, setPendingInvite] = useState<any>(null);
    const [inviteCode, setInviteCode] = useState('');
    const [isJoiningWithCode, setIsJoiningWithCode] = useState(false);
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
                await authService.acceptTerms(user.id, timestamp);
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
            const invite = await organizationService.checkPendingInvite(user.email);
            if (invite) {
                setPendingInvite(invite);
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
            await organizationService.acceptInvite(user.id, pendingInvite.organization_id, pendingInvite.template_id || null);
            await organizationService.markInviteAccepted(pendingInvite.id);
            await refreshProfile();
        } catch (error) {
            console.error('Error accepting invite:', error);
            showToast('שגיאה בקבלת ההזמנה. אנא נסה שוב.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleJoinWithCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteCode.trim()) return;

        setIsJoiningWithCode(true);
        setError('');
        try {
            const orgName = await organizationService.getOrgNameByToken(inviteCode.trim());
            if (!orgName) {
                setError('קוד לא תקין או שפג תוקפו');
                return;
            }

            // Redirect to join page with this token
            window.location.href = `/join/${inviteCode.trim()}`;
        } catch (err) {
            setError('שגיאה באימות הקוד');
        } finally {
            setIsJoiningWithCode(false);
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
            const org = await organizationService.createOrganization(orgName);
            setCreatedOrgId(org.id);
            analytics.trackSignup(orgName);
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

    const handleCreateBattalion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgName.trim()) return;

        setLoading(true);
        try {
            // Pass the org name as the second parameter - it will create the org if needed
            await createBattalion(orgName.trim(), orgName.trim());
            analytics.trackSignup(orgName);
            // Battalion created, organization created/updated, and profile linked. Reload.
            await refreshProfile();
            window.location.reload();
        } catch (error) {
            console.error('Error creating battalion:', error);
            setError('שגיאה ביצירת הגדוד');
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
                await authService.updateProfile(user.id, {
                    organization_id: createdOrgId,
                    permissions: { "screens": { "logs": "edit", "stats": "edit", "tasks": "edit", "lottery": "edit", "dashboard": "edit", "equipment": "edit", "personnel": "edit", "attendance": "edit", "constraints": "edit", "settings": "edit", "reports": "edit" }, "dataScope": "organization" }
                });
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
    const handleAddTeam = async (team: Team) => {
        setLocalTeams(prev => [...prev, team]);
        return Promise.resolve();
    };

    const handleAddRole = async (role: Role) => {
        setLocalRoles(prev => [...prev, role]);
        return Promise.resolve();
    };

    const handleFinalImport = async (people: Person[], newTeams: Team[] = [], newRoles: Role[] = []) => {
        if (!createdOrgId) return;
        setLoading(true);

        try {
            // 1. Link User to Organization FIRST (to satisfy RLS)
            if (user) {
                await authService.updateProfile(user.id, {
                    organization_id: createdOrgId,
                    permissions: { "screens": { "logs": "edit", "stats": "edit", "tasks": "edit", "lottery": "edit", "dashboard": "edit", "equipment": "edit", "personnel": "edit", "attendance": "edit", "constraints": "edit", "settings": "edit", "reports": "edit" }, "dataScope": "organization" }
                });
            }

            // 2. Process Bulk Import
            const insertedPeople = await personnelService.processOnboardingImport(
                createdOrgId,
                people,
                [...localTeams, ...newTeams],
                [...localRoles, ...newRoles]
            );

            setCreatedPeople(insertedPeople);
            showToast('הייבוא הושלם בהצלחה! כעת בחר מי אתה מהרשימה.', 'success');
            setStep('claim_profile');

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
            await personnelService.updatePerson({ ...selectedClaimPerson, user_id: user.id });
            // NOW we finish
            await refreshProfile();
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
        return <DashboardSkeleton />;
    }

    if (checkingInvite) {
        return <DashboardSkeleton />;
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
                                    <Mail size={40} className="text-amber-400" weight="bold" />
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
                                            <Building2 size={24} className="text-slate-900" weight="bold" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ארגון</p>
                                            <h3 className="text-2xl font-black text-slate-900">{pendingInvite.organizations?.name || 'ארגון'}</h3>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-2xl p-6 border border-slate-200 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Shield size={20} className="text-amber-500" weight="bold" />
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
                                            <CircleNotch size={24} className="animate-spin text-white" weight="bold" />
                                        ) : (
                                            <>
                                                <CheckCircle size={24} weight="bold" />
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
                        aria-label="התנתק מהמערכת"
                    >
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">התנתק</span>
                        <div className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                        </div>
                    </button>
                </div>
            </header>

            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-0 md:p-12">
                <div className="bg-white md:rounded-[2.5rem] shadow-2xl max-w-5xl w-full overflow-hidden border-0 md:border border-slate-200/60 flex flex-col md:flex-row h-full md:h-auto">

                    {/* Dark Side Branding (Mobile Top, Desktop Left/Sidebar) */}
                    <div className={`w-full md:w-[400px] h-[30vh] md:h-auto p-6 md:p-12 text-white flex flex-col justify-between relative overflow-hidden shrink-0 transition-colors duration-500 ${entityType === 'battalion' ? 'bg-blue-600' : 'bg-emerald-900'
                        }`}>
                        {/* Decorative background elements */}
                        <div className={`absolute top-0 right-0 w-64 h-64 opacity-[0.1] rounded-full -translate-y-1/2 translate-x-1/2 transition-colors duration-500 ${entityType === 'battalion' ? 'bg-blue-300' : 'bg-emerald-400'
                            }`} aria-hidden="true"></div>
                        <div className={`absolute bottom-0 left-0 w-32 h-32 opacity-[0.1] rounded-full translate-y-1/2 -translate-x-1/2 transition-colors duration-500 ${entityType === 'battalion' ? 'bg-sky-400' : 'bg-teal-400'
                            }`} aria-hidden="true"></div>

                        <div className="relative z-10 flex flex-col h-full justify-center md:justify-start">
                            <div className="flex items-center gap-4 mb-2 md:mb-8">
                                <div className={`w-10 h-10 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center border border-white/10 shrink-0 transition-colors duration-500`}>
                                    <Shield size={20} className={`md:w-8 md:h-8 transition-colors duration-500 ${entityType === 'battalion' ? 'text-blue-300' : 'text-emerald-400'
                                        }`} aria-hidden="true" weight="bold" />
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
                            <div className={`flex items-center gap-4 text-sm font-bold uppercase tracking-widest p-4 rounded-2xl border transition-colors duration-500 ${entityType === 'battalion'
                                ? 'text-blue-200 bg-blue-950/30 border-blue-400/20'
                                : 'text-emerald-200 bg-emerald-950/30 border-emerald-500/20'
                                }`}>
                                <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${entityType === 'battalion' ? 'bg-blue-400' : 'bg-emerald-400'
                                    }`}></span>
                                {step === 'org_name' ? 'שלב 1: פרטי ארגון' : 'שלב 2: בחירת מסלול'}
                            </div>
                        </div>
                    </div>

                    {/* Content Section - The "White Sheet" */}
                    <div className="flex-1 p-6 md:p-16 bg-white rounded-t-3xl -mt-6 md:mt-0 relative z-20 flex flex-col animate-in slide-in-from-bottom-6 duration-500">
                        {/* Mobile Step Indicator */}
                        <div className="md:hidden flex justify-center -mt-3 mb-6">
                            <div className={`bg-white shadow-lg border border-slate-100 text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full flex items-center gap-2 transition-colors duration-500 ${entityType === 'battalion' ? 'text-blue-700' : 'text-emerald-800'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${entityType === 'battalion' ? 'bg-blue-500' : 'bg-emerald-500'
                                    }`}></span>
                                {step === 'org_name' ? 'שלב 1: פרטי ארגון' : 'שלב 2: בחירת מסלול'}
                            </div>
                        </div>

                        {step === 'org_name' ? (
                            <div className="max-w-xl mx-auto space-y-6 md:space-y-10">
                                <div>
                                    <h2 className="text-xl md:text-3xl font-black text-slate-800 mb-2 md:mb-4">איך תרצו לקרוא לארגון?</h2>
                                    <p className="text-slate-500 text-base md:text-lg">שם הפלוגה, הגדוד או היחידה שלך.</p>
                                </div>

                                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6 mb-2">
                                    <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                                        <LinkIcon size={18} weight="bold" />
                                        קיבלת קוד הצטרפות?
                                    </h3>
                                    <form onSubmit={handleJoinWithCode} className="flex gap-2">
                                        <input
                                            type="text"
                                            value={inviteCode}
                                            onChange={(e) => setInviteCode(e.target.value)}
                                            placeholder="הזן קוד כאן..."
                                            className="flex-1 px-4 py-2 rounded-xl bg-white border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                                        />
                                        <button
                                            type="submit"
                                            disabled={isJoiningWithCode || !inviteCode.trim()}
                                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-2 rounded-xl transition-all disabled:opacity-50"
                                        >
                                            {isJoiningWithCode ? <CircleNotch className="animate-spin" /> : 'הצטרף'}
                                        </button>
                                    </form>
                                    {error && inviteCode && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-slate-200"></div>
                                    </div>
                                    <div className="relative flex justify-center text-sm">
                                        <span className="px-2 bg-white text-slate-400 font-bold">או צור ארגון חדש</span>
                                    </div>
                                </div>

                                <form onSubmit={entityType === 'organization' ? handleCreateOrg : handleCreateBattalion} className="space-y-6 md:space-y-8 flex-1 flex flex-col">
                                    <div className="flex gap-4 p-1 bg-slate-100/80 rounded-xl">
                                        <button
                                            type="button"
                                            onClick={() => setEntityType('organization')}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${entityType === 'organization' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            פלוגה
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEntityType('battalion')}
                                            className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${entityType === 'battalion' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            גדוד
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="relative">
                                            <Building2 className={`absolute right-5 top-1/2 -translate-y-1/2 ${entityType === 'organization' ? 'text-emerald-500' : 'text-blue-500'}`} size={24} weight="bold" />
                                            <input
                                                type="text"
                                                value={orgName}
                                                onChange={handleOrgNameChange}
                                                placeholder={entityType === 'organization' ? "שם הארגון..." : "שם הגדוד..."}
                                                className={`w-full pr-14 pl-4 py-4 md:pl-6 md:py-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:bg-white focus:outline-none text-xl md:text-2xl transition-all font-bold placeholder:font-normal placeholder:text-slate-300 shadow-inner ${entityType === 'organization' ? 'focus:border-emerald-500' : 'focus:border-blue-500'}`}
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
                                        className={`w-full text-white font-black py-4 md:py-5 px-8 rounded-2xl transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-4 text-lg md:text-xl disabled:opacity-50 disabled:translate-y-0 active:scale-95 ${entityType === 'organization'
                                            ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 hover:shadow-emerald-600/40'
                                            : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20 hover:shadow-blue-600/40'
                                            }`}
                                        aria-label="יצירת ארגון והמשך לשלב הבא"
                                    >
                                        {entityType === 'organization' ? 'יצירת ארגון והמשך' : 'יצירת גדוד'}
                                        {loading ? <CircleNotchIcon size={24} className="animate-spin text-white" weight="bold" /> : <ArrowLeftIcon size={24} aria-hidden="true" weight="bold" />}
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
                                        people={[]} // No existing people in new org
                                        onAddTeam={handleAddTeam}
                                        onAddRole={handleAddRole}
                                        isSaving={loading}
                                    />
                                )}

                                <div className="text-center md:text-right">
                                    <h2 className="text-3xl font-black text-slate-900 mb-4">איך תרצו להזין את החיילים בארגון שלכם?</h2>
                                    <p className="text-slate-500 text-lg">יש שתי דרכים להתחיל. בחר את המתאימה לך ביותר.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Path 1: Manual */}
                                    <button
                                        onClick={() => handleSelectPath(false)}
                                        disabled={loading}
                                        className="flex flex-col text-right bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 hover:border-slate-900 hover:shadow-2xl transition-all group relative"
                                        aria-label="בחירה במסלול הקמה ידנית"
                                    >
                                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm" aria-hidden="true">
                                            <Users size={28} weight="bold" />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 mb-3">הקמה ידנית</h3>
                                        <p className="text-slate-500 leading-relaxed mb-8 flex-1">
                                            להתחיל מאפס. הוספת צוותים וחיילים אחד-אחד דרך הממשק. מעולה ליחידות קטנות או לדיוק מקסימלי.
                                        </p>
                                        <div className="flex items-center gap-2 text-slate-900 font-black group-hover:translate-x-[-10px] transition-transform">
                                            <span>התחל הקמה</span>
                                            <ArrowLeft size={20} aria-hidden="true" weight="bold" />
                                        </div>
                                    </button>

                                    {/* Path 2: Import */}
                                    <button
                                        onClick={() => handleSelectPath(true)}
                                        disabled={loading}
                                        className="flex flex-col text-right bg-white border border-slate-200 rounded-[2rem] p-6 md:p-8 hover:border-amber-500 hover:shadow-2xl transition-all group relative"
                                        aria-label="בחירה במסלול ייבוא מאקסל"
                                    >
                                        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-900 transition-all shadow-sm" aria-hidden="true">
                                            <Upload size={28} weight="bold" />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 mb-3">ייבוא מאקסל</h3>
                                        <p className="text-slate-500 leading-relaxed mb-8 flex-1">
                                            יש לכם כבר רשימות? העלו קובץ CSV/Excel והמערכת תבנה את הכל עבורכם בשניות. הכי מהיר.
                                        </p>
                                        <div className="flex items-center gap-2 text-amber-600 font-black group-hover:translate-x-[-10px] transition-transform">
                                            <span>להעלאת קובץ</span>
                                            <ArrowLeft size={20} aria-hidden="true" weight="bold" />
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
                                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} weight="bold" />
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
                                                {selectedClaimPerson?.id === p.id && <CheckCircle size={24} className="text-slate-900" weight="bold" />}
                                            </button>
                                        ))}
                                </div>

                                <button
                                    onClick={handleClaimProfile}
                                    disabled={!selectedClaimPerson || loading}
                                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-5 px-8 rounded-2xl mt-6 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? <CircleNotch size={24} className="animate-spin text-white" weight="bold" /> : <Sparkles size={24} weight="bold" />}
                                    סיום וכניסה למערכת
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div >
    );
};
