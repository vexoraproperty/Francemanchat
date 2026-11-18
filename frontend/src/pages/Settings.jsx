import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/DashboardLayout";
import { useSupport } from "@/context/SupportContext";
import { errMsg } from "@/lib/api";

const input = "w-full rounded-md border border-[#dfddd8] bg-white px-3 py-2 text-sm focus:border-[#104e35] focus:outline-none focus:ring-2 focus:ring-[#104e35]/20";

const Card = ({ tag, title, desc, children }) => (
  <section className="rounded-lg border border-[#dfddd8] bg-white p-5">
    <div className="fm-eyebrow">§ {tag}</div>
    <h2 className="mt-1 text-base font-semibold">{title}</h2>
    {desc && <p className="mt-1 text-sm text-[#4b554d]">{desc}</p>}
    <div className="mt-4 space-y-4">{children}</div>
  </section>
);

const Toggle = ({ label, desc, checked, onChange, testid }) => (
  <label className="flex items-start justify-between gap-4">
    <span><span className="block text-sm font-medium">{label}</span><span className="block text-xs text-[#6b746c]">{desc}</span></span>
    <Switch checked={checked} onCheckedChange={onChange} data-testid={testid} />
  </label>
);

function QuickAnswers({ items, onChange }) {
  const update = (i, k, v) => onChange(items.map((q, j) => (j === i ? { ...q, [k]: v } : q)));
  return (
    <>
      {items.map((q, i) => (
        <div key={q.id || i} className="space-y-2 rounded-md border border-[#efede8] bg-[#fafaf7] p-3" data-testid={`quick-answer-editor-${i}`}>
          <div className="flex gap-2">
            <input className={input} value={q.label} onChange={(e) => update(i, "label", e.target.value)} placeholder="Button label shown to visitors" data-testid={`qa-label-${i}`} />
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="rounded-md border border-[#dfddd8] px-2.5 text-[#a12f2e] hover:bg-[#fee3e1]" data-testid={`qa-remove-${i}`}><Trash2 className="h-4 w-4" /></button>
          </div>
          <input className={input} value={q.keywordsText ?? q.keywords.join(", ")} onChange={(e) => update(i, "keywordsText", e.target.value)} placeholder="Trigger keywords, comma separated" data-testid={`qa-keywords-${i}`} />
          <textarea className={`${input} min-h-[72px]`} value={q.answer} onChange={(e) => update(i, "answer", e.target.value)} placeholder="Automatic answer" data-testid={`qa-answer-${i}`} />
        </div>
      ))}
      <button onClick={() => onChange([...items, { label: "", keywords: [], answer: "" }])} data-testid="qa-add-button"
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#104e35] px-3 py-2 text-sm text-[#104e35] hover:bg-[#e3f2ea]"><Plus className="h-4 w-4" />Add quick answer</button>
    </>
  );
}

export default function Settings() {
  const { api } = useSupport();
  const [s, setS] = useState(null);
  const [tawk, setTawk] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api("get", "/settings").then(setS).catch((e) => toast.error(errMsg(e)));
    api("get", "/integrations/tawk").then(setTawk).catch(() => {});
  }, [api]);
  if (!s) return <div className="p-8"><Loader2 className="h-5 w-5 animate-spin text-[#104e35]" /></div>;

  const set = (k) => (v) => setS({ ...s, [k]: v?.target ? v.target.value : v });
  const save = async () => {
    setSaving(true);
    try {
      const quick_answers = s.quick_answers.map(({ keywordsText, ...q }) => ({ ...q, keywords: keywordsText !== undefined ? keywordsText.split(",") : q.keywords }));
      const { id, ...rest } = s;
      setS(await api("put", "/settings", { ...rest, quick_answers }));
      toast.success("Settings saved");
    } catch (e) { toast.error(errMsg(e)); } finally { setSaving(false); }
  };
  const snippet = `<script src="${window.location.origin}/embed.js" async></script>`;

  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="settings-page">
      <PageHeader tag="05" title="Settings" desc="Automated messages, quick answers, AI assistant and integrations.">
        <button onClick={save} disabled={saving} data-testid="settings-save-button" className="inline-flex items-center gap-2 rounded-md bg-[#104e35] px-4 py-2 text-sm font-medium text-white hover:bg-[#03402a] disabled:opacity-60">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save changes</button>
      </PageHeader>
      <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-2">
        <div className="space-y-6">
          <Card tag="01" title="Welcome & offline messages" desc="Sent automatically by the Franceman Assistant.">
            <div><label className="text-xs font-medium text-[#4b554d]">Welcome message (start of every chat)</label>
              <textarea className={`${input} mt-1 min-h-[80px]`} value={s.welcome_message} onChange={set("welcome_message")} data-testid="settings-welcome-input" /></div>
            <div><label className="text-xs font-medium text-[#4b554d]">Offline message (when no agent is online)</label>
              <textarea className={`${input} mt-1 min-h-[80px]`} value={s.offline_message} onChange={set("offline_message")} data-testid="settings-offline-input" /></div>
          </Card>
          <Card tag="02" title="Automated responses">
            <Toggle label="Keyword quick answers" desc="Reply instantly when a visitor's message contains a trigger keyword." checked={s.keyword_answers_enabled} onChange={set("keyword_answers_enabled")} testid="settings-keyword-toggle" />
            <Toggle label="AI assistant" desc="Claude answers questions until a human agent replies, using only Franceman's published facts." checked={s.ai_enabled} onChange={set("ai_enabled")} testid="settings-ai-toggle" />
          </Card>
          <Card tag="04" title="Install on francemann.com" desc="Paste this before </body> on every page of your website.">
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-[#0e241a] px-3 py-2.5 text-xs text-[#f3f1ea]" data-testid="embed-snippet">{snippet}</code>
              <button onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Copied"); }} className="rounded-md border border-[#dfddd8] p-2.5 hover:bg-[#f1f0ec]" data-testid="embed-copy-button"><Copy className="h-4 w-4" /></button>
            </div>
            <p className="text-xs text-[#6b746c]">Remove the existing Tawk.to embed from the site so visitors only see the Franceman widget.</p>
          </Card>
          <Card tag="05" title="Tawk.to integration" desc="Optional backup channel. Conversations normally stay inside this platform.">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-[#6b746c]">Site ID</span><span className="font-mono text-xs" data-testid="tawk-site-id">{tawk?.site_id}</span></div>
              <div className="flex justify-between"><span className="text-[#6b746c]">API key</span><span className="text-xs" data-testid="tawk-api-key-status">{tawk?.api_key_configured ? "Configured on server" : "Not configured"}</span></div>
            </div>
            <Toggle label="Use Tawk.to as offline backup" desc="When no agent is online, the widget also offers a link to your Tawk.to chat." checked={s.tawk_fallback_enabled} onChange={set("tawk_fallback_enabled")} testid="settings-tawk-toggle" />
          </Card>
        </div>
        <Card tag="03" title="Keyword quick answers" desc="Labels appear as buttons in the widget. Clicking one, or typing a keyword, sends the answer.">
          <QuickAnswers items={s.quick_answers} onChange={set("quick_answers")} />
        </Card>
      </div>
    </div>
  );
}
