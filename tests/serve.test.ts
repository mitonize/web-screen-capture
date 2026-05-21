import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { FilesystemStorage } from '../src/storage/filesystem.js';
import { createRequestHandler } from '../src/cli/commands/serve.js';

// minimal valid 1×1 PNG (base64)
const MOCK_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12P4z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==';
const MOCK_PNG = Buffer.from(MOCK_PNG_B64, 'base64');

function request(
  server: http.Server,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const addr = server.address() as { port: number };
    const payload = body ? JSON.stringify(body) : undefined;

    const req = http.request(
      {
        host: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as unknown;
            resolve({ status: res.statusCode ?? 0, data });
          } catch {
            reject(new Error('Failed to parse response JSON'));
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('wsc serve HTTP handler', () => {
  let tmpDir: string;
  let storage: FilesystemStorage;
  let server: http.Server;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wsc-serve-test-'));
    storage = new FilesystemStorage(tmpDir);
    await storage.init();

    server = http.createServer(createRequestHandler(storage));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  // ── GET /status ───────────────────────────────────────────────────────────

  it('GET /status returns ok', async () => {
    const { status, data } = await request(server, 'GET', '/status');
    expect(status).toBe(200);
    expect((data as { status: string }).status).toBe('ok');
  });

  // ── GET /captures ─────────────────────────────────────────────────────────

  it('GET /captures returns empty list initially', async () => {
    const { status, data } = await request(server, 'GET', '/captures');
    expect(status).toBe(200);
    expect((data as { captures: unknown[] }).captures).toHaveLength(0);
  });

  it('GET /captures returns saved captures in reverse order (newest first)', async () => {
    // Use /capture-image to save two records
    await request(server, 'POST', '/capture-image', {
      url: 'https://first.example.com',
      captures: [{ deviceType: 'pc', imageData: MOCK_PNG_B64, width: 1280, height: 720 }],
    });
    await request(server, 'POST', '/capture-image', {
      url: 'https://second.example.com',
      captures: [{ deviceType: 'pc', imageData: MOCK_PNG_B64, width: 1280, height: 720 }],
    });

    const { data } = await request(server, 'GET', '/captures');
    const captures = (data as { captures: Array<{ url: string }> }).captures;
    expect(captures).toHaveLength(2);
    expect(captures[0]?.url).toBe('https://second.example.com');
    expect(captures[1]?.url).toBe('https://first.example.com');
  });

  // ── OPTIONS (CORS preflight) ──────────────────────────────────────────────

  it('OPTIONS returns 204', async () => {
    const addr = server.address() as { port: number };
    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: addr.port, path: '/capture-image', method: 'OPTIONS' },
        (res) => { res.resume(); resolve(res.statusCode ?? 0); },
      );
      req.on('error', reject);
      req.end();
    });
    expect(status).toBe(204);
  });

  // ── POST /capture-image ───────────────────────────────────────────────────

  it('saves pc and mobile images from browser extension', async () => {
    const { status, data } = await request(server, 'POST', '/capture-image', {
      url: 'https://example.com',
      label: 'test',
      captures: [
        { deviceType: 'pc',     imageData: MOCK_PNG_B64, width: 1280, height: 720 },
        { deviceType: 'mobile', imageData: MOCK_PNG_B64, width: 390,  height: 844 },
      ],
    });

    expect(status).toBe(200);
    const results = (data as { results: Array<{ device_type: string; status: string }> }).results;
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.device_type === 'pc')?.status).toBe('success');
    expect(results.find((r) => r.device_type === 'mobile')?.status).toBe('success');

    const saved = await storage.listCaptures();
    expect(saved).toHaveLength(2);
  });

  it('persists correct metadata for browser-extension capture', async () => {
    await request(server, 'POST', '/capture-image', {
      url: 'https://example.com',
      label: 'ext-label',
      captures: [
        { deviceType: 'mobile', imageData: MOCK_PNG_B64, width: 390, height: 844 },
      ],
    });

    const saved = await storage.listCaptures();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.url).toBe('https://example.com');
    expect(saved[0]?.label).toBe('ext-label');
    expect(saved[0]?.device_type).toBe('mobile');
    expect(saved[0]?.viewport_width).toBe(390);
    expect(saved[0]?.viewport_height).toBe(844);
    expect(saved[0]?.full_page).toBe(true);
    expect(saved[0]?.status).toBe('success');
  });

  it('stores image bytes correctly', async () => {
    const { data } = await request(server, 'POST', '/capture-image', {
      url: 'https://example.com',
      captures: [{ deviceType: 'pc', imageData: MOCK_PNG_B64, width: 1280, height: 720 }],
    });

    const results = (data as { results: Array<{ id: string }> }).results;
    const id = results[0]!.id;
    const image = await storage.readImage(id);
    expect(image).not.toBeNull();
    expect(image?.equals(MOCK_PNG)).toBe(true);
  });

  it('returns 400 when url is missing', async () => {
    const { status, data } = await request(server, 'POST', '/capture-image', {
      captures: [{ deviceType: 'pc', imageData: MOCK_PNG_B64, width: 1280, height: 720 }],
    });
    expect(status).toBe(400);
    expect((data as { error: string }).error).toContain('url');
  });

  it('returns 400 when captures array is empty', async () => {
    const { status, data } = await request(server, 'POST', '/capture-image', {
      url: 'https://example.com',
      captures: [],
    });
    expect(status).toBe(400);
    expect((data as { error: string }).error).toContain('captures');
  });

  it('returns 400 when body is invalid JSON', async () => {
    const addr = server.address() as { port: number };
    const status = await new Promise<number>((resolve, reject) => {
      const payload = 'not-json';
      const req = http.request(
        {
          host: '127.0.0.1', port: addr.port, path: '/capture-image', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
        },
        (res) => { res.resume(); resolve(res.statusCode ?? 0); },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    expect(status).toBe(400);
  });

  // ── Unknown routes ────────────────────────────────────────────────────────

  it('returns 404 for unknown paths', async () => {
    const { status } = await request(server, 'GET', '/unknown');
    expect(status).toBe(404);
  });
});
