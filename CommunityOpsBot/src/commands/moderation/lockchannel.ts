import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import type { Client, GuildTextBasedChannel, PermissionResolvable } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { hasRequiredLevel } from '../../services/permissions.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

const data = new SlashCommandBuilder()
  .setName('lockchannel')
  .setDescription('Lock or unlock the current channel for @everyone (Staff In Training+).')
  .addStringOption(opt =>
    opt.setName('action')
      .setDescription('Choose whether to lock or unlock this channel')
      .setRequired(true)
      .addChoices(
        { name: 'Lock', value: 'lock' },
        { name: 'Unlock', value: 'unlock' }
      )
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

  const action = interaction.options.getString('action', true) as 'lock' | 'unlock';
  const ch = interaction.channel as GuildTextBasedChannel | null;
  if (!ch || (ch.type !== ChannelType.GuildText && ch.type !== ChannelType.GuildAnnouncement)) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unsupported', 'Only standard text or announcement channels can be locked with this command.')] });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const everyone = interaction.guild!.roles.everyone;

    if (action === 'lock') {
      await ch.permissionOverwrites.edit(everyone, { SendMessages: false });
      await interaction.editReply({ embeds: [successEmbed('Channel Locked', 'This channel has been locked for @everyone.')] });
    } else {
      // Remove explicit deny; setting to null clears the overwrite
      await ch.permissionOverwrites.edit(everyone, { SendMessages: null });
      await interaction.editReply({ embeds: [successEmbed('Channel Unlocked', 'This channel has been unlocked for @everyone.')] });
    }
  } catch (err: any) {
    await interaction.editReply({ embeds: [errorEmbed('Action Failed', err?.message || 'An error occurred while updating channel permissions.')] });
  }
};

const command: BotCommand = { data, execute, requiredLevel: 'Staff In Training' };
export default command;
