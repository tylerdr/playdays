import type { SupabaseClient } from "@supabase/supabase-js";
import type { FamilyProfile, HistoryEntry, SavedItem } from "@/lib/schemas";
import { familyProfileSchema } from "@/lib/schemas";
import { createServerSupabaseClient, hasSupabaseServerEnv } from "@/lib/supabase/server";

type JsonObject = Record<string, unknown>;

interface FamilyProfileRow {
  id: string;
  user_id?: string | null;
  parent_name?: string | null;
  email?: string | null;
  city?: string | null;
  zip_code?: string | null;
  profile?: unknown;
  digest_enabled?: boolean | null;
  timezone?: string | null;
}

interface ActivityHistoryRow {
  id: string;
  slot: string;
  action: string;
  title: string;
  payload?: JsonObject | null;
  happened_at?: string | null;
}

interface SavedItemRow {
  id: string;
  item_type: string;
  payload?: JsonObject | null;
  created_at?: string | null;
}

interface SavedEventRow {
  id: string;
  event_id?: string | null;
  custom_event?: JsonObject | null;
  list_name?: string | null;
  notes?: string | null;
  created_at?: string | null;
}

interface EventRow {
  id: string;
  title: string;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  city?: string | null;
  tags?: string[] | null;
  source?: string | null;
  confidence?: string | null;
  is_verified?: boolean | null;
  url?: string | null;
}

interface CustomSourceRow {
  id: string;
  name: string;
  location_name?: string | null;
  location_address?: string | null;
  day_of_week?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  recurrence_text?: string | null;
  notes?: string | null;
}

export interface FamilyEventSummary {
  id: string;
  title: string;
  dateLabel: string;
  startDate: string | null;
  locationLabel: string;
  sourceLabel: string;
  verificationLabel: string;
  notes: string[];
  url: string;
  listName?: string | null;
}

export interface CustomSourceSummary {
  id: string;
  name: string;
  recurrenceLabel: string;
  locationLabel: string;
  notes: string[];
}

export interface AuthenticatedFamilyContext {
  authMode: "unavailable" | "anonymous" | "authenticated";
  user: SessionUserSummary | null;
  profileRecordId: string | null;
  profile: FamilyProfile | null;
  history: HistoryEntry[];
  savedEvents: FamilyEventSummary[];
  upcomingEvents: FamilyEventSummary[];
  customSources: CustomSourceSummary[];
  legacySavedItems: SavedItem[];
  digestEnabled: boolean;
  timezone: string | null;
  warnings: string[];
}

export interface SessionUserSummary {
  id: string;
  email: string | null;
}

function fallbackVerificationLabel(event: Pick<EventRow, "is_verified" | "confidence" | "source">) {
  if (event.is_verified) {
    return "Verified";
  }

  if (event.confidence === "low" || event.source === "ai") {
    return "AI-found, verify before going";
  }

  return "Unverified";
}

function buildSearchUrl(title: string, area: string) {
  const url = new URL("https://www.google.com/search");
  url.searchParams.set("q", `${title} ${area}`.trim());
  return url.toString();
}

function formatDateLabel(startDate?: string | null, startTime?: string | null, fallback = "Date to confirm") {
  if (!startDate) {
    return fallback;
  }

  const pieces = [startDate];
  if (startTime) {
    pieces.push(startTime.slice(0, 5));
  }
  return pieces.join(" · ");
}

function normalizeProfileRow(row: FamilyProfileRow): FamilyProfile | null {
  const parsed = familyProfileSchema.safeParse(row.profile);
  if (!parsed.success) {
    return null;
  }

  return {
    ...parsed.data,
    parentName: row.parent_name || parsed.data.parentName,
    email: row.email ?? parsed.data.email,
    location: {
      ...parsed.data.location,
      city: row.city || parsed.data.location.city,
      zip: row.zip_code || parsed.data.location.zip,
      label:
        parsed.data.location.label ||
        [row.city || parsed.data.location.city, row.zip_code || parsed.data.location.zip]
          .filter(Boolean)
          .join(", "),
    },
  };
}

