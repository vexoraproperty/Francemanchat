import os
import hmac
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
from starlette.concurrency import run_in_threadpool

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

try:
    from backend.clerk_auth import require_user, verify_session_token
except ModuleNotFoundError:
    from clerk_auth import require_user, verify_session_token

client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]

ROLES = ["admin", "agent", "pending"]
DEFAULT_ROLE = "pending"
STAFF_ROLES = ("admin", "agent")
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = "live" if os.environ.get("CLERK_PUBLISHABLE_KEY", "").startswith("pk_live_") else "preview"
IN_ENV = {"env": {"$in": [ENV, None]}}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


def _clerk_user(user_id: str) -> dict:
    r = requests.get(f"https://api.clerk.com/v1/users/{user_id}", timeout=10,
                     headers={"Authorization": f"Bearer {os.environ['CLERK_SECRET_KEY']}", "User-Agent": "emergent-app"})
    r.raise_for_status()
    return r.json()


def _profile_from_clerk(data: dict) -> dict:
    admins = {e.strip().lower() for e in os.environ.get("ADMIN_EMAIL", "").split(",") if e.strip()}
    emails = data.get("email_addresses") or []
    primary = next((e for e in emails if e.get("id") == data.get("primary_email_address_id")), emails[0] if emails else {})
    name = " ".join(x for x in [data.get("first_name"), data.get("last_name")] if x) or (primary.get("email_address", "").split("@")[0])
    is_admin = any(e["email_address"].lower() in admins and (e.get("verification") or {}).get("status") == "verified" for e in emails)
    return {"email": primary.get("email_address", ""), "name": name, "image_url": data.get("image_url", ""), "is_admin": is_admin}


async def load_member(uid: str) -> dict:
    member = await db.users.find_one({"user_id": uid}, {"_id": 0})
    if member is None or not member.get("role"):
        profile = _profile_from_clerk(await run_in_threadpool(_clerk_user, uid))
        role = "admin" if profile["is_admin"] else DEFAULT_ROLE
        info = {"email": profile["email"], "name": profile["name"], "image_url": profile["image_url"]}
        await db.users.update_one({"user_id": uid, "role": {"$in": [None, ""]}}, {"$set": {"role": role, **info}})
        member = await db.users.find_one_and_update(
            {"user_id": uid},
            {"$setOnInsert": {"user_id": uid, "role": role, "status": "online", "created_at": now_iso(), **info}},
            upsert=True, projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    return {**member, "env": ENV, "role": effective_role(member["role"])}


async def current_member(user: dict = Depends(require_user)) -> dict:
    return await load_member(user["user_id"])


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


require_staff = require_role(*STAFF_ROLES)
require_admin = require_role("admin")

_VISITOR_SECRET = os.environ["JWT_SECRET_VISITOR"].encode()


def sign_visitor(visitor_id: str) -> str:
    sig = hmac.new(_VISITOR_SECRET, visitor_id.encode(), hashlib.sha256).hexdigest()
    return f"{visitor_id}.{sig}"


def verify_visitor_token(token: str) -> str:
    vid, _, sig = (token or "").partition(".")
    expected = hmac.new(_VISITOR_SECRET, vid.encode(), hashlib.sha256).hexdigest()
    if not vid or not hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=401, detail="Invalid visitor session")
    return vid


DEFAULT_SETTINGS = {
    "id": "global",
    "welcome_message": "Welcome to Franceman Exportation LLP. Tell us the product, destination port and volume you need, and our export desk will help you.",
    "offline_message": "Our team is currently offline. Leave your message and email here, and we will reply within one business day.",
    "keyword_answers_enabled": True,
    "ai_enabled": True,
    "tawk_fallback_enabled": False,
    "quick_answers": [
        {"id": "qa-sample", "label": "Request a sample", "keywords": ["sample", "samples", "trial"],
         "answer": "We ship 500g to 2kg samples via DHL Express within 48 hours of confirmation. Each sample comes with a lab certificate and origin record. You can also request one at https://francemann.com/sample-request."},
        {"id": "qa-moq", "label": "Minimum order quantities", "keywords": ["moq", "minimum", "order size"],
         "answer": "Minimum orders: Kola Nut 500 kg, Bitter Kola 300 kg, Ginger 1,000 kg, Turmeric 1,000 kg, Hibiscus 1,000 kg, Sesame 5,000 kg, Raw Cashew Nuts 5,000 kg. We ship in jute or PP bags, or full 20ft / 40ft containers."},
        {"id": "qa-incoterms", "label": "Shipping terms (FOB / CIF)", "keywords": ["fob", "cif", "incoterm", "incoterms", "shipping"],
         "answer": "We ship FOB Apapa or CIF to your destination port. CFR is available on request. Export documents (NEPC, Phyto, CoA, BL) are emailed within 24 hours of loading."},
        {"id": "qa-payment", "label": "Payment terms", "keywords": ["payment", "pay", "lc", "letter of credit"],
         "answer": "Our standard terms are 30% TT advance and 70% against scanned BL. LC is accepted from rated banks."},
        {"id": "qa-docs", "label": "Certificates & documents", "keywords": ["certificate", "certification", "nepc", "phyto", "phytosanitary", "iso", "haccp"],
         "answer": "We provide NEPC export registration, HACCP, ISO 22000, EU phytosanitary, NAFDAC compliance and FDA documentation. See https://francemann.com/quality-standards."},
    ],
}


async def get_settings() -> dict:
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        await db.settings.update_one({"id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True)
        doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    return doc
