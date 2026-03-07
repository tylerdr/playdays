import { format } from "date-fns";
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

export function getTodayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

export function getProfile() {
  if (!isBrowser()) {
    return null;
  }

  return parseOrFallback(localStorage.getItem(PROFILE_KEY), (input) => familyProfileSchema.parse(input), null as FamilyProfile | null);
}

export function saveProfile(profile: FamilyProfile) {
  if (isBrowser()) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    localStorage.removeItem(PLAN_KEY);
  }
}

export function ensureProfile() {
  const existing = getProfile();
  if (existing) {
    return existing;
  }

  const demo = createDemoProfile();
  saveProfile(demo);
  return demo;
}

export function getHistory() {
  if (!isBrowser()) {
    return [] as HistoryEntry[];
  }

  return parseOrFallback(localStorage.getItem(HISTORY_KEY), (input) => historyEntrySchema.array().parse(input), [] as HistoryEntry[]);
}

export function saveHistory(history: HistoryEntry[]) {
  if (isBrowser()) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }
}

export function recordActivityAction(entry: Omit<HistoryEntry, "id" | "timestamp" | "dateKey">) {
  const nextEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    dateKey: getTodayKey(),
    ...entry,
  };

  const nextHistory = [nextEntry, ...getHistory()].slice(0, 200);
  saveHistory(nextHistory);
  return nextHistory;
}

export function getSavedItems() {
  if (!isBrowser()) {
    return [] as SavedItem[];
  }

  return parseOrFallback(localStorage.getItem(SAVED_KEY), (input) => savedItemSchema.array().parse(input), [] as SavedItem[]);
}

export function saveSavedItem(item: Omit<SavedItem, "id" | "savedAt">) {
  const nextItem: SavedItem = {
    id: crypto.randomUUID(),
    savedAt: new Date().toISOString(),
    ...item,
  };

  const deduped = [nextItem, ...getSavedItems().filter((existing) => existing.title !== item.title)].slice(0, 100);
  if (isBrowser()) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(deduped));
  }
  return deduped;
}

export function getCachedPlan() {
  if (!isBrowser()) {
    return null as DailyPlan | null;
  }

  const plan = parseOrFallback(localStorage.getItem(PLAN_KEY), (input) => dailyPlanSchema.parse(input), null as DailyPlan | null);
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

  return parseOrFallback(localStorage.getItem(PINNED_PLACE_KEY), (input) => savedItemSchema.parse(input), null as SavedItem | null);
}

export function savePinnedPlace(place: LocalPlace) {
  const saved: SavedItem = {
    id: crypto.randomUUID(),
    type: "place",
    title: place.name,
    subtitle: `${place.category} · ${place.distanceMiles.toFixed(1)} mi`,
    savedAt: new Date().toISOString(),
    payload: place as unknown as Record<string, unknown>,
  };

  if (isBrowser()) {
    localStorage.setItem(PINNED_PLACE_KEY, JSON.stringify(saved));
  }

  return saved;
}

export function replaceActivityInPlan(plan: DailyPlan, activity: ActivityCard) {
  const activities = plan.activities.map((existing) => (existing.slot === activity.slot ? activity : existing));
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

export function clearPlaydaysData() {
  if (!isBrowser()) {
    return;
  }

  for (const key of [PROFILE_KEY, HISTORY_KEY, SAVED_KEY, PLAN_KEY, PINNED_PLACE_KEY]) {
    localStorage.removeItem(key);
  }
}
