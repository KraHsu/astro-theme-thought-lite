# Blog deployment

The `dev/hsu_blog` branch connects to Artalk at `https://blog.krahsu.top/artalk` with the stable site name `KraHsu Blog`. The static site still deploys through the existing GitHub Actions workflow.

The Artalk service runs on the same server as the blog:

- Container: `thoughtlite-artalk`, image `artalk/artalk-go:2.10.0`.
- Compose file: `/opt/artalk-blog/compose.yaml`.
- Persistent database, configuration and uploads: `/opt/artalk-blog/data/`.
- Host binding: `127.0.0.1:23366`, exposed through the existing OpenResty HTTPS virtual host at `/artalk/`.
- Dashboard: `https://blog.krahsu.top/artalk/`.
- Administrator credentials: `/opt/artalk-blog/admin-credentials.json`, readable through server administrator access only. Never commit this file.
- Online SQLite backups, configuration and uploaded images: `/opt/artalk-blog/backups/`. A daily cron task retains seven restore points and checks database integrity.

The comment service and its data are outside the static deployment directory, so the blog's `rsync --delete` cannot remove them. The previous OpenResty configuration is also backed up there. Local backups protect against application mistakes; they do not replace an off-server backup.

## Maintenance

Run on the server:

```sh
sudo docker compose -f /opt/artalk-blog/compose.yaml ps
sudo docker logs --tail 100 thoughtlite-artalk
sudo python3 /opt/artalk-blog/backup.py
```

Configure SMTP, social login providers, moderation and notifications in Artalk when their credentials and policies are ready. Image captcha remains enabled with Artalk's default action threshold. Guest image uploads are enabled with a 3 MB limit. The application key and administrator password stay on the server.

To disable comments without deleting data, set `comments: false` in `site.config.ts`, commit and push this development branch. To stop the backend, run `sudo docker compose -f /opt/artalk-blog/compose.yaml stop`. Keep the data and backups when rolling back.
