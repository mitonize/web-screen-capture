import { Command } from 'commander';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createStorage } from '../../storage/index.js';
import { printError, printSuccess } from '../output.js';

function openFile(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd =
      process.platform === 'darwin' ? 'open' :
      process.platform === 'win32'  ? 'explorer' :
      'xdg-open';

    const child = spawn(cmd, [filePath], { detached: true, stdio: 'ignore' });
    child.unref();
    child.on('error', reject);
    // Resolve immediately — viewer launches in background
    child.on('spawn', resolve);
    // Fallback for older Node versions where 'spawn' event may not fire
    setTimeout(resolve, 200);
  });
}

export function makeViewCommand(): Command {
  const cmd = new Command('view');
  cmd
    .description('Open capture image(s) in the default viewer')
    .argument('<id>', 'Capture ID or prefix (matches all captures with that prefix)')
    .option('--device <device>', 'Filter by device type: pc, mobile')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (id: string, opts: { device?: string; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const captures = await storage.listCaptures();
      let matches = captures.filter((c) => c.id === id || c.id.startsWith(id));

      if (opts.device) {
        matches = matches.filter((c) => c.device_type === opts.device);
      }

      if (matches.length === 0) {
        printError(`No captures found matching: ${id}${opts.device ? ` (device: ${opts.device})` : ''}`);
        process.exit(1);
      }

      for (const capture of matches) {
        // image_path is stored as a relative path under the storage dir; resolve it here
        const storageDir = opts.storageDir ?? path.join(process.cwd(), '.wsc');
        const absPath = path.isAbsolute(capture.image_path)
          ? capture.image_path
          : path.join(storageDir, capture.image_path);

        try {
          await fs.access(absPath);
        } catch {
          printError(`Image file not found: ${absPath}`);
          process.exit(1);
        }

        try {
          await openFile(absPath);
          printSuccess(`Opened [${capture.device_type}] ${capture.url} → ${absPath}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          printError(`Failed to open ${absPath}: ${msg}`);
          process.exit(1);
        }
      }
    });

  return cmd;
}
