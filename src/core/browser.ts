import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';
import type { DeviceType } from '../models/capture.js';
import { DEVICE_PRESETS } from '../models/capture.js';

export interface ScreenshotOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  fullPage?: boolean;
  timeoutMs?: number;
  deviceType?: DeviceType;
  /**
   * Scroll from top to bottom in viewport-height steps before capturing.
   * Triggers IntersectionObserver-based lazy loading so content is fully
   * rendered instead of being blank or repeated.
   * Default: true
   */
  scrollBeforeCapture?: boolean;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

/**
 * Scrolls the page in viewport-height steps to trigger lazy loading,
 * returns to the top, then converts position:fixed elements to
 * position:absolute so they appear correctly in full-page screenshots.
 */
async function preparePageForCapture(
  page: Page,
  viewportHeight: number,
  timeoutMs: number,
): Promise<void> {
  // Scroll down step by step to trigger IntersectionObserver callbacks
  await page.evaluate(async (stepPx: number) => {
    await new Promise<void>((resolve) => {
      const totalHeight = document.body.scrollHeight;
      let current = 0;
      function step() {
        current += stepPx;
        window.scrollTo(0, current);
        if (current < totalHeight) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      step();
    });
  }, viewportHeight);

  // Brief pause for async content triggered by scroll
  await page.waitForTimeout(400);

  // Return to top
  await page.evaluate(() => window.scrollTo(0, 0));

  // Wait for newly triggered requests to settle
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined);

  // Convert position:fixed → position:absolute so fixed headers/footers
  // appear only once at their natural position in the full-page screenshot
  await page.evaluate(() => {
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      if (getComputedStyle(el).position === 'fixed') {
        el.style.setProperty('position', 'absolute', 'important');
      }
    }
  });
}

export async function captureScreenshot(
  browser: Browser,
  url: string,
  options: ScreenshotOptions = {},
): Promise<Buffer> {
  const deviceType = options.deviceType ?? 'pc';
  const preset = DEVICE_PRESETS[deviceType];

  const {
    viewportWidth = preset.width,
    viewportHeight = preset.height,
    fullPage = true,
    timeoutMs = 30000,
    scrollBeforeCapture = true,
  } = options;

  const contextOptions: Parameters<Browser['newContext']>[0] = {
    viewport: { width: viewportWidth, height: viewportHeight },
  };

  if (preset.userAgent) {
    contextOptions.userAgent = preset.userAgent;
  }

  const context = await browser.newContext(contextOptions);

  let page: Page | null = null;
  try {
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    if (fullPage && scrollBeforeCapture) {
      await preparePageForCapture(page, viewportHeight, timeoutMs);
    }

    const data = await page.screenshot({ fullPage });
    return data;
  } finally {
    if (page) await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
