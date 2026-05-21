import { z } from 'zod';

export const CaptureSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  captured_at: z.string().datetime(),
  label: z.string().nullable().default(null),
  image_path: z.string(),
  status: z.enum(['success', 'failure']),
  error: z.string().nullable().default(null),
  viewport_width: z.number().int().positive().default(1280),
  viewport_height: z.number().int().positive().default(720),
  full_page: z.boolean().default(true),
});

export type Capture = z.infer<typeof CaptureSchema>;

export const CapturesFileSchema = z.object({
  version: z.literal(1),
  captures: z.array(CaptureSchema),
});

export type CapturesFile = z.infer<typeof CapturesFileSchema>;
