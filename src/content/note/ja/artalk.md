---
title: Artalk コメント設定ガイド
timestamp: 2026-09-26 00:00:00+00:00
series: Guide
tags: [Configuration, Artalk]
description: セルフホストの Artalk コメント、投票、統計、拡張機能を設定します。
toc: true
---

## サーバーに接続する

コメント機能は既定で無効です。[Artalk サーバーをデプロイ](https://artalk.js.org/en/guide/deploy.html)し、`site.config.ts` に `comments` を追加してください。ブログは静的サイトのままで、Artalk と同じサーバーで運用できます。[Docker Compose の例](https://github.com/tuyuritio/astro-theme-thought-lite/tree/main/examples/artalk)にはリバースプロキシとデータ永続化の手順があります。クライアントは Artalk 2.10.0 です。互換性のあるサーバーを使用してください。

```ts
comments: {
  provider: "artalk",
  server: "https://comments.example.com",
  site: "ThoughtLite",
  sections: ["note", "jotting"],
  lazy: true,
  statistics: true,
  pageVote: true,
  katex: true,
  imageZoom: true,
  options: {
    preview: true,
    vote: true,
    voteDown: true,
    listSort: true,
    imgUpload: true,
    imgLazyLoad: "native",
    pagination: { pageSize: 20, readMore: true, autoLoad: true }
  }
}
```

必須項目は `provider` と `server` のみです。`site` の既定値はブログのタイトルです。タイトル変更の影響を避けるため、Artalk に登録したサイト名を明示してください。`server` は `/comments-api` のような同一オリジンのパスにも対応します。その場合、プロキシでプレフィックスを除去してください。ブラウザーが直接接続するため、HTTPS のブログには HTTPS のサーバーを使い、Artalk でブログのオリジンを許可してください。

## 機能と設定

完全版クライアントにより、スレッド返信、Markdown、プレビュー、絵文字、並べ替え、ページ分割、コメント投票、ユーザーサイドバーを利用できます。さらに記事への投票、コメント数・閲覧数、公式 KaTeX プラグイン、コメント画像の拡大を統合しています。明暗モードと英語・中国語・日本語を自動で合わせ、Swup によるページ遷移にも対応します。

画像アップロード、ソーシャルログイン、CAPTCHA、承認、返信メールなどの通知は **Artalk サーバー側の設定**が必要です。クライアントの設定だけでは有効になりません。認証情報はサーバーに保存してください。

| 設定 | 既定値 | 用途 |
|:--|:--|:--|
| `sections` | `["note", "jotting"]` | コメントを表示する記事の種類。`[]` で両方とも無効。 |
| `lazy` | `true` | コメント欄が画面に近づいた時に読み込む。 |
| `statistics` | `true` | コメント数と閲覧数を表示する。 |
| `pageVote` | `true` | 記事の高評価・低評価ボタンを表示する。 |
| `katex` | `true` | コメントとプレビューの数式を表示する。 |
| `imageZoom` | `true` | medium-zoom で画像を拡大する。 |
| `options` | Artalk の既定値 | シリアライズ可能な[クライアント設定](https://artalk.js.org/en/guide/frontend/config.html)。 |

`statistics: false` は表示だけを無効にします。閲覧数の加算も止める場合は `options.pvAdd: false` を設定してください。遅延読み込み時の閲覧数はコメントの読み込み時に加算されます。`options.preferRemoteConf: true` で管理画面の設定を優先できます。それ以外は明示したフロントエンド設定が優先されます。`emoticons`、`gravatar`、`heightLimit`、`nestMax`、`flatMode`、`pluginURLs` も設定できます。既定の絵文字・アバターは外部サービスに接続する場合があります。必要に応じて自分のサーバーのリソースに変更し、信頼できる拡張スクリプトのみを使用してください。

## 記事ごとの制御

ノートやジョッティングの frontmatter でコメントを無効にできます。

```yaml
comments: false
```

サイト全体では `comments: false`、または設定を省略すると無効になります。記事側から全体設定を上書きして有効にはできません。センシティブな記事では、読者が内容の表示を承認してからコメントを読み込みます。

ページキーは末尾のスラッシュ・クエリ・ハッシュを含まない URL パスです。翻訳記事は既定で別々のスレッドを持ちます。記事を移動してもコメントを維持したい場合や、翻訳とスレッドを共有する場合は明示的に指定します。

```yaml
commentKey: /note/my-original-post
```

`site` と `commentKey` の組み合わせがスレッドを識別します。変更する場合は Artalk でデータを移行してください。インポート時は以前のキーを正確に指定します。完全な URL が使われていた場合も、その値を指定できます。記事タイトルは識別に使いません。

## クライアントを拡張する

DOM、ページ識別、言語、明暗モードは統合側が管理します。関数は静的 HTML にシリアライズできません。コールバックは `Base.astro` などの Astro が処理するスクリプトで、バブリングする `artalk:ready` イベントを使って登録してください。

```astro
<script>
  import type { ArtalkReadyDetail } from "$lib/artalk";

  document.addEventListener("artalk:ready", event => {
    const { artalk } = (event as CustomEvent<ArtalkReadyDetail>).detail;
    artalk.on("editor-submitted", () => {
      // Your browser-side integration.
    });
  });
</script>
```

イベントはインスタンスごとに発生します。ページが DOM から削除されるとインスタンスも破棄されるため、ページをまたぐグローバル変数に保持しないでください。一覧・フィードにはコメントを表示しません。`site.config.ts` のコメント設定はブラウザーに公開されます。秘密情報を含めないでください。
