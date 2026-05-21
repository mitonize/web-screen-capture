import { Command } from 'commander';
import fs from 'node:fs/promises';
import { createStorage } from '../../storage/index.js';
import { loadConfig } from '../../core/config.js';
import { CaptureService } from '../../core/capture-service.js';
import { printSuccess, printError, printJson } from '../output.js';
import type { CaptureInput } from '../../core/capture-service.js';

export function makeCaptureCommand(): Command {
  const cmd = new Command('capture');
  cmd
    .description('Capture one or more web pages')
    .option('-u, --url <url...>', 'URL(s) to capture')
    .option('-f, --url-file <file>', 'File containing URLs (one per line)')
    .option('-l, --label <label>', 'Label for this capture batch')
    .option('--viewport-width <n>', 'Viewport width', '1280')
    .option('--viewport-height <n>', 'Viewport height', '720')
    .option('--no-full-page', 'Disable full-page capture')
    .option('--timeout <ms>', 'Timeout per page in milliseconds', '30000')
    .option('--retries <n>', 'Retry attempts per URL', '3')
    .option('--concurrency <n>', 'Max concurrent captures', '5')
    .option('--json', 'Output results as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: {
      url?: string[];
      urlFile?: string;
      label?: string;
      viewportWidth: string;
      viewportHeight: string;
      fullPage: boolean;
      timeout: string;
      retries: string;
      concurrency: string;
      json?: boolean;
      storageDir?: string;
    }) => {
      const config = await loadConfig(opts.storageDir);
      const storage = createStorage(opts.storageDir);
      await storage.init();

      const inputs: CaptureInput[] = [];

      if (opts.url) {
        for (const u of opts.url) {
          inputs.push({ url: u, label: opts.label });
        }
      }

      if (opts.urlFile) {
        try {
          const content = await fs.readFile(opts.urlFile, 'utf-8');
          const lines = content
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'));
          for (const line of lines) {
            inputs.push({ url: line, label: opts.label });
          }
        } catch (err) {
          printError(`Cannot read URL file: ${opts.urlFile}`);
          process.exit(2);
        }
      }

      if (inputs.length === 0) {
        printError('No URLs provided. Use --url or --url-file.');
        process.exit(2);
      }

      const captureConfig = config.capture;
      const service = new CaptureService(storage);

      const results = await service.captureAll(inputs, {
        concurrency: parseInt(opts.concurrency, 10) || captureConfig.concurrency,
        retries: parseInt(opts.retries, 10),
        viewportWidth: parseInt(opts.viewportWidth, 10) || captureConfig.viewport_width,
        viewportHeight: parseInt(opts.viewportHeight, 10) || captureConfig.viewport_height,
        fullPage: opts.fullPage,
        timeoutMs: parseInt(opts.timeout, 10) || captureConfig.timeout_ms,
      });

      const failures = results.filter((r) => !r.success);

      if (opts.json) {
        printJson(results.map((r) => r.capture));
      } else {
        for (const r of results) {
          if (r.success) {
            printSuccess(`✓ ${r.capture.url} → ${r.capture.id}`);
          } else {
            printError(`✗ ${r.capture.url}: ${r.capture.error ?? 'unknown error'}`);
          }
        }
      }

      if (failures.length > 0 && failures.length < results.length) {
        process.exit(1);
      } else if (failures.length === results.length && results.length > 0) {
        process.exit(1);
      }
    });

  return cmd;
}
