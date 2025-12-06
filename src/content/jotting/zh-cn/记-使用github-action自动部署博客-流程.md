---
title: 记 使用Github Action自动部署博客 流程
timestamp: 2025-12-07 02:26:40+08:00
tags: [技术日志, 折腾日常]
description: 记录使用 Github Action 将我的博客部署半自动化的流程和经验
---
> [!TIP]
> 可选信息

## 背景

最近开始折腾我的博客，但是每次更新博客都需要我在本地构建然后将静态文件上传到服务器实在是有些麻烦。
再加上我用的并不是 `Vercel` 这类成熟平台，没办法直接接入一些一键部署方案，于是决定尝试 GitHub Action。

在翻了翻文档后我发现 GitHub Action 比我想象中的要好用得多，而且结合部署脚本之后几乎可以做到“一推即更新”。  
不过，中途也踩了不少坑，这里简单记录一下整个过程以及解决方案。

---

## 项目结构介绍

我的博客使用 **Astro + pnpm** 构建，仓库结构大致如下：

```
.
├── astro.config.ts
├── dist/                ← 构建产物
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── src/
```

整体的思路是：

1. 本地更新博客
2. 推送到远程仓库
3. 触发 Github Action

其中前两点不多赘述，主要介绍第三点 Action 的具体实现

## 流程拆解

整个自动部署流程主要包含以下几步：

1. **生成 SSH Key 并配置服务器免密登录**
2. **在服务器上准备部署目录**
3. **在 GitHub 仓库配置 Secrets（服务器信息、私钥等）**
4. **编写 GitHub Actions workflow（构建 + 上传）**
5. **解决 CI 中构建失败/权限不足等常见问题**
6. **实现自动部署**

下面逐项记录。

### 1. 准备 SSH Key

在本机生成用于 CI 的 SSH key：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github-actions-deploy
```

把：

* `github-actions-deploy.pub` → 放到服务器 `~/.ssh/authorized_keys`
* `github-actions-deploy` → 填入 GitHub Secrets（私钥）

### 2. 服务器准备部署目录

例如：

```bash
sudo mkdir -p /var/www/blog
sudo chown -R deploy:deploy /var/www/blog
```

（我用的是 `deploy` 用户，你可以随便取）

### 3. 在 GitHub 配置 Secrets

仓库 → Settings → Secrets → Actions：

* `DEPLOY_HOST` → 服务器域名或 IP
* `DEPLOY_USER` → deploy
* `DEPLOY_PATH` → /var/www/blog
* `DEPLOY_KEY` → SSH 私钥内容

### 4. GitHub Actions Workflow 编写

这里是我最终稳定的版本（包含 pnpm 安装、自动删除 workspace 文件、构建 Astro、rsync 部署等步骤）。

```yaml
name: Build and Deploy Blog

on:
  push:
    branches:
      - "dev/xxx"   # 根据自己的分支改

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout source
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9
          run_install: false

      # 删除多余的 pnpm-workspace.yaml 详见后文
      - name: Remove pnpm-workspace.yaml
        run: |
          if [ -f pnpm-workspace.yaml ]; then
            rm pnpm-workspace.yaml
          fi

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build project
        run: pnpm build

      - name: Setup SSH
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.DEPLOY_KEY }}

      - name: Add known hosts
        run: ssh-keyscan -H ${{ secrets.DEPLOY_HOST }} >> ~/.ssh/known_hosts

      # 部署时排除服务器自动生成的 .user.ini
      - name: Deploy via rsync
        run: |
          rsync -avz --delete \
            --exclude='.user.ini' \
            ./dist/ \
            ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:${{ secrets.DEPLOY_PATH }}/
```

## 踩过的坑与解决方案

### 1. pnpm install 报错：packages field missing


这个坑点来自 **`pnpm-workspace.yaml`**：

- 我的项目其实是`monorepo`项目（不是 monorepo）
- 但因为使用的主题原因，仓库里有一个 `pnpm-workspace.yaml`
- pnpm v9 检测到 workspace 文件后会 **强制要求 `packages:` 字段且不能为空**

最终导致 GitHub Action 里 `pnpm install` 报错：

```
ERROR  packages field missing or empty
```

解决方案很简单 ——  **在 Action 里构建前直接删除这个 workspace 文件**：

```bash
rm pnpm-workspace.yaml
```

### 2. pnpm: command not found

**原因：** setup-node 不会自动安装 pnpm。
**解决：** 必须使用官方 action：

```yaml
uses: pnpm/action-setup@v4
```

### 3. rsync 报错：unlink(.user.ini) failed: Operation not permitted

当我使用

```
rsync -avz --delete
```

同步时，服务器目录里的 `.user.ini` 文件因为权限问题无法删除，导致 Action 直接失败：

```
rsync error code 23
```

**解决：加 exclude：**

```bash
--exclude='.user.ini'
```