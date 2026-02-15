import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../services/supabaseClient';
import { Profile, Organization, ViewMode, AccessLevel, UserPermissions } from '../../types';
import { analytics } from '../../services/analytics';
import { logger } from '../../services/loggingService';
import { authService } from '../../services/authService';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkAccess: (screen: ViewMode, requiredLevel?: 'view' | 'edit') => boolean;
  isFetchingProfile: boolean;
  leaveOrganization: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  // Use ref to track user state for use in closures
  const userRef = React.useRef<User | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const checkAccess = (screen: ViewMode, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    if (!profile) return false;

    // Map battalion views to 'battalion' permission
    let permissionKey: any = screen;

    if (screen === 'battalion-home' || screen === 'battalion-personnel' || screen === 'battalion-attendance' || screen === 'battalion-settings') {
      permissionKey = 'battalion';
    } else if (screen === 'org-logs') {
      permissionKey = 'logs'; // Legacy support: map org-logs screen to 'logs' permission
    }


    // 0. Essential screens available to EVERYONE authenticated
    const publicScreens: ViewMode[] = ['home', 'faq', 'contact'];
    if (publicScreens.includes(screen)) return true;

    // 1. Super Admin has access to everything - BYPASS ALL RESTRICTIONS
    if (profile.is_super_admin) return true;

    // 1. Battalion Context Restriction - STRICT
    // If organization is a battalion/HQ, we MUST restrict access to only meaningful screens.
    // This overrides any role permissions (e.g. an "Admin" role in a battalion shouldn't see "Company Dashboard")
    // It also overrides Super Admin "God Mode" for UX clarity - if the screen is irrelevant, hide it.
    if (organization?.org_type === 'battalion' || organization?.is_hq) {
      const allowedForBattalion: ViewMode[] = ['home', 'contact', 'faq', 'battalion', 'battalion-home', 'battalion-personnel', 'battalion-attendance', 'battalion-settings', 'reports', 'settings'];
      if (!allowedForBattalion.includes(screen)) return false;
    }

    // 2. Check Custom Permissions Override (New RBAC)
    if (profile.permissions?.screens) {
      const level = profile.permissions.screens[permissionKey];
      if (level) {
        if (level === 'none') return false;
        if (requiredLevel === 'edit' && level !== 'edit') return false;
        return true;
      }
    }

    // Default to false if no permission granted
    return false;
  };

  const fetchProfile = async (userId: string, force = false) => {
    if (isFetchingProfile && !force) {
      return;
    }

    setIsFetchingProfile(true);

    try {
      const result = await authService.fetchProfile(userId);

      if (!result) {
        setProfile(null);
        setOrganization(null);
        return;
      }

      const { profile: cleanProfile, organization: orgData } = result;

      // Update logger context
      logger.setUser({ id: userId, email: cleanProfile.email }, cleanProfile, orgData?.name);

      // Identify user in LogRocket
      if (cleanProfile?.email) {
        import('../../services/logRocket').then(({ identifyUser }) => {
          identifyUser({
            id: userId,
            email: cleanProfile.email,
            name: cleanProfile.full_name || cleanProfile.email,
            role: cleanProfile.is_super_admin ? 'super_admin' : 'user'
          });
        });
      }

      setProfile(cleanProfile);
      setOrganization(orgData);

    } catch (error) {
      console.error('❌ Unexpected error in fetchProfile:', error);
      if (analytics && typeof (analytics as any).trackError === 'function') {
        (analytics as any).trackError((error as Error).message, 'FetchProfile');
      }
      logger.error('ERROR', 'Unexpected error in fetchProfile', error);
    } finally {
      setIsFetchingProfile(false);
      // Log successful login activity
      if (organization?.id) {
        logger.logLogin(userId);
      }
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id, true);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async (retries = 3) => {
      try {
        const fetchSessionPromise = supabase.auth.getSession();

        const timeoutPromise = new Promise<{ data: { session: null }; timeout: boolean }>((resolve) => {
          setTimeout(() => {
            resolve({ data: { session: null }, timeout: true });
          }, 10000); // Reduced timeout to fail faster if stuck
        });

        const result: any = await Promise.race([
          fetchSessionPromise,
          timeoutPromise
        ]);

        let session = result.data?.session;

        // If timed out or no session, try getUser as a robust fallback
        if (result.timeout || !session) {

          const fetchUserPromise = supabase.auth.getUser();
          const userTimeoutPromise = new Promise<{ data: { user: null }; error: any }>((resolve) => {
            setTimeout(() => {
              resolve({ data: { user: null }, error: { message: "Timeout" } });
            }, 10000);
          });

          const userResult: any = await Promise.race([
            fetchUserPromise,
            userTimeoutPromise
          ]);

          const { user } = userResult.data || {};
          const error = userResult.error;

          if (user && !error) {
            if (!mounted) return;
            setUser(user);
            await fetchProfile(user.id);
            return; // Done
          }
        }

        if (!mounted) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
          setOrganization(null);
        }
      } catch (error: any) {
        // Handle AbortError caused by Supabase lock acquisition issues (race condition)
        if (error.name === 'AbortError' && retries > 0) {
          console.warn(`Init auth aborted (Supabase lock issue). Retrying... (${retries} attempts left)`);
          setTimeout(() => initAuth(retries - 1), 500);
          return;
        }

        console.error('Init auth error:', error);
        logger.error('AUTH', 'Authentication initialization error', error);
      } finally {
        // Only set loading to false if we are not retrying
        if (mounted && (loading || retries <= 0)) setLoading(false);
      }
    };

    initAuth();

    let authChangeTimeout: NodeJS.Timeout | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;


      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }

      authChangeTimeout = setTimeout(async () => {
        const currentUser = session?.user ?? null;
        // Use ref to compare with current state instead of closure-captured state
        const currentUserState = userRef.current;

        if (currentUser?.id !== currentUserState?.id) {
          setUser(currentUser);

          if (currentUser) {
            await fetchProfile(currentUser.id);
          } else {
            setProfile(null);
            setOrganization(null);
          }
        } else {
        }
      }, 300);
    });

    return () => {
      mounted = false;
      if (authChangeTimeout) clearTimeout(authChangeTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authService.signIn(email, password);
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const result = await authService.signUp(email, password, fullName);
      return { data: result.data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      // Log logout activity before clearing state
      if (organization?.id) {
        logger.logLogout();
      }

      // Clear all auth-related storage to prevent auto-login
      if (typeof window !== 'undefined') {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });
        localStorage.removeItem('miuim_active_view');
      }

      await authService.signOut();

      // Clear state
      setUser(null);
      setProfile(null);
      setOrganization(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  const leaveOrganization = async () => {
    if (!user) return;
    try {
      setLoading(true);
      await authService.leaveOrganization(user.id);

      setProfile(prev => prev ? {
        ...prev,
        organization_id: null,
        permission_template_id: null,
        permissions: { dataScope: 'personal', screens: {} }
      } : null);
      setOrganization(null);
    } catch (error) {
      console.error('Error leaving organization:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, signOut, refreshProfile, checkAccess, isFetchingProfile, leaveOrganization }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
