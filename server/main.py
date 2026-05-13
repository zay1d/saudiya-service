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


# ====================  Telegram send helper  ====================

API_BASE = f"https://api.telegram.org/bot{BOT_TOKEN}"


async def tg_send_message(chat_id: str | int, text: str, *, parse_mode: str = "HTML") -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{API_BASE}/sendMessage", json={
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_web_page_preview": True,
        })
        if r.status_code != 200:
            log.warning("sendMessage failed: %s %s", r.status_code, r.text[:200])
        return r.json()


async def send_to_admins(text: str) -> None:
    for chat_id in ADMIN_CHAT_IDS:
        await tg_send_message(chat_id, text)


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


async def handle_update(update: dict) -> None:
    msg = update.get("message") or update.get("edited_message")
    if not msg:
        return
    chat = msg.get("chat", {})
    chat_id = chat.get("id")
    text = (msg.get("text") or "").strip()
    if chat_id is None or not text:
        return

    is_admin = str(chat_id) in ADMIN_CHAT_IDS

    # Non-admin: a friendly /start, ignore the rest for now.
    if not is_admin:
        if text.startswith("/start"):
            await tg_send_message(chat_id, WELCOME_USER)
        return

    # ---- admin commands ----
    parts = text.split()
    cmd = parts[0].lower().split("@", 1)[0]  # strip "@botname"
    args = parts[1:]

    if cmd in ("/help", "/start"):
        reply = HELP_ADMIN
    elif cmd == "/prices":
        reply = await _cmd_prices()
    elif cmd == "/setprice":
        reply = await _cmd_setprice(args)
    elif cmd == "/toggle":
        reply = await _cmd_toggle(args)
    else:
        return  # silently ignore unknown admin chatter

    await tg_send_message(chat_id, reply)


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
                        "allowed_updates": json.dumps(["message", "edited_message"]),
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


@app.get("/api/content")
async def get_content():
    content = await load_content()
    # Hide internal/admin fields from the public payload.
    visas = [
        {k: v for k, v in row.items() if not k.startswith("_") and row.get("active", True)}
        for row in content.get("visas", [])
        if row.get("active", True)
    ]
    return JSONResponse(
        {"visas": visas},
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


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
        "🔔 <b>Yangi so‘rov · Mini App</b>",
        "",
        f"<b>Ism:</b> {_h(safe_name)}",
    ]
    if safe_pkg:
        lines.append(f"<b>Paket:</b> {_h(safe_pkg)}")
    lines.append(f"<b>Telegram:</b> {_h(handle)} <code>(id: {tg_id})</code>")
    if safe_question:
        lines += ["", "<b>Savol:</b>", _h(safe_question)]

    try:
        await send_to_admins("\n".join(lines))
    except httpx.HTTPError as e:
        log.exception("Telegram API error")
        raise HTTPException(status_code=502, detail="Telegram'ga jo‘natishda xatolik") from e

    return {"ok": True}
