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
| DNS | A `@` → `62.169.26.149`, A `www` → `62.169.26.149` (Porkbun) |
| VPS | Contabo, IP `62.169.26.149`, Ubuntu 24.04, root user, key-only SSH. (Original box `167.86.125.229` was destroyed in Sep 2026 and the app redeployed from scratch.) |
| SSH | `ssh root@62.169.26.149` |
| App dir | `/opt/saudia-service/` (mirrors repo root) |
| Repo | https://github.com/zay1d/saudiya-service — **public**, owner `zay1d` |
| Active branch | `claude/telegram-mini-app-U5ytG` (everything lands here, no merge to main yet) |
| Frontend | vanilla HTML/CSS/JS at repo root, served by Nginx directly |
| Backend | FastAPI (`server/main.py`) on `127.0.0.1:8000`, behind Nginx `/api/*` |
| Process mgr | systemd unit `saudia-bot` running as **`saudia` (unprivileged)** with `ProtectSystem=strict` / `ProtectHome` / `PrivateTmp` / `NoNewPrivileges`. Logs to `/var/log/saudia-bot.log`. `.env` is `640 root:saudia` so `load_dotenv` can read it at boot. |
| TLS | Let's Encrypt for `saudihizmat.fyi` + `www.saudihizmat.fyi`, auto-renew via `certbot.timer` |
| Env file | `/opt/saudia-service/.env` (chmod 600, **gitignored**, never put in repo) |
| Content store | `/opt/saudia-service/content.json` (live visa/transfer data, **gitignored**) — seeded from `server/content.default.json` on first boot |
| Usage stats   | `/opt/saudia-service/tracks.json` (daily-aggregate counts, **gitignored**) — auto-created on first event |
| Telegram bot | **migrating** from old saudia bot (token `8897203944…`, leaked in chat) to `@Saudiaservice_bot`. After migration: rotate the old one via `/revoke` |
| Admin chat | configured in `.env` as `ADMIN_CHAT_ID` (comma-separated for multiple admins). Owner's chat id: `6136579036` |
| Bot polling | long-polling started in FastAPI `lifespan`, not webhook |
| Mini App surfaces | Main Mini App (`t.me/<bot>/app`) + menu button + profile button. Code calls `requestFullscreen()` (Bot API 8.0+) so all three render full-screen |

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
                    ├── POST /api/order-hotel    (hotel booking: name + dates + room + meal)
                    ├── POST /api/track          (usage event: open/category/location/contact)
                    └── background task: Telegram long-poll loop
                            ├── admin commands (/prices, /setprice, /toggle, /stats, /help)
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
│                            CONTACT_LABEL, CONTACTS (Aloqa cards), HOTEL_SEGMENTS,
│                            HOTELS_FALLBACK (Makka + Madina lists), API_URL (auto-origin)
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
│                            — may be stale after recent commits; rebuild via build.py
├── design-brief.md         design brief for handing the project to a design AI
├── CLAUDE.md               this file
├── handoff.md              session-to-session handoff (latest state + open items)
├── .gitignore              .env, content.json, .venv, *.pyc, logo-*.png, *.docx
└── server/
    ├── main.py             FastAPI + Telegram long-poll + admin commands + visa flow
    ├── requirements.txt    fastapi, uvicorn[standard], httpx, pydantic, python-dotenv
    ├── content.default.json defaults for visas + transfers
    ├── nginx.conf          production nginx site config (apex + www + redirects)
    ├── saudia-bot.service  systemd unit
    ├── install.sh          fresh-server bootstrap: packages, venv, `saudia`
    │                        service account, systemd unit, nginx, Let's Encrypt
    │                        cert for apex + www. `bash server/install.sh [domain]`
    ├── update.sh           `git pull && pip install -r + restart`
    ├── migrate-domain.sh   legacy one-time nip.io → real domain migration
    ├── .env.example        template
    └── README.md           deploy walkthrough
