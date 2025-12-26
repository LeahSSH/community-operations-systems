import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from 'discord.js';
import type { Client, GuildMember } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';

function isAllowedVideoUrl(input: string, allowedDomains: string[]): boolean {
  try {
    const u = new URL(input);
    if (u.protocol !== 'https:') return false;
    const host = (u.hostname || '').toLowerCase();
    return allowedDomains.some(d => {
      const dom = d.toLowerCase();
      return host === dom || host.endsWith(`.${dom}`);
    });
  } catch {
    return false;
  }
}

const data = new SlashCommandBuilder()
  .setName('media')
  .setDescription('Post a media link to the media notification channel')
  .addStringOption(option =>
    option.setName('url')
      .setDescription('Video URL (must start with https:// and be an allowed domain)')
      .setRequired(true)
  );

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  await interaction.deferReply({ ephemeral: true });

  const member = await interaction.guild?.members.fetch(interaction.user.id);
  if (!member) {
    await interaction.editReply({ embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')] });
    return;
  }

  const url = interaction.options.getString('url', true).trim();

  const allowedEnv = process.env.MEDIA_ALLOWED_DOMAINS?.split(',').map(s => s.trim()).filter(Boolean) ?? [];
  const allowed = allowedEnv.length > 0 ? allowedEnv : ['youtube.com', 'youtu.be', 'tiktok.com', 'twitch.tv'];

  if (!isAllowedVideoUrl(url, allowed)) {
    await interaction.editReply({ embeds: [errorEmbed('Invalid URL', `Please provide a valid link from: ${allowed.join(', ')}`)] });
    return;
  }

  const channelId = process.env.MEDIA_NOTIFY_CHANNEL_ID || '';
  const roleId = process.env.MEDIA_NOTIFY_ROLE_ID || '';
  if (!channelId) {
    await interaction.editReply({ embeds: [errorEmbed('Configuration Error', 'MEDIA_NOTIFY_CHANNEL_ID is not set.')] });
    return;
  }

  // Optional: require a specific media role if configured
  if (roleId && !member.roles.cache.has(roleId)) {
    await interaction.editReply({ embeds: [errorEmbed('Permission Denied', 'This command is restricted to members with the Media role.')] });
    return;
  }

  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) {
    await interaction.editReply({ embeds: [errorEmbed('Configuration Error', 'Media notification channel is invalid or inaccessible.')] });
    return;
  }

  const color = Number(process.env.MEDIA_EMBED_COLOR || 0x2F3136);
  const logo = process.env.MEDIA_LOGO_URL || '';

  const host = (new URL(url)).hostname.toLowerCase();
  let title = 'New Media';
  let siteColor = color;
  if (host.includes('youtube.com') || host.includes('youtu.be')) {
    title = 'YouTube Upload';
    siteColor = 0xFF0000;
  } else if (host.includes('tiktok.com')) {
    title = 'TikTok Post';
    siteColor = 0x000000;
  } else if (host.includes('twitch.tv')) {
    title = 'Twitch Stream';
    siteColor = 0x9146FF;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${interaction.user.username} posted: [Watch here](${url})`)
    .setColor(siteColor)
    .setTimestamp();
  if (logo) embed.setThumbnail(logo);

  const content = 'Media Notified';

  await (channel as TextChannel).send({ content, embeds: [embed] });
  await interaction.editReply({ embeds: [successEmbed('Posted', 'Your video link has been sent to the media notification channel.')] });
};

const command: BotCommand = { data, execute };
export default command;
