import { SiteShell } from "@/components/site-shell";
import { ChatAssistant } from "@/components/chat-assistant";
import { hasOpenAIKey } from "@/lib/server/ai";

export default function ChatPage() {
  return (
    <SiteShell>
      <ChatAssistant liveAssistantEnabled={hasOpenAIKey()} />
    </SiteShell>
  );
}
