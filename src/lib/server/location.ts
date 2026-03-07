import type { FamilyLocation } from "@/lib/schemas";

export interface ResolvedLocation {
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

function cleanQuery(value: string) {
  return value.replace(/\s+/g, " ").replace(/,\s*[A-Z]{2}\b/g, "").trim();
}

export function getLocationLabel(location: FamilyLocation) {
  return location.label || [location.city, location.zip].filter(Boolean).join(", ") || "your area";
}

function buildQueries(location: FamilyLocation) {
  const candidates = [
    location.city,
    location.label?.split(",")[0],
    location.label,
    location.zip,
    [location.city, location.zip].filter(Boolean).join(" "),
  ]
    .map((value) => cleanQuery(value ?? ""))
    .filter(Boolean);

  return [...new Set(candidates)];
}

async function searchLocation(query: string) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    next: { revalidate: 60 * 60 * 12 },
  });

  if (!response.ok) {
    throw new Error("Failed to geocode location.");
  }

  const data = (await response.json()) as {
    results?: Array<{
      name: string;
      admin1?: string;
      country_code?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    }>;
  };

  return data.results?.[0] ?? null;
}

export async function resolveLocation(location: FamilyLocation): Promise<ResolvedLocation> {
  if (typeof location.latitude === "number" && typeof location.longitude === "number") {
    return {
      label: getLocationLabel(location),
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }

  const queries = buildQueries(location);
  if (!queries.length) {
    throw new Error("A city or zip code is required to resolve location.");
  }

  for (const query of queries) {
    const match = await searchLocation(query);
    if (!match) {
      continue;
    }

    return {
      label: location.label || [match.name, match.admin1, match.country_code].filter(Boolean).join(", "),
      latitude: match.latitude,
      longitude: match.longitude,
      timezone: match.timezone,
    };
  }

  throw new Error(`No location found for ${getLocationLabel(location)}.`);
}
