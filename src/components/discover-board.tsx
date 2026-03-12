"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, MapPin, Sparkles } from "lucide-react";
import {
  DISCOVERY_CATEGORIES,
  createDemoProfile,
  type DiscoverySource,
  type FamilyLocation,
  type LocalPlace,
} from "@/lib/schemas";
import { getProfile, savePinnedPlace, saveProfile, saveSavedItem } from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function fetchPlaces(location: FamilyLocation, categories: string[]) {
  const response = await fetch("/api/discover", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ location, categories }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "Could not load nearby places.");
  }

  return response.json() as Promise<{ places: LocalPlace[]; source: DiscoverySource }>;
}

function getDiscoveryNote(source: DiscoverySource | null) {
  switch (source) {
    case "ai":
      return "These are smart backup suggestions for your area. Double-check hours and details before you head out.";
    case "fallback":
      return "Live place listings are unavailable right now, so these cards are map-ready category searches that help you pick the exact stop fast.";
    case "google":
      return "Showing specific nearby places with map links and live listing details when available.";
    default:
      return "Search your area when you need a fast outing pivot.";
  }
}

export function DiscoverBoard() {
  const [location, setLocation] = useState<FamilyLocation>({ zip: "", city: "", label: "" });
  const [selected, setSelected] = useState<string[]>(["parks", "libraries", "playgrounds"]);
  const [places, setPlaces] = useState<LocalPlace[]>([]);
  const [source, setSource] = useState<DiscoverySource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const profile = getProfile();
    if (profile) {
      setLocation(profile.location);
      void runSearch(profile.location, selected);
    }
    // This syncs localStorage data once on mount for the saved family profile.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(nextLocation = location, nextSelected = selected) {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const data = await fetchPlaces(nextLocation, nextSelected);
      setPlaces(data.places);
      setSource(data.source);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load nearby places.");
    } finally {
      setLoading(false);
    }
  }

  function toggleCategory(category: string) {
    const next = selected.includes(category)
      ? selected.filter((item) => item !== category)
      : [...selected, category];
    setSelected(next);
  }

  function useDemoLocation() {
    const demo = createDemoProfile();
    saveProfile(demo);
    setLocation(demo.location);
    setMessage("Demo family location loaded.");
    void runSearch(demo.location, selected);
  }

  function addToToday(place: LocalPlace) {
    saveSavedItem({
      type: "place",
      title: place.name,
      subtitle:
        source === "google"
          ? `${place.category} · ${place.distanceMiles.toFixed(1)} mi`
          : place.category,
      payload: place as unknown as Record<string, unknown>,
    });

    if (source === "google") {
      savePinnedPlace(place);
      setMessage(`${place.name} pinned as today's outing anchor.`);
      return;
    }

    if (source === "fallback") {
      setMessage("Map search saved. Open the map to choose the exact stop for today.");
      return;
    }

    setMessage("Saved as a backup idea. Double-check the details before you head out.");
  }

  return (
    <div className="page-shell py-8 sm:py-10">
      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Card className="card-soft border-border/60">
          <CardHeader>
            <Badge className="w-fit rounded-full bg-primary text-primary-foreground">Local discovery</Badge>
            <CardTitle className="text-4xl text-balance">Pull in the easy outing before the cabin fever hits.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="discover-city">City</Label>
                <Input
                  id="discover-city"
                  value={location.city}
                  onChange={(event) => setLocation((current) => ({ ...current, city: event.target.value }))}
                  className="touch-safe rounded-2xl"
                  placeholder="Newport Beach"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discover-zip">Zip</Label>
                <Input
                  id="discover-zip"
                  value={location.zip}
                  onChange={(event) => setLocation((current) => ({ ...current, zip: event.target.value }))}
                  className="touch-safe rounded-2xl"
                  placeholder="92660"
                />
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="touch-safe rounded-2xl px-6" disabled={loading} onClick={() => void runSearch()}>
                {loading ? <LoaderCircle className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                Search nearby
              </Button>
              <Button variant="outline" className="touch-safe rounded-2xl" onClick={useDemoLocation}>
                <Sparkles className="size-4" />
                Use demo location
              </Button>
              <Button asChild variant="ghost" className="touch-safe rounded-2xl">
                <Link href="/today">Back to today</Link>
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {DISCOVERY_CATEGORIES.map((category) => (
                <Button
                  key={category}
                  type="button"
                  variant={selected.includes(category) ? "default" : "outline"}
                  className="touch-safe rounded-full px-4 text-sm"
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </Button>
              ))}
            </div>
            <div className="rounded-[1.3rem] border border-border/60 bg-white/75 p-4 text-sm leading-7 text-muted-foreground">
              {getDiscoveryNote(source)}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {message ? <p className="text-sm text-primary">{message}</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {places.map((place) => (
            <Card key={place.id} className="card-soft border-border/60">
              <CardContent className="space-y-4 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-semibold text-foreground">{place.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {source === "google"
                        ? `${place.category} · ${place.distanceMiles.toFixed(1)} mi away`
                        : place.category}
                    </p>
                  </div>
                  {source === "google" && place.rating ? (
                    <Badge variant="outline" className="rounded-full">
                      {place.rating.toFixed(1)} stars
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {place.kidFriendly ? <Badge className="rounded-full bg-secondary text-secondary-foreground">Kid-friendly</Badge> : null}
                  {place.todayEvent ? <Badge className="rounded-full bg-accent text-accent-foreground">{place.todayEvent}</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{place.address || place.hours}</p>
                <ul className="grid gap-2 text-sm leading-7 text-muted-foreground">
                  {place.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button className="touch-safe rounded-2xl" onClick={() => addToToday(place)}>
                    {source === "google"
                      ? "Pin for today's outing"
                      : source === "fallback"
                        ? "Save search for later"
                        : "Save as backup idea"}
                  </Button>
                  {place.mapsUrl ? (
                    <Button asChild variant="outline" className="touch-safe rounded-2xl">
                      <a href={place.mapsUrl} target="_blank" rel="noreferrer">
                        Open map
                      </a>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {!places.length && !loading ? (
            <Card className="card-soft border-border/60">
              <CardContent className="py-10 text-sm text-muted-foreground">
                Choose a location, pick the outing categories you want, and tap search. PlayDays will show specific nearby places when available and switch to lighter backup guidance when it cannot.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </section>
    </div>
  );
}
