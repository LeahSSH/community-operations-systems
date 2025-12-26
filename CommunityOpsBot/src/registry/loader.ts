import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { BotCommand } from '../types/command.js';

export async function loadCommands(): Promise<BotCommand[]> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const compiledBase = path.join(__dirname, '..', 'commands');
  const sourceBase = path.resolve('src', 'commands');

  const base = directoryExists(compiledBase) ? compiledBase : sourceBase;
  const ext = base.endsWith(path.join('src', 'commands')) ? '.ts' : '.js';

  const categories = readdirSync(base, { withFileTypes: true }).filter(d => d.isDirectory());
  const commands: BotCommand[] = [];

  for (const cat of categories) {
    const dir = path.join(base, cat.name);
    const files = readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile() && f.name.endsWith(ext));
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      const mod = await import(pathToFileURL(fullPath).href);
      const cmd: BotCommand = mod.default;
      commands.push(cmd);
    }
  }

  return commands;
}

function directoryExists(p: string): boolean {
  try {
    return readdirSync(p) != null;
  } catch {
    return false;
  }
}
