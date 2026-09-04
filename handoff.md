# Handoff — where the project stands right now

For the next session (or engineer). Read `CLAUDE.md` for the full reference;
this file is the short version: latest state, what just landed, what's open.

---

## 0. One-line context

Telegram Mini App for an umra/hajj travel agency in Uzbekistan, served from a
single Contabo VPS at https://saudihizmat.fyi. All five categories are
functionally complete. Bot is mid-migration from the old `8897203944…` token
to `@Saudiaservice_bot`.

- **Repo:** https://github.com/zay1d/saudiya-service
- **Branch:** `claude/telegram-mini-app-U5ytG` (everything lives here; no main merge yet)
- **Owner chat id:** `6136579036`
- **VPS:** `ssh root@<SERVER_IP>` (original box was destroyed; redeployed fresh) → `/opt/saudia-service/`
- **Deploy:** `ssh root@<SERVER_IP> 'bash /opt/saudia-service/server/update.sh'`

---

## 1. What landed in the last burst of work

(Reverse-chronological, last ~30 commits.)

-2. **Admin broadcast — `/broadcast`.** Two-step admin command: send
    `/broadcast`, then send the message to broadcast (text/photo/file/video).
    Bot copies it to every user in `tracks.json` via `copyMessage`, throttled
    to ~25/sec, and reports `sent / blocked / failed / total`. Admins are
    excluded from the recipient list. /cancel exits before sending.

-1.5. **Madina hotels — flat list.** `HOTEL_SEGMENTS` is now per-city. Madina
     shows all 16 hotels as a single unlabeled list (no VIP/Comfort/Standart
     split) per the client's request. Makka still tiered.

-1. **Usage stats — `статистика1`.** Privacy-respecting tracking: day-only
    aggregates, no timestamps/IPs/UAs. `tracks.json` next to `content.json`,
    atomic writes, 180-day retention on `daily{}`, lifetime totals kept
    forever. Admins are filtered server-side. New `/api/track` endpoint, new
    `/stats` admin command, 4 frontend track hooks (`open`, `category`,
    `location`, `contact`). See CLAUDE.md § 6 "Usage stats" for shape and
    event semantics.

0. **Backend hardening — runs as unprivileged `saudia` user, not root.**
   `saudia-bot.service` now has `User/Group=saudia` plus sandbox directives
   (`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, `PrivateTmp`,
   `ReadWritePaths` limited to app dir + log). `install.sh` creates the
   account, sets `.env` to `640 root:saudia` (load_dotenv needs to read it
   at boot). One-time migration steps for existing root-based installs are
   in `server/README.md`. Closes an entire class of RCE-blast-radius bugs.

1. **Hotels — Madina populated.** 16 hotels split into VIP/Comfort/Standart by
   brand prestige; Ekonom kept as the "biz bilan bog'laning" prompt. Client
   sent names without tiers — segmentation is a guess, needs review.
2. **Body text bump.** All descriptive text from 11.5/12px → 13px globally
   for adult readability. UPPERCASE micro-labels untouched.
3. **Standart Umra fix.** `desc` was `"3 kun Makka · 11 kun Madina"` —
   client said it should be reversed. Now `"3 kun Madina · 11 kun Makka"`.
   CLAUDE.md note updated too.
4. **Owner credit on home.** `Ishlab chiqdi: @zayd_usamah` below the cities
   line, links to `t.me/zayd_usamah`. Small + dimmed.
5. **Hotel booking — added `Xonalar soni` field** between `Xona turi` and
   `Ovqat turi`. 1–100, default 1. Backend `HotelOrderIn.rooms` + admin
   message line.
6. **Hotel form to client's layout.** Field order: phone → city → hotel
   name → dates → room type → room count → meal → comment. Dropped
   adults/children, dropped name/surname (Telegram handle is enough for
   contact).
7. **Mexmonxonalar — full build.** Root with 2 big buttons → city picker →
   sectioned list (VIP/Comfort/Standart/Ekonom). 36+ Makka hotels, 16 Madina
   hotels. Ekonom segment is a "contact us" prompt.
8. **Aloqa — real content.** Phone `+966 50 390 1777`, Telegram
   `@saudia_servicer`, B2B `t.me/saudiaservicer`, channel `@makka_xabarlari`,
   Instagram. Tap-on-phone copies to clipboard with a toast (because
   Telegram WebView blocks `tel:`).
9. **Fullscreen for the in-chat menu button.** Bot API 8.0 `requestFullscreen()`
   with safe-area-top via `--tg-top`. The BotFather "fullscreen" toggle only
   applies to the Main Mini App surface; the menu button needed code-side fix.
10. **Watermark logo: width 500px, max-width 92vw, centered.** Earlier we kept
    bumping width but `max-width: 60vw` was capping it on mobile.

---

## 2. What's actually deployed vs. what's in repo

The VPS pulls from this branch. After every commit run:

```bash
ssh root@<SERVER_IP> 'bash /opt/saudia-service/server/update.sh'
```

That does `git pull`, `pip install -r`, `systemctl restart saudia-bot`. For
frontend-only changes nginx serves files directly so the restart is harmless
but unnecessary.

`/opt/saudia-service/.env` is **not** in git. It holds `BOT_TOKEN` and
`ADMIN_CHAT_ID`. Owner edits via `nano` on the VPS.

`/opt/saudia-service/content.json` is also not in git. Seeded from
`server/content.default.json` on first boot; admin then edits visa prices via
bot commands. If you add new keys to `content.default.json`, run the merge
snippet in `CLAUDE.md` § 7 to backfill the live file.

---

## 3. Bot migration — current state

Owner is mid-switch from the old saudia bot (token `8897203944…`, **leaked
in chat early on**) to the new `@Saudiaservice_bot`.

**Done:**
- New bot exists in BotFather.
- Main Mini App configured (`/newapp` → URL `https://saudihizmat.fyi`,
  short name `app` → ссылка `t.me/Saudiaservice_bot/app`).
