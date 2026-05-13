"""
Saudia Service — lead-forwarding API.

The Mini App's "Biz bilan bog'laning" modal POSTs to /api/lead with the
visitor's name, an optional question, the package they're interested in,
and the raw Telegram WebApp initData string.

We verify initData against the bot token (so nobody can fake leads),
extract the Telegram user object, and forward a formatted notification
to the admin chat(s).
"""

import hashlib
import hmac
import json
import logging
import os
import time
from typing import Optional
from urllib.parse import parse_qsl

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

BOT_TOKEN = os.environ["BOT_TOKEN"]
ADMIN_CHAT_IDS = [s.strip() for s in os.environ["ADMIN_CHAT_ID"].split(",") if s.strip()]
ALLOWED_ORIGINS = [s.strip() for s in os.environ.get("ALLOWED_ORIGINS", "https://zay1d.github.io").split(",") if s.strip()]
RATE_LIMIT_SECONDS = int(os.environ.get("RATE_LIMIT_SECONDS", "30"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("saudia")

app = FastAPI(title="Saudia Service Lead API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# ---------- Telegram initData verification ----------

def verify_init_data(init_data: str, bot_token: str) -> Optional[dict]:
    """
    Validates the initData string Telegram WebApp passes to us.
    Returns the parsed dict on success, None otherwise.

    See https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True, keep_blank_values=True))
    except ValueError:
        return None

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None

    # auth_date must be recent (24h window mirrors Telegram's recommendation)
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


# ---------- request / rate-limit ----------

class LeadIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    question: str = Field(default="", max_length=2000)
    package_id: str = Field(default="", max_length=50)
    package_title: str = Field(default="", max_length=100)
    init_data: str = Field(..., max_length=4000)


_last_seen: dict[str, float] = {}

def _rate_limited(user_key: str) -> bool:
    now = time.time()
    last = _last_seen.get(user_key, 0)
    if now - last < RATE_LIMIT_SECONDS:
        return True
    _last_seen[user_key] = now
    return False


# ---------- Telegram send ----------

async def send_to_admins(text: str) -> None:
    api = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient(timeout=10) as client:
        for chat_id in ADMIN_CHAT_IDS:
            r = await client.post(api, json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            })
            if r.status_code != 200:
                log.warning("Telegram sendMessage to %s failed: %s %s", chat_id, r.status_code, r.text[:200])


# ---------- routes ----------

@app.get("/api/health")
async def health():
    return {"ok": True, "admins": len(ADMIN_CHAT_IDS)}


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
        raise HTTPException(status_code=429, detail="Iltimos, biroz kuting va qayta urinib ko'ring")

    tg_username = user.get("username") or ""
    tg_first = user.get("first_name") or ""
    tg_last = user.get("last_name") or ""
    handle = f"@{tg_username}" if tg_username else (f"{tg_first} {tg_last}".strip() or "—")

    safe_name = (lead.name or "").strip()
    safe_question = (lead.question or "").strip()
    safe_pkg = (lead.package_title or "").strip()

    def h(s: str) -> str:
        return (s.replace("&", "&amp;")
                 .replace("<", "&lt;")
                 .replace(">", "&gt;"))

    lines = [
        "🔔 <b>Yangi so'rov · Mini App</b>",
        "",
        f"<b>Ism:</b> {h(safe_name)}",
    ]
    if safe_pkg:
        lines.append(f"<b>Paket:</b> {h(safe_pkg)}")
    lines.append(f"<b>Telegram:</b> {h(handle)} <code>(id: {tg_id})</code>")
    if safe_question:
        lines += ["", "<b>Savol:</b>", h(safe_question)]

    text = "\n".join(lines)

    try:
        await send_to_admins(text)
    except httpx.HTTPError as e:
        log.exception("Telegram API error")
        raise HTTPException(status_code=502, detail="Telegram'ga jo'natishda xatolik") from e

    return {"ok": True}
