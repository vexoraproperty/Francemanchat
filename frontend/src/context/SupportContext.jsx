import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/react";
import { useApi, errMsg, WS_BASE } from "@/lib/api";

const SupportContext = createContext(null);
export const useSupport = () => useContext(SupportContext);

function useAgentSocket(enabled, onEvent) {
  const { getToken } = useAuth();
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    let stop = false;
    let retry = 0;
    let timer;
    const connect = async () => {
      const token = await getToken();
      if (stop) return;
      const ws = new WebSocket(`${WS_BASE}/api/ws/agent?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); if (retry > 0) onEvent({ type: "reconnected" }); retry = 0; };
      ws.onmessage = (e) => onEvent(JSON.parse(e.data));
      ws.onclose = (ev) => {
        setConnected(false);
        if (stop || ev.code === 4403) return;
        retry += 1;
        timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry));
      };
    };
    connect();
    const ping = setInterval(() => wsRef.current?.readyState === 1 && wsRef.current.send('{"type":"ping"}'), 25000);
    return () => { stop = true; clearTimeout(timer); clearInterval(ping); wsRef.current?.close(); };
  }, [enabled, getToken, onEvent]);
  const send = useCallback((obj) => { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify(obj)); }, []);
  return { connected, send };
}

export function SupportProvider({ children }) {
  const api = useApi();
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [onlineAgentIds, setOnlineAgentIds] = useState([]);
  const [visitorTyping, setVisitorTyping] = useState({});
  const [agentTyping, setAgentTyping] = useState({});
  const listeners = useRef(new Set());

  const refreshMe = useCallback(async () => {
    try { setMe(await api("get", "/me")); setError(null); } catch (e) { setError(errMsg(e)); }
  }, [api]);
  useEffect(() => { refreshMe(); }, [refreshMe]);

  const onEvent = useCallback((d) => {
    if (d.type === "agents_update") setOnlineAgentIds(d.online_agent_ids);
    if (d.type === "visitor_typing") setVisitorTyping((s) => ({ ...s, [d.visitor_id]: d.text }));
    if (d.type === "message" && d.message.sender_type === "visitor") setVisitorTyping((s) => ({ ...s, [d.message.visitor_id]: "" }));
    if (d.type === "visitor_update" && !d.visitor.online) setVisitorTyping((s) => ({ ...s, [d.visitor.id]: "" }));
    if (d.type === "agent_typing") setAgentTyping((s) => ({ ...s, [d.conversation_id]: d.typing ? { name: d.name, agent_id: d.agent_id } : null }));
    listeners.current.forEach((fn) => fn(d));
  }, []);

  const staff = !!me && ["admin", "agent"].includes(me.role);
  const { connected, send } = useAgentSocket(staff, onEvent);
  const subscribe = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);

  const value = { api, me, setMe, error, refreshMe, staff, isAdmin: me?.role === "admin", connected, send, subscribe,
    onlineAgentIds, visitorTyping, agentTyping };
  return <SupportContext.Provider value={value}>{children}</SupportContext.Provider>;
}

export function useSupportEvents(handler) {
  const { subscribe } = useSupport();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe((d) => ref.current(d)), [subscribe]);
}
