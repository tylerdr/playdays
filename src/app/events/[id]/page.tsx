import { EventDetail } from "@/components/event-detail";
import { SiteShell } from "@/components/site-shell";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <SiteShell>
      <EventDetail eventId={id} />
    </SiteShell>
  );
}
