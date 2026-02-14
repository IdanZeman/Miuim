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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) {
        throw new Error('No active session found');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/api/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch profile from backend');
      }

      const profile = await response.json();

      if (!profile) return null;

      // Fetch Organization if linked
      let orgData = null;
      if (profile.organization_id) {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profile.organization_id)
          .single();

        if (!orgError) orgData = org;
      }

      return { profile: profile as Profile, organization: orgData || null };
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
      const { error } = await supabase.rpc('update_my_profile', {
        p_updates: { terms_accepted_at: timestamp }
      });
      if (error) throw error;
    } catch (error) {
      logger.error('AUTH', 'authService.acceptTerms failed', error);
      throw error;
    }
  },

  async leaveOrganization(userId: string): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_my_profile', {
        p_updates: {
          organization_id: null,
          permission_template_id: null,
          permissions: { dataScope: 'personal', screens: {} }
        }
      });
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
    const { error } = await supabase.rpc('update_my_profile', {
      p_updates: updates
    });
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