function asSavedItem(row: SavedItemRow): SavedItem | null {
  if (row.item_type !== "activity" && row.item_type !== "place") {
    return null;
  }

  const payload = row.payload ?? {};
  const title =
    typeof payload.title === "string"
      ? payload.title
      : typeof payload.name === "string"
        ? payload.name
        : "Saved item";
  const subtitle =
    typeof payload.subtitle === "string"
      ? payload.subtitle
      : typeof payload.category === "string"
        ? payload.category
        : "";

  return {
    id: row.id,
    type: row.item_type,
    title,
    subtitle,
    savedAt: row.created_at ?? new Date().toISOString(),
    payload,
  };
}

function asHistoryEntry(row: ActivityHistoryRow): HistoryEntry | null {
  if (row.action !== "done" && row.action !== "skip" && row.action !== "saved") {
    return null;
  }

  if (
    row.slot !== "outdoor" &&
    row.slot !== "indoor" &&
    row.slot !== "adventure" &&
    row.slot !== "calm" &&
    row.slot !== "together"
  ) {
    return null;
  }

  return {
    id: row.id,
    action: row.action,
    slot: row.slot,
    title: row.title,
    payload: row.payload ?? {},
    timestamp: row.happened_at ?? new Date().toISOString(),
    dateKey: (row.happened_at ?? new Date().toISOString()).slice(0, 10),
  };
}

function asEventSummary(event: EventRow, overrides?: Partial<FamilyEventSummary>): FamilyEventSummary {
  const area = overrides?.locationLabel || event.city || "";

  return {
    id: overrides?.id || event.id,
    title: overrides?.title || event.title,
    dateLabel: overrides?.dateLabel || formatDateLabel(event.start_date, event.start_time),
    startDate: overrides?.startDate ?? event.start_date ?? null,
    locationLabel:
      overrides?.locationLabel ||
      [event.location_name, event.location_address, event.city].filter(Boolean).join(" · ") ||
      "Location to confirm",
    sourceLabel: overrides?.sourceLabel || (event.source === "ai" ? "AI event discovery" : "Event feed"),
    verificationLabel: overrides?.verificationLabel || fallbackVerificationLabel(event),
    notes: overrides?.notes || (event.tags?.length ? event.tags.slice(0, 3) : []),
    url: overrides?.url || event.url || buildSearchUrl(event.title, area),
    listName: overrides?.listName ?? null,
  };
}

