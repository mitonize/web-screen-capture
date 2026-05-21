# タスク: web-screen-capture

**入力**: `specs/001-web-screen-capture/` の設計ドキュメント群

**前提条件**: plan.md ✅、spec.md ✅、data-model.md ✅、contracts/cli-commands.md ✅

**テスト**: 各ユーザーストーリーにテストタスクを含む（仕様で要求）

**構成**: タスクはユーザーストーリーごとにグループ化し、各ストーリーを独立して実装・テスト可能にする

## 形式: `[ID] [P?] [Story?] 説明`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: 対応するユーザーストーリー（例: US1, US2, US3）
- 各タスクには具体的なファイルパスを記載

---

## フェーズ 1: セットアップ（プロジェクト初期化）

**目的**: プロジェクトの骨格、依存関係、設定ファイルの初期化

- [x] T001 `package.json` を作成する（`name: "wsc"`, `bin: {"wsc": "./dist/cli/index.js"}`, dependencies: `playwright`, `commander`, `zod`, `uuid`; devDependencies: `typescript`, `vitest`, `tsx`, `@types/node`, `@types/uuid`）
- [x] T002 `tsconfig.json` を作成する（`target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `strict: true`, `outDir: "./dist"`, `rootDir: "./src"`）
- [x] T003 [P] `vitest.config.ts` を作成する（テスト環境: `node`, カバレッジ設定, `include: ["tests/**/*.test.ts"]`）
- [x] T004 [P] `.gitignore` を作成する（`node_modules/`, `dist/`, `.wsc/`, `*.js.map` を除外）
- [x] T005 [P] `tests/fixtures/` ディレクトリを作成し、`tests/fixtures/sample-captures.json`（テスト用キャプチャデータ）と `tests/fixtures/mock-screenshot.png`（1x1pxダミーPNG）を配置する
- [x] T006 `src/` 配下のディレクトリ構造を作成する（`src/cli/commands/`, `src/core/`, `src/storage/`, `src/models/` の空ディレクトリと `.gitkeep` を配置）

---

## フェーズ 2: 基盤（全ユーザーストーリーの前提条件）

**目的**: すべてのユーザーストーリーが依存するコアインフラを実装する

**⚠️ 重要**: このフェーズが完了するまでユーザーストーリーの実装を開始してはならない

- [x] T007 [P] `src/models/capture.ts` を作成する（`CaptureSchema`・`CapturesFileSchema` Zod スキーマ、`Capture` 型エクスポート、UUID v4 形式・ISO 8601 datetime バリデーション含む）
- [x] T008 [P] `src/models/comment.ts` を作成する（`CommentSchema`・`CommentsFileSchema` Zod スキーマ、`Comment`・`CommentThread` 型エクスポート、`parent_id` による自己参照スレッド構造）
- [x] T009 [P] `src/models/annotation.ts` を作成する（`RectAnnotationSchema`・`ArrowAnnotationSchema`・`TextAnnotationSchema`・`HighlightAnnotationSchema` を `discriminatedUnion` で合成した `AnnotationSchema`、`AnnotationsFileSchema`、`Annotation` 型エクスポート）
- [x] T010 `src/storage/interface.ts` を作成する（`StorageBackend` 抽象インターフェース: `saveCapture`, `listCaptures`, `findCapture`, `saveComment`, `listComments`, `findComment`, `saveAnnotation`, `listAnnotations`, `findAnnotation`, `deleteAnnotation`, `saveImage`, `readImage`, `init` メソッドを型定義）
- [x] T011 `src/storage/filesystem.ts` を作成する（`StorageBackend` を実装するクラス: `.wsc/` ディレクトリ管理, アトミック書き込み（tmp → rename）, `captures.json`・`comments.json`・`annotations.json` の読み書き, `images/<id>.png` の保存・読み込み）
- [x] T012 `src/storage/index.ts` を作成する（ストレージファクトリー: `config.storage_backend` に応じて `FilesystemStorage` を選択して返すファクトリー関数 `createStorage(config)` を実装）
- [x] T013 `src/core/config.ts` を作成する（`ConfigSchema` Zod スキーマ定義、`.wsc/config.json` の読み込み・パース・デフォルト値適用、`loadConfig()` 関数をエクスポート）
- [x] T014 `src/core/author-resolver.ts` を作成する（著者識別子の優先順位解決: `--author` CLI フラグ > `WSC_AUTHOR` 環境変数 > `.wsc/config.json` の `author` 値、未設定時はエラーメッセージと設定方法を返す `resolveAuthor(cliValue?: string, config?: Config): string` 関数）
- [x] T015 [P] `tests/unit/author-resolver.test.ts` を作成する（`resolveAuthor` のユニットテスト: CLI フラグ優先・環境変数フォールバック・設定ファイルフォールバック・未設定時エラーの各ケース）
- [x] T016 `src/cli/output.ts` を作成する（人間可読出力とJSON出力の共通フォーマッター: `printSuccess()`, `printError()`, `printJson()`, テーブル形式フォーマット `formatTable()` を実装。エラーは `stderr`、正常出力は `stdout` に出力）
- [x] T017 `src/cli/index.ts` を作成する（Commander.js エントリーポイント: プログラム定義 `wsc`, バージョン設定, 各サブコマンドモジュールのインポート・登録, 未知コマンド時のエラーハンドリング, `bin` スクリプトとしての shebang `#!/usr/bin/env node`）

