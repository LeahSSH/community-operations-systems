import { Client, Guild } from 'discord.js';

export async function globalBan(client: Client, userId: string, reason: string) {
  const results: { guildId: string; ok: boolean; message?: string }[] = [];
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await ensureGuild(guild);
      await guild.members.ban(userId, { reason });
      results.push({ guildId, ok: true });
    } catch (e: any) {
      results.push({ guildId, ok: false, message: e?.message ?? 'Unknown error' });
    }
  }
  return results;
}

export async function globalUnban(client: Client, userId: string, reason: string) {
  const results: { guildId: string; ok: boolean; message?: string }[] = [];
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await ensureGuild(guild);
      await guild.bans.remove(userId, reason);
      results.push({ guildId, ok: true });
    } catch (e: any) {
      results.push({ guildId, ok: false, message: e?.message ?? 'Unknown error' });
    }
  }
  return results;
}

export async function globalKick(client: Client, userId: string, reason: string) {
  const results: { guildId: string; ok: boolean; message?: string }[] = [];
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await ensureGuild(guild);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        results.push({ guildId, ok: false, message: 'User is not a member' });
        continue;
      }
      await member.kick(reason);
      results.push({ guildId, ok: true });
    } catch (e: any) {
      results.push({ guildId, ok: false, message: e?.message ?? 'Unknown error' });
    }
  }
  return results;
}

export async function globalSetNickname(client: Client, userId: string, nickname: string, reason: string) {
  const results: { guildId: string; ok: boolean; message?: string }[] = [];
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await ensureGuild(guild);
      const member = await guild.members.fetch(userId).catch(() => null);
      if (!member) {
        results.push({ guildId, ok: false, message: 'User is not a member' });
        continue;
      }
      await member.setNickname(nickname, reason);
      results.push({ guildId, ok: true });
    } catch (e: any) {
      results.push({ guildId, ok: false, message: e?.message ?? 'Unknown error' });
    }
  }
  return results;
}

async function ensureGuild(guild: Guild) {
  if (!guild.available) await guild.fetch();
}
