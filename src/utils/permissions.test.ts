import { describe, it, expect } from 'vitest';
import { 
  canManageOrganization, 
  canEditSchedule, 
  canEditPersonnel, 
  canViewStats, 
  canAccessScreen,
  isReadOnly
} from './permissions';
import { UserRole } from '../types';

describe('Permissions Utility (role-based)', () => {

  describe('canManageOrganization', () => {
    it('should allow admin to manage organization', () => {
      expect(canManageOrganization('admin')).toBe(true);
    });
    it('should not allow other roles to manage organization', () => {
      expect(canManageOrganization('editor')).toBe(false);
      expect(canManageOrganization('viewer')).toBe(false);
      expect(canManageOrganization('attendance_only')).toBe(false);
    });
  });

  describe('canEditSchedule', () => {
    it('should allow admin and editor to edit schedule', () => {
      expect(canEditSchedule('admin')).toBe(true);
      expect(canEditSchedule('editor')).toBe(true);
    });
    it('should not allow viewer or attendance_only to edit schedule', () => {
      expect(canEditSchedule('viewer')).toBe(false);
      expect(canEditSchedule('attendance_only')).toBe(false);
    });
  });

  describe('isReadOnly', () => {
    it('should return true for viewer and attendance_only', () => {
      expect(isReadOnly('viewer')).toBe(true);
      expect(isReadOnly('attendance_only')).toBe(true);
    });
    it('should return false for admin and editor', () => {
      expect(isReadOnly('admin')).toBe(false);
      expect(isReadOnly('editor')).toBe(false);
    });
  });

  describe('canAccessScreen', () => {
    it('should allow admin access to any screen', () => {
      expect(canAccessScreen('admin', 'settings')).toBe(true);
      expect(canAccessScreen('admin', 'any_random_screen')).toBe(true);
    });

    it('should restrict editor from settings and logs', () => {
      expect(canAccessScreen('editor', 'dashboard')).toBe(true);
      expect(canAccessScreen('editor', 'settings')).toBe(false);
      expect(canAccessScreen('editor', 'logs')).toBe(false);
    });

    it('should restrict viewer to specific public-facing screens', () => {
      expect(canAccessScreen('viewer', 'dashboard')).toBe(true);
      expect(canAccessScreen('viewer', 'stats')).toBe(true);
      expect(canAccessScreen('viewer', 'personnel')).toBe(false);
      expect(canAccessScreen('viewer', 'settings')).toBe(false);
    });

    it('should restrict attendance_only to attendance and dashboard', () => {
      expect(canAccessScreen('attendance_only', 'attendance')).toBe(true);
      expect(canAccessScreen('attendance_only', 'contact')).toBe(true);
      expect(canAccessScreen('attendance_only', 'stats')).toBe(false);
      expect(canAccessScreen('attendance_only', 'personnel')).toBe(false);
    });
  });
});
