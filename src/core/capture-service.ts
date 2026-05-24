import { v4 as uuidv4 } from 'uuid';
import type { StorageBackend } from '../storage/interface.js';
import type { Capture, DeviceType } from '../models/capture.js';
import { DEVICE_PRESETS } from '../models/capture.js';
import { launchBrowser, captureScreenshot } from './browser.js';
import type { ScreenshotOptions } from './browser.js';

export interface CaptureInput {
  url: string;
  label?: string;
}

export interface CaptureOptions extends ScreenshotOptions {
  concurrency?: number;
  retries?: number;
  devices?: DeviceType[];
}

export interface CaptureResult {
  capture: Capture;
  success: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(1000 * Math.pow(2, attempt));
      }
    }
  }
  throw lastError;
}

export class CaptureService {
  constructor(private storage: StorageBackend) {}

  async captureAll(
    inputs: CaptureInput[],
    options: CaptureOptions = {},
  ): Promise<CaptureResult[]> {
    const {
      concurrency = 5,
      retries = 3,
      fullPage = true,
      timeoutMs = 10000,
      devices = ['pc'],
      format = 'jpeg',
      quality,
    } = options;

    // Expand inputs by device: each URL × each device
    const expandedInputs = inputs.flatMap((input) =>
      devices.map((device) => ({ ...input, deviceType: device as DeviceType })),
    );

    const browser = await launchBrowser();
    const results: CaptureResult[] = [];

    try {
      const semaphore = new Semaphore(concurrency);

      const tasks = expandedInputs.map((input) =>
        semaphore.run(async () => {
          const id = uuidv4();
          const capturedAt = new Date().toISOString();
          const preset = DEVICE_PRESETS[input.deviceType];
          const vw = options.viewportWidth ?? preset.width;
          const vh = options.viewportHeight ?? preset.height;

          try {
            const imageData = await withRetry(
              () =>
                captureScreenshot(browser, input.url, {
                  viewportWidth: vw,
                  viewportHeight: vh,
                  fullPage,
                  timeoutMs,
                  deviceType: input.deviceType,
                  format,
                  quality,
                }),
              retries,
            );

            const imagePath = await this.storage.saveImage(
              { captureId: id, url: input.url, capturedAt },
              imageData,
              format,
            );

            const capture: Capture = {
              id,
              url: input.url,
              captured_at: capturedAt,
              label: input.label ?? null,
              image_path: imagePath,
              image_format: format,
              status: 'success',
              error: null,
              viewport_width: vw,
              viewport_height: vh,
              full_page: fullPage,
              device_type: input.deviceType,
            };

            await this.storage.saveCapture(capture);
            results.push({ capture, success: true });
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : String(err);

            const capture: Capture = {
              id,
              url: input.url,
              captured_at: capturedAt,
              label: input.label ?? null,
              image_path: '',
              image_format: format,
              status: 'failure',
              error: errorMsg,
              viewport_width: vw,
              viewport_height: vh,
              full_page: fullPage,
              device_type: input.deviceType,
            };

            await this.storage.saveCapture(capture);
            results.push({ capture, success: false });
          }
        }),
      );

      await Promise.all(tasks);
    } finally {
      await browser.close().catch(() => undefined);
    }

    return results;
  }
}

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private limit: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}
