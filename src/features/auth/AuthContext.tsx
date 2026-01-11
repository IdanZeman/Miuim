import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../../services/supabaseClient';
import { Profile, Organization, ViewMode, AccessLevel, UserPermissions } from '../../types';
import { analytics } from '../../services/analytics';
import { logger } from '../../services/loggingService';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  checkAccess: (screen: ViewMode, requiredLevel?: 'view' | 'edit') => boolean;
  isFetchingProfile: boolean;
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
    const permissionKey = screen === 'battalion-home' || screen === 'battalion-personnel' || screen === 'battalion-attendance' || screen === 'battalion-settings' ? 'battalion' :
      screen;


    // Super Admin has access to everything
    if (profile.is_super_admin) return true;

    // 1. Check Custom Permissions Override (New RBAC)
    if (profile.permissions?.screens) {
      const level = profile.permissions.screens[permissionKey];
      if (level) {
        if (level === 'none') return false;
        if (requiredLevel === 'edit' && level !== 'edit') return false;
        return true;
      }
    }

    // Always allow home, dashboard, contact, faq, and gate for authenticated users (VIEW level only)
    // if not explicitly overridden by permissions above
    if (requiredLevel === 'view' && ['home', 'dashboard', 'contact', 'faq', 'gate', 'lottery'].includes(screen)) return true;

    // Default to false if no permission granted
    return false;
  };

  const fetchProfile = async (userId: string, force = false) => {
    if (isFetchingProfile && !force) {
      console.log('⏭️ Profile fetch already in progress, skipping...');
      return;
    }

    setIsFetchingProfile(true);

    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout - check your connection')), 15000)
      );

      const dbPromise = supabase
        .from('profiles')
        .select('*, organizations(*)')
        .eq('id', userId)
        .maybeSingle();

      const { data: profileData, error: profileError } = await Promise.race([
        dbPromise,
        timeoutPromise
      ]) as any;

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('⚠️ Error fetching profile:', profileError);
        logger.error('ERROR', 'Failed to fetch user profile', profileError);
        return;
      }

      if (!profileData) {
        console.log('📝 No profile found, creating new profile...');
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const phone = userData?.user?.phone || '';
        const fullName = userData?.user?.user_metadata?.full_name ||
          userData?.user?.user_metadata?.name ||
          email.split('@')[0] || phone;

        let query = supabase.from('people').select('organization_id, id');

        if (email && phone) {
          query = query.or(`email.eq.${email},phone.eq.${phone}`);
        } else if (email) {
          query = query.eq('email', email);
        } else if (phone) {
          query = query.eq('phone', phone);
        } else {
          // Should not happen, but safe fallback
          query = query.eq('email', 'impossible-placeholder');
        }

        const { data: existingPerson } = await query.maybeSingle();

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            full_name: fullName,
            // role: 'viewer', // REMOVED
            permissions: {
              dataScope: 'personal',
              screens: {},
              canApproveRequests: false,
              canManageRotaWizard: false
            },
            organization_id: existingPerson?.organization_id || null,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select('*, organizations(*)')
          .single();

        if (insertError) {
          console.error('❌ Error creating profile:', insertError);
          logger.error('CREATE', 'Failed to create new user profile', insertError);
          setProfile(null);
          return;
        }

        if (existingPerson) {
          await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);
        }

        console.log('✅ Profile created successfully');
        const { organizations: newOrgData, ...cleanNewProfile } = newProfile;

        console.log('👤 [AuthContext] Setting Profile:', cleanNewProfile);
        setProfile(cleanNewProfile);
        // New profiles usually don't have orgs, but if upsert linked it, we set it:
        if (newOrgData) setOrganization(newOrgData);

        return;
      }

      console.log('✅ Profile loaded successfully');

      const { organizations: orgData, ...cleanProfile } = profileData;
      console.log('📊 [AuthContext] Full Profile Data:', cleanProfile);
      console.log('👤 [AuthContext] Setting Profile:', cleanProfile);

      // Update logger context
      logger.setUser({ id: userId, email: cleanProfile.email }, cleanProfile);

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

      if (!cleanProfile.organization_id) {
        // Fetch fresh user data to get phone
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || cleanProfile.email;
        const phone = userData?.user?.phone || '';

        let query = supabase.from('people').select('organization_id, id');

        if (email && phone) {
          query = query.or(`email.eq.${email},phone.eq.${phone}`);
        } else if (email) {
          query = query.eq('email', email);
        } else if (phone) {
          query = query.eq('phone', phone);
        } else {
          query = query.eq('email', 'impossible-placeholder');
        }

        const { data: existingPerson } = await query.maybeSingle();

        if (existingPerson) {
          console.log('🔗 Found matching person, linking profile to organization...');
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ organization_id: existingPerson.organization_id })
            .eq('id', userId)
            .select('*, organizations(*)')
            .single();

          if (!updateError && updatedProfile) {
            const { organizations: updatedOrg, ...cleanUpdatedProfile } = updatedProfile;

            console.log('👤 [AuthContext] Setting Profile (after link):', cleanUpdatedProfile);
            setProfile(cleanUpdatedProfile);
            await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);

            // Set organization from the join
            if (updatedOrg) {
              setOrganization(updatedOrg);
            } else {
              // Fallback fetch if join failed for some reason
              const { data: manualOrg } = await supabase
                .from('organizations')
                .select('*')
                .eq('id', existingPerson.organization_id)
                .single();
              setOrganization(manualOrg);
            }
            return;
          }
        }
      }

      console.log('👤 [AuthContext] Setting Profile (final):', cleanProfile);
      setProfile(cleanProfile);

      if (cleanProfile.organization_id) {
        if (orgData) {
          console.log('✅ Organization loaded with profile (Optimized)');
          setOrganization(orgData);
        } else {
          // Fallback if join wasn't populated (unexpected)
          console.warn('⚠️ Organization ID present but join failed, fetching manually');
          try {
            const { data: manualOrg } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', cleanProfile.organization_id)
              .single();
            setOrganization(manualOrg);
          } catch (e) {
            console.error('Error in manual fallback fetch', e);
            logger.error('ERROR', 'Manual fallback organization fetch failed', e);
            setOrganization(null);
          }
        }
      } else {
        setOrganization(null);
      }
    } catch (error) {
      console.error('❌ Unexpected error in fetchProfile:', error);
      console.log('⚠️ Keeping existing profile data due to fetch error');

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

    const initAuth = async () => {
      try {
        const fetchSessionPromise = supabase.auth.getSession();

        const timeoutPromise = new Promise<{ data: { session: null }; timeout: boolean }>((resolve) => {
          setTimeout(() => {
            resolve({ data: { session: null }, timeout: true });
          }, 40000);
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
      } catch (error) {
        console.error('Init auth error:', error);
        logger.error('AUTH', 'Authentication initialization error', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    let authChangeTimeout: NodeJS.Timeout | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state changed:', event);
      console.log('📦 [AuthContext] Current pending_invite_token in localStorage:', localStorage.getItem('pending_invite_token'));

      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }

      authChangeTimeout = setTimeout(async () => {
        const currentUser = session?.user ?? null;
        // Use ref to compare with current state instead of closure-captured state
        const currentUserState = userRef.current;

        if (currentUser?.id !== currentUserState?.id) {
          console.log('👤 User changed, updating...');
          setUser(currentUser);

          if (currentUser) {
            await fetchProfile(currentUser.id);
          } else {
            setProfile(null);
            setOrganization(null);
          }
        } else {
          console.log('✅ User unchanged, skipping profile fetch');
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
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      analytics.trackLogin('email');
      return { data, error: null };
    } catch (error) {
      analytics.trackError((error as Error).message, 'Login');
      logger.error('LOGIN', 'Email sign-in failed', error);
      return { data: null, error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          }
        }
      });

      if (error) throw error;

      analytics.trackSignup('email');
      return { data, error: null };
    } catch (error) {
      analytics.trackError((error as Error).message, 'Signup');
      logger.error('SIGNUP', 'Email sign-up failed', error);
      return { data: null, error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      analytics.trackLogout();

      // Log logout activity before clearing state
      if (organization?.id) {
        logger.logLogout();
      }

      // Clear all auth-related storage to prevent auto-login
      if (typeof window !== 'undefined') {
        // Clear Supabase session from localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key);
          }
        });

        // Clear app-specific storage
        localStorage.removeItem('miuim_active_view');
      }

      // Sign out with 'local' scope to clear local session only
      logger.clearUser();
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;

      // Clear state
      setUser(null);
      setProfile(null);
      setOrganization(null);
    } catch (error) {
      analytics.trackError((error as Error).message, 'Logout');
      console.error('Error signing out:', error);
      logger.error('LOGOUT', 'Sign-out failed', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, signOut, refreshProfile, checkAccess, isFetchingProfile }}>
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
