---
title: Artalk Comments Guide
timestamp: 2026-09-26 00:00:00+00:00
series: Guide
tags: [Configuration, Artalk]
description: Configure self-hosted Artalk comments, voting, statistics, and extensions.
toc: true
---

## Connect your server

Artalk is optional and disabled by default. Deploy an [Artalk server](https://artalk.js.org/en/guide/deploy.html), then add `comments` to `site.config.ts`. The blog remains static and can share a server with Artalk. A [Docker Compose example](https://github.com/tuyuritio/astro-theme-thought-lite/tree/main/examples/artalk) includes reverse proxy and persistence instructions. The bundled client is Artalk 2.10.0; use a compatible server version.

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

Only `provider` and `server` are required. `site` defaults to the blog title; set it explicitly to keep the identifier stable when renaming your blog. It must match the site registered in Artalk. The server URL can also be a same-origin path such as `/comments-api` when your proxy strips that prefix. Browser requests go directly to this URL: use HTTPS for a public HTTPS blog and allow its exact origin in Artalk.

## Available features

The full Artalk client supplies threaded replies, Markdown and live preview, emoticons, comment sorting and pagination, comment voting, and its user/sidebar interface. This integration additionally provides article voting, comment/view counters, the official KaTeX plugin, and image zoom. It follows the blog's light/dark mode, selects English/Chinese/Japanese automatically, and recreates the client when Swup navigates between posts.

Image upload, social login, captcha, moderation, reply email and other notification channels require the corresponding **Artalk server configuration**. Enabling a client control does not configure these services. Keep credentials on the server.

| Option | Default | Purpose |
|:--|:--|:--|
| `sections` | `["note", "jotting"]` | Sections with a comment box on individual posts; `[]` disables both. |
| `lazy` | `true` | Load the client when comments approach the viewport. |
| `statistics` | `true` | Show comment and page-view counters. |
| `pageVote` | `true` | Show article upvote/downvote buttons. |
| `katex` | `true` | Render math in comments and preview. |
| `imageZoom` | `true` | Zoom comment images using medium-zoom. |
| `options` | Artalk defaults | Additional serializable [client options](https://artalk.js.org/en/guide/frontend/config.html). |

`statistics: false` hides counters; use `options.pvAdd: false` to disable page-view increments too. With lazy loading, visits are counted when the comment client loads, not immediately on page entry. `options.preferRemoteConf: true` allows Artalk's dashboard settings to take precedence over client options. Otherwise explicitly supplied client options win. `emoticons`, `gravatar`, `heightLimit`, `nestMax`, `flatMode`, and `pluginURLs` can also be configured in `options`. Artalk's default emoticons/avatar providers may contact third-party services; configure self-hosted resources if desired. Only load trusted plugin URLs.

## Per-post control and stable threads

Set this frontmatter on a note or jotting to hide its comments:

```yaml
comments: false
```

Set `comments: false` at site level (or omit it) to disable the integration globally. A post cannot override that global setting. Sensitive posts load comments only after the reader reveals the content.

By default, the page key is the URL pathname, without its trailing slash, query, or hash. Translated posts have separate threads. To preserve an existing thread when moving a post, or deliberately share a thread across translations, set an explicit key:

```yaml
commentKey: /note/my-original-post
```

The `site` and `commentKey` pair identifies the thread. Changing either creates a different thread unless you migrate the data in Artalk. For imported data, use the exact old page key, including an absolute URL if that was used before. Titles do not identify threads.

## Extend the client

The integration owns element binding, page identity, language, and dark mode; these are not `options` fields. Function-valued options cannot be serialized into static HTML. For browser callbacks, listen for the bubbling `artalk:ready` event in a processed Astro script, for example in `Base.astro`:

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

The event fires for each mounted instance. Do not store a global instance across navigation; the integration destroys it when its post leaves the DOM. No comments are attached to listing/feed pages.
