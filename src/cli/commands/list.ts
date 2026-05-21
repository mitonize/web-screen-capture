import { Command } from 'commander';
import { createStorage } from '../../storage/index.js';
import { printJson, formatTable, printSuccess } from '../output.js';

export function makeListCommand(): Command {
  const cmd = new Command('list');
  cmd
    .description('List all captures')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: { json?: boolean; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const captures = await storage.listCaptures();

      if (opts.json) {
        printJson(captures);
        return;
      }

      if (captures.length === 0) {
        printSuccess('No captures found.');
        return;
      }

      const headers = ['ID', 'URL', 'Label', 'Status', 'Captured At'];
      const rows = captures.map((c) => [
        c.id.slice(0, 8) + '…',
        c.url.length > 40 ? c.url.slice(0, 37) + '…' : c.url,
        c.label ?? '',
        c.status,
        c.captured_at,
      ]);

      printSuccess(formatTable(headers, rows));
    });

  return cmd;
}