**チェックポイント**: 基盤完成 — 各ユーザーストーリーの実装を開始できる

---

## フェーズ 3: ユーザーストーリー 1 — バッチURLキャプチャ（優先度: P1）🎯 MVP

**目標**: `wsc capture <url...> [--url-file <file>] [--label] [--timeout] [--retries] [--json]` コマンドを実装し、バッチキャプチャ・リトライ・部分失敗継続・JSON出力を提供する

**独立テスト**: `wsc capture https://example.com https://example.org` を実行し、`.wsc/images/` に PNG ファイルが生成され、成否レポートが出力されることを確認する

### テスト（US1）

> **注意: テストを先に記述し、実装前に FAIL することを確認すること**

- [x] T018 [P] [US1] `tests/unit/capture-service.test.ts` を作成する（`CaptureService` のユニットテスト: 並列バッチ処理・リトライロジック（指数バックオフ）・部分失敗継続・タイムアウト処理・URL ファイル読み込みのモックテスト）
- [x] T019 [P] [US1] `tests/integration/capture.test.ts` を作成する（インテグレーションテスト: Playwright をモックした実際のファイルシステムへの書き込み検証、`--url-file` オプション、`--json` 出力スキーマ検証、部分失敗時の終了コード 1 の確認）

### 実装（US1）

- [x] T020 [US1] `src/core/browser.ts` を作成する（Playwright ラッパー: `launchBrowser()`, `captureScreenshot(url, options): Promise<Buffer>` 関数を実装。`waitForLoadState('networkidle')`, `page.screenshot({ fullPage: true })`, タイムアウト設定、ブラウザリソースの適切なクリーンアップ）
- [x] T021 [US1] `src/core/capture-service.ts` を作成する（バッチキャプチャサービス: `CaptureService` クラス実装。`captureAll(urls, options)` で `p-limit` または自前の並列制御（デフォルト concurrency: 5）、指数バックオフリトライ（1s→2s→4s, デフォルト3回）、各 URL の成否追跡、`StorageBackend` への保存）
- [x] T022 [US1] `src/cli/commands/capture.ts` を作成する（`wsc capture` コマンド定義: Commander.js コマンド登録, `<url...>` 引数, `--url-file`, `--label`, `--timeout`, `--retries`, `--author`, `--json` オプション, `CaptureService` の呼び出し, 人間可読出力（✓/✗ per URL + サマリー）と JSON 出力の切り替え, 終了コード 0/1/2 の適切な設定）

