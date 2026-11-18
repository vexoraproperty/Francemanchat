import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Info, SendHorizontal, Zap, CheckCircle2, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TypingDots } from "@/components/widget/WidgetThread";
import { fmtTime, locationLabel, pathOf } from "@/lib/format";

function Message({ m }) {
  if (m.sender_type === "system") {
    return <div className="py-1 text-center text-[11px] text-[#6b746c]">{m.text} · {fmtTime(m.created_at)}</div>;
  }
  const visitor = m.sender_type === "visitor";
  const bot = m.sender_type === "bot";
  return (
    <div className={`flex flex-col ${visitor ? "items-start" : "items-end"}`} data-testid={`thread-message-${m.sender_type}`}>
      <span className="mb-1 text-[11px] text-[#6b746c]">
        {m.sender_name}{bot ? ` · Automated${m.kind ? ` (${m.kind === "ai" ? "AI" : m.kind})` : ""}` : ""} · {fmtTime(m.created_at)}
      </span>
      <div className={`max-w-[75%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-sm leading-5 ${
        visitor ? "bg-white ring-1 ring-[#dfddd8]" : bot ? "border-r-2 border-[#104e35] bg-[#e3f2ea]" : "bg-[#104e35] text-white"}`}>
        {m.text}
      </div>
    </div>
  );
}

function Composer({ onSend, onTyping, quickAnswers, disabled }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const idle = useRef(null);
  const typed = (v) => {
    setText(v);
    onTyping(true);
    clearTimeout(idle.current);
    idle.current = setTimeout(() => onTyping(false), 2000);
  };
  const submit = async () => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await onSend(t); setText(""); onTyping(false); } finally { setBusy(false); }
  };
  return (
    <div className="border-t border-[#dfddd8] bg-white p-3">
      <div className="flex items-end gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button className="flex h-[42px] w-[42px] items-center justify-center rounded-md border border-[#dfddd8] text-[#104e35] hover:bg-[#e3f2ea]" title="Quick answers" data-testid="composer-quick-answers-button"><Zap className="h-4 w-4" /></button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-1">
            {quickAnswers.map((q) => (
              <button key={q.id} onClick={() => setText(q.answer)} data-testid={`composer-quick-answer-${q.id}`}
                className="block w-full rounded px-3 py-2 text-left hover:bg-[#fafaf7]">
                <div className="text-sm font-medium">{q.label}</div>
                <div className="line-clamp-2 text-xs text-[#6b746c]">{q.answer}</div>
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <textarea rows={2} value={text} disabled={disabled} onChange={(e) => typed(e.target.value)} data-testid="agent-reply-input"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Reply to the customer. Enter to send, Shift+Enter for a new line"
          className="max-h-40 min-h-[42px] flex-1 resize-none rounded-md border border-[#dfddd8] px-3 py-2.5 text-sm focus:border-[#104e35] focus:outline-none focus:ring-2 focus:ring-[#104e35]/20" />
        <button onClick={submit} disabled={busy || !text.trim()} data-testid="agent-send-button"
          className="flex h-[42px] items-center gap-2 rounded-md bg-[#104e35] px-4 text-sm font-medium text-white hover:bg-[#03402a] disabled:opacity-40">
          <SendHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
}

export function ChatThread({ detail, typing, otherAgentTyping, onSend, onTyping, onStatus, onBack, onInfo, quickAnswers }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [detail?.messages?.length, typing]);
  const v = detail.visitor || {};
  const closed = detail.status === "closed";
  return (
    <div className="flex h-full min-w-0 flex-col" data-testid="chat-thread">
      <div className="flex items-center gap-3 border-b border-[#dfddd8] bg-white px-4 py-3">
        <button onClick={onBack} className="rounded p-1 hover:bg-[#f1f0ec] lg:hidden" data-testid="thread-back-button"><ArrowLeft className="h-4 w-4" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold" data-testid="thread-visitor-name">{v.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.online ? "bg-[#e3f2ea] text-[#1d643d]" : "bg-[#f1f0ec] text-[#6b746c]"}`} data-testid="thread-visitor-status">{v.online ? "ONLINE" : "OFFLINE"}</span>
          </div>
          <div className="truncate text-xs text-[#6b746c]">{locationLabel(v)}{v.online && v.current_page ? ` · on ${pathOf(v.current_page)}` : ""}</div>
        </div>
        <button onClick={() => onStatus(closed ? "open" : "closed")} data-testid="thread-toggle-status-button"
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${closed ? "border-[#dfddd8] hover:bg-[#f1f0ec]" : "border-[#104e35] text-[#104e35] hover:bg-[#104e35] hover:text-white"}`}>
          {closed ? <><RotateCcw className="h-3.5 w-3.5" />Reopen</> : <><CheckCircle2 className="h-3.5 w-3.5" />Resolve</>}
        </button>
        <button onClick={onInfo} className="rounded-md border border-[#dfddd8] p-1.5 hover:bg-[#f1f0ec] xl:hidden" data-testid="thread-info-button"><Info className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafaf7] px-4 py-5 md:px-6 fm-scroll" data-testid="thread-messages">
        {detail.messages.map((m) => <Message key={m.id} m={m} />)}
        {typing && (
          <div className="flex flex-col items-start gap-1" data-testid="thread-visitor-typing">
            <TypingDots label={`${v.name} is typing`} />
            <div className="max-w-[75%] rounded-lg border border-dashed border-[#dfddd8] bg-white/60 px-3 py-2 text-sm italic text-[#4b554d]">{typing}</div>
          </div>
        )}
        <div ref={end} />
      </div>
      {otherAgentTyping && <div className="bg-white px-4 pt-2 text-[11px] text-[#6b746c]">{otherAgentTyping} is replying...</div>}
      <Composer onSend={onSend} onTyping={onTyping} quickAnswers={quickAnswers} />
    </div>
  );
}
