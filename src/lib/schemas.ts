import { z } from "zod";

export const activitySlotSchema = z.enum(["outdoor", "indoor", "adventure", "calm", "together"]);
export type ActivitySlot = z.infer<typeof activitySlotSchema>;

export const childSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  age: z.number().min(0).max(12),
  interests: z.array(z.string()).default([]),
});
export type ChildProfile = z.infer<typeof childSchema>;

export const familyLocationSchema = z.object({
  zip: z.string().optional().default(""),
  city: z.string().optional().default(""),
  label: z.string().optional().default(""),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});
export type FamilyLocation = z.infer<typeof familyLocationSchema>;

export const scheduleSchema = z.object({
  schoolHours: z.string().default(""),
  napWindow: z.string().default(""),
  freeTimeWindows: z.string().default(""),
  wakeTime: z.string().default("07:00"),
  nap1Start: z.string().default("12:30"),
  nap1End: z.string().default("14:30"),
  nap2Start: z.string().default(""),
  nap2End: z.string().default(""),
  bedtime: z.string().default("19:30"),
});

export const familyPreferencesSchema = z.object({
  indoorOutdoorPreference: z.enum(["mostly-indoor", "balanced", "mostly-outdoor"]).default("balanced"),
  messTolerance: z.number().min(1).max(5).default(3),
  energyLevelToday: z.number().min(1).max(5).default(3),
  digestEnabled: z.boolean().default(true),
});

export const dayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

export const familyProfileSchema = z.object({
  parentName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  location: familyLocationSchema,
  kids: z.array(childSchema).min(1),
  schedule: scheduleSchema,
  preferences: familyPreferencesSchema,
  materials: z.array(z.string()).default([]),
  notes: z.string().optional().default(""),
});
export type FamilyProfile = z.infer<typeof familyProfileSchema>;

export const schedulePrefsBudgetSchema = z.enum(["free", "moderate", "flexible"]);
export type SchedulePrefsBudget = z.infer<typeof schedulePrefsBudgetSchema>;

export const schedulePrefsSchema = z.object({
  freeDays: z.array(dayOfWeekSchema).default(["saturday", "sunday"]),
  morningFree: z.boolean().default(true),
  afternoonFree: z.boolean().default(true),
  eveningFree: z.boolean().default(false),
  maxDriveMinutes: z.number().min(5).max(180).default(30),
  napStart: z.string().default("12:30"),
  napEnd: z.string().default("14:30"),
  budget: schedulePrefsBudgetSchema.default("moderate"),
});
export type SchedulePrefs = z.infer<typeof schedulePrefsSchema>;

export const activityPrefsIndoorOutdoorSchema = z.enum(["indoor", "outdoor", "both"]);
export const activityPrefsEnergySchema = z.enum(["low", "medium", "high"]);

export const activityPrefsSchema = z.object({
  types: z.array(z.string()).default(["outdoor", "art", "sensory"]),
  settings: z.array(z.string()).default(["parks", "libraries", "classes"]),
  indoorOutdoor: activityPrefsIndoorOutdoorSchema.default("both"),
  energyLevel: activityPrefsEnergySchema.default("medium"),
});
export type ActivityPrefs = z.infer<typeof activityPrefsSchema>;

export const localPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  distanceMiles: z.number().min(0),
  rating: z.number().min(0).max(5).nullable().default(null),
  hours: z.string().default("Hours unavailable"),
  address: z.string().default(""),
  kidFriendly: z.boolean().default(true),
  todayEvent: z.string().nullable().default(null),
  reasons: z.array(z.string()).default([]),
  mapsUrl: z.string().default(""),
});
export type LocalPlace = z.infer<typeof localPlaceSchema>;

export const discoverySourceSchema = z.enum(["google", "ai", "fallback"]);
export type DiscoverySource = z.infer<typeof discoverySourceSchema>;

export const eventCostTypeSchema = z.enum(["free", "paid", "unknown"]);
export type EventCostType = z.infer<typeof eventCostTypeSchema>;

export const eventSourceSchema = z.enum(["ai", "manual", "user"]);
export type EventSource = z.infer<typeof eventSourceSchema>;

export const eventConfidenceSchema = z.enum(["high", "medium", "low"]);
export type EventConfidence = z.infer<typeof eventConfidenceSchema>;

