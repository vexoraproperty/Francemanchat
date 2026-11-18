# Franceman live chat backend regression tests (widget, staff inbox, roles, settings, analytics, websockets)
# Run serially: pytest /app/backend/tests/test_franceman_chat.py -n 0 -v
import asyncio
import json
import os
import time
import uuid

import pytest
import requests
import websockets

from clerk_helper import session_token, USERS


def _base():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        for line in open("/app/frontend/.env"):
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip()
    return url.rstrip("/")


BASE_URL = _base()
WS_URL = BASE_URL.replace("https://", "wss://").replace("http://", "ws://")


@pytest.fixture(scope="module")
def tokens():
    return {r: session_token(r) for r in ("admin", "agent", "pending")}


def H(tok):
    return {"Authorization": f"Bearer {tok}"}


def new_visitor(name_suffix=""):
    r = requests.post(f"{BASE_URL}/api/widget/session", json={"url": f"{BASE_URL}/products", "title": "Products"})
    assert r.status_code == 200
    tok = r.json()["token"]
    return tok, r.json()


def identify(vtok, name="TEST_Visitor"):
    r = requests.post(f"{BASE_URL}/api/widget/identify", headers={"X-Visitor-Token": vtok},
                      json={"name": name, "email": f"test_{uuid.uuid4().hex[:6]}@example.com", "commodity": "Ginger"})
    assert r.status_code == 200, r.text
    return r.json()


def wait_for(fn, timeout=30, step=1.0):
    end = time.time() + timeout
    while time.time() < end:
        v = fn()
        if v:
            return v
        time.sleep(step)
    return None


# ---- Widget public API ----
class TestWidget:
    def test_config(self):
        r = requests.get(f"{BASE_URL}/api/widget/config")
        assert r.status_code == 200
        d = r.json()
        assert "welcome_message" in d and isinstance(d["quick_answers"], list)
        assert any(q["id"] == "qa-moq" for q in d["quick_answers"])
        assert "keywords" not in d["quick_answers"][0]

    def test_session_resume(self):
        tok, d = new_visitor()
        assert d["visitor"]["name"].startswith("Visitor")
        r = requests.post(f"{BASE_URL}/api/widget/session", json={"token": tok})
        assert r.json()["visitor"]["id"] == d["visitor"]["id"]

    def test_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": "bad.sig"})
        assert r.status_code == 401
        r = requests.get(f"{BASE_URL}/api/widget/messages")
        assert r.status_code == 422

    def test_send_before_identify_400(self):
        tok, _ = new_visitor()
        r = requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok}, json={"text": "hi"})
        assert r.status_code == 400

    def test_identify_validation(self):
        tok, _ = new_visitor()
        r = requests.post(f"{BASE_URL}/api/widget/identify", headers={"X-Visitor-Token": tok},
                          json={"name": "TEST_X", "email": "not-an-email"})
        assert r.status_code == 422
        r = requests.post(f"{BASE_URL}/api/widget/identify", headers={"X-Visitor-Token": tok},
                          json={"name": "", "email": "a@example.com"})
        assert r.status_code == 422

    def test_identify_welcome_and_keyword(self):
        tok, _ = new_visitor()
        d = identify(tok, "TEST_Keyword")
        assert d["conversation"]["status"] == "open"
        assert d["messages"][0]["kind"] == "welcome"
        r = requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok},
                          json={"text": "What is your MOQ?"})
        assert r.status_code == 200
        msgs = wait_for(lambda: [m for m in requests.get(f"{BASE_URL}/api/widget/messages",
                                 headers={"X-Visitor-Token": tok}).json()["messages"] if m["kind"] == "keyword"], 15)
        assert msgs and "Kola Nut 500 kg" in msgs[0]["text"]

    def test_ai_answer(self):
        tok, _ = new_visitor()
        identify(tok, "TEST_AI")
        requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok},
                      json={"text": "Where is your company based and when was it founded?"})
        msgs = wait_for(lambda: [m for m in requests.get(f"{BASE_URL}/api/widget/messages",
                                 headers={"X-Visitor-Token": tok}).json()["messages"] if m["kind"] == "ai"], 45, 2)
        assert msgs, "No AI reply within 45s"
        assert len(msgs[0]["text"]) > 10
        print("AI:", msgs[0]["text"][:200])

    def test_end_then_new_conversation(self):
        tok, _ = new_visitor()
        d = identify(tok, "TEST_End")
        cid = d["conversation"]["id"]
        assert requests.post(f"{BASE_URL}/api/widget/end", headers={"X-Visitor-Token": tok}).status_code == 200
        assert requests.get(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok}).json()["conversation"] is None
        r = requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok}, json={"text": "hello again"})
        assert r.status_code == 200 and r.json()["conversation_id"] != cid


