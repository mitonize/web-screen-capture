# 実装計画: web-screen-capture

**ブランチ**: `001-web-screen-capture` | **日付**: 2026-05-20 | **仕様**: `.specify/memory/spec.md`

**入力**: `.specify/memory/spec.md` の機能仕様書

---

## サマリー

チームがウェブページのスクリーンショットをバッチキャプチャし、コメント・アノテーションを付加して共有するためのCLIツール `wsc` を実装する。

**技術的アプローチ**: TypeScript/Node.js で実装し、Playwright によるヘッドレスブラウザキャプチャ、Commander.js による CLI 構築、フラットJSONファイル+ローカルPNGによるストレージを採用する。ストレージはインターフェースで抽象化し、将来の SQLite 等へのバックエンド交換を可能にする。

---

## 技術コンテキスト

**言語/バージョン**: TypeScript 5.x / Node.js 20 LTS

**推奨言語の根拠**:

| 観点 | TypeScript/Node.js ✅ | Python | Go |
|------|----------------------|--------|----|
| Playwright サポート | ネイティブ（同一エコシステム） | 公式サポートあり | chromedp（機能差あり） |
| CLI フレームワーク | Commander.js（成熟・型安全） | Click/Typer | Cobra |
| 型安全な JSON 操作 | Zod スキーマバリデーション | Pydantic | 構造体で手動 |
| npm 配布 | `npm install -g` / `npx` で即使用可 | pip install（環境依存あり） | バイナリ配布が必要 |
| クロスプラットフォーム | ✅ Node.js が解決 | ✅ | ✅（バイナリ必要） |

**結論**: Playwright は TypeScript/Node.js で書かれており、同一エコシステムでの開発が最も安定。npm によるチーム配布がシンプルで、型安全な JSON 操作ライブラリも充実している。

**主要依存関係**:

| パッケージ | 用途 | 採用理由 |
|-----------|------|---------|
| `playwright` | ヘッドレスブラウザキャプチャ | 業界標準、クロスブラウザ、JS描画対応 |
| `commander` | CLI フレームワーク | 最も普及、TypeScript ネイティブ型付き |
| `zod` | JSON スキーマバリデーション | ランタイム型安全、スキーマ定義から型生成 |
| `uuid` | ID 生成 | 標準的な UUID v4 生成 |
| `vitest` (dev) | テストフレームワーク | TypeScript ネイティブ、高速 |
| `tsx` (dev) | TypeScript 実行 | 開発時の直接実行 |

**ストレージ**: フラットJSONファイル + ローカルPNG（`.wsc/` ディレクトリ）

**テスト**: Vitest（ユニット + インテグレーション）、Playwright fixtures によるキャプチャモック

**ターゲットプラットフォーム**: macOS / Linux / Windows（Node.js 20 LTS 以上）

**プロジェクト種別**: CLI ツール（npm パッケージとして配布）

**パフォーマンス目標**:
- 10件URLバッチキャプチャを3分以内に完了（SC-001）
- 並列キャプチャ（デフォルト並列数: 5）

**制約**:
- ストレージはインターフェース抽象化必須（FR-019）
- アノテーション合成エクスポートは v1 スコープ外
- PNG 形式のみ（v1）

**スケール/スコープ**:
- URLリストファイル: 数千件まで対応（ストリーミング読み込み）
- データは `.wsc/` 以下のフラットJSONで管理（数百件のキャプチャを想定）

---

## 憲章チェック (Constitution Check)

*GATE: Phase 0 リサーチ前に必須確認。Phase 1 設計後に再確認。*

### 初回チェック (Phase 0 前)