```

After cloning, on a fresh VPS (see `server/README.md` for the full runbook):
0. Point the Porkbun A records (`@` and `www`) at the new IP first — Certbot
   validates over HTTP and will fail while DNS still holds the old address.
1. `cp server/.env.example .env`, fill `BOT_TOKEN` and `ADMIN_CHAT_ID`
2. `bash server/install.sh` — defaults to `saudihizmat.fyi`, pass another
   domain as the first argument to override.

Nothing outside git survives a rebuild: `.env`, `content.json` (admin's price
edits revert to `content.default.json`), `tracks.json` (stats reset to zero)
and the TLS certs are all recreated from scratch.

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
- Centered: `left: 50%, top: 50%`
- `width: 500px` with `max-width: 92vw` cap
- `opacity: 0.22`, `filter: saturate(0.85) brightness(1.2) blur(0.5px)`
- History: started at 280px, was shrunk multiple times because the wordmark in
  the PNG bleeds past the viewport at low max-width caps. Currently sits at
  92vw which fills nicely on iPhone without spilling.

**Icon style:** flat gold line icons, `stroke-width: 1.1`, defined inline as `<symbol id="i-...">`
in `index.html`. Each visa/transfer references its icon by id via `VISA_ICONS` / `TRANSFER_ICONS`
maps in `data.js` — **icons are owned by the frontend**, never read from `content.json`,
so an admin price update via the bot can't accidentally change a card's design.

Icon naming:
- `i-*`        — general line icons (mosque, plane, hotel, bus, train, bag, kaaba, phone,
                 telegram, instagram, broadcast, etc.)
- `h-*`        — large home-row icons (kaaba, passport, hotel, transport, chat)
- `n-*`        — small bottom-tab icons (home, pkg, visa, hotel, transfer, chat)
- `s-*`        — never used in prod (status bar icons, only in the design mockup)

**Telegram fullscreen + safe-area:**
- `app.js` calls `tg.requestFullscreen()` (Bot API 8.0+) so the in-chat menu
  button also opens full-screen, not just the Main Mini App entry.
- `--tg-top` CSS var = `safeAreaInset.top + contentSafeAreaInset.top`. Applied
  as `padding-top` on `#content`, so the topbar/brand sit below the notch
  and Telegram's overlaid close/menu controls.
- Bottom: `#content` padding-bottom = `calc(108px + env(safe-area-inset-bottom))`
  so the home indicator + bottom-nav don't clip the last row.

**Body text sizing:**
- Descriptive small text (subtitles, feature descriptions, package/visa/transfer/
  hotel card subs) is **13px** — was 11.5/12px, bumped for readability.
- UPPERCASE micro-labels (tiers, eyebrows, section labels, crumbs) stay
  9–10.5px with 0.28–0.36em tracking — stylistic, do NOT bump.

---

## 5. App structure (5 categories)

Bottom tab bar has 5 entries; tapping one opens that category with the same nav style as
the home menu. Back button always goes one level up (detail → list → home).

| # | id | Title | Status |
|---|----|-------|--------|
| I | `umra` | Umra paketlari | **complete** — 4 packages with detail screens + lead form |
| II | `visa` | Vizalar | **complete** — 4 tariffs, detail screens, purchase via bot |
| III | `hotels` | Mexmonxonalar | **complete** — VIP/Comfort/Standart/Ekonom sections per city, booking form. Hotel photos + map still pending per original brief |
| IV | `transfer` | Transferlar | **complete** — 3 cards + order modal with Individual/Group tabs |
| V | `contact` | Biz bilan bog'laning | **complete** — phone, Telegram, B2B/news channel, Instagram cards |

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

### III. Mexmonxonalar — hardcoded in `data.js`, no API yet

Three-step navigation: root → city → sectioned list.

**Root** (`viewHotelsRoot`): two big `.choice-card` buttons:
- `Mexmonxonalar ro'yxati` → city picker
- `Xarid qilish` → booking modal (via the `Buyurtma berish` CTA in `viewHotelsPurchase`)

**City picker** (`viewHotelsCities`): two big buttons — `MAKKA` / `MADINA`.

**Per-city list** (`viewHotelsList(city)`): renders each segment as a section
with a framed `.hotel-frame` list of `.hotel-row` items separated by hairlines.
A segment can be either a hotel list or a "contact" prompt (Ekonom).

Data lives in `HOTELS_FALLBACK` + `HOTEL_SEGMENTS` in `data.js`. Each segment id:
`vip`, `comfort`, `standart`, `ekonom`. Ekonom has `contact: true` + a `note` →
renders the "biz bilan bog'laning" prompt instead of a list, in both cities.

`HOTEL_SEGMENTS` is now **per-city**: `{ makka: [...], madina: [...] }`. Makka
is split into 4 tiered sections; Madina is rendered as a single unlabeled flat
list (segment id `list`, no `label`) plus the Ekonom contact prompt. A segment
without a `label` skips its section heading in `viewHotelsList`.

