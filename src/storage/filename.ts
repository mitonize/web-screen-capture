import { randomBytes } from 'node:crypto';
import type { DeviceType } from '../models/capture.js';

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
  ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return 'invalid-url';
  }
}

const COMMON_MULTI_PART_SUFFIXES = new Set([
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'ad.jp', 'ed.jp', 'go.jp', 'gr.jp', 'lg.jp',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'com.br', 'net.br', 'org.br', 'gov.br',
  'com.cn', 'net.cn', 'org.cn',
  'com.tw', 'net.tw', 'org.tw',
]);

function isIpAddress(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || /^[0-9a-f:]+$/i.test(hostname);
}

function getDomainAbbreviation(url: string): string {
  const hostname = getHostname(url);
  if (!hostname || hostname === 'invalid-url') {
    return 'invalid-url';
  }

  if (hostname === 'localhost') {
    return 'localhost';
  }

  if (isIpAddress(hostname)) {
    return 'ip';
  }

  const stripped = hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  const labels = stripped.split('.').filter(Boolean);
  if (labels.length === 0) {
    return 'domain';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  const suffix = labels.slice(-2).join('.');
  const registrable = COMMON_MULTI_PART_SUFFIXES.has(suffix) && labels.length >= 3
    ? labels[labels.length - 3]
    : labels[labels.length - 2];

  return (registrable ?? labels[0]).replace(/[^a-z0-9-]/g, '') || 'domain';
}

export interface ImageFilenameInput {
  captureId: string;
  url: string;
  capturedAt: string;
  deviceType?: DeviceType;
  randomPart?: string;
}

export function buildImageFilename(
  input: ImageFilenameInput,
  format: 'jpeg' | 'png' = 'jpeg',
): string {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  const device = input.deviceType ?? 'pc';
  const randomPart = input.randomPart ?? randomBytes(4).toString('hex');
  const domainAbbreviation = getDomainAbbreviation(input.url);
  return `${formatTimestamp(input.capturedAt)}_${domainAbbreviation}_${randomPart}_${device}.${ext}`;
}
