import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType } from 'discord.js';
import type { Client, GuildMember, Role } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { hasRequiredLevel } from '../../services/permissions.js';

const DEPARTMENTS = [
  'Police Department',
  'Sheriffs Office',
  'State Police',
  'Fire Rescue',
  'Civilian Operations',
  'Communications',
] as const;

type Dept = typeof DEPARTMENTS[number];

function findDepartmentRole(guildRoles: Map<string, Role>, dept: Dept): Role | undefined {
  const needle = dept.toLowerCase();
  for (const role of guildRoles.values()) {
    if (role.name.toLowerCase() === needle || role.name.toLowerCase().includes(needle)) return role;
  }
  return undefined;
}

const data = new SlashCommandBuilder()
  .setName('onboard')
  .setDescription('Onboard a Recruit into the community (sets nickname, removes Recruit, assigns department).')
  .addUserOption(opt =>
    opt.setName('user').setDescription('User to onboard (must currently have Recruit)').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('name').setDescription("User's roleplay name (nickname will be set)").setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('department').setDescription('Department to assign').setRequired(true)
      .addChoices(
        { name: 'Baton Rouge Police Department', value: 'Police Department' },
        { name: 'East Baton Rouge Parish Sheriff\'s Office', value: 'Sheriffs Office' },
        { name: 'Louisiana State Police', value: 'State Police' },
        { name: 'Baton Rouge Fire Department', value: 'Fire Rescue' },
        { name: 'Civilian Operations', value: 'Civilian Operations' },
        { name: 'Communications', value: 'Communications' },
      )
  )
  .addStringOption(opt =>
    opt.setName('webid').setDescription('Website ID (optional, used only for logging)').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('ts3').setDescription('Teamspeak UID (optional, used only for logging)').setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('steamhex').setDescription('Steam Hex (optional, used only for logging)').setRequired(true)
  );

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')] });
    return;
  }

  // Main guild restriction
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

  const targetUser = interaction.options.getUser('user', true);
  const rpName = interaction.options.getString('name', true);
  const department = interaction.options.getString('department', true) as Dept;
  const webId = interaction.options.getString('webid') || undefined;
  const ts3 = interaction.options.getString('ts3') || undefined;
  const steamhex = interaction.options.getString('steamhex') || undefined;

  const recruitRoleId = process.env.RECRUIT_ROLE_ID;
  if (!recruitRoleId) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Configuration Error', 'RECRUIT_ROLE_ID is not configured.')] });
    return;
  }

  const guild = await client.guilds.fetch(interaction.guildId!);
  const targetMember: GuildMember | null = await guild.members.fetch(targetUser.id).catch(() => null);
  if (!targetMember) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Not Found', 'The specified user is not in this guild.')] });
    return;
  }

  // Must currently have the Recruit role
  if (!targetMember.roles.cache.has(recruitRoleId)) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Invalid State', 'The target does not have the Recruit role. Assign it with /rec-onboard first.')] });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  // Find department role (by name match)
  const deptRole = findDepartmentRole(guild.roles.cache, department);
  if (!deptRole) {
    await interaction.editReply({ embeds: [errorEmbed('Role Missing', `Could not find a role matching "${department}". Please create or rename the role to match.`)] });
    return;
  }

  // Apply changes
  try {
    // Set nickname
    await targetMember.setNickname(rpName).catch(() => {});

    // Remove Recruit
    await targetMember.roles.remove(recruitRoleId).catch(() => {});

    // Assign department
    await targetMember.roles.add(deptRole).catch(() => {});

    const embed = new EmbedBuilder()
      .setTitle('User Onboarded')
      .setColor(0x2B6CB0)
      .addFields(
        { name: 'User', value: `<@${targetUser.id}> (${targetUser.id})`, inline: false },
        { name: 'Roleplay Name', value: rpName, inline: true },
        { name: 'Department', value: department, inline: true },
        { name: 'Website ID', value: webId ?? 'Not Provided', inline: true },
        { name: 'Teamspeak UID', value: ts3 ?? 'Not Provided', inline: true },
        { name: 'Steam Hex', value: steamhex ?? 'Not Provided', inline: true },
        { name: 'Moderator', value: `<@${memberInvoker.id}>`, inline: false },
      )
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [successEmbed('Onboarding Complete', `Successfully onboarded <@${targetUser.id}> into ${department}.`)] });

    // Try to log to current channel non-ephemerally if it's a text channel
    const ch = interaction.channel;
    if (ch && (ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)) {
      await (ch as any).send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err: any) {
    await interaction.editReply({ embeds: [errorEmbed('Failed', err?.message || 'An error occurred while onboarding.')] });
  }
};

const command: BotCommand = { data, execute, requiredLevel: 'Staff' };
export default command;
