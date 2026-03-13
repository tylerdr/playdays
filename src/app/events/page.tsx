import { EventFeed } from "@/components/event-feed";
import { SiteShell } from "@/components/site-shell";

export default function EventsPage() {
  return (
    <SiteShell>
      <EventFeed />
    </SiteShell>
  );
}
