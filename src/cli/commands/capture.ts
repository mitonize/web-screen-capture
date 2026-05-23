import { Command } from 'commander';
import fs from 'node:fs/promises';
import { createStorage } from '../../storage/index.js';
import { loadConfig } from '../../core/config.js';
import { CaptureService } from '../../core/capture-service.js';
import { printSuccess, printError, printJson } from '../output.js';
import type { CaptureInput } from '../../core/capture-service.js';
import type { DeviceType } from '../../models/capture.js';

export function makeCaptureCommand(): Command {
  const cmd = new Command('capture');
  cmd
    .description('Capture one or more web pages')
    .option('-u, --url <url...>', 'URL(s) to capture')
    .option('-f, --url-file <file>', 'File containing URLs (one per line)')
    .option('-l, --label <label>', 'Label for this capture batch')
    .option('-d, --device <device...>', 'Device type(s): pc, mobile (default: pc)', ['pc'])
    .option('--viewport-width <n>', 'Viewport width (overrides device preset)')
    .option('--viewport-height <n>', 'Viewport height (overrides device preset)')
    .option('--no-full-page', 'Disable full-page capture')
    .option('--no-scroll', 'Skip scroll-before-capture (disables lazy-load triggering; useful if repeated content appears at the bottom)')
    .option('--timeout <ms>', 'Timeout per page in milliseconds', '30000')
    .option('--retries <n>', 'Retry attempts per URL', '3')
    .option('--concurrency <n>', 'Max concurrent captures', '5')
    .option('--json', 'Output results as JSON')
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: {
      url?: string[];
      urlFile?: string;
      label?: string;
      device: string[];
      viewportWidth?: string;
      viewportHeight?: string;
      fullPage: boolean;
      scroll: boolean;
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
        } catch {
          printError(`Cannot read URL file: ${opts.urlFile}`);
          process.exit(2);
        }
      }

      if (inputs.length === 0) {
        printError('No URLs provided. Use --url or --url-file.');
        process.exit(2);
      }

      // Validate device types
      const validDevices: DeviceType[] = [];
      for (const d of opts.device) {
        if (d !== 'pc' && d !== 'mobile') {
          printError(`Invalid device type: "${d}". Use "pc" or "mobile".`);
          process.exit(2);
        }
        validDevices.push(d as DeviceType);
      }

      const captureConfig = config.capture;
      const service = new CaptureService(storage);

      const results = await service.captureAll(inputs, {
        concurrency: parseInt(opts.concurrency, 10) || captureConfig.concurrency,
        retries: parseInt(opts.retries, 10),
        viewportWidth: opts.viewportWidth ? parseInt(opts.viewportWidth, 10) : undefined,
        viewportHeight: opts.viewportHeight ? parseInt(opts.viewportHeight, 10) : undefined,
        fullPage: opts.fullPage,
        scrollBeforeCapture: opts.scroll,
        timeoutMs: parseInt(opts.timeout, 10) || captureConfig.timeout_ms,
        devices: validDevices,
      });

      const failures = results.filter((r) => !r.success);

      if (opts.json) {
        printJson(results.map((r) => r.capture));
      } else {
        for (const r of results) {
          const deviceLabel = `[${r.capture.device_type}]`;
          if (r.success) {
            printSuccess(`✓ ${deviceLabel} ${r.capture.url} → ${r.capture.id}`);
          } else {
            printError(`✗ ${deviceLabel} ${r.capture.url}: ${r.capture.error ?? 'unknown error'}`);
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
