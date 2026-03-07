import type { FamilyLocation, WeatherSummary } from "@/lib/schemas";
import { resolveLocation } from "@/lib/server/location";

const WEATHER_CODES: Record<number, string> = {
  0: "Clear and bright",
  1: "Mostly sunny",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Steady drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain showers",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Passing showers",
  81: "Rainy spells",
  82: "Stormy showers",
  95: "Thunderstorms",
  96: "Thunderstorms and hail",
  99: "Severe storms",
};

function buildRecommendation(high: number, precipitationChance: number) {
  if (precipitationChance >= 55) {
    return "Lead with indoor play, then use the driest window for a quick outside reset.";
  }

  if (high >= 88) {
    return "Aim for outdoor play early, then shift to shade or water play by midday.";
  }

  if (high <= 55) {
    return "Bundle up for a short outdoor win, then save the bigger energy burn for indoors.";
  }

  return "This is a strong day for one outside anchor activity and one local outing.";
}

export async function getWeather(location: FamilyLocation): Promise<WeatherSummary> {
  const resolved = await resolveLocation(location);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", resolved.latitude.toString());
  url.searchParams.set("longitude", resolved.longitude.toString());
  url.searchParams.set("current", "temperature_2m");
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("timezone", resolved.timezone || "auto");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url.toString(), {
    next: { revalidate: 60 * 30 },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch weather.");
  }

  const data = (await response.json()) as {
    current?: { temperature_2m?: number };
    daily?: {
      weather_code?: number[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
    };
  };

  const weatherCode = data.daily?.weather_code?.[0] ?? 0;
  const high = Math.round(data.daily?.temperature_2m_max?.[0] ?? 72);
  const low = Math.round(data.daily?.temperature_2m_min?.[0] ?? 58);
  const precipitationChance = Math.round(data.daily?.precipitation_probability_max?.[0] ?? 10);

  return {
    locationLabel: resolved.label,
    summary: WEATHER_CODES[weatherCode] ?? "Mixed weather",
    high,
    low,
    precipitationChance,
    recommendation: buildRecommendation(high, precipitationChance),
    currentTemperature:
      typeof data.current?.temperature_2m === "number"
        ? Math.round(data.current.temperature_2m)
        : null,
  };
}
