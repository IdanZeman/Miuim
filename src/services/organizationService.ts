import { supabase } from '../lib/supabase';
import { OrganizationSettings, Organization, CustomFieldDefinition } from '../types';
import { mapOrganizationSettingsFromDB, mapOrganizationSettingsToDB } from './mappers';


export const organizationService = {
  async fetchOrgDataBundle(organizationId: string) {
    const { data: bundle, error } = await supabase.rpc('get_org_data_bundle', { p_org_id: organizationId });
    if (error) throw error;
    return bundle;
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
    const { error } = await supabase.rpc('update_organization_settings_v3', {
      p_data: dbSettings
    });

    if (error) throw error;
  },

  async updateOrganization(organizationId: string, settings: Partial<Organization>) {
    const { error } = await supabase
      .from('organizations')
      .update(settings)
      .eq('id', organizationId);

    if (error) throw error;
  },

  async updateInterPersonConstraints(organizationId: string, constraints: any[]) {
    const { error } = await supabase.rpc('update_organization_settings_v3', {
      p_data: { inter_person_constraints: constraints }
    });

    if (error) throw error;
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
    const { data, error } = await supabase.rpc('get_org_name_by_token', { p_token: token });
    if (error) throw error;
    return data;
  },

  async joinOrganizationByToken(token: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('join_organization_by_token', { p_token: token });
    if (error) throw error;
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
    const { error } = await supabase.rpc('update_organization_settings_v3', {
      p_data: { custom_fields_schema: schema }
    });

    if (error) throw error;
  },

  async deleteCustomFieldGlobally(organizationId: string, fieldKey: string) {
    const { error } = await supabase.rpc('delete_custom_field_data', {
      p_field_key: fieldKey,
      p_org_id: organizationId
    });

    if (error) throw error;
  }
};
