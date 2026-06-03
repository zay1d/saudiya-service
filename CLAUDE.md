# Saudia Service — project reference

Telegram Mini App for an umra/hajj travel agency (Uzbekistan).
Sells packages, visas, hotel bookings, transfers and contact intake.
Single owner, single Contabo VPS, single GitHub repo.

The owner does not clone the repo locally — they edit only via Claude
sessions (this file) and SSH to the VPS. Every change must end up in
the repo so the next session has the same picture.

---

## 1. Quick facts

| | |
|---|---|
| Public URL | https://saudihizmat.fyi (also `www.` redirects to apex) |
| Registrar | Porkbun |
| DNS | A `@` → `167.86.125.229`, A `www` → `167.86.125.229` |
| VPS | Contabo, IP `167.86.125.229`, Ubuntu 24.04, root user |
| SSH | `ssh root@167.86.125.229` (key auth configured) |
| App dir | `/opt/saudia-service/` (mirrors repo root) |
| Repo | https://github.com/zay1d/saudiya-service — **public**, owner `zay1d` |
| Active branch | `claude/telegram-mini-app-U5ytG` (everything lands here, no merge to main yet) |
| Frontend | vanilla HTML/CSS/JS at repo root, served by Nginx directly |
| Backend | FastAPI (`server/main.py`) on `127.0.0.1:8000`, behind Nginx `/api/*` |
| Process mgr | systemd unit `saudia-bot`, runs as **unprivileged user `saudia`** (NOT root) + sandbox; autorestart, logs to `/var/log/saudia-bot.log` |
| TLS | Let's Encrypt for `saudihizmat.fyi` + `www.saudihizmat.fyi`, auto-renew via `certbot.timer` |
| Env file | `/opt/saudia-service/.env` (chmod 640 `root:saudia` — service user reads it at boot via load_dotenv; **gitignored**, never put in repo) |
| Content store | `/opt/saudia-service/content.json` (live visa/transfer data, **gitignored**) — seeded from `server/content.default.json` on first boot |
| Telegram bot | username via getMe at startup, owner sets up via @BotFather |
| Admin chat | configured in `.env` as `ADMIN_CHAT_ID` (comma-separated for multiple admins) |
| Bot polling | long-polling started in FastAPI `lifespan`, not webhook |

---

## 2. Architecture

```
Telegram client
   │  opens https://saudihizmat.fyi in WebView
   ▼
Nginx (port 443)
   ├─ /                → /opt/saudia-service/  (index.html, app.js, data.js, styles.css, assets/)
   │                     no-cache headers; /assets/* has 7d cache
   └─ /api/*           → proxy http://127.0.0.1:8000

FastAPI (uvicorn) ──┬── GET  /api/health
                    ├── GET  /api/content        (visas + transfers + bot.username)
                    ├── POST /api/lead           (Umra package interest)
                    ├── POST /api/order-transfer (transfer order, individual or group)
                    └── background task: Telegram long-poll loop
                            ├── admin commands (/prices, /setprice, /toggle, /help)
                            └── visa purchase flow (state machine)

Telegram Bot API ◄──── outgoing (sendMessage, sendPhoto, sendDocument)
                  ◄──── getUpdates polling
```

Important: frontend and backend are **same-origin** (saudihizmat.fyi) →
no CORS preflights for prod. CORS still allows `https://zay1d.github.io`
for Pages preview if ever needed.

---

## 3. Repo layout

```
/opt/saudia-service/  (= repo root)
├── index.html              shell + inline SVG <symbol> defs for every line icon
├── app.js                  IIFE; state machine, all views, modal logic, fetches
├── data.js                 CATEGORIES, UMRA_PACKAGES, VISAS_FALLBACK, TRANSFERS_FALLBACK,
│                            VISA_ICONS, TRANSFER_ICONS, ROUTE_CITIES, CONTACT_URL,
│                            CONTACT_LABEL, API_URL (auto-detects origin)
├── styles.css              all visual rules — single file
├── assets/
│   ├── saudia-service-logo.png  (1000×666, ~408KB)
│   └── backgrounds/
│       ├── kaaba-day.jpg    (1000×1776, ~217KB)
│       ├── haram-night.jpg  (1000×2166, ~330KB)
│       └── nabawi.jpg       (1000×1777, ~148KB)
├── build.py                builds saudia-service.html (self-contained single-file
│                            bundle with everything inlined as base64 data: URIs)
├── saudia-service.html     committed for the owner to share offline (~2MB)
├── CLAUDE.md               this file
├── .gitignore              .env, content.json, .venv, *.pyc
└── server/
    ├── main.py             FastAPI + Telegram long-poll + admin commands + visa flow
    ├── requirements.txt    fastapi, uvicorn[standard], httpx, pydantic, python-dotenv
    ├── content.default.json defaults for visas + transfers
    ├── nginx.conf          production nginx site config (apex + www + redirects)
    ├── saudia-bot.service  systemd unit
    ├── install.sh          one-time bootstrap (only used historically with nip.io)
    ├── update.sh           `git pull && pip install -r + restart`
    ├── migrate-domain.sh   one-time nip.io → real domain migration
    ├── .env.example        template
    └── README.md           deploy walkthrough
```

