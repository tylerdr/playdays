import { format } from "date-fns";
import { generateObject } from "ai";
import { z } from "zod";
import {
  SLOT_ORDER,
  createDemoProfile,
  napTrapSuggestionSchema,
  type ScheduleBlock,
  slotMeta,
  type ActivityCard,
  type ActivitySlot,
  type DailyPlan,
  type FamilyProfile,
  type HistoryEntry,
  type LocalPlace,
} from "@/lib/server/plan-types";
import type {
  CustomSourceSummary,
  FamilyEventSummary,
} from "@/lib/server/family-context";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";
import { discoverPlaces } from "@/lib/server/discovery";
import { getWeather } from "@/lib/server/weather";

const aiActivityCardSchema = z.object({
  id: z.string(),
  slot: z.enum(SLOT_ORDER),
  name: z.string(),
  emoji: z.string(),
  summary: z.string(),
  ageRange: z.string(),
  duration: z.string(),
  bestTime: z.string(),
  materials: z.array(z.string()),
  benefits: z.array(z.string()),
  whyItFits: z.string(),
  steps: z.array(z.string()).min(2).max(6),
  backupPlan: z.string(),
});

function todayKey() {
  return format(new Date(), "yyyy-MM-dd");
}

function listChildren(profile: FamilyProfile) {
  return profile.kids
    .map((child) => `${child.name || "Child"} (${child.age}) likes ${child.interests.join(", ") || "open-ended play"}`)
    .join("; ");
}

function summarizeHistory(history: HistoryEntry[]) {
  const recent = history.slice(0, 12);
  if (!recent.length) {
    return "No usage history yet. Start broad and friendly.";
  }

  const completed = recent.filter((entry) => entry.action === "done").map((entry) => `${entry.title} [${entry.slot}]`);
  const skipped = recent.filter((entry) => entry.action === "skip").map((entry) => `${entry.title} [${entry.slot}]`);

  return [
    completed.length ? `Completed recently: ${completed.join(", ")}` : "No completed activities yet.",
    skipped.length ? `Skipped recently: ${skipped.join(", ")}` : "No skipped activities yet.",
  ].join("\n");
}

function materialsForSlot(profile: FamilyProfile, slot: ActivitySlot) {
  const materials = profile.materials.slice(0, 4);
  if (slot === "outdoor" && !materials.includes("Bubbles")) {
    materials.push("Bubbles");
  }
  if (slot === "indoor" && !materials.includes("Craft supplies")) {
    materials.push("Craft supplies");
  }
  return materials.slice(0, 4);
}

function parseTimeValue(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? "0");
  const meridiem = match[3];

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  }

  if (meridiem === "am" && hours === 12) {
    hours = 0;
  }

  if (!meridiem && hours > 23) {
    return null;
  }

  return (hours * 60) + minutes;
}

function parseTimeRange(value?: string) {
  if (!value) {
    return [null, null] as const;
  }

  const [start, end] = value
    .split(/-|–|to/)
    .map((part) => part.trim())
    .filter(Boolean);

  return [parseTimeValue(start), parseTimeValue(end)] as const;
}

function formatClock(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelveHour = hours % 12 || 12;
  return `${twelveHour}:${mins.toString().padStart(2, "0")} ${suffix}`;
}

function formatRange(start: number, end: number) {
  return `${formatClock(start)} - ${formatClock(end)}`;
}

