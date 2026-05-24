import { Command } from 'commander';
import http from 'node:http';
import { v4 as uuidv4 } from 'uuid';
import { createStorage } from '../../storage/index.js';
import { CaptureService } from '../../core/capture-service.js';
import { printSuccess, printError } from '../output.js';
import type { StorageBackend } from '../../storage/interface.js';
import type { DeviceType, Capture } from '../../models/capture.js';

const DEFAULT_PORT = 4242;
const DEFAULT_HOST = '127.0.0.1';

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/** Creates the HTTP request handler. Exported for testing. */
export function createRequestHandler(
  storage: StorageBackend,
): http.RequestListener {
  return async (req, res) => {
    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const base = `http://${req.headers.host ?? 'localhost'}`;
    const url = new URL(req.url ?? '/', base);

    try {
      if (req.method === 'GET' && url.pathname === '/status') {
        sendJson(res, 200, { status: 'ok', version: '1.0.0' });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/captures') {
        const captures = await storage.listCaptures();
        const recent = captures.slice().reverse().slice(0, 20);
        sendJson(res, 200, { captures: recent });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/capture') {
        const body = await readBody(req);
        let parsed: { url?: string; label?: string; devices?: string[] };
        try {
          parsed = JSON.parse(body) as { url?: string; label?: string; devices?: string[] };
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        if (!parsed.url) {
          sendJson(res, 400, { error: 'url is required' });
          return;
        }

        const devices = (parsed.devices ?? ['pc', 'mobile']).filter(
          (d): d is DeviceType => d === 'pc' || d === 'mobile',
        );

        if (devices.length === 0) {
          sendJson(res, 400, { error: 'No valid devices specified' });
          return;
        }

        printSuccess(`→ Capturing [${devices.join(', ')}] ${parsed.url}`);

        const service = new CaptureService(storage);
        const results = await service.captureAll(
          [{ url: parsed.url, label: parsed.label }],
          { devices, fullPage: true },
        );

        for (const r of results) {
          if (r.success) {
            printSuccess(`  ✓ [${r.capture.device_type}] ${r.capture.id}`);
          } else {
            printError(`  ✗ [${r.capture.device_type}] ${r.capture.error ?? 'unknown error'}`);
          }
        }

        sendJson(res, 200, {
          results: results.map((r) => ({
            id: r.capture.id,
            url: r.capture.url,
            device_type: r.capture.device_type,
            status: r.capture.status,
            image_path: r.capture.image_path,
            error: r.capture.error,
          })),
        });
        return;
      }

      // POST /capture-image — accept pre-captured images from browser extension
      // (avoids page reload; the extension captures the live DOM via debugger API)
      if (req.method === 'POST' && url.pathname === '/capture-image') {
        const body = await readBody(req);
        let parsed: {
          url?: string;
          label?: string;
          captures?: Array<{
            deviceType: string;
            imageData: string; // base64-encoded PNG
            width: number;
            height: number;
          }>;
        };
        try {
          parsed = JSON.parse(body) as typeof parsed;
        } catch {
          sendJson(res, 400, { error: 'Invalid JSON body' });
          return;
        }

        if (!parsed.url) {
          sendJson(res, 400, { error: 'url is required' });
          return;
        }
        if (!Array.isArray(parsed.captures) || parsed.captures.length === 0) {
          sendJson(res, 400, { error: 'captures array is required' });
          return;
        }

        const capturedAt = new Date().toISOString();
        const savedResults: Array<{
          id: string;
          url: string;
          device_type: string;
          status: string;
          image_path: string;
          error: string | null;
        }> = [];

        for (const cap of parsed.captures) {
          const deviceType = (cap.deviceType === 'mobile' ? 'mobile' : 'pc') as DeviceType;
          const id = uuidv4();
          try {
            const imageBuffer = Buffer.from(cap.imageData, 'base64');
            const imagePath = await storage.saveImage(
              { captureId: id, url: parsed.url, capturedAt },
              imageBuffer,
              'png',
            );

            const capture: Capture = {
              id,
              url: parsed.url,
              captured_at: capturedAt,
              label: parsed.label ?? null,
              image_path: imagePath,
              image_format: 'png',
              status: 'success',
              error: null,
              viewport_width: cap.width,
              viewport_height: cap.height,
              full_page: true,
              device_type: deviceType,
            };
            await storage.saveCapture(capture);
            printSuccess(`  ✓ [${deviceType}] ${id}`);
            savedResults.push({ id, url: parsed.url, device_type: deviceType, status: 'success', image_path: imagePath, error: null });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            printError(`  ✗ [${deviceType}] ${msg}`);
            savedResults.push({ id, url: parsed.url ?? '', device_type: deviceType, status: 'failure', image_path: '', error: msg });
          }
        }

        printSuccess(`→ Saved ${savedResults.filter((r) => r.status === 'success').length}/${savedResults.length} captures from browser extension`);
        sendJson(res, 200, { results: savedResults });
        return;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      printError(`Server error: ${msg}`);
      sendJson(res, 500, { error: msg });
    }
  };
}

export function makeServeCommand(): Command {
  const cmd = new Command('serve');
  cmd
    .description('Start local HTTP server for browser extension integration')
    .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
    .option('--host <host>', 'Host to bind to', DEFAULT_HOST)
    .option('--storage-dir <dir>', 'Storage directory override')
    .action(async (opts: { port: string; host: string; storageDir?: string }) => {
      const port = parseInt(opts.port, 10) || DEFAULT_PORT;
      const host = opts.host;

      const storage = createStorage(opts.storageDir);
      await storage.init();

      const server = http.createServer(createRequestHandler(storage));

      server.listen(port, host, () => {
        printSuccess(`wsc server running at http://${host}:${port}`);
        printSuccess('');
        printSuccess('Endpoints:');
        printSuccess(`  GET  /status          — health check`);
        printSuccess(`  GET  /captures        — list recent captures (latest 20)`);
        printSuccess(`  POST /capture         — capture a URL (Playwright)`);
        printSuccess(`                          body: { "url": "...", "label": "...", "devices": ["pc","mobile"] }`);
        printSuccess(`  POST /capture-image   — save pre-captured images (browser extension)`);
        printSuccess(`                          body: { "url": "...", "captures": [{ "deviceType", "imageData", "width", "height" }] }`);
        printSuccess('');
        printSuccess('Press Ctrl+C to stop.');
      });

      process.on('SIGINT', () => {
        printSuccess('\nShutting down...');
        server.close(() => process.exit(0));
      });
    });

  return cmd;
}
