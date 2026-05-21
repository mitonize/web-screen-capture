import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FilesystemStorage } from '../src/storage/filesystem.js';
import { CaptureService } from '../src/core/capture-service.js';

// minimal valid 1×1 PNG bytes
const MOCK_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

vi.mock('../src/core/browser.js', () => {
  const png = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde,
  ]);
  return {
    launchBrowser: vi.fn().mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
    }),
    captureScreenshot: vi.fn().mockResolvedValue(png),
  };
});

import { captureScreenshot, launchBrowser } from '../src/core/browser.js';

describe('CaptureService', () => {
  let tmpDir: string;
  let storage: FilesystemStorage;
  let service: CaptureService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsc-capture-test-'));
    storage = new FilesystemStorage(tmpDir);
    await storage.init();
    service = new CaptureService(storage);
    vi.mocked(launchBrowser).mockReset();
    vi.mocked(captureScreenshot).mockReset();
    vi.mocked(launchBrowser).mockResolvedValue({
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as Awaited<ReturnType<typeof launchBrowser>>);
    vi.mocked(captureScreenshot).mockResolvedValue(MOCK_PNG);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('captures a single URL successfully', async () => {
    const results = await service.captureAll([{ url: 'https://example.com' }]);

    expect(results).toHaveLength(1);
    expect(results[0]?.success).toBe(true);
    expect(results[0]?.capture.url).toBe('https://example.com');
    expect(results[0]?.capture.status).toBe('success');
  });

  it('captures multiple URLs in parallel', async () => {
    const urls = [
      { url: 'https://example.com' },
      { url: 'https://example.org' },
      { url: 'https://example.net' },
    ];

    const results = await service.captureAll(urls, { concurrency: 2 });

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
    expect(captureScreenshot).toHaveBeenCalledTimes(3);
  });

  it('saves captured images to storage', async () => {
    const results = await service.captureAll([{ url: 'https://example.com' }]);
    expect(results[0]?.success).toBe(true);

    const captureId = results[0]!.capture.id;
    const image = await storage.readImage(captureId);
    expect(image).not.toBeNull();
  });

  it('saves captures to storage', async () => {
    await service.captureAll([{ url: 'https://example.com' }]);
    const captures = await storage.listCaptures();
    expect(captures).toHaveLength(1);
  });

  it('handles failure gracefully and continues with other URLs', async () => {
    vi.mocked(captureScreenshot)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce(MOCK_PNG);

    const results = await service.captureAll([
      { url: 'https://failing.com' },
      { url: 'https://success.com' },
    ], { retries: 0 });

    expect(results).toHaveLength(2);
    const failedResult = results.find((r) => r.capture.url === 'https://failing.com');
    const successResult = results.find((r) => r.capture.url === 'https://success.com');

    expect(failedResult?.success).toBe(false);
    expect(failedResult?.capture.status).toBe('failure');
    expect(failedResult?.capture.error).toContain('Network timeout');
    expect(successResult?.success).toBe(true);
  });

  it('retries on failure with exponential backoff', async () => {
    vi.useFakeTimers();

    vi.mocked(captureScreenshot)
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValueOnce(MOCK_PNG);

    const capturePromise = service.captureAll(
      [{ url: 'https://example.com' }],
      { retries: 2 },
    );

    // Advance timers to account for exponential backoff: 1s + 2s = 3s
    await vi.runAllTimersAsync();
    const results = await capturePromise;

    expect(results[0]?.success).toBe(true);
    expect(captureScreenshot).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('stores failure record when all retries exhausted', async () => {
    vi.mocked(captureScreenshot).mockRejectedValue(new Error('Always fails'));

    const results = await service.captureAll(
      [{ url: 'https://always-fail.com' }],
      { retries: 0 },
    );

    expect(results[0]?.success).toBe(false);
    const captures = await storage.listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.status).toBe('failure');
    expect(captures[0]?.error).toContain('Always fails');
  });

  it('respects label option', async () => {
    const results = await service.captureAll([
      { url: 'https://example.com', label: 'My Label' },
    ]);

    expect(results[0]?.capture.label).toBe('My Label');
  });

  it('respects viewport options', async () => {
    await service.captureAll([{ url: 'https://example.com' }], {
      viewportWidth: 1920,
      viewportHeight: 1080,
    });

    expect(captureScreenshot).toHaveBeenCalledWith(
      expect.anything(),
      'https://example.com',
      expect.objectContaining({ viewportWidth: 1920, viewportHeight: 1080 }),
    );
  });

  it('defaults to pc device type', async () => {
    const results = await service.captureAll([{ url: 'https://example.com' }]);
    expect(results[0]?.capture.device_type).toBe('pc');
  });

  it('captures with mobile device type', async () => {
    const results = await service.captureAll(
      [{ url: 'https://example.com' }],
      { devices: ['mobile'] },
    );
    expect(results[0]?.capture.device_type).toBe('mobile');
    expect(results[0]?.capture.viewport_width).toBe(390);
    expect(results[0]?.capture.viewport_height).toBe(844);
  });

  it('captures both pc and mobile when both devices specified', async () => {
    const results = await service.captureAll(
      [{ url: 'https://example.com' }],
      { devices: ['pc', 'mobile'] },
    );
    expect(results).toHaveLength(2);
    const pcResult = results.find((r) => r.capture.device_type === 'pc');
    const mobileResult = results.find((r) => r.capture.device_type === 'mobile');
    expect(pcResult).toBeDefined();
    expect(mobileResult).toBeDefined();
  });
});
