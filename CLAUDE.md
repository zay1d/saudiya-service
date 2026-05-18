# Saudia Service — production reference

Telegram Mini App for umra/hajj package bookings. User works from this Mac via SSH to a single Contabo VPS; doesn't clone the repo locally.

## Quick facts

| | |
|---|---|
| Domain | https://saudihizmat.fyi (Porkbun, A → 167.86.125.229) |
| Server | `ssh root@167.86.125.229` (Ubuntu 24.04, key auth set up) |
| App dir | `/opt/saudia-service/` |
| Repo | https://github.com/zay1d/saudiya-service, branch `claude/telegram-mini-app-U5ytG` |
| Backend | FastAPI on `127.0.0.1:8000`, systemd unit `saudia-bot` |
| Nginx | `/etc/nginx/sites-available/saudia-bot` (static `/`, proxy `/api`) |
| TLS | Let's Encrypt, auto-renew via `certbot.timer` |
| Env file | `/opt/saudia-service/.env` (chmod 600) — `BOT_TOKEN`, `ADMIN_CHAT_ID`, `ALLOWED_ORIGINS` |
| Logs | `journalctl -u saudia-bot` + `tail /var/log/saudia-bot.log` |

## Deploy update (after `git push`)
```
ssh root@167.86.125.229 'bash /opt/saudia-service/server/update.sh'
```

## Health check
```
curl https://saudihizmat.fyi/api/health   # expect {"ok":true,"admins":N}
```

## Notes
- Frontend is vanilla HTML/JS/CSS — no build step. Files live at repo root, nginx serves them directly.
- Backend code is in `server/`. Frontend hits API via `/api` on the same origin (`API_URL` logic in `data.js`).
- Telegram Mini App URL in @BotFather points to `https://saudihizmat.fyi`.
- Don't store Porkbun API keys — user provides them per task.
