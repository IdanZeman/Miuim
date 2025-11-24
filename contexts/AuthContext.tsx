import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabaseClient';
import { Profile, Organization } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>; // NEW: Force refresh
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      // Create a promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
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
        console.error('Error fetching profile:', profileError);
        return;
      }

      if (!profileData) {
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const fullName = userData?.user?.user_metadata?.full_name ||
          userData?.user?.user_metadata?.name ||
          email.split('@')[0];

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            full_name: fullName,
            role: 'admin',
            created_at: new Date().toISOString()
          }, {
            onConflict: 'id'
          })
          .select()
          .single();

        if (insertError) {
          console.error('❌ Error creating profile (fallback):', insertError);
          return;
        }

        setProfile(newProfile);
        return;
      }

      setProfile(profileData);

      if (profileData.organization_id) {
        const { data: orgData, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.organization_id)
          .single();

        if (orgError) {
          console.error('Error fetching organization:', orgError);
        } else {
          setOrganization(orgData);
        }
      } else {
        setOrganization(null);
      }
    } catch (error) {
      console.error('Unexpected error in fetchProfile:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
        setOrganization(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // ✅ Empty dependency array - only run once

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, organization, loading, signOut, refreshProfile }}>
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
