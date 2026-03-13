"use client";

import Link from "next/link";
import { Heart, MapPin, Ticket } from "lucide-react";
import type { Event, EventListName } from "@/lib/schemas";
import { buildEventMapUrl, formatEventDateRange, formatEventTimeRange, getEventConfidenceLabel, getEventCostLabel } from "@/lib/events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EventCardProps {
  event: Event;
  savedListName?: EventListName | null;
  onToggleSave?: (event: Event) => void;
  compact?: boolean;
}

function getSaveLabel(savedListName?: EventListName | null) {
  if (!savedListName) {
    return "Save";
  }

  return savedListName === "want_to_try"
    ? "Want to try"
    : savedListName === "done"
      ? "Done"
      : "Saved";
}

export function EventCard({ event, savedListName = null, onToggleSave, compact = false }: EventCardProps) {
  const mapUrl = buildEventMapUrl(event);
  const confidenceLabel = getEventConfidenceLabel(event);
  const hasImage = Boolean(event.imageUrl);

  return (
    <Card className="card-soft overflow-hidden border-border/60">
      <div className={hasImage ? "aspect-[16/9] w-full overflow-hidden bg-secondary/50" : "hero-wash border-b border-border/50"}>
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imageUrl} alt={event.title} className="size-full object-cover" />
        ) : (
          <div className="flex h-44 items-end justify-between p-5">
            <Badge className="rounded-full bg-primary text-primary-foreground">{confidenceLabel}</Badge>
            <Badge variant="outline" className="rounded-full bg-white/85">
              {event.source === "ai" ? "Shared feed" : "Manual"}
            </Badge>
          </div>
        )}
      </div>

      <CardContent className={`space-y-4 ${compact ? "py-5" : "py-6"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="rounded-full bg-white/80">
                {formatEventDateRange(event)}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white/80">
                {getEventCostLabel(event)}
              </Badge>
              <Badge variant="outline" className="rounded-full bg-white/80">
                Ages {event.ageMin}-{event.ageMax}
              </Badge>
            </div>
            <Link href={`/events/${event.id}`} className="block">
              <h3 className="text-2xl font-semibold text-foreground hover:text-primary">{event.title}</h3>
            </Link>
            <p className="text-sm text-muted-foreground">
              {[event.locationName, event.locationAddress || event.city].filter(Boolean).join(" · ")}
            </p>
          </div>
          {onToggleSave ? (
            <Button
              type="button"
              variant={savedListName ? "default" : "outline"}
              className="touch-safe rounded-full"
              onClick={() => onToggleSave(event)}
            >
              <Heart className={savedListName ? "fill-current" : ""} />
              {getSaveLabel(savedListName)}
            </Button>
          ) : null}
        </div>

        <p className="text-sm leading-7 text-muted-foreground">
          {event.description || "Details are still limited, so open the source before you head out."}
        </p>

        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full bg-secondary text-secondary-foreground">{confidenceLabel}</Badge>
          <Badge variant="outline" className="rounded-full bg-white/80">
            <Ticket className="size-3.5" />
            {formatEventTimeRange(event)}
          </Badge>
          {event.tags.slice(0, compact ? 2 : 4).map((tag) => (
            <Badge key={tag} variant="outline" className="rounded-full bg-white/80 capitalize">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="touch-safe rounded-2xl">
            <Link href={`/events/${event.id}`}>Open details</Link>
          </Button>
          {event.url ? (
            <Button asChild variant="outline" className="touch-safe rounded-2xl">
              <a href={event.url} target="_blank" rel="noreferrer">
                Open source
              </a>
            </Button>
          ) : null}
          {mapUrl ? (
            <Button asChild variant="ghost" className="touch-safe rounded-2xl">
              <a href={mapUrl} target="_blank" rel="noreferrer">
                <MapPin className="size-4" />
                Map
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
