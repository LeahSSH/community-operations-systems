import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Client } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { REQUIRED_FOR } from '../../config/permissions.js';
import { hasRequiredLevel } from '../../services/permissions.js';
import { globalUnban } from '../../services/globalActions.js';

export const data = new SlashCommandBuilder()
  .setName('guban')
  .setDescription('Globally unbans a user from all guilds the bot is in.')
  .addStringOption(opt => opt.setName('user_id').setDescription('The user ID to unban.').setRequired(true))
  .addStringOption(opt => opt.setName('reason').setDescription('Reason for the unban.').setRequired(false));

export const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member || !hasRequiredLevel(member, REQUIRED_FOR.guban)) {
    await interaction.reply({
      embeds: [errorEmbed('Insufficient Permission', 'You lack the required role to use this command.')],
      ephemeral: true
    });
    return;
  }

  const userId = interaction.options.getString('user_id', true);
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (userId === interaction.user.id) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid Target', 'You cannot unban yourself.')],
      ephemeral: true
    });
    return;
  }
  if (client.user && userId === client.user.id) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid Target', 'You cannot unban the bot.')],
      ephemeral: true
    });
    return;
  }

  await interaction.deferReply({ ephemeral: false });
  const results = await globalUnban(client, userId, `Global Unban by ${interaction.user.tag}: ${reason}`);

  const ok = results.filter(r => r.ok).length;
  const fail = results.length - ok;

  await interaction.editReply({
    embeds: [
      successEmbed('Global Unban Result', `Operation complete. Success: ${ok}. Failed: ${fail}.`)
    ]
  });
};

const command: BotCommand = { data, execute, requiredLevel: 'Junior Administration' };
export default command;
