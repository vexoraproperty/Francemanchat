import { useCallback, useEffect, useState } from "react";
import { ChatWidget } from "@/components/widget/ChatWidget";

export default function WidgetFrame() {
  const [page, setPage] = useState(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    const onMsg = (e) => {
      if (e.source !== window.parent || e.data?.type !== "fm:page") return;
      setPage({ url: String(e.data.url || ""), title: String(e.data.title || ""), referrer: String(e.data.referrer || "") });
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "fm:ready" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const onOpenChange = useCallback((open) => window.parent.postMessage({ type: "fm:state", open }, "*"), []);

  return (
    <div data-testid="widget-frame">
      <ChatWidget initialPage={{ url: document.referrer || window.location.href, title: "", referrer: "" }} page={page} onOpenChange={onOpenChange} />
    </div>
  );
}
