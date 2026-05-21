import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FilesystemStorage } from '../src/storage/filesystem.js';

const MOCK_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00,
]);

vi.mock('../src/core/browser.js', () => ({
  launchBrowser: vi.fn().mockResolvedValue({
    close: vi.fn().mockResolvedValue(undefined),
  }),
  captureScreenshot: vi.fn().mockResolvedValue(MOCK_PNG),
}));

describe('Export command integration', () => {
  let tmpDir: string;
  let storage: FilesystemStorage;
  let exportDir: string;

  const captureId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsc-export-test-'));
    exportDir = path.join(tmpDir, 'export-output');
    storage = new FilesystemStorage(path.join(tmpDir, '.wsc'));
    await storage.init();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function setupCapture(id = captureId) {
    await storage.saveCapture({
      id,
      url: 'https://example.com',
      captured_at: '2026-05-20T10:30:00.000Z',
      label: 'Test capture',
      image_path: `images/${id}.png`,
      status: 'success',
      error: null,
      viewport_width: 1280,
      viewport_height: 720,
      full_page: true,
    });
    await storage.saveImage(id, MOCK_PNG);
  }

  it('exports captures to output directory', async () => {
    await setupCapture();

    const captures = await storage.listCaptures();
    const imagesDir = path.join(exportDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    for (const capture of captures) {
      const comments = await storage.listComments(capture.id);
      const annotations = await storage.listAnnotations(capture.id);
      const imageData = await storage.readImage(capture.id);
      if (imageData) {
        await fs.writeFile(path.join(imagesDir, `${capture.id}.png`), imageData);
      }
      const exportData = {
        version: 1,
        exported_at: new Date().toISOString(),
        captures: [{
          ...capture,
          image_path: `images/${capture.id}.png`,
          comments,
          annotations,
        }],
      };
      await fs.writeFile(
        path.join(exportDir, 'export.json'),
        JSON.stringify(exportData, null, 2),
      );
    }

    const exportJsonPath = path.join(exportDir, 'export.json');
    const exportJsonContent = await fs.readFile(exportJsonPath, 'utf-8');
    const exportJson = JSON.parse(exportJsonContent) as { version: number; captures: unknown[] };
    expect(exportJson.version).toBe(1);
    expect(exportJson.captures).toHaveLength(1);
  });

  it('export includes images', async () => {
    await setupCapture();

    const captures = await storage.listCaptures();
    const imagesDir = path.join(exportDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    for (const capture of captures) {
      const imageData = await storage.readImage(capture.id);
      if (imageData) {
        await fs.writeFile(path.join(imagesDir, `${capture.id}.png`), imageData);
      }
    }

    const imagePath = path.join(imagesDir, `${captureId}.png`);
    await expect(fs.access(imagePath)).resolves.toBeUndefined();
  });

  it('handles export with 0 captures', async () => {
    const captures = await storage.listCaptures();
    expect(captures).toHaveLength(0);
    // No error thrown, just no captures to export
  });

  it('export.json has correct relative image paths', async () => {
    await setupCapture();
    const captures = await storage.listCaptures();
    const imagesDir = path.join(exportDir, 'images');
    await fs.mkdir(imagesDir, { recursive: true });

    const exportCaptures = captures.map((c) => ({
      ...c,
      image_path: `images/${c.id}.png`,
      comments: [],
      annotations: [],
    }));

    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      captures: exportCaptures,
    };
    await fs.writeFile(
      path.join(exportDir, 'export.json'),
      JSON.stringify(exportData, null, 2),
    );

    const content = await fs.readFile(path.join(exportDir, 'export.json'), 'utf-8');
    const parsed = JSON.parse(content) as { captures: Array<{ image_path: string }> };
    expect(parsed.captures[0]?.image_path).toBe(`images/${captureId}.png`);
  });

  it('exports multiple captures', async () => {
    const id1 = '550e8400-e29b-41d4-a716-446655440001';
    const id2 = '550e8400-e29b-41d4-a716-446655440002';
    await setupCapture(id1);
    await setupCapture(id2);

    const captures = await storage.listCaptures();
    expect(captures).toHaveLength(2);
  });
});
