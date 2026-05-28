#!/usr/bin/env node
import { Command } from 'commander';
import { ZodError } from 'zod';
import { makeCaptureCommand } from './commands/capture.js';
import { makeListCommand } from './commands/list.js';
import { makeShowCommand } from './commands/show.js';
import { makeCommentCommand } from './commands/comment.js';
import { makeAnnotationCommand } from './commands/annotation.js';
import { makeServeCommand } from './commands/serve.js';
import { makeViewCommand } from './commands/view.js';
import { makeCleanupCommand } from './commands/cleanup.js';
import { makeDeleteCommand } from './commands/delete.js';

const program = new Command();

program
  .name('wsc')
  .description('Web Screen Capture CLI')
  .version('1.0.0');

program.addCommand(makeCaptureCommand());
program.addCommand(makeListCommand());
program.addCommand(makeShowCommand());
program.addCommand(makeCommentCommand());
program.addCommand(makeAnnotationCommand());
program.addCommand(makeServeCommand());
program.addCommand(makeViewCommand());
program.addCommand(makeCleanupCommand());
program.addCommand(makeDeleteCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  if (err instanceof ZodError) {
    process.stderr.write(`Error: data validation failed – captures.json may be corrupted.\n`);
    process.stderr.write(`Run \`wsc cleanup\` to remove orphaned entries.\n`);
  } else {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Fatal error: ${msg}\n`);
  }
  process.exit(2);
});
