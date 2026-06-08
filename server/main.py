"""
Saudia Service — Mini App backend.

Responsibilities:
- Serve editable content (visa prices, etc.) via GET /api/content so the
  Mini App can render fresh data on every load.
- Accept lead submissions from the in-app modal via POST /api/lead,
  verify the Telegram WebApp initData HMAC, then forward to the admin chat.
- Run a Telegram long-poll listener in the background so the admin can
  edit visa prices / toggle visas with chat commands (no SSH needed).
"""

import asyncio
import hashlib
import hmac
import json
import logging
import os
import shutil
import tempfile
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qsl

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_CHAT_IDS = {s.strip() for s in os.environ["ADMIN_CHAT_ID"].split(",") if s.strip()}
ALLOWED_ORIGINS = [s.strip() for s in os.environ.get("ALLOWED_ORIGINS", "https://zay1d.github.io").split(",") if s.strip()]
RATE_LIMIT_SECONDS = int(os.environ.get("RATE_LIMIT_SECONDS", "30"))

BASE_DIR = Path(__file__).resolve().parent.parent
CONTENT_PATH = BASE_DIR / "content.json"
CONTENT_DEFAULT_PATH = BASE_DIR / "server" / "content.default.json"

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("saudia")


# ====================  content.json helpers  ====================

_content_lock = asyncio.Lock()


def _ensure_content_file() -> None:
    """Create content.json from the default template on first run."""
    if not CONTENT_PATH.exists():
        if not CONTENT_DEFAULT_PATH.exists():
            raise FileNotFoundError(f"missing {CONTENT_DEFAULT_PATH}")
        shutil.copy2(CONTENT_DEFAULT_PATH, CONTENT_PATH)
        log.info("seeded %s from defaults", CONTENT_PATH)


