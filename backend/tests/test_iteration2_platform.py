# Iteration 2: overview, contacts, embed.js, blank names, agent reply reopens closed chat
import uuid
import requests
import pytest

from clerk_helper import session_token
from test_franceman_chat import BASE_URL, H, new_visitor, identify


@pytest.fixture(scope="module")
def tokens():
    return {r: session_token(r) for r in ("admin", "agent", "pending")}


# ---- auth guard on new endpoints ----
class TestGuards:
    @pytest.mark.parametrize("path", ["/api/overview", "/api/contacts"])
    def test_no_token_401(self, path):
        assert requests.get(f"{BASE_URL}{path}").status_code == 401

    @pytest.mark.parametrize("path", ["/api/overview", "/api/contacts"])
    def test_pending_403(self, tokens, path):
        assert requests.get(f"{BASE_URL}{path}", headers=H(tokens["pending"])).status_code == 403

    @pytest.mark.parametrize("role", ["admin", "agent"])
    def test_staff_200(self, tokens, role):
        for p in ("/api/overview", "/api/contacts"):
            r = requests.get(f"{BASE_URL}{p}", headers=H(tokens[role]))
            assert r.status_code == 200, (p, r.text)


# ---- overview ----
class TestOverview:
    def test_overview_shape_and_waiting(self, tokens):
        before = requests.get(f"{BASE_URL}/api/overview", headers=H(tokens["admin"])).json()
        for k in ("visitors_online", "open_chats", "waiting_chats", "unassigned_chats", "my_chats",
                  "chats_today", "messages_today", "agents", "recent"):
            assert k in before
        assert isinstance(before["agents"], list) and len(before["agents"]) >= 2
        vtok, _ = new_visitor()
        identify(vtok, name="TEST_OverviewAPI")
        r = requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": vtok},
                          json={"text": "TEST overview question"})
        assert r.status_code == 200
        conv_id = r.json()["conversation_id"]
        after = requests.get(f"{BASE_URL}/api/overview", headers=H(tokens["admin"])).json()
        assert after["chats_today"] >= before["chats_today"] + 1
        assert after["open_chats"] >= 1
        assert any(c["id"] == conv_id for c in after["recent"])
        rec = next(c for c in after["recent"] if c["id"] == conv_id)
        assert rec["visitor"]["name"] == "TEST_OverviewAPI"
        assert "_id" not in rec


# ---- contacts ----
class TestContacts:
    def test_contacts_search(self, tokens):
        tag = f"TEST_Contact{uuid.uuid4().hex[:5]}"
        vtok, _ = new_visitor()
        identify(vtok, name=tag)
        rows = requests.get(f"{BASE_URL}/api/contacts", headers=H(tokens["agent"]), params={"q": tag}).json()
        assert len(rows) == 1
        c = rows[0]
        assert c["name"] == tag and c["chats"] >= 1 and c["latest_conversation_id"]
        assert c["commodity"] == "Ginger"
        # regex chars safe
        r = requests.get(f"{BASE_URL}/api/contacts", headers=H(tokens["agent"]), params={"q": "(.*"})
        assert r.status_code == 200
        # unidentified visitors excluded
        all_rows = requests.get(f"{BASE_URL}/api/contacts", headers=H(tokens["agent"])).json()
        assert all(row.get("name") for row in all_rows)


# ---- embed + regressions from iteration 1 fixes ----
class TestFixes:
    def test_embed_js_cross_origin(self):
        r = requests.get(f"{BASE_URL}/api/embed.js")
        assert r.status_code == 200
        assert "javascript" in r.headers.get("content-type", "")
        assert r.headers.get("cross-origin-resource-policy") == "cross-origin"
        assert "iframe" in r.text

    def test_blank_name_rejected(self):
        vtok, _ = new_visitor()
        r = requests.post(f"{BASE_URL}/api/widget/identify", headers={"X-Visitor-Token": vtok},
                          json={"name": "   ", "email": "test_blank@example.com", "commodity": ""})
        assert r.status_code == 422

    def test_agent_reply_reopens_closed(self, tokens):
        vtok, _ = new_visitor()
        identify(vtok, name="TEST_ReopenByReply")
        conv_id = requests.post(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": vtok},
                                json={"text": "hi"}).json()["conversation_id"]
        r = requests.patch(f"{BASE_URL}/api/conversations/{conv_id}", headers=H(tokens["admin"]), json={"status": "closed"})
        assert r.status_code == 200 and r.json()["status"] == "closed"
        r = requests.post(f"{BASE_URL}/api/conversations/{conv_id}/messages", headers=H(tokens["admin"]),
                          json={"text": "TEST reply after close"})
        assert r.status_code == 200
        d = requests.get(f"{BASE_URL}/api/conversations/{conv_id}", headers=H(tokens["admin"])).json()
        assert d["status"] == "open" and not d.get("closed_at")
        kinds = [m.get("kind") for m in d["messages"] if m["sender_type"] == "system"]
        assert "reopen" in kinds
        w = requests.get(f"{BASE_URL}/api/widget/messages", headers={"X-Visitor-Token": vtok}).json()
        assert w["conversation"]["id"] == conv_id and w["conversation"]["status"] == "open"
