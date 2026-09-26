# Self-host Artalk alongside a static blog

Copy this directory to your server **outside the static web root**. The blog still uses a normal static build; the comments service has its own persistent data directory.

```sh
cp .env.example .env
# Edit BLOG_URL and ARTALK_SITE in .env first.
docker compose up -d
docker compose exec artalk artalk admin
```

Use a separate site name and data directory for a development deployment if its comments should stay separate from production. `ARTALK_SITE` must match `comments.site` in `site.config.ts`. This example pins the server to the bundled client's version, 2.10.0; review release notes when upgrading both.

## Reverse proxy

The container only binds to loopback. On the same host, add a domain such as `comments.example.com` to your existing HTTPS reverse proxy. For Caddy:

```caddyfile
comments.example.com {
    reverse_proxy 127.0.0.1:23366
}
```

For Nginx, put this location in the existing HTTPS server block for the comments domain, with your normal TLS certificate configuration:

```nginx
location / {
    proxy_pass http://127.0.0.1:23366;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 5m;
}
```

Open the dashboard at `https://comments.example.com` and register the blog's exact origin (including scheme and nonstandard port, if any) under the site's allowed URLs. Register development origins separately when needed. In `data/artalk.yml`, configure `trusted_domains` as needed and `http.proxy_header: X-Forwarded-For` only when requests come through your trusted proxy. Restart after changing server configuration. If your reverse proxy also runs in Docker, use a shared private network instead of host loopback.

Set the blog configuration and rebuild:

```ts
comments: {
  provider: "artalk",
  server: "https://comments.example.com",
  site: "ThoughtLite"
}
```

## Server features and maintenance

The dashboard/server configuration controls moderation, anti-spam, captcha, SMTP reply notifications, social login providers, upload limits/storage, and notification channels. Enable and configure each service there; the theme supplies the full Artalk client. Keep SMTP passwords, OAuth secrets, and the application key on the server. Everything in `site.config.ts` comment options is public browser configuration.

Persist and back up the **entire `data/` directory**, including the SQLite database, configuration/application key, and uploaded images. Stop the service briefly before a file-based SQLite backup, or use a SQLite-aware backup method. Restoring only the blog's `dist/` does not restore comments. The site name and page keys are data identifiers: changing them requires a migration in Artalk.

This example does not configure TLS certificates, DNS, email credentials, OAuth applications, or automated backups for you. See the [official deployment guide](https://artalk.js.org/en/guide/deploy.html), [configuration reference](https://artalk.js.org/en/guide/backend/config.html), and [reverse proxy guide](https://artalk.js.org/en/guide/backend/reverse-proxy.html).
