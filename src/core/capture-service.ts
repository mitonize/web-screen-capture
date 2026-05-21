import { v4 as uuidv4 } from 'uuid';
import type { StorageBackend } from '../storage/interface.js';
import type { Capture } from '../models/capture.js';
import { launchBrowser, captureScreenshot } from './browser.js';
import type { ScreenshotOptions } from './browser.js';

export interface CaptureInput {
  url: string;
  label?: string;
}

export interface CaptureOptions extends ScreenshotOptions {
  concurrency?: number;
  retries?: number;
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
      viewportWidth = 1280,
      viewportHeight = 720,
      fullPage = true,
      timeoutMs = 30000,
    } = options;

    const browser = await launchBrowser();
    const results: CaptureResult[] = [];

    try {
      const semaphore = new Semaphore(concurrency);

      const tasks = inputs.map((input) =>
        semaphore.run(async () => {
          const id = uuidv4();
          const capturedAt = new Date().toISOString();

          try {
            const imageData = await withRetry(
              () =>
                captureScreenshot(browser, input.url, {
                  viewportWidth,
                  viewportHeight,
                  fullPage,
                  timeoutMs,
                }),
              retries,
            );

            const imagePath = await this.storage.saveImage(id, imageData);

            const capture: Capture = {
              id,
              url: input.url,
              captured_at: capturedAt,
              label: input.label ?? null,
              image_path: imagePath,
              status: 'success',
              error: null,
              viewport_width: viewportWidth,
              viewport_height: viewportHeight,
              full_page: fullPage,
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
              image_path: `images/${id}.png`,
              status: 'failure',
              error: errorMsg,
              viewport_width: viewportWidth,
              viewport_height: viewportHeight,
              full_page: fullPage,
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
