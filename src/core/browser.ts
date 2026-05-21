import { chromium } from 'playwright';
import type { Browser, Page } from 'playwright';

export interface ScreenshotOptions {
  viewportWidth?: number;
  viewportHeight?: number;
  fullPage?: boolean;
  timeoutMs?: number;
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({ headless: true });
}

export async function captureScreenshot(
  browser: Browser,
  url: string,
  options: ScreenshotOptions = {},
): Promise<Buffer> {
  const {
    viewportWidth = 1280,
    viewportHeight = 720,
    fullPage = true,
    timeoutMs = 30000,
  } = options;

  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
  });

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
