export {
  activityPrefsSchema,
  createDemoProfile,
  createDefaultActivityPrefs,
  createDefaultSchedulePrefs,
  customSourceSchema,
  dailyPlanSchema,
  eventSchema,
  familyProfileSchema,
  historyEntrySchema,
  savedEventSchema,
  savedItemSchema,
  schedulePrefsSchema,
  type ActivityCard,
  type ActivityPrefs,
  type CustomSource,
  type DailyPlan,
  type Event,
  type FamilyProfile,
  type HistoryEntry,
  type LocalPlace,
  type SavedEvent,
  type SavedItem,
  type SchedulePrefs,
} from "@/lib/schemas";

import { savedItemSchema } from "@/lib/schemas";

export const pinnedPlaceSchema = savedItemSchema;
