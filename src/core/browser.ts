import { chromium } from 'playwright';
import type { Browser, Page, CDPSession } from 'playwright';
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
 * then returns to the top. Returns the page height recorded BEFORE scrolling
 * so callers can clip the screenshot to that height — preventing dynamically
 * appended content (infinite scroll, recommendation carousels) from appearing.
 */
async function scrollPage(page: Page, viewportHeight: number, timeoutMs: number): Promise<number> {
  // Record height before any scrolling
  const initialHeight = await page.evaluate(() => document.documentElement.scrollHeight);

  await page.evaluate(async ({ stepPx, limit }: { stepPx: number; limit: number }) => {
    await new Promise<void>((resolve) => {
      let current = 0;
      function step() {
        current += stepPx;
        window.scrollTo(0, current);
        if (current < limit) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      }
      step();
    });
  }, { stepPx: viewportHeight, limit: initialHeight });

  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => undefined);

  return initialHeight;
}

/**
 * Takes a full-page screenshot using CDP's captureBeyondViewport.
 * clipHeight limits the captured area to the pre-scroll height, excluding
 * any content dynamically appended during scroll (infinite scroll, etc.).
 */
async function cdpFullPageScreenshot(
  page: Page,
  viewportWidth: number,
  clipHeight?: number,
): Promise<Buffer> {
  const fullHeight = clipHeight ?? await page.evaluate(() => document.documentElement.scrollHeight);
  const cdp: CDPSession = await page.context().newCDPSession(page);
  try {
    const result = await cdp.send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 0, y: 0, width: viewportWidth, height: fullHeight, scale: 1 },
      captureBeyondViewport: true,
    });
    return Buffer.from(result.data as string, 'base64');
  } finally {
    await cdp.detach().catch(() => undefined);
  }
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
    contextOptions.isMobile = true;
    contextOptions.hasTouch = true;
  }

  const context = await browser.newContext(contextOptions);

  let page: Page | null = null;
  try {
    page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

    if (fullPage && scrollBeforeCapture) {
      const initialHeight = await scrollPage(page, viewportHeight, timeoutMs);
      return await cdpFullPageScreenshot(page, viewportWidth, initialHeight);
    }

    return await page.screenshot({ fullPage });
  } finally {
    if (page) await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
