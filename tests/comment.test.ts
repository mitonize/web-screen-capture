import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FilesystemStorage } from '../src/storage/filesystem.js';
import { buildCommentThreads } from '../src/models/comment.js';

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

describe('Comment command integration', () => {
  let tmpDir: string;
  let storage: FilesystemStorage;

  const captureId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsc-comment-test-'));
    storage = new FilesystemStorage(tmpDir);
    await storage.init();

    await storage.saveCapture({
      id: captureId,
      url: 'https://example.com',
      captured_at: '2026-05-20T10:30:00.000Z',
      label: 'Test',
      image_path: `images/${captureId}.png`,
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

  it('adds a top-level comment', async () => {
    const comment = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      capture_id: captureId,
      parent_id: null,
      author: 'Alice',
      message: 'Looks great!',
      created_at: '2026-05-20T10:31:00.000Z',
    };
    await storage.saveComment(comment);

    const comments = await storage.listComments(captureId);
    expect(comments).toHaveLength(1);
    expect(comments[0]?.message).toBe('Looks great!');
  });

  it('adds a reply to a comment', async () => {
    const parent = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      capture_id: captureId,
      parent_id: null,
      author: 'Alice',
      message: 'Looks great!',
      created_at: '2026-05-20T10:31:00.000Z',
    };
    const reply = {
      id: '550e8400-e29b-41d4-a716-446655440011',
      capture_id: captureId,
      parent_id: parent.id,
      author: 'Bob',
      message: 'I agree!',
      created_at: '2026-05-20T10:32:00.000Z',
    };
    await storage.saveComment(parent);
    await storage.saveComment(reply);

    const comments = await storage.listComments(captureId);
    expect(comments).toHaveLength(2);
  });

  it('builds comment thread tree correctly', async () => {
    const parent = {
      id: '550e8400-e29b-41d4-a716-446655440010',
      capture_id: captureId,
      parent_id: null,
      author: 'Alice',
      message: 'Looks great!',
      created_at: '2026-05-20T10:31:00.000Z',
    };
    const reply1 = {
      id: '550e8400-e29b-41d4-a716-446655440011',
      capture_id: captureId,
      parent_id: parent.id,
      author: 'Bob',
      message: 'I agree!',
      created_at: '2026-05-20T10:32:00.000Z',
    };
    const reply2 = {
      id: '550e8400-e29b-41d4-a716-446655440012',
      capture_id: captureId,
      parent_id: parent.id,
      author: 'Charlie',
      message: 'Me too!',
      created_at: '2026-05-20T10:33:00.000Z',
    };

    const threads = buildCommentThreads([parent, reply1, reply2]);

    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies).toHaveLength(2);
    expect(threads[0]?.author).toBe('Alice');
  });

  it('handles orphaned replies as root comments', async () => {
    const orphan = {
      id: '550e8400-e29b-41d4-a716-446655440011',
      capture_id: captureId,
      parent_id: '550e8400-e29b-41d4-a716-999999999999', // non-existent parent
      author: 'Bob',
      message: 'Orphaned reply',
      created_at: '2026-05-20T10:32:00.000Z',
    };

    const threads = buildCommentThreads([orphan]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.message).toBe('Orphaned reply');
  });
});