After cloning, on a fresh VPS:
1. `cp server/.env.example .env`, fill `BOT_TOKEN` and `ADMIN_CHAT_ID`
2. `bash server/install.sh` (or `migrate-domain.sh saudihizmat.fyi` for the domain)

---

## 4. Design system

**Palette (CSS vars in styles.css):**
```
--bg-page:    #2a1f15   (warm taupe / desert dusk)
--bg-card:    #382818
--bg-raised:  #43321f
--bg-deeper:  #1a130c

--gold:       #d6b87b   (sunlit gold, main accent)
--gold-light: #e8cf99
--copper:     #a07e44

--cream:      #f3e8d2   (primary text)
--cream-dim:  #d6c8aa
--muted:      #b6a585
--dim:        #7a6951

--line-08..--line-50:   gold rgba lines at different opacities
```

**Typography:**
- Headlines / serif → **Cormorant Garamond** (Google Fonts, weights 300/400/500, italic)
- UI / sans       → **Inter** (300/400/500/600)

**Backgrounds (per-screen in `.bg-layer`):**
- Home → `kaaba-day.jpg`
- Umra category & detail → mostly `kaaba-day.jpg` (home version) or `haram-night.jpg` on list
- Mexmonxonalar → `haram-night.jpg`
- Vizalar / Aloqa → `nabawi.jpg`
- Transferlar → `kaaba-day.jpg`
Each photo is full viewport (inset:0, cover) with warm gradient + paper-grain overlay on top.

**Logo watermark (`.bg-layer .logo-blur`):**
- Sits at `left: 62%, top: 50%` (slightly right of center)
- `width: 230px` with `max-width: 60vw` cap
- `opacity: 0.20`, `filter: blur(0.5px)`
- Was historically much larger (280px × scale 2.4) which caused the wordmark to bleed off-screen.
  Don't grow past ~65vw — the "SAUDIA SERVICE" wordmark in the PNG will start spilling.

**Icon style:** flat gold line icons, `stroke-width: 1.1`, defined inline as `<symbol id="i-...">`
in `index.html`. Each visa/transfer references its icon by id via `VISA_ICONS` / `TRANSFER_ICONS`
maps in `data.js` — **icons are owned by the frontend**, never read from `content.json`,
so an admin price update via the bot can't accidentally change a card's design.

Icon naming:
- `i-*`        — general line icons (mosque, plane, hotel, bus, train, bag, kaaba, …)
- `h-*`        — large home-row icons (kaaba, passport, hotel, transport, chat)
- `n-*`        — small bottom-tab icons (home, pkg, visa, hotel, transfer, chat)
- `s-*`        — never used in prod (status bar icons, only in the design mockup)

---

## 5. App structure (5 categories)

Bottom tab bar has 5 entries; tapping one opens that category with the same nav style as
the home menu. Back button always goes one level up (detail → list → home).

| # | id | Title | Status |
|---|----|-------|--------|
| I | `umra` | Umra paketlari | **complete** — 4 packages with detail screens + lead form |
| II | `visa` | Vizalar | **complete** — 4 tariffs, detail screens, purchase via bot |
| III | `hotels` | Mexmonxonalar | placeholder — awaiting content from client |
| IV | `transfer` | Transferlar | **complete** — 3 cards + order modal with Individual/Group tabs |
| V | `contact` | Biz bilan bog'laning | minimal — direct Telegram link to manager |

### I. Umra packages — `UMRA_PACKAGES` in data.js (hardcoded, no API)

4 packages, each with `id`, `tier`, `title`, `days`, `cardSub`, `headline`, `lede`,
`features[]` (each `{icon, title, desc, value}`), optional `highlight`, `note`.

Tariff names and contents come from the client's brief — preserve **1:1** with no invention:
- VIP — "Birinchi sinf", `days: "Xohlagan kun"`, 5★ Haramga piyoda, business class, 5-6 kishilik guruh
- Comfort — `days: "11 / 14 kun"`, ~500m Haramdan, 20-30 kishilik
- Standart — `days: "14 kun"` (3 Madina + 11 Makka), ~1-2 km Haramdan, ellikboshi
- Ekonom — `days: "14 kun"` (12 Makka + 2 Madina), 3-7 km, 4-5 kishilik xona, 40-50 kishilik guruh