function asCustomSourceSummary(row: CustomSourceRow): CustomSourceSummary {
  const timeBits = [row.day_of_week, row.start_time && row.start_time.slice(0, 5), row.end_time && row.end_time.slice(0, 5)]
    .filter(Boolean)
    .join(" · ");

  return {
    id: row.id,
    name: row.name,
    recurrenceLabel: row.recurrence_text || timeBits || "Recurring program",
    locationLabel: [row.location_name, row.location_address].filter(Boolean).join(" · ") || "Custom program",
    notes: [row.notes].filter((value): value is string => Boolean(value)),
  };
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

function pushWarning(warnings: string[], message: string) {
  if (!warnings.includes(message)) {
    warnings.push(message);
  }
}

async function fetchProfileRow(
  supabase: SupabaseClient,
  user: SessionUserSummary,
  warnings: string[],
) {
  const result = await supabase
    .from("family_profiles")
    .select("id,user_id,parent_name,email,city,zip_code,profile,digest_enabled,timezone")
    .eq("user_id", user.id)
    .limit(1)
    .returns<FamilyProfileRow[]>();

  if (result.error) {
    pushWarning(warnings, `Supabase family profile lookup failed: ${result.error.message}`);
    return null;
  }

  return result.data?.[0] ?? null;
}

async function fetchHistory(supabase: SupabaseClient, profileId: string, warnings: string[]) {
  const result = await supabase
    .from("activity_history")
    .select("id,slot,action,title,payload,happened_at")
    .eq("profile_id", profileId)
    .order("happened_at", { ascending: false })
    .limit(15)
    .returns<ActivityHistoryRow[]>();

  if (result.error) {
    pushWarning(warnings, `Supabase history lookup failed: ${result.error.message}`);
    return [] as HistoryEntry[];
  }

  return (result.data ?? []).map(asHistoryEntry).filter((entry): entry is HistoryEntry => Boolean(entry));
}

async function fetchLegacySavedItems(supabase: SupabaseClient, profileId: string, warnings: string[]) {
  const result = await supabase
    .from("saved_items")
    .select("id,item_type,payload,created_at")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(12)
    .returns<SavedItemRow[]>();

  if (result.error) {
    pushWarning(warnings, `Supabase saved-items lookup failed: ${result.error.message}`);
    return [] as SavedItem[];
  }

  return (result.data ?? []).map(asSavedItem).filter((item): item is SavedItem => Boolean(item));
}

async function fetchSavedEvents(
  supabase: SupabaseClient,
  userId: string,
  profile: FamilyProfile,
  warnings: string[],
) {
  const savedResult = await supabase
    .from("saved_events")
    .select("id,event_id,custom_event,list_name,notes,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(12)
    .returns<SavedEventRow[]>();

  if (savedResult.error) {
    if (!isMissingTableError(savedResult.error)) {
      pushWarning(warnings, `Supabase saved-events lookup failed: ${savedResult.error.message}`);
    }
    return [] as FamilyEventSummary[];
  }

  const rows = savedResult.data ?? [];
  const eventIds = rows.map((row) => row.event_id).filter((value): value is string => Boolean(value));
  let eventsById = new Map<string, EventRow>();

  if (eventIds.length) {
    const eventsResult = await supabase
      .from("events")
      .select("id,title,start_date,end_date,start_time,location_name,location_address,city,tags,source,confidence,is_verified,url")
      .in("id", eventIds)
      .returns<EventRow[]>();

    if (eventsResult.error) {
      if (!isMissingTableError(eventsResult.error)) {
        pushWarning(warnings, `Supabase events lookup for saved events failed: ${eventsResult.error.message}`);
      }
    } else {
      eventsById = new Map((eventsResult.data ?? []).map((event) => [event.id, event]));
    }
  }

  return rows
    .map((row) => {
      const linked = row.event_id ? eventsById.get(row.event_id) : null;
      if (linked) {
        return asEventSummary(linked, {
          listName: row.list_name ?? "saved",
          notes: [row.notes, ...(linked.tags ?? [])].filter((value): value is string => Boolean(value)).slice(0, 3),
        });
      }

      const custom = row.custom_event ?? {};
      const title =
        typeof custom.title === "string"
          ? custom.title
          : typeof custom.name === "string"
            ? custom.name
            : "Saved custom event";

      return {
        id: row.id,
        title,
        dateLabel:
          typeof custom.dateLabel === "string"
            ? custom.dateLabel
            : typeof custom.start_date === "string"
              ? custom.start_date
              : "Date to confirm",
        startDate: typeof custom.start_date === "string" ? custom.start_date : null,
        locationLabel:
          typeof custom.location_name === "string"
            ? custom.location_name
            : typeof custom.location === "string"
              ? custom.location
              : profile.location.label || profile.location.city || "Location to confirm",
        sourceLabel: "Saved custom event",
        verificationLabel: "Parent-entered",
        notes: [row.notes].filter((value): value is string => Boolean(value)),
        url:
          typeof custom.url === "string" && custom.url
            ? custom.url
            : buildSearchUrl(title, profile.location.label || profile.location.city || ""),
        listName: row.list_name ?? "saved",
      } satisfies FamilyEventSummary;
    })
    .slice(0, 10);
}

async function fetchUpcomingEvents(supabase: SupabaseClient, profile: FamilyProfile, warnings: string[]) {
  const city = profile.location.city?.trim();
  if (!city) {
    return [] as FamilyEventSummary[];
  }

  const today = new Date().toISOString().slice(0, 10);
  const result = await supabase
    .from("events")
    .select("id,title,start_date,end_date,start_time,location_name,location_address,city,tags,source,confidence,is_verified,url")
    .eq("city", city)
    .gte("start_date", today)
    .order("start_date", { ascending: true })
    .limit(10)
    .returns<EventRow[]>();

  if (result.error) {
    if (!isMissingTableError(result.error)) {
      pushWarning(warnings, `Supabase area-events lookup failed: ${result.error.message}`);
    }
    return [] as FamilyEventSummary[];
  }

  return (result.data ?? []).map((event) => asEventSummary(event));
}

async function fetchCustomSources(supabase: SupabaseClient, userId: string, warnings: string[]) {
  const result = await supabase
    .from("custom_sources")
    .select("id,name,location_name,location_address,day_of_week,start_time,end_time,recurrence_text,notes")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(10)
    .returns<CustomSourceRow[]>();

  if (result.error) {
    if (!isMissingTableError(result.error)) {
      pushWarning(warnings, `Supabase custom-sources lookup failed: ${result.error.message}`);
    }
    return [] as CustomSourceSummary[];
  }

  return (result.data ?? []).map(asCustomSourceSummary);
}

export async function hydrateFamilyContext(
  supabase: SupabaseClient,
  profileRow: FamilyProfileRow,
  user: SessionUserSummary | null,
) {
  const warnings: string[] = [];
  const profile = normalizeProfileRow(profileRow);

  if (!profile) {
    pushWarning(warnings, "Family profile row exists but the stored profile JSON could not be parsed.");
  }

  const profileId = profileRow.id;
  const history = profileId ? await fetchHistory(supabase, profileId, warnings) : [];
  const legacySavedItems = profileId ? await fetchLegacySavedItems(supabase, profileId, warnings) : [];
  const savedEvents = profile && user ? await fetchSavedEvents(supabase, user.id, profile, warnings) : [];
  const upcomingEvents = profile ? await fetchUpcomingEvents(supabase, profile, warnings) : [];
  const customSources = user ? await fetchCustomSources(supabase, user.id, warnings) : [];

  return {
    authMode: user ? "authenticated" : "anonymous",
    user,
    profileRecordId: profileId,
    profile,
    history,
    savedEvents,
    upcomingEvents,
    customSources,
    legacySavedItems,
    digestEnabled: profileRow.digest_enabled ?? profile?.preferences.digestEnabled ?? false,
    timezone: profileRow.timezone ?? null,
    warnings,
  } satisfies AuthenticatedFamilyContext;
}

export async function getAuthenticatedFamilyContext() {
  if (!hasSupabaseServerEnv()) {
    return {
      authMode: "unavailable",
      user: null,
      profileRecordId: null,
      profile: null,
      history: [],
      savedEvents: [],
      upcomingEvents: [],
      customSources: [],
      legacySavedItems: [],
      digestEnabled: false,
      timezone: null,
      warnings: ["Supabase environment variables are not configured."],
    } satisfies AuthenticatedFamilyContext;
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return {
      authMode: "unavailable",
      user: null,
      profileRecordId: null,
      profile: null,
      history: [],
      savedEvents: [],
      upcomingEvents: [],
      customSources: [],
      legacySavedItems: [],
      digestEnabled: false,
      timezone: null,
      warnings: ["Supabase server client could not be created."],
    } satisfies AuthenticatedFamilyContext;
  }

  const authResult = await supabase.auth.getUser();
  if (authResult.error) {
    return {
      authMode: "anonymous",
      user: null,
      profileRecordId: null,
      profile: null,
      history: [],
      savedEvents: [],
      upcomingEvents: [],
      customSources: [],
      legacySavedItems: [],
      digestEnabled: false,
      timezone: null,
      warnings: [`Supabase auth lookup failed: ${authResult.error.message}`],
    } satisfies AuthenticatedFamilyContext;
  }

  const user = authResult.data.user
    ? { id: authResult.data.user.id, email: authResult.data.user.email ?? null }
    : null;

  if (!user) {
    return {
      authMode: "anonymous",
      user: null,
      profileRecordId: null,
      profile: null,
      history: [],
      savedEvents: [],
      upcomingEvents: [],
      customSources: [],
      legacySavedItems: [],
      digestEnabled: false,
      timezone: null,
      warnings: [],
    } satisfies AuthenticatedFamilyContext;
  }

  const warnings: string[] = [];
  const profileRow = await fetchProfileRow(supabase, user, warnings);
  if (!profileRow) {
    return {
      authMode: "authenticated",
      user,
      profileRecordId: null,
      profile: null,
      history: [],
      savedEvents: [],
      upcomingEvents: [],
      customSources: [],
      legacySavedItems: [],
      digestEnabled: false,
      timezone: null,
      warnings: warnings.length
        ? warnings
        : ["Signed in, but no linked Supabase family profile was found yet."],
    } satisfies AuthenticatedFamilyContext;
  }

  const hydrated = await hydrateFamilyContext(supabase, profileRow, user);
  return {
    ...hydrated,
    warnings: [...warnings, ...hydrated.warnings],
  } satisfies AuthenticatedFamilyContext;
}

export async function listDigestEnabledProfiles(supabase: SupabaseClient) {
  return supabase
    .from("family_profiles")
    .select("id,user_id,parent_name,email,city,zip_code,profile,digest_enabled,timezone")
    .eq("digest_enabled", true)
    .order("updated_at", { ascending: false })
    .returns<FamilyProfileRow[]>();
}
