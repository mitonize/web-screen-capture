import { FilesystemStorage } from './filesystem.js';
import type { StorageBackend } from './interface.js';

export function createStorage(baseDir?: string): StorageBackend {
  return new FilesystemStorage(baseDir);
}

export type { StorageBackend } from './interface.js';