- Menu button (left of input) configured.
- Owner confirmed the new bot opens the app full-screen via profile button.

**Pending on the owner side (instructions already given):**
1. Stop any old code that polls the new bot's token (to avoid 409 conflict).
2. `curl "https://api.telegram.org/bot<NEW_TOKEN>/deleteWebhook?drop_pending_updates=true"`.
3. `nano /opt/saudia-service/.env` → replace `BOT_TOKEN=` with the new token.
   `ADMIN_CHAT_ID=6136579036` stays.
4. `systemctl restart saudia-bot && sleep 2 && curl https://saudihizmat.fyi/api/health`.
5. Press `/start` to `@Saudiaservice_bot` so the admin chat is unblocked.
6. `/revoke` the old leaked token in BotFather.

The backend auto-fetches the bot username via `getMe` at startup, so the
visa deep-link `t.me/<bot>?start=visa_<id>` updates itself after restart.

---

## 4. Security audit — pending

Owner installed the `secure-coding-trio` skill at
`~/.claude/skills/secure-coding-trio/`. It runs an Engineer / QA / Security
trio for build work. In the next fresh session ask for a full audit using
the Security-reviewer role.

**My partial findings (mid-review when interrupted):**

- 🟠 **H1 — Leaked secrets.** Bot token `8897203944…` and root password
  posted in earlier chat. Rotate now. Already in CLAUDE.md and above.
- 🟠 **H2 — initData replay window is 24 h** (`server/main.py:122`).
  Telegram recommends ≤ 5 min. One-line fix: `86400` → `300`.
- 🟡 **M1 — `_last_seen` rate-limit dict grows unbounded**
  (`server/main.py:239`). Memory leak over time. Add periodic GC or use
  a TTL cache.
- 🟡 **M2 — Missing security headers in nginx.** HSTS, X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy not set. CSP would be ideal but the
  inline Telegram script complicates it.
- 🟡 **M3 — No nginx-level rate limit** (only app-level per-user via initData).
  A malicious flood of bad initData would still hit Pydantic + HMAC compare
  per request. Add `limit_req_zone` on `/api/`.
