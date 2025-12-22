import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile, Organization, ViewMode, AccessLevel, UserPermissions } from '../types';
import { analytics } from '../services/analytics';

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

    // Always allow home and contact for authenticated users
    if (screen === 'home' || screen === 'contact') return true;

    // Super Admin has access to everything
    if (profile.is_super_admin) return true;

    // 1. Check Custom Permissions Override (New RBAC)
    if (profile.permissions?.screens) {
      const level = profile.permissions.screens[screen];
      if (level) {
        if (level === 'none') return false;
        if (requiredLevel === 'edit' && level !== 'edit') return false;
        return true;
      }
    }

    // 2. Fallback to Role-Based Defaults (Backward Compatibility)
    if (screen === 'system' || screen === 'logs') return false;

    const role = profile.role;
    if (role === 'admin') return true;

    if (role === 'editor') {
      if (screen === 'settings') return false;
      return true; // editors can edit everything else
    }

    if (role === 'viewer') {
      if (requiredLevel === 'edit') return false;
      return ['dashboard', 'stats', 'lottery', 'equipment'].includes(screen);
    }

    if (role === 'attendance_only') {
      if (screen === 'attendance') return true;
      if (screen === 'dashboard' && requiredLevel === 'view') return true;
      return false;
    }

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
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data: profileData, error: profileError } = await Promise.race([
        dbPromise,
        timeoutPromise
      ]) as any;

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('⚠️ Error fetching profile:', profileError);
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
            role: existingPerson ? 'viewer' : 'admin',
            organization_id: existingPerson?.organization_id || null,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating profile:', insertError);
          setProfile(null);
          return;
        }

        if (existingPerson) {
          await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);
        }

        console.log('✅ Profile created successfully');
        setProfile(newProfile);
        return;
      }

      console.log('✅ Profile loaded successfully');

      if (!profileData.organization_id) {
        // Fetch fresh user data to get phone
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || profileData.email;
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
            .select()
            .single();

          if (!updateError) {
            setProfile(updatedProfile);
            await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);

            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', existingPerson.organization_id)
              .single();
            setOrganization(orgData);
            return;
          }
        }
      }

      setProfile(profileData);

      if (profileData.organization_id) {
        try {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single();

          if (orgError) {
            console.error('⚠️ Error fetching organization:', orgError);
            setOrganization(null);
          } else {
            console.log('✅ Organization loaded successfully');
            setOrganization(orgData);
          }
        } catch (orgErr) {
          console.error('⚠️ Unexpected error fetching organization:', orgErr);
          setOrganization(null);
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
    } finally {
      setIsFetchingProfile(false);
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
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    let authChangeTimeout: NodeJS.Timeout | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state changed:', event);

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
      return { data: null, error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      analytics.trackLogout();

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
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;

      // Clear state
      setUser(null);
      setProfile(null);
      setOrganization(null);
    } catch (error) {
      analytics.trackError((error as Error).message, 'Logout');
      console.error('Error signing out:', error);
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
