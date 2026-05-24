# クイックスタートガイド: web-screen-capture

**フィーチャー**: web-screen-capture | **日付**: 2026-05-20

このガイドは `wsc` ツールのセットアップから基本的なワークフローまでを説明します。

---

## 前提条件

- Node.js 20 LTS 以上
- npm 9 以上

---

## インストール

```bash
# npm でグローバルインストール
npm install -g web-screen-capture

# または npx で直接実行（インストール不要）
npx web-screen-capture capture https://example.com
```

インストール後に Playwright のブラウザバイナリをインストール:

```bash
npx playwright install chromium
```

---

## 初回セットアップ

プロジェクトディレクトリで著者情報を設定します（チームメンバー各自が実行）:

```bash
# 方法 1: 環境変数（シェル設定ファイルに追記推奨）
export WSC_AUTHOR="alice"

# 方法 2: プロジェクト設定ファイル（.wsc/config.json を自動生成）
wsc config set author alice

# 方法 3: コマンド実行時に都度指定
wsc comment add <id> --author alice --message "..."
```

`.wsc/` ディレクトリはプロジェクトルートに自動作成されます（最初のコマンド実行時）。

---

## 基本的なワークフロー

### 1. スクリーンショットをキャプチャ

```bash
# 単一URL
wsc capture https://example.com

# JPEGのまま明示したい場合
wsc capture https://example.com --format jpeg --quality 80

# 複数URL（スペース区切り）
wsc capture https://example.com https://example.org --label "競合調査 2026-05-20"

# URLリストファイルから
echo "https://example.com
https://example.org
https://example.net" > urls.txt

wsc capture --url-file urls.txt --label "リグレッションチェック"

# JSON出力でスクリプト処理
wsc capture https://example.com --json | jq '.[0].id'
```

### 2. キャプチャ一覧を確認

```bash
# 一覧表示
wsc list

# 詳細表示
wsc show 550e8400-e29b-41d4-a716-446655440000

# JSON出力
wsc list --json | jq '.[].url'
```

### 3. コメントを追加

```bash
# ルートコメント追加
wsc comment add 550e8400-e29b-41d4-a716-446655440000 \
  --message "ヘッダーの配色が問題" \
  --author alice

# コメントへの返信
wsc comment reply 7c9e6679-7425-40de-944b-e07fc1f90ae7 \
  --message "同意します。チケット #123 を作成しました" \
  --author bob

# コメント一覧（スレッド形式）
wsc comment list 550e8400-e29b-41d4-a716-446655440000
```

### 4. アノテーションを追加

```bash
# 矩形アノテーション
wsc annotation add 550e8400-e29b-41d4-a716-446655440000 \
  --type rect \
  --x 100 --y 200 --width 300 --height 150 \
  --color red \
  --label "修正箇所" \
  --author alice

# 矢印アノテーション
wsc annotation add 550e8400-e29b-41d4-a716-446655440000 \
  --type arrow \
  --x 50 --y 50 --x2 200 --y2 300 \
  --color blue \
  --author bob

# テキストラベル
wsc annotation add 550e8400-e29b-41d4-a716-446655440000 \
  --type text \
  --x 150 --y 100 \
  --label "ここを確認" \
  --author alice

# アノテーション一覧
wsc annotation list 550e8400-e29b-41d4-a716-446655440000

# アノテーション削除
wsc annotation delete f47ac10b-58cc-4372-a567-0e02b2c3d479
```

### 5. データをエクスポート

```bash
# デフォルトディレクトリにエクスポート
wsc export

# 出力先を指定
wsc export --output ./team-review-export

# エクスポート結果を確認
ls ./team-review-export/
# → export.json  images/

# 外部ツールで利用
cat ./team-review-export/export.json | jq '.captures[0].annotations'
```

---

## CI/CDでの利用例

```bash
# .github/workflows/visual-regression.yml での使用例

- name: Visual Regression Capture
  env:
    WSC_AUTHOR: ci-bot
  run: |
    wsc capture \
      --url-file test/urls.txt \
      --label "PR #${{ github.event.pull_request.number }}" \
      --timeout 10000 \
      --json > capture-results.json
    
    # 失敗件数を確認
    FAILED=$(cat capture-results.json | jq '.failed')
    if [ "$FAILED" -gt 0 ]; then
      echo "警告: $FAILED 件のキャプチャが失敗しました"
      cat capture-results.json | jq '.results[] | select(.status == "failure")'
    fi
```

---

## ストレージ構造

```
プロジェクトルート/
└── .wsc/
    ├── config.json        # プロジェクト設定
    ├── captures.json      # キャプチャメタデータ
    ├── comments.json      # コメントデータ
    ├── annotations.json   # アノテーションデータ
    └── images/
        └── <capture-id>.(jpg|png)
```

`.wsc/` ディレクトリはチームで共有するか（ネットワーク共有上）、個人ローカルに保持するかはチームの方針によります。

---

## トラブルシューティング

### キャプチャがタイムアウトする

```bash
# タイムアウトを延ばす
wsc capture https://slow-site.example --timeout 60000

# リトライを増やす
wsc capture https://flaky-site.example --retries 5
```

### 著者未設定エラー

```
エラー: 著者識別子が設定されていません。
対処方法: --author オプション、WSC_AUTHOR 環境変数、
または .wsc/config.json の author キーで設定してください。
```

→ 上記の「初回セットアップ」を参照してください。

### Playwright ブラウザが見つからない

```bash
npx playwright install chromium
```

### `.wsc/` ディレクトリのデータが破損した

各 JSON ファイルはテキストエディタで確認・修正できます。スキーマは `specs/001-web-screen-capture/data-model.md` を参照してください。
