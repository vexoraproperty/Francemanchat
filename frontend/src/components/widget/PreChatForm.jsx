import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

export const COMMODITIES = [
  "Kola Nut", "Bitter Kola", "Ginger", "Turmeric", "Hibiscus", "Sesame", "Raw Cashew Nuts",
  "Sample request", "General enquiry",
];

const field = "w-full rounded-md border border-[#dfddd8] bg-white px-3 py-2.5 text-sm text-[#121713] placeholder:text-[#6b746c] focus:outline-none focus:ring-2 focus:ring-[#104e35]/30 focus:border-[#104e35]";

export function PreChatForm({ welcome, offline, onSubmit }) {
  const [form, setForm] = useState({ name: "", email: "", commodity: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError("Please enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return setError("Please enter a valid email so we can reply.");
    setError("");
    setBusy(true);
    try {
      await onSubmit(form);
    } catch {
      setError("We could not start the chat. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="flex flex-1 flex-col gap-4 overflow-y-auto p-5 fm-scroll" data-testid="prechat-form">
      <div className="rounded-md border-l-2 border-[#104e35] bg-[#e3f2ea] px-3.5 py-3 text-sm leading-5 text-[#121713]" data-testid="prechat-welcome">
        {offline || welcome}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#4b554d]" htmlFor="fm-name">Full name / company</label>
        <input id="fm-name" className={field} value={form.name} onChange={set("name")} placeholder="e.g. Jean Dupont, Marseille Botanicals" data-testid="prechat-name-input" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#4b554d]" htmlFor="fm-email">Email</label>
        <input id="fm-email" type="email" className={field} value={form.email} onChange={set("email")} placeholder="you@company.com" data-testid="prechat-email-input" />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-[#4b554d]" htmlFor="fm-commodity">Product of interest (optional)</label>
        <select id="fm-commodity" className={field} value={form.commodity} onChange={set("commodity")} data-testid="prechat-commodity-select">
          <option value="">Select a product</option>
          {COMMODITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {error && <p className="text-xs text-[#a12f2e]" data-testid="prechat-error">{error}</p>}
      <button type="submit" disabled={busy} data-testid="prechat-submit-button"
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-[#104e35] px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-[#03402a] disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Start conversation <ArrowRight className="h-4 w-4" />
      </button>
      <p className="text-center text-[11px] text-[#6b746c]">Your details are used only to respond to your enquiry.</p>
    </form>
  );
}
