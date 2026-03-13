import type { SupabaseClient } from "@supabase/supabase-js";
import {
  familyProfileSchema,
  historyEntrySchema,
  savedItemSchema,
  type FamilyProfile,
  type HistoryEntry,
  type LocalPlace,
  type SavedItem,
} from "@/lib/schemas";

export const PINNED_PLACE_ITEM_ID = "pinned-place";

const SAVED_ITEM_META_KEY = "__playdaysMeta";

type FamilyProfileRow = {
  id: string;
  user_id: string;
  parent_name: string;
  email: string | null;
  zip_code: string | null;
  city: string | null;
  profile: unknown;
  digest_enabled: boolean;
  timezone?: string | null;
};

type ActivityHistoryRow = {
  id: string;
  action: HistoryEntry["action"];
  slot: HistoryEntry["slot"];
  title: string;
  payload: Record<string, unknown> | null;
  happened_at: string;
};

type SavedItemRow = {
  id: string;
  item_type: SavedItem["type"];
  item_id: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type StoredFamilyProfile = {
  id: string;
  userId: string;
  email: string | null;
  timezone: string | null;
  profile: FamilyProfile;
};

type SavedItemMeta = {
  title: string;
  subtitle: string;
  isPinned?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "saved-item";
}

function buildSchedulePrefs(profile: FamilyProfile) {
  return {
    free_days: ["saturday", "sunday"],
    morning_free: true,
    afternoon_free: true,
    evening_free: false,
    max_drive_minutes: 30,
    nap_start: profile.schedule.nap1Start || "",
    nap_end: profile.schedule.nap1End || "",
    budget: "moderate",
  };
}

function buildActivityPrefs(profile: FamilyProfile) {
  const settings = profile.location.city ? ["parks", "libraries", "museums"] : ["home"];
  return {
    types: Array.from(
      new Set(
        profile.kids
          .flatMap((kid) => kid.interests)
          .map((interest) => interest.toLowerCase())
          .slice(0, 6)
      )
    ),
    settings,
    indoor_outdoor:
      profile.preferences.indoorOutdoorPreference === "balanced"
        ? "both"
        : profile.preferences.indoorOutdoorPreference === "mostly-outdoor"
          ? "outdoor"
          : "indoor",
    energy_level:
      profile.preferences.energyLevelToday >= 4
        ? "high"
        : profile.preferences.energyLevelToday <= 2
          ? "low"
          : "medium",
  };
}

function buildProfileUpsert(
  profile: FamilyProfile,
  userId: string,
  fallbackEmail?: string | null,
  timezone?: string | null
) {
  return {
    user_id: userId,
    parent_name: profile.parentName,
    email: profile.email || fallbackEmail || null,
    zip_code: profile.location.zip || null,
    city: profile.location.city || null,
    profile,
    digest_enabled: profile.preferences.digestEnabled,
    timezone: timezone ?? undefined,
    schedule_prefs: buildSchedulePrefs(profile),
    activity_prefs: buildActivityPrefs(profile),
    email_prefs: {
      daily_digest: profile.preferences.digestEnabled,
      event_reminders: true,
    },
  };
}

function normalizeStoredProfile(row: FamilyProfileRow, userEmail?: string | null): FamilyProfile {
  const storedProfile = asRecord(row.profile);
  const storedLocation = asRecord(storedProfile.location);
  const storedPreferences = asRecord(storedProfile.preferences);
  const city = row.city ?? readString(storedLocation.city);
  const zip = row.zip_code ?? readString(storedLocation.zip);

  return familyProfileSchema.parse({
    ...storedProfile,
    parentName: row.parent_name || readString(storedProfile.parentName),
    email: row.email ?? userEmail ?? readString(storedProfile.email),
    location: {
      ...storedLocation,
      city: city ?? "",
      zip: zip ?? "",
      label:
        readString(storedLocation.label) || [city, zip].filter(Boolean).join(", "),
    },
    preferences: {
      ...storedPreferences,
      digestEnabled: row.digest_enabled ?? readBoolean(storedPreferences.digestEnabled, true),
    },
  });
}

function buildSavedItemMeta(item: Pick<SavedItem, "title" | "subtitle">, isPinned = false): SavedItemMeta {
  return {
    title: item.title,
    subtitle: item.subtitle,
    isPinned,
  };
}

function packSavedItemPayload(
  payload: Record<string, unknown>,
  item: Pick<SavedItem, "title" | "subtitle">,
  isPinned = false
) {
  return {
    ...payload,
    [SAVED_ITEM_META_KEY]: buildSavedItemMeta(item, isPinned),
  };
}

function unpackSavedItemMeta(payload: Record<string, unknown>) {
  const meta = asRecord(payload[SAVED_ITEM_META_KEY]);
  return {
    meta: {
      title: readString(meta.title),
      subtitle: readString(meta.subtitle),
      isPinned: readBoolean(meta.isPinned),
    },
    payload: Object.fromEntries(
      Object.entries(payload).filter(([key]) => key !== SAVED_ITEM_META_KEY)
    ),
  };
}

function mapSavedRow(row: SavedItemRow) {
  const payloadRecord = asRecord(row.payload);
  const { meta, payload } = unpackSavedItemMeta(payloadRecord);

  const fallbackTitle =
    row.item_type === "place"
      ? readString(payload.name, "Saved place")
      : readString(payload.name, "Saved activity");
  const fallbackSubtitle =
    row.item_type === "place"
      ? readString(payload.category)
      : [readString(payload.slot), readString(payload.duration)]
          .filter(Boolean)
          .join(" · ");

  return savedItemSchema.parse({
    id: row.id,
    type: row.item_type,
    title: meta.title || fallbackTitle,
    subtitle: meta.subtitle || fallbackSubtitle,
    savedAt: row.created_at,
    payload,
  });
}

function mapHistoryRows(rows: ActivityHistoryRow[]) {
  return historyEntrySchema.array().parse(
    rows.map((row) => ({
      id: row.id,
      dateKey: row.happened_at.slice(0, 10),
      timestamp: row.happened_at,
      action: row.action,
      slot: row.slot,
      title: row.title,
      payload: row.payload ?? {},
    }))
  );
}

function deriveSavedItemId(item: Omit<SavedItem, "id" | "savedAt">) {
  const payloadId = item.payload?.id;
  return typeof payloadId === "string" && payloadId.length > 0 ? payloadId : slugify(item.title);
}

export async function getStoredFamilyProfile(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
) {
  const { data, error } = await supabase
    .from("family_profiles")
    .select("id,user_id,parent_name,email,zip_code,city,profile,digest_enabled,timezone")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  const row = data as FamilyProfileRow;
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    timezone: row.timezone ?? null,
    profile: normalizeStoredProfile(row, userEmail),
  } satisfies StoredFamilyProfile;
}