export const eventSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().optional().default(""),
  url: z.string().default(""),
  imageUrl: z.string().default(""),
  locationName: z.string().default(""),
  locationAddress: z.string().default(""),
  city: z.string().min(1),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  startTime: z.string().default(""),
  endTime: z.string().default(""),
  recurring: z.string().default(""),
  ageMin: z.number().min(0).max(18).default(0),
  ageMax: z.number().min(0).max(18).default(18),
  costType: eventCostTypeSchema.default("unknown"),
  costAmount: z.number().nullable().default(null),
  tags: z.array(z.string()).default([]),
  source: eventSourceSchema.default("ai"),
  confidence: eventConfidenceSchema.default("low"),
  isVerified: z.boolean().default(false),
  discoveryArea: z.string().default(""),
  createdAt: z.string().default(""),
  expiresAt: z.string().optional().default(""),
});
export type Event = z.infer<typeof eventSchema>;

export const eventListNameSchema = z.enum(["saved", "want_to_try", "done"]);
export type EventListName = z.infer<typeof eventListNameSchema>;

export const savedEventSchema = z.object({
  id: z.string(),
  eventId: z.string().nullable().optional(),
  eventSnapshot: eventSchema.nullable().optional(),
  customEvent: eventSchema.nullable().optional(),
  listName: eventListNameSchema.default("saved"),
  notes: z.string().default(""),
  createdAt: z.string(),
});
export type SavedEvent = z.infer<typeof savedEventSchema>;

export const customSourceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  locationName: z.string().default(""),
  locationAddress: z.string().default(""),
  dayOfWeek: z.union([dayOfWeekSchema, z.literal("")]).default(""),
  startTime: z.string().default(""),
  endTime: z.string().default(""),
  recurrenceText: z.string().default(""),
  notes: z.string().default(""),
  isActive: z.boolean().default(true),
  createdAt: z.string(),
});
export type CustomSource = z.infer<typeof customSourceSchema>;

export const activityCardSchema = z.object({
  id: z.string(),
  slot: activitySlotSchema,
  name: z.string(),
  emoji: z.string(),
  summary: z.string(),
  ageRange: z.string(),
  duration: z.string(),
  bestTime: z.string(),
  materials: z.array(z.string()).default([]),
  benefits: z.array(z.string()).default([]),
  whyItFits: z.string(),
  steps: z.array(z.string()).min(2).max(6),
  backupPlan: z.string().default(""),
});
export type ActivityCard = z.infer<typeof activityCardSchema>;

export const napTrapSuggestionSchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.string(),
  duration: z.string(),
  details: z.string(),
});
export type NapTrapSuggestion = z.infer<typeof napTrapSuggestionSchema>;

export const scheduleBlockSchema = z.object({
  id: z.enum(["morning", "midday", "afternoon"]),
  label: z.string(),
  timeRange: z.string(),
  summary: z.string(),
  activitySlots: z.array(activitySlotSchema).default([]),
  activityNames: z.array(z.string()).default([]),
});
export type ScheduleBlock = z.infer<typeof scheduleBlockSchema>;

export const weatherSummarySchema = z.object({
  locationLabel: z.string(),
  summary: z.string(),
  high: z.number(),
  low: z.number(),
  precipitationChance: z.number(),
  recommendation: z.string(),
  currentTemperature: z.number().nullable().default(null),
});
export type WeatherSummary = z.infer<typeof weatherSummarySchema>;

export const dailyPlanSchema = z.object({
  dateKey: z.string(),
  headline: z.string(),
  encouragement: z.string(),
  weather: weatherSummarySchema,
  discoveryMode: discoverySourceSchema.default("fallback"),
  activities: z.array(activityCardSchema).length(5),
  timeline: z.array(scheduleBlockSchema).default([]),
  discovery: z.array(localPlaceSchema).default([]),
  napTrap: z.array(napTrapSuggestionSchema).min(3).max(5),
});
export type DailyPlan = z.infer<typeof dailyPlanSchema>;