No prices anywhere — they're contact-on-request:
- Card right column: just the days line
- Detail screen: stacked CTA button with `cta-eyebrow` ("Narxlar va mavjud sanalar bo'yicha") and
  `cta-main` ("Biz bilan bog'laning"); opens lead modal

Lead modal (`openLeadModal({kind:"package",id})`): two fields — `Ismingiz` (required) and
`Qo'shimcha savol` (optional textarea). Posts to `/api/lead` with `init_data`. Admin gets:
```
🔔 Yangi so'rov · Mini App

Ism: ...
Paket: VIP (Birinchi sinf)
Telegram: @handle (id: ...)

Savol: ...
```

### II. Vizalar — driven by `/api/content` (with `VISAS_FALLBACK` as safety net)

4 visas:
- `umra` — Umra vizasi — icon `i-kaaba` (cube with kiswah band) — 1 marta · 90 kun
- `tourist_multi` — Turist (Multi) — icon `i-luggage` (rolling suitcase) — 1 yil · multi
- `tourist_single` — Turist (Single) — icon `i-bag` (duffel bag) — 1 marta · 90 kun
- `business` — Biznes — icon `i-briefcase` — 1 yil · multi

Each visa: `tagline`, `short`, `price` (USD), `features[]`, `warnings[]`, `highlight`.
Highlight renders as a gold-tinted italic note box (`.pkg-note`). Warnings render as
copper-tinted blocks with `i-warn` icon.

**Purchase flow ("Xarid qilish") = bot dialog**, NOT in-app form:
1. Frontend opens `https://t.me/<bot>?start=visa_<id>` via `Telegram.WebApp.openTelegramLink`,
   then explicitly `tg.close()` after 250ms because some clients don't auto-close
2. Bot receives `/start visa_<id>` and runs `_handle_user_message` state machine:
   - `awaiting_name` → user replies with text → `awaiting_passport`
   - `awaiting_passport` → user sends photo OR document → `forward_visa_application` to admin
3. Admin gets sendPhoto/sendDocument with caption:
   ```
   🛂 Yangi viza arizasi

   Viza: Umra vizasi ($185)
   Ism: Ali Karimov
   Telegram: @ali (id: 12345)
   ```
4. User gets confirmation ("Ariza qabul qilindi"). State is wiped. /cancel anytime.
5. Stale states GC'd after 30 minutes (`_FLOW_TTL`).

### III. Mexmonxonalar — placeholder

`viewHotelsPlaceholder()` shows a "Tez orada" message + CTA. Waiting for client to send
hotel list (name, city, stars, distance to Haram, short desc).

### IV. Transferlar — driven by `/api/content` (with `TRANSFERS_FALLBACK`)

