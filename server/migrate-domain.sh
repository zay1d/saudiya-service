#!/usr/bin/env bash
# One-time migration from 167-86-125-229.nip.io to a real domain.
# Usage: bash server/migrate-domain.sh saudihizmat.fyi

set -euo pipefail

DOMAIN="${1:-saudihizmat.fyi}"
EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"
APP_DIR="/opt/saudia-service"

cd "$APP_DIR"

echo "==> 1/6  Verifying DNS for ${DOMAIN}"
RESOLVED="$(dig +short "${DOMAIN}" | head -1 || true)"
EXPECTED="$(curl -s ifconfig.me || true)"
if [[ -n "$RESOLVED" && -n "$EXPECTED" && "$RESOLVED" != "$EXPECTED" ]]; then
  echo "WARN: ${DOMAIN} resolves to ${RESOLVED}, but this server is ${EXPECTED}."
  echo "      DNS may still be propagating. Continuing in 5s — Ctrl+C to abort."
  sleep 5
fi

echo "==> 2/6  Setting up temporary HTTP site so Certbot can answer the ACME challenge"
mkdir -p /var/www/certbot
cat > /etc/nginx/sites-available/saudia-tmp <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'pending tls'; add_header Content-Type text/plain; }
}
EOF
ln -sf /etc/nginx/sites-available/saudia-tmp /etc/nginx/sites-enabled/saudia-tmp
# remove any old conflicting site for the old domain so server_name doesn't clash
rm -f /etc/nginx/sites-enabled/saudia-bot
nginx -t && systemctl reload nginx

echo "==> 3/6  Issuing Let's Encrypt cert for ${DOMAIN} and www.${DOMAIN}"
certbot certonly --webroot -w /var/www/certbot \
    -d "${DOMAIN}" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "${EMAIL}"

echo "==> 4/6  Activating production Nginx config"
install -m 644 server/nginx.conf /etc/nginx/sites-available/saudia-bot
ln -sf /etc/nginx/sites-available/saudia-bot /etc/nginx/sites-enabled/saudia-bot
rm -f /etc/nginx/sites-enabled/saudia-tmp
nginx -t && systemctl reload nginx

echo "==> 5/6  Updating ALLOWED_ORIGINS in .env"
if grep -q '^ALLOWED_ORIGINS=' "$APP_DIR/.env"; then
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}|" "$APP_DIR/.env"
else
  echo "ALLOWED_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}" >> "$APP_DIR/.env"
fi
systemctl restart saudia-bot

echo "==> 6/6  Health check"
sleep 2
curl -fsSL "https://${DOMAIN}/api/health" || {
  echo
  echo "Health check failed. Investigate with:"
  echo "  journalctl -u saudia-bot -n 50 --no-pager"
  echo "  nginx -t"
  exit 1
}
echo
echo "✓ Live at https://${DOMAIN}"
echo "✓ API at  https://${DOMAIN}/api/health"
