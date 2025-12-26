import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection, Interaction, REST, Routes, ActivityType, ButtonInteraction, TextChannel, ChannelType } from 'discord.js';
import { loadCommands } from './registry/loader.js';
import type { BotCommand } from './types/command.js';
import { hasRequiredLevel } from './services/permissions.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.GuildMember]
});

const commands = new Collection<string, BotCommand>();

async function bootstrap() {
  const loaded = await loadCommands();
  for (const cmd of loaded) {
    commands.set(cmd.data.name, cmd);
  }
  (client as any).commands = commands;

async function handleButtons(interaction: ButtonInteraction) {
  const { customId } = interaction;
  if (!customId.startsWith('alloc:')) return;
  const parts = customId.split(':');
  if (parts.length !== 3) return;
  const action = parts[1];
  const targetUserId = parts[2];

  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      embeds: [
        { title: 'Unavailable', description: 'This action must be performed in a server.', color: 0xC53030 }
      ],
      ephemeral: true
    }).catch(() => {});
    return;
  }

  const reviewer = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!reviewer || !hasRequiredLevel(reviewer, 'Senior Staff')) {
    await interaction.reply({
      embeds: [
        { title: 'Insufficient Permission', description: 'Senior Staff or higher is required to review allocation requests.', color: 0xC53030 }
      ],
      ephemeral: true
    }).catch(() => {});
    return;
  }

  if (action === 'approve') {
    const recruitRoleId = process.env.RECRUIT_ROLE_ID;
    if (!recruitRoleId) {
      await interaction.reply({
        embeds: [
          { title: 'Configuration Error', description: 'Recruit role is not configured.', color: 0xC53030 }
        ],
        ephemeral: true
      }).catch(() => {});
      return;
    }

    const applicant = await guild.members.fetch(targetUserId).catch(() => null);
    if (!applicant) {
      await interaction.reply({
        embeds: [
          { title: 'Not Found', description: 'The applicant is not present in this server.', color: 0xC53030 }
        ],
        ephemeral: true
      }).catch(() => {});
      return;
    }

    try {
      await applicant.roles.add(recruitRoleId, `Allocation approved by ${interaction.user.tag}`);
    } catch {
      await interaction.reply({
        embeds: [
          { title: 'Role Assignment Failed', description: 'Unable to assign the recruit role. Verify role hierarchy and permissions.', color: 0xC53030 }
        ],
        ephemeral: true
      }).catch(() => {});
      return;
    }

    // DM applicant with detailed information
    try {
      const embed0 = interaction.message.embeds?.[0];
      const fields = embed0?.fields ?? [];
      const getField = (n: string) => fields.find(f => f.name.toLowerCase() === n.toLowerCase())?.value ?? 'N/A';
      const applicantName = getField('Name');
      const onboarderField = getField('Onboarder');
      const requestedDate = getField('Requested Date');

      await applicant.user.send({
        embeds: [
          {
            title: 'Allocation Approved',
            description: 'Your allocation request has been reviewed and approved. You have been granted Recruit tags in the Discord. Please review the details below and contact your onboarder if you have any questions.',
            color: 0x2F855A,
            fields: [
              { name: 'Server', value: guild.name, inline: false },
              { name: 'Applicant', value: `${applicant.user.tag} (${applicant.user.id})`, inline: false },
              { name: 'Name', value: applicantName, inline: true },
              { name: 'Onboarder', value: onboarderField, inline: true },
              { name: 'Requested Date', value: requestedDate, inline: false },
              { name: 'Reviewer', value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
              { name: 'Timestamp', value: new Date().toISOString(), inline: false }
            ]
          }
        ]
      });
    } catch {}

    // Update review message
    try {
      await interaction.update({
        embeds: [
          {
            title: 'Allocation Request — Approved',
            description: `Approved by ${interaction.user.tag}. Recruit role assigned.`,
            color: 0x2F855A
          }
        ],
        components: []
      });
    } catch {
      await interaction.reply({
        embeds: [
          { title: 'Approved', description: 'Recruit role assigned and applicant notified.', color: 0x2F855A }
        ],
        ephemeral: true
      }).catch(() => {});
    }
  } else if (action === 'deny') {
    try {
      await interaction.update({
        embeds: [
          {
            title: 'Allocation Request — Denied',
            description: `Denied by ${interaction.user.tag}.`,
            color: 0xC53030
          }
        ],
        components: []
      });
    } catch {
      await interaction.reply({
        embeds: [
          { title: 'Denied', description: 'The request has been marked as denied.', color: 0xC53030 }
        ],
        ephemeral: true
      }).catch(() => {});
    }
  }
}