| 原則 | 状態 | 根拠 |
|------|------|------|
| **I. CLI-First** | ✅ PASS | すべての操作は `wsc` CLIコマンドで完結。`--json` フラグを全データ出力コマンドに提供。エラーは stderr、正常出力は stdout。終了コードは 0/非ゼロで正確に反映。 |
| **II. バッチキャプチャ** | ✅ PASS | `wsc capture <url>...` で複数URL受付。個別失敗でも処理継続。URLごとの成否をレポート。部分成功は有効な結果として扱う。 |
| **III. チームコラボレーション** | ✅ PASS | コメントは author + ISO 8601 タイムスタンプ必須。スレッドリプライ対応（`parent_id` フィールド）。構造化JSON保存。 |
| **IV. 画像アノテーション** | ✅ PASS | rect/arrow/text/highlight の4種類に対応。座標・スタイル・内容を構造化データで保存。ベース画像のピクセルは変更しない。 |
| **V. データポータビリティ** | ✅ PASS | ストレージは `StorageBackend` インターフェースで抽象化。`wsc export` でJSON+PNG エクスポート。プロプライエタリバイナリ形式は使用しない。 |
| **VI. シンプルさ・信頼性** | ✅ PASS | YAGNI 適用。各依存関係は上記テーブルで正当化済み。エラーメッセージはアクション可能な形式で統一。ネットワーク操作にリトライ戦略を実装。 |

**Gate Result: PASS** — Phase 0 リサーチへ進む。

---

## プロジェクト構造

### ドキュメント (この機能)

```text
specs/001-web-screen-capture/
├── plan.md              # このファイル (/speckit.plan 出力)
├── research.md          # Phase 0 出力
├── data-model.md        # Phase 1 出力
├── quickstart.md        # Phase 1 出力
├── contracts/           # Phase 1 出力
│   └── cli-commands.md
└── tasks.md             # Phase 2 出力 (/speckit.tasks コマンド)
```

### ソースコード (リポジトリルート)

```text
src/
├── cli/
│   ├── index.ts              # エントリーポイント・Commanderルート登録
│   ├── commands/
│   │   ├── capture.ts        # wsc capture
│   │   ├── list.ts           # wsc list
│   │   ├── show.ts           # wsc show
│   │   ├── comment.ts        # wsc comment {add,reply,list}
│   │   ├── annotation.ts     # wsc annotation {add,list,delete}
│   │   └── export.ts         # wsc export
│   └── output.ts             # 人間可読 / JSON 出力フォーマッター
├── core/
│   ├── browser.ts            # Playwright ラッパー（キャプチャ処理）
│   ├── capture-service.ts    # バッチキャプチャ・リトライ戦略
│   ├── author-resolver.ts    # 著者識別子の優先順位解決
│   └── config.ts             # 設定ファイル・環境変数読み込み
├── storage/
│   ├── interface.ts          # StorageBackend 抽象インターフェース
│   ├── filesystem.ts         # フラットJSON+PNG 実装
│   └── index.ts              # バックエンド選択・ファクトリー
└── models/
    ├── capture.ts             # Capture 型定義 + Zod スキーマ
    ├── comment.ts             # Comment 型定義 + Zod スキーマ
    └── annotation.ts          # Annotation 型定義 + Zod スキーマ

tests/
├── unit/
│   ├── author-resolver.test.ts
│   ├── capture-service.test.ts
│   └── models/
├── integration/
│   ├── capture.test.ts        # Playwright モック使用
│   ├── comment.test.ts
│   ├── annotation.test.ts
│   └── export.test.ts
└── fixtures/
    ├── sample-captures.json
    └── mock-screenshot.png

package.json
tsconfig.json
vitest.config.ts
```

**構造決定**: シングルプロジェクト（Option 1）。CLI ツールとして完結しており、フロントエンド/バックエンド分離は不要。`src/storage/interface.ts` でストレージ抽象化を実現し、将来の SQLite バックエンド追加を容易にする。

---

## Phase 0: リサーチ成果

### 1. ヘッドレスブラウザオプションの評価

