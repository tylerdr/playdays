import { generateObject } from "ai";
import { z } from "zod";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";
import { eventSchema, type ActivityPrefs, type Event, type SchedulePrefs } from "@/lib/schemas";

const discoverySchema = z.object({
  events: z.array(eventSchema).max(8),
});

export interface DiscoverAreaEventsInput {
  city: string;
  state?: string;
  kidAges?: number[];
  activityPrefs?: ActivityPrefs | null;
  schedulePrefs?: SchedulePrefs | null;
}

export async function discoverAreaEvents(input: DiscoverAreaEventsInput): Promise<Event[]> {
  if (!hasOpenAIKey()) {
    return [];
  }

  const today = new Date().toISOString().slice(0, 10);
  const locationLabel = [input.city, input.state].filter(Boolean).join(", ");
  const { object } = await generateObject({
    model: getOpenAIModel(),
    schema: discoverySchema,
    system: [
      "You find local family events and classes for parents.",
      `Today's date is ${today}.`,
      "Only return events that are plausible for the provided area and upcoming dates.",
      "Prefer events with a source URL, realistic venue names, and concise summaries.",
      "If confidence is low, set confidence to low and isVerified to false.",
      "Do not fabricate placeholder venues or generic search cards.",
    ].join(" "),
    prompt: JSON.stringify(
      {
        location: locationLabel,
        kidAges: input.kidAges ?? [],
        activityPrefs: input.activityPrefs ?? null,
        schedulePrefs: input.schedulePrefs ?? null,
        outputRules: {
          city: input.city,
          source: "ai",
          confidence: "low",
          isVerified: false,
        },
      },
      null,
      2,
    ),
  });

  return object.events.map((event, index) =>
    eventSchema.parse({
      ...event,
      id: event.id || `discovered-event-${index}-${crypto.randomUUID()}`,
      city: event.city || input.city,
      discoveryArea: event.discoveryArea || locationLabel || input.city,
      source: "ai",
      confidence: event.confidence || "low",
      isVerified: event.isVerified ?? false,
      createdAt: event.createdAt || new Date().toISOString(),
    }),
  );
}
