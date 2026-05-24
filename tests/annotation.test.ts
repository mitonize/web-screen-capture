import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FilesystemStorage } from '../src/storage/filesystem.js';
import type { Annotation } from '../src/models/annotation.js';

const MOCK_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde,
]);

const captureId = '550e8400-e29b-41d4-a716-446655440000';

function makeAnnotation(overrides: Partial<Annotation> & { type: Annotation['type'] }): Annotation {
  const base = {
    id: '550e8400-e29b-41d4-a716-446655440020',
    capture_id: captureId,
    author: 'Alice',
    created_at: '2026-05-20T10:31:00.000Z',
    color: null,
    label: null,
  };

  if (overrides.type === 'rect' || overrides.type === 'highlight') {
    return {
      ...base,
      type: overrides.type,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      x2: null,
      y2: null,
      ...overrides,
    } as Annotation;
  } else if (overrides.type === 'arrow') {
    return {
      ...base,
      type: 'arrow',
      x: 10,
      y: 20,
      x2: 200,
      y2: 200,
      width: null,
      height: null,
      ...overrides,
    } as Annotation;
  } else {
    return {
      ...base,
      type: 'text',
      x: 10,
      y: 20,
      label: 'My label',
      x2: null,
      y2: null,
      width: null,
      height: null,
      ...overrides,
    } as Annotation;
  }
}

describe('Annotation storage', () => {
  let tmpDir: string;
  let storage: FilesystemStorage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsc-annotation-test-'));
    storage = new FilesystemStorage(tmpDir);
    await storage.init();

    const imagePath = await storage.saveImage(
      {
        captureId,
        url: 'https://example.com',
        capturedAt: '2026-05-20T10:30:00.000Z',
      },
      MOCK_PNG,
    );

    await storage.saveCapture({
      id: captureId,
      url: 'https://example.com',
      captured_at: '2026-05-20T10:30:00.000Z',
      label: 'Test',
      image_path: imagePath,
      status: 'success',
      error: null,
      viewport_width: 1280,
      viewport_height: 720,
      full_page: true,
    });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('saves and retrieves a rect annotation', async () => {
    const ann = makeAnnotation({ type: 'rect' });
    await storage.saveAnnotation(ann);
    const found = await storage.findAnnotation(ann.id);
    expect(found).toEqual(ann);
    expect(found?.type).toBe('rect');
  });

  it('saves and retrieves an arrow annotation', async () => {
    const ann = makeAnnotation({ type: 'arrow' });
    await storage.saveAnnotation(ann);
    const found = await storage.findAnnotation(ann.id);
    expect(found).toEqual(ann);
    expect(found?.type).toBe('arrow');
  });

  it('saves and retrieves a text annotation', async () => {
    const ann = makeAnnotation({ type: 'text', label: 'Test text' });
    await storage.saveAnnotation(ann);
    const found = await storage.findAnnotation(ann.id);
    expect(found).toEqual(ann);
    expect(found?.type).toBe('text');
    if (found?.type === 'text') {
      expect(found.label).toBe('Test text');
    }
  });

  it('saves and retrieves a highlight annotation', async () => {
    const ann = makeAnnotation({ type: 'highlight' });
    await storage.saveAnnotation(ann);
    const found = await storage.findAnnotation(ann.id);
    expect(found).toEqual(ann);
    expect(found?.type).toBe('highlight');
  });

  it('lists annotations by capture ID', async () => {
    const ann1 = makeAnnotation({ type: 'rect', id: '550e8400-e29b-41d4-a716-446655440020' });
    const ann2 = makeAnnotation({ type: 'arrow', id: '550e8400-e29b-41d4-a716-446655440021' });
    await storage.saveAnnotation(ann1);
    await storage.saveAnnotation(ann2);

    const annotations = await storage.listAnnotations(captureId);
    expect(annotations).toHaveLength(2);
  });

  it('deletes annotation without affecting others', async () => {
    const ann1 = makeAnnotation({ type: 'rect', id: '550e8400-e29b-41d4-a716-446655440020' });
    const ann2 = makeAnnotation({ type: 'arrow', id: '550e8400-e29b-41d4-a716-446655440021' });
    await storage.saveAnnotation(ann1);
    await storage.saveAnnotation(ann2);

    await storage.deleteAnnotation(ann1.id);
    const remaining = await storage.listAnnotations(captureId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe(ann2.id);
  });

  it('deleting annotation does not modify any image files', async () => {
    const imagePath = await storage.saveImage(
      {
        captureId,
        url: 'https://example.com',
        capturedAt: '2026-05-20T10:30:00.000Z',
      },
      MOCK_PNG,
    );
    await storage.saveCapture({
      id: captureId,
      url: 'https://example.com',
      captured_at: '2026-05-20T10:30:00.000Z',
      label: 'Test',
      image_path: imagePath,
      status: 'success',
      error: null,
      viewport_width: 1280,
      viewport_height: 720,
      full_page: true,
    });

    const ann = makeAnnotation({ type: 'rect' });
    await storage.saveAnnotation(ann);
    await storage.deleteAnnotation(ann.id);

    const image = await storage.readImage(captureId);
    expect(image).not.toBeNull();
    expect(image?.compare(MOCK_PNG)).toBe(0);
  });

  it('returns false when deleting non-existent annotation', async () => {
    const deleted = await storage.deleteAnnotation('nonexistent');
    expect(deleted).toBe(false);
  });
});
