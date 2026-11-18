import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ago, fmtDateTime, localTime, locationLabel, pathOf } from "@/lib/format";

const Row = ({ label, children, testid }) => (
  <div className="flex gap-3 py-1.5 text-sm">
    <span className="w-24 shrink-0 text-xs text-[#6b746c]">{label}</span>
    <span className="min-w-0 flex-1 break-words text-[#121713]" data-testid={testid}>{children || "—"}</span>
  </div>
);

const Section = ({ tag, title, children }) => (
  <section className="border-b border-[#efede8] px-5 py-4">
    <div className="fm-eyebrow mb-2">§ {tag} — {title}</div>
    {children}
  </section>
);

export function VisitorDetails({ detail, agents, me, onAssign, typing }) {
  const v = detail.visitor || {};
  const canAssignOthers = me.role === "admin";
  const options = canAssignOthers ? agents : agents.filter((a) => a.user_id === me.user_id);
  return (
    <div className="h-full overflow-y-auto bg-white fm-scroll" data-testid="visitor-details-panel">
      <Section tag="01" title="Visitor">
        <Row label="Name" testid="visitor-detail-name">{v.name}</Row>
        <Row label="Email" testid="visitor-detail-email">{v.email}</Row>
        <Row label="Interest">{v.commodity}</Row>
        <Row label="Status" testid="visitor-detail-status">
          <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${v.online ? "bg-[#22a861]" : "bg-[#a6b1a7]"}`} />{v.online ? "Online now" : `Last seen ${ago(v.last_seen)}`}</span>
        </Row>
        <Row label="Activity" testid="visitor-detail-typing">{typing ? <span className="text-[#104e35]">Typing a message</span> : v.online ? "Browsing" : "Inactive"}</Row>
      </Section>
      <Section tag="02" title="Location & device">
        <Row label="Country" testid="visitor-detail-country">{locationLabel(v)}{v.country_code ? ` (${v.country_code})` : ""}</Row>
        <Row label="Local time">{localTime(v.timezone) ? `${localTime(v.timezone)} · ${v.timezone}` : ""}</Row>
        <Row label="Device">{v.device}</Row>
      </Section>
      <Section tag="03" title="On the website">
        <Row label="Current page" testid="visitor-detail-current-page">{v.current_page ? <a href={v.current_page} target="_blank" rel="noreferrer" className="text-[#104e35] hover:underline">{v.page_title || pathOf(v.current_page)}</a> : ""}</Row>
        <Row label="Pages viewed">{String(v.pages_viewed ?? 0)}</Row>
        <Row label="Referrer">{v.referrer ? pathOf(v.referrer) : "Direct"}</Row>
        {v.page_history?.length > 0 && (
          <ol className="mt-2 space-y-1.5 border-l border-[#dfddd8] pl-3" data-testid="visitor-page-history">
            {[...v.page_history].reverse().slice(0, 8).map((p, i) => (
              <li key={i} className="text-xs"><div className="truncate text-[#121713]">{p.title || pathOf(p.url)}</div><div className="text-[#6b746c]">{pathOf(p.url)} · {ago(p.at)}</div></li>
            ))}
          </ol>
        )}
      </Section>
      <Section tag="04" title="Assignment">
        <Select value={detail.assigned_agent_id || "none"} onValueChange={(val) => onAssign(val === "none" ? null : val)}>
          <SelectTrigger className="h-9 text-sm" data-testid="assign-agent-select"><SelectValue placeholder="Unassigned" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Unassigned</SelectItem>
            {detail.assigned_agent_id && !options.some((a) => a.user_id === detail.assigned_agent_id) && (
              <SelectItem value={detail.assigned_agent_id} disabled>{detail.assigned_agent_name}</SelectItem>
            )}
            {options.map((a) => <SelectItem key={a.user_id} value={a.user_id} data-testid={`assign-option-${a.user_id}`}>{a.name || a.email}{a.online ? " · online" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
        <p className="mt-2 text-[11px] text-[#6b746c]">Started {fmtDateTime(detail.created_at)}</p>
      </Section>
      {detail.previous?.length > 0 && (
        <Section tag="05" title="Previous chats">
          {detail.previous.map((p) => (
            <div key={p.id} className="py-1.5 text-xs"><div className="text-[#4b554d]">{fmtDateTime(p.created_at)} · {p.status}</div><div className="truncate">{p.last_message}</div></div>
          ))}
        </Section>
      )}
    </div>
  );
}
