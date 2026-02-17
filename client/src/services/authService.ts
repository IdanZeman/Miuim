import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';
import { Profile, Organization } from '../types';
import { analytics } from './analytics';
import { logger } from './loggingService';
import { callBackend } from './backendService';

// Helper for generic RPC calls
const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

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
      // Fetch profile first (required)
      const profile = await callBackend('/api/auth/profile', 'POST');

      if (!profile) return null;

      // If profile has organization, fetch it in parallel with returning profile
      // This allows the UI to render faster while org details load in background
      let orgData = null;
      if (profile.organization_id) {
        // Fetch org data but don't block on it
        orgData = await callBackend(`/api/org/details?orgId=${profile.organization_id}`, 'GET');
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
      const data = await withTimeout(
        callAdminRpc('join_organization_by_token', { p_token: token }),
        8000,
        'joinOrganizationByToken'
      );
      return !!data;
    } catch (error) {
      logger.error('AUTH', 'authService.joinOrganizationByToken failed', error);
      return false;
    }
  },

  async acceptTerms(userId: string, timestamp: string): Promise<void> {
    try {
      await callAdminRpc('update_my_profile', {
        p_updates: { terms_accepted_at: timestamp }
      });
    } catch (error) {
      logger.error('AUTH', 'authService.acceptTerms failed', error);
      throw error;
    }
  },

  async leaveOrganization(userId: string): Promise<void> {
    try {
      await callAdminRpc('update_my_profile', {
        p_updates: {
          organization_id: null,
          permission_template_id: null,
          permissions: { dataScope: 'personal', screens: {} }
        }
      });
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
    await callAdminRpc('update_my_profile', {
      p_updates: updates
    });
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
    return await callBackend(`/api/personnel/people?organizationId=${organizationId}&unlinkedOnly=true`, 'GET');
  },

  async claimProfile(userId: string, personId: string, personName: string) {
    // 1. Link person record
    await callAdminRpc('claim_person_profile', {
      person_id: personId
    });

    // 2. Update profile name to match person name
    await callAdminRpc('update_my_profile', {
      p_updates: { full_name: personName }
    });
  }
};