| 選択肢 | 評価 | 結論 |
|--------|------|------|
| **Playwright** | クロスブラウザ対応、Node.js ネイティブ、スクリーンショット API が直感的、CI 対応が優秀 | **採用** ✅ |
| Puppeteer | Chromium のみ（v21以降は Firefox 対応）、Google 管理 | 非採用（Playwright が上位互換） |
| chromedp (Go) | Go 専用、CDP 直接操作が複雑 | 非採用（言語を Go にした場合の候補） |
| Selenium | 古いアーキテクチャ、遅い、設定が複雑 | 非採用 |

**Playwright 採用決定**:
- `browser.newPage()` → `page.screenshot({ path, fullPage })` の直感的 API
- `page.waitForLoadState('networkidle')` で JS レンダリング完了を待機
- タイムアウト設定が柔軟（`page.setDefaultTimeout(ms)`）
- CI 環境での `--browser chromium` 指定が容易

### 2. CLI フレームワーク比較

| フレームワーク | 採用 | 理由 |
|--------------|------|------|
| **Commander.js** | ✅ 採用 | 最も普及（週1億DL超）、TypeScript 型付き、サブコマンド対応、テスト容易 |
| Yargs | 非採用 | 機能は同等だが、Commander の型安全性が優れる |
| oclif | 非採用 | プラグインベースで大規模向け、本ツールには過剰 |
| Meow | 非採用 | ESM のみ、サブコマンド対応が弱い |

### 3. JSON ストレージパターン

**フラットJSONファイル選定理由**:
- `.wsc/captures.json`、`.wsc/comments.json`、`.wsc/annotations.json` の3ファイル構成
- データ量が数百件規模では十分なパフォーマンス
- 人間がテキストエディタで直接確認・修正可能（デバッグ・移行が容易）
- エクスポート処理がそのままファイルコピーで完結
- ストレージインターフェース経由でアクセスするため、将来の SQLite 移行時も CLI 変更不要

**アトミック書き込みパターン**:
```
1. 現在の JSON を読み込む
2. メモリ上で変更を適用
3. 一時ファイルに書き込む (.tmp 拡張子)
4. 一時ファイルをターゲットにリネーム (atomic rename)
```
→ 書き込み中のクラッシュでデータ破損を防ぐ

### 4. リトライ戦略

- デフォルト: 最大3回、指数バックオフ（1s → 2s → 4s）
- 設定可能: `--retries <n>` CLI フラグ、設定ファイルの `retries` キー
- リトライ対象: ネットワークエラー、タイムアウト（`TimeoutError`）
- リトライしない: 404 等の確定的エラー

### 5. 著者識別子の解決順序

仕様書の決定事項（OQ-2）を確認:
```
優先度（高→低）: --author CLI フラグ > WSC_AUTHOR 環境変数 > config ファイル (.wsc/config.json)
```
※ 憲章 V 原則「CLI フラグは設定ファイル値より優先」に準拠。

`--author` 未指定かつ設定なしの場合: エラーを返し、設定方法を案内する（匿名投稿は不可とし、コラボレーションの文脈保存を保証）。

### 6. エクスポート形式

ベストプラクティス調査結果:
- エクスポート出力: `export/captures.json` + `export/images/<id>.png`
- 画像パスは相対パスで記録（エクスポート先ディレクトリから相対）
- `captures.json` にコメント・アノテーションを埋め込む構造（自己完結型）

---

## Phase 1: 設計

### データモデル

