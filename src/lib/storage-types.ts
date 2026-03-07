export {
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
} from "@/lib/schemas";

import { savedItemSchema } from "@/lib/schemas";

export const pinnedPlaceSchema = savedItemSchema;
