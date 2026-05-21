# Phase 0: リサーチ成果

**フィーチャー**: web-screen-capture | **日付**: 2026-05-20

---

## 1. ヘッドレスブラウザ選定

### 調査対象

| 候補 | バージョン | Node.js対応 | 特徴 |
|------|-----------|------------|------|
| Playwright | 1.44+ | ✅ ネイティブ | クロスブラウザ、Screenshot API、JS待機 |
| Puppeteer | 22+ | ✅ | Chromiumのみ（主）、Google管理 |
| Selenium WebDriver | 4.x | ✅ (via bindings) | 古いアーキテクチャ、設定複雑 |
| chromedp | latest | ❌ Go専用 | CDP直接操作、複雑 |

### 決定

**Playwright を採用する**

**根拠**:
- TypeScript/Node.js とネイティブに統合（同一エコシステム）
- `page.screenshot({ path, fullPage, type: 'png' })` で PNG キャプチャが一行で完結
- `page.waitForLoadState('networkidle')` で JS レンダリング完了を明示的に待機可能
- タイムアウト設定が柔軟: `browser.newPage()` / `page.setDefaultTimeout(ms)`
- CI での Chromium 自動インストール: `npx playwright install chromium`
- 公式ドキュメントが充実、型定義が完備

**代替案が却下された理由**:
- Puppeteer: Playwright の前身であり、クロスブラウザ対応・API 設計で Playwright が上位互換
- Selenium: 設定複雑度が高く、YAGNI 原則に反する
- chromedp: Go 言語専用のため、TypeScript/Node.js 採用決定後は対象外

---

## 2. CLIフレームワーク選定

### 調査対象

| 候補 | 週間DL数 | TypeScript | サブコマンド | テスト容易性 |
|------|---------|-----------|------------|------------|
| Commander.js | ~1億 | ✅ 型定義完備 | ✅ | ✅ |
| Yargs | ~5000万 | ✅ | ✅ | ✅ |
| oclif | ~100万 | ✅ | ✅（プラグイン型） | ✅ |
| Meow | ~500万 | ✅ | ❌（手動実装） | △ |

### 決定

**Commander.js を採用する**

**根拠**:
- 最も普及したCLIフレームワーク（npm週間1億DL超）
- TypeScript 型定義が完備（`@types/commander` 不要）
- サブコマンド（`comment add`、`annotation list` 等）を自然に表現できる
- `.command('add').argument('<id>').option(...)` の直感的 API
- テスト時に `program.parse(['node', 'wsc', 'capture', 'https://...'])` で簡単モック実行可能

**代替案が却下された理由**:
- Yargs: 機能同等だが Commander の型安全性・可読性が優れる
- oclif: プラグインアーキテクチャは本ツールには過剰（YAGNI）
- Meow: ESMのみ・サブコマンドサポート弱い

---

## 3. JSON ストレージパターン

### 調査: フラットJSON vs SQLite vs その他

| アプローチ | メリット | デメリット |
|-----------|---------|-----------|
| フラットJSON（採用） | 人間可読、移行容易、エクスポートがファイルコピー | 数万件以上で速度低下 |
| SQLite | クエリ柔軟、パフォーマンス | 専用ビューア必要、移行コスト |
| LevelDB/LMDB | 高速 | バイナリ、依存重い |

### 決定

**フラットJSONファイルを採用する（v1）**

**根拠**:
- v1 スコープ（数百件）では十分なパフォーマンス
- 人間がテキストエディタで確認・修正可能（デバッグ・緊急対応）
- エクスポート処理がファイルコピーで完結（export コマンド実装が最小限）
- ストレージインターフェース (`StorageBackend`) 経由でアクセスするため、将来 SQLite に移行してもCLI変更なし

### アトミック書き込みパターン

並行書き込みによるデータ破損を防ぐため、以下のパターンを採用:

```
1. 現在の JSON ファイルを読み込む
2. メモリ上で変更を適用（追加/更新/削除）
3. 一時ファイル（<target>.tmp）に新しい JSON を書き込む
4. rename() で一時ファイルをターゲットパスに置換（OS レベルのアトミック操作）
```

Node.js の `fs.renameSync()` は同一ファイルシステム上では POSIX rename(2) を使用し、アトミックである。

---

## 4. リトライ戦略

### 調査: ネットワーク一時エラーの処理パターン

**採用パターン**: 指数バックオフ付きリトライ

```
リトライ1: 1000ms 待機後
リトライ2: 2000ms 待機後
リトライ3: 4000ms 待機後
→ 全失敗: エラーレポート（処理継続）
```

**設定可能パラメータ**:
- `--retries <n>`: CLIフラグ（デフォルト: 3）
- `config.capture.retries`: 設定ファイル

**リトライ対象エラー**:
- `TimeoutError`: ページロードタイムアウト
- `net::ERR_NAME_NOT_RESOLVED` 等のネットワークエラー

**リトライしないエラー**:
- HTTP 4xx（クライアントエラー）— 確定的失敗のためリトライ不要
- 引数バリデーションエラー

---

## 5. 著者識別子解決

### 仕様書 OQ-2 の決定確認

> 著者識別子は設定ファイル → 環境変数（`WSC_AUTHOR`）→ `--author` CLIオプションの優先順位

憲章 V 原則「CLI フラグは設定ファイル値より優先」に照合:
- **正しい優先順序（高→低）**: `--author` CLI フラグ > `WSC_AUTHOR` 環境変数 > `config.json` の `author` キー
- 仕様書の「→」は「なければ次を参照」という意味（フォールバックチェーン）
- CLI フラグが最優先であることは憲章・仕様の両方で一致

**未設定時の動作**: エラーを返す（匿名投稿は禁止）。エラーメッセージは設定方法を3通り案内する。

---

## 6. エクスポート形式

### 要件確認

- FR-020: JSON メタデータ + 画像ファイルでエクスポート
- SC-006: ストレージバックエンドへのアクセスなしで外部ツールから再構築可能

### 採用フォーマット

```
<output-dir>/
├── export.json    # 全データ統合（自己完結型）
└── images/
    ├── <capture-id>.png
    └── ...
```

`export.json` の構造:
```json
{
  "exported_at": "2026-05-20T12:00:00.000Z",
  "version": 1,
  "captures": [
    {
      "id": "...",
      "url": "...",
      "captured_at": "...",
      "label": "...",
      "image_path": "images/<capture-id>.png",
      "status": "success",
      "comments": [ /* Comment[] */ ],
      "annotations": [ /* Annotation[] */ ]
    }
  ]
}
```

画像パスは `export.json` からの相対パスで記録（自己完結型・ポータブル）。

---

## 未解決事項（全て解決済み）

| 項目 | 解決内容 |
|------|---------|
| 言語選定 | TypeScript/Node.js（Playwright ネイティブ、npm 配布容易） |
| CLIフレームワーク | Commander.js（最普及、TypeScript 型安全） |
| ブラウザエンジン | Playwright（クロスブラウザ、JS待機、PNG API） |
| ストレージ形式 | フラットJSON + PNG（v1）、インターフェース抽象化で SQLite 移行可能 |
| リトライ戦略 | 指数バックオフ3回、設定可能 |
| 著者未設定時 | エラー + 3通りの設定方法を案内 |
| エクスポート形式 | export.json（自己完結型） + images/ |
