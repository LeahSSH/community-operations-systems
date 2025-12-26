import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import type { Client } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { errorEmbed } from '../../utils/embeds.js';

const data = new SlashCommandBuilder()
  .setName('status')
  .setDescription('Shows the current status of the FiveM server.')
  .addStringOption(opt =>
    opt
      .setName('server')
      .setDescription('Select the server to check the status')
      .setRequired(true)
      .addChoices({ name: 'Server 1', value: '1' })
  );

const execute = async (interaction: ChatInputCommandInteraction, _client: Client) => {
  if (!interaction.inGuild()) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command must be used in a server.')] });
    return;
  }

  const mainGuildId = process.env.MAIN_GUILD_ID;
  if (mainGuildId && interaction.guildId !== mainGuildId) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Unavailable', 'This command can only be used in the main guild.')] });
    return;
  }

  const server = interaction.options.getString('server', true);
  const ip = process.env.FIVEM_SERVER_1_IP;
  const maxPlayers = Number(process.env.FIVEM_MAX_PLAYERS || 64);

  if (!ip) {
    await interaction.reply({ ephemeral: true, embeds: [errorEmbed('Configuration Error', 'FIVEM_SERVER_1_IP is not configured.')] });
    return;
  }

  await interaction.deferReply();

  const url = `http://${ip}/players.json`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'MagonilaBot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Array<{ id: number; name: string }>;
    const players = Array.isArray(data) ? data : [];

    const count = players.length;
    const embed = new EmbedBuilder()
      .setTitle(`Server ${server} Status`)
      .setColor(0x2B6CB0)
      .setDescription(`Players: ${count}/${maxPlayers}`)
      .setTimestamp(new Date());

    if (count === 0) {
      embed.addFields({ name: 'Players', value: 'There are currently no players online.' });
    } else {
      // List up to 25 players to avoid exceeding embed limits
      const lines = players.slice(0, 25).map(p => `[#${p.id}] ${p.name}`);
      const more = players.length - lines.length;
      embed.addFields({ name: 'Players', value: lines.join('\n'), inline: false });
      if (more > 0) embed.addFields({ name: 'More', value: `...and ${more} more.`, inline: false });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    await interaction.editReply({ embeds: [errorEmbed('Fetch Failed', err?.message || 'An error occurred fetching the server data.')], allowedMentions: { parse: [] } });
  }
};

const command: BotCommand = { data, execute, requiredLevel: 'Member' };
export default command;
