import { z } from 'zod';

const BaseAnnotationSchema = z.object({
  id: z.string().uuid(),
  capture_id: z.string().uuid(),
  author: z.string().min(1),
  created_at: z.string().datetime(),
  color: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
});

const RectAnnotationSchema = BaseAnnotationSchema.extend({
  type: z.literal('rect'),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  x2: z.null().default(null),
  y2: z.null().default(null),
});

const ArrowAnnotationSchema = BaseAnnotationSchema.extend({
  type: z.literal('arrow'),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  x2: z.number().int().nonnegative(),
  y2: z.number().int().nonnegative(),
  width: z.null().default(null),
  height: z.null().default(null),
});

const TextAnnotationSchema = BaseAnnotationSchema.extend({
  type: z.literal('text'),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  label: z.string().min(1),
  x2: z.null().default(null),
  y2: z.null().default(null),
  width: z.null().default(null),
  height: z.null().default(null),
});

const HighlightAnnotationSchema = BaseAnnotationSchema.extend({
  type: z.literal('highlight'),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  x2: z.null().default(null),
  y2: z.null().default(null),
});

export const AnnotationSchema = z.discriminatedUnion('type', [
  RectAnnotationSchema,
  ArrowAnnotationSchema,
  TextAnnotationSchema,
  HighlightAnnotationSchema,
]);

export type Annotation = z.infer<typeof AnnotationSchema>;

export const AnnotationsFileSchema = z.object({
  version: z.literal(1),
  annotations: z.array(AnnotationSchema),
});

export type AnnotationsFile = z.infer<typeof AnnotationsFileSchema>;
