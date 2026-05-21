import type { Capture } from '../models/capture.js';
import type { Comment } from '../models/comment.js';
import type { Annotation } from '../models/annotation.js';

export interface StorageBackend {
  init(): Promise<void>;

  saveCapture(capture: Capture): Promise<void>;
  listCaptures(): Promise<Capture[]>;
  findCapture(id: string): Promise<Capture | null>;

  saveComment(comment: Comment): Promise<void>;
  listComments(captureId: string): Promise<Comment[]>;
  findComment(id: string): Promise<Comment | null>;

  saveAnnotation(annotation: Annotation): Promise<void>;
  listAnnotations(captureId: string): Promise<Annotation[]>;
  findAnnotation(id: string): Promise<Annotation | null>;
  deleteAnnotation(id: string): Promise<boolean>;

  saveImage(captureId: string, data: Buffer): Promise<string>;
  readImage(captureId: string): Promise<Buffer | null>;
}
