#!/usr/bin/env node
import { Command } from 'commander';
import { makeCaptureCommand } from './commands/capture.js';
import { makeListCommand } from './commands/list.js';
import { makeShowCommand } from './commands/show.js';
import { makeCommentCommand } from './commands/comment.js';
import { makeAnnotationCommand } from './commands/annotation.js';
import { makeExportCommand } from './commands/export.js';
import { makeServeCommand } from './commands/serve.js';

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
program.addCommand(makeExportCommand());
program.addCommand(makeServeCommand());

program.parseAsync(process.argv).catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${String(err)}\n`);
  process.exit(2);
});
