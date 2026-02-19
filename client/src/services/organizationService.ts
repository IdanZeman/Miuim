import { OrganizationSettings, Organization, CustomFieldDefinition } from '../types';
import { mapOrganizationSettingsFromDB, mapOrganizationSettingsToDB } from './mappers';
import { callBackend } from './backendService';

const callAdminRpc = (rpcName: string, params?: any) => callBackend('/api/admin/rpc', 'POST', { rpcName, params });

export const organizationService = {
  async fetchOrgDataBundle(organizationId: string, startDate?: string, endDate?: string) {
    try {
      // Default: Full current month
      const now = new Date();
      const vStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const vEnd = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      return await callBackend(`/api/org/bundle?orgId=${organizationId}&startDate=${vStart}&endDate=${vEnd}`, 'GET');
    } catch (error) {
      console.error('❌ [organizationService] fetchOrgDataBundle failed:', error);
      throw error;
    }
  },

  async fetchSettings(organizationId: string): Promise<OrganizationSettings | null> {
    const data = await callBackend(`/api/org/settings?orgId=${organizationId}`, 'GET');
    return data ? mapOrganizationSettingsFromDB(data) : null;
  },

  async updateSettings(settings: OrganizationSettings) {
    const dbSettings = mapOrganizationSettingsToDB(settings);
    await callAdminRpc('update_organization_settings_v3', {
      p_data: dbSettings
    });
  },

  async updateOrganization(organizationId: string, settings: Partial<Organization>) {
    await callAdminRpc('update_organization_settings_v3', {
      p_data: settings
    });
  },

  async updateInterPersonConstraints(organizationId: string, constraints: any[]) {
    await callAdminRpc('update_organization_settings_v3', {
      p_data: { inter_person_constraints: constraints }
    });
  },

  async createOrganization(name: string, type: 'company' | 'battalion' = 'company'): Promise<Organization> {
    const data = await callBackend('/api/org/create', 'POST', { name, type });
    return data;
  },

  async checkPendingInvite(email: string) {
    const data = await callBackend(`/api/org/invite?email=${encodeURIComponent(email)}`, 'GET');
    return data || null;
  },

  async acceptInvite(userId: string, orgId: string, templateId: string | null) {
    await callBackend('/api/org/invite/accept', 'POST', { userId, orgId, templateId });
  },

  async markInviteAccepted(inviteId: string) {
    await callBackend('/api/org/invite/mark-accepted', 'POST', { inviteId });
  },

  async getOrgNameByToken(token: string): Promise<string | null> {
    return await callBackend(`/api/system/org-name/${token}`, 'GET');
  },

  async joinOrganizationByToken(token: string): Promise<boolean> {
    const data = await callBackend('/api/system/join', 'POST', { p_token: token });
    return !!data;
  },

  async fetchCustomFieldsSchema(organizationId: string): Promise<CustomFieldDefinition[]> {
    const data = await callBackend(`/api/org/settings?orgId=${organizationId}`, 'GET');
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
