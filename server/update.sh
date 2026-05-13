#!/usr/bin/env bash
# Pull the latest code and restart the service.
# Use this for routine updates after the initial install.sh.

set -euo pipefail
cd /opt/saudia-service
git pull
.venv/bin/pip install -r server/requirements.txt --quiet
systemctl restart saudia-bot
sleep 1
systemctl --no-pager --quiet status saudia-bot && echo "OK — saudia-bot running"
