import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSupport } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";
import { fmtDateTime, initials } from "@/lib/format";

const ROLE_LABEL = { admin: "Administrator", agent: "Support agent", pending: "Pending approval" };

export default function Team() {
  const { api, me } = useSupport();
  const [data, setData] = useState({ roles: [], users: [] });
  const load = useCallback(() => api("get", "/users").then(setData).catch((e) => toast.error(errMsg(e))), [api]);
  useEffect(() => { load(); }, [load]);

  const change = async (uid, role) => {
    try { await api("patch", `/users/${uid}/role`, { role }); toast.success("Role updated"); load(); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const pending = data.users.filter((u) => u.role === "pending").length;

  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="team-page">
      <PageHeader tag="06 — Administration" title="Team & roles" desc="Approve new agents and decide who can administer the support desk." />
      <div className="space-y-6 p-5 md:p-8">
        <div className="rounded-lg border border-[#dfddd8] bg-white p-5 text-sm text-[#4b554d]">
          To add an agent, ask them to create an account at <span className="font-medium text-[#121713]">{window.location.origin}/sign-up</span> with email and password or Google.
          They appear below as <span className="font-medium">Pending approval</span> and cannot see any conversation until you give them a role.
          {pending > 0 && <span className="ml-1 font-medium text-[#825a17]" data-testid="team-pending-count">{pending} waiting for approval.</span>}
        </div>
        <div className="overflow-x-auto rounded-lg border border-[#dfddd8] bg-white">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="team-table">
            <thead className="border-b border-[#dfddd8] bg-[#fafaf7] text-[11px] uppercase tracking-wider text-[#6b746c]">
              <tr><th className="px-4 py-3 font-semibold">Member</th><th className="px-4 py-3 font-semibold">Availability</th><th className="px-4 py-3 font-semibold">Joined</th><th className="px-4 py-3 font-semibold">Role</th></tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.user_id} className="border-b border-[#efede8] last:border-0" data-testid={`team-row-${u.user_id}`}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#104e35]/10 text-[11px] font-semibold text-[#104e35]">{initials(u.name)}</div>
                    <div><div className="font-medium">{u.name}{u.user_id === me.user_id && <span className="ml-1 text-xs text-[#6b746c]">(you)</span>}</div><div className="text-xs text-[#6b746c]">{u.email}</div></div></div></td>
                  <td className="px-4 py-3"><span className="inline-flex items-center gap-1.5 text-xs"><span className={`h-2 w-2 rounded-full ${u.online ? "bg-[#22a861]" : u.status === "away" ? "bg-[#e0ad62]" : "bg-[#a6b1a7]"}`} />{u.online ? "Online" : u.status === "away" ? "Away" : "Offline"}</span></td>
                  <td className="px-4 py-3 text-xs text-[#6b746c]">{fmtDateTime(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <Select value={u.role} onValueChange={(r) => change(u.user_id, r)}>
                      <SelectTrigger className="h-9 w-48 text-sm" data-testid={`team-role-select-${u.user_id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{data.roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r] || r}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