- 🟡 **M4 — `_h()` escapes only `&<>`.** Fine for Telegram HTML parse mode
  (we don't use attributes in user content), but `html.escape(s, quote=True)`
  from stdlib is safer defense in depth.
- 🟢 **L1 — Server-side phone format not validated** (Pydantic just enforces
  length). Output is escaped via `_h()` so no XSS risk, but a regex would be
  cleaner.
- 🟢 **L2 — Logs may leak user PII or pieces of the token.** `r.text[:200]`
  on Telegram API failures could include user input. Sanitize.

The audit was cut off mid-write; ask the new session to redo it fully via
the skill.

---

## 5. Open per-category work

### Hotels
- **Detail screens with photos + location.** Per the original brief
  ("bosilganda mexmonxona nomi, lakatsiyasi va rasmlar chiqishi kerak").
  Currently rows are name-only. Need: tap target → `viewHotelDetail` with
  image gallery + map embed/coords + short description.
- **Madina segmentation review.** Client sent the list flat; tier
  assignment is my guess based on brand prestige and Haram-distance. Get
  client confirmation.
- **Brand name normalisation.** Lots of preserved typos (Fermont, Mowenpick,
  Adress, Marriot, Jumaira, Hilton Conversation, Pulman, Raffless, …).
  Per past-mistake #1 we don't invent, but real brands should be spelled
  right on a premium app. Confirm with client, then fix.

### Aloqa
- Optional: address, hours, map embed. Current cards cover phone + chat
  channels which is enough for a v1.

### Umra
- No prices anywhere — that's the brief's wish, not a missing feature.
  Lead form already routes interest to admin.

### Visas
- 4 tariffs (Umra / Tourist Single / Tourist Multi / Business).
- Admin can change prices via `/setprice <id> <amount>` and hide/show via
  `/toggle <id>`.

### Transfers
- Done. 3 cards + Individual/Guruh modal with route picker.

---

## 6. Files you might touch first

| File | What lives here |
|---|---|
| `data.js` | All hardcoded content: packages, visas/transfers fallback, **hotel lists per city per segment**, contact cards, icon mappings, city list. |
| `app.js` | One IIFE. State machine, all views, modal logic, Telegram WebApp init (incl. `requestFullscreen` and safe-area). Find sections by `// ----------` comments. |
| `index.html` | SPA shell + inline SVG `<symbol>` definitions for every line icon. |
| `styles.css` | Single file, ~1.5k lines. Sections marked by `/* ============ NAME ============ */`. |
| `server/main.py` | FastAPI app + Telegram long-poll loop + admin command dispatch + visa state machine. `HotelOrderIn` / `TransferOrderIn` / `LeadIn` are the form schemas. |
| `server/content.default.json` | Seed for `content.json`. Only visas and transfers — hotels are still hardcoded in `data.js`. |
| `server/nginx.conf` | Production nginx config (apex + www, SSL, /api proxy, static root, no-cache headers). |
| `CLAUDE.md` | Full project reference (this file is the short version of that). |
| `design-brief.md` | Brief to hand to a design AI for a fresh skin. |

---

## 7. Don't-do-this reminders

Critical past-mistakes (from `CLAUDE.md` § 8):

- **Don't invent content.** Use the client's words verbatim. Even typos —
  unless they're clearly real-brand typos and the client confirms a fix.
- **Don't put icons in `content.json`.** Icons are frontend-owned via
  `VISA_ICONS` / `TRANSFER_ICONS` so bot price edits can't change card design.
- **Don't break the chocolate + gold palette.** Navy + gold was rejected as
  "gypsy"; client wants Aman / Four Seasons / Hermès tier.
- **Don't load external images.** All backgrounds are local in
  `assets/backgrounds/`. Once an Unsplash URL turned out to be a man's
  portrait, not a mosque — embarrassing.
- **Don't mix emoji into the line-icon design.** Emoji 🕋 ✈️ 💼 are only
  allowed in body text where they came from the client's own Uzbek copy.
- **Menu button ≠ Main Mini App.** Different surfaces, different fullscreen
  behavior. Code-side `requestFullscreen()` is needed for the menu button.
- **Telegram caches menu button config per client.** After BotFather changes,
  fully close + reopen Telegram before debugging "not seeing the change".

---

## 8. How to start the next session

1. Open Claude Code in `/home/user/saudiya-service`.
2. The skill `secure-coding-trio` will auto-load (already installed).
3. First message: tell Claude what you want — security audit, new feature,
   tweak, whatever. Reference `CLAUDE.md` for context if needed; this
   handoff file for status.
4. For audit: "проведи security-аудит через Security-reviewer роль
   secure-coding-trio".
5. For new feature: just describe it; the trio skill will auto-trigger.
