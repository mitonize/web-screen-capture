import { Command } from 'commander';
import { createStorage } from '../../storage/index.js';
import { printJson, formatTable, printSuccess } from '../output.js';
import { extractDomain } from '../../core/domain-extractor.js';
import type { DeviceType } from '../../models/capture.js';

export function makeListCommand(): Command {
  const cmd = new Command('list');
  cmd
    .description('List all captures')
    .option('-d, --device <device>', 'Filter by device type: pc, mobile')
    .option('-u, --url <text>', 'Filter by URL (partial match)')
    .option('--domain <domain>', 'Filter by domain')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: { device?: string; url?: string; domain?: string; json?: boolean; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      let captures = (await storage.listCaptures()).sort(
        (a, b) => b.captured_at.localeCompare(a.captured_at),
      );

      if (opts.device) {
        if (opts.device !== 'pc' && opts.device !== 'mobile') {
          process.stderr.write(`Invalid device type: "${opts.device}". Use "pc" or "mobile".\n`);
          process.exit(2);
        }
        captures = captures.filter((c) => c.device_type === (opts.device as DeviceType));
      }

      if (opts.url) {
        const needle = opts.url.toLowerCase();
        captures = captures.filter((c) => c.url.toLowerCase().includes(needle));
      }

      if (opts.domain) {
        captures = captures.filter((c) => extractDomain(c.url) === opts.domain);
      }

      if (opts.json) {
        printJson(captures);
        return;
      }

      if (captures.length === 0) {
        printSuccess('No captures found.');
        return;
      }

      const headers = ['ID', 'Device', 'URL', 'Label', 'Status', 'Captured At'];
      const rows = captures.map((c) => [
        c.id.slice(0, 8) + '…',
        c.device_type,
        c.url.length > 35 ? c.url.slice(0, 32) + '…' : c.url,
        c.label ?? '',
        c.status,
        c.captured_at,
      ]);

      printSuccess(formatTable(headers, rows));
    });

  return cmd;
}
