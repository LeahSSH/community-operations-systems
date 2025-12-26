import { GuildMember, Role } from 'discord.js';
import { ROLE_HIERARCHY, RoleLevel, roleAtLeast } from '../config/permissions.js';
import { getPermissionRoleIds, getDefaultRoleIds } from '../config/env.js';

export function highestMappedRole(member: GuildMember): RoleLevel | null {
  const guildId = member.guild.id;
  const overrides = getPermissionRoleIds();
  const guildOverrides = overrides[guildId];

  if (guildOverrides) {
    const roleIds = new Set(member.roles.cache.map((r: Role) => r.id));
    for (const level of ROLE_HIERARCHY) {
      const targetId = guildOverrides[level];
      if (targetId && roleIds.has(targetId)) return level;
    }
  }

  const defaults = getDefaultRoleIds();
  if (defaults) {
    const roleIds = new Set(member.roles.cache.map((r: Role) => r.id));
    for (const level of ROLE_HIERARCHY) {
      const targetId = defaults[level];
      if (targetId && roleIds.has(targetId)) return level;
    }
  }

  const names = new Set(member.roles.cache.map((r: Role) => r.name));
  for (const level of ROLE_HIERARCHY) {
    if (names.has(level)) return level;
  }
  return null;
}

export function hasRequiredLevel(member: GuildMember, required: RoleLevel): boolean {
  const level = highestMappedRole(member);
  if (!level) return false;
  return roleAtLeast(level, required);
}
