# CLI コマンドコントラクト: web-screen-capture

**フィーチャー**: web-screen-capture | **日付**: 2026-05-20

このドキュメントは `wsc` CLI ツールの公開インターフェース仕様を定義します。すべてのコマンドはこの仕様に準拠して実装されなければなりません。

---

## グローバル規則

- **エラー出力**: すべてのエラーメッセージは `stderr` に出力する
- **正常出力**: すべての正常出力は `stdout` に出力する
- **終了コード**:
  - `0` — 完全成功
  - `1` — 実行時エラー（ID不存在、ネットワーク失敗、部分的バッチ失敗 等）
  - `2` — 引数エラー・設定エラー（必須オプション未指定 等）
- **`--json` フラグ**: データを返すすべてのコマンドに必須。有効な JSON を `stdout` に出力する
- **著者解決優先順位**: `--author` CLI オプション > `WSC_AUTHOR` 環境変数 > `.wsc/config.json` の `author`

---

## コマンド一覧

### `wsc capture`

URLのスクリーンショットをバッチキャプチャする。

```
wsc capture <url> [<url>...] [options]

引数:
  <url>...            キャプチャ対象URL（1件以上）

オプション:
  --url-file <file>   URLリストファイル（1行1URL）。<url> と組み合わせ可。
  --label <label>     このバッチの全URLに適用するラベル
  --timeout <ms>      1ページあたりのタイムアウト（ms）[デフォルト: config値 or 30000]
  --retries <n>       リトライ回数 [デフォルト: config値 or 3]
  --author <name>     著者識別子
  --json              JSON形式で出力

終了コード:
  0   全URL成功
  1   1件以上失敗（部分成功含む）
  2   URL指定なし、--url-file が読めない、著者未設定

人間可読出力例（成功）:
  ✓ https://example.com → .wsc/images/550e8400-....png
  ✓ https://example.org → .wsc/images/7c9e6679-....png
  
  2/2 キャプチャ完了

人間可読出力例（部分失敗）:
  ✓ https://example.com → .wsc/images/550e8400-....png
  ✗ https://unreachable.example → タイムアウトエラー (30000ms)
    対処方法: --timeout オプションで時間を延ばすか、URLが正しいか確認してください。
  
  1/2 キャプチャ完了（1件失敗）

JSON出力スキーマ:
{
  "results": [
    {
      "url": "string",
      "status": "success" | "failure",
      "capture_id": "string (UUID, success時のみ)",
      "image_path": "string (success時のみ)",
      "captured_at": "string (ISO 8601, success時のみ)",
      "label": "string | null",
      "error": "string (failure時のみ)"
    }
  ],
  "total": number,
  "succeeded": number,
  "failed": number
}
```

---

### `wsc list`

保存済みキャプチャの一覧を表示する。

```
wsc list [options]

オプション:
  --json    JSON形式で出力

終了コード:
  0   常に成功（0件でも成功）

人間可読出力例:
  ID                                    URL                           日時                      ラベル
  550e8400-e29b-41d4-a716-446655440000  https://example.com           2026-05-20 10:30:00       トップページ
  7c9e6679-7425-40de-944b-e07fc1f90ae7  https://example.org           2026-05-20 10:30:15       -

  2件のキャプチャ

人間可読出力例（0件）:
  キャプチャはまだありません。
  最初のキャプチャ: wsc capture <url>

JSON出力スキーマ:
{
  "captures": [
    {
      "id": "string",
      "url": "string",
      "captured_at": "string (ISO 8601)",
      "label": "string | null",
      "status": "success" | "failure",
      "image_path": "string",
      "comment_count": number,
      "annotation_count": number
    }
  ],
  "total": number
}
```

---

### `wsc show`

特定キャプチャの詳細を表示する。

