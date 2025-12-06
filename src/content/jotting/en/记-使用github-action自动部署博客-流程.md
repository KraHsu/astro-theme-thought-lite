---
title: Notes on Automating Blog Deployment with GitHub Actions
timestamp: 2025-12-07 02:26:40+08:00
tags: [Tech Logs, Daily Tinkering]
description: A record of how I semi-automated my blog deployment using GitHub Actions, along with lessons learned.
---

## Background

I recently started tinkering with my blog again, but having to build the site locally and manually upload the static files to the server every time became quite tedious.  
Since I’m not using a mature platform like `Vercel`, I can’t take advantage of one-click deployment solutions. So, I decided to give GitHub Actions a try.

After going through the documentation, I found GitHub Actions to be far more convenient than I expected. Combined with a simple deployment script, it can almost achieve “push to update.”  
That said, I ran into plenty of issues along the way — this post documents the whole process and the solutions.

---

## Project Structure Overview

My blog is built with **Astro + pnpm**, and the repository structure looks roughly like this:

```
.
├── astro.config.ts
├── dist/                ← build output
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── src/
```

The overall workflow is:

1. Update blog content locally  
2. Push to remote repository  
3. Trigger GitHub Actions

The first two steps are straightforward. The main focus here is step three — implementing the GitHub Action.

## Workflow Breakdown

The entire automated deployment pipeline consists of:

1. **Generating SSH keys and enabling password-less login to the server**
2. **Preparing a deployment directory on the server**
3. **Configuring GitHub Secrets (server info, private key, etc.)**
4. **Writing the GitHub Actions workflow (build + upload)**
5. **Fixing common CI issues like build failures and permission errors**
6. **Achieving automatic deployment**

Let’s go through each step.

### 1. Preparing SSH Keys

Generate the SSH key used by CI:

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github-actions-deploy
```

Then:

* Put `github-actions-deploy.pub` → on the server at `~/.ssh/authorized_keys`
* Add `github-actions-deploy` → to GitHub Secrets (as the private key)

### 2. Preparing the Server Deployment Directory

For example:

```bash
sudo mkdir -p /var/www/blog
sudo chown -R deploy:deploy /var/www/blog
```

(I use a `deploy` user, but you can choose any name.)

### 3. Setting Up Secrets in GitHub

Go to repository → Settings → Secrets → Actions:

* `DEPLOY_HOST` → Server domain or IP
* `DEPLOY_USER` → deploy
* `DEPLOY_PATH` → /var/www/blog
* `DEPLOY_KEY` → SSH private key content

### 4. Writing the GitHub Actions Workflow

Here’s my final stable version, including pnpm installation, workspace file cleanup, Astro build, and rsync deployment.

```yaml
name: Build and Deploy Blog

on:
  push:
    branches:
      - "dev/xxx"   # Modify to your branch

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

      # Remove unnecessary pnpm-workspace.yaml (explained later)
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

      # Exclude the server-generated .user.ini file during deployment
      - name: Deploy via rsync
        run: |
          rsync -avz --delete \
            --exclude='.user.ini' \
            ./dist/ \
            ${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:${{ secrets.DEPLOY_PATH }}/
```

## Issues Encountered & Solutions

### 1. pnpm install error: packages field missing

This issue was caused by **`pnpm-workspace.yaml`**:

* My project is *not* a monorepo
* But the theme I used includes a `pnpm-workspace.yaml`
* pnpm v9 enforces that if a workspace file exists, it must contain a non-empty `packages:` field

This causes `pnpm install` in GitHub Actions to fail with:

```
ERROR  packages field missing or empty
```

**Solution:** simply remove the workspace file before building in CI:

```bash
rm pnpm-workspace.yaml
```

### 2. pnpm: command not found

**Cause:** setup-node does *not* install pnpm.
**Fix:** Use the official action:

```yaml
uses: pnpm/action-setup@v4
```

### 3. rsync error: unlink(.user.ini) failed: Operation not permitted

When running:

```
rsync -avz --delete
```

The `.user.ini` file on the server couldn’t be deleted due to restricted permissions, causing the entire Action to fail:

```
rsync error code 23
```

**Solution:** exclude the file:

```bash
--exclude='.user.ini'
```
