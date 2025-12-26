import { promises as fs } from 'node:fs';
import path from 'node:path';

export type IACaseStatus = 'open' | 'closed';

export interface IACaseRecord {
  userId: string;
  openedBy: string;
  openedAt: string;
  reason: string;
  channelId: string;
  guildRoles: Record<string, string[]>; // guildId -> roleIds removed
  status: IACaseStatus;
  closedBy?: string;
  closedAt?: string;
  closeReason?: string;
}

const DATA_DIR = path.resolve('data');
const FILE_PATH = path.join(DATA_DIR, 'ia_cases.json');

async function ensureFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(FILE_PATH).catch(async () => {
      await fs.writeFile(FILE_PATH, '[]', 'utf8');
    });
  } catch {
    // ignore
  }
}

export async function readAll(): Promise<IACaseRecord[]> {
  await ensureFile();
  const raw = await fs.readFile(FILE_PATH, 'utf8').catch(() => '[]');
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as IACaseRecord[];
    return [];
  } catch {
    return [];
  }
}

export async function writeAll(items: IACaseRecord[]): Promise<void> {
  await ensureFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(items, null, 2), 'utf8');
}

export async function getCase(userId: string): Promise<IACaseRecord | undefined> {
  const all = await readAll();
  return all.find(c => c.userId === userId && c.status === 'open');
}

export async function createCase(record: IACaseRecord): Promise<void> {
  const all = await readAll();
  all.push(record);
  await writeAll(all);
}

export async function closeCase(userId: string, updates: Partial<IACaseRecord>): Promise<IACaseRecord | undefined> {
  const all = await readAll();
  const idx = all.findIndex(c => c.userId === userId && c.status === 'open');
  if (idx === -1) return undefined;
  const updated: IACaseRecord = { ...all[idx], ...updates, status: 'closed' } as IACaseRecord;
  all[idx] = updated;
  await writeAll(all);
  return updated;
}
