import { NavLink, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/react";
import { Inbox, Radar, BarChart3, Users, Settings2, Loader2, ShieldAlert, LayoutDashboard, Contact, MessageSquareCode } from "lucide-react";
import { toast } from "sonner";
import { LogoMark, Wordmark } from "@/components/Brand";
import { useSupport } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";
import { NotificationBell } from "@/components/dashboard/NotificationBell";

const NAV = [
  { to: "/overview", label: "Overview", icon: LayoutDashboard, tag: "00" },
  { to: "/inbox", label: "Inbox", icon: Inbox, tag: "01" },
  { to: "/visitors", label: "Monitoring", icon: Radar, tag: "02" },
  { to: "/contacts", label: "Contacts", icon: Contact, tag: "03" },
  { to: "/analytics", label: "Reporting", icon: BarChart3, tag: "04", admin: true },
  { to: "/widget-setup", label: "Chat widget", icon: MessageSquareCode, tag: "05", admin: true },
  { to: "/team", label: "Team & roles", icon: Users, tag: "06", admin: true },
  { to: "/settings", label: "Automations", icon: Settings2, tag: "07", admin: true },
];

function StatusToggle() {
  const { me, setMe, api, connected } = useSupport();
  const away = me?.status === "away";
  const toggle = async () => {
    try {
      const r = await api("patch", "/me/status", { status: away ? "online" : "away" });
      setMe({ ...me, status: r.status });
    } catch (e) { toast.error(errMsg(e)); }
  };
  const color = !connected ? "bg-[#a6b1a7]" : away ? "bg-[#e0ad62]" : "bg-[#3ccf7d]";
  return (
    <button onClick={toggle} data-testid="agent-status-toggle" title="Toggle availability"
      className="flex items-center gap-2 rounded-md border border-[#27362e] px-2.5 py-1.5 text-xs text-[#f3f1ea] transition-colors hover:bg-[#1a3025]">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {!connected ? "Connecting" : away ? "Away" : "Online"}
    </button>
  );
}

function Sidebar({ items }) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-[#0e241a] md:flex" data-testid="dashboard-sidebar">
      <div className="flex items-center gap-3 border-b border-[#27362e] px-5 py-5"><LogoMark size={34} /><Wordmark inverse sub="Support desk" /></div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((n) => (
          <NavLink key={n.to} to={n.to} data-testid={`nav-${n.to.slice(1)}`}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-[#1a3025] text-[#f3f1ea]" : "text-[#a6b1a7] hover:bg-[#1a3025] hover:text-[#f3f1ea]"}`}>
            <n.icon className="h-4 w-4" /><span className="flex-1">{n.label}</span><span className="text-[10px] tracking-wider opacity-50">§ {n.tag}</span>
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center justify-between border-t border-[#27362e] p-4"><StatusToggle /><div className="flex items-center gap-2"><NotificationBell /><UserButton /></div></div>
    </aside>
  );
}

function MobileNav({ items }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-[#27362e] bg-[#0e241a] pb-[env(safe-area-inset-bottom)] md:hidden" data-testid="mobile-nav">
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} data-testid={`mobile-nav-${n.to.slice(1)}`}
          className={({ isActive }) => `flex min-w-[72px] flex-1 flex-col items-center gap-1 py-2.5 text-[10px] ${isActive ? "text-[#f3f1ea]" : "text-[#a6b1a7]"}`}>
          <n.icon className="h-4 w-4" />{n.label.split(" ")[0]}
        </NavLink>
      ))}
    </nav>
  );
}

function Pending({ me }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafaf7] p-6" data-testid="pending-access">
      <div className="max-w-md rounded-lg border border-[#dfddd8] bg-white p-8 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-[#825a17]" />
        <h1 className="mt-4 text-xl font-semibold">Access removed</h1>
        <p className="mt-2 text-sm text-[#4b554d]">You are signed in as {me?.email}. An administrator has removed your access to the support desk.</p>
        <div className="mt-6 flex justify-center gap-3"><UserButton /></div>
      </div>
    </div>
  );
}

export default function DashboardLayout() {
  const { me, error, staff, isAdmin } = useSupport();
  if (error) return <div className="p-8 text-sm text-[#a12f2e]" data-testid="dashboard-error">{error}</div>;
  if (!me) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#104e35]" /></div>;
  if (!staff) return <Pending me={me} />;
  const items = NAV.filter((n) => !n.admin || isAdmin);
  return (
    <div className="flex h-[100dvh] bg-[#fafaf7] text-[#121713]">
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-[#27362e] bg-[#0e241a] px-4 py-3 md:hidden">
          <div className="flex items-center gap-2.5"><LogoMark size={28} /><Wordmark inverse sub="Support desk" /></div>
          <div className="flex items-center gap-2"><StatusToggle /><NotificationBell /><UserButton /></div>
        </div>
        <main className="min-h-0 flex-1 overflow-hidden pb-[60px] md:pb-0"><Outlet /></main>
      </div>
      <MobileNav items={items} />
    </div>
  );
}

export const PageHeader = ({ tag, title, desc, children }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#dfddd8] bg-white px-5 py-5 md:px-8">
    <div>
      <div className="fm-mono-eyebrow">§ {tag}</div>
      <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-[#104e35]">{title}</h1>
      {desc && <p className="mt-1 text-sm text-[#4b554d]">{desc}</p>}
    </div>
    {children}
  </div>
);
