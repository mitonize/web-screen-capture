import { Command } from 'commander';
import { v4 as uuidv4 } from 'uuid';
import { createStorage } from '../../storage/index.js';
import { loadConfig } from '../../core/config.js';
import { resolveAuthor } from '../../core/author-resolver.js';
import { printJson, printError, printSuccess, formatTable } from '../output.js';

export function makeAnnotationCommand(): Command {
  const cmd = new Command('annotation');
  cmd.description('Manage annotations on captures');

  cmd
    .command('add')
    .description('Add an annotation to a capture')
    .requiredOption('-c, --capture-id <id>', 'Capture ID')
    .requiredOption('-t, --type <type>', 'Annotation type: rect|arrow|text|highlight')
    .requiredOption('-x, --x <n>', 'X coordinate')
    .requiredOption('-y, --y <n>', 'Y coordinate')
    .option('--x2 <n>', 'X2 coordinate (for arrow)')
    .option('--y2 <n>', 'Y2 coordinate (for arrow)')
    .option('-w, --width <n>', 'Width (for rect/highlight)')
    .option('-h, --height <n>', 'Height (for rect/highlight)')
    .option('-l, --label <text>', 'Label (required for text type)')
    .option('--color <color>', 'Color')
    .option('-a, --author <author>', 'Author')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: {
      captureId: string;
      type: string;
      x: string;
      y: string;
      x2?: string;
      y2?: string;
      width?: string;
      height?: string;
      label?: string;
      color?: string;
      author?: string;
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

      const x = parseInt(opts.x, 10);
      const y = parseInt(opts.y, 10);
      const type = opts.type;

      const base = {
        id: uuidv4(),
        capture_id: opts.captureId,
        author,
        created_at: new Date().toISOString(),
        color: opts.color ?? null,
      };

      let annotation: unknown;

      if (type === 'rect' || type === 'highlight') {
        if (!opts.width || !opts.height) {
          printError(`--width and --height are required for ${type} annotations`);
          process.exit(2);
        }
        annotation = {
          ...base,
          type,
          x,
          y,
          width: parseInt(opts.width, 10),
          height: parseInt(opts.height, 10),
          x2: null,
          y2: null,
          label: opts.label ?? null,
        };
      } else if (type === 'arrow') {
        if (!opts.x2 || !opts.y2) {
          printError('--x2 and --y2 are required for arrow annotations');
          process.exit(2);
        }
        annotation = {
          ...base,
          type: 'arrow',
          x,
          y,
          x2: parseInt(opts.x2, 10),
          y2: parseInt(opts.y2, 10),
          width: null,
          height: null,
          label: opts.label ?? null,
        };
      } else if (type === 'text') {
        if (!opts.label) {
          printError('--label is required for text annotations');
          process.exit(2);
        }
        annotation = {
          ...base,
          type: 'text',
          x,
          y,
          label: opts.label,
          x2: null,
          y2: null,
          width: null,
          height: null,
        };
      } else {
        printError(`Unknown annotation type: ${type}. Must be one of: rect, arrow, text, highlight`);
        process.exit(2);
      }

      await storage.saveAnnotation(annotation as Parameters<typeof storage.saveAnnotation>[0]);

      if (opts.json) {
        printJson(annotation);
      } else {
        const ann = annotation as { id: string };
        printSuccess(`Annotation added: ${ann.id}`);
      }
    });

  cmd
    .command('list')
    .description('List annotations for a capture')
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

      const annotations = await storage.listAnnotations(opts.captureId);

      if (opts.json) {
        printJson(annotations);
        return;
      }

      if (annotations.length === 0) {
        printSuccess('No annotations found.');
        return;
      }

      const headers = ['ID', 'Type', 'Author', 'Created At'];
      const rows = annotations.map((a) => [
        a.id.slice(0, 8) + '…',
        a.type,
        a.author,
        a.created_at,
      ]);
      printSuccess(formatTable(headers, rows));
    });

  cmd
    .command('delete')
    .description('Delete an annotation')
    .argument('<id>', 'Annotation ID')
    .option('--json', 'Output as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (id: string, opts: { json?: boolean; storageDir?: string }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const deleted = await storage.deleteAnnotation(id);

      if (!deleted) {
        printError(`Annotation not found: ${id}`);
        process.exit(1);
      }

      if (opts.json) {
        printJson({ deleted: true, id });
      } else {
        printSuccess(`Annotation deleted: ${id}`);
      }
    });

  return cmd;
}
