import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import type { Client } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { hasRequiredLevel, highestMappedRole } from '../../services/permissions.js';
import { ROLE_HIERARCHY } from '../../config/permissions.js';
import { globalSetNickname } from '../../services/globalActions.js';

const data = new SlashCommandBuilder()
  .setName('mnick')
  .setDescription('Updates a nickname across all Magonila Project guilds.')
  .addStringOption(opt =>
    opt
      .setName('nickname')
      .setDescription('The nickname to set (max 32 characters).')
      .setRequired(true)
  )
  .addUserOption(opt =>
    opt
      .setName('user')
      .setDescription('Target user to rename (Staff In Training+ only).')
      .setRequired(false)
  );

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')], ephemeral: true });
    return;
  }

  const nickname = interaction.options.getString('nickname', true).trim();
  if (nickname.length === 0 || nickname.length > 32) {
    await interaction.reply({
      embeds: [errorEmbed('Invalid Nickname', 'Nickname must be between 1 and 32 characters.')],
      ephemeral: true
    });
    return;
  }

  const targetUser: User | null = interaction.options.getUser('user');
  const selfMember = await guild.members.fetch(interaction.user.id);

  const isSelf = !targetUser || targetUser.id === interaction.user.id;

  if (isSelf) {
    const allowed = hasRequiredLevel(selfMember, 'Member');
    if (!allowed) {
      await interaction.reply({ embeds: [errorEmbed('Insufficient Permission', 'You must be Member or higher to change your nickname.')], ephemeral: true });
      return;
    }
  } else {
    const allowed = hasRequiredLevel(selfMember, 'Staff In Training');
    if (!allowed) {
      await interaction.reply({ embeds: [errorEmbed('Insufficient Permission', 'You must be Staff In Training or higher to change another user\'s nickname.')], ephemeral: true });
      return;
    }
  }

  const targetId = isSelf ? interaction.user.id : targetUser!.id;

  if (client.user && targetId === client.user.id) {
    await interaction.reply({ embeds: [errorEmbed('Invalid Target', 'You cannot modify the bot\'s nickname.')], ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: false });

  const results = await globalSetNickname(client, targetId, nickname, `Nickname set by ${interaction.user.tag}`);
  const ok = results.filter((r: { ok: boolean }) => r.ok).length;
  const fail = results.length - ok;

  await interaction.editReply({ embeds: [successEmbed('Nickname Update Result', `Operation complete. Success: ${ok}. Failed: ${fail}.`)] });
};

const command: BotCommand = { data, execute, requiredLevel: 'Member' };
export default command;
