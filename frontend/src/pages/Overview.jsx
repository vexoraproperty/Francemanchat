import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSupport, useSupportEvents } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";
import { ago, initials, locationLabel } from "@/lib/format";

const Stat = ({ label, value, tone, testid, to }) => (
  <Link to={to} className="block rounded-lg border border-[#dfddd8] bg-white p-5 transition-colors hover:border-[#104e35]">
    <div className="fm-mono-eyebrow">{label}</div>
    <div className={`font-display mt-2 text-4xl font-semibold ${tone || "text-[#121713]"}`} data-testid={testid}>{value}</div>
  </Link>
);

export default function Overview() {
  const { api, me, visitorTyping } = useSupport();
  const [data, setData] = useState(null);
  const load = useCallback(() => api("get", "/overview").then(setData).catch((e) => toast.error(errMsg(e))), [api]);
  useEffect(() => { load(); }, [load]);
  useSupportEvents((d) => {
    if (["message", "conversation_update", "agents_update", "reconnected"].includes(d.type)) load();
    if (d.type === "visitor_update") load();
  });

  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="overview-page">
      <PageHeader tag="00 — Export desk" title={`Welcome, ${me.name?.split(" ")[0] || "agent"}`} desc="What needs your attention right now." />
      {!data ? <div className="p-8"><div className="h-32 animate-pulse rounded-lg bg-[#f1f0ec]" /></div> : (
        <div className="space-y-6 p-5 md:p-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Waiting for reply" value={data.waiting_chats} tone={data.waiting_chats ? "text-[#a12f2e]" : ""} testid="overview-waiting" to="/inbox" />
            <Stat label="Open chats" value={data.open_chats} testid="overview-open" to="/inbox" />
            <Stat label="Visitors online" value={data.visitors_online} tone="text-[#104e35]" testid="overview-visitors" to="/visitors" />
            <Stat label="Chats today" value={data.chats_today} testid="overview-today" to="/inbox" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <section className="rounded-lg border border-[#dfddd8] bg-white">
              <div className="flex items-center justify-between border-b border-[#efede8] px-5 py-4">
                <h2 className="font-display text-xl font-semibold text-[#104e35]">Active conversations</h2>
                <span className="text-xs text-[#6b746c]">{data.unassigned_chats} unassigned · {data.my_chats} mine</span>
              </div>
              {data.recent.length === 0 ? <p className="p-8 text-center text-sm text-[#6b746c]" data-testid="overview-empty">No open conversations. New chats appear here instantly.</p> :
                data.recent.map((c) => (
                  <Link key={c.id} to={`/inbox/${c.id}`} className="flex items-center gap-3 border-b border-[#efede8] px-5 py-3 last:border-0 hover:bg-[#fafaf7]" data-testid={`overview-conv-${c.id}`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#104e35]/10 text-xs font-semibold text-[#104e35]">{initials(c.visitor?.name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-medium">{c.visitor?.name}{c.last_sender === "visitor" && <span className="rounded-full bg-[#fee3e1] px-2 py-0.5 text-[10px] font-semibold text-[#a12f2e]">WAITING</span>}</div>
                      <div className="truncate text-xs text-[#4b554d]">{visitorTyping[c.visitor_id] ? <span className="italic text-[#104e35]">typing...</span> : c.last_message}</div>
                    </div>
                    <div className="text-right text-[11px] text-[#6b746c]"><div>{locationLabel(c.visitor)}</div><div>{ago(c.last_message_at)} · {c.assigned_agent_name || "Unassigned"}</div></div>
                  </Link>
                ))}
            </section>
            <section className="rounded-lg border border-[#dfddd8] bg-white">
              <div className="border-b border-[#efede8] px-5 py-4"><h2 className="font-display text-xl font-semibold text-[#104e35]">Team availability</h2></div>
              {data.agents.map((a) => (
                <div key={a.user_id} className="flex items-center gap-3 px-5 py-2.5" data-testid={`overview-agent-${a.user_id}`}>
                  <span className={`h-2 w-2 rounded-full ${a.online ? "bg-[#22a861]" : a.status === "away" ? "bg-[#e0ad62]" : "bg-[#a6b1a7]"}`} />
                  <span className="flex-1 text-sm">{a.name}</span>
                  <span className="text-xs text-[#6b746c]">{a.online ? "Online" : a.status === "away" ? "Away" : "Offline"}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