**チェックポイント**: この時点で `wsc capture` が完全に機能し、単独でテスト可能であること

---

## フェーズ 4: ユーザーストーリー 2 — キャプチャ閲覧・一覧表示（優先度: P2）

**目標**: `wsc list [--json]` と `wsc show <id> [--json]` コマンドを実装し、保存済みキャプチャの一覧・詳細表示を提供する

**独立テスト**: キャプチャが保存された状態で `wsc list` を実行し、ID・URL・日時・ラベルの一覧が表示されることを確認する。`wsc show <id>` で詳細情報（コメント数・アノテーション数含む）が表示されることを確認する

### テスト（US2）

- [x] T023 [P] [US2] `tests/integration/list-show.test.ts` を作成する（インテグレーションテスト: `list` コマンドのテーブル出力・JSON 出力スキーマ検証, `list` 0件時のメッセージ確認, `show` の詳細出力・JSON 出力スキーマ検証, 存在しない ID 指定時の終了コード 1 確認）

### 実装（US2）

- [x] T024 [P] [US2] `src/cli/commands/list.ts` を作成する（`wsc list` コマンド定義: `--json` オプション, `storage.listCaptures()` 呼び出し, テーブル形式（ID / URL / 日時 / ラベル）の人間可読出力, 0件時の案内メッセージ, JSON 出力スキーマ準拠（`captures[]` + `total`）, 各キャプチャの `comment_count` と `annotation_count` を集計）
- [x] T025 [P] [US2] `src/cli/commands/show.ts` を作成する（`wsc show` コマンド定義: `<capture-id>` 引数, `--json` オプション, `storage.findCapture(id)` 呼び出し, ID 不存在時 stderr エラーメッセージ + 終了コード 1, 詳細情報（URL・日時・ラベル・画像パス・ビューポート・コメント数・アノテーション数）の人間可読出力, JSON 出力スキーマ準拠）

**チェックポイント**: この時点で US1（キャプチャ）と US2（閲覧）が両方独立して機能すること

---

## フェーズ 5: ユーザーストーリー 3 — テキストコメント追加（優先度: P3）

**目標**: `wsc comment add`・`wsc comment reply`・`wsc comment list` コマンドを実装し、スレッド形式のコメント機能を提供する

**独立テスト**: キャプチャ 1 件に対してコメントを追加し、返信を追加し、`comment list` でスレッドツリーが表示されることを確認する（アノテーション機能は不要）

### テスト（US3）

- [x] T026 [P] [US3] `tests/unit/models/comment.test.ts` を作成する（Comment モデルのユニットテスト: Zod スキーマバリデーション（正常系・異常系）、`CommentThread` ツリー変換ロジック、循環参照の検出）
- [x] T027 [P] [US3] `tests/integration/comment.test.ts` を作成する（インテグレーションテスト: `comment add` の保存確認・JSON 出力スキーマ検証, `comment reply` の `parent_id` 設定確認, `comment list` のスレッドツリー出力・JSON 出力スキーマ検証, 存在しない capture-id 時の終了コード 1, `--message` 未指定時の終了コード 2）

### 実装（US3）

- [x] T028 [US3] `src/cli/commands/comment.ts` を作成する（`wsc comment` サブコマンドグループ定義: `add <capture-id>` サブコマンド（`--message` 必須, `--author`, `--json`, capture-id 存在チェック, `resolveAuthor()` 呼び出し, `storage.saveComment()` 保存, JSON/人間可読出力）, `reply <comment-id>` サブコマンド（`parent_id` を返信先コメントの `capture_id` から解決）, `list <capture-id>` サブコマンド（`storage.listComments(captureId)` で取得, `CommentThread` ツリーに変換, インデント形式の人間可読出力, JSON 出力スキーマ準拠）, 終了コード 0/1/2 の適切な設定）

**チェックポイント**: この時点で US1・US2・US3 がすべて独立して機能すること

---

## フェーズ 6: ユーザーストーリー 4 — 画像アノテーション追加・閲覧（優先度: P4）

