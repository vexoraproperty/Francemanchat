import asyncio
import json
import logging
import os
import ipaddress
from pathlib import Path
from contextlib import suppress
from datetime import datetime, timedelta, timezone
from typing import Optional

import requests
from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field, field_validator
from pymongo import ASCENDING, DESCENDING, IndexModel
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

from core import (DEFAULT_SETTINGS, IN_ENV, RANK, RETIRED_ROLES, ROLES, STAFF_ROLES, client, current_member, db,
                  effective_role, get_settings, load_member, new_id, now_iso, require_admin, require_staff,
                  sign_visitor, verify_session_token, verify_visitor_token)
from realtime import hub
from automation import ai_reply, match_keyword

try:
    from backend.clerk_auth import clerk_router
except ModuleNotFoundError:
    from clerk_auth import clerk_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [IndexModel([("user_id", ASCENDING)], name="user_id", unique=True)],
    "visitors": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("last_seen", DESCENDING)], name="last_seen_desc")],
    "conversations": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                      IndexModel([("visitor_id", ASCENDING), ("status", ASCENDING)], name="visitor_status"),
                      IndexModel([("last_message_at", DESCENDING)], name="last_msg_desc")],
    "messages": [IndexModel([("conversation_id", ASCENDING), ("created_at", ASCENDING)], name="conv_created")],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI()
api = APIRouter(prefix="/api")

BOT_NAME = "Franceman Assistant"
P0 = {"_id": 0}


# ---------- helpers ----------
def client_ip(request: Request) -> str:
    fwd = request.headers.get("x-forwarded-for", "")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "")


