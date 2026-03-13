import { SiteShell } from "@/components/site-shell";
import { ChatAssistant } from "@/components/chat-assistant";
import { getAuthenticatedFamilyContext } from "@/lib/server/family-context";
import { hasOpenAIKey } from "@/lib/server/ai";

export default async function ChatPage() {
  const context = await getAuthenticatedFamilyContext();

  return (
    <SiteShell>
      <ChatAssistant
        liveAssistantEnabled={hasOpenAIKey()}
        serverContext={{
          authMode: context.authMode,
          userEmail: context.user?.email ?? null,
          profile: context.profile,
          warnings: context.warnings,
          historyCount: context.history.length,
          savedEventCount: context.savedEvents.length,
          customSourceCount: context.customSources.length,
          upcomingEventCount: context.upcomingEvents.length,
          legacySavedItemCount: context.legacySavedItems.length,
        }}
      />
    </SiteShell>
  );
}
