import { Command } from 'commander';
import { createStorage } from '../../storage/index.js';
import { printJson, printError, formatTable, printSuccess } from '../output.js';
import { buildCommentThreads } from '../../models/comment.js';

export function makeShowCommand(): Command {
  const cmd = new Command('show');
  cmd
    .description('Show details of a capture')
    .argument('<id>', 'Capture ID (or prefix)')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (id: string, opts: { json?: boolean; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const captures = await storage.listCaptures();
      const capture = captures.find((c) => c.id === id || c.id.startsWith(id));

      if (!capture) {
        printError(`Capture not found: ${id}`);
        process.exit(1);
      }

      const comments = await storage.listComments(capture.id);
      const annotations = await storage.listAnnotations(capture.id);

      if (opts.json) {
        printJson({ capture, comments, annotations });
        return;
      }

      printSuccess(`Capture: ${capture.id}`);
      printSuccess(`  URL:         ${capture.url}`);
      printSuccess(`  Status:      ${capture.status}`);
      printSuccess(`  Captured at: ${capture.captured_at}`);
      printSuccess(`  Label:       ${capture.label ?? '(none)'}`);
      printSuccess(`  Image:       ${capture.image_path}`);
      if (capture.error) {
        printSuccess(`  Error:       ${capture.error}`);
      }

      if (comments.length > 0) {
        printSuccess('\nComments:');
        const threads = buildCommentThreads(comments);
        for (const thread of threads) {
          printSuccess(`  [${thread.id.slice(0, 8)}] ${thread.author}: ${thread.message}`);
          for (const reply of thread.replies) {
            printSuccess(`    ↳ [${reply.id.slice(0, 8)}] ${reply.author}: ${reply.message}`);
          }
        }
      }

      if (annotations.length > 0) {
        printSuccess('\nAnnotations:');
        const headers = ['ID', 'Type', 'Author', 'Position'];
        const rows = annotations.map((a) => {
          const pos = 'width' in a && a.width != null
            ? `(${a.x},${a.y}) ${a.width}×${'height' in a && a.height != null ? a.height : '?'}`
            : `(${a.x},${a.y})→(${'x2' in a && a.x2 != null ? a.x2 : '?'},${'y2' in a && a.y2 != null ? a.y2 : '?'})`;
          return [a.id.slice(0, 8) + '…', a.type, a.author, pos];
        });
        printSuccess(formatTable(headers, rows));
      }
    });

  return cmd;
}
