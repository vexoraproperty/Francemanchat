import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { fmtTime } from "@/lib/format";

export const TypingDots = ({ label }) => (
  <div className="flex items-center gap-2 text-xs text-[#4b554d]" data-testid="typing-indicator" aria-live="polite">
    <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-2 ring-1 ring-[#dfddd8] text-[#104e35]">
      <span className="fm-dot" /><span className="fm-dot" /><span className="fm-dot" />
    </span>
    {label}
  </div>
);

function Bubble({ m }) {
  if (m.sender_type === "system") {
    return <div className="text-center text-[11px] text-[#6b746c]" data-testid="widget-message-system">{m.text} · {fmtTime(m.created_at)}</div>;
  }
  const mine = m.sender_type === "visitor";
  const bot = m.sender_type === "bot";
  return (
    <div className={`flex flex-col ${mine ? "items-end" : "items-start"}`} data-testid={`widget-message-${m.sender_type}`}>
      {!mine && (
        <span className="mb-1 text-[11px] font-medium text-[#4b554d]">
          {m.sender_name || "Franceman"}{bot ? " · Automated" : ""}
        </span>
      )}
      <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-sm leading-5 ${
        mine ? "bg-[#104e35] text-white rounded-br-sm"
          : bot ? "bg-[#e3f2ea] text-[#121713] border-l-2 border-[#104e35] rounded-bl-sm"
          : "bg-white text-[#121713] ring-1 ring-[#dfddd8] rounded-bl-sm"}`}>
        {m.text}
      </div>
      <span className="mt-1 text-[10px] text-[#6b746c]">{fmtTime(m.created_at)}</span>
    </div>
  );
}

export function WidgetThread({ messages, typing }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length, typing]);
  return (
    <div className="flex-1 space-y-3 overflow-y-auto bg-[#fafaf7] px-4 py-4 fm-scroll" data-testid="widget-thread" aria-live="polite">
      {messages.map((m) => <Bubble key={m.id} m={m} />)}
      {typing && <TypingDots label={`${typing} is typing`} />}
      <div ref={end} />
    </div>
  );
}

export function WidgetComposer({ onSend, onTyping, quickAnswers, disabled }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (value) => {
    const t = (value ?? text).trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onSend(t);
      if (value === undefined) setText("");
      onTyping("");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="border-t border-[#dfddd8] bg-white">
      {quickAnswers?.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-3 pt-3 fm-scroll" data-testid="quick-answer-chips">
          {quickAnswers.map((q) => (
            <button key={q.id} type="button" disabled={disabled || busy} onClick={() => submit(q.label)} data-testid={`quick-answer-${q.id}`}
              className="shrink-0 rounded-full border border-[#dfddd8] px-3 py-1.5 text-xs text-[#104e35] transition-colors hover:border-[#104e35] hover:bg-[#e3f2ea] disabled:opacity-50">
              {q.label}
            </button>
          ))}
        </div>
      )}
      <form className="flex items-end gap-2 p-3" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea rows={1} value={text} disabled={disabled} data-testid="widget-message-input"
          onChange={(e) => { setText(e.target.value); onTyping(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Type your message..."
          className="max-h-28 min-h-[42px] flex-1 resize-none rounded-md border border-[#dfddd8] px-3 py-2.5 text-sm focus:border-[#104e35] focus:outline-none focus:ring-2 focus:ring-[#104e35]/25" />
        <button type="submit" disabled={disabled || busy || !text.trim()} aria-label="Send message" data-testid="widget-send-button"
          className="flex h-[42px] w-[42px] items-center justify-center rounded-md bg-[#104e35] text-white transition-colors hover:bg-[#03402a] disabled:opacity-40">
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
