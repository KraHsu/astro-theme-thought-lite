# 缓存修复与友链恢复记录

日期：2026-09-27。

## 缓存问题与验证

线上 OpenResty 原先给静态文件返回 `ETag`、`Last-Modified`，没有明确的 `Cache-Control`。主题的 `preload: false` 也没有关闭 Swup 默认启用的内存页面缓存。

在用户允许的临时目录中部署了两页 HTML、JSON 与动态 JavaScript，用 Chromium 实际测试同 URL 更新：

| 场景 | HTML | JSON | 动态脚本 |
| --- | --- | --- | --- |
| 修改前首次访问 | 1 | 1 | 1 |
| 服务器更新为 2 后普通刷新 | 2 | 1 | 1 |
| 同一浏览器强制刷新 | 2 | 2 | 2 |
| 配置 `no-cache` 后首次访问 | 3 | 3 | 3 |
| 服务器更新为 4 后普通刷新 | 4 | 4 | 4 |

另用生产构建进行 Swup 对照实验：内存缓存开启且 HTTP `no-cache` 时，重复访问旧页面不发请求；关闭内存缓存但 HTML 使用 `max-age` 时仍旧；两层同时修正后发起一次请求并得到新页面。线上测试在关闭内存缓存后重复访问，也取得后续第 5 版正文。

测试路径未带英文前缀，因此线上 Swup 单项测试仅在测试浏览器中关闭了跨语言忽略逻辑，以免变成整页导航；正式站点的跨语言保护不变。未使用 Playwright 路由拦截测试 HTTP 缓存，因为拦截会禁用其 HTTP 缓存。

## 已应用的策略

- 主题 `astro.config.ts`：显式 `cache: false`，保留 Swup 过渡。
- 博客 OpenResty `location /`：`Cache-Control: no-cache`，通过验证器复用未变化的内容。
- `location /_astro/`：成功的指纹资源响应使用 `public, max-age=31536000, immutable`。
- 两处 location 都保留 HSTS；Artalk 独立代理 location 不受静态策略影响。
- 配置先备份，再执行 `nginx -t`，通过后平滑重载。原配置位于服务器 `/opt/blog-cache-backups/20260927T123357Z/blog.krahsu.top.conf`。
- 临时目录 `__cache-debug-20260927-c8f2` 已删除，外部请求测试页面确认返回 404。

新缓存规则不能追溯撤回访客已经存储且仍被视为新鲜的旧响应。正常刷新取得新入口后，后续访问遵循新的策略；固定 URL 的旧资源在第一次重新请求前可能仍沿用旧规则。未添加周期性强制重载或持续清空站点缓存，也未删除访客的主题偏好。

上游问题记录：<https://github.com/tuyuritio/astro-theme-thought-lite/issues/144>。
草稿 PR：<https://github.com/tuyuritio/astro-theme-thought-lite/pull/145>，基于上游 `c054043`，提交 `f855420`，仅修改 Swup 配置及三种语言的缓存部署说明。服务器配置不作为主题代码缺陷提交。

## 友链恢复

Hatrix 数据并非丢失的提交：原始改动仍位于 `/tmp/thought-lite-dev-sync` 的工作区，未提交到发布分支。因此部署分支无法带上它们。已恢复原始友链及分类支持，保持原工作区不变。

- “朋友们 / Friends”：Hatrixの窝，<https://hatrix.site/>。
- “前辈们 / Seniors”：記緒漂流，<https://ttio.cc/>。按其公开链接页提供的名称、`favicon-96x96.png` 图标和“于记忆之川，泛思绪之舟。”简介配置。
- 友链组件使用 `div`，避免在关于页面的 `main` 内再嵌套 `main`，干扰 Swup 的内容容器选择。

原工作区共有 13 个未提交文件；完整差异已备份到 `/tmp/blog-pending-worktree-backup-20260927.patch`。其中与友链无关的备案号、页脚／首页布局、阅读进度修正仍保留在原工作区，本次没有将它们混入发布。

## 检查

- 博客 Astro check：59 文件，0 错误、0 警告；生产构建：42 页面。
- 上游独立工作区 Astro check：40 文件，0 错误、0 警告。
- Biome 与 `git diff --check` 通过。
- 浏览器缓存复现与修复对照通过，临时页面已清理。
- 中英文关于页面的桌面／手机、明暗主题共 8 组浏览器检查通过；分类与目标 URL 正确，页面只有一个 `main`，无横向溢出，实际构建的 Swup cache 为 false。
