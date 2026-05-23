import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { StorageBackend } from './interface.js';
import type { Capture, CapturesFile } from '../models/capture.js';
import type { Comment, CommentsFile } from '../models/comment.js';
import type { Annotation, AnnotationsFile } from '../models/annotation.js';
import { CapturesFileSchema } from '../models/capture.js';
import { CommentsFileSchema } from '../models/comment.js';
import { AnnotationsFileSchema } from '../models/annotation.js';

async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmp = `${filePath}.${uuidv4()}.tmp`;
  await fs.writeFile(tmp, data, 'utf-8');
  await fs.rename(tmp, filePath);
}

class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

export class FilesystemStorage implements StorageBackend {
  private baseDir: string;
  private imagesDir: string;
  private capturesMutex = new Mutex();
  private commentsMutex = new Mutex();
  private annotationsMutex = new Mutex();

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(process.cwd(), '.wsc');
    this.imagesDir = path.join(this.baseDir, 'images');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.mkdir(this.imagesDir, { recursive: true });

    await this.ensureFile<CapturesFile>(
      this.capturesPath(),
      { version: 1, captures: [] },
    );
    await this.ensureFile<CommentsFile>(
      this.commentsPath(),
      { version: 1, comments: [] },
    );
    await this.ensureFile<AnnotationsFile>(
      this.annotationsPath(),
      { version: 1, annotations: [] },
    );
  }

  private capturesPath(): string {
    return path.join(this.baseDir, 'captures.json');
  }

  private commentsPath(): string {
    return path.join(this.baseDir, 'comments.json');
  }

  private annotationsPath(): string {
    return path.join(this.baseDir, 'annotations.json');
  }

  private async ensureFile<T>(filePath: string, defaultValue: T): Promise<void> {
    try {
      await fs.access(filePath);
    } catch {
      await atomicWrite(filePath, JSON.stringify(defaultValue, null, 2));
    }
  }

  private async readCapturesFile(): Promise<CapturesFile> {
    const raw = await fs.readFile(this.capturesPath(), 'utf-8');
    return CapturesFileSchema.parse(JSON.parse(raw));
  }

  private async writeCapturesFile(data: CapturesFile): Promise<void> {
    await atomicWrite(this.capturesPath(), JSON.stringify(data, null, 2));
  }

  private async readCommentsFile(): Promise<CommentsFile> {
    const raw = await fs.readFile(this.commentsPath(), 'utf-8');
    return CommentsFileSchema.parse(JSON.parse(raw));
  }

  private async writeCommentsFile(data: CommentsFile): Promise<void> {
    await atomicWrite(this.commentsPath(), JSON.stringify(data, null, 2));
  }

  private async readAnnotationsFile(): Promise<AnnotationsFile> {
    const raw = await fs.readFile(this.annotationsPath(), 'utf-8');
    return AnnotationsFileSchema.parse(JSON.parse(raw));
  }

  private async writeAnnotationsFile(data: AnnotationsFile): Promise<void> {
    await atomicWrite(this.annotationsPath(), JSON.stringify(data, null, 2));
  }

  async saveCapture(capture: Capture): Promise<void> {
    return this.capturesMutex.run(async () => {
      const file = await this.readCapturesFile();
      const idx = file.captures.findIndex((c) => c.id === capture.id);
      if (idx >= 0) {
        file.captures[idx] = capture;
      } else {
        file.captures.push(capture);
      }
      await this.writeCapturesFile(file);
    });
  }

  async listCaptures(): Promise<Capture[]> {
    const file = await this.readCapturesFile();
    return file.captures;
  }

  async findCapture(id: string): Promise<Capture | null> {
    const file = await this.readCapturesFile();
    return file.captures.find((c) => c.id === id) ?? null;
  }

  async saveComment(comment: Comment): Promise<void> {
    return this.commentsMutex.run(async () => {
      const file = await this.readCommentsFile();
      const idx = file.comments.findIndex((c) => c.id === comment.id);
      if (idx >= 0) {
        file.comments[idx] = comment;
      } else {
        file.comments.push(comment);
      }
      await this.writeCommentsFile(file);
    });
  }

  async listComments(captureId: string): Promise<Comment[]> {
    const file = await this.readCommentsFile();
    return file.comments.filter((c) => c.capture_id === captureId);
  }

  async findComment(id: string): Promise<Comment | null> {
    const file = await this.readCommentsFile();
    return file.comments.find((c) => c.id === id) ?? null;
  }

  async saveAnnotation(annotation: Annotation): Promise<void> {
    return this.annotationsMutex.run(async () => {
      const file = await this.readAnnotationsFile();
      const idx = file.annotations.findIndex((a) => a.id === annotation.id);
      if (idx >= 0) {
        file.annotations[idx] = annotation;
      } else {
        file.annotations.push(annotation);
      }
      await this.writeAnnotationsFile(file);
    });
  }

  async listAnnotations(captureId: string): Promise<Annotation[]> {
    const file = await this.readAnnotationsFile();
    return file.annotations.filter((a) => a.capture_id === captureId);
  }

  async findAnnotation(id: string): Promise<Annotation | null> {
    const file = await this.readAnnotationsFile();
    return file.annotations.find((a) => a.id === id) ?? null;
  }

  async deleteAnnotation(id: string): Promise<boolean> {
    return this.annotationsMutex.run(async () => {
      const file = await this.readAnnotationsFile();
      const before = file.annotations.length;
      file.annotations = file.annotations.filter((a) => a.id !== id);
      if (file.annotations.length === before) return false;
      await this.writeAnnotationsFile(file);
      return true;
    });
  }

  async deleteCapture(id: string): Promise<boolean> {
    let removed = false;

    await this.capturesMutex.run(async () => {
      const file = await this.readCapturesFile();
      const before = file.captures.length;
      file.captures = file.captures.filter((c) => c.id !== id);
      if (file.captures.length < before) {
        await this.writeCapturesFile(file);
        removed = true;
      }
    });

    if (!removed) return false;

    await this.commentsMutex.run(async () => {
      const file = await this.readCommentsFile();
      file.comments = file.comments.filter((c) => c.capture_id !== id);
      await this.writeCommentsFile(file);
    });

    await this.annotationsMutex.run(async () => {
      const file = await this.readAnnotationsFile();
      file.annotations = file.annotations.filter((a) => a.capture_id !== id);
      await this.writeAnnotationsFile(file);
    });

    try {
      await fs.unlink(path.join(this.imagesDir, `${id}.png`));
    } catch {
      // image may already be gone – that's fine
    }

    return true;
  }

  async cleanupOrphanedMetadata(): Promise<string[]> {
    const captures = await this.listCaptures();
    const removed: string[] = [];

    for (const capture of captures) {
      const imagePath = path.join(this.imagesDir, `${capture.id}.png`);
      const exists = await fs.access(imagePath).then(() => true).catch(() => false);
      if (!exists) {
        await this.deleteCapture(capture.id);
        removed.push(capture.id);
      }
    }

    return removed;
  }

  async saveImage(captureId: string, data: Buffer): Promise<string> {
    const filename = `${captureId}.png`;
    const fullPath = path.join(this.imagesDir, filename);
    await fs.writeFile(fullPath, data);
    return `images/${filename}`;
  }

  async readImage(captureId: string): Promise<Buffer | null> {
    const fullPath = path.join(this.imagesDir, `${captureId}.png`);
    try {
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }
}