**目標**: `wsc annotation add`・`wsc annotation list`・`wsc annotation delete` コマンドを実装し、rect/arrow/text/highlight の 4 種類のアノテーション管理を提供する

**独立テスト**: キャプチャ 1 件に対して rect アノテーションを追加し、`annotation list` で一覧が表示され、`annotation delete` で削除後に元の画像が変更されていないことを確認する

### テスト（US4）

- [x] T029 [P] [US4] `tests/unit/models/annotation.test.ts` を作成する（Annotation モデルのユニットテスト: `discriminatedUnion` の各タイプ（rect/arrow/text/highlight）のスキーマバリデーション（正常系・異常系）, `text` タイプで `label` が必須であることの確認, 座標バリデーション（x/y ≥ 0, width/height > 0））
- [x] T030 [P] [US4] `tests/integration/annotation.test.ts` を作成する（インテグレーションテスト: `annotation add` の 4 種類タイプ保存確認・JSON 出力スキーマ検証, 座標範囲外バリデーションエラー確認（終了コード 1, stderr エラーメッセージ）, `annotation list` の一覧出力・JSON 出力スキーマ検証, `annotation delete` の削除後確認・画像ファイル変更なしの確認, 存在しない annotation-id 時の終了コード 1）

### 実装（US4）

- [x] T031 [US4] `src/cli/commands/annotation.ts` を作成する（`wsc annotation` サブコマンドグループ定義: `add <capture-id>` サブコマンド（`--type` 必須, `--x`, `--y`, `--width`, `--height`, `--x2`, `--y2`, `--color`, `--label`, `--author`, `--json` オプション, capture-id 存在チェック, タイプ別必須フィールド検証, 座標範囲外バリデーション（`x + width ≤ viewport_width` 等）, エラーメッセージに対処方法を含める）, `list <capture-id>` サブコマンド（テーブル形式の人間可読出力, JSON 出力スキーマ準拠）, `delete <annotation-id>` サブコマンド（削除確認メッセージ「画像ファイルは変更されていません」）, 終了コード 0/1/2 の適切な設定）

**チェックポイント**: この時点で US1〜US4 がすべて独立して機能すること

---

## フェーズ 7: ユーザーストーリー 5 — データエクスポート（優先度: P5）

**目標**: `wsc export [--output <dir>] [--json]` コマンドを実装し、全データ（キャプチャ・コメント・アノテーション・画像）を自己完結型 JSON + PNG として出力する

**独立テスト**: データが存在する状態で `wsc export --output ./test-export` を実行し、`./test-export/export.json` にすべてのキャプチャ・コメント・アノテーションが含まれ、`./test-export/images/` に PNG ファイルが存在することを確認する

### テスト（US5）

- [x] T032 [P] [US5] `tests/integration/export.test.ts` を作成する（インテグレーションテスト: `export` コマンドの出力ディレクトリ構造確認（`export.json` + `images/` サブディレクトリ）, `export.json` スキーマ検証（captures + 埋め込みコメント・アノテーション）, 画像パスが相対パスであることの確認, データ 0 件時でもエラーなく完了することの確認, `--json` フラグ時の出力スキーマ検証, デフォルト出力ディレクトリ名（`wsc-export-<ISO8601タイムスタンプ>`）の確認）

### 実装（US5）

- [x] T033 [US5] `src/cli/commands/export.ts` を作成する（`wsc export` コマンド定義: `--output <dir>` オプション（デフォルト: `./wsc-export-<ISO8601タイムスタンプ>`）, `--json` オプション, `storage.listCaptures()` で全キャプチャ取得, 各キャプチャに対して `storage.listComments(id)` と `storage.listAnnotations(id)` を取得して埋め込み, `storage.readImage(id)` で PNG を `<output>/images/<id>.png` にコピー, `export.json` 生成（`exported_at`, `version: 1`, 画像パスは相対パス `images/<id>.png`）, 書き込み失敗時の終了コード 1, 完了メッセージ（件数サマリー）と `--json` 出力）

