import { addDays, format } from "date-fns";
import { generateObject } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";

const generatedEventSchema = z.object({
  title: z.string(),
  description: z.string().default(""),
  url: z.string().optional().or(z.literal("")),
  locationName: z.string().default(""),
  locationAddress: z.string().default(""),
  city: z.string().default(""),
  startDate: z.string(),
  startTime: z.string().default(""),
  endDate: z.string().optional().or(z.literal("")),
  endTime: z.string().optional().or(z.literal("")),
  ageMin: z.number().min(0).max(18).default(0),
  ageMax: z.number().min(0).max(18).default(10),
  costType: z.enum(["free", "paid", "unknown"]).default("unknown"),
  costAmount: z.number().nullable().optional(),
  tags: z.array(z.string()).default([]),
});

export interface EventDiscoveryInput {
  area: string;
  city?: string;
  kidAges?: number[];
  preferencesSummary?: string;
  limit?: number;
  adminClient?: SupabaseClient | null;
}

export interface DiscoveredEventRecord {
  title: string;
  description: string;
  url: string;
  location_name: string;
  location_address: string;
  city: string;
  start_date: string;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  age_min: number;
  age_max: number;
  cost_type: "free" | "paid" | "unknown";
  cost_amount: number | null;
  tags: string[];
  source: "ai";
  confidence: "low";
  is_verified: false;
  discovery_area: string;
  expires_at: string;
}

export interface EventDiscoveryResult {
  mode: "stored" | "preview" | "skipped";
  area: string;
  generatedCount: number;
  insertedCount: number;
  warnings: string[];
  skippedReason?: string;
  events: DiscoveredEventRecord[];
}

function buildSearchUrl(title: string, area: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", `${title} ${area}`.trim());
  return url.toString();
}

function trimTime(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized.slice(0, 5) : null;
}

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message?.includes("does not exist") ||
    error.message?.includes("Could not find")
  );
}

async function logRun(
  adminClient: SupabaseClient | null | undefined,
  payload: {
    area: string;
    events_found: number;
    events_new: number;
    status: string;
    error_message?: string;
  },
) {
  if (!adminClient) {
    return;
  }

  const result = await adminClient.from("event_discovery_runs").insert(payload);
  if (result.error && !isMissingTableError(result.error)) {
    throw result.error;
  }
}

async function storeEvents(adminClient: SupabaseClient, events: DiscoveredEventRecord[], warnings: string[]) {
  let insertedCount = 0;

  for (const event of events) {
    const result = await adminClient.from("events").insert(event);
    if (result.error) {
      if (result.error.code === "23505") {
        continue;
      }

      if (isMissingTableError(result.error)) {
        warnings.push(`Events table unavailable: ${result.error.message}`);
        return {
          mode: "preview" as const,
          insertedCount,
        };
      }

      warnings.push(`Event insert failed for ${event.title}: ${result.error.message}`);
      continue;
    }

    insertedCount += 1;
  }

  return {
    mode: "stored" as const,
    insertedCount,
  };
}

export async function discoverEvents(input: EventDiscoveryInput): Promise<EventDiscoveryResult> {
  const area = input.area.trim();
  if (!area) {
    return {
      mode: "skipped",
      area: input.area,
      generatedCount: 0,
      insertedCount: 0,
      warnings: [],
      skippedReason: "An area is required for event discovery.",
      events: [],
    };
  }

  if (!hasOpenAIKey()) {
    return {
      mode: "skipped",
      area,
      generatedCount: 0,
      insertedCount: 0,
      warnings: [],
      skippedReason: "OPENAI_API_KEY is not configured for event discovery.",
      events: [],
    };
  }

  const today = new Date();
  const todayLabel = format(today, "MMMM d, yyyy");
  const city = input.city || area.split(",")[0]?.trim() || area;
  const { object } = await generateObject({ mode: "json",
    model: getOpenAIModel(),
    schema: z.object({
      events: z.array(generatedEventSchema).min(3).max(input.limit ?? 6),
    }),
    system: [
      "You create structured lists of upcoming kid-friendly events.",
      "Prefer recurring, seasonal, or highly plausible family events that a parent could independently verify.",
      "Do not claim anything is verified.",
      "Keep dates within the next 21 days.",
    ].join(" "),
    prompt: [
      `Today's date is ${todayLabel}.`,
      `Area: ${area}`,
      `City: ${city}`,
      `Kid ages: ${(input.kidAges ?? []).join(", ") || "unknown"}`,
      `Preferences: ${input.preferencesSummary || "general family outings"}`,
      "Return 3 to 6 events that fit families with young kids. Include a realistic title, short description, date, optional times, place, tags, and a verification-friendly URL when possible.",
    ].join("\n"),
  });

  const events = object.events.map((event) => ({
    title: event.title,
    description: event.description,
    url: event.url || buildSearchUrl(event.title, area),
    location_name: event.locationName,
    location_address: event.locationAddress,
    city: event.city || city,
    start_date: event.startDate,
    start_time: trimTime(event.startTime),
    end_date: event.endDate || null,
    end_time: trimTime(event.endTime),
    age_min: event.ageMin,
    age_max: event.ageMax,
    cost_type: event.costType,
    cost_amount: typeof event.costAmount === "number" ? event.costAmount : null,
    tags: event.tags,
    source: "ai" as const,
    confidence: "low" as const,
    is_verified: false as const,
    discovery_area: area,
    expires_at: addDays(today, 21).toISOString(),
  }));

  const warnings: string[] = [
    "AI-discovered events are low-confidence and should be verified before families rely on them.",
  ];

  let mode: EventDiscoveryResult["mode"] = "preview";
  let insertedCount = 0;

  if (input.adminClient) {
    const stored = await storeEvents(input.adminClient, events, warnings);
    mode = stored.mode;
    insertedCount = stored.insertedCount;
  } else {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY is not configured, so discovery ran in preview mode only.");
  }

  try {
    await logRun(input.adminClient, {
      area,
      events_found: events.length,
      events_new: insertedCount,
      status: mode === "stored" ? "ok" : "preview",
    });
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : "Could not log discovery run.");
  }

  return {
    mode,
    area,
    generatedCount: events.length,
    insertedCount,
    warnings,
    events,
  };
}
