import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { createStorage } from '../../storage/index.js';
import { loadConfig } from '../../core/config.js';
import { resolveAuthor } from '../../core/author-resolver.js';
import { printJson, printError, printSuccess } from '../output.js';
import { buildCommentThreads } from '../../models/comment.js';

export function makeCommentCommand(): Command {
  const cmd = new Command('comment');
  cmd.description('Manage comments on captures');

  cmd
    .command('add')
    .description('Add a comment to a capture')
    .requiredOption('-c, --capture-id <id>', 'Capture ID')
    .requiredOption('-m, --message <message>', 'Comment message')
    .option('-a, --author <author>', 'Comment author')
    .option('-p, --parent-id <id>', 'Parent comment ID (for replies)')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: {
      captureId: string;
      message: string;
      author?: string;
      parentId?: string;
      json?: boolean;
      storageDir?: string;
    }) => {
      const config = await loadConfig(opts.storageDir);
      const storage = createStorage(opts.storageDir);
      await storage.init();

      let author: string;
      try {
        author = resolveAuthor(opts.author, config);
      } catch (err) {
        printError((err as Error).message);
        process.exit(2);
      }

      const capture = await storage.findCapture(opts.captureId);
      if (!capture) {
        printError(`Capture not found: ${opts.captureId}`);
        process.exit(1);
      }

      if (opts.parentId) {
        const parent = await storage.findComment(opts.parentId);
        if (!parent) {
          printError(`Parent comment not found: ${opts.parentId}`);
          process.exit(1);
        }
      }

      const comment = {
        id: uuidv4(),
        capture_id: opts.captureId,
        parent_id: opts.parentId ?? null,
        author,
        message: opts.message,
        created_at: new Date().toISOString(),
      };

      await storage.saveComment(comment);

      if (opts.json) {
        printJson(comment);
      } else {
        printSuccess(`Comment added: ${comment.id}`);
      }
    });

  cmd
    .command('list')
    .description('List comments for a capture')
    .requiredOption('-c, --capture-id <id>', 'Capture ID')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: {
      captureId: string;
      json?: boolean;
      storageDir?: string;
    }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const capture = await storage.findCapture(opts.captureId);
      if (!capture) {
        printError(`Capture not found: ${opts.captureId}`);
        process.exit(1);
      }

      const comments = await storage.listComments(opts.captureId);

      if (opts.json) {
        printJson(comments);
        return;
      }

      if (comments.length === 0) {
        printSuccess('No comments found.');
        return;
      }

      const threads = buildCommentThreads(comments);
      for (const thread of threads) {
        printSuccess(`[${thread.id.slice(0, 8)}] ${thread.author}: ${thread.message}`);
        printSuccess(`  Created: ${thread.created_at}`);
        for (const reply of thread.replies) {
          printSuccess(`  ↳ [${reply.id.slice(0, 8)}] ${reply.author}: ${reply.message}`);
          printSuccess(`    Created: ${reply.created_at}`);
        }
      }
    });

  return cmd;
}
