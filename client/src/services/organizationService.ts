import { supabase } from '../lib/supabase';
import { OrganizationSettings, Organization, CustomFieldDefinition } from '../types';
import { mapOrganizationSettingsFromDB, mapOrganizationSettingsToDB } from './mappers';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });


export const organizationService = {
  async fetchOrgDataBundle(organizationId: string, startDate?: string, endDate?: string) {
    try {
      // Default: -7 days back, +30 days forward (User Request)
      const vStart = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const vEnd = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      return await callBackend(`/api/org/bundle?orgId=${organizationId}&startDate=${vStart}&endDate=${vEnd}`, 'GET');
    } catch (error) {
      console.error('❌ [organizationService] fetchOrgDataBundle failed:', error);
      throw error;
    }
  },

  async fetchSettings(organizationId: string): Promise<OrganizationSettings | null> {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapOrganizationSettingsFromDB(data) : null;
  },

  async updateSettings(settings: OrganizationSettings) {
    const dbSettings = mapOrganizationSettingsToDB(settings);
    await callAdminRpc('update_organization_settings_v3', {
      p_data: dbSettings
    });
  },

  async updateOrganization(organizationId: string, settings: Partial<Organization>) {
    const { error } = await supabase
      .from('organizations')
      .update(settings)
      .eq('id', organizationId);

    if (error) throw error;
  },

  async updateInterPersonConstraints(organizationId: string, constraints: any[]) {
    await callAdminRpc('update_organization_settings_v3', {
      p_data: { inter_person_constraints: constraints }
    });
  },

  async createOrganization(name: string, type: 'company' | 'battalion' = 'company'): Promise<Organization> {
    const { data, error } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        org_type: type
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create organization');
    return data;
  },

  async checkPendingInvite(email: string) {
    const { data: invites, error } = await supabase
      .from('organization_invites')
      .select('*, organizations(name)')
      .eq('email', email.toLowerCase())
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return invites?.[0] || null;
  },

  async acceptInvite(userId: string, orgId: string, templateId: string | null) {
    // 1. Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        organization_id: orgId,
        permission_template_id: templateId
      })
      .eq('id', userId);

    if (profileError) throw profileError;

    // 2. Mark invite as accepted (we'll need the invite id, handled in the higher level if possible, or we search again)
    // Actually, it's better to pass inviteId to this function.
  },

  async markInviteAccepted(inviteId: string) {
    const { error } = await supabase
      .from('organization_invites')
      .update({ accepted: true })
      .eq('id', inviteId);
    if (error) throw error;
  },

  async getOrgNameByToken(token: string): Promise<string | null> {
    return await callBackend(`/api/system/org-name/${token}`, 'GET');
  },

  async joinOrganizationByToken(token: string): Promise<boolean> {
    const data = await callBackend('/api/system/join', 'POST', { p_token: token });
    return !!data;
  },

  async fetchCustomFieldsSchema(organizationId: string): Promise<CustomFieldDefinition[]> {
    const { data, error } = await supabase
      .from('organization_settings')
      .select('custom_fields_schema')
      .eq('organization_id', organizationId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data?.custom_fields_schema || [];
  },

  async updateCustomFieldsSchema(organizationId: string, schema: CustomFieldDefinition[]) {
    await callAdminRpc('update_organization_settings_v3', {
      p_data: { custom_fields_schema: schema }
    });
  },

  async deleteCustomFieldGlobally(organizationId: string, fieldKey: string) {
    await callAdminRpc('delete_custom_field_data', {
      p_field_key: fieldKey,
      p_org_id: organizationId
    });
  }
};