async function applyPresence(mode: 'development' | 'production') {
  if (!client.user) return;
  if (mode === 'development') {
    await client.user.setPresence({
      status: 'dnd',
      activities: [
        { name: 'Currently in Development State', type: ActivityType.Watching }
      ]
    });
  } else {
    await client.user.setPresence({
      status: 'online',
      activities: [
        { name: 'Overwatching Magnolia Project', type: ActivityType.Watching }
      ]
    });
  }
}

  client.once('ready', async () => {
    drawStartupBanner({
      userTag: client.user?.tag ?? 'Unknown',
      mode: process.env.MODE === 'development' ? 'Development (Guild Commands)' : 'Production (Global Commands)',
      commandCount: commands.size
    });
    try {
      await applyPresence(process.env.MODE === 'development' ? 'development' : 'production');
    } catch {}
    try {
      await registerCommands(Array.from(commands.values()));
      console.log('[REGISTER] Commands are synchronized.');
    } catch (e) {
      console.error('[REGISTER ERROR]', e);
    }
  });

  client.on('interactionCreate', async (interaction: Interaction) => {
    if (interaction.isButton()) {
      await handleButtons(interaction as ButtonInteraction);
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const command = commands.get(interaction.commandName);
    if (!command) return;
    const mainGuildId = process.env.MAIN_GUILD_ID;
    if (
      mainGuildId &&
      !command.allowAllGuilds &&
      interaction.guildId &&
      interaction.guildId !== mainGuildId
    ) {
      await interaction.reply({
        embeds: [
          {
            title: 'Unavailable Here',
            description: 'This command is restricted to the main Discord server.',
            color: 0xB7791F
          }
        ],
        ephemeral: true
      }).catch(() => {});
      return;
    }

    try {
      await command.execute(interaction, client);
    } catch (err) {
      console.error('[ERROR] Command execution failed:', err);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          embeds: [
            {
              title: 'Internal Error',
              description: 'An unexpected error occurred while processing this request.',
              color: 0xCC0000
            }
          ],
          ephemeral: true
        }).catch(() => {});
      } else {
        await interaction.reply({
          embeds: [
            {
              title: 'Internal Error',
              description: 'An unexpected error occurred while processing this request.',
              color: 0xCC0000
            }
          ],
          ephemeral: true
        }).catch(() => {});
      }
    }
  });

  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN is not set');
  await client.login(token);
}

async function registerCommands(all: BotCommand[]) {
  const applicationId = process.env.APPLICATION_ID;
  const token = process.env.DISCORD_TOKEN;
  const isDev = process.env.MODE === 'development';
  const devGuildId = process.env.DEV_GUILD_ID;
  if (!applicationId) throw new Error('APPLICATION_ID is not set');
  if (!token) throw new Error('DISCORD_TOKEN is not set');

  const rest = new REST({ version: '10' }).setToken(token);
  const body = all.map((c) => c.data.toJSON());

  if (isDev) {
    if (!devGuildId) throw new Error('DEV_GUILD_ID is required in development mode');
    await rest.put(Routes.applicationGuildCommands(applicationId, devGuildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(applicationId), { body });
  }
}

function drawStartupBanner(info: { userTag: string; mode: string; commandCount: number }) {
  const lines = [
    'Magonila Project Bot',
    `Account: ${info.userTag}`,
    `Mode: ${info.mode}`,
    `Commands: ${info.commandCount}`,
    `Node: ${process.version}`,
    `Started: ${new Date().toISOString()}`
  ];
  const width = Math.max(...lines.map((l) => l.length)) + 2;
  const border = '─'.repeat(width);
  console.log(`\n┌${border}┐`);
  for (const l of lines) {
    const padding = ' '.repeat(width - l.length);
    console.log(`│${l}${padding}│`);
  }
  console.log(`└${border}┘\n`);
}

bootstrap().catch((e) => {
  console.error('[FATAL] Bootstrap failed:', e);
  process.exit(1);
});
