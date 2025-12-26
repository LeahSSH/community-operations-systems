import { APIEmbed } from 'discord.js';

export function infoEmbed(title: string, description: string): APIEmbed {
  return { title, description, color: 0x2B6CB0 };
}

export function successEmbed(title: string, description: string): APIEmbed {
  return { title, description, color: 0x2F855A };
}

export function errorEmbed(title: string, description: string): APIEmbed {
  return { title, description, color: 0xC53030 };
}