def _geo_lookup(ip: str) -> dict:
    try:
        if not ip or ipaddress.ip_address(ip).is_private:
            return {}
        r = requests.get(f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,city,regionName,timezone", timeout=4)
        d = r.json()
        if d.get("status") != "success":
            return {}
        return {"country": d.get("country", ""), "country_code": d.get("countryCode", ""), "city": d.get("city", ""),
                "region": d.get("regionName", ""), "timezone": d.get("timezone", "")}
    except Exception:
        return {}


def _parse_device(ua: str) -> str:
    ua_l = ua.lower()
    os_name = next((n for k, n in [("iphone", "iOS"), ("ipad", "iPadOS"), ("android", "Android"), ("windows", "Windows"),
                                   ("mac os", "macOS"), ("linux", "Linux")] if k in ua_l), "Unknown OS")
    browser = next((n for k, n in [("edg/", "Edge"), ("opr/", "Opera"), ("chrome/", "Chrome"), ("firefox/", "Firefox"),
                                   ("safari/", "Safari")] if k in ua_l), "Browser")
    return f"{browser} on {os_name}"


def visitor_public(v: dict) -> dict:
    return {**{k: v.get(k) for k in ("id", "name", "email", "country", "country_code", "city", "region", "timezone",
                                      "current_page", "page_title", "referrer", "device", "pages_viewed", "page_history",
                                      "created_at", "last_seen", "identified", "commodity")},
            "online": hub.visitor_online(v["id"]), "typing": hub.typing.get(v["id"], "")}


async def visitors_by_id(ids) -> dict:
    docs = await db.visitors.find({"id": {"$in": list(set(ids))}}, P0).to_list(1000)
    return {d["id"]: visitor_public(d) for d in docs}


async def conv_with_visitor(conv: dict) -> dict:
    v = await db.visitors.find_one({"id": conv["visitor_id"]}, P0)
    return {**conv, "visitor": visitor_public(v) if v else None}


async def insert_message(conv: dict, sender_type: str, text: str, sender_name: str = "", sender_id: str = "", kind: str = "") -> dict:
    msg = {"id": new_id(), "conversation_id": conv["id"], "visitor_id": conv["visitor_id"], "sender_type": sender_type,
           "sender_name": sender_name, "sender_id": sender_id, "kind": kind, "text": text, "created_at": now_iso()}
    await db.messages.insert_one(dict(msg))
    update = {"$set": {"last_message": text[:160], "last_message_at": msg["created_at"], "last_sender": sender_type}}
    if sender_type == "visitor":
        update["$inc"] = {"unread_agent": 1, "visitor_messages": 1}
    await db.conversations.update_one({"id": conv["id"]}, update)
    fresh = await db.conversations.find_one({"id": conv["id"]}, P0)
    await hub.to_visitor(conv["visitor_id"], {"type": "message", "message": msg})
    await hub.to_agents({"type": "message", "message": msg, "conversation": await conv_with_visitor(fresh)})
    return msg


async def open_conversation(visitor_id: str) -> Optional[dict]:
    return await db.conversations.find_one({"visitor_id": visitor_id, "status": "open"}, P0, sort=[("created_at", -1)])


async def create_conversation(visitor: dict) -> dict:
    conv = {"id": new_id(), "visitor_id": visitor["id"], "status": "open", "assigned_agent_id": None,
            "assigned_agent_name": None, "created_at": now_iso(), "last_message": "", "last_message_at": now_iso(),
            "last_sender": None, "unread_agent": 0, "visitor_messages": 0, "agent_replied": False,
            "first_response_at": None, "closed_at": None, "offline_notified": False}
    await db.conversations.insert_one(dict(conv))
    settings = await get_settings()
    if settings.get("welcome_message"):
        await insert_message(conv, "bot", settings["welcome_message"], BOT_NAME, kind="welcome")
    return await db.conversations.find_one({"id": conv["id"]}, P0)


async def conv_messages(conv_id: str) -> list:
    return await db.messages.find({"conversation_id": conv_id}, P0).sort("created_at", 1).to_list(2000)


async def run_automation(conv_id: str):
    try:
        conv = await db.conversations.find_one({"id": conv_id}, P0)
        if not conv or conv["status"] != "open":
            return
        if conv.get("assigned_agent_id") and conv["assigned_agent_id"] in hub.online_agent_ids():
            return
        settings = await get_settings()
        if hub.agents_online() == 0 and not conv.get("offline_notified") and settings.get("offline_message"):
            await db.conversations.update_one({"id": conv_id}, {"$set": {"offline_notified": True}})
            await insert_message(conv, "bot", settings["offline_message"], BOT_NAME, kind="offline")
        history = await conv_messages(conv_id)
        last_text = next((m["text"] for m in reversed(history) if m["sender_type"] == "visitor"), "")
        if settings.get("keyword_answers_enabled"):
            qa = match_keyword(last_text, settings.get("quick_answers", []))
            if qa:
                await insert_message(conv, "bot", qa["answer"], BOT_NAME, kind="keyword")
                return
        if settings.get("ai_enabled") and not conv.get("agent_replied"):
            await hub.to_visitor(conv["visitor_id"], {"type": "agent_typing", "typing": True, "name": BOT_NAME})
            try:
                reply = await ai_reply(conv_id, history)
            finally:
                await hub.to_visitor(conv["visitor_id"], {"type": "agent_typing", "typing": False, "name": BOT_NAME})
            fresh = await db.conversations.find_one({"id": conv_id}, P0)
            if reply and fresh and not fresh.get("agent_replied"):
                await insert_message(conv, "bot", reply, BOT_NAME, kind="ai")
    except Exception as exc:
        logger.error("automation failed for %s: %s", conv_id, exc)


async def visitor_from_header(x_visitor_token: str = Header(...)) -> dict:
    vid = verify_visitor_token(x_visitor_token)
    v = await db.visitors.find_one({"id": vid}, P0)
    if not v:
        raise HTTPException(status_code=401, detail="Visitor session not found")
    return v


async def widget_config_payload() -> dict:
    s = await get_settings()
    online = hub.agents_online()
    return {"welcome_message": s.get("welcome_message", ""), "offline_message": s.get("offline_message", ""),
            "quick_answers": [{"id": q["id"], "label": q["label"]} for q in s.get("quick_answers", [])],
            "agents_online": online,
            "tawk_site_id": os.environ.get("TAWK_SITE_ID") if s.get("tawk_fallback_enabled") and online == 0 else None}


# ---------- widget (public, visitor-token) ----------
class SessionIn(BaseModel):
    token: Optional[str] = None
    url: str = ""
    title: str = ""
    referrer: str = ""


class IdentifyIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    commodity: str = Field(default="", max_length=120)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name is required")
        return v.strip()


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


@api.get("/embed.js")
async def embed_js():
    return FileResponse(Path(__file__).parent / "static" / "embed.js", media_type="application/javascript",
                        headers={"Cross-Origin-Resource-Policy": "cross-origin", "Cache-Control": "public, max-age=300"})


@api.get("/widget/config")
async def widget_config():
    return await widget_config_payload()


@api.post("/widget/session")
async def widget_session(body: SessionIn, request: Request):
    visitor = None
    if body.token:
        with suppress(HTTPException):
            vid = verify_visitor_token(body.token)
            visitor = await db.visitors.find_one({"id": vid}, P0)
    if not visitor:
        count = await db.visitors.count_documents({})
        geo = await run_in_threadpool(_geo_lookup, client_ip(request))
        visitor = {"id": new_id(), "name": f"Visitor {1001 + count}", "email": "", "identified": False,
                   "ip": client_ip(request), "device": _parse_device(request.headers.get("user-agent", "")),
                   "referrer": body.referrer[:500], "current_page": body.url[:500], "page_title": body.title[:200],
                   "pages_viewed": 0, "page_history": [], "created_at": now_iso(), "last_seen": now_iso(),
                   "country": "", "country_code": "", "city": "", "region": "", "timezone": "", **geo}
        await db.visitors.insert_one(dict(visitor))
    conv = await open_conversation(visitor["id"])
    return {"token": sign_visitor(visitor["id"]), "visitor": visitor_public(visitor),
            "conversation": conv, "messages": await conv_messages(conv["id"]) if conv else [],
            "config": await widget_config_payload()}


@api.post("/widget/identify")
async def widget_identify(body: IdentifyIn, visitor: dict = Depends(visitor_from_header)):
    await db.visitors.update_one({"id": visitor["id"]}, {"$set": {
        "name": body.name.strip(), "email": body.email.lower(), "commodity": body.commodity.strip(), "identified": True}})
    visitor = await db.visitors.find_one({"id": visitor["id"]}, P0)
    conv = await open_conversation(visitor["id"]) or await create_conversation(visitor)
    await hub.to_agents({"type": "visitor_update", "visitor": visitor_public(visitor)})
    return {"visitor": visitor_public(visitor), "conversation": conv, "messages": await conv_messages(conv["id"])}


@api.get("/widget/messages")
async def widget_messages(visitor: dict = Depends(visitor_from_header)):
    conv = await open_conversation(visitor["id"])
    return {"conversation": conv, "messages": await conv_messages(conv["id"]) if conv else []}


@api.post("/widget/messages")
async def widget_send(body: TextIn, visitor: dict = Depends(visitor_from_header)):
    if not visitor.get("identified"):
        raise HTTPException(status_code=400, detail="Please share your name and email first")
    conv = await open_conversation(visitor["id"]) or await create_conversation(visitor)
    hub.typing.pop(visitor["id"], None)
    msg = await insert_message(conv, "visitor", body.text.strip(), visitor["name"], visitor["id"])
    asyncio.create_task(run_automation(conv["id"]))
    return {"message": msg, "conversation_id": conv["id"]}


@api.post("/widget/end")
async def widget_end(visitor: dict = Depends(visitor_from_header)):
    conv = await open_conversation(visitor["id"])
    if conv:
        await close_conversation(conv, "Chat ended by visitor")
    return {"ok": True}


async def close_conversation(conv: dict, note: str):
    await db.conversations.update_one({"id": conv["id"]}, {"$set": {"status": "closed", "closed_at": now_iso()}})
    await insert_message(conv, "system", note, kind="closed")


# ---------- websockets ----------
@app.websocket("/api/ws/visitor")
async def ws_visitor(ws: WebSocket, token: str = Query(...)):
    try:
        vid = verify_visitor_token(token)
    except HTTPException:
        await ws.close(code=4401)
        return
    if not await db.visitors.find_one({"id": vid}, {"_id": 1}):
        await ws.close(code=4404)
        return
    await ws.accept()
    hub.visitors[vid].add(ws)
    await db.visitors.update_one({"id": vid}, {"$set": {"last_seen": now_iso()}})
    await push_visitor(vid)
    await ws.send_text(json.dumps({"type": "presence", "agents_online": hub.agents_online()}))
    try:
        while True:
            data = json.loads(await ws.receive_text())
            kind = data.get("type")
            if kind == "page":
                url, title = str(data.get("url", ""))[:500], str(data.get("title", ""))[:200]
                await db.visitors.update_one({"id": vid}, {
                    "$set": {"current_page": url, "page_title": title, "last_seen": now_iso()},
                    "$inc": {"pages_viewed": 1},
                    "$push": {"page_history": {"$each": [{"url": url, "title": title, "at": now_iso()}], "$slice": -15}}})
                await push_visitor(vid)
            elif kind == "typing":
                text = str(data.get("text", ""))[:500]
                if text:
                    hub.typing[vid] = text
                else:
                    hub.typing.pop(vid, None)
                conv = await open_conversation(vid)
                await hub.to_agents({"type": "visitor_typing", "visitor_id": vid,
                                     "conversation_id": conv["id"] if conv else None, "text": text})
            elif kind == "ping":
                await db.visitors.update_one({"id": vid}, {"$set": {"last_seen": now_iso()}})
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        hub.visitors[vid].discard(ws)
        if not hub.visitors[vid]:
            hub.visitors.pop(vid, None)
            hub.typing.pop(vid, None)
            await db.visitors.update_one({"id": vid}, {"$set": {"last_seen": now_iso()}})
            await push_visitor(vid)


async def push_visitor(vid: str):
    v = await db.visitors.find_one({"id": vid}, P0)
    if v:
        await hub.to_agents({"type": "visitor_update", "visitor": visitor_public(v)})


async def broadcast_presence():
    await hub.to_all_visitors({"type": "presence", "agents_online": hub.agents_online()})
    await hub.to_agents({"type": "agents_update", "online_agent_ids": hub.online_agent_ids()})


@app.websocket("/api/ws/agent")
async def ws_agent(ws: WebSocket, token: str = Query(...)):
    try:
        claims = await run_in_threadpool(verify_session_token, token)
        member = await load_member(claims["sub"])
    except Exception:
        await ws.close(code=4401)
        return
    if member["role"] not in STAFF_ROLES:
        await ws.close(code=4403)
        return
    uid = member["user_id"]
    await ws.accept()
    hub.agents[uid].add(ws)
    hub.agent_status[uid] = member.get("status", "online")
    await broadcast_presence()
    try:
        while True:
            data = json.loads(await ws.receive_text())
            if data.get("type") == "typing" and data.get("conversation_id"):
                conv = await db.conversations.find_one({"id": data["conversation_id"]}, P0)
                if conv:
                    typing = bool(data.get("typing"))
                    await hub.to_visitor(conv["visitor_id"], {"type": "agent_typing", "typing": typing,
                                                              "name": member.get("name", "Agent")})
                    await hub.to_agents({"type": "agent_typing", "conversation_id": conv["id"], "agent_id": uid,
                                         "name": member.get("name", "Agent"), "typing": typing})
    except (WebSocketDisconnect, RuntimeError, json.JSONDecodeError):
        pass
    finally:
        hub.agents[uid].discard(ws)
        if not hub.agents[uid]:
            hub.agents.pop(uid, None)
        await broadcast_presence()


# ---------- staff ----------
class StatusIn(BaseModel):
    status: str = Field(pattern="^(online|away)$")


class ConvPatch(BaseModel):
    status: Optional[str] = Field(default=None, pattern="^(open|closed)$")
    assigned_agent_id: Optional[str] = None
    unassign: bool = False


@api.get("/me")
async def me(member: dict = Depends(current_member)):
    return {**member, "online": member["user_id"] in hub.online_agent_ids()}


@api.patch("/me/status")
async def set_status(body: StatusIn, member: dict = Depends(require_staff)):
    await db.users.update_one({"user_id": member["user_id"]}, {"$set": {"status": body.status}})
    hub.agent_status[member["user_id"]] = body.status
    await broadcast_presence()
    return {"status": body.status}


@api.get("/agents")
async def list_agents(member: dict = Depends(require_staff)):
    people = await db.users.find({**IN_ENV, "role": {"$in": list(STAFF_ROLES)}}, P0).to_list(500)
    online = set(hub.online_agent_ids())
    return [{"user_id": p["user_id"], "name": p.get("name", ""), "email": p.get("email", ""),
             "role": effective_role(p.get("role")), "status": p.get("status", "online"),
             "online": p["user_id"] in online, "image_url": p.get("image_url", "")} for p in people]


@api.get("/conversations")
async def list_conversations(member: dict = Depends(require_staff), status: str = "open", assigned: str = "all",
                             q: str = ""):
    query: dict = {}
    if status in ("open", "closed"):
        query["status"] = status
    if assigned == "me":
        query["assigned_agent_id"] = member["user_id"]
    elif assigned == "unassigned":
        query["assigned_agent_id"] = None
    if q.strip():
        import re
        rx = {"$regex": re.escape(q.strip()), "$options": "i"}
        vids = [d["id"] for d in await db.visitors.find(
            {"$or": [{"name": rx}, {"email": rx}, {"country": rx}, {"city": rx}]}, {"id": 1, "_id": 0}).to_list(500)]
        query["$or"] = [{"visitor_id": {"$in": vids}}, {"last_message": rx}]
    convs = await db.conversations.find(query, P0).sort("last_message_at", -1).to_list(300)
    vmap = await visitors_by_id(c["visitor_id"] for c in convs)
    return [{**c, "visitor": vmap.get(c["visitor_id"])} for c in convs]


async def get_conv_or_404(conv_id: str) -> dict:
    conv = await db.conversations.find_one({"id": conv_id}, P0)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@api.get("/conversations/{conv_id}")
async def get_conversation(conv_id: str, member: dict = Depends(require_staff)):
    conv = await get_conv_or_404(conv_id)
    history = await db.conversations.find({"visitor_id": conv["visitor_id"], "id": {"$ne": conv_id}},
                                          {"_id": 0, "id": 1, "created_at": 1, "status": 1, "last_message": 1}
                                          ).sort("created_at", -1).to_list(20)
    return {**(await conv_with_visitor(conv)), "messages": await conv_messages(conv_id), "previous": history}


@api.post("/conversations/{conv_id}/messages")
async def agent_send(conv_id: str, body: TextIn, member: dict = Depends(require_staff)):
    conv = await get_conv_or_404(conv_id)
    sets = {"agent_replied": True, "status": "open", "closed_at": None}
    if conv["status"] == "closed":
        await db.conversations.update_one({"id": conv_id}, {"$set": {"status": "open", "closed_at": None}})
        await insert_message(conv, "system", "Chat reopened", kind="reopen")
    if not conv.get("first_response_at"):
        sets["first_response_at"] = now_iso()
    if not conv.get("assigned_agent_id"):
        sets.update(assigned_agent_id=member["user_id"], assigned_agent_name=member.get("name", ""))
    await db.conversations.update_one({"id": conv_id}, {"$set": sets})
    msg = await insert_message(conv, "agent", body.text.strip(), member.get("name", "Agent"), member["user_id"])
    await db.conversations.update_one({"id": conv_id}, {"$set": {"unread_agent": 0}})
    return msg


@api.post("/conversations/{conv_id}/read")
async def mark_read(conv_id: str, member: dict = Depends(require_staff)):
    await get_conv_or_404(conv_id)
    await db.conversations.update_one({"id": conv_id}, {"$set": {"unread_agent": 0}})
    return {"ok": True}


@api.patch("/conversations/{conv_id}")
async def update_conversation(conv_id: str, body: ConvPatch, member: dict = Depends(require_staff)):
    conv = await get_conv_or_404(conv_id)
    if body.unassign or body.assigned_agent_id is not None:
        target = None if body.unassign else body.assigned_agent_id
        if member["role"] != "admin" and target not in (None, member["user_id"]):
            raise HTTPException(status_code=403, detail="Only administrators can assign chats to other agents")
        if member["role"] != "admin" and conv.get("assigned_agent_id") not in (None, member["user_id"]):
            raise HTTPException(status_code=403, detail="This chat is assigned to another agent")
        name = None
        if target:
            agent = await db.users.find_one({"user_id": target, "role": {"$in": list(STAFF_ROLES)}}, P0)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
            name = agent.get("name", "")
        await db.conversations.update_one({"id": conv_id}, {"$set": {"assigned_agent_id": target, "assigned_agent_name": name}})
        note = f"Assigned to {name}" if target else "Unassigned"
        await insert_message(conv, "system", note, kind="assign")
    if body.status and body.status != conv["status"]:
        if body.status == "closed":
            await close_conversation(conv, f"Chat closed by {member.get('name', 'agent')}")
        else:
            await db.conversations.update_one({"id": conv_id}, {"$set": {"status": "open", "closed_at": None}})
            await insert_message(conv, "system", "Chat reopened", kind="reopen")
    fresh = await conv_with_visitor(await get_conv_or_404(conv_id))
    await hub.to_agents({"type": "conversation_update", "conversation": fresh})
    return fresh


@api.get("/visitors")
async def list_visitors(member: dict = Depends(require_staff), hours: int = Query(24, ge=1, le=720)):
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    online_ids = list(hub.visitors.keys())
    docs = await db.visitors.find({"$or": [{"last_seen": {"$gte": since}}, {"id": {"$in": online_ids}}]}, P0
                                  ).sort("last_seen", -1).to_list(500)
    convs = await db.conversations.find({"visitor_id": {"$in": [d["id"] for d in docs]}, "status": "open"},
                                        {"_id": 0, "id": 1, "visitor_id": 1}).to_list(500)
    cmap = {c["visitor_id"]: c["id"] for c in convs}
    out = [{**visitor_public(d), "conversation_id": cmap.get(d["id"])} for d in docs]
    return sorted(out, key=lambda v: (not v["online"], -(datetime.fromisoformat(v["last_seen"]).timestamp() if v.get("last_seen") else 0)))


# ---------- admin ----------
class RoleIn(BaseModel):
    role: str


class QuickAnswer(BaseModel):
    id: str = Field(default_factory=new_id)
    label: str = Field(min_length=1, max_length=80)
    keywords: list[str] = []
    answer: str = Field(min_length=1, max_length=2000)


class SettingsIn(BaseModel):
    welcome_message: str = Field(max_length=1000)
    offline_message: str = Field(max_length=1000)
    keyword_answers_enabled: bool
    ai_enabled: bool
    tawk_fallback_enabled: bool
    quick_answers: list[QuickAnswer]


@api.get("/users")
async def list_users(admin: dict = Depends(require_admin)):
    people = await db.users.find(IN_ENV, P0).sort("created_at", 1).to_list(1000)
    online = set(hub.online_agent_ids())
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[admin["role"]]],
            "users": [{**p, "role": effective_role(p.get("role")), "online": p["user_id"] in online} for p in people]}


