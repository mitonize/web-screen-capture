import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createStorage } from '../../storage/index.js';
import { printJson, printError, printSuccess } from '../output.js';

interface ExportData {
  version: number;
  exported_at: string;
  captures: ExportCapture[];
}

interface ExportCapture {
  id: string;
  url: string;
  captured_at: string;
  label: string | null;
  status: string;
  error: string | null;
  viewport_width: number;
  viewport_height: number;
  full_page: boolean;
  image_format: string;
  image_path: string;
  comments: unknown[];
  annotations: unknown[];
}

export function makeExportCommand(): Command {
  const cmd = new Command('export');
  cmd
    .description('Export captures with images and metadata')
    .option('-o, --output <dir>', 'Output directory')
    .option('--capture-id <id...>', 'Specific capture IDs to export')
    .option('--json', 'Output summary as JSON to stdout')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: {
      output?: string;
      captureId?: string[];
      json?: boolean;
      storageDir?: string;
    }) => {
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '');

      const outputDir = opts.output ?? `wsc-export-${timestamp}`;

      let captures = await storage.listCaptures();

      if (opts.captureId && opts.captureId.length > 0) {
        const ids = new Set(opts.captureId);
        captures = captures.filter((c) => ids.has(c.id));
      }

      if (captures.length === 0) {
        const summary = { output_dir: outputDir, exported: 0, captures: [] };
        if (opts.json) {
          printJson(summary);
        } else {
          printSuccess(`No captures to export.`);
        }
        return;
      }

      const imagesDir = path.join(outputDir, 'images');
      await fs.mkdir(imagesDir, { recursive: true });

      const exportCaptures: ExportCapture[] = [];

      for (const capture of captures) {
        const comments = await storage.listComments(capture.id);
        const annotations = await storage.listAnnotations(capture.id);

        const ext = capture.image_format === 'png' ? 'png' : 'jpg';
        const relImagePath = capture.image_path;

        const imageData = await storage.readImage(capture.id);
        if (imageData) {
          const destPath = path.join(imagesDir, path.basename(relImagePath));
          await fs.writeFile(destPath, imageData);
        }

        exportCaptures.push({
          id: capture.id,
          url: capture.url,
          captured_at: capture.captured_at,
          label: capture.label,
          status: capture.status,
          error: capture.error,
          viewport_width: capture.viewport_width,
          viewport_height: capture.viewport_height,
          full_page: capture.full_page,
          image_format: capture.image_format,
          image_path: relImagePath,
          comments,
          annotations,
        });
      }

      const exportData: ExportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        captures: exportCaptures,
      };

      await fs.writeFile(
        path.join(outputDir, 'export.json'),
        JSON.stringify(exportData, null, 2),
      );

      const summary = {
        output_dir: outputDir,
        exported: exportCaptures.length,
        captures: exportCaptures.map((c) => ({ id: c.id, url: c.url })),
      };

      if (opts.json) {
        printJson(summary);
      } else {
        printSuccess(`Exported ${exportCaptures.length} capture(s) to ${outputDir}/`);
      }
    });

  return cmd;
}
