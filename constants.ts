import { AppState } from './types';
import { Shield, Users, User } from 'lucide-react';

export const ROLE_ICONS: Record<string, any> = {
    shield: Shield,
    users: Users,
    user: User,
};

export const MOCK_ROLES = [];
export const MOCK_TEAMS = [];
export const MOCK_PEOPLE = [];
export const MOCK_TASKS = [];

export const MOCK_INITIAL_STATE: AppState = {
  people: [],
  roles: [],
  teams: [],
  taskTemplates: [],
  shifts: [],
};