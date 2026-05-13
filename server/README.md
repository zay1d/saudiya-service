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
