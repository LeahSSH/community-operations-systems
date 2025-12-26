import type { RoleLevel } from './permissions.js';

export type PermissionRoleIds = Record<string, Partial<Record<RoleLevel, string>>>;

export function getPermissionRoleIds(): PermissionRoleIds {
  const raw = process.env.PERMISSION_ROLE_IDS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as PermissionRoleIds;
    return {};
  } catch {
    return {};
  }
}

function read(keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

export function getDefaultRoleIds(): Partial<Record<RoleLevel, string>> {
  return {
    'Head Administration': read(['HeadAdmin', 'HEAD_ADMIN', 'HEADADMIN']),
    'Senior Administration': read(['SeniorAdmin', 'SENIOR_ADMIN', 'SENIORADMIN']),
    'Administration': read(['Administration', 'ADMINISTRATION']),
    'Junior Administration': read(['JuniorAdmin', 'JUNIOR_ADMIN', 'JUNIORADMIN']),
    'Senior Staff': read(['SeniorStaff', 'SENIOR_STAFF', 'SENIORSTAFF']),
    'Staff': read(['Staff']),
    'Staff In Training': read(['StaffInTraining', 'STAFF_IN_TRAINING', 'STAFFINTRAINING']),
    'Member': read(['Member'])
  };
}
