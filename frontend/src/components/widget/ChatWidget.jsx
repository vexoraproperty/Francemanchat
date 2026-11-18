import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Loader2, ExternalLink } from "lucide-react";
import { LogoMark } from "@/components/Brand";
import { PreChatForm } from "./PreChatForm";
import { WidgetThread, WidgetComposer } from "./WidgetThread";
import { useVisitorChat } from "./useVisitorChat";

function openTawk(siteId, visitor) {
  if (window.Tawk_API?.maximize && window.__fmTawkLoaded) return window.Tawk_API.maximize();
  window.Tawk_API = window.Tawk_API || {};
  window.Tawk_LoadStart = new Date();
  if (visitor?.identified) window.Tawk_API.visitor = { name: visitor.name, email: visitor.email };
  window.Tawk_API.onLoad = () => { window.__fmTawkLoaded = true; window.Tawk_API.maximize(); };
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://embed.tawk.to/${siteId}/default`;
  s.charset = "UTF-8";
  s.setAttribute("crossorigin", "*");
  document.body.appendChild(s);
}

function Header({ online, onClose, onEnd, canEnd }) {
  return (
    <div className="flex items-center gap-3 bg-[#104e35] px-4 py-3.5 text-white">
      <LogoMark size={38} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">Franceman Export Desk</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/80" data-testid="widget-status">
          <span className={`h-2 w-2 rounded-full ${online ? "bg-[#6ee7a8]" : "bg-[#e0ad62]"}`} />
          {online ? "Online — our team is available" : "Offline — leave a message"}
        </div>
      </div>
      {canEnd && (
        <button onClick={onEnd} className="rounded-md px-2 py-1 text-xs text-white/80 hover:bg-white/10 hover:text-white" data-testid="widget-end-chat-button">End chat</button>
      )}
      <button onClick={onClose} aria-label="Minimise chat" className="rounded-md p-1.5 hover:bg-white/10" data-testid="widget-close-button">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

const PANEL = {
  auto: "fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(600px,calc(100vh-120px))] sm:w-[380px] sm:rounded-xl sm:ring-1 sm:ring-black/5",
  floating: "fixed bottom-24 right-6 h-[min(600px,calc(100vh-120px))] w-[380px] rounded-xl ring-1 ring-black/5",
  full: "fixed inset-0",
};
const LAUNCHER_OPEN = { auto: "hidden sm:flex", floating: "flex", full: "hidden" };

export function ChatWidget({ initialPage, page, onOpenChange, layout = "auto" }) {
  const chat = useVisitorChat(initialPage);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const seen = useRef(0);
  const { visitor, messages, conversation, config, agentsOnline, trackPage } = chat;

  useEffect(() => { if (page) trackPage(page); }, [page, trackPage]);
  useEffect(() => { onOpenChange?.(open); }, [open, onOpenChange]);
  useEffect(() => {
    if (open) { seen.current = messages.length; setUnread(0); return; }
    const fresh = messages.slice(seen.current).filter((m) => m.sender_type === "agent" || m.sender_type === "bot").length;
    setUnread(fresh);
  }, [messages, open]);

  const online = agentsOnline > 0;
  const closed = conversation?.status === "closed";
  const tawkId = !online ? config?.tawk_site_id : null;

  return (
    <>
      {open && (
        <div data-testid="chat-widget-panel" className={`fm-rise fm-shadow-float z-[60] flex flex-col overflow-hidden bg-white ${PANEL[layout]}`}>
          <Header online={online} onClose={() => setOpen(false)} onEnd={chat.endChat} canEnd={visitor?.identified && conversation && !closed} />
          {!chat.ready ? (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-[#104e35]" /></div>
          ) : chat.error ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-[#a12f2e]">{chat.error}</div>
          ) : !visitor?.identified ? (
            <PreChatForm welcome={config?.welcome_message} offline={!online ? config?.offline_message : ""} onSubmit={chat.identify} />
          ) : (
            <>
              <WidgetThread messages={messages} typing={chat.agentTyping} />
              {closed && (
                <div className="border-t border-[#dfddd8] bg-[#fafaf7] px-4 py-2 text-center text-xs text-[#4b554d]" data-testid="widget-chat-ended">
                  This chat has ended. Send a new message to start another conversation.
                </div>
              )}
              {!chat.connected && <div className="bg-[#fee3e1] px-4 py-1.5 text-center text-[11px] text-[#a12f2e]">Reconnecting...</div>}
              <WidgetComposer onSend={chat.send} onTyping={chat.sendTyping} quickAnswers={config?.quick_answers} />
            </>
          )}
          {tawkId && (
            <button onClick={() => openTawk(tawkId, visitor)} data-testid="widget-tawk-fallback-button"
              className="flex items-center justify-center gap-1.5 border-t border-[#dfddd8] bg-[#fafaf7] py-2 text-xs text-[#104e35] hover:underline">
              Continue on our backup live chat <ExternalLink className="h-3 w-3" />
            </button>
          )}
          <div className="bg-white pb-[env(safe-area-inset-bottom)] text-center text-[10px] tracking-wide text-[#6b746c] py-1.5 border-t border-[#f0eee9]">Franceman Exportation LLP · Secure chat</div>
        </div>
      )}
      <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Close chat" : "Open chat"} data-testid="chat-widget-launcher"
        className={`fm-shadow-float fixed bottom-6 right-6 z-[61] h-14 w-14 items-center justify-center rounded-full bg-[#104e35] text-white transition-colors hover:bg-[#03402a] ${open ? LAUNCHER_OPEN[layout] : "flex"}`}>
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#a12f2e] px-1 text-[11px] font-semibold" data-testid="chat-widget-unread-badge">{unread}</span>
        )}
        {!open && <span className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${online ? "bg-[#22a861]" : "bg-[#a6b1a7]"}`} />}
      </button>
    </>
  );
}