#### Capture エンティティ

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "https://example.com",
  "captured_at": "2026-05-20T10:30:00.000Z",
  "label": "トップページ確認",
  "image_path": "images/550e8400-e29b-41d4-a716-446655440000.png",
  "status": "success",
  "error": null,
  "viewport_width": 1280,
  "viewport_height": 720,
  "full_page": true
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | string (UUID v4) | ✅ | 一意識別子 |
| `url` | string (URL) | ✅ | キャプチャ対象URL |
| `captured_at` | string (ISO 8601) | ✅ | キャプチャ実行日時 |
| `label` | string \| null | — | 任意ラベル/タイトル |
| `image_path` | string | ✅ | `.wsc/` からの相対パス |
| `status` | `"success"` \| `"failure"` | ✅ | キャプチャ結果 |
| `error` | string \| null | — | 失敗時のエラーメッセージ |
| `viewport_width` | number | ✅ | キャプチャ時のビューポート幅(px) |
| `viewport_height` | number | ✅ | キャプチャ時のビューポート高さ(px) |
| `full_page` | boolean | ✅ | フルページキャプチャフラグ |

#### Comment エンティティ

```json
{
  "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "capture_id": "550e8400-e29b-41d4-a716-446655440000",
  "parent_id": null,
  "author": "alice",
  "message": "ヘッダーの配色が問題",
  "created_at": "2026-05-20T11:00:00.000Z"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | string (UUID v4) | ✅ | 一意識別子 |
| `capture_id` | string (UUID v4) | ✅ | 対象キャプチャID |
| `parent_id` | string \| null | — | 返信先コメントID（null = ルートコメント） |
| `author` | string | ✅ | 投稿者識別子 |
| `message` | string | ✅ | コメント本文 |
| `created_at` | string (ISO 8601) | ✅ | 投稿日時 |

#### Annotation エンティティ

```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "capture_id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "rect",
  "x": 100,
  "y": 200,
  "width": 300,
  "height": 150,
  "color": "red",
  "label": "修正箇所",
  "author": "alice",
  "created_at": "2026-05-20T11:05:00.000Z"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | string (UUID v4) | ✅ | 一意識別子 |
| `capture_id` | string (UUID v4) | ✅ | 対象キャプチャID |
| `type` | `"rect"` \| `"arrow"` \| `"text"` \| `"highlight"` | ✅ | アノテーション種別 |
| `x` | number | ✅ | 始点X座標(px) |
| `y` | number | ✅ | 始点Y座標(px) |
| `width` | number \| null | — | 幅(px)。rect/highlight で使用 |
| `height` | number \| null | — | 高さ(px)。rect/highlight で使用 |
| `x2` | number \| null | — | 終点X座標(px)。arrow で使用 |
| `y2` | number \| null | — | 終点Y座標(px)。arrow で使用 |
| `color` | string \| null | — | 色指定（CSS 色名 or 16進数） |
| `label` | string \| null | — | テキストラベル内容 |
| `author` | string | ✅ | 作成者識別子 |
| `created_at` | string (ISO 8601) | ✅ | 作成日時 |

---

### ストレージレイアウト

```text
.wsc/
├── config.json          # プロジェクト設定
├── captures.json        # キャプチャメタデータ配列
├── comments.json        # コメントデータ配列
├── annotations.json     # アノテーションデータ配列
└── images/
    ├── 550e8400-e29b-41d4-a716-446655440000.png
    └── ...
```

**`config.json` スキーマ**:
```json
{
  "version": 1,
  "author": "alice",
  "storage_backend": "filesystem",
  "capture": {
    "timeout_ms": 30000,
    "retries": 3,
    "viewport_width": 1280,
    "viewport_height": 720,
    "full_page": true,
    "concurrency": 5
  }
}
```

**`captures.json` スキーマ**:
```json
{
  "version": 1,
  "captures": [ /* Capture[] */ ]
}
```

**`comments.json` スキーマ**:
```json
{
  "version": 1,
  "comments": [ /* Comment[] */ ]
}
```

**`annotations.json` スキーマ**:
```json
{
  "version": 1,
  "annotations": [ /* Annotation[] */ ]
}
```

---

### CLI コマンド API コントラクト

#### `wsc capture`

