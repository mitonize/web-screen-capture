import { Command } from 'commander';
import { createStorage } from '../../storage/index.js';
import { printJson, printError, printSuccess } from '../output.js';

export function makeDeleteCommand(): Command {
  const cmd = new Command('delete');
  cmd
    .description('Delete a capture and its associated metadata')
    .argument('<capture-id>', 'Capture ID to delete')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (captureId: string, opts: { json?: boolean; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const capture = await storage.findCapture(captureId);
      if (!capture) {
        const err = `Capture not found: ${captureId}`;
        if (opts.json) {
          printJson({ error: err });
        } else {
          printError(err);
        }
        process.exit(1);
      }

      const deleted = await storage.deleteCapture(captureId);

      if (!deleted) {
        const err = `Failed to delete capture: ${captureId}`;
        if (opts.json) {
          printJson({ error: err });
        } else {
          printError(err);
        }
        process.exit(1);
      }

      if (opts.json) {
        printJson({
          deleted: true,
          id: captureId,
          url: capture.url,
          message: `Capture deleted: ${capture.url}`,
        });
      } else {
        printSuccess(`✓ Deleted capture: ${capture.url}`);
        printSuccess(`  ID: ${captureId}`);
        if (capture.label) {
          printSuccess(`  Label: ${capture.label}`);
        }
      }
    });

  return cmd;
}