def _read_content() -> dict:
    with CONTENT_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _write_content_atomic(content: dict) -> None:
    """Write JSON atomically: temp file in same dir + rename."""
    dir_ = str(CONTENT_PATH.parent)
    fd, tmp = tempfile.mkstemp(dir=dir_, prefix=".content.", suffix=".json.tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(content, f, ensure_ascii=False, indent=2)
        os.replace(tmp, CONTENT_PATH)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


async def load_content() -> dict:
    async with _content_lock:
        return _read_content()


async def update_content(mutator) -> dict:
    """
    Atomically read content, pass to mutator(content) for in-place edit,
    then save. Returns the new content.
    """
    async with _content_lock:
        content = _read_content()
        mutator(content)
        _write_content_atomic(content)
        return content


# ====================  tracks.json (privacy-respecting usage stats)  ====================

TRACKS_PATH = BASE_DIR / "tracks.json"
_tracks_lock = asyncio.Lock()
_TRACK_RETENTION_DAYS = 180
_VALID_TRACK_CATEGORIES = {"umra", "visa", "hotels", "transfer", "contact"}


def _read_tracks() -> dict:
    if not TRACKS_PATH.exists():
        return {"users": [], "contacts": 0, "daily": {}}
    try:
        with TRACKS_PATH.open(encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {"users": [], "contacts": 0, "daily": {}}


def _write_tracks_atomic(data: dict) -> None:
    dir_ = str(TRACKS_PATH.parent)
    fd, tmp = tempfile.mkstemp(dir=dir_, prefix=".tracks.", suffix=".json.tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, TRACKS_PATH)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


async def load_tracks() -> dict:
    async with _tracks_lock:
        return _read_tracks()


async def update_tracks(mutator) -> None:
    async with _tracks_lock:
        tracks = _read_tracks()
        mutator(tracks)
        _write_tracks_atomic(tracks)


# ====================  Telegram initData verification  ====================

def verify_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    """
    Validates the initData string that Telegram WebApp passes us.
    Returns the parsed dict on success, None on failure.
    See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True, keep_blank_values=True))
    except ValueError:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    try:
        auth_date = int(parsed.get("auth_date", "0"))
    except ValueError:
        return None
    if auth_date == 0 or (time.time() - auth_date) > 86400:
        return None

    data_check_string = "\n".join(f"{k}={parsed[k]}" for k in sorted(parsed))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        return None
    return parsed


# ====================  Telegram send helpers  ====================

API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"


async def tg_send_message(
    chat_id: str | int,
    text: str,
    *,
    parse_mode: str = "HTML",
    reply_markup: Optional[dict] = None,
) -> dict:
    body: dict[str, Any] = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True,
    }
    if reply_markup is not None:
        body["reply_markup"] = reply_markup
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{API_BASE}/sendMessage", json=body)
        if r.status_code != 200:
            log.warning("sendMessage failed: %s %s", r.status_code, r.text[:200])
        return r.json()


async def tg_send_photo(
    chat_id: str | int, file_id: str, caption: str,
    *, reply_markup: Optional[dict] = None,
) -> dict:
    body: dict[str, Any] = {
        "chat_id": chat_id,
        "photo": file_id,
        "caption": caption,
        "parse_mode": "HTML",
    }
    if reply_markup is not None:
        body["reply_markup"] = reply_markup
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{API_BASE}/sendPhoto", json=body)
        if r.status_code != 200:
            log.warning("sendPhoto failed: %s %s", r.status_code, r.text[:200])
        return r.json()


async def tg_send_document(
    chat_id: str | int, file_id: str, caption: str,
    *, reply_markup: Optional[dict] = None,
) -> dict:
    body: dict[str, Any] = {
        "chat_id": chat_id,
        "document": file_id,
        "caption": caption,
        "parse_mode": "HTML",
    }
    if reply_markup is not None:
        body["reply_markup"] = reply_markup
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(f"{API_BASE}/sendDocument", json=body)
        if r.status_code != 200:
            log.warning("sendDocument failed: %s %s", r.status_code, r.text[:200])
        return r.json()


async def send_to_admins(text: str, *, reply_markup: Optional[dict] = None) -> None:
    for chat_id in ADMIN_CHAT_IDS:
        await tg_send_message(chat_id, text, reply_markup=reply_markup)


def _user_chat_markup(user_id: int | str) -> dict:
    """Inline keyboard with one button that lets the admin open a private
    chat with the form-submitter.

    `tg://user?id=N` is not accepted in InlineKeyboardButton.url (Telegram
    rejects the message with BUTTON_URL_INVALID), so we use a callback_data
    button. When the admin taps it, `_handle_chat_callback` replies in the
    admin's own chat with an inline `<a href="tg://user?id=N">…</a>` link,
    which IS allowed in HTML message bodies and opens the chat in clients
    that can resolve the user.
    """
    return {
        "inline_keyboard": [[
            {"text": "💬 Foydalanuvchi bilan suhbat", "callback_data": f"chat:{user_id}"}
        ]]
    }


async def tg_answer_callback_query(callback_query_id: str, text: str = "") -> None:
    body: dict[str, Any] = {"callback_query_id": callback_query_id}
    if text:
        body["text"] = text
        body["show_alert"] = False
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(f"{API_BASE}/answerCallbackQuery", json=body)
    except Exception:
        log.exception("answerCallbackQuery failed")


async def forward_visa_application(state: dict, user: dict, file_id: str, kind: str) -> None:
    """Send the captured passport to every admin chat with a structured caption."""
    handle = (
        f"@{user['username']}" if user.get("username")
        else (f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "—")
    )
    caption_lines = [
        "🛂 <b>Yangi viza arizasi</b>",
        "",
        f"<b>Viza:</b> {_h(state['visa_title'])}"
        + (f" (${state['visa_price']})" if state.get("visa_price") else ""),
        f"<b>Ism:</b> {_h(state['name'])}",
        f"<b>Telegram:</b> {_h(handle)} <code>(id: {user.get('id')})</code>",
    ]
    caption = "\n".join(caption_lines)
    markup = _user_chat_markup(user.get("id")) if user.get("id") else None
    for admin_id in ADMIN_CHAT_IDS:
        if kind == "photo":
            await tg_send_photo(admin_id, file_id, caption, reply_markup=markup)
        else:
            await tg_send_document(admin_id, file_id, caption, reply_markup=markup)


# ====================  Bot identity (auto-fetched)  ====================

BOT_USERNAME: str = os.environ.get("BOT_USERNAME", "").strip()


async def fetch_bot_identity() -> None:
    """Look up our own username via getMe so the Mini App can build deep links."""
    global BOT_USERNAME
    if BOT_USERNAME:
        log.info("bot username (from env): @%s", BOT_USERNAME)
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{API_BASE}/getMe")
            data = r.json()
            if data.get("ok"):
                uname = data["result"].get("username", "")
                if uname:
                    BOT_USERNAME = uname
                    log.info("bot username (from getMe): @%s", BOT_USERNAME)
    except Exception:
        log.exception("getMe failed")


# ====================  Lead form  ====================

class LeadIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    question: str = Field(default="", max_length=2000)
    package_id: str = Field(default="", max_length=50)
    package_title: str = Field(default="", max_length=100)
    init_data: str = Field(..., max_length=4000)


_last_seen: dict[str, float] = {}


def _rate_limited(user_key: str) -> bool:
    now = time.time()
    if now - _last_seen.get(user_key, 0) < RATE_LIMIT_SECONDS:
        return True
    _last_seen[user_key] = now
    return False


def _h(s: str) -> str:
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# ====================  Bot command handling  ====================

HELP_ADMIN = (
    "👋 <b>Admin paneli</b>\n\n"
    "<b>Buyruqlar:</b>\n"
    "• <code>/prices</code> — barcha vizalar ro‘yxati\n"
    "• <code>/setprice &lt;viza_id&gt; &lt;narx&gt;</code> — narxni o‘zgartirish\n"
    "  masalan: <code>/setprice umra 200</code>\n"
    "• <code>/toggle &lt;viza_id&gt;</code> — vizani yashirish / ko‘rsatish\n"
    "• <code>/stats</code> — foydalanish statistikasi\n"
    "• <code>/broadcast</code> — hamma foydalanuvchilarga xabar yuborish\n"
    "• <code>/help</code> — shu xabar\n\n"
    "<b>Viza ID lari:</b>\n"
    "• <code>umra</code>\n"
    "• <code>tourist_multi</code>\n"
    "• <code>tourist_single</code>\n"
    "• <code>business</code>\n"
)

WELCOME_USER = (
    "Assalomu alaykum! 👋\n\n"
    "Saudia Service botiga xush kelibsiz.\n"
    "Bizning xizmatlarimiz bilan tanishish uchun pastdagi "
    "<b>Mini App</b> tugmasini bosing."
)


async def _cmd_prices() -> str:
    content = await load_content()
    visas = content.get("visas", [])
    lines = ["📋 <b>Joriy narxlar</b>", ""]
    for v in visas:
        status = "✅" if v.get("active", True) else "⛔️"
        lines.append(
            f"{status} <code>{v['id']}</code> · {_h(v['title'])} → "
            f"<b>${v.get('price', '—')}</b>"
        )
    return "\n".join(lines)


async def _cmd_setprice(args: list[str]) -> str:
    if len(args) != 2:
        return "❌ Format: <code>/setprice &lt;viza_id&gt; &lt;narx&gt;</code>"
    visa_id, price_str = args
    try:
        price = int(price_str)
        if price < 0:
            raise ValueError
    except ValueError:
        return "❌ Narx musbat butun son bo‘lishi kerak"

    found = False

    def mutate(content):
        nonlocal found
        for v in content.get("visas", []):
            if v["id"] == visa_id:
                v["price"] = price
                found = True
                v["_last_updated"] = int(time.time())
                break

    new_content = await update_content(mutate)
    if not found:
        return f"❌ Viza topilmadi: <code>{_h(visa_id)}</code>"

    v = next(v for v in new_content["visas"] if v["id"] == visa_id)
    return f"✓ <b>{_h(v['title'])}</b> → <b>${price}</b>"


async def _cmd_stats() -> str:
    tracks = await load_tracks()
    daily = tracks.get("daily", {})
    today = time.strftime("%Y-%m-%d", time.gmtime())
    today_data = daily.get(today, {})

    def aggregate(days: int):
        cutoff = time.strftime("%Y-%m-%d", time.gmtime(time.time() - days * 86400))
        users_set: set[str] = set()
        opens = 0
        for d, info in daily.items():
            if d >= cutoff:
                users_set.update(info.get("users", []))
                opens += info.get("opens", 0)
        return len(users_set), opens

    u7, o7 = aggregate(7)
    u30, o30 = aggregate(30)

    cats = today_data.get("categories", {})
    cats_str = ", ".join(f"{k} {v}" for k, v in sorted(cats.items(), key=lambda x: -x[1]))

    locs = today_data.get("locations", {})
    top_locs = sorted(locs.items(), key=lambda x: -x[1])[:5]

    lines = [
        "📊 <b>Saudia Service · Statistika</b>",
        "",
        f"<b>Jami foydalanuvchilar:</b> {len(tracks.get('users', []))}",
        f"<b>Jami buyurtmalar:</b> {tracks.get('contacts', 0)}",
        "",
        f"<b>Bugun ({today}):</b>",
        f"  · Foydalanuvchilar: {len(today_data.get('users', []))}",
        f"  · Ochildi: {today_data.get('opens', 0)}",
    ]
    if cats_str:
        lines.append(f"  · Kategoriyalar: {_h(cats_str)}")
    if today_data.get("contacts", 0) > 0:
        lines.append(f"  · Aloqalar: {today_data['contacts']} ariza")
    if top_locs:
        lines.append("  · TOP havolalar:")
        for i, (url, n) in enumerate(top_locs, 1):
            lines.append(f"    {i}. {_h(url)} — {n} ta")
    lines.append("")
    lines.append(f"<b>Oxirgi 7 kun:</b>  {u7} foydalanuvchi, {o7} ochilish")
    lines.append(f"<b>Oxirgi 30 kun:</b> {u30} foydalanuvchi, {o30} ochilish")

    return "\n".join(lines)


async def _cmd_toggle(args: list[str]) -> str:
    if len(args) != 1:
        return "❌ Format: <code>/toggle &lt;viza_id&gt;</code>"
    visa_id = args[0]

    found = {"id": None, "active": None, "title": None}

    def mutate(content):
        for v in content.get("visas", []):
            if v["id"] == visa_id:
                v["active"] = not v.get("active", True)
                found["id"] = v["id"]
                found["active"] = v["active"]
                found["title"] = v["title"]
                break

    await update_content(mutate)
    if found["id"] is None:
        return f"❌ Viza topilmadi: <code>{_h(visa_id)}</code>"
    state = "ko‘rsatildi ✅" if found["active"] else "yashirildi ⛔️"
    return f"<b>{_h(found['title'])}</b> {state}"


# ====================  Admin broadcast flow (per-admin state machine) =====

# Set when an admin types /broadcast — next message they send is forwarded
# to every known user via copyMessage. In-memory; lost on restart, fine.
_admin_flow: dict[int, dict] = {}


async def _copy_message(
    client: httpx.AsyncClient, target_chat_id: str, from_chat_id: int, message_id: int
) -> dict:
    r = await client.post(f"{API_BASE}/copyMessage", json={
        "chat_id": target_chat_id,
        "from_chat_id": from_chat_id,
        "message_id": message_id,
    })
    return r.json()


async def _broadcast_message(admin_chat_id: int, source_msg: dict) -> dict:
    """Copy the admin's message to every known user. Returns counts."""
    tracks = await load_tracks()
    user_ids = [u for u in tracks.get("users", []) if u and u != str(admin_chat_id)]
    sent = 0
    blocked = 0
    failed = 0
    source_message_id = source_msg["message_id"]

    async with httpx.AsyncClient(timeout=15) as client:
        for uid in user_ids:
            try:
                data = await _copy_message(client, uid, admin_chat_id, source_message_id)
                if data.get("ok"):
                    sent += 1
                else:
                    code = data.get("error_code", 0)
                    desc = (data.get("description") or "").lower()
                    if code == 403 or "blocked" in desc or "not found" in desc or "deactivated" in desc:
                        blocked += 1
                    else:
                        failed += 1
                        log.warning("broadcast to %s failed: %s", uid, desc[:140])
            except Exception:
                failed += 1
                log.exception("broadcast send crashed")
            # ~25/sec to stay safely under Telegram's per-bot send limits.
            await asyncio.sleep(0.04)

    return {"sent": sent, "blocked": blocked, "failed": failed, "total": len(user_ids)}


# ====================  Visa purchase flow (per-user state machine) ====================

# In-memory map of chat_id -> conversation state.
# Lost on service restart; that's fine — short-lived conversations.
_visa_flow: dict[int, dict] = {}
_FLOW_TTL = 30 * 60  # 30 minutes


def _gc_flow() -> None:
    now = time.time()
    expired = [k for k, v in _visa_flow.items() if now - v.get("started_at", 0) > _FLOW_TTL]
    for k in expired:
        _visa_flow.pop(k, None)


async def _start_visa_flow(chat_id: int, visa_id: str) -> bool:
    content = await load_content()
    visa = next(
        (v for v in content.get("visas", []) if v["id"] == visa_id and v.get("active", True)),
        None,
    )
    if not visa:
        return False
    _visa_flow[chat_id] = {
        "step": "awaiting_name",
        "visa_id": visa_id,
        "visa_title": visa["title"],
        "visa_price": visa.get("price"),
        "started_at": time.time(),
    }
    await tg_send_message(
        chat_id,
        f"<b>{_h(visa['title'])}</b> uchun ariza ochildi.\n\n"
        f"Davom etish uchun <b>ism va familiyangizni</b> yuboring.\n"
        f"<i>Masalan: Ali Karimov</i>\n\n"
        f"Bekor qilish uchun /cancel",
    )
    return True


async def _handle_user_message(chat_id: int, msg: dict, user: dict) -> None:
    """Non-admin: visa purchase flow only. Everything else gets a hint."""
    text = (msg.get("text") or "").strip()
    photo = msg.get("photo")          # list of PhotoSize, largest at the end
    document = msg.get("document")    # if user sent a file rather than a photo

    # /start with optional deep-link payload (visa_<id>)
    if text.startswith("/start"):
        parts = text.split(maxsplit=1)
        if len(parts) == 2:
            payload = parts[1].strip()
            if payload.startswith("visa_"):
                visa_id = payload[len("visa_"):]
                ok = await _start_visa_flow(chat_id, visa_id)
                if not ok:
                    await tg_send_message(chat_id,
                        "Bu viza hozir mavjud emas. "
                        "Iltimos, Mini App orqali boshqa viza tanlang.")
                return
        # plain /start
        await tg_send_message(chat_id, WELCOME_USER)
        return

    if text == "/cancel":
        if _visa_flow.pop(chat_id, None):
            await tg_send_message(chat_id, "Ariza bekor qilindi. Yangi ariza uchun Mini App orqali viza tanlang.")
        else:
            await tg_send_message(chat_id, "Bekor qiladigan ariza yo‘q.")
        return

    _gc_flow()
    state = _visa_flow.get(chat_id)
    if not state:
        # No active flow → polite nudge back to Mini App.
        await tg_send_message(chat_id,
            "Viza arizasini boshlash uchun Mini App orqali viza tanlang va "
            "<b>Xarid qilish</b> tugmasini bosing.")
        return

    if state["step"] == "awaiting_name":
        if not text:
            await tg_send_message(chat_id,
                "Iltimos, ism va familiyangizni <b>matn ko‘rinishida</b> yuboring.")
            return
        if len(text) < 2 or len(text) > 200:
            await tg_send_message(chat_id, "Ism juda qisqa yoki juda uzun. Qayta yuboring.")
            return
        state["name"] = text
        state["step"] = "awaiting_passport"
        await tg_send_message(chat_id,
            f"Rahmat, <b>{_h(text)}</b>.\n\n"
            f"Endi <b>pasportingizning asosiy sahifa rasmini</b> yuboring 📷\n"
            f"<i>(rasm yoki fayl shaklida)</i>")
        return

    if state["step"] == "awaiting_passport":
        if photo:
            file_id = photo[-1]["file_id"]  # largest size
            await forward_visa_application(state, user, file_id, kind="photo")
        elif document:
            file_id = document["file_id"]
            await forward_visa_application(state, user, file_id, kind="document")
        else:
            await tg_send_message(chat_id,
                "Pasport <b>rasmini</b> yuboring 📷\n"
                "<i>(yoki fayl sifatida — ikkalasi ham bo‘ladi)</i>")
            return

        _visa_flow.pop(chat_id, None)
        await tg_send_message(chat_id,
            "✓ Sizning so‘rovingiz qabul qilindi.\n\n"
            "Menejer 24 soat ichida siz bilan bog‘lanadi, "
            "<i>inshaAllah</i>.")
        return


async def _handle_callback_query(cq: dict) -> None:
    """Admin taps an inline button under a notification — currently only the
    "open a chat with the form-submitter" action. Replies in the admin's chat
    with a tg:// deep-link the admin can tap."""
    cq_id = cq.get("id") or ""
    from_user = cq.get("from", {})
    admin_chat_id = from_user.get("id")
    data = (cq.get("data") or "").strip()

    if admin_chat_id is None or str(admin_chat_id) not in ADMIN_CHAT_IDS:
        await tg_answer_callback_query(cq_id, "Ruxsat yo‘q")
        return

    if data.startswith("chat:"):
        raw_id = data[len("chat:"):]
        try:
            target_id = int(raw_id)
        except ValueError:
            await tg_answer_callback_query(cq_id, "Noto‘g‘ri ma’lumot")
            return
        # Inline tg:// links in HTML message body work better than in
        # button URLs (button URLs are whitelisted, message HTML is not).
        await tg_send_message(
            admin_chat_id,
            f"👤 <a href=\"tg://user?id={target_id}\">Foydalanuvchi bilan suhbat ochish</a>\n"
            f"<code>id: {target_id}</code>",
        )
        await tg_answer_callback_query(cq_id)
        return

    # Unknown callback — clear the spinner silently.
    await tg_answer_callback_query(cq_id)


async def handle_update(update: dict) -> None:
    cq = update.get("callback_query")
    if cq:
        await _handle_callback_query(cq)
        return

    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return
    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    user = msg.get("from", {})
    if chat_id is None:
        return

    text = (msg.get("text") or "").strip()
    is_admin = str(chat_id) in ADMIN_CHAT_IDS

    # Non-admin: only the visa purchase flow.
    if not is_admin:
        await _handle_user_message(chat_id, msg, user)
        return

    # Admin is mid-broadcast? capture their next message as the payload.
    if chat_id in _admin_flow:
        await _handle_admin_flow(chat_id, msg)
        return

    # Admin only handles commands; everything else is silently ignored.
    if not text:
        return

    parts = text.split()
    cmd = parts[0].lower().split("@", 1)[0]  # strip @botname
    args = parts[1:]

    if cmd in ("/help", "/start"):
        reply = HELP_ADMIN
    elif cmd == "/prices":
        reply = await _cmd_prices()
    elif cmd == "/setprice":
        reply = await _cmd_setprice(args)
    elif cmd == "/toggle":
        reply = await _cmd_toggle(args)
    elif cmd == "/stats":
        reply = await _cmd_stats()
    elif cmd == "/broadcast":
        _admin_flow[chat_id] = {"step": "awaiting_broadcast"}
        reply = (
            "📢 <b>Hammaga yuborish</b>\n\n"
            "Hozir yuboradigan xabarni qaytaring — matn, rasm, fayl, video; "
            "istalgan turdagi xabar qabul qilinadi.\n\n"
            "Bekor qilish uchun /cancel"
        )
    else:
        return  # silently ignore unknown admin chatter

    await tg_send_message(chat_id, reply)


async def _handle_admin_flow(chat_id: int, msg: dict) -> None:
    """Admin is in a multi-step state (currently only broadcast)."""
    state = _admin_flow.get(chat_id)
    if not state:
        return
    text = (msg.get("text") or "").strip()

    if state.get("step") == "awaiting_broadcast":
        if text == "/cancel":
            _admin_flow.pop(chat_id, None)
            await tg_send_message(chat_id, "Bekor qilindi.")
            return
        if text.startswith("/"):
            await tg_send_message(
                chat_id,
                "Bu buyruq. Yuborish uchun oddiy xabar qaytaring "
                "(matn / rasm / fayl). Bekor qilish — /cancel",
            )
            return
        # Anything else is the broadcast payload.
        _admin_flow.pop(chat_id, None)
        await tg_send_message(chat_id, "Yuborilmoqda... bu biroz vaqt oladi.")
        result = await _broadcast_message(chat_id, msg)
        await tg_send_message(
            chat_id,
            "📢 <b>Yuborish yakunlandi</b>\n\n"
            f"✅ Yuborildi: <b>{result['sent']}</b>\n"
            f"⛔️ Bloklagan: <b>{result['blocked']}</b>\n"
            f"❌ Xatolik: <b>{result['failed']}</b>\n"
            f"Jami foydalanuvchilar: <b>{result['total']}</b>",
        )


# ====================  Bot long-polling loop  ====================

async def poll_telegram_updates(stop_event: asyncio.Event) -> None:
    offset = 0
    backoff = 1.0
    log.info("bot polling started")
    async with httpx.AsyncClient(timeout=35) as client:
        while not stop_event.is_set():
            try:
                r = await client.get(
                    f"{API_BASE}/getUpdates",
                    params={
                        "offset": offset,
                        "timeout": 25,
                        "allowed_updates": json.dumps(["message", "edited_message", "callback_query"]),
                    },
                )
                data = r.json()
                if not data.get("ok"):
                    log.warning("getUpdates not ok: %s", data)
                    await asyncio.sleep(min(backoff, 30))
                    backoff = min(backoff * 2, 30)
                    continue
                backoff = 1.0
                for upd in data.get("result", []):
                    offset = upd["update_id"] + 1
                    try:
                        await handle_update(upd)
                    except Exception:
                        log.exception("handle_update crashed")
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("polling error")
                await asyncio.sleep(min(backoff, 30))
                backoff = min(backoff * 2, 30)
    log.info("bot polling stopped")


# ====================  FastAPI app  ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    _ensure_content_file()
    asyncio.create_task(fetch_bot_identity())
    stop_event = asyncio.Event()
    task = asyncio.create_task(poll_telegram_updates(stop_event))
    try:
        yield
    finally:
        stop_event.set()
        task.cancel()
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass


app = FastAPI(title="Saudia Service API", version="2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"ok": True, "admins": len(ADMIN_CHAT_IDS)}


def _strip_internal(row: dict) -> dict:
    return {k: v for k, v in row.items() if not k.startswith("_")}


@app.get("/api/content")
async def get_content():
    content = await load_content()
    visas = [_strip_internal(r) for r in content.get("visas", []) if r.get("active", True)]
    transfers = [_strip_internal(r) for r in content.get("transfers", []) if r.get("active", True)]
    return JSONResponse(
        {
            "visas": visas,
            "transfers": transfers,
            "bot": {"username": BOT_USERNAME or ""},
        },
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


class TransferOrderIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=6, max_length=30)
    tariff_id: str = Field(default="", max_length=50)
    tariff_title: str = Field(default="", max_length=120)
    from_city: str = Field(..., min_length=1, max_length=60)
    to_city: str = Field(..., min_length=1, max_length=60)
    date: str = Field(..., min_length=8, max_length=20)
    booking_type: str = Field(default="individual", pattern="^(individual|group)$")
    group_size: int = Field(default=0, ge=0, le=500)
    organization: str = Field(default="", max_length=120)
    comment: str = Field(default="", max_length=1000)
    init_data: str = Field(..., max_length=4000)


class TrackIn(BaseModel):
    event: str = Field(..., pattern="^(open|category|location|contact)$")
    data: str = Field(default="", max_length=300)
    init_data: str = Field(..., max_length=4000)


class HotelOrderIn(BaseModel):
    hotel_name: str = Field(..., min_length=1, max_length=120)
    phone: str = Field(..., min_length=6, max_length=30)
    city: str = Field(..., min_length=1, max_length=30)
    check_in: str = Field(..., min_length=8, max_length=20)
    check_out: str = Field(..., min_length=8, max_length=20)
    room_type: str = Field(default="", max_length=20)
    rooms: int = Field(default=1, ge=1, le=100)
    meal: str = Field(default="", max_length=40)
    comment: str = Field(default="", max_length=1000)
    init_data: str = Field(..., max_length=4000)


@app.post("/api/order-transfer")
async def submit_transfer_order(order: TransferOrderIn):
    parsed = verify_init_data(order.init_data, BOT_TOKEN)
    if parsed is None:
        log.info("transfer rejected: invalid initData")
        raise HTTPException(status_code=403, detail="invalid initData")

    try:
        user = json.loads(parsed.get("user", "{}"))
    except json.JSONDecodeError:
        user = {}

    tg_id = user.get("id")
    if tg_id is None:
        raise HTTPException(status_code=400, detail="user not found in initData")

    if _rate_limited(str(tg_id)):
        raise HTTPException(status_code=429, detail="Iltimos, biroz kuting va qayta urinib ko‘ring")

    handle = (
        f"@{user['username']}" if user.get("username")
        else (f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "—")
    )

    if order.from_city.strip().lower() == order.to_city.strip().lower():
        raise HTTPException(status_code=400, detail="Yo‘nalish noto‘g‘ri")

    is_group = order.booking_type == "group"
    if is_group and order.group_size < 2:
        raise HTTPException(status_code=400, detail="Guruh kamida 2 kishi bo‘lishi kerak")

    badge = "GURUH" if is_group else "INDIVIDUAL"
    lines = [
        f"🚐 <b>Yangi transfer buyurtmasi · {badge}</b>",
        "",
    ]

    if is_group:
        if order.organization.strip():
            lines.append(f"<b>Tashkilot:</b> {_h(order.organization.strip())}")
        lines.append(f"<b>Kishilar soni:</b> {order.group_size}")
        lines.append("")

    lines.extend([
        f"<b>Tarif:</b> {_h(order.tariff_title or order.tariff_id)}",
        f"<b>Yo‘nalish:</b> {_h(order.from_city)} → {_h(order.to_city)}",
        f"<b>Sana:</b> {_h(order.date)}",
        "",
        f"<b>Ism:</b> {_h(order.name.strip())}",
        f"<b>Telefon:</b> {_h(order.phone.strip())}",
        f"<b>Telegram:</b> {_h(handle)} <code>(id: {tg_id})</code>",
    ])

    if order.comment.strip():
        lines += ["", "<b>Izoh:</b>", _h(order.comment.strip())]

    try:
        await send_to_admins("\n".join(lines), reply_markup=_user_chat_markup(tg_id))
    except httpx.HTTPError as e:
        log.exception("Telegram API error")
        raise HTTPException(status_code=502, detail="Telegram'ga jo‘natishda xatolik") from e

    return {"ok": True}


@app.post("/api/order-hotel")
async def submit_hotel_order(order: HotelOrderIn):
    parsed = verify_init_data(order.init_data, BOT_TOKEN)
    if parsed is None:
        log.info("hotel rejected: invalid initData")
        raise HTTPException(status_code=403, detail="invalid initData")

    try:
        user = json.loads(parsed.get("user", "{}"))
    except json.JSONDecodeError:
        user = {}

    tg_id = user.get("id")
    if tg_id is None:
        raise HTTPException(status_code=400, detail="user not found in initData")

    if _rate_limited(str(tg_id)):
        raise HTTPException(status_code=429, detail="Iltimos, biroz kuting va qayta urinib ko‘ring")

    handle = (
        f"@{user['username']}" if user.get("username")
        else (f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "—")
    )

    city_norm = order.city.strip().lower()
    if city_norm not in ("makka", "madina"):
        raise HTTPException(status_code=400, detail="Shahar noto‘g‘ri")
    city_title = "Makka" if city_norm == "makka" else "Madina"

    lines = [
        "🏨 <b>Yangi mexmonxona buyurtmasi</b>",
        "",
        f"<b>Mexmonxona:</b> {_h(order.hotel_name.strip())}",
        f"<b>Shahar:</b> {_h(city_title)}",
        f"<b>Sana:</b> {_h(order.check_in)} → {_h(order.check_out)}",
    ]

    if order.room_type.strip():
        lines.append(f"<b>Xona turi:</b> {_h(order.room_type.strip())}")
    lines.append(f"<b>Xonalar soni:</b> {order.rooms}")
    if order.meal.strip():
        lines.append(f"<b>Ovqatlanish:</b> {_h(order.meal.strip())}")

    lines += [
        "",
        f"<b>Telefon:</b> {_h(order.phone.strip())}",
        f"<b>Telegram:</b> {_h(handle)} <code>(id: {tg_id})</code>",
    ]

    if order.comment.strip():
        lines += ["", "<b>Izoh:</b>", _h(order.comment.strip())]

    try:
        await send_to_admins("\n".join(lines), reply_markup=_user_chat_markup(tg_id))
    except httpx.HTTPError as e:
        log.exception("Telegram API error")
        raise HTTPException(status_code=502, detail="Telegram'ga jo‘natishda xatolik") from e

    return {"ok": True}


@app.post("/api/track")
async def submit_track(t: TrackIn):
    """
    Privacy-respecting usage tracking. Aggregates by day only — no timestamps,
    no IPs, no user-agents. Admins (ADMIN_CHAT_IDS) are silently excluded so
    their own testing doesn't skew the numbers.
    """
    parsed = verify_init_data(t.init_data, BOT_TOKEN)
    if parsed is None:
        return {"ok": True}  # never reveal validation state on a metrics endpoint
    try:
        user = json.loads(parsed.get("user", "{}"))
    except json.JSONDecodeError:
        return {"ok": True}
    tg_id = user.get("id")
    if tg_id is None:
        return {"ok": True}
    if str(tg_id) in ADMIN_CHAT_IDS:
        return {"ok": True}

    today = time.strftime("%Y-%m-%d", time.gmtime())
    user_key = str(tg_id)
    event = t.event
    data = t.data.strip()

    def mutate(tracks):
        tracks.setdefault("users", [])
        tracks.setdefault("contacts", 0)
        tracks.setdefault("daily", {})

        if user_key not in tracks["users"]:
            tracks["users"].append(user_key)

        day = tracks["daily"].setdefault(today, {})
        day.setdefault("users", [])
        day.setdefault("opens", 0)
        day.setdefault("categories", {})
        day.setdefault("locations", {})
        day.setdefault("contacts", 0)

        if user_key not in day["users"]:
            day["users"].append(user_key)

        if event == "open":
            day["opens"] = day.get("opens", 0) + 1
        elif event == "category" and data in _VALID_TRACK_CATEGORIES:
            day["categories"][data] = day["categories"].get(data, 0) + 1
        elif event == "location" and data:
            day["locations"][data] = day["locations"].get(data, 0) + 1
        elif event == "contact":
            tracks["contacts"] = tracks.get("contacts", 0) + 1
            day["contacts"] = day.get("contacts", 0) + 1

        # 180-day retention on the daily breakdown; running totals stay intact.
        cutoff = time.strftime("%Y-%m-%d", time.gmtime(time.time() - _TRACK_RETENTION_DAYS * 86400))
        for k in [k for k in tracks["daily"] if k < cutoff]:
            del tracks["daily"][k]

    try:
        await update_tracks(mutate)
    except Exception:
        log.exception("track write failed")
    return {"ok": True}


@app.post("/api/lead")
async def submit_lead(lead: LeadIn):
    parsed = verify_init_data(lead.init_data, BOT_TOKEN)
    if parsed is None:
        log.info("rejected: invalid initData")
        raise HTTPException(status_code=403, detail="invalid initData")

    try:
        user = json.loads(parsed.get("user", "{}"))
    except json.JSONDecodeError:
        user = {}

    tg_id = user.get("id")
    if tg_id is None:
        raise HTTPException(status_code=400, detail="user not found in initData")

    if _rate_limited(str(tg_id)):
        raise HTTPException(status_code=429, detail="Iltimos, biroz kuting va qayta urinib ko‘ring")

    handle = (
        f"@{user['username']}" if user.get("username")
        else (f"{user.get('first_name', '')} {user.get('last_name', '')}".strip() or "—")
    )

    safe_name = (lead.name or "").strip()
    safe_question = (lead.question or "").strip()
    safe_pkg = (lead.package_title or "").strip()

    lines = [
        "🕋 <b>Yangi Umra paket so‘rovi</b>",
        "",
        f"<b>Ism:</b> {_h(safe_name)}",
    ]
    if safe_pkg:
        lines.append(f"<b>Paket:</b> {_h(safe_pkg)}")
    lines.append(f"<b>Telegram:</b> {_h(handle)} <code>(id: {tg_id})</code>")
    if safe_question:
        lines += ["", "<b>Savol:</b>", _h(safe_question)]

    try:
        await send_to_admins("\n".join(lines), reply_markup=_user_chat_markup(tg_id))
    except httpx.HTTPError as e:
        log.exception("Telegram API error")
        raise HTTPException(status_code=502, detail="Telegram'ga jo‘natishda xatolik") from e

    return {"ok": True}
