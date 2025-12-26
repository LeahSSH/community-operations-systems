import { SlashCommandBuilder, ChannelType, PermissionFlagsBits, ChatInputCommandInteraction } from 'discord.js';
import type { Client, GuildMember, OverwriteResolvable } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { infoEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { hasRequiredLevel } from '../../services/permissions.js';
import { getCase, createCase, closeCase } from '../../storage/iaStore.js';

function buildOverwrites(member: GuildMember, targetUserId: string): OverwriteResolvable[] {
  const everyoneId = member.guild.roles.everyone.id;
  const ids = [
    process.env.IA_ROLE_SENIOR_STAFF,
    process.env.IA_ROLE_JUNIOR_ADMIN,
    process.env.IA_ROLE_ADMIN,
    process.env.IA_ROLE_INTERNAL_AFFAIRS,
    process.env.IA_ROLE_COMMUNITY_COORDINATOR,
    process.env.IA_ROLE_COMMUNITY_LEADERSHIP,
  ].filter(Boolean) as string[];

  const overwrites: OverwriteResolvable[] = [
    { id: everyoneId, deny: [PermissionFlagsBits.ViewChannel] },
    { id: targetUserId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];
  for (const rid of ids) {
    overwrites.push({ id: rid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }
  return overwrites;
}

const data = new SlashCommandBuilder()
  .setName('ia')
  .setDescription('Open or close an Internal Affairs case.')
  .addSubcommand(sub =>
    sub
      .setName('open')
      .setDescription('Open an IA case: temporarily remove roles and create a private channel.')
      .addUserOption(o => o.setName('user').setDescription('User to place under IA case').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason for IA case').setRequired(true))
  )
  .addSubcommand(sub =>
    sub
      .setName('close')
      .setDescription('Close an IA case: restore roles and remove private channel.')
      .addUserOption(o => o.setName('user').setDescription('User to release').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Closure notes (optional)'))
  );

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command must be run inside a server.')] });
    return;
  }

  const guild = interaction.guild!;
  const executor = await guild.members.fetch(interaction.user.id);
  if (!hasRequiredLevel(executor, 'Senior Staff')) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Permission Denied', 'Senior Staff or higher is required to manage IA cases.')] });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'open') {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);

    await interaction.deferReply({ ephemeral: true });

    const existing = await getCase(user.id);
    if (existing) {
      await interaction.editReply({ embeds: [errorEmbed('Case Exists', 'There is already an active IA case for this user.')] });
      return;
    }

    const savedRolesByGuild: Record<string, string[]> = {};
    let affectedGuilds = 0;
    let errors = 0;

    const tasks = client.guilds.cache.map(async g => {
      try {
        const m = await g.members.fetch(user.id).catch(() => null);
        if (!m) return;
        const removable = m.roles.cache.filter(r => r.editable && r.id !== g.id);
        savedRolesByGuild[g.id] = removable.map(r => r.id);
        if (removable.size > 0) {
          for (const rid of removable.keys()) {
            await m.roles.remove(rid, '[IA] Temporarily removed for IA case');
          }
          affectedGuilds++;
        }
      } catch {
        errors++;
      }
    });
    await Promise.all(tasks);

    const mainGuildId = process.env.MAIN_GUILD_ID || guild.id;
    const mainGuild = client.guilds.cache.get(mainGuildId) || guild;
    const overwrites = buildOverwrites(executor, user.id);
    const channel = await mainGuild.channels.create({
      name: `ia-${user.id}`,
      type: ChannelType.GuildText,
      permissionOverwrites: overwrites,
      reason: '[IA] Private case channel',
    });

    const record = {
      userId: user.id,
      openedBy: interaction.user.id,
      openedAt: new Date().toISOString(),
      reason,
      channelId: channel.id,
      guildRoles: savedRolesByGuild,
      status: 'open' as const,
    };
    await createCase(record);

    const msg = infoEmbed('Internal Affairs Notice', `An IA case has been opened for <@${user.id}>. A private channel has been created: <#${channel.id}>.`);
    await interaction.editReply({ embeds: [successEmbed('IA Case Opened', `Affected guilds: ${affectedGuilds}. Errors: ${errors}.`)] });
    await (channel as any).send({ embeds: [msg] });
  }

  if (sub === 'close') {
    const user = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') || 'No additional notes';

    await interaction.deferReply({ ephemeral: true });

    const record = await getCase(user.id);
    if (!record) {
      await interaction.editReply({ embeds: [errorEmbed('No Active Case', 'There is no active IA case for this user.')] });
      return;
    }

    let restoredGuilds = 0;
    let errors = 0;
    const entries = Object.entries(record.guildRoles || {});
    const tasks = entries.map(async ([gid, roleIds]) => {
      try {
        const g = client.guilds.cache.get(gid);
        if (!g) return;
        const m = await g.members.fetch(user.id).catch(() => null);
        if (!m) return;
        for (const rid of roleIds) {
          const role = g.roles.cache.get(rid);
          if (role && role.editable) {
            await m.roles.add(rid, '[IA] Restored role upon case closure');
          }
        }
        restoredGuilds++;
      } catch {
        errors++;
      }
    });
    await Promise.all(tasks);

    if (record.channelId) {
      const ch = await client.channels.fetch(record.channelId).catch(() => null);
      if (ch && ch.isTextBased()) {
        const closedMsg = infoEmbed('Internal Affairs Case Closed', `Notes: ${reason}`);
        await (ch as any).send({ embeds: [closedMsg] }).catch(() => null);
        await (ch as any).delete().catch(() => null);
      }
    }

    await closeCase(user.id, { closedBy: interaction.user.id, closedAt: new Date().toISOString(), closeReason: reason });

    await interaction.editReply({ embeds: [successEmbed('IA Case Closed', `Roles restored in ${restoredGuilds} guild(s). Errors: ${errors}.`)] });
  }
};

const command: BotCommand = { data, execute, requiredLevel: 'Senior Staff' };
export default command;
