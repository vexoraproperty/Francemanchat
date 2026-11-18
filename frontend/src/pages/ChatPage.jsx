import { useEffect } from "react";
import { ChatWidget } from "@/components/widget/ChatWidget";

export default function ChatPage() {
  useEffect(() => { document.title = "Chat with Franceman Exportation LLP"; }, []);
  return (
    <div className="min-h-screen bg-[#0e241a]" data-testid="direct-chat-page">
      <ChatWidget alwaysOpen layout="full"
        initialPage={{ url: window.location.href, title: "Direct chat link", referrer: document.referrer }} />
    </div>
  );
}