function getScheduleTimes(profile: FamilyProfile) {
  const [legacyNapStart, legacyNapEnd] = parseTimeRange(profile.schedule.napWindow);
  const wake = parseTimeValue(profile.schedule.wakeTime) ?? (7 * 60);
  const nap1Start = parseTimeValue(profile.schedule.nap1Start) ?? legacyNapStart ?? (12 * 60) + 30;
  const nap1End = parseTimeValue(profile.schedule.nap1End) ?? legacyNapEnd ?? (nap1Start + 120);
  const bed = parseTimeValue(profile.schedule.bedtime) ?? (19 * 60) + 30;

  const explicitNap2Start = parseTimeValue(profile.schedule.nap2Start);
  const explicitNap2End = parseTimeValue(profile.schedule.nap2End);
  const fallbackNap2Start = Math.min(Math.max(nap1End + 120, (15 * 60) + 30), Math.max(wake + 240, bed - 120));
  const nap2Start = explicitNap2Start ?? fallbackNap2Start;
  const nap2End = explicitNap2End ?? Math.min(nap2Start + 45, bed - 45);
  const hasSecondNap = Boolean(profile.schedule.nap2Start || profile.schedule.nap2End);
  const normalizedNap1Start = Math.max(wake + 60, nap1Start);
  const normalizedNap1End = Math.max(normalizedNap1Start + 30, nap1End);
  const normalizedNap2Start = Math.max(normalizedNap1End + 30, nap2Start);
  const normalizedNap2End = Math.max(normalizedNap2Start + 30, nap2End);
  const normalizedBed = Math.max(normalizedNap2End + 30, bed);

  return {
    wake,
    nap1Start: normalizedNap1Start,
    nap1End: normalizedNap1End,
    nap2Start: normalizedNap2Start,
    nap2End: normalizedNap2End,
    bed: normalizedBed,
    hasSecondNap,
  };
}

function buildScheduleSummary(profile: FamilyProfile) {
  const times = getScheduleTimes(profile);
  const pieces = [
    `wake ${formatClock(times.wake)}`,
    `nap 1 ${formatRange(times.nap1Start, times.nap1End)}`,
    times.hasSecondNap ? `nap 2 ${formatRange(times.nap2Start, times.nap2End)}` : `quiet reset ${formatRange(times.nap2Start, times.nap2End)}`,
    `bedtime ${formatClock(times.bed)}`,
  ];

  if (profile.schedule.schoolHours) {
    pieces.push(`school ${profile.schedule.schoolHours}`);
  }

  if (profile.schedule.freeTimeWindows) {
    pieces.push(`free windows ${profile.schedule.freeTimeWindows}`);
  }

  if (profile.schedule.napWindow) {
    pieces.push(`nap notes ${profile.schedule.napWindow}`);
  }

  return pieces.join("; ");
}

function buildTimeline(profile: FamilyProfile, activities: ActivityCard[]): ScheduleBlock[] {
  const times = getScheduleTimes(profile);
  const blocks = [
    {
      id: "morning" as const,
      label: "Morning block",
      start: times.wake,
      end: times.nap1Start,
      summary: "Use the first awake stretch for the highest-energy play and one easy inside backup.",
      activitySlots: ["outdoor", "indoor"] as ActivitySlot[],
    },
    {
      id: "midday" as const,
      label: "Midday block",
      start: times.nap1End,
      end: times.nap2Start,
      summary: times.hasSecondNap
        ? "This is the best window for a mini outing or a calm reset before nap two."
        : "Use this post-nap window for the outing anchor, then slow the pace before evening.",
      activitySlots: ["adventure", "calm"] as ActivitySlot[],
    },
    {
      id: "afternoon" as const,
      label: "Afternoon block",
      start: times.nap2End,
      end: times.bed,
      summary: times.hasSecondNap
        ? "Keep the landing soft after nap two and bias toward connection over complexity."
        : "Treat this as the late-day wind-down block and keep expectations low-friction.",
      activitySlots: ["together"] as ActivitySlot[],
    },
  ];

  return blocks.map((block) => ({
    id: block.id,
    label: block.label,
    timeRange: formatRange(block.start, Math.max(block.start + 30, block.end)),
    summary: block.summary,
    activitySlots: block.activitySlots,
    activityNames: block.activitySlots
      .map((slot) => activities.find((activity) => activity.slot === slot)?.name)
      .filter((value): value is string => Boolean(value)),
  }));
}

