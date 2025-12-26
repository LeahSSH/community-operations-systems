import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { Client } from 'discord.js';
import { BotCommand } from '../../types/command.js';
import { infoEmbed } from '../../utils/embeds.js';
import { hasRequiredLevel } from '../../services/permissions.js';

function formatList(items: string[]): string {
  if (!items || items.length === 0) return 'None';
  return items.map(n => `• /${n}`).join('\n');
}

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show commands available to you based on your permission level.');

const execute = async (interaction: ChatInputCommandInteraction, client: Client) => {
  await interaction.deferReply({ ephemeral: true });

  const commands = Array.from(((client as any).commands as Map<string, BotCommand>).values());
  const mainGuildId = process.env.MAIN_GUILD_ID;
  const inMainGuild = interaction.guildId && mainGuildId ? interaction.guildId === mainGuildId : true;

  const everyone = commands
    .filter(c => !c.requiredLevel)
    .filter(c => inMainGuild || c.allowAllGuilds)
    .map(c => c.data.name)
    .sort((a, b) => a.localeCompare(b));

  let accessible: string[] = [];
  if (interaction.inGuild()) {
    const member = await interaction.guild!.members.fetch(interaction.user.id);
    accessible = commands
      .filter(c => (inMainGuild || c.allowAllGuilds))
      .filter(c => {
        if (!c.requiredLevel) return true;
        return hasRequiredLevel(member, c.requiredLevel);
      })
      .map(c => c.data.name)
      .sort((a, b) => a.localeCompare(b));
  } else {
    accessible = [...everyone];
  }

  const embed = infoEmbed('Command Help', 'Below are commands available to you based on your current permission level.');
  (embed.fields ??= []).push(
    { name: 'Your Commands', value: formatList(accessible) },
    { name: 'Everyone Commands', value: formatList(everyone) }
  );

  await interaction.editReply({ embeds: [embed] });
};

const command: BotCommand = { data, execute, allowAllGuilds: true };
export default command;
