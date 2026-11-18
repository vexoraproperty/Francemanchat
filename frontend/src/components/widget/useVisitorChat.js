import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import { API, WS_BASE } from "@/lib/api";

const TOKEN_KEY = "fm_visitor_token";

function mergeMessages(list, incoming) {
  const seen = new Set(list.map((m) => m.id));
  const add = incoming.filter((m) => !seen.has(m.id));
  return add.length ? [...list, ...add].sort((a, b) => a.created_at.localeCompare(b.created_at)) : list;
}

export function useVisitorChat(initialPage) {
  const [chat, setChat] = useState({ ready: false, visitor: null, conversation: null, messages: [], config: null });
  const [agentsOnline, setAgentsOnline] = useState(0);
  const [agentTyping, setAgentTyping] = useState(null);
  const [connected, setConnected] = useState(false);
  const tokenRef = useRef(null);
  const wsRef = useRef(null);
  const pageRef = useRef(initialPage || null);
  const typingSentRef = useRef(0);

  const addMessage = useCallback((msg) => {
    setChat((s) => {
      const sameConv = s.conversation && s.conversation.id === msg.conversation_id;
      const messages = sameConv ? mergeMessages(s.messages, [msg]) : [msg];
      const status = msg.kind === "closed" ? "closed" : msg.kind === "reopen" ? "open" : sameConv ? s.conversation.status : "open";
      return { ...s, messages, conversation: { ...(sameConv ? s.conversation : {}), id: msg.conversation_id, status } };
    });
  }, []);

  const authHeaders = () => ({ headers: { "X-Visitor-Token": tokenRef.current } });

  const resync = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/widget/messages`, authHeaders());
      setChat((s) => {
        if (!data.conversation) return s;
        const same = s.conversation && s.conversation.id === data.conversation.id;
        return { ...s, conversation: data.conversation, messages: same ? mergeMessages(s.messages, data.messages) : data.messages };
      });
    } catch {}
  }, []);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let timer;
    const connect = () => {
      const ws = new WebSocket(`${WS_BASE}/api/ws/visitor?token=${encodeURIComponent(tokenRef.current)}`);
      wsRef.current = ws;
      ws.onopen = () => {
        setConnected(true);
        if (retry > 0) resync();
        retry = 0;
        if (pageRef.current) ws.send(JSON.stringify({ type: "page", ...pageRef.current }));
      };
      ws.onmessage = (e) => {
        const d = JSON.parse(e.data);
        if (d.type === "message") {
          addMessage(d.message);
          if (d.message.sender_type !== "visitor") setAgentTyping(null);
        } else if (d.type === "presence") setAgentsOnline(d.agents_online);
        else if (d.type === "agent_typing") setAgentTyping(d.typing ? d.name : null);
      };
      ws.onclose = (ev) => {
        setConnected(false);
        if (stopped) return;
        if (ev.code === 4401 || ev.code === 4404) {
          localStorage.removeItem(TOKEN_KEY);
          start();
          return;
        }
        timer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retry++));
        retry = Math.max(retry, 1);
      };
    };
    const start = async () => {
      try {
        const page = pageRef.current || { url: window.location.href, title: document.title, referrer: document.referrer };
        const { data } = await axios.post(`${API}/widget/session`, { token: localStorage.getItem(TOKEN_KEY), ...page });
        if (stopped) return;
        tokenRef.current = data.token;
        localStorage.setItem(TOKEN_KEY, data.token);
        setChat({ ready: true, visitor: data.visitor, conversation: data.conversation, messages: data.messages, config: data.config });
        setAgentsOnline(data.config.agents_online);
        connect();
      } catch {
        setChat((s) => ({ ...s, ready: true, error: "Chat is temporarily unavailable." }));
      }
    };
    start();
    const ping = setInterval(() => wsRef.current?.readyState === 1 && wsRef.current.send('{"type":"ping"}'), 25000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(ping);
      wsRef.current?.close();
    };
  }, [addMessage, resync]);

  const trackPage = useCallback((page) => {
    pageRef.current = page;
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "page", ...page }));
  }, []);

  const sendTyping = useCallback((text) => {
    const now = Date.now();
    if (text && now - typingSentRef.current < 400) return;
    typingSentRef.current = text ? now : 0;
    if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "typing", text }));
  }, []);

  const identify = useCallback(async (form) => {
    const { data } = await axios.post(`${API}/widget/identify`, form, authHeaders());
    setChat((s) => ({ ...s, visitor: data.visitor, conversation: data.conversation, messages: data.messages }));
  }, []);

  const send = useCallback(async (text) => {
    const { data } = await axios.post(`${API}/widget/messages`, { text }, authHeaders());
    addMessage(data.message);
  }, [addMessage]);

  const endChat = useCallback(async () => {
    await axios.post(`${API}/widget/end`, {}, authHeaders());
  }, []);

  return { ...chat, agentsOnline, agentTyping, connected, trackPage, sendTyping, identify, send, endChat };
}