function heuristicActivity(slot: ActivitySlot, profile: FamilyProfile, discovery: LocalPlace[], weatherSummary: string): ActivityCard {
  const youngest = Math.min(...profile.kids.map((child) => child.age));
  const oldest = Math.max(...profile.kids.map((child) => child.age));
  const ageRange = `${youngest}-${oldest} years`;
  const kids = profile.kids.map((child) => child.name || "your kid").join(" and ");
  const materials = materialsForSlot(profile, slot);

  const templates: Record<ActivitySlot, Omit<ActivityCard, "id" | "ageRange" | "materials">> = {
    outdoor: {
      slot,
      name: "Backyard Treasure Trail",
      emoji: "⛅",
      summary: `Use the weather window to burn energy with a simple scavenger trail for ${kids}. ${weatherSummary}`,
      duration: "30 min",
      bestTime: "Morning energy window",
      benefits: ["gross motor", "problem solving", "observation"],
      whyItFits: "It uses light prep, handles mixed ages, and gets the wiggles out quickly.",
      steps: [
        "Hide or point out five simple treasures: leaf, rock, stick, flower, something round.",
        "Give each child a tiny mission like hop to the next clue or stomp like a dinosaur.",
        "End with a snack or water reset outside before heading back in.",
      ],
      backupPlan: "If weather turns, move the same treasure hunt inside with socks, books, and blocks.",
    },
    indoor: {
      slot,
      name: "Kitchen Counter Makers Lab",
      emoji: "🏡",
      summary: "Turn a countertop into a quick creative station with one invitation and minimal setup.",
      duration: "25 min",
      bestTime: "Late morning",
      benefits: ["creativity", "fine motor", "language"],
      whyItFits: "It feels fresh without asking you to fully reset the house.",
      steps: [
        "Set out two materials and one prompt like build a dinosaur cave or rainbow lunch shop.",
        "Narrate what they are making instead of directing every move.",
        "Snap a photo before cleanup so the effort feels celebrated.",
      ],
      backupPlan: "Swap to sticker books or coloring if attention is fading.",
    },
    adventure: {
      slot,
      name: discovery[0]?.name ? `Mini outing: ${discovery[0].name}` : "Library and snack loop",
      emoji: "🚗",
      summary: discovery[0]
        ? `${discovery[0].name} is a practical outing anchor today. ${discovery[0].reasons.join(" ")}`
        : "A low-stakes location change can reset the whole day when home energy gets sticky.",
      duration: "1 hr",
      bestTime: "Midday change-of-scene window",
      benefits: ["social confidence", "sensory reset", "routine variety"],
      whyItFits: "A contained outing gives everybody a reset without committing to a giant adventure.",
      steps: [
        "Pack one snack, water, wipes, and one familiar comfort item.",
        "Set one simple mission: read two books, visit one animal, or do one full playground loop.",
        "Leave while everyone is still doing well so the outing ends on a win.",
      ],
      backupPlan: "If leaving home feels impossible, do a stroller walk plus drive-through treat instead.",
    },
    calm: {
      slot,
      name: "Pillow Nest Reset",
      emoji: "🧘",
      summary: "Build a soft landing zone for quiet bodies before nap, quiet time, or post-meltdown recovery.",
      duration: "15 min",
      bestTime: "Pre-nap or after lunch",
      benefits: ["co-regulation", "language", "body awareness"],
      whyItFits: "This is easy to start even when you are running low on patience.",
      steps: [
        "Pile pillows and one blanket into a tiny nest on the floor.",
        "Whisper a three-part story about where the nest is going today.",
        "Finish with one song, one stretch, or one page from a familiar book.",
      ],
      backupPlan: "Switch to a bath or sink water play if calm sitting is not happening.",
    },
    together: {
      slot,
      name: "Family Helper Hour",
      emoji: "👨‍👩‍👧‍👦",
      summary: "Make one ordinary task feel special by doing it shoulder to shoulder.",
      duration: "20 min",
      bestTime: "Late afternoon",
      benefits: ["bonding", "confidence", "practical life"],
      whyItFits: "It creates connection while still moving the house forward.",
      steps: [
        "Pick one task: muffin mixing, toy washing, or plant watering.",
        "Give each child one real job with a clear start and finish.",
        "Celebrate the finished work out loud so it feels meaningful.",
      ],
      backupPlan: "If shared chores flop, switch to couch picnic and one-on-one chatting.",
    },
  };

  return {
    id: `${slot}-${todayKey()}`,
    ageRange,
    materials,
    ...templates[slot],
  };
}

function normalizeActivity(
  slot: ActivitySlot,
  activity: Partial<ActivityCard>,
  profile: FamilyProfile,
  discovery: LocalPlace[],
  weatherSummary: string,
  index: number,
) {
  const fallback = heuristicActivity(slot, profile, discovery, weatherSummary);

  return {
    ...fallback,
    ...activity,
    id: activity.id || `${slot}-${todayKey()}-${index}`,
    slot,
    ageRange: activity.ageRange || fallback.ageRange,
    materials: activity.materials?.length ? activity.materials : fallback.materials,
    benefits: activity.benefits?.length ? activity.benefits : fallback.benefits,
    steps: activity.steps?.length ? activity.steps.slice(0, 6) : fallback.steps,
    emoji: activity.emoji || slotMeta[slot].emoji,
  } satisfies ActivityCard;
}

