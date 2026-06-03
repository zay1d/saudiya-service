# Saudia Service — backend (lead-forwarding API)

Tiny FastAPI service that:

- accepts `POST /api/lead` from the Mini App's "Biz bilan bog'laning" form
- verifies the Telegram WebApp `initData` HMAC signature (anti-spam)
- forwards a formatted notification to the admin chat(s) via Bot API

## Deploy (Contabo, Ubuntu/Debian)

Run **once** as root:

```bash
# 1. Clone the repo
git clone -b claude/telegram-mini-app-U5ytG https://github.com/zay1d/saudiya-service.git /opt/saudia-service
cd /opt/saudia-service

# 2. Create .env from the template, fill in BOT_TOKEN + ADMIN_CHAT_ID
cp server/.env.example .env
nano .env

# 3. Run the bootstrap (installs nginx, certbot, python venv, systemd unit,
#    fetches Let's Encrypt cert for 167-86-125-229.nip.io, starts the service)
bash server/install.sh
```

Then verify:

```bash
curl https://167-86-125-229.nip.io/api/health
# → {"ok":true,"admins":1}
```

## Update

After `git push` to the branch (or merge to `main`):

```bash
ssh root@167.86.125.229 'bash /opt/saudia-service/server/update.sh'
```

## Hardening: run as non-root (one-time migration)

The service runs as the unprivileged `saudia` user, not root. A fresh
`install.sh` sets this up automatically. To migrate an **existing** install
that's still running as root, run once as root on the VPS:

```bash
cd /opt/saudia-service
git pull

# 1. Dedicated service account
getent passwd saudia >/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin saudia

# 2. Let 'saudia' write the app dir (atomic content.json writes) + the log.
#    Code stays root-owned so root's git pull / pip in update.sh keep working.
chgrp -R saudia /opt/saudia-service
chmod g+rwx /opt/saudia-service
[ -f content.json ] && chown saudia:saudia content.json
touch /var/log/saudia-bot.log && chown saudia:saudia /var/log/saudia-bot.log

# .env readable by the service user (load_dotenv opens it at startup)
chown root:saudia .env && chmod 640 .env

# 3. Install the hardened unit + restart
install -m 644 server/saudia-bot.service /etc/systemd/system/saudia-bot.service
systemctl daemon-reload && systemctl restart saudia-bot

# 4. Verify it came up as 'saudia' (not root) and the API answers
systemctl show saudia-bot -p MainPID --value | xargs -I{} ps -o user= -p {}
curl -s https://saudihizmat.fyi/api/health
```

Admin price edits via the bot still work — `content.json` is writable by the
service user. `.env` is `640 root:saudia`: readable by the service account
(its `load_dotenv()` opens it at boot) but not world-readable.

## Troubleshooting

```bash
journalctl -u saudia-bot -n 100 --no-pager   # service logs
tail -100 /var/log/saudia-bot.log            # app logs
systemctl status saudia-bot                  # is it alive?
nginx -t                                     # nginx config sanity check
```

## Switching to a real domain later

When you buy e.g. `saudia.uz`:

1. Point its DNS A record to `167.86.125.229`.
2. On the VPS, edit `server/nginx.conf` — replace `167-86-125-229.nip.io` with
   `saudia.uz` (3 places). Commit + push.
3. `bash /opt/saudia-service/server/update.sh`
4. `certbot --nginx -d saudia.uz` to issue a fresh cert.
5. In `data.js` change `API_URL` to `https://saudia.uz/api`. Push — Pages auto-deploys.
