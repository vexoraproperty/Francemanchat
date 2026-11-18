# Iteration 3: visitor IP/device/geo payloads, visitor_activity websocket feed, auto-agent role for new Clerk users
# Run serially: pytest /app/backend/tests/test_iteration3_visitors_activity.py -n 0 -v
import asyncio
import json
import time
import uuid

import pytest
import requests
import websockets

from clerk_helper import session_token, API, H as CH
from test_franceman_chat import BASE_URL, WS_URL, H, identify

UA_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
UA_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"


@pytest.fixture(scope="module")
def tokens():
    return {r: session_token(r) for r in ("admin", "agent", "pending")}


def session(ua=UA_WIN):
    r = requests.post(f"{BASE_URL}/api/widget/session", headers={"User-Agent": ua},
                      json={"url": f"{BASE_URL}/TEST_landing", "title": "TEST Landing"})
    assert r.status_code == 200, r.text
    return r.json()["token"], r.json()["visitor"]


async def drain(ws, pred, t=10):
    end = time.time() + t
    while time.time() < end:
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), max(0.1, end - time.time())))
        except asyncio.TimeoutError:
            break
        if pred(m):
            return m
    return None


# ---- visitor payload fields ----
class TestVisitorDetails:
    def test_session_payload_has_ip_device(self):
        _, v = session(UA_WIN)
        for k in ("ip", "device", "country", "city", "session_started", "visits"):
            assert k in v
        assert v["device"] == "Chrome on Windows · Desktop"
        assert isinstance(v["ip"], str) and v["ip"]

    def test_device_parse_iphone(self):
        _, v = session(UA_IPHONE)
        assert v["device"] == "Safari on iOS · Mobile"

    def test_visitors_list_contains_ip(self, tokens):
        tok, v = session()
        identify(tok, "TEST_IPVisitor")
        r = requests.get(f"{BASE_URL}/api/visitors", headers=H(tokens["agent"]), params={"hours": 24})
        assert r.status_code == 200
        row = next((x for x in r.json() if x["id"] == v["id"]), None)
        assert row and row["ip"] == v["ip"] and row["device"] and "online" in row
        assert row["conversation_id"]

    def test_conversation_visitor_has_ip(self, tokens):
        tok, v = session()
        cid = identify(tok, "TEST_ConvIP")["conversation"]["id"]
        r = requests.get(f"{BASE_URL}/api/conversations/{cid}", headers=H(tokens["admin"]))
        assert r.status_code == 200 and r.json()["visitor"]["ip"] == v["ip"]


# ---- activity events over the agent websocket ----
class TestActivity:
    def test_arrived_page_chat_started_left(self, tokens):
        async def run():
            tok, v = session()
            vid = v["id"]
            async with websockets.connect(f"{WS_URL}/api/ws/agent?token={tokens['admin']}") as aw:
                await asyncio.sleep(0.5)
                async with websockets.connect(f"{WS_URL}/api/ws/visitor?token={tok}") as vw:
                    m = await drain(aw, lambda m: m["type"] == "visitor_activity" and m["visitor"]["id"] == vid and m["action"] == "arrived")
                    assert m, "no arrived event"
                    assert m["visitor"]["visits"] == 1 and m["visitor"]["session_started"]
                    await vw.send(json.dumps({"type": "page", "url": f"{BASE_URL}/TEST_pricing", "title": "TEST Pricing"}))
                    m = await drain(aw, lambda m: m["type"] == "visitor_activity" and m["visitor"]["id"] == vid and m["action"] == "page")
                    assert m and m["url"].endswith("/TEST_pricing") and m["title"] == "TEST Pricing"
                    r = requests.post(f"{BASE_URL}/api/widget/identify", headers={"X-Visitor-Token": tok},
                                      json={"name": "TEST_Activity", "email": f"test_{uuid.uuid4().hex[:6]}@example.com"})
                    cid = r.json()["conversation"]["id"]
                    m = await drain(aw, lambda m: m["type"] == "visitor_activity" and m["visitor"]["id"] == vid and m["action"] == "chat_started")
                    assert m and m["conversation_id"] == cid
                # quick reconnect within 15s must NOT be a new arrival
                async with websockets.connect(f"{WS_URL}/api/ws/visitor?token={tok}"):
                    m = await drain(aw, lambda m: m["type"] == "visitor_activity" and m["visitor"]["id"] == vid and m["action"] == "arrived", 3)
                    assert m is None, "re-arrival announced within 15s"
                m = await drain(aw, lambda m: m["type"] == "visitor_activity" and m["visitor"]["id"] == vid and m["action"] == "left", 25)
                assert m, "no left event"
                assert m["visitor"]["online"] is False
        asyncio.run(run())

    def test_second_identify_no_chat_started(self, tokens):
        async def run():
            tok, v = session()
            identify(tok, "TEST_Twice")
            async with websockets.connect(f"{WS_URL}/api/ws/agent?token={tokens['admin']}") as aw:
                await asyncio.sleep(0.5)
                identify(tok, "TEST_Twice2")
                m = await drain(aw, lambda m: m["type"] == "visitor_activity" and m["visitor"]["id"] == v["id"] and m["action"] == "chat_started", 4)
                assert m is None
        asyncio.run(run())


# ---- auto agent role for brand-new Clerk user ----
class TestAutoAgent:
    def test_new_clerk_user_is_agent(self):
        email = f"test_auto_{uuid.uuid4().hex[:6]}+clerk_test@example.com"
        r = requests.post(f"{API}/users", headers=CH, json={"email_address": [email], "password": "Test-pass-12345!",
                                                            "first_name": "TEST_Auto", "skip_password_checks": True})
        assert r.status_code < 300, r.text
        uid = r.json()["id"]
        try:
            s = requests.post(f"{API}/sessions", headers=CH, json={"user_id": uid}).json()
            jwt = requests.post(f"{API}/sessions/{s['id']}/tokens", headers=CH).json()["jwt"]
            me = requests.get(f"{BASE_URL}/api/me", headers=H(jwt))
            assert me.status_code == 200 and me.json()["role"] == "agent", me.text
            assert requests.get(f"{BASE_URL}/api/conversations", headers=H(jwt)).status_code == 200
            assert requests.get(f"{BASE_URL}/api/users", headers=H(jwt)).status_code == 403
            print("CREATED_TEST_USER", uid, email)
        finally:
            requests.delete(f"{API}/users/{uid}", headers=CH)

    def test_pending_still_blocked(self, tokens):
        me = requests.get(f"{BASE_URL}/api/me", headers=H(tokens["pending"])).json()
        assert me["role"] == "pending"
        for p in ("/api/conversations", "/api/visitors", "/api/overview", "/api/contacts"):
            assert requests.get(f"{BASE_URL}{p}", headers=H(tokens["pending"])).status_code == 403


class TestEmbed:
    def test_embed_headers(self):
        r = requests.get(f"{BASE_URL}/api/embed.js")
        assert r.status_code == 200
        assert r.headers.get("cross-origin-resource-policy") == "cross-origin"
        assert "javascript" in r.headers.get("content-type", "")
        assert "Franceman live chat" in r.text