# ---- Role security ----
class TestRoles:
    def test_no_token_401(self):
        for p in ("/api/conversations", "/api/me", "/api/users", "/api/analytics", "/api/visitors"):
            assert requests.get(f"{BASE_URL}{p}").status_code == 401, p

    def test_pending_403(self, tokens):
        me = requests.get(f"{BASE_URL}/api/me", headers=H(tokens["pending"])).json()
        assert me["role"] == "pending"
        assert requests.get(f"{BASE_URL}/api/conversations", headers=H(tokens["pending"])).status_code == 403

    def test_agent_403_admin_routes(self, tokens):
        h = H(tokens["agent"])
        assert requests.get(f"{BASE_URL}/api/me", headers=h).json()["role"] == "agent"
        assert requests.get(f"{BASE_URL}/api/users", headers=h).status_code == 403
        assert requests.get(f"{BASE_URL}/api/analytics", headers=h).status_code == 403
        s = requests.get(f"{BASE_URL}/api/settings", headers=h)
        assert s.status_code == 200
        body = {k: s.json()[k] for k in ("welcome_message", "offline_message", "keyword_answers_enabled",
                                         "ai_enabled", "tawk_fallback_enabled", "quick_answers")}
        assert requests.put(f"{BASE_URL}/api/settings", headers=h, json=body).status_code == 403
        assert requests.get(f"{BASE_URL}/api/conversations", headers=h).status_code == 200

    def test_admin_lists_users_and_last_admin_409(self, tokens):
        h = H(tokens["admin"])
        r = requests.get(f"{BASE_URL}/api/users", headers=h)
        assert r.status_code == 200
        users = r.json()["users"]
        admins = [u for u in users if u["role"] == "admin"]
        print("admins:", [u["email"] for u in admins])
        if len(admins) == 1:
            r = requests.patch(f"{BASE_URL}/api/users/{admins[0]['user_id']}/role", headers=h, json={"role": "agent"})
            assert r.status_code == 409
        else:
            pytest.skip("More than one admin - not demoting to avoid data change")
        # no-op role set on agent
        r = requests.patch(f"{BASE_URL}/api/users/{USERS['agent']}/role", headers=h, json={"role": "agent"})
        assert r.status_code == 200
        r = requests.patch(f"{BASE_URL}/api/users/{USERS['agent']}/role", headers=h, json={"role": "superuser"})
        assert r.status_code == 403


# ---- Staff conversation ops ----
class TestStaff:
    def test_assign_rules_reply_close_reopen(self, tokens):
        tok, _ = new_visitor()
        cid = identify(tok, "TEST_Assign")["conversation"]["id"]
        ha, hg = H(tokens["admin"]), H(tokens["agent"])
        # agent cannot assign to admin
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=hg, json={"assigned_agent_id": USERS["admin"]})
        assert r.status_code == 403
        # agent can assign to self
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=hg, json={"assigned_agent_id": USERS["agent"]})
        assert r.status_code == 200 and r.json()["assigned_agent_id"] == USERS["agent"]
        # admin can assign to admin
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=ha, json={"assigned_agent_id": USERS["admin"]})
        assert r.status_code == 200 and r.json()["assigned_agent_id"] == USERS["admin"]
        # agent cannot take chat owned by other agent
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=hg, json={"assigned_agent_id": USERS["agent"]})
        assert r.status_code == 403
        # admin to non-staff -> 404
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=ha, json={"assigned_agent_id": USERS["pending"]})
        assert r.status_code == 404
        # reply
        r = requests.post(f"{BASE_URL}/api/conversations/{cid}/messages", headers=ha, json={"text": "TEST agent reply"})
        assert r.status_code == 200 and r.json()["sender_type"] == "agent"
        d = requests.get(f"{BASE_URL}/api/conversations/{cid}", headers=ha).json()
        assert d["agent_replied"] is True and d["first_response_at"]
        assert any(m["text"] == "TEST agent reply" for m in d["messages"])
        assert d["visitor"]["name"] == "TEST_Assign"
        wm = requests.get(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok}).json()["messages"]
        assert any(m["text"] == "TEST agent reply" for m in wm)
        # close / reopen
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=ha, json={"status": "closed"})
        assert r.json()["status"] == "closed"
        lst = requests.get(f"{BASE_URL}/api/conversations?status=closed", headers=ha).json()
        assert any(c["id"] == cid for c in lst)
        r = requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=ha, json={"status": "open"})
        assert r.json()["status"] == "open"
        requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=ha, json={"status": "closed"})

    def test_search_and_404(self, tokens):
        ha = H(tokens["admin"])
        r = requests.get(f"{BASE_URL}/api/conversations?status=all&q=TEST_Assign", headers=ha)
        assert r.status_code == 200 and len(r.json()) >= 1
        assert requests.get(f"{BASE_URL}/api/conversations/nope", headers=ha).status_code == 404

    def test_visitors_agents_analytics(self, tokens):
        ha = H(tokens["admin"])
        r = requests.get(f"{BASE_URL}/api/visitors", headers=ha)
        assert r.status_code == 200 and isinstance(r.json(), list)
        v = r.json()[0]
        for k in ("country", "current_page", "online", "typing", "device"):
            assert k in v
        ag = requests.get(f"{BASE_URL}/api/agents", headers=ha).json()
        assert {USERS["admin"], USERS["agent"]} <= {a["user_id"] for a in ag}
        an = requests.get(f"{BASE_URL}/api/analytics?days=30", headers=ha)
        assert an.status_code == 200
        d = an.json()
        assert d["total_conversations"] >= 1 and len(d["daily"]) == 30
        assert requests.get(f"{BASE_URL}/api/integrations/tawk", headers=ha).json()["site_id"]

    def test_status_validation(self, tokens):
        r = requests.patch(f"{BASE_URL}/api/me/status", headers=H(tokens["agent"]), json={"status": "busy"})
        assert r.status_code == 422
        r = requests.patch(f"{BASE_URL}/api/me/status", headers=H(tokens["agent"]), json={"status": "online"})
        assert r.status_code == 200

    def test_settings_roundtrip(self, tokens):
        ha = H(tokens["admin"])
        s = requests.get(f"{BASE_URL}/api/settings", headers=ha).json()
        body = {k: s[k] for k in ("welcome_message", "offline_message", "keyword_answers_enabled",
                                  "ai_enabled", "tawk_fallback_enabled", "quick_answers")}
        r = requests.put(f"{BASE_URL}/api/settings", headers=ha, json=body)
        assert r.status_code == 200
        assert r.json()["welcome_message"] == s["welcome_message"]
        assert len(r.json()["quick_answers"]) == len(s["quick_answers"])
        bad = {**body, "quick_answers": [{"label": "", "keywords": [], "answer": "x"}]}
        assert requests.put(f"{BASE_URL}/api/settings", headers=ha, json=bad).status_code == 422