```
wsc show <capture-id> [options]

引数:
  <capture-id>    キャプチャID（UUID）

オプション:
  --json    JSON形式で出力

終了コード:
  0   成功
  1   指定IDが存在しない
  2   引数なし

人間可読出力例:
  キャプチャ: 550e8400-e29b-41d4-a716-446655440000
  URL:        https://example.com
  日時:        2026-05-20 10:30:00
  ラベル:      トップページ確認
  画像:        .wsc/images/550e8400-....png
  ビューポート: 1280x720（フルページ）
  コメント:    2件
  アノテーション: 1件

JSON出力スキーマ:
{
  "id": "string",
  "url": "string",
  "captured_at": "string",
  "label": "string | null",
  "image_path": "string",
  "status": "success" | "failure",
  "viewport_width": number,
  "viewport_height": number,
  "full_page": boolean,
  "comment_count": number,
  "annotation_count": number
}
```

---

### `wsc comment add`

キャプチャにルートコメントを追加する。

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
  1   capture-id が存在しない
  2   --message 未指定、著者未設定

JSON出力スキーマ:
{
  "id": "string",
  "capture_id": "string",
  "parent_id": null,
  "author": "string",
  "message": "string",
  "created_at": "string (ISO 8601)"
}
```

---

### `wsc comment reply`

既存コメントに返信する。

```
wsc comment reply <comment-id> [options]

引数:
  <comment-id>    返信先コメントID

オプション:
  --message <text>    返信本文（必須）
  --author <name>     著者識別子
  --json              JSON形式で出力

終了コード:
  0   成功
  1   comment-id が存在しない
  2   --message 未指定、著者未設定

JSON出力スキーマ:
{
  "id": "string",
  "capture_id": "string",
  "parent_id": "string (返信先コメントID)",
  "author": "string",
  "message": "string",
  "created_at": "string (ISO 8601)"
}
```

---

### `wsc comment list`

キャプチャのコメント一覧をスレッド形式で表示する。

```
wsc comment list <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --json    JSON形式で出力

終了コード:
  0   成功（0件でも成功）
  1   capture-id が存在しない

人間可読出力例:
  [alice | 2026-05-20 11:00:00] ヘッダーの配色が問題
    └ [bob | 2026-05-20 11:05:00] 同意します
    └ [alice | 2026-05-20 11:10:00] 修正しました

JSON出力スキーマ:
[
  {
    "id": "string",
    "author": "string",
    "message": "string",
    "created_at": "string (ISO 8601)",
    "replies": [
      {
        "id": "string",
        "author": "string",
        "message": "string",
        "created_at": "string",
        "replies": []
      }
    ]
  }
]
```

---

### `wsc annotation add`

キャプチャにアノテーションを追加する。

```
wsc annotation add <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --type <type>     種別: rect | arrow | text | highlight（必須）
  --x <px>          始点X座標（必須）
  --y <px>          始点Y座標（必須）
  --width <px>      幅（rect/highlight で必須）
  --height <px>     高さ（rect/highlight で必須）
  --x2 <px>         終点X座標（arrow で必須）
  --y2 <px>         終点Y座標（arrow で必須）
  --color <color>   色（CSS色名 or #RRGGBB）
  --label <text>    テキストラベル（text タイプで必須）
  --author <name>   著者識別子
  --json            JSON形式で出力

終了コード:
  0   成功
  1   capture-id 不存在、座標が画像範囲外
  2   必須オプション不足（--type, --x, --y 等）、著者未設定

バリデーションエラー例（stderr）:
  エラー: 座標 (x=100, y=200, width=300, height=150) が画像サイズ (1280x720) を超えています。
  対処方法: wsc show <capture-id> でビューポートサイズを確認してください。

JSON出力スキーマ:
{
  "id": "string",
  "capture_id": "string",
  "type": "rect" | "arrow" | "text" | "highlight",
  "x": number,
  "y": number,
  "width": number | null,
  "height": number | null,
  "x2": number | null,
  "y2": number | null,
  "color": "string | null",
  "label": "string | null",
  "author": "string",
  "created_at": "string (ISO 8601)"
}
```

---

### `wsc annotation list`

キャプチャのアノテーション一覧を表示する。

```
wsc annotation list <capture-id> [options]