export async function getProfileFromSupabase(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null
) {
  const stored = await getStoredFamilyProfile(supabase, userId, userEmail);
  return stored?.profile ?? null;
}

export async function saveProfileToSupabase(
  supabase: SupabaseClient,
  userId: string,
  profile: FamilyProfile,
  options?: {
    fallbackEmail?: string | null;
    timezone?: string | null;
  }
) {
  const payload = buildProfileUpsert(
    profile,
    userId,
    options?.fallbackEmail,
    options?.timezone
  );

  const { data, error } = await supabase
    .from("family_profiles")
    .upsert(payload, { onConflict: "user_id" })
    .select("id,user_id,parent_name,email,zip_code,city,profile,digest_enabled,timezone")
    .single();

  if (error) {
    throw error;
  }

  const row = data as FamilyProfileRow;
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    timezone: row.timezone ?? null,
    profile: normalizeStoredProfile(row, options?.fallbackEmail),
  } satisfies StoredFamilyProfile;
}

export async function getHistoryFromSupabase(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("activity_history")
    .select("id,action,slot,title,payload,happened_at")
    .eq("profile_id", profileId)
    .order("happened_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return mapHistoryRows((data ?? []) as ActivityHistoryRow[]);
}

export async function recordActivityToSupabase(
  supabase: SupabaseClient,
  profileId: string,
  entry: Omit<HistoryEntry, "id" | "timestamp" | "dateKey">
) {
  const happenedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("activity_history")
    .insert({
      profile_id: profileId,
      activity_id:
        typeof entry.payload?.id === "string" && entry.payload.id.length > 0
          ? entry.payload.id
          : crypto.randomUUID(),
      action: entry.action,
      slot: entry.slot,
      title: entry.title,
      payload: entry.payload,
      happened_at: happenedAt,
    })
    .select("id,action,slot,title,payload,happened_at")
    .single();

  if (error) {
    throw error;
  }

  return mapHistoryRows([data as ActivityHistoryRow])[0];
}

export async function getSavedItemsFromSupabase(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("saved_items")
    .select("id,item_type,item_id,payload,created_at")
    .eq("profile_id", profileId)
    .neq("item_id", PINNED_PLACE_ITEM_ID)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return savedItemSchema.array().parse(
    ((data ?? []) as SavedItemRow[]).map((row) => mapSavedRow(row))
  );
}

export async function saveSavedItemToSupabase(
  supabase: SupabaseClient,
  profileId: string,
  item: Omit<SavedItem, "id" | "savedAt">
) {
  const itemId = deriveSavedItemId(item);

  const { error: deleteError } = await supabase
    .from("saved_items")
    .delete()
    .eq("profile_id", profileId)
    .eq("item_type", item.type)
    .eq("item_id", itemId);

  if (deleteError) {
    throw deleteError;
  }

  const { data, error } = await supabase
    .from("saved_items")
    .insert({
      profile_id: profileId,
      item_type: item.type,
      item_id: itemId,
      payload: packSavedItemPayload(item.payload, item),
    })
    .select("id,item_type,item_id,payload,created_at")
    .single();

  if (error) {
    throw error;
  }

  return mapSavedRow(data as SavedItemRow);
}

export async function getPinnedPlaceFromSupabase(
  supabase: SupabaseClient,
  profileId: string
) {
  const { data, error } = await supabase
    .from("saved_items")
    .select("id,item_type,item_id,payload,created_at")
    .eq("profile_id", profileId)
    .eq("item_type", "place")
    .eq("item_id", PINNED_PLACE_ITEM_ID)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? mapSavedRow(data as SavedItemRow) : null;
}

export async function savePinnedPlaceToSupabase(
  supabase: SupabaseClient,
  profileId: string,
  place: LocalPlace
) {
  const { error: deleteError } = await supabase
    .from("saved_items")
    .delete()
    .eq("profile_id", profileId)
    .eq("item_type", "place")
    .eq("item_id", PINNED_PLACE_ITEM_ID);

  if (deleteError) {
    throw deleteError;
  }

  const item: Omit<SavedItem, "id" | "savedAt"> = {
    type: "place",
    title: place.name,
    subtitle: `${place.category} · ${place.distanceMiles.toFixed(1)} mi`,
    payload: place as unknown as Record<string, unknown>,
  };

  const { data, error } = await supabase
    .from("saved_items")
    .insert({
      profile_id: profileId,
      item_type: "place",
      item_id: PINNED_PLACE_ITEM_ID,
      payload: packSavedItemPayload(item.payload, item, true),
    })
    .select("id,item_type,item_id,payload,created_at")
    .single();

  if (error) {
    throw error;
  }

  return mapSavedRow(data as SavedItemRow);
}
