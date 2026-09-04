# Saudia Service — backend (lead-forwarding API)

Tiny FastAPI service that:

- accepts `POST /api/lead` from the Mini App's "Biz bilan bog'laning" form
- verifies the Telegram WebApp `initData` HMAC signature (anti-spam)
- forwards a formatted notification to the admin chat(s) via Bot API

## Deploy on a fresh server (Ubuntu/Debian, as root)

**Before you start:** point the domain's DNS at the new machine — at the
registrar (Porkbun) set both A records to the new IP:

| Type | Host  | Value        |
|------|-------|--------------|
| A    | `@`   | `<NEW_IP>`   |
| A    | `www` | `<NEW_IP>`   |

Certbot validates over HTTP, so it can only issue the cert once DNS actually
resolves to this server. Check with `getent hosts saudihizmat.fyi`.

Then run **once** as root:

```bash
# 1. Clone the repo
apt-get update -qq && apt-get install -y git
git clone -b claude/telegram-mini-app-U5ytG \
  https://github.com/zay1d/saudiya-service.git /opt/saudia-service
cd /opt/saudia-service

# 2. Create .env from the template, fill in BOT_TOKEN + ADMIN_CHAT_ID
cp server/.env.example .env
nano .env

# 3. Bootstrap: system packages, python venv, 'saudia' service account,
#    systemd unit, nginx site, Let's Encrypt cert for the apex + www.
#    Defaults to saudihizmat.fyi; pass another domain as the first argument.
bash server/install.sh
```

Verify:

```bash
curl https://saudihizmat.fyi/api/health
# → {"ok":true,"admins":1}
systemctl show saudia-bot -p MainPID --value | xargs -I{} ps -o user= -p {}
# → saudia   (not root)
```

### What does NOT survive a server rebuild

These live only on the VPS and are gitignored, so a fresh box starts clean:

- `.env` — recreate from `server/.env.example` (BOT_TOKEN, ADMIN_CHAT_ID)
- `content.json` — re-seeded from `server/content.default.json` on first boot,
  so any visa prices the admin changed via `/setprice` are back to defaults.
  Re-apply them with `/setprice <visa_id> <price>` in the bot.
- `tracks.json` — usage stats reset to zero; `/stats` starts counting again
- Let's Encrypt certs — reissued by `install.sh`

## Update

After `git push` to the branch:

```bash
ssh root@<SERVER_IP> 'bash /opt/saudia-service/server/update.sh'
```

## Hardening: run as non-root (one-time migration)

The service runs as the unprivileged `saudia` user, not root. A fresh
`install.sh` does all of this automatically, so this section only applies
when migrating an **existing** install that still runs as root. Once, as
root on the VPS:

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

## Changing the domain

The domain is hardcoded in two places:

1. `server/nginx.conf` — `server_name` (3 blocks) and the two
   `ssl_certificate*` paths under `/etc/letsencrypt/live/<domain>/`.
2. `data.js` — the `API_URL` host check, so the Mini App calls `/api` on the
   same origin instead of falling back to the absolute production URL.

Edit both, commit, push, then on the VPS run
`bash server/install.sh <new-domain>` to reissue the cert and reload nginx.
