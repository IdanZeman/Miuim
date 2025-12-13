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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const checkAccess = (screen: ViewMode, requiredLevel: 'view' | 'edit' = 'view'): boolean => {
    if (!profile) return false;

    // 1. Check Custom Permissions Override
    if (profile.permissions && profile.permissions.screens) {
      const access = profile.permissions.screens[screen] || 'view'; // Default to view if not specified but permissions object exists? 
      // Actually, if permissions object exists, we should rely on it.
      // But standard default is determined by Logic below.
      // Let's refine: If specific screen permission IS set, use it.
      if (profile.permissions.screens[screen]) {
        const level = profile.permissions.screens[screen];
        if (level === 'none') return false;
        if (requiredLevel === 'edit' && level !== 'edit') return false;
        return true;
      }
    }

    // 2. Fallback to Role-Based Defaults
    const role = profile.role;
    if (role === 'admin') return true; // Admin can do everything by default

    if (role === 'attendance_only') {
      return screen === 'attendance';
    }

    if (role === 'viewer') {
      if (requiredLevel === 'edit') return false; // Viewers can't edit anything by default
      return true; // Can view everything
    }

    if (role === 'editor') {
      // Editors restricted from Settings/Admin stuff usually?
      if (screen === 'settings') return false;
      return true;
    }

    return false;
  };

  const fetchProfile = async (userId: string, force = false) => {
    // Prevent concurrent fetches unless forced
    if (isFetchingProfile && !force) {
      console.log('⏭️ Profile fetch already in progress, skipping...');
      return;
    }

    setIsFetchingProfile(true);

    try {
      // Increase timeout to 15 seconds (more generous)
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
        // Don't clear profile on error - keep existing
        return;
      }

      if (!profileData) {
        console.log('📝 No profile found, creating new profile...');
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const fullName = userData?.user?.user_metadata?.full_name ||
          userData?.user?.user_metadata?.name ||
          email.split('@')[0];

        // Try to find existing person with this email to link organization
        const { data: existingPerson } = await supabase
          .from('people')
          .select('organization_id, id')
          .eq('email', email)
          .maybeSingle();

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            full_name: fullName,
            role: existingPerson ? 'viewer' : 'admin', // Default to viewer if joining existing org
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

        // If we found a person, link the user_id to that person record
        if (existingPerson) {
          await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);
        }

        console.log('✅ Profile created successfully');
        setProfile(newProfile);
        return;
      }

      console.log('✅ Profile loaded successfully');

      // Check if we need to link to a person (if organization_id is missing or just to be safe)
      if (!profileData.organization_id) {
        const { data: existingPerson } = await supabase
          .from('people')
          .select('organization_id, id')
          .eq('email', profileData.email)
          .maybeSingle();

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
            // Also link the person record to this user
            await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);

            // Fetch organization immediately
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
      // Don't clear profile on timeout - keep existing data
      console.log('⚠️ Keeping existing profile data due to fetch error');

      // Track error in analytics if available
      if (analytics && typeof analytics.trackError === 'function') {
        analytics.trackError((error as Error).message, 'FetchProfile');
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
        // Strategy: Try getSession with a timeout. If it times out, try getUser (server verification).

        const fetchSessionPromise = supabase.auth.getSession();

        const timeoutPromise = new Promise<{ data: { session: null }; timeout: boolean }>((resolve) => {
          setTimeout(() => {
            resolve({ data: { session: null }, timeout: true });
          }, 8000);
        });

        // Race
        const result: any = await Promise.race([
          fetchSessionPromise,
          timeoutPromise
        ]);

        let session = result.data?.session;

        // If timed out or no session, try getUser as a robust fallback
        if (result.timeout || !session) {

          // Wrap getUser in timeout as well
          const fetchUserPromise = supabase.auth.getUser();
          const userTimeoutPromise = new Promise<{ data: { user: null }; error: any }>((resolve) => {
            setTimeout(() => {
              resolve({ data: { user: null }, error: { message: "Timeout" } });
            }, 5000);
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

    // Listen for auth changes - with debounce
    let authChangeTimeout: NodeJS.Timeout | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('🔄 Auth state changed:', event);

      // Debounce to prevent multiple rapid calls
      if (authChangeTimeout) {
        clearTimeout(authChangeTimeout);
      }

      authChangeTimeout = setTimeout(async () => {
        const currentUser = session?.user ?? null;

        // Only update if user actually changed
        if (currentUser?.id !== user?.id) {
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
      }, 300); // Wait 300ms before processing
    });

    return () => {
      mounted = false;
      if (authChangeTimeout) clearTimeout(authChangeTimeout);
      subscription.unsubscribe();
    };
  }, [user?.id]); // NEW: Add user?.id as dependency

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
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      analytics.trackError((error as Error).message, 'Logout');
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, signOut, refreshProfile, checkAccess }}>
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
