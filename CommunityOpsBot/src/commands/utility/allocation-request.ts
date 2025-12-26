import { SlashCommandBuilder, ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType, EmbedBuilder, type MessageActionRowComponentBuilder } from 'discord.js';
import type { Client } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

const data = new SlashCommandBuilder()
  .setName('allocation-request')
  .setDescription('Submits an allocation request for review by Senior Staff+.')
  .addStringOption(opt => opt.setName('name').setDescription('Your full name.').setRequired(true))
  .addUserOption(opt => opt.setName('onboarder').setDescription('Your onboarder.').setRequired(true))
  .addStringOption(opt => opt.setName('date').setDescription('Requested allocation date (e.g., 2025-11-07).').setRequired(true))
  .addStringOption(opt => opt.setName('ts3').setDescription('Your Teamspeak UID').setRequired(true))
  .addStringOption(opt => opt.setName('webid').setDescription('Your Website ID').setRequired(true))
  .addStringOption(opt => opt.setName('steamhex').setDescription('Your Steam Hex').setRequired(true));

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')], ephemeral: true });
    return;
  }

  const member = await guild.members.fetch(interaction.user.id);

  const name = interaction.options.getString('name', true).trim();
  const onboarder = interaction.options.getUser('onboarder', true);
  const date = interaction.options.getString('date', true).trim();
  const ts3 = interaction.options.getString('ts3', true).trim();
  const webid = interaction.options.getString('webid', true).trim();
  const steamhex = interaction.options.getString('steamhex', true).trim();

  const channelId = process.env.ALLOCATION_REVIEW_CHANNEL_ID;
  if (!channelId) {
    await interaction.reply({ embeds: [errorEmbed('Configuration Error', 'Review channel is not configured.')], ephemeral: true });
    return;
  }

  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({ embeds: [errorEmbed('Configuration Error', 'The configured review channel is invalid or not a text channel.')], ephemeral: true });
    return;
  }

  const rolesList = member.roles.cache
    .filter(r => r.name !== '@everyone')
    .map(r => `<@&${r.id}>`)
    .join(', ') || 'None';

  const reviewEmbed = new EmbedBuilder()
    .setTitle('Allocation Request')
    .setDescription('A new allocation request has been submitted and is pending review by Senior Staff or higher.\n\nReviewer Instruction: Prior to approval, please run `/rec-onboard [user]` to assign the Recruit role. Approval should proceed only after the user has the Recruit role.')
    .setColor(0x2B6CB0)
    .setAuthor({
      name: `${interaction.user.tag} (${interaction.user.id})`,
      iconURL: interaction.user.displayAvatarURL()
    })
    .setThumbnail(interaction.user.displayAvatarURL())
    .addFields(
      { name: 'Applicant', value: `${interaction.user}`, inline: false },
      { name: 'Name', value: name, inline: true },
      { name: 'Onboarder', value: `${onboarder}`, inline: true },
      { name: 'Requested Date', value: date, inline: true },
      { name: 'Teamspeak UID', value: ts3, inline: true },
      { name: 'Website ID', value: webid, inline: true },
      { name: 'Steam Hex', value: steamhex, inline: true },
      { name: 'Account Created', value: `<t:${Math.floor(interaction.user.createdTimestamp / 1000)}:F>`, inline: true },
      { name: 'Member Since', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : 'Unknown', inline: true },
      { name: 'Current Roles', value: rolesList, inline: false }
    )
    .setFooter({ text: `Applicant ID: ${interaction.user.id} • Onboarder ID: ${onboarder.id}` })
    .setTimestamp(new Date());

  const approveId = `alloc:approve:${interaction.user.id}`;
  const denyId = `alloc:deny:${interaction.user.id}`;

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(approveId).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(denyId).setLabel('Deny').setStyle(ButtonStyle.Danger)
  );

  await (channel as TextChannel).send({ embeds: [reviewEmbed], components: [row] as any });

  await interaction.reply({ embeds: [successEmbed('Request Submitted', 'Your allocation request has been submitted for review. You will be notified upon a decision.')], ephemeral: true });
};

const command: BotCommand = { data, execute };
export default command;
