import { generateObject } from "ai";
import { z } from "zod";
import { DISCOVERY_CATEGORIES, localPlaceSchema, type FamilyLocation, type LocalPlace } from "@/lib/schemas";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";
import { resolveLocation } from "@/lib/server/location";

export interface DiscoveryResult {
  places: LocalPlace[];
  source: "google" | "ai" | "fallback";
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function titleCase(value: string) {
  return value
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

async function searchGooglePlaces(location: FamilyLocation, categories: string[]) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return [] as LocalPlace[];
  }

  const resolved = await resolveLocation(location);
  const selected = (categories.length ? categories : [...DISCOVERY_CATEGORIES]).slice(0, 3);
  const results = new Map<string, LocalPlace>();

  for (const category of selected) {
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": [
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.rating",
          "places.currentOpeningHours",
          "places.googleMapsUri",
          "places.primaryTypeDisplayName",
          "places.id",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: `${category} for kids near ${resolved.label}`,
        maxResultCount: 4,
        languageCode: "en",
        locationBias: {
          circle: {
            center: {
              latitude: resolved.latitude,
              longitude: resolved.longitude,
            },
            radius: 12000,
          },
        },
      }),
    });

    if (!response.ok) {
      continue;
    }

    const data = (await response.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
        rating?: number;
        currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
        googleMapsUri?: string;
        primaryTypeDisplayName?: { text?: string };
      }>;
    };

    for (const place of data.places ?? []) {
      if (!place.displayName?.text || !place.location?.latitude || !place.location?.longitude) {
        continue;
      }

      const distanceMiles = haversineMiles(
        resolved.latitude,
        resolved.longitude,
        place.location.latitude,
        place.location.longitude,
      );

      results.set(place.id ?? `${place.displayName.text}-${place.formattedAddress}`, {
        id: place.id ?? `${place.displayName.text}-${place.formattedAddress}`,
        name: place.displayName.text,
        category: place.primaryTypeDisplayName?.text ?? titleCase(category),
        distanceMiles: Number(distanceMiles.toFixed(1)),
        rating: typeof place.rating === "number" ? Number(place.rating.toFixed(1)) : null,
        hours: place.currentOpeningHours?.weekdayDescriptions?.[0] ?? "Check listing for hours",
        address: place.formattedAddress ?? "",
        kidFriendly: true,
        todayEvent: null,
        reasons: [
          `Short drive from ${resolved.label}`,
          `Strong fit for ${category}`,
          place.currentOpeningHours?.openNow ? "Looks open now" : "Good backup outing",
        ],
        mapsUrl: place.googleMapsUri ?? "",
      });
    }
  }

  return [...results.values()]
    .sort((a, b) => (a.distanceMiles - b.distanceMiles) || ((b.rating ?? 0) - (a.rating ?? 0)))
    .slice(0, 8);
}

async function generateAiPlaces(location: FamilyLocation, categories: string[]) {
  if (!hasOpenAIKey()) {
    return [] as LocalPlace[];
  }

  const resolved = await resolveLocation(location);
  const { object } = await generateObject({
    model: getOpenAIModel(),
    schema: z.object({
      places: z.array(localPlaceSchema).min(4).max(8),
    }),
    system:
      "You help parents find genuinely plausible kid-friendly outings. Keep names and formats realistic. Do not invent impossible distances or strange formatting.",
    prompt: `Location: ${resolved.label}
Categories: ${(categories.length ? categories : [...DISCOVERY_CATEGORIES]).join(", ")}
Return places with realistic names, short reasons, and occasional event-style notes when the place type commonly hosts them.`,
  });

  return object.places.map((place, index) => ({
    ...place,
    id: place.id || `ai-place-${index}`,
    distanceMiles: Number(place.distanceMiles.toFixed(1)),
  }));
}

function fallbackPlaces(location: FamilyLocation, categories: string[]): LocalPlace[] {
  const label = location.label || [location.city, location.zip].filter(Boolean).join(", ") || "your area";
  const selected = (categories.length ? categories : [...DISCOVERY_CATEGORIES]).slice(0, 5);

  return selected.map((category, index) => ({
    id: `fallback-${category}-${index}`,
    name: `${label} ${titleCase(category)}`,
    category: titleCase(category),
    distanceMiles: index + 1,
    rating: null,
    hours: "Search local listing for todays hours",
    address: label,
    kidFriendly: true,
    todayEvent: category === "libraries" ? "Check for story time blocks this morning" : null,
    reasons: ["Good same-day outing category", "Works well when the plan needs a location change"],
    mapsUrl: "",
  }));
}

export async function discoverPlaces(location: FamilyLocation, categories: string[] = []): Promise<DiscoveryResult> {
  const googlePlaces = await searchGooglePlaces(location, categories);
  if (googlePlaces.length) {
    return { places: googlePlaces, source: "google" };
  }

  const aiPlaces = await generateAiPlaces(location, categories);
  if (aiPlaces.length) {
    return { places: aiPlaces, source: "ai" };
  }

  return {
    places: fallbackPlaces(location, categories),
    source: "fallback",
  };
}
