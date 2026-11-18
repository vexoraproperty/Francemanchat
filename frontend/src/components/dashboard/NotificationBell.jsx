import { Link } from "react-router-dom";
import { Bell, MessageSquare, UserRound, MessagesSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useSupport } from "@/context/SupportContext";
import { ago } from "@/lib/format";

const ICON = { visitor: UserRound, chat: MessagesSquare, message: MessageSquare };

function Prefs({ prefs, setPrefs }) {
  const perm = "Notification" in window ? Notification.permission : "unsupported";
  const row = (k, label) => (
    <label className="flex items-center justify-between py-1 text-xs"><span>{label}</span>
      <Switch checked={prefs[k]} onCheckedChange={(v) => setPrefs({ [k]: v })} data-testid={`notify-pref-${k}`} /></label>
  );
  return (
    <div className="space-y-1 border-t border-[#efede8] p-3">
      {row("visitors", "Alert me when a visitor arrives")}
      {row("sound", "Play a sound")}
      {row("desktop", "Desktop alerts when tab is hidden")}
      {perm === "default" && (
        <button onClick={() => Notification.requestPermission()} data-testid="notify-enable-desktop"
          className="mt-1 w-full rounded-md bg-[#104e35] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#03402a]">Allow desktop notifications</button>
      )}
      {perm === "denied" && <p className="text-[11px] text-[#a12f2e]">Desktop alerts are blocked in your browser settings.</p>}
    </div>
  );
}

export function NotificationBell() {
  const { notifications: n } = useSupport();
  return (
    <Popover onOpenChange={(o) => o && n.markRead()}>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 text-[#f3f1ea] hover:bg-[#1a3025]" aria-label="Notifications" data-testid="notification-bell">
          <Bell className="h-4 w-4" />
          {n.unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#a12f2e] px-1 text-[10px] font-semibold text-white" data-testid="notification-count">{n.unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-[#efede8] px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {n.items.length > 0 && <button onClick={n.clear} className="text-xs text-[#104e35] hover:underline" data-testid="notification-clear">Clear</button>}
        </div>
        <div className="max-h-80 overflow-y-auto fm-scroll" data-testid="notification-list">
          {n.items.length === 0 ? <p className="p-6 text-center text-xs text-[#6b746c]">No notifications yet.</p> : n.items.map((i) => {
            const Icon = ICON[i.kind] || Bell;
            return (
              <Link key={i.id} to={i.link} className="flex gap-2.5 border-b border-[#f3f1ec] px-3 py-2.5 hover:bg-[#fafaf7]">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#104e35]" />
                <div className="min-w-0"><div className="text-xs font-medium">{i.title}</div><div className="truncate text-xs text-[#4b554d]">{i.body}</div><div className="text-[10px] text-[#6b746c]">{ago(i.at)}</div></div>
              </Link>
            );
          })}
        </div>
        <Prefs prefs={n.prefs} setPrefs={n.setPrefs} />
      </PopoverContent>
    </Popover>
  );
}
