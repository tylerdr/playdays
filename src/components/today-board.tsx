"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock3, LoaderCircle, Mail, MapPin, RefreshCw, Sparkles } from "lucide-react";
import { createDemoProfile, type ActivityCard as ActivityCardType, type DailyPlan, type FamilyProfile } from "@/lib/schemas";
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
} from "@/lib/storage";
import { ActivityCard } from "@/components/activity-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

async function generatePlan(profile: FamilyProfile, replaceSlot?: ActivityCardType["slot"], excludedTitles: string[] = []) {
  const response = await fetch("/api/generate-daily", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      profile,
      history: getHistory(),
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

export function TodayBoard() {
  const [profile, setProfile] = useState<FamilyProfile | null>(null);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busySlot, setBusySlot] = useState<ActivityCardType["slot"] | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const existingProfile = getProfile();
    setProfile(existingProfile);
    const cachedPlan = getCachedPlan();
    if (cachedPlan) {
      setPlan(cachedPlan);
    }
  }, []);

  const refreshDay = useCallback(async (nextProfile = profile) => {
    if (!nextProfile) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await generatePlan(nextProfile);
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
  }, [profile]);

  useEffect(() => {
    if (!profile || plan) {
      return;
    }

    void refreshDay(profile);
  }, [profile, plan, refreshDay]);

  const pinnedPlace = getPinnedPlace();

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

  function markAction(action: "done" | "skip" | "saved", activity: ActivityCardType) {
    if (action === "saved") {
      saveSavedItem({
        type: "activity",
        title: activity.name,
        subtitle: `${activity.slot} · ${activity.duration}`,
        payload: activity as unknown as Record<string, unknown>,
      });
      setMessage(`${activity.name} saved for later.`);
      return;
    }

    recordActivityAction({
      action,
      slot: activity.slot,
      title: activity.name,
      payload: activity as unknown as Record<string, unknown>,
    });
    setMessage(action === "done" ? `${activity.name} marked done.` : `${activity.name} skipped.`);
  }

  function loadDemoFamily() {
    const demo = createDemoProfile();
    saveProfile(demo);
    setProfile(demo);
    setPlan(null);
    setMessage("Demo family loaded.");
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
              <Button variant="outline" className="touch-safe rounded-2xl" onClick={loadDemoFamily}>
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
            <Button variant="outline" className="touch-safe rounded-2xl" onClick={loadDemoFamily}>
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
                <p>High {plan.weather.high}F · Low {plan.weather.low}F · Rain chance {plan.weather.precipitationChance}%</p>
                <p>{plan.weather.recommendation}</p>
              </>
            ) : (
              <p>Pulling local weather and fitting the day around it.</p>
            )}
            {source ? <Badge variant="outline" className="rounded-full">Discovery source: {source}</Badge> : null}
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
              <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Pinned local pick</p>
              <p className="text-xl font-semibold text-foreground">{pinnedPlace.title}</p>
              <p className="text-sm text-muted-foreground">{pinnedPlace.subtitle}</p>
            </div>
            <Button variant="outline" className="touch-safe rounded-2xl" onClick={() => setMessage("Pinned outing stays at the top of today.")}>
              Keep in today&apos;s mix
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="mt-8 grid gap-5">
        {plan?.activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            busy={busySlot === activity.slot}
            onDone={() => markAction("done", activity)}
            onSave={() => markAction("saved", activity)}
            onSkip={() => {
              markAction("skip", activity);
              void replaceSlot(activity.slot);
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
              <CardTitle className="text-2xl">Nearby options for today</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {plan.discovery.slice(0, 3).map((place) => (
                <div key={place.id} className="rounded-[1.4rem] border border-border/60 bg-white/80 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{place.name}</p>
                      <p className="text-sm text-muted-foreground">{place.category} · {place.distanceMiles.toFixed(1)} mi</p>
                    </div>
                    {place.rating ? <Badge variant="outline" className="rounded-full">{place.rating.toFixed(1)} stars</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{place.address || place.hours}</p>
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