引数:
  <capture-id>    対象キャプチャID

オプション:
  --json    JSON形式で出力

終了コード:
  0   成功（0件でも成功）
  1   capture-id が存在しない

人間可読出力例:
  ID                                    種別        座標                    色       ラベル
  f47ac10b-58cc-4372-a567-0e02b2c3d479  rect        (100,200) 300x150       red      修正箇所
  a1b2c3d4-...                          arrow       (50,50)→(200,300)       blue     -

JSON出力スキーマ:
[
  {
    "id": "string",
    "capture_id": "string",
    "type": "rect" | "arrow" | "text" | "highlight",
    "x": number,
    "y": number,
    "width": number | null,
    "height": number | null,
    "x2": number | null,
    "y2": number | null,
    "color": "string | null",
    "label": "string | null",
    "author": "string",
    "created_at": "string (ISO 8601)"
  }
]
```

---

### `wsc annotation delete`

アノテーションを削除する（画像ファイルは変更しない）。

```
wsc annotation delete <annotation-id>

引数:
  <annotation-id>    削除対象アノテーションID

終了コード:
  0   成功
  1   annotation-id が存在しない

人間可読出力例:
  アノテーション f47ac10b-... を削除しました。（画像ファイルは変更されていません）
```

---

### `wsc export`

全データを開かれた形式でエクスポートする。

```
wsc export [options]

オプション:
  --output <dir>    出力ディレクトリ [デフォルト: ./wsc-export-<ISO8601タイムスタンプ>]
  --json            エクスポート結果をJSON形式で出力

終了コード:
  0   成功（データ0件でも成功）
  1   出力ディレクトリへの書き込み失敗

出力ディレクトリ構造:
  <output>/
  ├── export.json
  └── images/
      └── <capture-id>.png

人間可読出力例:
  エクスポート完了: ./wsc-export-2026-05-20T120000Z/
  - キャプチャ: 5件
  - コメント:   12件
  - アノテーション: 8件
  - 画像ファイル: 5件

JSON出力スキーマ（--json フラグ使用時）:
{
  "output_dir": "string",
  "capture_count": number,
  "comment_count": number,
  "annotation_count": number,
  "image_count": number
}

export.json の構造:
{
  "exported_at": "string (ISO 8601)",
  "version": 1,
  "captures": [
    {
      "id": "string",
      "url": "string",
      "captured_at": "string",
      "label": "string | null",
      "status": "success" | "failure",
      "image_path": "images/<capture-id>.png",
      "viewport_width": number,
      "viewport_height": number,
      "full_page": boolean,
      "comments": [
        {
          "id": "string",
          "parent_id": "string | null",
          "author": "string",
          "message": "string",
          "created_at": "string"
        }
      ],
      "annotations": [
        {
          "id": "string",
          "type": "rect" | "arrow" | "text" | "highlight",
          "x": number, "y": number,
          "width": "number | null", "height": "number | null",
          "x2": "number | null", "y2": "number | null",
          "color": "string | null",
          "label": "string | null",
          "author": "string",
          "created_at": "string"
        }
      ]
    }
  ]
}
```

---

## 破壊的変更ポリシー

このコントラクトは `wsc` の公開 CLI インターフェースです。以下の変更はセマンティックバージョニングの MAJOR バンプが必要です:

- 既存コマンドの引数/オプション名の変更または削除
- JSON 出力スキーマの後方非互換な変更（フィールド削除・型変更）
- 終了コードの意味変更

MINOR バンプで許容される変更:
- 新規コマンドの追加
- 既存コマンドへの新規オプション追加（デフォルト付き）
- JSON 出力スキーマへのオプショナルフィールド追加
