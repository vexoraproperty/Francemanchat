# Clerk helper: create session tokens / sign-in tickets for test users (never prints secret)
import os
import sys
import requests
from dotenv import dotenv_values

_SECRET = dotenv_values("/app/backend/.env").get("CLERK_SECRET_KEY")
H = {"Authorization": f"Bearer {_SECRET}", "User-Agent": "emergent-test", "Content-Type": "application/json"}
API = "https://api.clerk.com/v1"

USERS = {
    "admin": "user_3MIQv0v1BpjgEqczlBmSOxlY8Hx",
    "agent": "user_3MIQv1SxGW0FEwQ8bYKyp1xRT72",
    "pending": "user_3MIQv4MLGyyOvOsjKv2kvm7ZP5r",
}

_sessions = {}


def session_token(role: str) -> str:
    uid = USERS[role]
    sid = _sessions.get(role)
    if not sid:
        r = requests.post(f"{API}/sessions", json={"user_id": uid}, headers=H, timeout=15)
        r.raise_for_status()
        sid = r.json()["id"]
        _sessions[role] = sid
    r = requests.post(f"{API}/sessions/{sid}/tokens", json={"expires_in_seconds": 3600}, headers=H, timeout=15)
    if r.status_code >= 400:
        r = requests.post(f"{API}/sessions/{sid}/tokens", headers=H, timeout=15)
    r.raise_for_status()
    return r.json()["jwt"]


def ticket(role: str) -> str:
    r = requests.post(f"{API}/sign_in_tokens", json={"user_id": USERS[role], "expires_in_seconds": 3600}, headers=H, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


if __name__ == "__main__":
    kind, role = sys.argv[1], sys.argv[2]
    print(ticket(role) if kind == "ticket" else session_token(role))
