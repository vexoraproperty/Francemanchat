import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

const PREFS_KEY = "fm_notify_prefs";
const loadPrefs = () => {
  try { return { sound: true, desktop: true, visitors: true, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch { return { sound: true, desktop: true, visitors: true }; }
};

let audioCtx;
function beep(high) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "sine";
    o.frequency.value = high ? 880 : 660;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + 0.4);
  } catch {}
}

export function useNotifications(navigate) {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefsState] = useState(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const setPrefs = useCallback((patch) => {
    setPrefsState((p) => { const n = { ...p, ...patch }; localStorage.setItem(PREFS_KEY, JSON.stringify(n)); return n; });
  }, []);

  const notify = useCallback((n) => {
    const p = prefsRef.current;
    if (n.kind === "visitor" && !p.visitors) return;
    const item = { id: `${Date.now()}-${Math.random()}`, at: new Date().toISOString(), ...n };
    setItems((l) => [item, ...l].slice(0, 40));
    setUnread((u) => u + 1);
    if (p.sound) beep(n.kind !== "visitor");
    if (p.desktop && document.hidden && "Notification" in window && Notification.permission === "granted") {
      const dn = new Notification(n.title, { body: n.body, icon: "/franceman-logo.jpg", tag: n.tag });
      dn.onclick = () => { window.focus(); navigate(n.link); dn.close(); };
    } else {
      toast(n.title, { description: n.body, action: n.link ? { label: "Open", onClick: () => navigate(n.link) } : undefined });
    }
  }, [navigate]);

  return { items, unread, markRead: () => setUnread(0), clear: () => { setItems([]); setUnread(0); }, prefs, setPrefs, notify };
}