@api.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, admin: dict = Depends(require_admin)):
    if body.role not in ROLES or RANK[body.role] > RANK[admin["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, P0)
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role}})
    if body.role not in STAFF_ROLES:
        for ws in list(hub.agents.get(user_id, set())):
            with suppress(Exception):
                await ws.close(code=4403)
    return {"user_id": user_id, "role": body.role}


@api.get("/settings")
async def read_settings(member: dict = Depends(require_staff)):
    return await get_settings()


@api.put("/settings")
async def write_settings(body: SettingsIn, admin: dict = Depends(require_admin)):
    data = body.model_dump()
    data["quick_answers"] = [{**q, "keywords": [k.strip().lower() for k in q["keywords"] if k.strip()]} for q in data["quick_answers"]]
    await db.settings.update_one({"id": "global"}, {"$set": data}, upsert=True)
    return await get_settings()


@api.get("/integrations/tawk")
async def tawk_status(admin: dict = Depends(require_admin)):
    s = await get_settings()
    return {"site_id": os.environ.get("TAWK_SITE_ID", ""), "api_key_configured": bool(os.environ.get("TAWK_API_KEY")),
            "fallback_enabled": s.get("tawk_fallback_enabled", False),
            "embed_src": f"https://embed.tawk.to/{os.environ.get('TAWK_SITE_ID', '')}/default"}