function fallbackNapTrap() {
  return [
    {
      id: "nap-1",
      title: "One-hand sticker mission",
      kind: "kid activity",
      duration: "10 min",
      details: "Hand over stickers and a paper plate, then narrate the shapes they choose.",
    },
    {
      id: "nap-2",
      title: "Five-minute nervous system reset",
      kind: "self-care",
      duration: "5 min",
      details: "Do one long exhale for every finger you tap with your thumb.",
    },
    {
      id: "nap-3",
      title: "Tomorrow prep list",
      kind: "planning",
      duration: "7 min",
      details: "Order or stage one thing that makes tomorrows first activity easier.",
    },
  ];
}

async function generateActivitiesWithAi(profile: FamilyProfile, history: HistoryEntry[], discovery: LocalPlace[], weatherText: string) {
  const { object } = await generateObject({
    model: getOpenAIModel(),
    schema: z.object({
      headline: z.string(),
      encouragement: z.string(),
      activities: z.array(aiActivityCardSchema).length(5),
      napTrap: z.array(napTrapSuggestionSchema).min(3).max(5),
    }),
    system:
      "You are PlayDays, an elite family activity planner for parents with little spare attention. Be practical, emotionally intelligent, concise, and deeply specific. Every idea should feel doable today.",
    prompt: `Parent: ${profile.parentName}
Kids: ${listChildren(profile)}
Location: ${profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")}
Schedule: ${buildScheduleSummary(profile)}
Preferences: ${profile.preferences.indoorOutdoorPreference}, mess tolerance ${profile.preferences.messTolerance}/5, energy ${profile.preferences.energyLevelToday}/5
Materials: ${profile.materials.join(", ") || "basic household materials"}
Weather: ${weatherText}
Local options: ${discovery.map((place) => `${place.name} (${place.category})`).join(", ") || "none"}
Usage history:
${summarizeHistory(history)}

Return exactly five activity cards in this slot order: outdoor, indoor, adventure, calm, together. The adventure slot should use one of the local options when helpful.`,
  });

  return object;
}

async function generateReplacementWithAi(
  slot: ActivitySlot,
  profile: FamilyProfile,
  history: HistoryEntry[],
  discovery: LocalPlace[],
  weatherText: string,
  excludedTitles: string[],
) {
  const { object } = await generateObject({
    model: getOpenAIModel(),
    schema: z.object({
      activity: aiActivityCardSchema,
    }),
    system: "You create one replacement family activity card that feels fresh, concrete, and realistic for today.",
    prompt: `Replace slot: ${slot}
Do not repeat: ${excludedTitles.join(", ") || "none"}
Parent: ${profile.parentName}
Kids: ${listChildren(profile)}
Weather: ${weatherText}
Materials: ${profile.materials.join(", ")}
Recent history: ${summarizeHistory(history)}
Local options: ${discovery.map((place) => place.name).join(", ")}`,
  });

  return object.activity;
}

