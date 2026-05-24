import crypto from 'node:crypto';

function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return '00000000-000000-000';
  }

  const pad = (value: number, length = 2) => String(value).padStart(length, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'invalid-url';
  }
}

function hashDomain(url: string): string {
  return crypto.createHash('sha256').update(getHostname(url)).digest('hex').slice(0, 10);
}

export interface ImageFilenameInput {
  captureId: string;
  url: string;
  capturedAt: string;
}

export function buildImageFilename(
  input: ImageFilenameInput,
  format: 'jpeg' | 'png' = 'jpeg',
): string {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  return `${formatTimestamp(input.capturedAt)}-${hashDomain(input.url)}.${ext}`;
}
