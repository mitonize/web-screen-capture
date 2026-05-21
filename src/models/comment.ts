import { z } from 'zod';

export const CommentSchema = z.object({
  id: z.string().uuid(),
  capture_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable().default(null),
  author: z.string().min(1),
  message: z.string().min(1),
  created_at: z.string().datetime(),
});

export type Comment = z.infer<typeof CommentSchema>;

export const CommentsFileSchema = z.object({
  version: z.literal(1),
  comments: z.array(CommentSchema),
});

export type CommentsFile = z.infer<typeof CommentsFileSchema>;

export type CommentThread = Comment & {
  replies: CommentThread[];
};

export function buildCommentThreads(comments: Comment[]): CommentThread[] {
  const roots: CommentThread[] = [];
  const map = new Map<string, CommentThread>();

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const thread of map.values()) {
    if (thread.parent_id === null) {
      roots.push(thread);
    } else {
      const parent = map.get(thread.parent_id);
      if (parent) {
        parent.replies.push(thread);
      } else {
        roots.push(thread);
      }
    }
  }

  return roots;
}
