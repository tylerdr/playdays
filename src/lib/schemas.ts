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
});

export const familyPreferencesSchema = z.object({
  indoorOutdoorPreference: z.enum(["mostly-indoor", "balanced", "mostly-outdoor"]).default("balanced"),
  messTolerance: z.number().min(1).max(5).default(3),
  energyLevelToday: z.number().min(1).max(5).default(3),
  digestEnabled: z.boolean().default(true),
});

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

export const localPlaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  distanceMiles: z.number().min(0),
  rating: z.number().min(0).max(5).nullable().optional(),
  hours: z.string().optional().default("Hours unavailable"),
  address: z.string().optional().default(""),
  kidFriendly: z.boolean().default(true),
  todayEvent: z.string().optional().nullable(),
  reasons: z.array(z.string()).default([]),
  mapsUrl: z.string().url().optional().or(z.literal("")),
});
export type LocalPlace = z.infer<typeof localPlaceSchema>;

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
  backupPlan: z.string().optional().default(""),
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

export const weatherSummarySchema = z.object({
  locationLabel: z.string(),
  summary: z.string(),
  high: z.number(),
  low: z.number(),
  precipitationChance: z.number(),
  recommendation: z.string(),
  currentTemperature: z.number().nullable().optional(),
});
export type WeatherSummary = z.infer<typeof weatherSummarySchema>;

export const dailyPlanSchema = z.object({
  dateKey: z.string(),
  headline: z.string(),
  encouragement: z.string(),
  weather: weatherSummarySchema,
  activities: z.array(activityCardSchema).length(5),
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
