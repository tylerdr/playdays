import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient, hasSupabaseServerEnv } from "@/lib/supabase/server";
import { eventSchema, type Event } from "@/lib/schemas";

export interface EventQueryFilters {
  city?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  age?: number;
  limit?: number;
}

export interface PublicEventsResult {
  events: Event[];
  availability: "connected" | "unavailable";
  message?: string;
}

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  image_url: string | null;
  location_name: string | null;
  location_address: string | null;
  city: string;
  lat: number | null;
  lng: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  recurring: string | null;
  age_min: number | null;
  age_max: number | null;
  cost_type: "free" | "paid" | "unknown" | null;
  cost_amount: number | null;
  tags: string[] | null;
  source: "ai" | "manual" | "user" | null;
  confidence: "high" | "medium" | "low" | null;
  is_verified: boolean | null;
  discovery_area: string | null;
  created_at: string | null;
  expires_at: string | null;
};

function mapEventRow(row: EventRow) {
  return eventSchema.parse({
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    url: row.url ?? "",
    imageUrl: row.image_url ?? "",
    locationName: row.location_name ?? "",
    locationAddress: row.location_address ?? "",
    city: row.city,
    lat: row.lat,
    lng: row.lng,
    startDate: row.start_date ?? "",
    endDate: row.end_date ?? "",
    startTime: row.start_time ?? "",
    endTime: row.end_time ?? "",
    recurring: row.recurring ?? "",
    ageMin: row.age_min ?? 0,
    ageMax: row.age_max ?? 18,
    costType: row.cost_type ?? "unknown",
    costAmount: row.cost_amount,
    tags: row.tags ?? [],
    source: row.source ?? "ai",
    confidence: row.confidence ?? "low",
    isVerified: row.is_verified ?? false,
    discoveryArea: row.discovery_area ?? "",
    createdAt: row.created_at ?? "",
    expiresAt: row.expires_at ?? "",
  });
}

function filterExpired(events: Event[]) {
  const now = new Date();
  return events.filter((event) => !event.expiresAt || new Date(event.expiresAt) > now);
}

function filterByAge(events: Event[], age?: number) {
  if (typeof age !== "number") {
    return events;
  }

  return events.filter((event) => age >= event.ageMin && age <= event.ageMax);
}

function getServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function hasEventServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function listPublicEvents(filters: EventQueryFilters = {}): Promise<PublicEventsResult> {
  if (!hasSupabaseServerEnv()) {
    return {
      events: [],
      availability: "unavailable",
      message: "Shared events are not connected in this environment yet.",
    };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      events: [],
      availability: "unavailable",
      message: "Shared events are not connected in this environment yet.",
    };
  }

  let query = supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: true })
    .order("title", { ascending: true })
    .limit(filters.limit ?? 48);

  if (filters.city) {
    query = query.eq("city", filters.city);
  }

  if (filters.dateFrom) {
    query = query.gte("start_date", filters.dateFrom);
  }

  if (filters.dateTo) {
    query = query.lte("start_date", filters.dateTo);
  }

  if (filters.tags?.length) {
    query = query.overlaps("tags", filters.tags);
  }

  const { data, error } = await query;
  if (error) {
    return {
      events: [],
      availability: "unavailable",
      message: "Shared events could not be loaded right now.",
    };
  }

  const events = filterByAge(filterExpired((data ?? []).map((row) => mapEventRow(row as EventRow))), filters.age);
  return { events, availability: "connected" };
}

export async function getPublicEventById(id: string) {
  if (!hasSupabaseServerEnv()) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  return data ? mapEventRow(data as EventRow) : null;
}

export async function getRelatedEvents(event: Event, limit = 3) {
  const result = await listPublicEvents({
    city: event.city,
    tags: event.tags.slice(0, 2),
    limit: limit + 3,
  });

  return result.events.filter((candidate) => candidate.id !== event.id).slice(0, limit);
}

export async function getLastDiscoveryRun(area: string) {
  const supabase = getServiceRoleClient();
  if (!supabase) {
    return null;
  }

  const { data } = await supabase
    .from("event_discovery_runs")
    .select("*")
    .eq("area", area)
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

export async function logDiscoveryRun(run: {
  area: string;
  eventsFound: number;
  eventsNew: number;
  status: string;
  errorMessage?: string | null;
}) {
  const supabase = getServiceRoleClient();
  if (!supabase) {
    return;
  }

  await supabase.from("event_discovery_runs").insert({
    area: run.area,
    events_found: run.eventsFound,
    events_new: run.eventsNew,
    status: run.status,
    error_message: run.errorMessage ?? null,
  });
}

export async function upsertDiscoveredEvents(events: Event[]) {
  const supabase = getServiceRoleClient();
  if (!supabase || !events.length) {
    return 0;
  }

  const rows = events.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description || null,
    url: event.url || null,
    image_url: event.imageUrl || null,
    location_name: event.locationName || null,
    location_address: event.locationAddress || null,
    city: event.city,
    lat: event.lat ?? null,
    lng: event.lng ?? null,
    start_date: event.startDate || null,
    end_date: event.endDate || null,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    recurring: event.recurring || null,
    age_min: event.ageMin,
    age_max: event.ageMax,
    cost_type: event.costType,
    cost_amount: event.costAmount ?? null,
    tags: event.tags,
    source: event.source,
    confidence: event.confidence,
    is_verified: event.isVerified,
    discovery_area: event.discoveryArea,
    expires_at: event.expiresAt || null,
  }));

  const { data, error } = await supabase
    .from("events")
    .upsert(rows, { onConflict: "title,start_date,city", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return 0;
  }

  return data?.length ?? 0;
}
