import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSupport } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";
import { ago, initials, locationLabel } from "@/lib/format";

export default function Contacts() {
  const { api } = useSupport();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    const t = setTimeout(() => api("get", "/contacts", null, { q }).then(setRows).catch((e) => toast.error(errMsg(e))), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [api, q]);

  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="contacts-page">
      <PageHeader tag="03 — Contacts" title="Contacts" desc="Every buyer who has started a chat, with their details and history.">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b746c]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, country, product" data-testid="contacts-search-input"
            className="w-full rounded-md border border-[#dfddd8] py-2 pl-8 pr-3 text-sm focus:border-[#104e35] focus:outline-none" />
        </div>
      </PageHeader>
      <div className="p-5 md:p-8">
        <div className="overflow-x-auto rounded-lg border border-[#dfddd8] bg-white">
          <table className="w-full min-w-[760px] text-left text-sm" data-testid="contacts-table">
            <thead className="border-b border-[#dfddd8] bg-[#fafaf7] text-[11px] uppercase tracking-wider text-[#6b746c]">
              <tr><th className="px-4 py-3 font-semibold">Contact</th><th className="px-4 py-3 font-semibold">Location</th><th className="px-4 py-3 font-semibold">Interest</th><th className="px-4 py-3 font-semibold">Chats</th><th className="px-4 py-3 font-semibold">Last seen</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody>
              {rows && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-[#6b746c]" data-testid="contacts-empty">No contacts yet. Visitors appear here once they start a chat.</td></tr>}
              {(rows || []).map((c) => (
                <tr key={c.id} className="border-b border-[#efede8] last:border-0" data-testid={`contact-row-${c.id}`}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3">
                    <div className="relative"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#104e35]/10 text-[11px] font-semibold text-[#104e35]">{initials(c.name)}</div>
                      {c.online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-[#22a861] ring-2 ring-white" />}</div>
                    <div><div className="font-medium">{c.name}</div><a href={`mailto:${c.email}`} className="text-xs text-[#104e35] hover:underline">{c.email}</a></div></div></td>
                  <td className="px-4 py-3">{locationLabel(c)}</td>
                  <td className="px-4 py-3 text-[#4b554d]">{c.commodity || "—"}</td>
                  <td className="px-4 py-3">{c.chats}</td>
                  <td className="px-4 py-3 text-xs text-[#6b746c]">{c.online ? "Online now" : ago(c.last_seen)}</td>
                  <td className="px-4 py-3 text-right">{c.latest_conversation_id && <Link to={`/inbox/${c.latest_conversation_id}`} className="rounded-md border border-[#104e35] px-3 py-1.5 text-xs font-medium text-[#104e35] hover:bg-[#104e35] hover:text-white" data-testid={`contact-open-${c.id}`}>Open chat</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