```
wsc capture <url> [<url>...] [options]

引数:
  <url>...              キャプチャ対象URL（1件以上、スペース区切りで複数指定可）

オプション:
  --url-file <file>     URLリストファイル（1行1URL）
  --label <label>       全URLに適用するラベル
  --timeout <ms>        ページロードタイムアウト（ミリ秒）[デフォルト: 30000]
  --retries <n>         リトライ回数 [デフォルト: 3]
  --author <name>       著者識別子（設定ファイル・環境変数より優先）
  --json                JSON形式で出力

終了コード:
  0   全URL成功
  1   1件以上失敗（部分成功含む）
  2   引数エラー・設定エラー

JSON出力例:
{
  "results": [
    {
      "url": "https://example.com",
      "status": "success",
      "capture_id": "550e8400-...",
      "image_path": ".wsc/images/550e8400-....png",
      "captured_at": "2026-05-20T10:30:00.000Z"
    },
    {
      "url": "https://unreachable.example",
      "status": "failure",
      "error": "TimeoutError: page load timed out after 30000ms. Try increasing --timeout."
    }
  ],
  "total": 2,
  "succeeded": 1,
  "failed": 1
}
```

#### `wsc list`

```
wsc list [options]

オプション:
  --json    JSON形式で出力

終了コード: 0（キャプチャが0件でも成功）
```

#### `wsc show`

```
wsc show <capture-id> [options]

引数:
  <capture-id>    キャプチャID

オプション:
  --json    JSON形式で出力

終了コード:
  0   成功
  1   指定IDが存在しない
```

#### `wsc comment add`

```
wsc comment add <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --message <text>    コメント本文（必須）
  --author <name>     著者識別子
  --json              JSON形式で出力

終了コード:
  0   成功
  1   capture-id が存在しない、または --message 未指定
```

#### `wsc comment reply`

```
wsc comment reply <comment-id> [options]

引数:
  <comment-id>    返信先コメントID

オプション:
  --message <text>    返信本文（必須）
  --author <name>     著者識別子
  --json              JSON形式で出力
```

#### `wsc comment list`

```
wsc comment list <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --json    JSON形式で出力

JSON出力例:
[
  {
    "id": "7c9e6679-...",
    "author": "alice",
    "message": "ヘッダーの配色が問題",
    "created_at": "2026-05-20T11:00:00.000Z",
    "replies": [
      {
        "id": "a1b2c3d4-...",
        "author": "bob",
        "message": "同意します",
        "created_at": "2026-05-20T11:05:00.000Z",
        "replies": []
      }
    ]
  }
]
```

#### `wsc annotation add`

```
wsc annotation add <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --type <type>      アノテーション種別: rect | arrow | text | highlight（必須）
  --x <px>           始点X座標（必須）
  --y <px>           始点Y座標（必須）
  --width <px>       幅（rect/highlight で必須）
  --height <px>      高さ（rect/highlight で必須）
  --x2 <px>          終点X座標（arrow で必須）
  --y2 <px>          終点Y座標（arrow で必須）
  --color <color>    色（CSS色名 or 16進数）
  --label <text>     テキストラベル（text タイプで必須）
  --author <name>    著者識別子
  --json             JSON形式で出力

終了コード:
  0   成功
  1   capture-id が存在しない、必須パラメータ不足、座標が画像範囲外
```

#### `wsc annotation list`

```
wsc annotation list <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --json    JSON形式で出力
```

#### `wsc annotation delete`

```
wsc annotation delete <annotation-id>

引数:
  <annotation-id>    削除対象アノテーションID

終了コード:
  0   成功（元の画像ファイルは変更なし）
  1   annotation-id が存在しない
```

#### `wsc export`

```
wsc export [options]

オプション:
  --output <dir>    出力ディレクトリ（デフォルト: ./wsc-export-<timestamp>）
  --json            エクスポート結果をJSON形式で出力

出力構造:
  <output>/
  ├── export.json           # 全データ統合（captures + comments + annotations + 相対画像パス）
  └── images/
      └── <capture-id>.png

終了コード:
  0   成功（データ0件でも成功）
  1   出力ディレクトリへの書き込み失敗
```

