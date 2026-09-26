---
title: Artalk 评论配置指南
timestamp: 2026-09-26 00:00:00+00:00
series: Guide
tags: [Configuration, Artalk]
description: 接入自托管 Artalk 评论、投票、统计及扩展功能。
toc: true
---

## 连接自托管服务

评论功能默认关闭。先[部署 Artalk 服务端](https://artalk.js.org/guide/deploy.html)，再在 `site.config.ts` 中添加 `comments`。博客仍然静态构建，可与 Artalk 部署在同一台服务器。[Docker Compose 示例](https://github.com/tuyuritio/astro-theme-thought-lite/tree/main/examples/artalk) 包含反向代理和持久化说明。内置客户端版本为 Artalk 2.10.0，请使用兼容的服务端。

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

只有 `provider` 和 `server` 必填。`site` 默认取博客标题，建议显式设置，避免改标题时改变评论站点标识；它必须与 Artalk 中创建的站点名称一致。`server` 也支持 `/comments-api` 这样的同源路径，反向代理需移除该前缀。浏览器直接请求此地址：HTTPS 博客应连接 HTTPS 服务端，并在 Artalk 中允许博客的完整来源地址。

## 功能与配置

完整客户端提供嵌套回复、Markdown、实时预览、表情、排序分页、评论投票以及用户侧边栏。本集成还提供文章投票、评论数与浏览数、官方 KaTeX 插件和评论图片缩放，并跟随站点明暗主题，自动匹配中英日语言，兼容 Swup 页面切换。

图片上传、社交登录、验证码、审核、邮件回复提醒及其他通知渠道，需要在 **Artalk 服务端**分别配置。前端开启按钮不会自动配置这些服务；密钥和密码只保存在服务端。

| 配置 | 默认值 | 用途 |
|:--|:--|:--|
| `sections` | `["note", "jotting"]` | 在指定类型的详情页显示评论；`[]` 关闭两者。 |
| `lazy` | `true` | 评论区接近视口时加载客户端。 |
| `statistics` | `true` | 显示评论数和浏览数。 |
| `pageVote` | `true` | 显示文章赞同/不赞同按钮。 |
| `katex` | `true` | 在评论和预览中渲染数学公式。 |
| `imageZoom` | `true` | 使用 medium-zoom 放大评论图片。 |
| `options` | Artalk 默认值 | 其他可序列化的[客户端配置](https://artalk.js.org/guide/frontend/config.html)。 |

`statistics: false` 只隐藏计数；如需停止增加浏览量，还需设置 `options.pvAdd: false`。懒加载模式在评论客户端加载时计入浏览，而非刚进入文章时。`options.preferRemoteConf: true` 允许管理面板配置优先，否则显式传入的前端配置优先。还可配置 `emoticons`、`gravatar`、`heightLimit`、`nestMax`、`flatMode` 和 `pluginURLs`。Artalk 默认的表情和头像可能请求第三方服务，需要时可替换为自托管资源；扩展脚本只使用可信来源。

## 按文章控制和稳定评论标识

在笔记或随记的 frontmatter 中关闭评论：

```yaml
comments: false
```

站点级设置 `comments: false` 或不配置即全局关闭，单篇文章不能覆盖全局关闭。敏感文章只有在读者确认显示内容后才加载评论。

默认页面标识为 URL 路径，移除末尾斜杠，忽略查询参数和锚点；不同语言的文章默认各自拥有评论。移动文章时保留原有讨论，或有意让译文共享讨论，可显式设置：

```yaml
commentKey: /note/my-original-post
```

`site` 与 `commentKey` 共同标识讨论。更改其中之一会指向新讨论，除非在 Artalk 中迁移数据。导入旧评论时需使用完全一致的旧标识；原标识为完整 URL 时也可以照填。标题不参与评论标识。

## 扩展客户端

DOM 挂载、页面标识、语言和明暗模式由集成管理，不在 `options` 中重复配置。函数不能序列化到静态 HTML；如需浏览器回调，可在 Astro 处理的脚本中（例如 `Base.astro`）监听冒泡事件 `artalk:ready`：

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

每个实例挂载后都会触发事件。不要跨页面保存全局实例；文章离开 DOM 时集成会销毁实例。列表页和订阅源不会挂载评论。所有 `site.config.ts` 评论配置都会公开到浏览器，不能放入密钥。