export async function buildDailyPlan(options: {
  profile?: FamilyProfile;
  history?: HistoryEntry[];
  replaceSlot?: ActivitySlot;
  excludedTitles?: string[];
}) {
  const profile = options.profile ?? createDemoProfile();
  const history = options.history ?? [];
  const weather = await getWeather(profile.location);
  const discoveryResult = await discoverPlaces(profile.location);
  const discovery = discoveryResult.places;
  const weatherText = `${weather.summary}. High ${weather.high}F, low ${weather.low}F, precipitation ${weather.precipitationChance}%. ${weather.recommendation}`;

  if (options.replaceSlot) {
    const replacement = hasOpenAIKey()
      ? await generateReplacementWithAi(
          options.replaceSlot,
          profile,
          history,
          discovery,
          weatherText,
          options.excludedTitles ?? [],
        )
      : heuristicActivity(options.replaceSlot, profile, discovery, weatherText);

    return {
      activity: normalizeActivity(options.replaceSlot, replacement, profile, discovery, weatherText, 0),
      weather,
      discovery,
      source: discoveryResult.source,
    };
  }

  const aiObject = hasOpenAIKey() ? await generateActivitiesWithAi(profile, history, discovery, weatherText) : null;

  const activities = SLOT_ORDER.map((slot, index) => {
    const match = aiObject?.activities?.find((activity) => activity.slot === slot) ?? aiObject?.activities?.[index];
    return normalizeActivity(slot, match ?? {}, profile, discovery, weatherText, index);
  });
  const timeline = buildTimeline(profile, activities);

  const plan: DailyPlan = {
    dateKey: todayKey(),
    headline: aiObject?.headline || `A calmer ${format(new Date(), "EEEE")} plan for ${profile.parentName || "today"}`,
    encouragement:
      aiObject?.encouragement || "You do not need a perfect day. You need one good next move and a couple of soft landings.",
    weather,
    discoveryMode: discoveryResult.source,
    activities,
    timeline,
    discovery,
    napTrap: aiObject?.napTrap?.length ? aiObject.napTrap : fallbackNapTrap(),
  };

  return {
    plan,
    source: discoveryResult.source,
  };
}

export async function buildChatSystemPrompt(profile: FamilyProfile, history: HistoryEntry[]) {
  const emptyEvents: FamilyEventSummary[] = [];
  const emptySources: CustomSourceSummary[] = [];
  return buildContextualChatSystemPrompt({
    profile,
    history,
    savedEvents: emptyEvents,
    customSources: emptySources,
    upcomingEvents: emptyEvents,
  });
}

function summarizeEvents(events: FamilyEventSummary[]) {
  if (!events.length) {
    return "none loaded";
  }

  return events
    .slice(0, 6)
    .map((event) => `${event.title} (${event.dateLabel}; ${event.verificationLabel})`)
    .join(", ");
}

function summarizeCustomSources(sources: CustomSourceSummary[]) {
  if (!sources.length) {
    return "none saved";
  }

  return sources
    .slice(0, 6)
    .map((source) => `${source.name} (${source.recurrenceLabel})`)
    .join(", ");
}

export async function buildContextualChatSystemPrompt(options: {
  profile: FamilyProfile;
  history: HistoryEntry[];
  savedEvents: FamilyEventSummary[];
  customSources: CustomSourceSummary[];
  upcomingEvents: FamilyEventSummary[];
}) {
  const { profile, history, savedEvents, customSources, upcomingEvents } = options;
  const weather = await getWeather(profile.location);
  const discovery = await discoverPlaces(profile.location, ["parks", "libraries", "playgrounds"]);

  return [
    "You are PlayDays, a warm, high-agency planning assistant for a parent managing real family life.",
    "Answer fast. Prefer 3 solid options over 10 vague ones. Use bullets when helpful.",
    "Give realistic advice for a phone-in-hand parent. Prioritize low-friction, age-appropriate suggestions.",
    `Parent: ${profile.parentName}`,
    `Kids: ${listChildren(profile)}`,
    `Location: ${profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ")}`,
    `Schedule: ${buildScheduleSummary(profile)}`,
    `Preferences: ${profile.preferences.indoorOutdoorPreference}; mess tolerance ${profile.preferences.messTolerance}/5; energy ${profile.preferences.energyLevelToday}/5`,
    `Materials at home: ${profile.materials.join(", ") || "basic household items"}`,
    `Weather now: ${weather.summary}, ${weather.currentTemperature ?? weather.high}F, high ${weather.high}F, low ${weather.low}F, rain chance ${weather.precipitationChance}%`,
    `Nearby ideas: ${discovery.places.slice(0, 4).map((place) => `${place.name} (${place.category})`).join(", ") || "none loaded"}`,
    `Saved events: ${summarizeEvents(savedEvents)}`,
    `Custom programs: ${summarizeCustomSources(customSources)}`,
    `Upcoming area events: ${summarizeEvents(upcomingEvents)}`,
    `Recent behavior signals: ${summarizeHistory(history)}`,
    "Be explicit when event data is low-confidence or still needs verification.",
    "If the parent sounds depleted, lower the ambition and protect their nervous system first.",
  ].join("\n");
}
