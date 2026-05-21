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
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
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
    const data = await page.screenshot({ fullPage });
    return data;
  } finally {
    if (page) await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
