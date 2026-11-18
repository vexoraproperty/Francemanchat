import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatThread } from "@/components/inbox/ChatThread";
import { VisitorDetails } from "@/components/inbox/VisitorDetails";
import { useSupport, useSupportEvents } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";

const sortConvs = (list) => [...list].sort((a, b) => (b.last_message_at || "").localeCompare(a.last_message_at || ""));

export default function Inbox() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, me, send, visitorTyping, agentTyping } = useSupport();
  const [status, setStatus] = useState("open");
  const [assigned, setAssigned] = useState("all");
  const [q, setQ] = useState("");
  const [convs, setConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [agents, setAgents] = useState([]);
  const [quick, setQuick] = useState([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const filters = useRef({});
  filters.current = { status, assigned, q, id };

  const loadList = useCallback(async () => {
    setLoading(true);
    try { setConvs(await api("get", "/conversations", null, { status, assigned, q })); }
    catch (e) { toast.error(errMsg(e)); }
    finally { setLoading(false); }
  }, [api, status, assigned, q]);

  const loadDetail = useCallback(async () => {
    if (!id) return setDetail(null);
    try {
      setDetail(await api("get", `/conversations/${id}`));
      api("post", `/conversations/${id}/read`);
      setConvs((l) => l.map((c) => (c.id === id ? { ...c, unread_agent: 0 } : c)));
    } catch (e) { toast.error(errMsg(e)); navigate("/inbox"); }
  }, [api, id, navigate]);

  useEffect(() => { const t = setTimeout(loadList, q ? 250 : 0); return () => clearTimeout(t); }, [loadList, q]);
  useEffect(() => { loadDetail(); }, [loadDetail]);
  useEffect(() => {
    api("get", "/agents").then(setAgents).catch(() => {});
    api("get", "/settings").then((s) => setQuick(s.quick_answers || [])).catch(() => {});
  }, [api]);

  const matches = (c) => {
    const f = filters.current;
    if (f.status !== "all" && c.status !== f.status) return false;
    if (f.assigned === "me" && c.assigned_agent_id !== me.user_id) return false;
    if (f.assigned === "unassigned" && c.assigned_agent_id) return false;
    return true;
  };

  const upsert = (conv) => setConvs((list) => {
    const exists = list.some((c) => c.id === conv.id);
    const next = conv.id === filters.current.id ? { ...conv, unread_agent: 0 } : conv;
    const rest = list.filter((c) => c.id !== conv.id);
    if (!matches(conv) || (filters.current.q && !exists)) return rest;
    return sortConvs([next, ...rest]);
  });

  useSupportEvents((d) => {
    const current = filters.current.id;
    if (d.type === "message") {
      upsert(d.conversation);
      if (d.message.conversation_id === current) {
        setDetail((s) => (s && !s.messages.some((m) => m.id === d.message.id) ? { ...s, ...d.conversation, messages: [...s.messages, d.message] } : s));
        if (d.message.sender_type === "visitor") api("post", `/conversations/${current}/read`);
      } else if (d.message.sender_type === "visitor" && document.hidden !== false) {
        document.title = "New message · Franceman Support";
      }
    } else if (d.type === "conversation_update") {
      upsert(d.conversation);
      if (d.conversation.id === current) setDetail((s) => (s ? { ...s, ...d.conversation } : s));
    } else if (d.type === "visitor_update") {
      setConvs((l) => l.map((c) => (c.visitor_id === d.visitor.id ? { ...c, visitor: d.visitor } : c)));
      setDetail((s) => (s && s.visitor_id === d.visitor.id ? { ...s, visitor: d.visitor } : s));
    } else if (d.type === "agents_update") {
      setAgents((l) => l.map((a) => ({ ...a, online: d.online_agent_ids.includes(a.user_id) })));
    } else if (d.type === "reconnected") {
      loadList(); loadDetail();
    }
  });

  const sendReply = async (text) => {
    try {
      const msg = await api("post", `/conversations/${id}/messages`, { text });
      setDetail((s) => (s.messages.some((m) => m.id === msg.id) ? s : { ...s, messages: [...s.messages, msg] }));
    } catch (e) { toast.error(errMsg(e)); throw e; }
  };
  const patch = async (body) => {
    try { setDetail({ ...(await api("patch", `/conversations/${id}`, body)), messages: detail.messages, previous: detail.previous }); loadDetail(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const typingSent = useRef(false);
  const onTyping = (typing) => {
    if (typing === typingSent.current) return;
    typingSent.current = typing;
    send({ type: "typing", conversation_id: id, typing });
  };

  const other = detail && agentTyping[detail.id] && agentTyping[detail.id].agent_id !== me.user_id ? agentTyping[detail.id].name : null;
  const details = detail && (
    <VisitorDetails detail={detail} agents={agents} me={me} typing={visitorTyping[detail.visitor_id]}
      onAssign={(uid) => patch(uid ? { assigned_agent_id: uid } : { unassign: true })} />
  );

  return (
    <div className="flex h-full" data-testid="inbox-page">
      <div className={`w-full shrink-0 border-r border-[#dfddd8] lg:block lg:w-[340px] ${id ? "hidden" : "block"}`}>
        <ConversationList convs={convs} loading={loading} selectedId={id} onSelect={(cid) => navigate(`/inbox/${cid}`)}
          status={status} setStatus={setStatus} assigned={assigned} setAssigned={setAssigned} q={q} setQ={setQ} typingMap={visitorTyping} />
      </div>
      <div className={`min-w-0 flex-1 ${id ? "flex" : "hidden lg:flex"}`}>
        {detail ? (
          <>
            <div className="min-w-0 flex-1">
              <ChatThread detail={detail} typing={visitorTyping[detail.visitor_id]} otherAgentTyping={other} onSend={sendReply}
                onTyping={onTyping} onStatus={(s) => patch({ status: s })} onBack={() => navigate("/inbox")} onInfo={() => setInfoOpen(true)} quickAnswers={quick} />
            </div>
            <div className="hidden w-[320px] shrink-0 border-l border-[#dfddd8] xl:block">{details}</div>
            <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
              <SheetContent className="w-[340px] p-0 sm:max-w-[360px]"><SheetTitle className="sr-only">Visitor details</SheetTitle>{details}</SheetContent>
            </Sheet>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center" data-testid="inbox-empty-state">
            <MessagesSquare className="h-8 w-8 text-[#a6b1a7]" />
            <p className="mt-3 text-sm font-medium">Select a conversation</p>
            <p className="mt-1 max-w-xs text-xs text-[#6b746c]">Chats started from the Franceman website widget appear here in real time.</p>
          </div>
        )}
      </div>
    </div>
  );
}
