import { supabase } from '../lib/supabase';
import { Person, Team, Role, TaskTemplate, Shift } from '../types';
import { 
  mapPersonFromDB, 
  mapPersonToDB, 
  mapTeamFromDB, 
  mapTeamToDB, 
  mapRoleFromDB, 
  mapRoleToDB 
} from './mappers';
import { v4 as uuidv4 } from 'uuid';

export const personnelService = {
  // People
  async fetchPeople(organizationId: string): Promise<Person[]> {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapPersonFromDB);
  },

  async addPerson(person: Omit<Person, 'id'>) {
    const { data, error } = await supabase.rpc('upsert_person', {
      p_id: null,
      p_name: person.name,
      p_email: person.email || null,
      p_team_id: person.teamId || null,
      p_role_ids: person.roleIds || [],
      p_phone: person.phone || null,
      p_is_active: person.isActive ?? true,
      p_custom_fields: person.customFields || {},
      p_color: person.color || '#3B82F6'
    });

    if (error) throw error;
    if (!data) throw new Error('No person returned from upsert_person');
    return mapPersonFromDB(data);
  },

  async addPeople(people: Partial<Person>[]) {
    const peoplePayload = people.map(p => ({
      id: null,
      name: p.name || '',
      email: p.email || null,
      team_id: p.teamId || null,
      role_ids: p.roleIds || [],
      phone: p.phone || null,
      is_active: p.isActive ?? true,
      custom_fields: p.customFields || {},
      color: p.color || '#3B82F6'
    }));
    
    const { error } = await supabase.rpc('upsert_people', {
      p_people: peoplePayload
    });
    if (error) throw error;
  },

  async updatePerson(person: Person) {
    console.group('📝 [personnelService.updatePerson] START');
    console.log('Person ID:', person.id);
    console.log('Person name:', person.name);
    console.log('dailyAvailability keys:', Object.keys(person.dailyAvailability || {}).length);
    const availKeys = Object.keys(person.dailyAvailability || {});
    if (availKeys.length > 0) {
      console.log('Sample dailyAvailability (last 3 dates):');
      availKeys.slice(-3).forEach(key => {
        console.log(`  ${key}:`, JSON.stringify(person.dailyAvailability![key], null, 2));
      });
    }
    console.groupEnd();

    const dbPerson = mapPersonToDB(person);
    
    console.group('📝 [personnelService.updatePerson] Mapped to DB');
    console.log('DB person daily_availability keys:', Object.keys(dbPerson.daily_availability || {}).length);
    console.groupEnd();

    const { data, error } = await supabase.rpc('upsert_person', {
      p_id: person.id,
      p_name: person.name,
      p_email: person.email || null,
      p_team_id: person.teamId || null,
      p_role_ids: person.roleIds || [],
      p_phone: person.phone || null,
      p_is_active: person.isActive ?? true,
      p_custom_fields: person.customFields || {},
      p_color: person.color || '#3B82F6'
    });

    if (error) {
      console.group('❌ [personnelService.updatePerson] ERROR');
      console.error('Error:', error);
      console.groupEnd();
      throw error;
    }

    if (!data) {
      console.group('⚠️ [personnelService.updatePerson] WARNING - No data returned');
      console.warn('Person ID:', person.id);
      console.warn('This may indicate RLS policy blocking update or person does not exist');
      console.groupEnd();
      throw new Error(`Failed to update person ${person.id} - no data returned (possible RLS issue)`);
    }

    console.group('✅ [personnelService.updatePerson] SUCCESS');
    console.log('Returned data daily_availability keys:', Object.keys(data.daily_availability || {}).length);
    console.log('Sample returned data (last 3 dates):');
    const returnedKeys = Object.keys(data.daily_availability || {});
    returnedKeys.slice(-3).forEach(key => {
      console.log(`  ${key}:`, JSON.stringify(data.daily_availability[key], null, 2));
    });
    console.groupEnd();
  },

  async updatePeople(people: Person[]) {
    const peoplePayload = people.map(p => mapPersonToDB(p));
    const { error } = await supabase.rpc('upsert_people', {
      p_people: peoplePayload
    });

    if (error) throw error;
  },

  async upsertPeople(people: Person[]) {
    const peoplePayload = people.map(p => mapPersonToDB(p));
    const { error } = await supabase.rpc('upsert_people', {
      p_people: peoplePayload
    });

    if (error) throw error;
  },

  async deactivatePersonnel(ids: string[]) {
    const { error } = await supabase.rpc('deactivate_personnel', {
      p_person_ids: ids
    });

    if (error) throw error;
  },

  async fetchUnlinkedPeople(organizationId: string): Promise<Person[]> {
    const { data, error } = await supabase
      .from('people')
      .select('*')
      .eq('organization_id', organizationId)
      .is('user_id', null);

    if (error) throw error;
    return (data || []).map(mapPersonFromDB);
  },

  async claimProfile(personId: string, userId: string, fullName: string) {
    const { error: rpcError } = await supabase.rpc('claim_person_profile', {
      person_id: personId
    });
    if (rpcError) throw rpcError;

    const { error: profileError } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', userId);
    if (profileError) throw profileError;
  },

  // Teams
  async fetchTeams(organizationId: string): Promise<Team[]> {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapTeamFromDB);
  },

  async addTeam(team: Omit<Team, 'id'>) {
    const { data, error } = await supabase.rpc('upsert_team', {
      p_id: null,
      p_name: team.name,
      p_color: team.color
    });

    if (error) throw error;
    if (!data) throw new Error('Failed to save team');
    return mapTeamFromDB(data);
  },

  async updateTeam(team: Team) {
    const { error } = await supabase.rpc('upsert_team', {
      p_id: team.id,
      p_name: team.name,
      p_color: team.color
    });

    if (error) throw error;
  },

  async addTeams(teams: Team[]) {
    const teamsPayload = teams.map(t => ({
      id: null,
      name: t.name,
      color: t.color
    }));
    const { error } = await supabase.rpc('insert_teams', {
      p_teams: teamsPayload
    });
    if (error) throw error;
  },

  async deleteTeam(id: string, organizationId: string) {
    // Transaction-like cleanup
    await Promise.all([
      // Unassign people
      supabase.from('people').update({ team_id: null }).eq('team_id', id).eq('organization_id', organizationId),
      // Delete rotations
      supabase.from('team_rotations').delete().eq('team_id', id).eq('organization_id', organizationId),
      // Unassign from tasks
      supabase.from('task_templates').update({ assigned_team_id: null }).eq('assigned_team_id', id).eq('organization_id', organizationId),
      // Delete constraints
      supabase.from('scheduling_constraints').delete().eq('team_id', id).eq('organization_id', organizationId)
    ]);

    const { error } = await supabase.rpc('delete_team_secure', { p_team_id: id });
    if (error) throw error;
  },

  // Roles
  async fetchRoles(organizationId: string): Promise<Role[]> {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return (data || []).map(mapRoleFromDB);
  },

  async addRole(role: Omit<Role, 'id'>, organizationId?: string) {
    const rolePayload = {
      ...role,
      organization_id: organizationId || (role as any).organization_id
    } as Role;

    const { data, error } = await supabase.rpc('upsert_role', {
      p_id: (rolePayload as any).id ?? null,
      p_name: rolePayload.name,
      p_color: rolePayload.color,
      p_icon: rolePayload.icon
    });

    if (error) throw error;
    if (!data) throw new Error('No role returned from upsert_role');
    return mapRoleFromDB(data);
  },

  async addRoles(roles: Role[]) {
    const rolesPayload = roles.map(r => ({
      id: null,
      name: r.name,
      color: r.color,
      icon: r.icon || null
    }));
    const { data, error } = await supabase.rpc('insert_roles', {
      p_roles: rolesPayload
    });
    if (error) throw error;
    return (data || []).map(mapRoleFromDB);
  },

  async updateRole(role: Role) {
    const { error } = await supabase.rpc('upsert_role', {
      p_id: role.id,
      p_name: role.name,
      p_color: role.color,
      p_icon: role.icon
    });

    if (error) throw error;
  },

  async deleteRole(id: string, organizationId: string) {
    const { error } = await supabase.rpc('delete_role_secure', {
      p_role_id: id
    });

    if (error) throw error;
  },

  async processOnboardingImport(
    organizationId: string,
    people: Person[],
    teams: Team[],
    roles: Role[]
  ): Promise<Person[]> {
    const idMap = new Map<string, string>();
    const insertedPeople: Person[] = [];

    // 1. Create Teams
    const uniqueTeams = Array.from(new Map(teams.map(t => [t.id, t])).values());
    for (const team of uniqueTeams) {
      if (!team.id.startsWith('temp-') && !team.id.startsWith('team-')) {
        idMap.set(team.id, team.id);
        continue;
      }
      const { data, error } = await supabase.rpc('upsert_team', {
        p_id: null,
        p_name: team.name,
        p_color: team.color
      });
      if (error) throw error;
      if (data && data.id) {
        idMap.set(team.id, data.id);
      }
    }

    // 2. Create Roles
    const uniqueRoles = Array.from(new Map(roles.map(r => [r.id, r])).values());
    for (const role of uniqueRoles) {
      if (!role.id.startsWith('temp-') && !role.id.startsWith('role-')) {
        idMap.set(role.id, role.id);
        continue;
      }
      const { data, error } = await supabase.rpc('upsert_role', {
        p_id: null,
        p_name: role.name,
        p_color: role.color,
        p_icon: role.icon || null
      });
      if (error) throw error;
      if (data && data.id) {
        idMap.set(role.id, data.id);
      }
    }

    // 3. Create People
    for (const p of people) {
      const realTeamId = p.teamId && idMap.has(p.teamId) ? idMap.get(p.teamId) : p.teamId;
      const realRoleIds = (p.roleIds || []).map(rid => idMap.has(rid) ? idMap.get(rid) : rid).filter(Boolean) as string[];

      const { data, error } = await supabase.rpc('upsert_person', {
        p_id: null,
        p_name: p.name,
        p_email: p.email || null,
        p_team_id: realTeamId || null,
        p_role_ids: realRoleIds,
        p_phone: p.phone || null,
        p_is_active: true,
        p_custom_fields: {},
        p_color: p.color || '#3B82F6'
      });

      if (error) {
        if (error.code === '23505') continue;
        throw error;
      }
      if (data && data.id) {
        insertedPeople.push({ ...p, id: data.id });
      }
    }

    return insertedPeople;
  },

  async deletePersonCascade(id: string) {
    const { error } = await supabase.rpc('delete_person_cascade', { p_person_id: id });
    if (error) throw error;
  },

  async deletePersonSecure(id: string) {
    const { data, error } = await supabase.rpc('delete_person_secure', { p_person_id: id });
    if (error) throw error;
    return data === true;
  },

  async deletePeopleCascade(ids: string[]) {
    const { error } = await supabase.rpc('delete_people_cascade', { p_person_ids: ids });
    if (error) throw error;
  },

  async archivePersonBeforeDelete(id: string, deletedBy: string, reason: string) {
    const { error } = await supabase.rpc('archive_person_before_delete', {
      p_person_id: id,
      p_deleted_by: deletedBy,
      p_reason: reason
    });
    if (error) throw error;
  },

  async archivePeopleBeforeDelete(ids: string[], deletedBy: string, reason: string) {
    const { error } = await supabase.rpc('archive_people_before_delete', {
      p_person_ids: ids,
      p_deleted_by: deletedBy,
      p_reason: reason
    });
    if (error) throw error;
  },

  async previewPersonDeletion(id: string) {
    const { data, error } = await supabase.rpc('preview_person_deletion', { p_person_id: id });
    if (error) throw error;
    return data;
  }
};
