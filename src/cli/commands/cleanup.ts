import { Command } from 'commander';
import { createStorage } from '../../storage/index.js';
import { printJson, printSuccess } from '../output.js';

export function makeCleanupCommand(): Command {
  const cmd = new Command('cleanup');
  cmd
    .description('Remove metadata for captures whose image files are missing')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: { json?: boolean; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const removed = await storage.cleanupOrphanedMetadata();

      if (opts.json) {
        printJson({ removed });
        return;
      }

      if (removed.length === 0) {
        printSuccess('No orphaned metadata found.');
      } else {
        printSuccess(`Removed metadata for ${removed.length} capture(s):`);
        for (const id of removed) {
          printSuccess(`  - ${id}`);
        }
      }
    });

  return cmd;
}