3 cards (not clickable themselves — only the order CTA at the bottom). Each card:
icon, short, title, tagline, features[], extras[]:
- `bus` — Avtobus (47/49/50 o'rinli, 2025-2027) — `i-bus`
- `gmc` — GMC / Kia Carnival (VIP/Comfort, 4-7 kishi) — `i-car`
- `train` — Haramain tezkor poyezd (~2.5 soat) — `i-train`

**Order modal** — `openTransferModal()` — has Individual/Guruh tab switcher (`.tabs-switch`).
Fields:
- Tarif (native styled `<select>`, options from `TRANSFERS`)
- Ism va familiya (required text)
- Telefon raqam (masked `+998 XX XXX XX XX`)
- *group-only:* Kishilar soni (2-500) + Tashkilot nomi (optional)
- Yo'nalish — Aviasales-style two columns "Qaerdan" / "Qayerga" with Makka / Madina / Jidda
- Sana (masked `kk/oo/yyyy`, validated as a real date between 2024-2099)
- Izoh — optional textarea

Posts to `/api/order-transfer` (with `booking_type: "individual"|"group"`). Admin gets:
```
🚐 Yangi transfer buyurtmasi · GURUH

Tashkilot: Olmazor Travel
Kishilar soni: 25

Tarif: Avtobus
Yo'nalish: Jidda → Makka
Sana: 15/09/2026

Ism: ...
Telefon: ...
Telegram: ...

Izoh: ...
```

### V. Aloqa — `viewContact()`

Static placeholder with one CTA — direct link to `CONTACT_URL` (manager's @t.me/...).
No form. Waiting for full contact card content (phones, address, hours, socials, map).

---

## 6. Editable content + admin bot commands

`content.json` lives on the VPS (gitignored). Backend reads it on every `/api/content` request
(with `Cache-Control: no-store`) so updates are instant in the Mini App.

Writes are atomic (tempfile + `os.replace`) under an `asyncio.Lock`.

Admin (chat ids listed in `ADMIN_CHAT_ID`) can edit via the bot:
- `/help` or `/start` → command reference
- `/prices` → list visas with current prices and active/hidden state
- `/setprice <visa_id> <price>` → change one visa's price (e.g. `/setprice umra 200`)
- `/toggle <visa_id>` → hide/show a visa on the frontend

Visa ids: `umra`, `tourist_multi`, `tourist_single`, `business`.

**Frontend-owned design** (icons, layout) cannot be changed via bot. Admin only edits
content — prices, active flag. Future: same pattern for transfers, hotel list, etc.

---

## 7. Deployment runbook

### After a `git push`

```bash
ssh root@167.86.125.229 'bash /opt/saudia-service/server/update.sh'
```

The script does: `git pull`, `pip install -r server/requirements.txt`, `systemctl restart saudia-bot`,
prints "OK — saudia-bot running" on success.

### Service runs as non-root (`saudia`)

`saudia-bot.service` runs as the unprivileged system user **`saudia`** with a systemd sandbox
(`ProtectSystem=strict`, `NoNewPrivileges`, `ReadWritePaths` limited to the app dir + log).
`install.sh` creates the user and sets ownership; the one-time migration for an already-running
root install is in `server/README.md`. Key facts for future sessions:
- Code/`.venv` stay **root-owned**; the app dir is group `saudia` + `g+rwx` so the service can do
  the atomic `content.json` temp+rename. `.env` is `640 root:saudia`.
- `update.sh` (run as root) keeps working — it doesn't reinstall the unit. If `git pull` warns
  `dubious ownership`, run `git config --global --add safe.directory /opt/saudia-service`.
- **Don't revert the unit to `User=root`.** It was hardened on 2026-06-03; root gives no benefit
  and a single RCE-class bug would land as root next to the TLS keys + nginx.
- To verify after deploy: `systemctl show saudia-bot -p MainPID --value | xargs -I{} ps -o user= -p {}`
  must print `saudia`.

For frontend-only changes (HTML/CSS/JS), the restart isn't strictly necessary — Nginx serves
the files directly — but `update.sh` runs it anyway, harmless.

### When `content.default.json` gets new keys not yet in live `content.json`

Run a one-off merge so admin's existing edits aren't lost:
```bash
python3 << 'PY'
import json
live = json.load(open('/opt/saudia-service/content.json'))
defaults = json.load(open('/opt/saudia-service/server/content.default.json'))
for key in defaults:
    if key not in live:
        live[key] = defaults[key]
json.dump(live, open('/opt/saudia-service/content.json','w'), ensure_ascii=False, indent=2)
PY
systemctl restart saudia-bot
```

### Updating Nginx config

```bash
cp server/nginx.conf /etc/nginx/sites-available/saudia-bot
nginx -t && systemctl reload nginx
```

### Diagnostics

```bash
journalctl -u saudia-bot -n 100 --no-pager     # bot logs
tail -100 /var/log/saudia-bot.log              # app stdout/stderr
curl https://saudihizmat.fyi/api/health        # {"ok":true,"admins":1}
curl https://saudihizmat.fyi/api/content       # full content payload
nginx -t                                       # nginx syntax sanity
systemctl status saudia-bot --no-pager         # service health
```

---

## 8. Past mistakes — don't repeat

1. **Don't invent content.** When client gave Umra package text I once filled in fake hotel
   names (Movenpick, Pullman, …) and fake `$3 850` prices. They explicitly said no — only
   their words, no invented numbers. Same goes for visas / transfers / hotels: only what the
   client has stated.

2. **Don't put icons in `content.json`.** Frontend owns icons via `VISA_ICONS` /
   `TRANSFER_ICONS`. If you add a new visa via bot command (future), it gets `i-passport`
   fallback in `visaIcon()`.

3. **Don't reference a CSS class without defining it.** Once shipped `.pkg-note` in HTML
   without a matching rule — the highlight text rendered as default body styles. Always
   add the rule and rebuild the bundle.

4. **Don't mix emoji into the line-icon design.** Line-icon system is consistent gold
   1.1px-stroke SVGs. Emojis (🕋 🌍 ✈️ 💼) break the typography in the cards. Emojis stay
   only in body text from the client's Uzbek copy (where they came from the brief itself).

5. **Don't write "per kishi", "per X" or other English/Uzbek hybrids.** The brief is in
   Uzbek; use Uzbek phrasing only ("kishi boshi", "kishilik", etc.).

6. **Don't break the warm-chocolate-and-gold palette.** Previous "navy + gold" version was
   rejected as "gypsy"-looking. The client likes Aman / Four Seasons / Hermès tier. Keep
   colors muted, lots of empty space, thin gold lines.

7. **Don't load external images by Unsplash URL.** One of them once turned out to be a
   random man, not a mosque — client called it out. Backgrounds must be local files in
   `assets/backgrounds/` provided by the client.

8. **Don't trust browser cache.** When the client doesn't see a fresh CSS change, it's
   almost always:
   - `git pull` not actually run on VPS (auth issue when repo was briefly private), or
   - Telegram WebView caching the old `.css` file
   The fix is `?v=N` query string in the URL or fully closing & reopening Telegram from the
   app switcher. We added `Cache-Control: no-cache` on all non-asset routes in `nginx.conf`
   to make this less painful going forward.

9. **Admin testing the visa purchase flow gets nothing back** — the bot intentionally
   ignores admin chat in `_handle_user_message`. Tell the client to use a second account
   or remove their id from `ADMIN_CHAT_ID` temporarily to test the visa dialog.

10. **GitHub Pages is no longer in the stack.** Frontend lives on the VPS under Nginx now.
    Don't suggest Pages-based setups; we abandoned that after buying the domain.

---

## 9. Codewords the owner uses

The owner triggers big features by typing codewords (so we don't accidentally implement
expensive flows mid-conversation):

- `страницадлясвязи1` — start the lead form + backend (✅ done)
- `визыпаспорт1`     — start the visa purchase bot dialog with passport upload (✅ done)
- `вкладкигруппа1`   — add Individual/Guruh tabs to the transfer order form (✅ done)

When a new big flow is proposed, suggest a codeword and don't implement until used.

---

## 10. What's next (open work)

- **Mexmonxonalar content** — waiting for hotel list from client (name/city/stars/distance/desc)
- **Aloqa expansion** — phones, address, hours, socials, maybe map embed
- **Auto-deploy** — possibly a GitHub webhook → VPS endpoint so the owner doesn't need to
  SSH for every change. Not started, not asked yet.
- **GitHub Action / cron for cert renewal sanity check** — certbot timer should already work
  but verifying via logs on first renewal cycle would be nice.
- **Bot token + VPS root password rotation** — the owner shared both in chat early on, so
  they should be regenerated. Noted but not enforced.

### Security audit (2026-06-03) — remaining hardening

A full security review was done (see `handoff.md`). The app logic is solid (correct initData
HMAC, consistent output escaping). Open hardening items, by priority:
- ✅ **DONE** — backend no longer runs as root (now `saudia` + systemd sandbox).
- **nginx security headers** — no HSTS / CSP / `X-Content-Type-Options` yet. Edit
  `server/nginx.conf` (server block for `saudihizmat.fyi`), then `nginx -t && systemctl reload nginx`.
  Highest-value next step, low risk.
- **`_last_seen` unbounded growth** (`server/main.py`) — rate-limit dict is never GC'd; add TTL eviction.
- **`/api/content` DoS** — reads file on every request, no cache / rate limit; cache in memory or add `limit_req`.
- **Passport file forwarding** — no size/MIME check on the document/photo `file_id` users send.
- **`content.json` not in `.gitignore`** — CLAUDE.md claims it is, but it isn't; currently untracked.
  Add it so a stray `git add .` can't commit live data.
- **`/api/health` discloses admin count**; TLS cipher string is dated.

---

## 11. Conventions for new work

- Uzbek copy only on user-facing screens (Latin script). Russian is fine for code
  comments and conversations with the owner.
- New visas/transfers: add to `server/content.default.json`, add a `VISA_ICONS` / 
  `TRANSFER_ICONS` entry, add the icon SVG `<symbol>` in `index.html`. Re-run merge
  snippet on VPS so live `content.json` picks up the new keys.
- New admin bot commands: extend the dispatch in `handle_update()` and the `HELP_ADMIN`
  message. Keep them admin-only (`is_admin` guard already there).
- Modal-style forms reuse `#lead-modal` DOM (single overlay). Different content gets
  injected via `modalInner.innerHTML = ...`. Always re-bind submit listener after re-render.
- Mobile-only viewport — always design at ~375px width first. The owner tests on iPhone.
- Tweet-sized commit subjects, descriptive bodies. Owner reviews via the repo, so messages
  should explain what + why.
