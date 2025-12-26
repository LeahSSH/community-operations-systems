import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, type MessageActionRowComponentBuilder } from 'discord.js';
import type { Client } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed } from '../../utils/embeds.js';
import { hasRequiredLevel } from '../../services/permissions.js';

const data = new SlashCommandBuilder()
  .setName('weblookup')
  .setDescription('Lookup a member on the website by Web ID and return a quick link.')
  .addStringOption(opt =>
    opt.setName('id')
      .setDescription('The Web ID to look up (numeric or slug, as used on the website).')
      .setRequired(true)
  );

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')] });
    return;
  }

  const member = await interaction.guild!.members.fetch(interaction.user.id);
  if (!hasRequiredLevel(member, 'Staff In Training')) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Insufficient Permission', 'You must be Staff In Training or higher to use this command.')] });
    return;
  }

  const rawId = interaction.options.getString('id', true).trim();
  const base = (process.env.INVISION_BASE_URL || '').replace(/\/$/, '');
  const profilePath = (process.env.INVISION_PROFILE_PATH || '/profile').replace(/^\//, '');
  const color = Number(process.env.INVISION_EMBED_COLOR || 0x2B6CB0);
  const apiBaseRaw = (process.env.INVISION_API_BASE_URL || process.env.INVSION_API_BASE_URL || '').replace(/\/$/, '');
  const apiKey = process.env.INVISION_API_KEY || '';

  if (!base) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Configuration Error', 'INVISION_BASE_URL is not configured.')] });
    return;
  }

  let url = `${base}/${profilePath}/${encodeURIComponent(rawId)}`;

  // If URL is just /profile/{id}, append a dummy slug to trigger IPS auto-correct redirect
  if (url && url.includes('/profile/') && url.endsWith(`/${encodeURIComponent(rawId)}`)) {
    url = `${url}-x`;
  }

  // Try to resolve redirect for constructed URL to capture slug
  if (url && url.includes('/profile/') && url.includes(`/${encodeURIComponent(rawId)}`)) {
    try {
      const probe = await fetch(url, { method: 'GET', redirect: 'manual' as any });
      const loc = (probe.headers as any).get('location');
      if (loc && /^https?:\/\//i.test(loc)) {
        url = loc;
      }
    } catch {}
  }

  // If still not slugged, attempt to read HTML and extract canonical/og:url
  if (url && url.includes('/profile/') && url.includes(`/${encodeURIComponent(rawId)}`)) {
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'follow' });
      if (res.ok) {
        const html = await res.text();
        const canonMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i);
        const ogMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["'][^>]*>/i);
        const found = (canonMatch?.[1] || ogMatch?.[1] || '').trim();
        if (found && found.startsWith('http') && found.includes('/profile/')) {
          url = found;
        }
      }
    } catch {}
  }

  const embed = new EmbedBuilder()
    .setTitle('Invision Profile Lookup')
    .setURL(url)
    .setDescription('Use the button below to open the member\'s profile.')
    .setColor(color)
    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
    .setTimestamp(new Date());

  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('View Profile').setURL(url)
  );

  await interaction.reply({ embeds: [embed], components: [row] as any });
};

const command: BotCommand = { data, execute, requiredLevel: 'Staff In Training' };
export default command;
