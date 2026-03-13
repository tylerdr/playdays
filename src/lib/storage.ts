import { format } from "date-fns";
import { createClientSupabaseClient } from "@/lib/supabase/client";
import {
  getHistoryFromSupabase,
  getPinnedPlaceFromSupabase,
  getStoredFamilyProfile,
  getSavedItemsFromSupabase,
  recordActivityToSupabase,
  savePinnedPlaceToSupabase,
  saveProfileToSupabase,
  saveSavedItemToSupabase,
  type StoredFamilyProfile,
} from "@/lib/supabase/storage";
import {
  createDemoProfile,
  dailyPlanSchema,
  familyProfileSchema,
  historyEntrySchema,
  savedItemSchema,
  type ActivityCard,
  type DailyPlan,
  type FamilyProfile,
  type HistoryEntry,
  type LocalPlace,
  type SavedItem,
} from "@/lib/storage-types";

const PROFILE_KEY = "playdays:profile";
const HISTORY_KEY = "playdays:history";
const SAVED_KEY = "playdays:saved";
const PLAN_KEY = "playdays:plan";
const PINNED_PLACE_KEY = "playdays:pinned-place";

type PersistenceMode = "local" | "supabase";

function isBrowser() {
  return typeof window !== "undefined";
}

function parseOrFallback<T>(value: string | null, parser: (input: unknown) => T, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return parser(JSON.parse(value));
  } catch {
    return fallback;
  }
}

function saveProfileToLocalCache(profile: FamilyProfile) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  localStorage.removeItem(PLAN_KEY);
}

function saveHistoryToLocalCache(history: HistoryEntry[]) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function saveSavedItemsToLocalCache(items: SavedItem[]) {
  if (!isBrowser()) {
    return;
  }

  localStorage.setItem(SAVED_KEY, JSON.stringify(items));
}

function savePinnedPlaceToLocalCache(item: SavedItem | null) {
  if (!isBrowser()) {
    return;
  }

  if (!item) {
    localStorage.removeItem(PINNED_PLACE_KEY);
    return;
  }

  localStorage.setItem(PINNED_PLACE_KEY, JSON.stringify(item));
}

function createPinnedPlaceSavedItem(place: LocalPlace) {
  return savedItemSchema.parse({
    id: crypto.randomUUID(),
    type: "place",
    title: place.name,
    subtitle: `${place.category} · ${place.distanceMiles.toFixed(1)} mi`,
    savedAt: new Date().toISOString(),
    payload: place as unknown as Record<string, unknown>,
  });
}

async function getSupabaseStorageContext() {
  const supabase = createClientSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  let storedProfile = await getStoredFamilyProfile(supabase, user.id, user.email ?? null).catch(
    () => null
  );

  if (!storedProfile) {
    const cachedProfile = getProfile();
    if (cachedProfile) {
      storedProfile = await saveProfileToSupabase(supabase, user.id, cachedProfile, {
        fallbackEmail: user.email ?? null,
        timezone: getBrowserTimezone(),
      }).catch(() => null);
    }
  }

  return storedProfile
    ? { supabase, user, storedProfile }
    : { supabase, user, storedProfile: null as StoredFamilyProfile | null };
}

function getBrowserTimezone() {
  if (!isBrowser()) {
    return null;
  }

  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
}

export function getTodayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

export function getProfile() {
  if (!isBrowser()) {
    return null;
  }

  return parseOrFallback(
    localStorage.getItem(PROFILE_KEY),
    (input) => familyProfileSchema.parse(input),
    null as FamilyProfile | null
  );
}

export async function saveProfile(
  profile: FamilyProfile,
  options?: { mode?: "auto" | "local-only" }
) {
  saveProfileToLocalCache(profile);

  if (options?.mode === "local-only") {
    return { profile, persistence: "local" as const };
  }

  const context = await getSupabaseStorageContext();
  if (!context) {
    return { profile, persistence: "local" as const };
  }

  try {
    const storedProfile = await saveProfileToSupabase(
      context.supabase,
      context.user.id,
      profile,
      {
        fallbackEmail: context.user.email ?? null,
        timezone: getBrowserTimezone(),
      }
    );

    saveProfileToLocalCache(storedProfile.profile);
    return { profile: storedProfile.profile, persistence: "supabase" as const };
  } catch {
    return { profile, persistence: "local" as const };
  }
}

export function ensureProfile() {
  const existing = getProfile();
  if (existing) {
    return existing;
  }

  const demo = createDemoProfile();
  saveProfileToLocalCache(demo);
  return demo;
}

export function getHistory() {
  if (!isBrowser()) {
    return [] as HistoryEntry[];
  }

  return parseOrFallback(
    localStorage.getItem(HISTORY_KEY),
    (input) => historyEntrySchema.array().parse(input),
    [] as HistoryEntry[]
  );
}

export function saveHistory(history: HistoryEntry[]) {
  saveHistoryToLocalCache(history);
}

export async function recordActivityAction(
  entry: Omit<HistoryEntry, "id" | "timestamp" | "dateKey">
) {
  const nextEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    dateKey: getTodayKey(),
    ...entry,
  };

  const localHistory = [nextEntry, ...getHistory()].slice(0, 200);
  saveHistoryToLocalCache(localHistory);

  const context = await getSupabaseStorageContext();
  if (!context?.storedProfile) {
    return { history: localHistory, persistence: "local" as const };
  }

  try {
    await recordActivityToSupabase(context.supabase, context.storedProfile.id, entry);
    const history = await getHistoryFromSupabase(context.supabase, context.storedProfile.id);
    saveHistoryToLocalCache(history);
    return { history, persistence: "supabase" as const };
  } catch {
    return { history: localHistory, persistence: "local" as const };
  }
}

