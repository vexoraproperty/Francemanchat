import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSupport } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";
import { fmtDuration } from "@/lib/format";

const Stat = ({ label, value, detail, testid }) => (
  <div className="rounded-lg border border-[#dfddd8] bg-white p-4">
    <div className="fm-eyebrow">{label}</div>
    <div className="mt-2 text-2xl font-semibold" data-testid={testid}>{value}</div>
    {detail && <div className="mt-1 text-xs text-[#6b746c]">{detail}</div>}
  </div>
);

const Card = ({ title, children, className = "" }) => (
  <div className={`rounded-lg border border-[#dfddd8] bg-white p-5 ${className}`}><h2 className="mb-4 text-sm font-semibold">{title}</h2>{children}</div>
);

export default function Analytics() {
  const { api } = useSupport();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  useEffect(() => { api("get", "/analytics", null, { days }).then(setData).catch((e) => toast.error(errMsg(e))); }, [api, days]);

  const maxCountry = Math.max(1, ...(data?.countries || []).map((c) => c.count));
  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="analytics-page">
      <PageHeader tag="03" title="Support performance" desc="Conversation volume, response speed and agent workload.">
        <div className="flex rounded-md border border-[#dfddd8] bg-[#fafaf7] p-0.5 text-xs">
          {[7, 30, 90].map((d) => (
            <button key={d} onClick={() => setDays(d)} data-testid={`analytics-range-${d}`} className={`rounded px-3 py-1 ${days === d ? "bg-white font-medium text-[#104e35] shadow-sm" : "text-[#4b554d]"}`}>{d} days</button>
          ))}
        </div>
      </PageHeader>
      {!data ? <div className="p-8"><div className="h-32 animate-pulse rounded-lg bg-[#f1f0ec]" /></div> : (
        <div className="space-y-6 p-5 md:p-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Conversations" value={data.total_conversations} detail={`${data.open} open · ${data.closed} resolved`} testid="stat-total-conversations" />
            <Stat label="Median first response" value={fmtDuration(data.median_first_response_secs)} detail={`Average ${fmtDuration(data.avg_first_response_secs)}`} testid="stat-median-frt" />
            <Stat label="Response rate" value={`${data.response_rate}%`} detail={`${data.unanswered} open without a human reply`} testid="stat-response-rate" />
            <Stat label="Automated answers" value={data.auto_keyword + data.auto_ai} detail={`${data.auto_keyword} keyword · ${data.auto_ai} AI`} testid="stat-automated" />
          </div>
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card title="Conversations per day">
              <div className="h-56" data-testid="analytics-daily-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily}>
                    <CartesianGrid vertical={false} stroke="#efede8" />
                    <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} tick={{ fontSize: 11, fill: "#6b746c" }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b746c" }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip cursor={{ fill: "#e3f2ea" }} contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#dfddd8" }} />
                    <Bar dataKey="count" fill="#104e35" radius={[3, 3, 0, 0]} name="Conversations" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="Visitor countries">
              {data.countries.length === 0 ? <p className="text-xs text-[#6b746c]">No data yet.</p> : data.countries.map((c) => (
                <div key={c.country} className="mb-3">
                  <div className="flex justify-between text-xs"><span>{c.country}</span><span className="text-[#6b746c]">{c.count}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-[#f1f0ec]"><div className="h-1.5 rounded-full bg-[#104e35]" style={{ width: `${(100 * c.count) / maxCountry}%` }} /></div>
                </div>
              ))}
            </Card>
          </div>
          <Card title="Agent performance">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm" data-testid="analytics-agents-table">
                <thead className="text-[11px] uppercase tracking-wider text-[#6b746c]"><tr><th className="py-2 font-semibold">Agent</th><th className="py-2 font-semibold">Chats</th><th className="py-2 font-semibold">Resolved</th><th className="py-2 font-semibold">Messages sent</th><th className="py-2 font-semibold">Avg first response</th></tr></thead>
                <tbody>
                  {data.agents.map((a) => (
                    <tr key={a.user_id} className="border-t border-[#efede8]"><td className="py-2.5"><div className="font-medium">{a.name}</div><div className="text-xs text-[#6b746c]">{a.email}</div></td>
                      <td>{a.conversations}</td><td>{a.closed}</td><td>{a.messages}</td><td>{fmtDuration(a.avg_first_response_secs)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
