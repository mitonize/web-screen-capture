# データモデル: web-screen-capture

**フィーチャー**: web-screen-capture | **日付**: 2026-05-20

---

## エンティティ概要

```
Capture (1) ──< Comment (*)
    │               └── parent_id → Comment (自己参照)
    └──< Annotation (*)
```

---

## Capture エンティティ

**ファイル**: `src/models/capture.ts`

### Zod スキーマ

```typescript
import { z } from 'zod';

export const CaptureSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  captured_at: z.string().datetime(),
  label: z.string().nullable().default(null),
  image_path: z.string(),          // .wsc/ からの相対パス
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
```

### フィールド定義

| フィールド | 型 | 必須 | デフォルト | バリデーション |
|-----------|-----|------|-----------|--------------|
| `id` | UUID v4 文字列 | ✅ | 自動生成 | UUID 形式 |
| `url` | URL 文字列 | ✅ | — | URL 形式 |
| `captured_at` | ISO 8601 文字列 | ✅ | 実行時刻 | datetime 形式 |
| `label` | 文字列 \| null | — | null | — |
| `image_path` | 文字列 | ✅ | 自動設定 | — |
| `status` | `"success"` \| `"failure"` | ✅ | — | enum |
| `error` | 文字列 \| null | — | null | — |
| `viewport_width` | 正の整数 | ✅ | 1280 | > 0 |
| `viewport_height` | 正の整数 | ✅ | 720 | > 0 |
| `full_page` | boolean | ✅ | true | — |

### ステート遷移

```
capture コマンド実行
    ↓
[pending] → Playwright でページ読み込み
    ↓ 成功                    ↓ 失敗（リトライ消尽）
[status: "success"]    [status: "failure", error: <メッセージ>]
```

---

## Comment エンティティ

**ファイル**: `src/models/comment.ts`

### Zod スキーマ

```typescript
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

// コメントをスレッドツリーに変換する型
export type CommentThread = Comment & {
  replies: CommentThread[];
};
```

### フィールド定義

| フィールド | 型 | 必須 | デフォルト | バリデーション |
|-----------|-----|------|-----------|--------------|
| `id` | UUID v4 文字列 | ✅ | 自動生成 | UUID 形式 |
| `capture_id` | UUID v4 文字列 | ✅ | — | 存在する Capture ID |
| `parent_id` | UUID v4 文字列 \| null | — | null | null = ルートコメント |
| `author` | 文字列 | ✅ | 著者解決ロジック | 1文字以上 |
| `message` | 文字列 | ✅ | — | 1文字以上 |
| `created_at` | ISO 8601 文字列 | ✅ | 実行時刻 | datetime 形式 |

### スレッド構造の規則

- `parent_id: null` → ルートコメント（キャプチャに直接紐付く）
- `parent_id: <id>` → 指定コメントへの返信
- 返信の返信（n階層ネスト）は技術的に可能だが、UIでは2階層までを推奨表示
- 循環参照は保存時にバリデーションで防止

---

## Annotation エンティティ

**ファイル**: `src/models/annotation.ts`

### Zod スキーマ

```typescript
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
  label: z.string().min(1),  // text タイプでは必須
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
```

### アノテーション種別ごとの必須フィールド

| 種別 | `x` | `y` | `width` | `height` | `x2` | `y2` | `label` |
|------|-----|-----|---------|----------|------|------|---------|
| `rect` | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `arrow` | ✅ | ✅ | — | — | ✅ | ✅ | — |
| `text` | ✅ | ✅ | — | — | — | — | ✅ |
| `highlight` | ✅ | ✅ | ✅ | ✅ | — | — | — |

### 座標バリデーション規則

アノテーション保存時に以下をチェック:

1. `x`, `y` ≥ 0（画像の左上が原点）
2. `x + width` ≤ `capture.viewport_width`（rect/highlight）
3. `y + height` ≤ `capture.viewport_height`（rect/highlight）
4. `x2`, `y2` ≥ 0（arrow）
5. 座標が画像範囲外の場合: バリデーションエラー（FR対応）

---

## ストレージファイルスキーマ

### `.wsc/config.json`

```typescript
const ConfigSchema = z.object({
  version: z.literal(1),
  author: z.string().optional(),
  storage_backend: z.enum(['filesystem']).default('filesystem'),
  capture: z.object({
    timeout_ms: z.number().int().positive().default(30000),
    retries: z.number().int().nonnegative().default(3),
    viewport_width: z.number().int().positive().default(1280),
    viewport_height: z.number().int().positive().default(720),
    full_page: z.boolean().default(true),
    concurrency: z.number().int().min(1).max(20).default(5),
  }).default({}),
});
```

### ストレージファイル一覧

| ファイル | 内容 | スキーマ |
|---------|------|---------|
| `.wsc/config.json` | プロジェクト設定 | `ConfigSchema` |
| `.wsc/captures.json` | キャプチャメタデータ配列 | `CapturesFileSchema` |
| `.wsc/comments.json` | コメントデータ配列 | `CommentsFileSchema` |
| `.wsc/annotations.json` | アノテーションデータ配列 | `AnnotationsFileSchema` |
| `.wsc/images/<id>.png` | キャプチャ画像 | バイナリ PNG |

---

## エンティティ関係図

```
┌─────────────────────────────────────┐
│ Capture                             │
│  id (PK)                            │
│  url                                │
│  captured_at                        │
│  label                              │
│  image_path                         │
│  status                             │
│  error                              │
│  viewport_width, viewport_height    │
│  full_page                          │
└────────────┬────────────────────────┘
             │ 1
             │
     ┌───────┴────────┐
     │ *              │ *
┌────▼───────┐   ┌────▼──────────┐
│ Comment    │   │ Annotation    │
│  id (PK)   │   │  id (PK)      │
│  capture_id│   │  capture_id   │
│  parent_id │◄─┐│  type         │
│  author    │  ││  x, y         │
│  message   │  ││  width/height │
│  created_at│  ││  x2/y2        │
└────────────┘  ││  color, label │
                ││  author       │
                ││  created_at   │
                │└───────────────┘
                │ (自己参照: 返信スレッド)
                └─ parent_id → id
```
