"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, LoaderCircle, Mail, MapPin, RefreshCw, Sparkles } from "lucide-react";
import {
  createDemoProfile,
  type ActivityCard as ActivityCardType,
  type DailyPlan,
  type DiscoverySource,
  type FamilyProfile,
  type HistoryEntry,
  type SavedItem,
} from "@/lib/schemas";
import {
  getCachedPlan,
  getHistory,
  getPinnedPlace,
  getProfile,
  recordActivityAction,
  replaceActivityInPlan,
  saveCachedPlan,
  saveProfile,
  saveSavedItem,
  syncHistoryCache,
  syncPinnedPlaceCache,
  syncProfileCache,
} from "@/lib/storage";
import { ActivityCard } from "@/components/activity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function generatePlan(
  profile: FamilyProfile,
  history: HistoryEntry[],
  replaceSlot?: ActivityCardType["slot"],
  excludedTitles: string[] = []
) {
  const response = await fetch("/api/generate-daily", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile,
      history,
      replaceSlot,
      excludedTitles,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Unable to build your day.");
  }

  return response.json() as Promise<{ plan?: DailyPlan; activity?: ActivityCardType; source: string }>;
}

function getDiscoveryFraming(mode: DiscoverySource | null) {
  switch (mode) {
    case "ai":
      return {
        title: "Local ideas to double-check",
        note: "These are smart backup suggestions for your area. Double-check hours and details before you head out.",
      };
    case "fallback":
      return {
        title: "Quick outing backups",
        note: "Live place listings are unavailable right now, so these are map-ready category searches rather than vetted venues.",
      };
    default:
      return {
        title: "Nearby options for today",
        note: null,
      };
  }
}

