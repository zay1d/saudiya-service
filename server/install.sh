#!/usr/bin/env bash
# One-time bootstrap for the Saudia Service backend.
# Idempotent: safe to re-run after pulling new code.

set -euo pipefail

APP_DIR="/opt/saudia-service"
DOMAIN="167-86-125-229.nip.io"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"

echo "==> 1/7  Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
  python3 python3-venv python3-pip \
  nginx certbot python3-certbot-nginx \
  git curl ca-certificates

echo "==> 2/7  Verifying repo at $APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  echo "ERROR: clone the repo into $APP_DIR first, e.g.:"
  echo "  git clone -b claude/telegram-mini-app-U5ytG https://github.com/zay1d/saudiya-service.git $APP_DIR"
  exit 1
fi
cd "$APP_DIR"

echo "==> 3/7  Checking .env file"
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "ERROR: $APP_DIR/.env not found."
  echo "Create it (cp server/.env.example .env) and fill BOT_TOKEN + ADMIN_CHAT_ID."
  exit 1
fi
chmod 600 "$APP_DIR/.env"

echo "==> 4/7  Python venv + deps"
python3 -m venv .venv
.venv/bin/pip install --upgrade pip --quiet
.venv/bin/pip install -r server/requirements.txt --quiet

echo "==> 5/7  systemd service (runs as unprivileged 'saudia' user)"
# Dedicated service account — no login shell, no home dir.
if ! getent passwd saudia >/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin saudia
fi

# The service reads its code/.venv and writes content.json (atomic temp+rename
# in the app dir). Keep code owned by root (so root's `git pull` / pip in
# update.sh keep working), but let the 'saudia' group write the app dir + the
# live content store.
chgrp -R saudia "$APP_DIR"
chmod g+rwx "$APP_DIR"
[[ -f "$APP_DIR/content.json" ]] && chown saudia:saudia "$APP_DIR/content.json"

# .env: readable by the service user only (root + saudia group, 640). The app's
# load_dotenv() opens this file at startup, so 600 root:root would crash it.
chown root:saudia "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env"

# Append-mode log must be writable by the service user.
touch /var/log/saudia-bot.log
chown saudia:saudia /var/log/saudia-bot.log
chmod 644 /var/log/saudia-bot.log

install -m 644 server/saudia-bot.service /etc/systemd/system/saudia-bot.service
systemctl daemon-reload
systemctl enable saudia-bot
systemctl restart saudia-bot

echo "==> 6/7  Nginx site"
mkdir -p /var/www/certbot
install -m 644 server/nginx.conf /etc/nginx/sites-available/saudia-bot
ln -sf /etc/nginx/sites-available/saudia-bot /etc/nginx/sites-enabled/saudia-bot

# If the cert isn't there yet, fall back to a tiny HTTP-only config first
# so Certbot can answer the ACME challenge.
if [[ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]]; then
  echo "==> 6.1  TLS cert missing — provisioning via Certbot"
  cat > /etc/nginx/sites-available/saudia-bot <<EOF
server {
    listen 80;
    server_name ${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'pending tls'; add_header Content-Type text/plain; }
}
EOF
  nginx -t && systemctl reload nginx
  certbot certonly --webroot -w /var/www/certbot --non-interactive --agree-tos \
    -m "${CERTBOT_EMAIL}" -d "${DOMAIN}"
  # Restore the full HTTPS config now that the cert exists.
  install -m 644 server/nginx.conf /etc/nginx/sites-available/saudia-bot
fi

nginx -t
systemctl reload nginx

echo "==> 7/7  Done. Verifying"
sleep 2
curl -fsSL "https://${DOMAIN}/api/health" || {
  echo
  echo "Health check failed. Inspect with:"
  echo "  journalctl -u saudia-bot -n 50 --no-pager"
  echo "  tail -50 /var/log/saudia-bot.log"
  exit 1
}
echo
echo "API live at https://${DOMAIN}/api/health"
