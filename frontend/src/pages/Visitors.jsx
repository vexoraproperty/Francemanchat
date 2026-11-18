import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSupport, useSupportEvents } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";
import { ago, initials, localTime, locationLabel, pathOf } from "@/lib/format";

const Stat = ({ label, value, detail, testid }) => (
  <div className="rounded-lg border border-[#dfddd8] bg-white p-4">
    <div className="fm-eyebrow">{label}</div>
    <div className="mt-2 text-2xl font-semibold" data-testid={testid}>{value}</div>
    {detail && <div className="mt-1 text-xs text-[#6b746c]">{detail}</div>}
  </div>
);

function TypingCell({ v, typing }) {
  if (typing) return <div className="text-[#104e35]" data-testid={`visitor-typing-${v.id}`}><div className="text-xs font-medium">Typing...</div><div className="max-w-[220px] truncate text-xs italic">"{typing}"</div></div>;
  return <span className="text-xs text-[#6b746c]">{v.online ? (v.conversation_id ? "In chat" : "Browsing") : `Left ${ago(v.last_seen)}`}</span>;
}

export default function Visitors() {
  const { api, visitorTyping } = useSupport();
  const [visitors, setVisitors] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    try { setVisitors(await api("get", "/visitors", null, { hours: 24 })); } catch (e) { toast.error(errMsg(e)); }
  }, [api]);
  useEffect(() => { load(); const t = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(t); }, [load]);

  useSupportEvents((d) => {
    if (d.type === "visitor_update") {
      setVisitors((l) => {
        const prev = l.find((v) => v.id === d.visitor.id);
        const merged = { ...prev, ...d.visitor };
        return [merged, ...l.filter((v) => v.id !== d.visitor.id)].sort((a, b) => Number(b.online) - Number(a.online));
      });
    } else if (d.type === "message" || d.type === "conversation_update") {
      const c = d.conversation;
      setVisitors((l) => l.map((v) => (v.id === c.visitor_id ? { ...v, conversation_id: c.status === "open" ? c.id : null } : v)));
    } else if (d.type === "reconnected") load();
  });

  const online = visitors.filter((v) => v.online);
  const list = showAll ? visitors : online;
  const countries = new Set(online.map((v) => v.country).filter(Boolean));
  const typingCount = online.filter((v) => visitorTyping[v.id]).length;

  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="visitors-page">
      <PageHeader tag="02 — Monitoring" title="Live visitors" desc="Everyone on your website right now — who they are, where they are, which page they are on and whether they are typing.">
        <div className="flex rounded-md border border-[#dfddd8] bg-[#fafaf7] p-0.5 text-xs">
          <button onClick={() => setShowAll(false)} data-testid="visitors-filter-online" className={`rounded px-3 py-1 ${!showAll ? "bg-white font-medium text-[#104e35] shadow-sm" : "text-[#4b554d]"}`}>Online now</button>
          <button onClick={() => setShowAll(true)} data-testid="visitors-filter-24h" className={`rounded px-3 py-1 ${showAll ? "bg-white font-medium text-[#104e35] shadow-sm" : "text-[#4b554d]"}`}>Last 24 hours</button>
        </div>
      </PageHeader>
      <div className="space-y-6 p-5 md:p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Online now" value={online.length} testid="stat-visitors-online" />
          <Stat label="In a chat" value={online.filter((v) => v.conversation_id).length} testid="stat-visitors-chatting" />
          <Stat label="Typing" value={typingCount} testid="stat-visitors-typing" />
          <Stat label="Countries" value={countries.size} detail={[...countries].slice(0, 3).join(", ")} testid="stat-visitors-countries" />
        </div>
        <div className="overflow-x-auto rounded-lg border border-[#dfddd8] bg-white">
          <table className="w-full min-w-[820px] text-left text-sm" data-testid="visitors-table">
            <thead className="border-b border-[#dfddd8] bg-[#fafaf7] text-[11px] uppercase tracking-wider text-[#6b746c]">
              <tr><th className="px-4 py-3 font-semibold">Visitor</th><th className="px-4 py-3 font-semibold">Location</th><th className="px-4 py-3 font-semibold">Current page</th><th className="px-4 py-3 font-semibold">Activity</th><th className="px-4 py-3 font-semibold">Pages</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#6b746c]" data-testid="visitors-empty">No visitors {showAll ? "in the last 24 hours" : "online right now"}. Open the website in another tab to see yourself appear.</td></tr>
              )}
              {list.map((v) => (
                <tr key={v.id} className="border-b border-[#efede8] last:border-0" data-testid={`visitor-row-${v.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#104e35]/10 text-[11px] font-semibold text-[#104e35]">{initials(v.name)}</div>
                        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${v.online ? "bg-[#22a861]" : "bg-[#a6b1a7]"}`} /></div>
                      <div className="min-w-0"><div className="font-medium">{v.name}</div><div className="text-xs text-[#6b746c]">{v.email || "Not identified"}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2">{v.country_code && <span className="rounded bg-[#f1f0ec] px-1 text-[10px] font-semibold text-[#4b554d]">{v.country_code}</span>}<span>{locationLabel(v)}</span></div>
                    <div className="text-xs text-[#6b746c]">{localTime(v.timezone) && `Local ${localTime(v.timezone)}`} · {v.device}</div></td>
                  <td className="px-4 py-3"><div className="max-w-[240px] truncate">{v.page_title || "—"}</div><div className="max-w-[240px] truncate text-xs text-[#6b746c]">{pathOf(v.current_page)}</div></td>
                  <td className="px-4 py-3"><TypingCell v={v} typing={v.online && visitorTyping[v.id]} /></td>
                  <td className="px-4 py-3 text-[#4b554d]">{v.pages_viewed || 0}</td>
                  <td className="px-4 py-3 text-right">{v.conversation_id && (
                    <Link to={`/inbox/${v.conversation_id}`} className="rounded-md border border-[#104e35] px-3 py-1.5 text-xs font-medium text-[#104e35] hover:bg-[#104e35] hover:text-white" data-testid={`visitor-open-chat-${v.id}`}>Open chat</Link>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