# ---- WebSockets: realtime typing, page, messages, presence ----
class TestRealtime:
    def test_ws_flow(self, tokens):
        async def run():
            tok, _ = new_visitor()
            cid = identify(tok, "TEST_WS")["conversation"]["id"]
            # bad tokens rejected
            with pytest.raises(Exception):
                async with websockets.connect(f"{WS_URL}/api/ws/agent?token=bad") as w:
                    await asyncio.wait_for(w.recv(), 5)
            async with websockets.connect(f"{WS_URL}/api/ws/agent?token={tokens['admin']}") as aw, \
                    websockets.connect(f"{WS_URL}/api/ws/visitor?token={tok}") as vw:
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
                pres = await drain(vw, lambda m: m["type"] == "presence")
                assert pres and pres["agents_online"] >= 1
                await vw.send(json.dumps({"type": "typing", "text": "TEST typing preview"}))
                m = await drain(aw, lambda m: m["type"] == "visitor_typing" and m["text"] == "TEST typing preview")
                assert m and m["conversation_id"] == cid
                await vw.send(json.dumps({"type": "page", "url": f"{BASE_URL}/contact", "title": "Contact"}))
                m = await drain(aw, lambda m: m["type"] == "visitor_update" and m["visitor"]["current_page"].endswith("/contact"))
                assert m and m["visitor"]["online"] is True
                await aw.send(json.dumps({"type": "typing", "conversation_id": cid, "typing": True}))
                m = await drain(vw, lambda m: m["type"] == "agent_typing" and m["typing"])
                assert m
                requests.post(f"{BASE_URL}/api/conversations/{cid}/messages", headers=H(tokens["admin"]), json={"text": "TEST ws reply"})
                m = await drain(vw, lambda m: m["type"] == "message" and m["message"]["text"] == "TEST ws reply")
                assert m
                # visitor message after agent reply: no AI reply should appear
                requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok},
                              json={"text": "Tell me about your company history please"})
                m = await drain(vw, lambda m: m["type"] == "message" and m["message"]["kind"] == "ai", 15)
                assert m is None, "AI replied after agent took over"
                requests.patch(f"{BASE_URL}/api/conversations/{cid}", headers=H(tokens["admin"]), json={"status": "closed"})
                m = await drain(vw, lambda m: m["type"] == "message" and m["message"]["kind"] == "closed")
                assert m
        asyncio.run(run())

    def test_offline_message_once(self, tokens):
        cfg = requests.get(f"{BASE_URL}/api/widget/config").json()
        if cfg["agents_online"] != 0:
            pytest.skip("Agents online - offline message not expected")
        tok, _ = new_visitor()
        identify(tok, "TEST_Offline")
        for t in ("What is your moq", "Do you offer samples"):
            requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok}, json={"text": t})
            time.sleep(4)
        msgs = requests.get(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": tok}).json()["messages"]
        assert sum(1 for m in msgs if m["kind"] == "offline") == 1
        assert sum(1 for m in msgs if m["kind"] == "keyword") == 2
