import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import type { Client, GuildMember } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { hasRequiredLevel } from '../../services/permissions.js';

const data = new SlashCommandBuilder()
  .setName('rec-onboard')
  .setDescription('Assign the Recruit role to a user (Staff+).')
  .addUserOption(opt =>
    opt.setName('user').setDescription('User to tag as Recruit').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('allocation_link').setDescription('Message link to the user\'s allocation request').setRequired(true)
  );

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')], });
    return;
  }

  const mainGuildId = process.env.MAIN_GUILD_ID;
  if (mainGuildId && interaction.guildId !== mainGuildId) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command can only be used in the main guild.')] });
    return;
  }

  const memberInvoker = await interaction.guild!.members.fetch(interaction.user.id);
  if (!hasRequiredLevel(memberInvoker, 'Staff')) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Insufficient Permission', 'You must be Staff or higher to use this command.')] });
    return;
  }

  const recruitRoleId = process.env.RECRUIT_ROLE_ID;
  if (!recruitRoleId) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Configuration Error', 'RECRUIT_ROLE_ID is not configured.')] });
    return;
  }

  const targetUser = interaction.options.getUser('user', true);
  const link = interaction.options.getString('allocation_link', true).trim();
  const guild = await client.guilds.fetch(interaction.guildId!);
  const targetMember: GuildMember | null = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Not Found', 'The specified user is not in this guild.')] });
    return;
  }

  if (targetMember.roles.cache.has(recruitRoleId)) {
    await interaction.reply({ ephemeral: true, embeds: [successEmbed('No Changes', `<@${targetUser.id}> already has the Recruit role.`)] });
    return;
  }

  // Parse the message link and attempt to extract TS3/WebID/SteamHex from the allocation review embed
  let parsedTs3: string | undefined;
  let parsedWebId: string | undefined;
  let parsedSteamHex: string | undefined;

  try {
    const url = new URL(link);
    const parts = url.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'channels');
    if (idx !== -1 && parts.length >= idx + 4) {
      const guildId = parts[idx + 1];
      const channelId = parts[idx + 2];
      const messageId = parts[idx + 3];
      if (!guildId || !channelId || !messageId) throw new Error('Invalid link format.');
      if (guildId !== interaction.guildId) throw new Error('The provided link is not for this guild.');

      const ch = await interaction.guild!.channels.fetch(channelId).catch(() => null);
      if (ch && ch.type === ChannelType.GuildText) {
        const msg = await ch.messages.fetch(messageId).catch(() => null);
        const emb = msg?.embeds?.[0];
        const fields = emb?.fields || [];
        const getField = (label: string) => fields.find(f => f.name?.toLowerCase() === label.toLowerCase())?.value?.trim();
        parsedTs3 = getField('Teamspeak UID');
        parsedWebId = getField('Website ID');
        parsedSteamHex = getField('Steam Hex');
      }
    }
  } catch {}

  try {
    await targetMember.roles.add(recruitRoleId);
    const details = [
      parsedTs3 ? `TS3: ${parsedTs3}` : null,
      parsedWebId ? `Web ID: ${parsedWebId}` : null,
      parsedSteamHex ? `Steam Hex: ${parsedSteamHex}` : null,
    ].filter(Boolean).join(' \u2022 ');

    const summary = details ? `Recruit role assigned to <@${targetUser.id}>. ${details}` : `Recruit role assigned to <@${targetUser.id}>.`;
    await interaction.reply({ ephemeral: true, embeds: [successEmbed('Recruit Assigned', summary)] });
  } catch (err: any) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Failed', err?.message || 'Could not assign the Recruit role.')] });
  }
};

const command: BotCommand = { data, execute, requiredLevel: 'Staff' };
export default command;