function getPinnedMapsUrl(item: SavedItem | null) {
  const value = item?.payload?.mapsUrl;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function TodayBoard({
  initialProfile = null,
  initialHistory = [],
  initialPinnedPlace = null,
}: {
  initialProfile?: FamilyProfile | null;
  initialHistory?: HistoryEntry[];
  initialPinnedPlace?: SavedItem | null;
}) {
  const [profile, setProfile] = useState<FamilyProfile | null>(() => initialProfile ?? getProfile());
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    initialHistory.length ? initialHistory : getHistory()
  );
  const [pinnedPlace, setPinnedPlace] = useState<SavedItem | null>(
    () => initialPinnedPlace ?? getPinnedPlace()
  );
  const [loading, setLoading] = useState(false);
  const [busySlot, setBusySlot] = useState<ActivityCardType["slot"] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) {
      syncProfileCache(initialProfile);
      setProfile(initialProfile);
    }
    if (initialHistory.length) {
      syncHistoryCache(initialHistory);
      setHistory(initialHistory);
    }
    if (initialPinnedPlace) {
      syncPinnedPlaceCache(initialPinnedPlace);
      setPinnedPlace(initialPinnedPlace);
    }

    const cachedPlan = getCachedPlan();
    if (cachedPlan) {
      setPlan(cachedPlan);
    }
  }, [initialHistory, initialPinnedPlace, initialProfile]);

  const refreshDay = useCallback(async (nextProfile = profile) => {
    if (!nextProfile) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await generatePlan(nextProfile, history);
      if (!data.plan) {
        throw new Error("Daily plan response was incomplete.");
      }
      saveCachedPlan(data.plan);
      setPlan(data.plan);
      setSource(data.source);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to build your day.");
    } finally {
      setLoading(false);
    }
  }, [history, profile]);

  useEffect(() => {
    if (!profile || plan) {
      return;
    }

    void refreshDay(profile);
  }, [profile, plan, refreshDay]);

  const discoveryMode = plan?.discoveryMode ?? (source as DiscoverySource | null);
  const discoveryFraming = getDiscoveryFraming(discoveryMode);
  const pinnedMapsUrl = getPinnedMapsUrl(pinnedPlace);

  async function replaceSlot(slot: ActivityCardType["slot"]) {
    if (!profile || !plan) {
      return;
    }

    setBusySlot(slot);
    setError(null);
    setMessage(null);

    try {
      const response = await generatePlan(
        profile,
        history,
        slot,
        plan.activities.map((activity) => activity.name),
      );
      if (!response.activity) {
        throw new Error("Replacement activity was not returned.");
      }
      const nextPlan = replaceActivityInPlan(plan, response.activity);
      setPlan(nextPlan);
      setSource(response.source);
      setMessage(`Fresh ${slot} idea loaded.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to replace activity.");
    } finally {
      setBusySlot(null);
    }
  }

  async function markAction(action: "done" | "skip" | "saved", activity: ActivityCardType) {
    if (action === "saved") {
      const result = await saveSavedItem({
        type: "activity",
        title: activity.name,
        subtitle: `${activity.slot} · ${activity.duration}`,
        payload: activity as unknown as Record<string, unknown>,
      });
      setMessage(
        result.persistence === "supabase"
          ? `${activity.name} saved to your account.`
          : `${activity.name} saved for later.`
      );
      return;
    }

    const result = await recordActivityAction({
      action,
      slot: activity.slot,
      title: activity.name,
      payload: activity as unknown as Record<string, unknown>,
    });
    setHistory(result.history);
    setMessage(action === "done" ? `${activity.name} marked done.` : `${activity.name} skipped.`);
  }

  async function loadDemoFamily() {
    const demo = createDemoProfile();
    await saveProfile(demo, { mode: "local-only" });
    setProfile(demo);
    setPlan(null);
    setMessage("Demo family loaded on this device only.");
  }

  if (!profile) {
    return (
      <div className="page-shell py-10">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <CardTitle className="text-3xl">Set up your family first</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">PlayDays needs your kids, location, and preferences before it can build a real day.</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="touch-safe rounded-2xl px-6">
                <Link href="/start-setup">Start setup</Link>
              </Button>
              <Button variant="outline" className="touch-safe rounded-2xl" onClick={() => void loadDemoFamily()}>
                <Sparkles className="mr-2 size-4" />
                Use demo family
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="hero-wash grid gap-4 rounded-[2rem] border border-border/60 px-5 py-6 shadow-xl shadow-primary/5 sm:px-8 sm:py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <Badge className="w-fit rounded-full bg-primary text-primary-foreground">Today&apos;s PlayDay</Badge>
          <h1 className="text-balance text-4xl sm:text-5xl">One good family plan before the day gets loud.</h1>
          <p className="max-w-2xl text-base leading-8 text-muted-foreground">
            Five cards tuned to your kids, your weather, and the materials you actually have at home.
          </p>
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-3 py-2">
              <CalendarDays className="size-4 text-primary" />
              {plan?.headline ?? "Building your daily plan"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-3 py-2">
              <MapPin className="size-4 text-primary" />
              {plan?.weather.locationLabel || profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/80 px-3 py-2">
              <Mail className="size-4 text-primary" />
              {profile.preferences.digestEnabled ? "Digest on" : "Digest off"}
            </span>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="touch-safe rounded-2xl px-6" disabled={loading} onClick={() => void refreshDay()}>
              {loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh full day
            </Button>
            <Button variant="outline" className="touch-safe rounded-2xl" onClick={() => void loadDemoFamily()}>
              <Sparkles className="size-4" />
              Demo family
            </Button>
          </div>
        </div>
        <Card className="border-border/60 bg-white/80">
          <CardHeader>
            <CardTitle className="text-2xl">Weather read</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p className="text-base text-foreground">{plan?.weather.summary ?? "Loading weather..."}</p>
            {plan ? (
              <>
                <p>High {plan.weather.high}°F · Low {plan.weather.low}°F · Rain chance {plan.weather.precipitationChance}%</p>
                <p>{plan.weather.recommendation}</p>
              </>
            ) : (
              <p>Pulling local weather and fitting the day around it.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      {message ? <p className="mt-4 text-sm text-primary">{message}</p> : null}

      {plan?.timeline.length ? (
        <section className="mt-8">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Clock3 className="size-5 text-primary" />
                Today&apos;s rhythm
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-3">
              {plan.timeline.map((block) => (
                <div key={block.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{block.label}</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{block.timeRange}</p>
                    </div>
                    <Badge variant="outline" className="rounded-full">
                      {block.activityNames.length} picks
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{block.summary}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {block.activityNames.map((name) => (
                      <Badge key={name} className="rounded-full bg-secondary text-secondary-foreground">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {pinnedPlace ? (
        <Card className="card-soft mt-6 border-border/60">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Today&apos;s outing anchor</p>
              <p className="text-xl font-semibold text-foreground">{pinnedPlace.title}</p>
              <p className="text-sm text-muted-foreground">{pinnedPlace.subtitle}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Pinned from Discover so it stays visible while you work the rest of the day.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {pinnedMapsUrl ? (
                <Button asChild className="touch-safe rounded-2xl">
                  <a href={pinnedMapsUrl} target="_blank" rel="noreferrer">
                    Open map
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="touch-safe rounded-2xl">
                <Link href="/discover">Choose another outing</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-8 grid gap-5">
        {plan?.activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            busy={busySlot === activity.slot}
            onDone={() => void markAction("done", activity)}
            onSave={() => void markAction("saved", activity)}
            onSkip={() => {
              void (async () => {
                await markAction("skip", activity);
                await replaceSlot(activity.slot);
              })();
            }}
          />
        ))}
        {!plan && loading ? (
          <Card className="card-soft border-border/60">
            <CardContent className="flex items-center gap-3 py-10 text-muted-foreground">
              <LoaderCircle className="size-5 animate-spin text-primary" />
              Building five cards, local picks, and nap-trap ideas...
            </CardContent>
          </Card>
        ) : null}
      </section>

      {plan ? (
        <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">{discoveryFraming.title}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {discoveryFraming.note ? (
                <div className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4 text-sm leading-7 text-muted-foreground">
                  {discoveryFraming.note}
                </div>
              ) : null}
              {plan.discovery.slice(0, 3).map((place) => (
                <div key={place.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{place.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {discoveryMode === "google"
                          ? `${place.category} · ${place.distanceMiles.toFixed(1)} mi`
                          : place.category}
                      </p>
                    </div>
                    {discoveryMode === "google" && place.rating ? (
                      <Badge variant="outline" className="rounded-full">
                        {place.rating.toFixed(1)} stars
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{place.address || place.hours}</p>
                  {place.mapsUrl ? (
                    <Button asChild variant="outline" className="mt-3 touch-safe rounded-2xl">
                      <a href={place.mapsUrl} target="_blank" rel="noreferrer">
                        Open map
                      </a>
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="card-soft border-border/60">
            <CardHeader>
              <CardTitle className="text-2xl">Nap Trap Mode</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {plan.napTrap.map((item) => (
                <div key={item.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <Badge variant="outline" className="rounded-full">{item.duration}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.kind}</p>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.details}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
