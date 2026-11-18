# Franceman Live Support — PRD

## Original problem statement
Build a modern, professional, fully functional live chat support system for Franceman Exportation LLP, integrated with Tawk.to (Site ID 67e1bc9e4b4636190c495698; API key via backend env, never in frontend). Floating live chat widget; real-time messaging visitors <-> agents; branded interface matching francemann.com; visitor name, email, message history, typing indicators, online/offline status, timestamps; responsive; support dashboard; welcome/offline/automated responses; secure integration. Premium, clean, corporate; no emojis or unnecessary animation. Conversations must happen inside Franceman's own platform (Customer widget -> Agent dashboard -> Administrator), Tawk.to only as a supporting integration. Admin panel (manage agents & roles), analytics (support performance). Login: email + password and Google. Quick answers: keyword-based, AI assistant, welcome and offline messages. Live visitor panel showing each visitor's details, country, current page and typing status.

## Architecture
- Backend FastAPI: server.py (routes + websockets), core.py (db, Clerk roles admin/agent/pending, visitor HMAC tokens, settings), realtime.py (in-memory WS hub, single worker), automation.py (keyword match + Claude claude-sonnet-5-5 via Emergent LLM key), static/embed.js served at /api/embed.js (CORP cross-origin).
- Auth: Emergent-managed Clerk (email+password, Google). ADMIN_EMAIL=info@francemann.com. New sign-ups are "pending" until an admin approves.
- Geo: ip-api.com lookup per new visitor (country/city/timezone).
- Frontend React: public demo site (/ /products /sample-request /contact) with widget; /widget iframe for embedding; dashboard /inbox, /visitors, /analytics, /team, /settings (last three admin-only).
- Tawk.to: optional offline backup link (loads Tawk embed) when enabled and no agents online. TAWK_API_KEY not set (was masked in request).

## Personas
International buyer (visitor), support agent, administrator.

## Implemented (2026-11-18)
- Widget: prechat (name/email/product), welcome message, real-time thread over WebSocket with REST send + resync on reconnect, agent/AI typing indicator, online/offline status, timestamps, quick-answer chips, end chat, unread badge, mobile full-screen.
- Automation: offline message once per chat when no agent online, keyword answers, AI answers until a human replies.
- Inbox: live list with filters/search/unread, thread, quick answer insert, resolve/reopen, assignment (agents self only, admin any), visitor panel (location, local time, device, current page, page history, live typing preview, previous chats).
- Live visitors page with live current page + typing.
- Analytics: volume, median/avg first response, response rate, automated answers, daily chart, countries, per-agent table.
- Team & roles, Settings (messages, toggles, quick answers editor, embed snippet, Tawk status).
- Tested: iteration_1 backend 19/19, frontend flows pass; fixes applied after (embed CORP, blank names, reopen on reply, admin route guard, prechat error, mobile nav, iframe layout).

## Backlog
- P1: Email notification/transcript to visitor for offline messages; sound/desktop notifications for agents.
- P1: File attachments (spec sheets/LOIs).
- P2: Tawk.to REST/webhook sync once API key provided; internal agent notes; canned responses per agent; rate limiting on widget session.
