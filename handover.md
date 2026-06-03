# Handover

Running log of cross-session context — what changed, why, and what's still open.
Newest entry on top. Keep `CLAUDE.md` as the canonical project reference; this
file is the "what happened lately" companion.

---

## 2026-06-03 — Security audit + non-root hardening

**Branches:** work done on `claude/hopeful-albattani-mWDqj`, fast-forwarded into the
deploy branch `claude/telegram-mini-app-U5ytG` (commit `74ee75e`).

### Full security audit (role: Security reviewer)

Reviewed `server/main.py`, `server/nginx.conf`, `server/saudia-bot.service`, the
frontend (`app.js`/`index.html`) and deploy scripts. **No critical auth/injection
bug found.** Application logic is solid:
- `verify_init_data` is correct — proper `WebAppData` secret, `auth_date` freshness
  (24h), constant-time `hmac.compare_digest`.
- Frontend escapes all dynamic output via `esc()` (incl. server content + error
  `detail`); backend escapes via `_h()` before Telegram HTML.

Findings by severity:

| # | Sev | Finding | Status |
|---|-----|---------|--------|
| 1 | High | Backend ran as `root` | ✅ FIXED (this session) |
| 2 | High | No HTTP security headers (HSTS, CSP, nosniff…) in nginx | open |
| 3 | Med | `_last_seen` rate-limit dict never GC'd (memory growth) | open |
| 4 | Med | `/api/content` unauthenticated, uncached, no rate limit (DoS) | open |
| 5 | Med | Passport `file_id` forwarded with no size/MIME check | open |
| 6 | Low | CORS fallback origin + `allow_headers=["*"]` (low — auth is initData, not cookies) | open |
| 7 | Low | `content.json` missing from `.gitignore` (doc says it's there; it isn't) | open |
| 8 | Low | `/api/health` leaks admin count; dated TLS cipher string | open |
| 9 | Info | BOT_TOKEN + VPS root password shared in chat historically — rotate | open |

### Finding #1 — fixed and live in prod

`saudia-bot.service` ran `User=root`; any RCE-class bug would land as root next to
the TLS keys + nginx. The app only needs to read its code/`.venv` and write
`content.json` — no root needed.

**Repo changes (commit `74ee75e`):**
- `server/saudia-bot.service` — `User=saudia` + sandbox (`NoNewPrivileges`,
  `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`, `ProtectKernel*`,
  `RestrictSUIDSGID`; `ReadWritePaths` limited to `/opt/saudia-service` + the log).
- `server/install.sh` — creates the `saudia` system account, `chgrp -R saudia` the
  app dir + `chmod g+rwx` (so atomic `content.json` temp+rename works), chowns the
  log, sets `.env` to `640 root:saudia`.
- `server/README.md` — one-time migration steps for the existing root install.

**Applied on the VPS (verified):**
- Ran the migration (created `saudia`, fixed ownership, installed hardened unit).
- `systemctl ... MainPID | ps -o user=` → **`saudia`** ✅
- `/api/health` → `{"ok":true,"admins":1}` before & after (no downtime) ✅
- Atomic `content.json` write under `saudia` → `write OK` ✅ (admin bot price edits
  unaffected).

**Gotchas learned:**
- `.env` must be readable by `saudia` (`load_dotenv()` opens it at boot) → `640
  root:saudia`, NOT `600 root:root`, or the worker crashes on start.
- A transient **502** appeared right after `systemctl restart` — it was just the
  curl racing uvicorn's socket bind, not a real failure. Re-curl after a few seconds.
- The VPS deploy branch is `claude/telegram-mini-app-U5ytG`; a plain `git pull` there
  won't pick up commits made on a different feature branch — merge/FF first.

### Next recommended step

Finding #2 (nginx security headers — HSTS + CSP). It's `server/nginx.conf`-only,
`nginx -t && systemctl reload nginx`, doesn't touch the app. Not yet implemented.
