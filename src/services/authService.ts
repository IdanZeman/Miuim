import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Profile, Organization } from '../types';
import { analytics } from './analytics';
import { logger } from './loggingService';

// Helper to prevent SDK hangs
const withTimeout = <T>(promise: PromiseLike<T>, timeoutMs: number, operationName: string): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout: ${operationName}`)), timeoutMs)
    );
    return Promise.race([promise, timeoutPromise]);
};

export const authService = {
  async fetchProfile(userId: string): Promise<{ profile: Profile; organization: Organization | null } | null> {
    try {
      console.log('📡 [authService v1.5] fetchProfile - querying DB for userId:', userId);
      
      // Step 1: Try RPC Bypass First (Most reliable if RLS is stuck)
      let rpcData = null;
      let rpcError = null;
      
      try {
          const result = await withTimeout(
            supabase.rpc('get_my_profile'),
            10000, // Increased to 10s to allow slow but successful responses
            'fetchProfile RPC'
          );
          rpcData = result.data;
          rpcError = result.error;
      } catch (e) {
          console.warn('⚠️ [authService] RPC fetch timed out (10s), proceeding to standard query.');
      }

      let profileData = rpcData;

      if (!profileData || rpcError) {
          if (rpcError) console.warn('⚠️ [authService] RPC fetch returned error:', rpcError);
          
          console.log('🔄 [authService] Falling back to standard query...');
          // Fallback to standard query
          const { data: stdData, error: stdError } = await withTimeout(
             supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
             15000,
             'fetchProfile Standard'
          );
          if (stdError && stdError.code !== 'PGRST116') throw stdError;
          profileData = stdData;
      }

      if (!profileData) {
        console.log('ℹ️ [authService] fetchProfile - no profile found, creating new...');
        // Handle new profile creation if it doesn't exist
        const { data: userData } = await supabase.auth.getUser();
        const email = userData?.user?.email || '';
        const phone = userData?.user?.phone || '';
        const fullName = userData?.user?.user_metadata?.full_name || 
                        userData?.user?.user_metadata?.name || 
                        email.split('@')[0] || phone;

        const { data: existingPerson } = await supabase.from('people')
          .select('organization_id, id')
          .or(`email.eq.${email},phone.eq.${phone}`)
          .maybeSingle();

        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            email: email,
            full_name: fullName,
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
          .select('*')
          .single();

        if (insertError) throw insertError;

        if (existingPerson) {
          await supabase.from('people').update({ user_id: userId }).eq('id', existingPerson.id);
        }

        // Fetch Org if needed for new profile
        let newOrgData = null;
        if (newProfile.organization_id) {
           const { data: org } = await supabase.from('organizations').select('*').eq('id', newProfile.organization_id).single();
           newOrgData = org;
        }

        return { profile: newProfile, organization: newOrgData || null };
      }

      // Step 2: Fetch Organization if linked (Separate query to break recursion)
      let orgData = null;
      if (profileData.organization_id) {
          const { data: org, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profileData.organization_id)
            .single();
          
          if (!orgError) orgData = org;
      }

      return { profile: profileData, organization: orgData || null };
    } catch (error) {
      console.error('❌ [authService] fetchProfile failed:', error);
      logger.error('ERROR', 'authService.fetchProfile failed', error);
      throw error;
    }
  },

  async joinOrganizationByToken(token: string): Promise<boolean> {
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('join_organization_by_token', { p_token: token }),
        8000,
        'joinOrganizationByToken'
      );
      if (error) throw error;
      return !!data;
    } catch (error) {
      logger.error('AUTH', 'authService.joinOrganizationByToken failed', error);
      return false;
    }
  },

  async acceptTerms(userId: string, timestamp: string): Promise<void> {
    try {
      const { error } = await withTimeout(
        supabase.from('profiles').update({ terms_accepted_at: timestamp }).eq('id', userId),
        5000,
        'acceptTerms'
      );
      if (error) throw error;
    } catch (error) {
      logger.error('AUTH', 'authService.acceptTerms failed', error);
      throw error;
    }
  },

  async leaveOrganization(userId: string): Promise<void> {
    try {
      const { error } = await withTimeout(
        supabase.from('profiles').update({
          organization_id: null,
          permission_template_id: null,
          permissions: { dataScope: 'personal', screens: {} }
        }).eq('id', userId),
        8000,
        'leaveOrganization'
      );
      if (error) throw error;
    } catch (error) {
      logger.error('AUTH', 'authService.leaveOrganization failed', error);
      throw error;
    }
  },

  async signIn(email: string, password: string) {
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      analytics.trackLogin('email');
      return result;
    } catch (error) {
      analytics.trackError((error as Error).message, 'Login');
      logger.error('LOGIN', 'Email sign-in failed', error);
      throw error;
    }
  },

  async signUp(email: string, password: string, fullName: string) {
    try {
      const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (result.error) throw result.error;
      analytics.trackSignup('email');
      return result;
    } catch (error) {
      analytics.trackError((error as Error).message, 'Signup');
      logger.error('SIGNUP', 'Email sign-up failed', error);
      throw error;
    }
  },

  async signOut() {
    try {
      analytics.trackLogout();
      const { error } = await supabase.auth.signOut({ scope: 'global' });
      if (error) throw error;
    } catch (error) {
      analytics.trackError((error as Error).message, 'Logout');
      logger.error('LOGOUT', 'Sign-out failed', error);
      throw error;
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>) {
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
  },

  async signInWithOAuth(provider: 'google') {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account'
          }
        }
      });
      if (error) throw error;
    } catch (error) {
      logger.error('AUTH', `Failed to sign in with ${provider}`, error);
      throw error;
    }
  },

  async fetchUnlinkedPeople(organizationId: string) {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('organization_id', organizationId)
      .is('user_id', null);

    if (error) throw error;
    return data;
  },

  async claimProfile(userId: string, personId: string, personName: string) {
    // 1. Link person record
    const { error: linkError } = await supabase.rpc('claim_person_profile', {
      person_id: personId
    });
    if (linkError) throw linkError;

    // 2. Update profile name to match person name
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: personName })
      .eq('id', userId);

    if (updateError) throw updateError;
  }
};