**チェックポイント**: この時点で全ユーザーストーリー（US1〜US5）が独立して機能すること

---

## フェーズ 8: ポリッシュ & 横断的懸念事項

**目的**: 全ストーリーに影響する品質改善・ドキュメント整備

- [x] T034 [P] `tests/unit/models/capture.test.ts` を作成する（Capture モデルのユニットテスト: Zod スキーマバリデーション正常系・異常系, UUID 形式チェック, status enum チェック）
- [x] T035 [P] `tests/unit/capture-service.test.ts` の補完（エッジケース追加: URL ファイルが読めない場合の終了コード 2, `--url-file` と直接 URL 指定の組み合わせ, 並列数制御の動作確認）
- [x] T036 [P] `tests/unit/storage/filesystem.test.ts` を作成する（FilesystemStorage のユニットテスト: アトミック書き込み（tmp → rename）の動作確認, JSON ファイル破損時のエラーハンドリング, `init()` による `.wsc/` ディレクトリ・空JSONファイルの初期化確認）
- [x] T037 `README.md` を作成する（インストール方法 `npm install -g wsc`, 基本的な使用例（capture / list / show / comment / annotation / export）, 設定ファイル `.wsc/config.json` の説明, 著者識別子の設定方法, トラブルシューティング）
- [x] T038 [P] `package.json` に npm スクリプトを追加する（`build: "tsc"`, `start: "node dist/cli/index.js"`, `dev: "tsx src/cli/index.ts"`, `test: "vitest run"`, `test:watch: "vitest"`, `test:coverage: "vitest run --coverage"`, `lint: "tsc --noEmit"`）
- [x] T039 ビルド後動作確認（`npm run build` 後に `node dist/cli/index.js --help` が正常動作すること、`dist/cli/index.js` の先頭に shebang があることを確認）

---

## 依存関係と実行順序

### フェーズ依存関係

- **セットアップ（フェーズ 1）**: 依存なし — 即開始可能
- **基盤（フェーズ 2）**: セットアップ完了が必要 — **全ユーザーストーリーをブロック**
- **ユーザーストーリー（フェーズ 3〜7）**: 基盤（フェーズ 2）完了後に開始可能
  - 各ストーリーは優先度順（P1 → P2 → P3 → P4 → P5）に実装する
  - リソースが許す場合は並列実装も可能
- **ポリッシュ（フェーズ 8）**: 希望するユーザーストーリーがすべて完了後に実施

### ユーザーストーリー依存関係

- **US1（P1）**: 基盤（フェーズ 2）完了後に開始 — 他ストーリーへの依存なし
- **US2（P2）**: 基盤（フェーズ 2）完了後に開始 — US1 で保存されたデータを参照するが、独立してテスト可能
- **US3（P3）**: 基盤（フェーズ 2）完了後に開始 — `capture_id` の存在確認のため US1 完了後が望ましい
- **US4（P4）**: 基盤（フェーズ 2）完了後に開始 — `capture_id` の存在確認のため US1 完了後が望ましい
- **US5（P5）**: US1〜US4 が存在することで最大価値を発揮するが、独立して実装可能

### 各ユーザーストーリー内の順序

1. テストを先に記述し、**FAIL することを確認**してから実装を開始する
2. モデル → ストレージ操作 → サービス → CLI コマンドの順に実装する
3. ストーリー完了後にチェックポイントで独立動作を検証する
4. 次の優先度ストーリーへ進む

### 並列実行の機会

- [P] マークのタスクは並列実行可能（異なるファイル、相互依存なし）
- フェーズ 2 の T007・T008・T009（各モデル定義）は並列実行可能
- フェーズ 2 の T015（unit test）は T014 完了後即座に並列実行可能
- フェーズ 3〜7 の各テストタスク同士は並列実行可能
- フェーズ 3〜7 の各 [P] 実装タスク同士は並列実行可能

---

## 並列実行例

### フェーズ 2（基盤）での並列例

