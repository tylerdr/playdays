"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import {
  EVENT_TAG_OPTIONS,
  createDemoProfile,
  type ActivityPrefs,
  type CustomSource,
  type Event,
  type FamilyProfile,
  type SchedulePrefs,
} from "@/lib/schemas";
import { type EventDateWindow, eventMatchesKids, eventMatchesWindow, sortEventsChronologically } from "@/lib/events";
import {
  getActivityPrefs,
  getCustomSources,
  getProfile,
  getSavedEventForEvent,
  getSavedEvents,
  getSchedulePrefs,
  removeSavedEvent,
  saveEventToList,
  saveProfile,
} from "@/lib/storage";
import { EventCard } from "@/components/event-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EventsResponse {
  events: Event[];
  availability: "connected" | "unavailable";
  message?: string;
}

const windowLabels: Record<EventDateWindow, string> = {
  all: "All upcoming",
  today: "Today",
  week: "Next 7 days",
  weekend: "Weekend",
};

export function EventFeed() {
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [schedulePrefs, setSchedulePrefs] = useState<SchedulePrefs | null>(null);
  const [activityPrefs, setActivityPrefs] = useState<ActivityPrefs | null>(null);
  const [customSources, setCustomSources] = useState<CustomSource[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [availability, setAvailability] = useState<EventsResponse["availability"]>("unavailable");
  const [city, setCity] = useState("");
  const [dateWindow, setDateWindow] = useState<EventDateWindow>("week");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [kidFitOnly, setKidFitOnly] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  function hydrateLocalState(nextProfile?: FamilyProfile | null) {
    const resolvedProfile = nextProfile ?? getProfile();
    setProfile(resolvedProfile);
    setSchedulePrefs(getSchedulePrefs());
    setActivityPrefs(getActivityPrefs());
    setCustomSources(getCustomSources());
    setSavedIds(getSavedEvents().map((item) => item.eventId).filter((value): value is string => Boolean(value)));
    setCity(resolvedProfile?.location.city ?? "");
  }

  async function loadEvents(nextCity = city) {
    if (!nextCity.trim()) {
      setEvents([]);
      setMessage("Add a city to load shared events for your area.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = new URL("/api/events", window.location.origin);
      url.searchParams.set("city", nextCity.trim());
      const response = await fetch(url);
      const data = (await response.json()) as EventsResponse;

      setEvents(data.events ?? []);
      setAvailability(data.availability ?? "unavailable");
      setMessage(data.message ?? null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load shared events.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const existingProfile = getProfile();
    hydrateLocalState(existingProfile);
    if (existingProfile?.location.city) {
      void loadEvents(existingProfile.location.city);
    }
    // The initial fetch is intentionally tied to the first local profile read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kidAges = profile?.kids.map((kid) => kid.age) ?? [];
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const event of events) {
      for (const tag of event.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort((left, right) => left.localeCompare(right));
  }, [events]);

  const visibleEvents = useMemo(() => {
    const filtered = events.filter((event) => {
      if (selectedTags.length && !selectedTags.some((tag) => event.tags.includes(tag))) {
        return false;
      }

      if (!eventMatchesWindow(event, dateWindow)) {
        return false;
      }

      if (kidFitOnly && profile?.kids.length && !eventMatchesKids(event, profile.kids)) {
        return false;
      }

      return true;
    });

    return sortEventsChronologically(filtered);
  }, [dateWindow, events, kidFitOnly, profile?.kids, selectedTags]);

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  function toggleSave(event: Event) {
    const existing = getSavedEventForEvent(event.id);
    if (existing) {
      removeSavedEvent({ id: existing.id, eventId: event.id });
      setSavedIds((current) => current.filter((item) => item !== event.id));
      setMessage(`${event.title} removed from your saved events.`);
      return;
    }

    saveEventToList(event, "saved");
    setSavedIds((current) => [...new Set([event.id, ...current])]);
    setMessage(`${event.title} saved on this device.`);
  }

  function loadDemoFamily() {
    const demo = createDemoProfile();
    saveProfile(demo);
    hydrateLocalState(demo);
    setMessage("Demo family loaded. Shared events still only show if this environment has discovered real listings.");
    void loadEvents(demo.location.city);
  }

  async function refreshAreaEvents() {
    if (!city.trim()) {
      setError("Add a city before you refresh the shared event feed.");
      return;
    }

    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch("/api/events/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          city: city.trim(),
          kidAges,
          activityPrefs,
          schedulePrefs,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Unable to refresh shared events.");
      }

      setMessage(data.message ?? "Shared events refreshed.");
      await loadEvents(city.trim());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to refresh shared events.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">Events</Badge>
            <CardTitle className="text-4xl text-balance">See the family events that are actually in the shared feed for your area.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="events-city">City</Label>
              <Input
                id="events-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="Newport Beach"
                className="touch-safe rounded-2xl"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="touch-safe rounded-2xl px-6" disabled={loading} onClick={() => void loadEvents(city)}>
                {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Load shared events
              </Button>
              <Button variant="outline" className="touch-safe rounded-2xl" onClick={loadDemoFamily}>
                <Sparkles className="size-4" />
                Use demo family
              </Button>
              <Button variant="ghost" className="touch-safe rounded-2xl" disabled={refreshing} onClick={() => void refreshAreaEvents()}>
                {refreshing ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Refresh area feed
              </Button>
            </div>

            <div className="grid gap-3 rounded-[1.4rem] border border-border/60 bg-white/75 p-4 text-sm text-muted-foreground">
              <p>
                {availability === "connected"
                  ? "Only real rows from the shared events table show up here. Low-confidence AI finds stay labeled so you can verify them."
                  : "The shared events table is not connected in this environment yet, so this page stays honest and shows no placeholder events."}
              </p>
              {message ? <p className="text-primary">{message}</p> : null}
              {error ? <p className="text-destructive">{error}</p> : null}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Date window</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(windowLabels).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={dateWindow === value ? "default" : "outline"}
                    className="touch-safe rounded-full px-4"
                    onClick={() => setDateWindow(value as EventDateWindow)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-foreground">Fit filters</p>
                <Button
                  type="button"
                  variant={kidFitOnly ? "default" : "outline"}
                  className="touch-safe rounded-full px-4"
                  onClick={() => setKidFitOnly((current) => !current)}
                >
                  {kidFitOnly ? "Matching our kids" : "All ages"}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(availableTags.length ? availableTags : [...EVENT_TAG_OPTIONS]).map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="touch-safe rounded-full px-4 capitalize"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Button>
                ))}
              </div>
            </div>

            {!profile ? (
              <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-white/70 p-4 text-sm leading-7 text-muted-foreground">
                Save a family profile if you want the age-fit filter and custom programs to reflect your household.
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <Button asChild className="touch-safe rounded-2xl">
                    <Link href="/start-setup">Start setup</Link>
                  </Button>
                  <Button asChild variant="outline" className="touch-safe rounded-2xl">
                    <Link href="/profile">Open profile</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">Your programs</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {customSources.length ? (
                customSources.map((source) => (
                  <div key={source.id} className="rounded-[1.35rem] border border-border/60 bg-white/80 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{source.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {[source.dayOfWeek, source.startTime && source.endTime ? `${source.startTime} - ${source.endTime}` : source.recurrenceText]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Badge variant={source.isActive ? "default" : "outline"} className="rounded-full">
                        {source.isActive ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {[source.locationName, source.locationAddress].filter(Boolean).join(" · ") || "Location not set yet"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.35rem] border border-dashed border-border/70 bg-white/75 p-4 text-sm leading-7 text-muted-foreground">
                  Add recurring programs in your profile and they will stay visible here even when the shared events table is empty.
                </div>
              )}
            </CardContent>
          </Card>

          {visibleEvents.length ? (
            visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                savedListName={savedIds.includes(event.id) ? getSavedEventForEvent(event.id)?.listName ?? "saved" : null}
                onToggleSave={toggleSave}
              />
            ))
          ) : (
            <Card className="card-soft border-border/60">
              <CardContent className="py-10 text-sm leading-7 text-muted-foreground">
                {loading
                  ? "Loading shared events..."
                  : availability === "connected"
                    ? "No shared events matched your filters yet. Broaden the date window or remove a few tags."
                    : "No shared events are available yet in this environment. Use Profile to add recurring programs, or wire discovery before expecting live feed results."}
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
