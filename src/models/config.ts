import { z } from 'zod';

export const ConfigSchema = z.object({
  version: z.literal(1),
  author: z.string().optional(),
  storage_backend: z.enum(['filesystem']).default('filesystem'),
  capture: z
    .object({
      timeout_ms: z.number().int().positive().default(3000),
      retries: z.number().int().nonnegative().default(3),
      viewport_width: z.number().int().positive().default(1280),
      viewport_height: z.number().int().positive().default(720),
      full_page: z.boolean().default(true),
      concurrency: z.number().int().min(1).max(20).default(5),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;