```bash
# 以下のモデル定義タスクを同時実行:
タスク: "src/models/capture.ts を作成する"       # T007
タスク: "src/models/comment.ts を作成する"       # T008
タスク: "src/models/annotation.ts を作成する"    # T009
```

### フェーズ 3（US1 バッチキャプチャ）での並列例

```bash
# テストを同時作成（実装前）:
タスク: "tests/unit/capture-service.test.ts を作成する"    # T018
タスク: "tests/integration/capture.test.ts を作成する"     # T019

# テスト FAIL 確認後、実装:
タスク: "src/core/browser.ts を作成する"                   # T020（T021より先）
```

### フェーズ 4（US2）での並列例

```bash
# list と show のテスト・実装は並列実行可能:
タスク: "src/cli/commands/list.ts を作成する"    # T024
タスク: "src/cli/commands/show.ts を作成する"    # T025
```

---

## 実装戦略

### MVP ファースト（US1 のみ）

1. フェーズ 1 完了: セットアップ
2. フェーズ 2 完了: 基盤（**重要** — 全ストーリーをブロック）
3. フェーズ 3 完了: US1 バッチキャプチャ
4. **停止して検証**: `wsc capture https://example.com` が動作することを確認
5. デモ・レビュー実施

### インクリメンタル配信

1. セットアップ + 基盤完了 → 基盤レディ
2. US1 追加 → 独立テスト → デプロイ/デモ（**MVP!**）
3. US2 追加 → 独立テスト → デプロイ/デモ（キャプチャを閲覧できる）
4. US3 追加 → 独立テスト → デプロイ/デモ（コメントでコラボレーション）
5. US4 追加 → 独立テスト → デプロイ/デモ（視覚的フィードバック）
6. US5 追加 → 独立テスト → デプロイ/デモ（データポータビリティ確保）
7. 各ストーリーが前のストーリーを壊さずに価値を追加する

### 並列チーム戦略（複数開発者の場合）

1. チームでセットアップ + 基盤を完成させる
2. 基盤完了後:
   - 開発者 A: US1 バッチキャプチャ（P1）
   - 開発者 B: US2 閲覧・一覧（P2）（US1 フィクスチャを利用）
3. US1 + US2 完了後:
   - 開発者 A: US3 テキストコメント（P3）
   - 開発者 B: US4 アノテーション（P4）
4. 全完了後: US5 エクスポート + ポリッシュ

---

## 注記

- **[P]** タスク = 異なるファイルを対象とし、依存関係がない（並列実行安全）
- **[Story]** ラベルはタスクを特定のユーザーストーリーにトレースするためのもの
- 各ユーザーストーリーは独立して完成・テスト可能であること
- テストは実装前に記述し、FAIL することを確認すること（TDD）
- 各タスクまたは論理的グループの完了後にコミットすること
- どのチェックポイントでも停止してストーリーを独立検証できること
- **避けること**: 曖昧なタスク、同一ファイルの競合、ストーリー独立性を壊す依存関係

---

## タスクサマリー

| フェーズ | ユーザーストーリー | タスク数 | 並列タスク数 |
|---------|-----------------|---------|------------|
| フェーズ 1: セットアップ | — | 6 (T001–T006) | 3 |
| フェーズ 2: 基盤 | — | 11 (T007–T017) | 5 |
| フェーズ 3: US1 バッチキャプチャ | P1 🎯 MVP | 5 (T018–T022) | 2 |
| フェーズ 4: US2 閲覧・一覧 | P2 | 3 (T023–T025) | 2 |
| フェーズ 5: US3 テキストコメント | P3 | 3 (T026–T028) | 2 |
| フェーズ 6: US4 アノテーション | P4 | 3 (T029–T031) | 2 |
| フェーズ 7: US5 エクスポート | P5 | 2 (T032–T033) | 1 |
| フェーズ 8: ポリッシュ | — | 6 (T034–T039) | 3 |
| **合計** | | **39** | **20** |
