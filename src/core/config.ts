import fs from 'node:fs/promises';
import path from 'node:path';
import { ConfigSchema } from '../models/config.js';
import type { Config } from '../models/config.js';

export async function loadConfig(baseDir?: string): Promise<Config> {
  const configPath = path.join(
    baseDir ?? path.join(process.cwd(), '.wsc'),
    'config.json',
  );

  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    return ConfigSchema.parse(parsed);
  } catch {
    return ConfigSchema.parse({ version: 1 });
  }
}
