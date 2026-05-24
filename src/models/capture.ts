import { z } from 'zod';

export const DeviceTypeSchema = z.enum(['pc', 'mobile']);
export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const ImageFormatSchema = z.enum(['jpeg', 'png']);
export type ImageFormat = z.infer<typeof ImageFormatSchema>;

export const DEVICE_PRESETS: Record<DeviceType, { width: number; height: number; userAgent: string }> = {
  pc: {
    width: 1280,
    height: 720,
    userAgent: '',
  },
  mobile: {
    width: 390,
    height: 844,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
};

export const CaptureSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  captured_at: z.string().datetime(),
  label: z.string().nullable().default(null),
  image_path: z.string(),
  image_format: ImageFormatSchema.default('jpeg'),
  status: z.enum(['success', 'failure']),
  error: z.string().nullable().default(null),
  viewport_width: z.number().int().positive().default(1280),
  viewport_height: z.number().int().positive().default(720),
  full_page: z.boolean().default(true),
  device_type: DeviceTypeSchema.default('pc'),
});

export type Capture = z.infer<typeof CaptureSchema>;

export const CapturesFileSchema = z.object({
  version: z.literal(1),
  captures: z.array(CaptureSchema),
});

export type CapturesFile = z.infer<typeof CapturesFileSchema>;
