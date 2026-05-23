import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FilesystemStorage } from '../src/storage/filesystem.js';

// minimal valid 1×1 PNG bytes
const MINIMAL_PNG = Buffer.from([
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

function makeCapture(overrides: Partial<{
  id: string; url: string; status: 'success' | 'failure';
}> = {}) {
  return {
    id: overrides.id ?? '550e8400-e29b-41d4-a716-446655440001',
    url: overrides.url ?? 'https://example.com',
    captured_at: '2026-05-20T10:30:00.000Z',
    label: null,
    image_path: `images/${overrides.id ?? '550e8400-e29b-41d4-a716-446655440001'}.png`,
    status: overrides.status ?? 'success' as const,
    error: null,
    viewport_width: 1280,
    viewport_height: 720,
    full_page: true,
    device_type: 'pc' as const,
  };
}

describe('FilesystemStorage', () => {
  let tmpDir: string;
  let storage: FilesystemStorage;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsc-test-'));
    storage = new FilesystemStorage(tmpDir);
    await storage.init();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates required directories and files on init', async () => {
    const capturesPath = path.join(tmpDir, 'captures.json');
    const commentsPath = path.join(tmpDir, 'comments.json');
    const annotationsPath = path.join(tmpDir, 'annotations.json');
    const imagesDir = path.join(tmpDir, 'images');

    await expect(fs.access(capturesPath)).resolves.toBeUndefined();
    await expect(fs.access(commentsPath)).resolves.toBeUndefined();
    await expect(fs.access(annotationsPath)).resolves.toBeUndefined();
    await expect(fs.access(imagesDir)).resolves.toBeUndefined();
  });

  it('saves and retrieves a capture', async () => {
    const cap = makeCapture();
    await storage.saveCapture(cap);
    const found = await storage.findCapture(cap.id);
    expect(found).toEqual(cap);
  });

  it('lists all captures', async () => {
    const c1 = makeCapture({ id: '550e8400-e29b-41d4-a716-446655440001' });
    const c2 = makeCapture({ id: '550e8400-e29b-41d4-a716-446655440002' });
    await storage.saveCapture(c1);
    await storage.saveCapture(c2);
    const all = await storage.listCaptures();
    expect(all).toHaveLength(2);
  });

  it('returns null for unknown capture', async () => {
    const result = await storage.findCapture('nonexistent-id');
    expect(result).toBeNull();
  });

  it('updates existing capture on re-save', async () => {
    const cap = makeCapture();
    await storage.saveCapture(cap);
    const updated = { ...cap, label: 'updated label' };
    await storage.saveCapture(updated);
    const captures = await storage.listCaptures();
    expect(captures).toHaveLength(1);
    expect(captures[0]?.label).toBe('updated label');
  });

  it('saves and retrieves a comment', async () => {
    const cap = makeCapture();
    await storage.saveCapture(cap);
    const comment = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      capture_id: cap.id,
      parent_id: null,
      author: 'Alice',
      message: 'Great screenshot',
      created_at: '2026-05-20T10:31:00.000Z',
    };
    await storage.saveComment(comment);
    const found = await storage.findComment(comment.id);
    expect(found).toEqual(comment);
  });

  it('lists comments by capture ID', async () => {
    const cap1 = makeCapture({ id: '550e8400-e29b-41d4-a716-446655440001' });
    const cap2 = makeCapture({ id: '550e8400-e29b-41d4-a716-446655440002' });
    await storage.saveCapture(cap1);
    await storage.saveCapture(cap2);

    const comment1 = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      capture_id: cap1.id,
      parent_id: null,
      author: 'Alice',
      message: 'For cap1',
      created_at: '2026-05-20T10:31:00.000Z',
    };
    const comment2 = {
      id: '550e8400-e29b-41d4-a716-446655440011',
      capture_id: cap2.id,
      parent_id: null,
      author: 'Bob',
      message: 'For cap2',
      created_at: '2026-05-20T10:32:00.000Z',
    };
    await storage.saveComment(comment1);
    await storage.saveComment(comment2);

    const cap1Comments = await storage.listComments(cap1.id);
    expect(cap1Comments).toHaveLength(1);
    expect(cap1Comments[0]?.author).toBe('Alice');
  });

  it('saves and retrieves an annotation', async () => {
    const cap = makeCapture();
    await storage.saveCapture(cap);
    const annotation = {
      id: '550e8400-e29b-41d4-a716-446655440020',
      capture_id: cap.id,
      type: 'rect' as const,
      author: 'Alice',
      created_at: '2026-05-20T10:31:00.000Z',
      color: '#ff0000',
      label: null,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      x2: null,
      y2: null,
    };
    await storage.saveAnnotation(annotation);
    const found = await storage.findAnnotation(annotation.id);
    expect(found).toEqual(annotation);
  });

  it('deletes an annotation', async () => {
    const cap = makeCapture();
    await storage.saveCapture(cap);
    const annotation = {
      id: '550e8400-e29b-41d4-a716-446655440020',
      capture_id: cap.id,
      type: 'rect' as const,
      author: 'Alice',
      created_at: '2026-05-20T10:31:00.000Z',
      color: null,
      label: null,
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      x2: null,
      y2: null,
    };
    await storage.saveAnnotation(annotation);
    const deleted = await storage.deleteAnnotation(annotation.id);
    expect(deleted).toBe(true);
    const found = await storage.findAnnotation(annotation.id);
    expect(found).toBeNull();
  });

  it('returns false when deleting non-existent annotation', async () => {
    const result = await storage.deleteAnnotation('nonexistent-id');
    expect(result).toBe(false);
  });

  it('saves and reads image', async () => {
    const captureId = '550e8400-e29b-41d4-a716-446655440001';
    const imagePath = await storage.saveImage(captureId, MINIMAL_PNG);
    expect(imagePath).toBe(`images/${captureId}.png`);

    const read = await storage.readImage(captureId);
    expect(read).not.toBeNull();
    expect(read?.compare(MINIMAL_PNG)).toBe(0);
  });

  it('returns null for non-existent image', async () => {
    const result = await storage.readImage('nonexistent-id');
    expect(result).toBeNull();
  });

  describe('deleteCapture', () => {
    it('removes capture, related comments, annotations, and image', async () => {
      const cap = makeCapture();
      await storage.saveCapture(cap);
      await storage.saveImage(cap.id, MINIMAL_PNG);

      const comment = {
        id: '550e8400-e29b-41d4-a716-446655440010',
        capture_id: cap.id,
        parent_id: null,
        author: 'Alice',
        message: 'Test',
        created_at: '2026-05-20T10:31:00.000Z',
      };
      const annotation = {
        id: '550e8400-e29b-41d4-a716-446655440020',
        capture_id: cap.id,
        type: 'rect' as const,
        author: 'Alice',
        created_at: '2026-05-20T10:31:00.000Z',
        color: null,
        label: null,
        x: 0, y: 0, width: 10, height: 10, x2: null, y2: null,
      };
      await storage.saveComment(comment);
      await storage.saveAnnotation(annotation);

      const deleted = await storage.deleteCapture(cap.id);
      expect(deleted).toBe(true);

      expect(await storage.findCapture(cap.id)).toBeNull();
      expect(await storage.findComment(comment.id)).toBeNull();
      expect(await storage.findAnnotation(annotation.id)).toBeNull();
      expect(await storage.readImage(cap.id)).toBeNull();
    });

    it('returns false when capture does not exist', async () => {
      expect(await storage.deleteCapture('nonexistent-id')).toBe(false);
    });
  });

  describe('cleanupOrphanedMetadata', () => {
    it('removes captures whose image files are missing', async () => {
      const cap1 = makeCapture({ id: '550e8400-e29b-41d4-a716-446655440001' });
      const cap2 = makeCapture({ id: '550e8400-e29b-41d4-a716-446655440002' });
      await storage.saveCapture(cap1);
      await storage.saveCapture(cap2);
      // only save image for cap1
      await storage.saveImage(cap1.id, MINIMAL_PNG);

      const removed = await storage.cleanupOrphanedMetadata();
      expect(removed).toEqual([cap2.id]);

      expect(await storage.findCapture(cap1.id)).not.toBeNull();
      expect(await storage.findCapture(cap2.id)).toBeNull();
    });

    it('returns empty array when all images are present', async () => {
      const cap = makeCapture();
      await storage.saveCapture(cap);
      await storage.saveImage(cap.id, MINIMAL_PNG);

      const removed = await storage.cleanupOrphanedMetadata();
      expect(removed).toHaveLength(0);
    });

    it('returns empty array when there are no captures', async () => {
      const removed = await storage.cleanupOrphanedMetadata();
      expect(removed).toHaveLength(0);
    });
  });
});