Current populated lists (client's words verbatim, possible typos preserved):
- **Makka** — VIP 14, Comfort 11, Standart 11, Ekonom = contact prompt
- **Madina** — 16 hotels as a single unlabeled list (no tier split), Ekonom
  = contact prompt. The client asked to keep Madina flat.

**Booking form** (`openHotelOrderModal` / `renderHotelOrderForm`) — fields in the order
agreed with the client:
1. `Telefon raqam` (UZ mask `+998 __ ___ __ __`)
2. `Shahar` (Makka / Madina)
3. `Mexmonxona nomi` (free text — placeholder "Swiss Al Maqom yoki boshqa")
4. `Sana` — two-column Kirish / Chiqish (`kk/oo/yyyy` mask + validation, check-out > check-in)
5. `Xona turi` (DBL / TRPL / QDRPL)
6. `Xonalar soni` (numeric, default 1)
7. `Ovqat turi` (BB — Nonushta / HB — Nonushta + kechki ovqat)
8. `Qo'shimcha izoh` (optional)

POST to `/api/order-hotel`. Admin gets:
```
🏨 Yangi mexmonxona buyurtmasi

Mexmonxona: Swiss Al Maqom
Shahar: Makka
Sana: 12/04/2026 → 19/04/2026
Xona turi: DBL
Xonalar soni: 3
Ovqatlanish: BB (Nonushta)

Telefon: +998 90 123 45 67
Telegram: @ali (id: …)

Izoh: …
```

**Still missing per the original brief:** hotel detail screens with photos and
locations ("bosilganda mexmonxona nomi, lakatsiyasi va rasmlar chiqishi kerak").
Currently each row is a flat name only. Adding hotel detail = new tap target on
`.hotel-row` + a `viewHotelDetail` view + photo asset pipeline + maybe Google
Maps embed.

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

### V. Aloqa — `viewContact()` with `CONTACTS` cards in `data.js`

Driven by the `CONTACTS` array in `data.js`. Each entry has `{kind, label,
value, href, icon, primary}`. Primary entries render first as larger cards;
the rest sit under a `BOSHQA KANALLAR` section label.

Current entries:
- Primary: phone `+966 50 390 1777`, Telegram `@saudia_servicer`
- Extras: B2B kanal `t.me/saudiaservicer`, Makka xabarlari channel, Instagram

Tap on the phone card runs `tapPhone(num)` — copies the number to clipboard
(with a toast `Raqam nusxalandi: …`) AND tries `window.location.href = tel:…`
as a soft fallback. The reason for the copy fallback: Telegram WebView blocks
`tel:` links on most clients, so a tap with only `href="tel:"` does nothing.

`CONTACT_URL` constant in `data.js` is also updated to the manager's TG
(`https://t.me/saudia_servicer`) — it's the default CTA target on every
category screen ("Biz bilan bog'laning" buttons).

Owner credit on home screen: `Ishlab chiqdi: @zayd_usamah` link (small,
dimmed, opens `t.me/zayd_usamah`).

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
- `/stats` → usage statistics (today, last 7 days, last 30 days, totals)
- `/broadcast` → send a message to every known user. Two-step: admin sends
  `/broadcast`, then sends the actual message (text, photo, file, video,
  anything) which the bot copies to all chat_ids in `tracks.json` via
  `copyMessage`. Throttled to ~25/sec; admin gets a final report
  (`sent` / `blocked` / `failed` / `total`). /cancel exits the flow before
  the payload is sent. Admins themselves are excluded from the recipient list.

Visa ids: `umra`, `tourist_multi`, `tourist_single`, `business`.

**Frontend-owned design** (icons, layout) cannot be changed via bot. Admin only edits
content — prices, active flag. Future: same pattern for transfers, hotel list, etc.

### Usage stats (privacy-respecting)

`tracks.json` lives on the VPS next to `content.json` (gitignored, atomic
writes under `asyncio.Lock`). No timestamps, no IPs, no user-agents — only
day-level aggregates. Admins (`ADMIN_CHAT_IDS`) are filtered out server-side
on every `/api/track` call so their own testing doesn't skew the numbers.

Shape:
```json
{
  "users": ["<tg_id>", ...],          // all-time unique users
  "contacts": 32,                     // all-time successful submissions
  "daily": {
    "2026-06-03": {
      "users": ["<tg_id>", ...],
      "opens": 41,
      "categories": {"umra": 14, ...},
      "locations": {"https://t.me/...": 5, ...},
      "contacts": 3
    },
    ...
  }
}
```

Retention: last 180 days of `daily`. Lifetime `users` and `contacts` totals
are never pruned.

Events emitted by the frontend (`track()` in `app.js`):
- `open` — once per app launch, fired after `fetchContent()`
- `category` — on tap of a home menu row or bottom-tab
- `location` — on tap of a contact card (Aloqa) or a "Biz bilan bog'laning" CTA
- `contact` — on successful POST of `/api/lead`, `/api/order-transfer`, `/api/order-hotel`

---

## 7. Deployment runbook

### After a `git push`

```bash
ssh root@62.169.26.149 'bash /opt/saudia-service/server/update.sh'
```

The script does: `git pull`, `pip install -r server/requirements.txt`, `systemctl restart saudia-bot`,
prints "OK — saudia-bot running" on success.

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

11. **Menu button ≠ Main Mini App.** Telegram has two separate "surfaces":
    - **Main Mini App** (profile button + `t.me/<bot>/app` link) — the BotFather
      "Mini App full-screen" toggle applies here.
    - **In-chat menu button** (left of the input field) — the toggle does NOT
      apply. Without `requestFullscreen()` in code it opens as a half-height
      panel. Owner kept reporting "opens as half-site for me, fullscreen for
      others" — the fix was the JS-side `tg.requestFullscreen()` call.

12. **Don't paste secrets into chat.** Owner already shared the old bot token
    (`8897203944…`) and root VPS password in early sessions. They've been
    documented for rotation. When migrating bots / changing tokens, always
    instruct edits on the VPS (`nano /opt/saudia-service/.env`), never paste
    the secret into chat.

13. **When changing a bot in BotFather, the user's own Telegram caches the
    menu button config.** A fresh menu-button URL may not show up for a few
    minutes / until Telegram is fully closed and reopened. Don't debug
    "menu button broken" before checking other accounts / cold-restarting TG.

14. **`tel:` links are blocked in Telegram WebView.** Phone taps must fall
    back to clipboard-copy + toast. See `tapPhone()` in `app.js`.

---

## 9. Codewords the owner uses

The owner triggers big features by typing codewords (so we don't accidentally implement
expensive flows mid-conversation):

- `страницадлясвязи1` — start the lead form + backend (✅ done)
- `визыпаспорт1`     — start the visa purchase bot dialog with passport upload (✅ done)
- `вкладкигруппа1`   — add Individual/Guruh tabs to the transfer order form (✅ done)
- `статистика1`      — privacy-respecting usage stats + `/stats` admin command (✅ done)

When a new big flow is proposed, suggest a codeword and don't implement until used.

---

## 10. What's next (open work)

**Immediate / high-priority**

- **Finish bot migration to `@Saudiaservice_bot`** — owner created the new bot,
  set up Main Mini App via `/newapp` (URL `https://saudihizmat.fyi`), and set
  the menu button. Still pending on the owner side: stop any old code that
  polls the new bot's token (avoid 409), update `BOT_TOKEN` in `/opt/saudia-service/.env`,
  run `deleteWebhook?drop_pending_updates=true`, restart `saudia-bot`, press `/start`
  on the new bot so the admin chat is unblocked, then `/revoke` the leaked old token
  (`8897203944…`) in BotFather.
- **VPS root password rotation** — still pending; was shared in chat. Move
  to key-only SSH (`PasswordAuthentication no`) when rotating.
- **Security audit** — owner installed the `secure-coding-trio` skill in
  `~/.claude/skills/`. In the next fresh session ask for a full audit using
  the Security-reviewer role (see `handoff.md` § "Security audit pending").

**Per category**

- **Hotels — detail screens with photos + location.** The original brief asked
  for "bosilganda mexmonxona nomi, lakatsiyasi va rasmlar chiqishi kerak".
  Currently each `.hotel-row` is just a name. Need: tap target → `viewHotelDetail`
  with image gallery + Google Maps embed / coords + short description. Photo
  asset pipeline (local in `assets/hotels/<city>/<id>/`).
- **Madina hotel categorization review.** Client sent the Madina list without
  tier assignment; segmentation is my guess. Get client to confirm or move
  hotels between VIP/Comfort/Standart.
- **Spelling normalization for hotel/visa brand names.** Many entries have
  client typos preserved verbatim (Fermont → Fairmont, Adress → Address,
  Mowenpick → Mövenpick, Marriot → Marriott, etc.). Per past-mistake #1 we
  don't invent, but typos in real brand names look unprofessional on a
  premium app. Confirm with client first, then fix.
- **Aloqa map embed / address / hours** — optional; current cards cover the
  essentials.

**Nice to have**

- **Auto-deploy** via a GitHub webhook → VPS endpoint, so the owner doesn't
  need to SSH for every change. Not started, not asked yet.
- **GitHub Action / cron for cert renewal sanity check** — certbot timer
  works but verifying via logs on the first renewal cycle would be nice.
- **Rebuild `saudia-service.html` bundle.** It's been stale since the recent
  hotels/contact/fullscreen work. Run `python3 build.py` and commit when needed.

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