def _secs(a: str, b: str) -> float:
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds()


@api.get("/analytics")
async def analytics(admin: dict = Depends(require_admin), days: int = Query(30, ge=1, le=365)):
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    convs = await db.conversations.find({"created_at": {"$gte": since}}, P0).to_list(10000)
    msgs = await db.messages.find({"created_at": {"$gte": since}},
                                  {"_id": 0, "sender_type": 1, "sender_id": 1, "kind": 1, "created_at": 1}).to_list(100000)
    vmap = await visitors_by_id(c["visitor_id"] for c in convs)
    responded = [c for c in convs if c.get("first_response_at")]
    frt = sorted(_secs(c["created_at"], c["first_response_at"]) for c in responded)
    closed = [c for c in convs if c.get("closed_at")]
    durations = [_secs(c["created_at"], c["closed_at"]) for c in closed]
    daily = {}
    for i in range(min(days, 30) - 1, -1, -1):
        d = (datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat()
        daily[d] = 0
    for c in convs:
        d = c["created_at"][:10]
        if d in daily:
            daily[d] += 1
    countries: dict[str, int] = {}
    for c in convs:
        name = (vmap.get(c["visitor_id"]) or {}).get("country") or "Unknown"
        countries[name] = countries.get(name, 0) + 1
    agents = await db.users.find({**IN_ENV, "role": {"$in": list(STAFF_ROLES)}}, P0).to_list(500)
    per_agent = []
    for a in agents:
        mine = [c for c in convs if c.get("assigned_agent_id") == a["user_id"]]
        a_frt = [_secs(c["created_at"], c["first_response_at"]) for c in mine if c.get("first_response_at")]
        per_agent.append({"user_id": a["user_id"], "name": a.get("name", ""), "email": a.get("email", ""),
                          "conversations": len(mine), "closed": sum(1 for c in mine if c["status"] == "closed"),
                          "messages": sum(1 for m in msgs if m["sender_type"] == "agent" and m.get("sender_id") == a["user_id"]),
                          "avg_first_response_secs": round(sum(a_frt) / len(a_frt)) if a_frt else None})
    return {
        "days": days, "total_conversations": len(convs), "open": sum(1 for c in convs if c["status"] == "open"),
        "closed": len(closed), "unanswered": sum(1 for c in convs if c["status"] == "open" and not c.get("agent_replied")),
        "visitor_messages": sum(1 for m in msgs if m["sender_type"] == "visitor"),
        "agent_messages": sum(1 for m in msgs if m["sender_type"] == "agent"),
        "auto_keyword": sum(1 for m in msgs if m.get("kind") == "keyword"),
        "auto_ai": sum(1 for m in msgs if m.get("kind") == "ai"),
        "median_first_response_secs": round(frt[len(frt) // 2]) if frt else None,
        "avg_first_response_secs": round(sum(frt) / len(frt)) if frt else None,
        "avg_duration_secs": round(sum(durations) / len(durations)) if durations else None,
        "response_rate": round(100 * len(responded) / len(convs)) if convs else 0,
        "daily": [{"date": d, "count": n} for d, n in daily.items()],
        "countries": sorted([{"country": k, "count": v} for k, v in countries.items()], key=lambda x: -x["count"])[:10],
        "agents": sorted(per_agent, key=lambda x: -x["conversations"]),
        "visitors_online": len(hub.visitors), "agents_online": hub.agents_online(),
    }


app.include_router(api)
app.include_router(clerk_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})
    await db.settings.update_one({"id": "global"}, {"$setOnInsert": DEFAULT_SETTINGS}, upsert=True)


@app.on_event("shutdown")
async def shutdown():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
