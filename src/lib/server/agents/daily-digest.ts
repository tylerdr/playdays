import { format } from "date-fns";
import { generateText } from "ai";
import type { DailyPlan, FamilyProfile, HistoryEntry } from "@/lib/schemas";
import type {
  CustomSourceSummary,
  FamilyEventSummary,
} from "@/lib/server/family-context";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";
import { buildDailyPlan } from "@/lib/server/plan";

export interface DailyDigestAgendaItem {
  id: string;
  title: string;
  timing: string;
  locationLabel: string;
  note: string;
  sourceLabel: string;
  verificationLabel: string;
  url: string;
}

export interface DailyDigestComposition {
  subject: string;
  previewText: string;
  note: string;
  weatherNote: string;
  plan: DailyPlan;
  upcomingItems: DailyDigestAgendaItem[];
  warnings: string[];
}

function summarizeHistory(history: HistoryEntry[]) {
  const recent = history.slice(0, 8);
  const done = recent.filter((entry) => entry.action === "done").length;
  const skipped = recent.filter((entry) => entry.action === "skip").length;
  return { done, skipped };
}

function buildPreferenceSummary(profile: FamilyProfile) {
  return [
    `${profile.preferences.indoorOutdoorPreference} activity bias`,
    `mess tolerance ${profile.preferences.messTolerance}/5`,
    `energy ${profile.preferences.energyLevelToday}/5`,
    profile.schedule.napWindow ? `nap window ${profile.schedule.napWindow}` : null,
    profile.schedule.freeTimeWindows ? `free windows ${profile.schedule.freeTimeWindows}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");
}

function dedupeAgendaItems(items: DailyDigestAgendaItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title.toLowerCase()}-${item.timing.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapEventToAgendaItem(event: FamilyEventSummary): DailyDigestAgendaItem {
  return {
    id: event.id,
    title: event.title,
    timing: event.dateLabel,
    locationLabel: event.locationLabel,
    note: event.notes[0] || event.verificationLabel,
    sourceLabel: event.sourceLabel,
    verificationLabel: event.verificationLabel,
    url: event.url,
  };
}

function mapSourceToAgendaItem(source: CustomSourceSummary): DailyDigestAgendaItem {
  return {
    id: source.id,
    title: source.name,
    timing: source.recurrenceLabel,
    locationLabel: source.locationLabel,
    note: source.notes[0] || "Custom program from your PlayDays setup",
    sourceLabel: "Custom source",
    verificationLabel: "Parent-entered",
    url: "",
  };
}

function buildUpcomingItems(
  savedEvents: FamilyEventSummary[],
  upcomingEvents: FamilyEventSummary[],
  customSources: CustomSourceSummary[],
) {
  return dedupeAgendaItems([
    ...savedEvents.slice(0, 2).map(mapEventToAgendaItem),
    ...upcomingEvents.slice(0, 3).map(mapEventToAgendaItem),
    ...customSources.slice(0, 2).map(mapSourceToAgendaItem),
  ]).slice(0, 4);
}

function buildFallbackNote(
  profile: FamilyProfile,
  history: HistoryEntry[],
  upcomingItems: DailyDigestAgendaItem[],
) {
  const historySummary = summarizeHistory(history);
  const notes = [
    `Today leans ${profile.preferences.indoorOutdoorPreference.replace("-", " ")} with ${profile.preferences.energyLevelToday >= 4 ? "higher-energy" : "lower-friction"} choices first.`,
  ];

  if (profile.schedule.napWindow) {
    notes.push(`Protect ${profile.schedule.napWindow} as the quiet anchor and keep the outing window contained around it.`);
  }

  if (historySummary.skipped > historySummary.done) {
    notes.push("Recent skips suggest keeping setup tiny and using the easiest win first.");
  } else if (historySummary.done > 0) {
    notes.push("Recent follow-through is a good reason to keep today focused on one strong anchor instead of overfilling the day.");
  }

  if (upcomingItems.some((item) => item.verificationLabel.includes("verify"))) {
    notes.push("If one of the event ideas looks promising, verify the listing before building your day around it.");
  }

  return notes.slice(0, 3).join(" ");
}

async function buildAIDigestNote(
  profile: FamilyProfile,
  history: HistoryEntry[],
  upcomingItems: DailyDigestAgendaItem[],
  weatherNote: string,
) {
  const today = format(new Date(), "EEEE, MMMM d, yyyy");
  const historySummary = summarizeHistory(history);
  const prompt = [
    `Today is ${today}.`,
    `Parent: ${profile.parentName}`,
    `Kids: ${profile.kids.map((kid) => `${kid.name} (${kid.age})`).join(", ")}`,
    `Preferences: ${buildPreferenceSummary(profile)}`,
    `Weather: ${weatherNote}`,
    `Recent completions: ${historySummary.done}; recent skips: ${historySummary.skipped}`,
    `Upcoming items: ${upcomingItems.map((item) => `${item.title} [${item.timing}; ${item.verificationLabel}]`).join(", ") || "none"}`,
    "Write a calm, practical note in 2 short sentences for a busy parent. Mention verification when an event is AI-found or unverified. Do not sound like marketing.",
  ].join("\n");

  const result = await generateText({
    model: getOpenAIModel(),
    system: "You write concise, grounded planning notes for parents using PlayDays.",
    prompt,
  });

  return result.text.trim();
}

export async function composeDailyDigest(input: {
  profile: FamilyProfile;
  history: HistoryEntry[];
  savedEvents: FamilyEventSummary[];
  upcomingEvents: FamilyEventSummary[];
  customSources: CustomSourceSummary[];
}) {
  const built = await buildDailyPlan({
    profile: input.profile,
    history: input.history,
  });

  if (!("plan" in built) || !built.plan) {
    throw new Error("Could not build daily plan for digest.");
  }

  const plan = built.plan;
  const upcomingItems = buildUpcomingItems(input.savedEvents, input.upcomingEvents, input.customSources);
  const weatherNote = `${plan.weather.summary}. High ${plan.weather.high}F, low ${plan.weather.low}F, rain chance ${plan.weather.precipitationChance}%. ${plan.weather.recommendation}`;
  const warnings = upcomingItems
    .filter((item) => item.verificationLabel.includes("verify"))
    .map((item) => `${item.title} should be verified before you go.`);
  const note = hasOpenAIKey()
    ? await buildAIDigestNote(input.profile, input.history, upcomingItems, weatherNote)
    : buildFallbackNote(input.profile, input.history, upcomingItems);
  const leadActivity = plan.activities[0]?.name ?? "Your plan";

  return {
    subject: `PlayDays for ${input.profile.parentName || "today"} · ${leadActivity}`,
    previewText: `${plan.headline} ${upcomingItems[0] ? `Plus ${upcomingItems[0].title}.` : ""}`.trim(),
    note,
    weatherNote,
    plan,
    upcomingItems,
    warnings,
  } satisfies DailyDigestComposition;
}
