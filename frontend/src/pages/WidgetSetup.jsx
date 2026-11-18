import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/DashboardLayout";

const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied"); };

function CodeRow({ value, testid }) {
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-[#0e241a] px-3 py-2.5 font-mono text-xs text-[#f3f1ea]" data-testid={testid}>{value}</code>
      <button onClick={() => copy(value)} className="rounded-md border border-[#dfddd8] p-2.5 hover:bg-[#f1f0ec]" data-testid={`${testid}-copy`}><Copy className="h-4 w-4" /></button>
    </div>
  );
}

const Card = ({ tag, title, desc, children }) => (
  <section className="rounded-lg border border-[#dfddd8] bg-white p-5">
    <div className="fm-mono-eyebrow">N°{tag}</div>
    <h2 className="font-display mt-1 text-xl font-semibold text-[#104e35]">{title}</h2>
    {desc && <p className="mt-1 text-sm text-[#4b554d]">{desc}</p>}
    <div className="mt-4 space-y-3">{children}</div>
  </section>
);

export default function WidgetSetup() {
  const snippet = `<script src="${process.env.REACT_APP_BACKEND_URL}/api/embed.js" async></script>`;
  const direct = `${window.location.origin}/chat`;
  return (
    <div className="h-full overflow-y-auto fm-scroll" data-testid="widget-setup-page">
      <PageHeader tag="05 — Chat widget" title="Chat widget" desc="Install the Franceman widget on francemann.com or share a direct chat link." />
      <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card tag="01" title="Widget code" desc="Paste this just before </body> on every page of francemann.com. Remove the old Tawk.to embed so visitors see only the Franceman widget.">
            <CodeRow value={snippet} testid="embed-snippet" />
          </Card>
          <Card tag="02" title="Direct chat link" desc="Share in emails, WhatsApp or quotations. Opens a full-page chat with your team.">
            <CodeRow value={direct} testid="direct-chat-link" />
            <a href="/chat" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-[#104e35] hover:underline" data-testid="direct-chat-open">Open chat page <ExternalLink className="h-3.5 w-3.5" /></a>
          </Card>
          <Card tag="03" title="What visitors get" desc="Messages, quick answers and the AI assistant are configured under Automations.">
            <ul className="space-y-1.5 text-sm text-[#4b554d]">
              <li>Pre-chat form for name, email and product of interest</li>
              <li>Live online / offline status of your team and typing indicators</li>
              <li>Welcome, offline, keyword and AI answers when no agent is replying</li>
              <li>Chat history kept on the visitor's browser between visits</li>
            </ul>
          </Card>
        </div>
        <div>
          <div className="fm-mono-eyebrow mb-2">Live preview — you appear as a visitor</div>
          <div className="overflow-hidden rounded-xl border border-[#dfddd8] bg-white">
            <iframe src="/chat" title="Widget preview" className="h-[640px] w-full" data-testid="widget-preview-iframe" />
          </div>
        </div>
      </div>
    </div>
  );
}