export function getSavedItems() {
  if (!isBrowser()) {
    return [] as SavedItem[];
  }

  return parseOrFallback(
    localStorage.getItem(SAVED_KEY),
    (input) => savedItemSchema.array().parse(input),
    [] as SavedItem[]
  );
}

export async function saveSavedItem(item: Omit<SavedItem, "id" | "savedAt">) {
  const nextItem: SavedItem = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...item,
  };

  const localItems = [
    nextItem,
    ...getSavedItems().filter((existing) => existing.title !== item.title),
  ].slice(0, 100);
  saveSavedItemsToLocalCache(localItems);

  const context = await getSupabaseStorageContext();
  if (!context?.storedProfile) {
    return {
      items: localItems,
      savedItem: nextItem,
      persistence: "local" as const,
    };
  }

  try {
    const savedItem = await saveSavedItemToSupabase(
      context.supabase,
      context.storedProfile.id,
      item
    );
    const items = await getSavedItemsFromSupabase(context.supabase, context.storedProfile.id);
    saveSavedItemsToLocalCache(items);
    return {
      items,
      savedItem,
      persistence: "supabase" as const,
    };
  } catch {
    return {
      items: localItems,
      savedItem: nextItem,
      persistence: "local" as const,
    };
  }
}

export function getCachedPlan() {
  if (!isBrowser()) {
    return null as DailyPlan | null;
  }

  const plan = parseOrFallback(
    localStorage.getItem(PLAN_KEY),
    (input) => dailyPlanSchema.parse(input),
    null as DailyPlan | null
  );

  if (!plan || plan.dateKey !== getTodayKey()) {
    return null;
  }

  return plan;
}

export function saveCachedPlan(plan: DailyPlan) {
  if (isBrowser()) {
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
  }
}

export function getPinnedPlace() {
  if (!isBrowser()) {
    return null as SavedItem | null;
  }

  return parseOrFallback(
    localStorage.getItem(PINNED_PLACE_KEY),
    (input) => savedItemSchema.parse(input),
    null as SavedItem | null
  );
}

export async function savePinnedPlace(place: LocalPlace) {
  const pinnedItem = createPinnedPlaceSavedItem(place);
  savePinnedPlaceToLocalCache(pinnedItem);

  const context = await getSupabaseStorageContext();
  if (!context?.storedProfile) {
    return { item: pinnedItem, persistence: "local" as const };
  }

  try {
    const savedItem = await savePinnedPlaceToSupabase(
      context.supabase,
      context.storedProfile.id,
      place
    );
    savePinnedPlaceToLocalCache(savedItem);
    return { item: savedItem, persistence: "supabase" as const };
  } catch {
    return { item: pinnedItem, persistence: "local" as const };
  }
}

export function replaceActivityInPlan(plan: DailyPlan, activity: ActivityCard) {
  const activities = plan.activities.map((existing) =>
    existing.slot === activity.slot ? activity : existing
  );
  const nextPlan: DailyPlan = {
    ...plan,
    activities,
    timeline: (plan.timeline ?? []).map((block) => ({
      ...block,
      activityNames: block.activitySlots
        .map((slot) => activities.find((item) => item.slot === slot)?.name)
        .filter((value): value is string => Boolean(value)),
    })),
  };

  saveCachedPlan(nextPlan);
  return nextPlan;
}

export function syncProfileCache(profile: FamilyProfile | null) {
  if (!profile) {
    return;
  }

  saveProfileToLocalCache(profile);
}

export function syncHistoryCache(history: HistoryEntry[]) {
  saveHistoryToLocalCache(history);
}

export function syncSavedItemsCache(items: SavedItem[]) {
  saveSavedItemsToLocalCache(items);
}

export function syncPinnedPlaceCache(item: SavedItem | null) {
  savePinnedPlaceToLocalCache(item);
}

export async function refreshAccountCaches() {
  const context = await getSupabaseStorageContext();
  if (!context?.storedProfile) {
    return {
      profile: getProfile(),
      history: getHistory(),
      savedItems: getSavedItems(),
      pinnedPlace: getPinnedPlace(),
      persistence: "local" as PersistenceMode,
    };
  }

  const [history, savedItems, pinnedPlace] = await Promise.all([
    getHistoryFromSupabase(context.supabase, context.storedProfile.id),
    getSavedItemsFromSupabase(context.supabase, context.storedProfile.id),
    getPinnedPlaceFromSupabase(context.supabase, context.storedProfile.id),
  ]);

  syncProfileCache(context.storedProfile.profile);
  syncHistoryCache(history);
  syncSavedItemsCache(savedItems);
  syncPinnedPlaceCache(pinnedPlace);

  return {
    profile: context.storedProfile.profile,
    history,
    savedItems,
    pinnedPlace,
    persistence: "supabase" as PersistenceMode,
  };
}

export function clearPlaydaysData() {
  if (!isBrowser()) {
    return;
  }

  for (const key of [PROFILE_KEY, HISTORY_KEY, SAVED_KEY, PLAN_KEY, PINNED_PLACE_KEY]) {
    localStorage.removeItem(key);
  }
}