---

### ストレージ抽象インターフェース

```typescript
// src/storage/interface.ts

export interface StorageBackend {
  // 初期化
  initialize(): Promise<void>;
  
  // Capture
  saveCapture(capture: Capture): Promise<void>;
  getCapture(id: string): Promise<Capture | null>;
  listCaptures(): Promise<Capture[]>;
  saveImage(captureId: string, imageBuffer: Buffer): Promise<string>; // returns path

  // Comment
  saveComment(comment: Comment): Promise<void>;
  getComment(id: string): Promise<Comment | null>;
  listComments(captureId: string): Promise<Comment[]>;

  // Annotation
  saveAnnotation(annotation: Annotation): Promise<void>;
  getAnnotation(id: string): Promise<Annotation | null>;
  listAnnotations(captureId: string): Promise<Annotation[]>;
  deleteAnnotation(id: string): Promise<boolean>;

  // Export
  exportAll(outputDir: string): Promise<ExportResult>;
}
```

---

### 著者識別子解決ロジック

```typescript
// src/core/author-resolver.ts
// 優先順位（高→低）: CLIオプション > 環境変数 > 設定ファイル > エラー

export function resolveAuthor(
  cliOption?: string,
  config?: Config
): string {
  if (cliOption) return cliOption;
  if (process.env.WSC_AUTHOR) return process.env.WSC_AUTHOR;
  if (config?.author) return config.author;
  throw new AuthorNotConfiguredError(
    "著者識別子が設定されていません。\n" +
    "対処方法: --author オプション、WSC_AUTHOR 環境変数、" +
    "または .wsc/config.json の author キーで設定してください。"
  );
}
```

---

## 憲章チェック (Phase 1 後 再確認)

| 原則 | 状態 | 設計での対応 |
|------|------|-------------|
| **I. CLI-First** | ✅ PASS | 全コマンドに `--json` フラグ。エラーは stderr 出力。終了コードは 0/1/2 で定義済み。`output.ts` で人間可読/JSON を統一管理。 |
| **II. バッチキャプチャ** | ✅ PASS | `capture-service.ts` が並列処理（concurrency 設定可）。個別失敗は results 配列に記録し処理継続。部分成功は exit code 1 で返す。 |
| **III. チームコラボレーション** | ✅ PASS | Comment に `author`・`created_at` 必須フィールド。`parent_id` でスレッド構造。`comment list` の JSON 出力は `replies` ネスト形式。 |
| **IV. 画像アノテーション** | ✅ PASS | 4種類対応。`annotations.json` で構造化保存。`annotation delete` は画像ファイル無変更。座標バリデーション（画像サイズ範囲チェック）実装予定。 |
| **V. データポータビリティ** | ✅ PASS | `StorageBackend` インターフェースで抽象化完了。`wsc export` で JSON + PNG エクスポート。`export.json` は自己完結型（ストレージ参照不要）。 |
| **VI. シンプルさ・信頼性** | ✅ PASS | 依存関係は6パッケージのみ（全て正当化済み）。エラーメッセージはアクション可能な形式（`AuthorNotConfiguredError` の例参照）。リトライ戦略は `capture-service.ts` に実装。 |

**Gate Result: PASS** — Phase 1 設計完了。tasks.md 生成へ進む。

---

## 複雑性トラッキング (Complexity Tracking)

> 憲章違反が存在する場合のみ記入

| 違反 | 必要な理由 | よりシンプルな代替を却下した理由 |
|------|-----------|-------------------------------|
| （なし） | — | — |

---

*このファイルは `/speckit.plan` コマンドによって生成されました。*
*タスク一覧は `/speckit.tasks` コマンドで `specs/001-web-screen-capture/tasks.md` に生成されます。*
