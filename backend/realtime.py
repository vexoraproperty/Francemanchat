import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class Hub:
    def __init__(self):
        self.agents: dict[str, set[WebSocket]] = defaultdict(set)
        self.visitors: dict[str, set[WebSocket]] = defaultdict(set)
        self.agent_status: dict[str, str] = {}
        self.typing: dict[str, str] = {}

    async def _send(self, sockets, payload: dict):
        text = json.dumps(payload, default=str)
        for ws in list(sockets):
            try:
                await ws.send_text(text)
            except Exception:
                sockets.discard(ws)

    async def to_agents(self, payload: dict):
        for sockets in list(self.agents.values()):
            await self._send(sockets, payload)

    async def to_visitor(self, visitor_id: str, payload: dict):
        await self._send(self.visitors.get(visitor_id, set()), payload)

    async def to_all_visitors(self, payload: dict):
        for sockets in list(self.visitors.values()):
            await self._send(sockets, payload)

    def agents_online(self) -> int:
        return sum(1 for uid, s in self.agents.items() if s and self.agent_status.get(uid, "online") == "online")

    def online_agent_ids(self) -> list[str]:
        return [uid for uid, s in self.agents.items() if s and self.agent_status.get(uid, "online") == "online"]

    def visitor_online(self, visitor_id: str) -> bool:
        return bool(self.visitors.get(visitor_id))


hub = Hub()
