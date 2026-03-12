"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, MapPin } from "lucide-react";
import { buildEventMapUrl, formatEventDateRange, formatEventTimeRange, getEventConfidenceLabel, getEventCostLabel } from "@/lib/events";
import type { Event, EventListName, SavedEvent } from "@/lib/schemas";
import { getSavedEventForEvent, getSavedEvents, removeSavedEvent, upsertSavedEvent } from "@/lib/storage";
import { EventCard } from "@/components/event-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EventDetailResponse {
  event: Event | null;
  related: Event[];
  availability: "connected" | "unavailable";
  message?: string;
}

export function EventDetail({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<Event | null>(null);
  const [related, setRelated] = useState<Event[]>([]);
  const [savedEntry, setSavedEntry] = useState<SavedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/events?id=${encodeURIComponent(eventId)}`);
        const data = (await response.json()) as EventDetailResponse;
        if (response.ok && data.event) {
          setEvent(data.event);
          setRelated(data.related ?? []);
          setMessage(data.message ?? null);
          setSavedEntry(getSavedEventForEvent(data.event.id));
          return;
        }

        const localSaved = getSavedEvents().find((item) => item.eventId === eventId && item.eventSnapshot);
        if (localSaved?.eventSnapshot) {
          setEvent(localSaved.eventSnapshot);
          setRelated([]);
          setSavedEntry(localSaved);
          setMessage("Showing the copy saved on this device because the shared feed does not currently expose this event.");
          return;
        }

        setEvent(null);
        setRelated([]);
        setMessage(data.message ?? null);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load this event.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [eventId]);

  function moveToList(listName: EventListName) {
    if (!event) {
      return;
    }

    upsertSavedEvent({
      eventId: event.id,
      eventSnapshot: event,
      customEvent: null,
      listName,
      notes: savedEntry?.notes ?? "",
    });

    setSavedEntry(getSavedEventForEvent(event.id));
    setMessage(`${event.title} moved to ${listName.replaceAll("_", " ")}.`);
  }

  function removeFromSaved() {
    if (!event) {
      return;
    }

    const existing = getSavedEventForEvent(event.id);
    if (!existing) {
      return;
    }

    removeSavedEvent({ id: existing.id, eventId: event.id });
    setSavedEntry(null);
    setMessage(`${event.title} removed from your saved events.`);
  }

  if (loading) {
    return (
      <div className="page-shell py-10">
        <Card className="card-soft border-border/60">
          <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
            <LoaderCircle className="size-5 animate-spin" />
            Loading event details...
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="page-shell py-10">
        <Card className="card-soft mx-auto max-w-3xl border-border/60">
          <CardHeader>
            <Badge variant="outline" className="w-fit rounded-full">
              Events
            </Badge>
            <CardTitle className="text-4xl text-balance">That event is not in the shared feed right now.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-7 text-muted-foreground">
            <p>
              {message ??
                "If you saved it earlier on this device, it may come back once the shared feed is connected again."}
            </p>
            {error ? <p className="text-destructive">{error}</p> : null}
            <Button asChild className="touch-safe rounded-2xl">
              <Link href="/events">Back to events</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const mapUrl = buildEventMapUrl(event);

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mb-4">
        <Button asChild variant="ghost" className="touch-safe rounded-full px-0 text-sm">
          <Link href="/events">
            <ArrowLeft className="size-4" />
            Back to events
          </Link>
        </Button>
      </div>

      <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="card-soft border-border/60">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge className="rounded-full bg-primary text-primary-foreground">{getEventConfidenceLabel(event)}</Badge>
              <Badge variant="outline" className="rounded-full bg-white/80">
                {formatEventDateRange(event)}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white/80">
                {getEventCostLabel(event)}
              </Badge>
            </div>
            <CardTitle className="text-4xl text-balance">{event.title}</CardTitle>
            <p className="text-base leading-7 text-muted-foreground">
              {[event.locationName, event.locationAddress || event.city].filter(Boolean).join(" · ")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                <p className="text-sm text-muted-foreground">Time</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatEventTimeRange(event)}</p>
              </div>
              <div className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                <p className="text-sm text-muted-foreground">Ages</p>
                <p className="mt-2 text-lg font-semibold text-foreground">
                  {event.ageMin}-{event.ageMax}
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                <p className="text-sm text-muted-foreground">Source</p>
                <p className="mt-2 text-lg font-semibold capitalize text-foreground">{event.source}</p>
              </div>
            </div>

            <p className="text-sm leading-7 text-muted-foreground">
              {event.description || "No full description was saved for this event yet. Use the source or map link before you go."}
            </p>

            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="rounded-full bg-white/80 capitalize">
                  {tag}
                </Badge>
              ))}
            </div>

            {message ? (
              <div className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4 text-sm leading-7 text-muted-foreground">
                {message}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {(["saved", "want_to_try", "done"] as EventListName[]).map((listName) => (
                <Button
                  key={listName}
                  type="button"
                  variant={savedEntry?.listName === listName ? "default" : "outline"}
                  className="touch-safe rounded-2xl capitalize"
                  onClick={() => moveToList(listName)}
                >
                  {listName.replaceAll("_", " ")}
                </Button>
              ))}
              {savedEntry ? (
                <Button type="button" variant="ghost" className="touch-safe rounded-2xl" onClick={removeFromSaved}>
                  Remove
                </Button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {event.url ? (
                <Button asChild className="touch-safe rounded-2xl">
                  <a href={event.url} target="_blank" rel="noreferrer">
                    Open source
                  </a>
                </Button>
              ) : null}
              {mapUrl ? (
                <Button asChild variant="outline" className="touch-safe rounded-2xl">
                  <a href={mapUrl} target="_blank" rel="noreferrer">
                    <MapPin className="size-4" />
                    Open map
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">Saved status</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-muted-foreground">
              {savedEntry
                ? `This event is saved on this device under ${savedEntry.listName.replaceAll("_", " ")}.`
                : "This event is not saved on this device yet."}
            </CardContent>
          </Card>

          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">Related events</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {related.length ? (
                related.map((item) => <EventCard key={item.id} event={item} compact />)
              ) : (
                <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-white/75 p-4 text-sm leading-7 text-muted-foreground">
                  No related shared events are available right now.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
