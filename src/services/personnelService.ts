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
    const dbPayload = mapPersonToDB(person as Person);
    delete (dbPayload as any).id;

    const { data, error } = await supabase
      .from('people')
      .insert(dbPayload)
      .select()
      .single();

    if (error) throw error;
    return mapPersonFromDB(data);
  },

  async addPeople(people: Partial<Person>[]) {
    const { error } = await supabase.from('people').insert(people);
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

    const { data, error } = await supabase
      .from('people')
      .update(dbPerson)
      .eq('id', person.id)
      .select()
      .maybeSingle();

    if (error) {
      console.group('❌ [personnelService.updatePerson] ERROR');
      console.error('Error:', error);
      console.groupEnd();
      throw error;
    }

    if (!data) {
      console.group('⚠️ [personnelService.updatePerson] WARNING - No rows updated');
      console.warn('Person ID:', person.id);
      console.warn('This may indicate RLS policy blocking update or person does not exist');
      console.groupEnd();
      throw new Error(`Failed to update person ${person.id} - no rows affected (possible RLS issue)`);
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
    const payloads = people.map(mapPersonToDB);
    const { error } = await supabase
      .from('people')
      .upsert(payloads);

    if (error) throw error;
  },

  async upsertPeople(people: Person[]) {
    const mapped = people.map(p => mapPersonToDB(p));
    const { error } = await supabase
      .from('people')
      .upsert(mapped);

    if (error) throw error;
  },

  async deactivatePersonnel(ids: string[]) {
    const { error } = await supabase
      .from('people')
      .update({ is_active: false })
      .in('id', ids);

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
    const payloads = teams.map(mapTeamToDB);
    const { error } = await supabase.from('teams').insert(payloads);
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
    const payloads = roles.map(mapRoleToDB);
    const { data, error } = await supabase.from('roles').insert(payloads).select();
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
    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId);

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
      const realId = uuidv4();
      idMap.set(team.id, realId);
      const { error } = await supabase.from('teams').insert({
        id: realId,
        name: team.name,
        color: team.color,
        organization_id: organizationId
      });
      if (error) throw error;
    }

    // 2. Create Roles
    const uniqueRoles = Array.from(new Map(roles.map(r => [r.id, r])).values());
    for (const role of uniqueRoles) {
      if (!role.id.startsWith('temp-') && !role.id.startsWith('role-')) {
        idMap.set(role.id, role.id);
        continue;
      }
      const realId = uuidv4();
      idMap.set(role.id, realId);
      const { error } = await supabase.from('roles').insert({
        id: realId,
        name: role.name,
        color: role.color,
        organization_id: organizationId
      });
      if (error) throw error;
    }

    // 3. Create People
    for (const p of people) {
      const realTeamId = p.teamId && idMap.has(p.teamId) ? idMap.get(p.teamId) : p.teamId;
      const realRoleIds = (p.roleIds || []).map(rid => idMap.has(rid) ? idMap.get(rid) : rid).filter(Boolean) as string[];

      const newId = uuidv4();
      const { error } = await supabase.from('people').insert({
        id: newId,
        name: p.name,
        organization_id: organizationId,
        team_id: realTeamId || null,
        role_ids: realRoleIds,
        email: p.email || null,
        phone: p.phone || null,
        color: p.color
      });

      if (error) {
        if (error.code === '23505') continue;
        throw error;
      }
      insertedPeople.push({ ...p, id: newId });
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
