import { Search } from "lucide-react";
import { ago, initials, locationLabel } from "@/lib/format";

const STATUS = [["open", "Open"], ["closed", "Closed"], ["all", "All"]];
const ASSIGNED = [["all", "Everyone"], ["me", "Mine"], ["unassigned", "Unassigned"]];

function Pills({ options, value, onChange, testid }) {
  return (
    <div className="flex rounded-md border border-[#dfddd8] bg-[#fafaf7] p-0.5">
      {options.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} data-testid={`${testid}-${k}`}
          className={`flex-1 rounded px-2.5 py-1 text-xs transition-colors ${value === k ? "bg-white font-medium text-[#104e35] shadow-sm" : "text-[#4b554d] hover:text-[#121713]"}`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Row({ c, active, typing, onClick }) {
  const v = c.visitor || {};
  return (
    <button onClick={onClick} data-testid={`conversation-item-${c.id}`}
      className={`flex w-full gap-3 border-b border-[#efede8] px-4 py-3.5 text-left transition-colors ${active ? "bg-[#e3f2ea]" : "hover:bg-[#fafaf7]"}`}>
      <div className="relative shrink-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#104e35]/10 text-xs font-semibold text-[#104e35]">{initials(v.name)}</div>
        {v.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#22a861] ring-2 ring-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-sm ${c.unread_agent ? "font-semibold" : "font-medium"}`}>{v.name || "Visitor"}</span>
          {v.country_code && <span className="rounded bg-[#f1f0ec] px-1 text-[10px] font-semibold text-[#4b554d]">{v.country_code}</span>}
          <span className="ml-auto shrink-0 text-[11px] text-[#6b746c]">{ago(c.last_message_at)}</span>
        </div>
        <div className="mt-0.5 truncate text-xs text-[#4b554d]">
          {typing ? <span className="italic text-[#104e35]">typing: {typing}</span> : c.last_message || "No messages yet"}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#6b746c]">
          <span className="truncate">{locationLabel(v)}</span>
          <span className="ml-auto shrink-0">{c.status === "closed" ? "Closed" : c.assigned_agent_name || "Unassigned"}</span>
          {c.unread_agent > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#104e35] px-1 text-[10px] font-semibold text-white" data-testid={`conversation-unread-${c.id}`}>{c.unread_agent}</span>}
        </div>
      </div>
    </button>
  );
}

export function ConversationList({ convs, loading, selectedId, onSelect, status, setStatus, assigned, setAssigned, q, setQ, typingMap }) {
  return (
    <div className="flex h-full flex-col bg-white" data-testid="conversation-list">
      <div className="space-y-2.5 border-b border-[#dfddd8] p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b746c]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, country, message"
            className="w-full rounded-md border border-[#dfddd8] py-2 pl-8 pr-3 text-sm focus:border-[#104e35] focus:outline-none" data-testid="conversation-search-input" />
        </div>
        <Pills options={STATUS} value={status} onChange={setStatus} testid="filter-status" />
        <Pills options={ASSIGNED} value={assigned} onChange={setAssigned} testid="filter-assigned" />
      </div>
      <div className="flex-1 overflow-y-auto fm-scroll">
        {loading && !convs.length ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded bg-[#f1f0ec]" />)}</div>
        ) : !convs.length ? (
          <div className="p-8 text-center" data-testid="conversation-list-empty">
            <p className="text-sm font-medium">No conversations here</p>
            <p className="mt-1 text-xs text-[#6b746c]">New chats from the website appear instantly.</p>
          </div>
        ) : convs.map((c) => (
          <Row key={c.id} c={c} active={c.id === selectedId} typing={typingMap[c.visitor_id]} onClick={() => onSelect(c.id)} />
        ))}
      </div>
    </div>
  );
}
