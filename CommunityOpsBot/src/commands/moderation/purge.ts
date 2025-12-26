import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, ChannelType, EmbedBuilder } from 'discord.js';
import type { Client, GuildTextBasedChannel } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { hasRequiredLevel } from '../../services/permissions.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

const data = new SlashCommandBuilder()
  .setName('purge')
  .setDescription('Bulk delete a number of recent messages in this channel (<= 100, < 14 days).')
  .addIntegerOption(opt =>
    opt.setName('amount')
      .setDescription('Number of messages to delete (1-100).')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(100)
  );

const execute = async (interaction: ChatInputCommandInteraction, _client: Client) => {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')] });
    return;
  }

  const member = await interaction.guild!.members.fetch(interaction.user.id);
  if (!hasRequiredLevel(member, 'Staff In Training')) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Insufficient Permission', 'You must be Staff In Training or higher to use this command.')] });
    return;
  }

  const amount = interaction.options.getInteger('amount', true);
  const ch = interaction.channel as GuildTextBasedChannel | null;
  if (!ch || (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.PublicThread && ch.type !== ChannelType.PrivateThread && ch.type !== ChannelType.GuildAnnouncement)) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unsupported', 'This channel type does not support bulk deletion.')] });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const canBulk = typeof (ch as any).bulkDelete === 'function';
    if (!canBulk) throw new Error('This channel type does not support bulk deletion.');
    const res = await (ch as any).bulkDelete(amount, true);
    const deleted = res?.size ?? 0;

    const embed = successEmbed('Purge Complete', `${deleted} message(s) were deleted.`);
    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [errorEmbed('Failed to Purge', err?.message || 'An error occurred while deleting messages.')] });
  }
};

const command: BotCommand = { data, execute, requiredLevel: 'Staff In Training' };
export default command;