export const historyEntrySchema = z.object({
  id: z.string(),
  dateKey: z.string(),
  timestamp: z.string(),
  action: z.enum(["done", "skip", "saved"]),
  slot: activitySlotSchema,
  title: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

export const savedItemSchema = z.object({
  id: z.string(),
  type: z.enum(["activity", "place"]),
  title: z.string(),
  subtitle: z.string().default(""),
  savedAt: z.string(),
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type SavedItem = z.infer<typeof savedItemSchema>;

export const MATERIAL_OPTIONS = [
  "Paint",
  "Play-doh",
  "Craft supplies",
  "Sandbox",
  "Water table",
  "Pool",
  "Bikes",
  "Scooters",
  "Books",
  "Puzzles",
  "Magnatiles",
  "Bubbles",
  "Sidewalk chalk",
  "Sensory bin",
  "Kitchen helper stool",
] as const;

export const DISCOVERY_CATEGORIES = [
  "parks",
  "libraries",
  "museums",
  "playgrounds",
  "splash pads",
  "indoor play spaces",
  "farms",
  "zoos",
] as const;

export const SCHEDULE_FREE_DAY_OPTIONS = dayOfWeekSchema.options;

export const ACTIVITY_TYPE_OPTIONS = [
  "outdoor",
  "art",
  "sensory",
  "educational",
  "music",
  "movement",
  "water play",
  "community",
] as const;

export const ACTIVITY_SETTING_OPTIONS = [
  "parks",
  "libraries",
  "museums",
  "classes",
  "indoor play",
  "nature",
  "community events",
] as const;

export const EVENT_TAG_OPTIONS = [
  "outdoor",
  "indoor",
  "class",
  "storytime",
  "craft",
  "music",
  "seasonal",
  "free",
] as const;

export const SLOT_ORDER: ActivitySlot[] = ["outdoor", "indoor", "adventure", "calm", "together"];

export function createEmptyProfile(): FamilyProfile {
  return {
    parentName: "",
    email: "",
    location: {
      zip: "",
      city: "",
      label: "",
    },
    kids: [
      {
        id: "kid-1",
        name: "",
        age: 3,
        interests: [],
      },
    ],
    schedule: {
      schoolHours: "",
      napWindow: "12:30-2:30pm",
      freeTimeWindows: "9-11am, 3-5pm",
      wakeTime: "07:00",
      nap1Start: "12:30",
      nap1End: "14:30",
      nap2Start: "",
      nap2End: "",
      bedtime: "19:30",
    },
    preferences: {
      indoorOutdoorPreference: "balanced",
      messTolerance: 3,
      energyLevelToday: 3,
      digestEnabled: true,
    },
    materials: ["Books", "Bubbles", "Craft supplies"],
    notes: "",
  };
}

export function createDemoProfile(): FamilyProfile {
  return {
    parentName: "Maya",
    email: "maya@example.com",
    location: {
      zip: "92660",
      city: "Newport Beach",
      label: "Newport Beach, CA",
    },
    kids: [
      {
        id: "demo-kid-1",
        name: "Nora",
        age: 4,
        interests: ["dinosaurs", "painting", "music"],
      },
      {
        id: "demo-kid-2",
        name: "Leo",
        age: 2,
        interests: ["trucks", "water play", "animals"],
      },
    ],
    schedule: {
      schoolHours: "No school today",
      napWindow: "1-3pm",
      freeTimeWindows: "9-11am, 3:30-5pm",
      wakeTime: "07:00",
      nap1Start: "13:00",
      nap1End: "15:00",
      nap2Start: "",
      nap2End: "",
      bedtime: "19:30",
    },
    preferences: {
      indoorOutdoorPreference: "balanced",
      messTolerance: 3,
      energyLevelToday: 4,
      digestEnabled: true,
    },
    materials: ["Paint", "Craft supplies", "Bikes", "Books", "Bubbles", "Play-doh"],
    notes: "One parent often has a sleeping baby in the carrier during the afternoon.",
  };
}

export function createDefaultSchedulePrefs(profile?: FamilyProfile | null): SchedulePrefs {
  return {
    freeDays: ["saturday", "sunday"],
    morningFree: true,
    afternoonFree: true,
    eveningFree: false,
    maxDriveMinutes: 30,
    napStart: profile?.schedule.nap1Start || "12:30",
    napEnd: profile?.schedule.nap1End || "14:30",
    budget: "moderate",
  };
}

export function createDefaultActivityPrefs(profile?: FamilyProfile | null): ActivityPrefs {
  const indoorOutdoor =
    profile?.preferences.indoorOutdoorPreference === "mostly-indoor"
      ? "indoor"
      : profile?.preferences.indoorOutdoorPreference === "mostly-outdoor"
        ? "outdoor"
        : "both";

  const energyLevel =
    (profile?.preferences.energyLevelToday ?? 3) <= 2
      ? "low"
      : (profile?.preferences.energyLevelToday ?? 3) >= 4
        ? "high"
        : "medium";

  return {
    types: ["outdoor", "art", "sensory"],
    settings: ["parks", "libraries", "classes"],
    indoorOutdoor,
    energyLevel,
  };
}
