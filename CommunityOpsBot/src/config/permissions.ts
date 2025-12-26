export type RoleLevel =
  | 'Head Administration'
  | 'Senior Administration'
  | 'Administration'
  | 'Junior Administration'
  | 'Senior Staff'
  | 'Staff'
  | 'Staff In Training'
  | 'Member';

export const ROLE_HIERARCHY: RoleLevel[] = [
  'Head Administration',
  'Senior Administration',
  'Administration',
  'Junior Administration',
  'Senior Staff',
  'Staff',
  'Staff In Training',
  'Member'
];

export function roleAtLeast(level: RoleLevel, required: RoleLevel): boolean {
  const idx = ROLE_HIERARCHY.indexOf(level);
  const ridx = ROLE_HIERARCHY.indexOf(required);
  if (idx === -1 || ridx === -1) return false;
  return idx <= ridx;
}

export const REQUIRED_FOR = {
  gban: 'Administration' as RoleLevel,
  guban: 'Junior Administration' as RoleLevel,
  gkick: 'Senior Staff' as RoleLevel
};
