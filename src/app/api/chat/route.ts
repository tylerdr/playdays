import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import { NextResponse } from "next/server";
import {
  familyProfileSchema,
  historyEntrySchema,
  type FamilyProfile,
  type HistoryEntry,
} from "@/lib/schemas";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";
import { discoverPlaces } from "@/lib/server/discovery";
import { buildChatSystemPrompt } from "@/lib/server/plan";
import { getWeather } from "@/lib/server/weather";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  messages?: UIMessage[];
  profile?: unknown;
  history?: unknown;
}

function readLastUserText(messages: UIMessage[]) {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  return (
    lastUserMessage?.parts
      ?.map((part) => (part.type === "text" ? part.text : ""))
      .join(" ")
      .trim() || "Help me figure out the next move."
  );
}

function buildGenericChatSystemPrompt() {
  return [
    "You are PlayDays, a warm planning assistant for a parent managing real family life.",
    "The user has not finished setup, so do not pretend to know their kids, location, or schedule.",
    "Answer with practical, low-friction options and keep the tone calm and useful.",
    "When personalization would help, invite them to finish setup without blocking the answer.",
  ].join("\n");
}

function summarizeFamily(profile: FamilyProfile) {
  const kids = profile.kids.map((child) => `${child.name || "kid"} (${child.age})`).join(", ");
  const location = profile.location.label || [profile.location.city, profile.location.zip].filter(Boolean).join(", ");
  return `${profile.parentName} with ${kids}${location ? ` in ${location}` : ""}`;
}

function summarizeHistory(history: HistoryEntry[]) {
  if (!history.length) {
    return null;
  }

  const doneCount = history.filter((entry) => entry.action === "done").length;
  const skipCount = history.filter((entry) => entry.action === "skip").length;
  return `On this device so far: ${doneCount} done, ${skipCount} skipped.`;
}

async function buildFallbackReply(prompt: string, profile: FamilyProfile | null, history: HistoryEntry[]) {
  const loweredPrompt = prompt.toLowerCase();
  const lines = [
    profile
      ? `Live AI is unavailable right now, so here is a quick PlayDays backup plan for ${summarizeFamily(profile)}.`
      : "Live AI is unavailable right now, so here is a quick PlayDays backup answer.",
  ];

  if (!profile) {
    lines.push("Finish setup when you can and chat will start using your kids, location, schedule, and weather.");
  }

  let weatherLine: string | null = null;
  let outingLine: string | null = null;

  if (profile) {
    try {
      const weather = await getWeather(profile.location);
      weatherLine = `Weather read: ${weather.summary}. High ${weather.high}°F, low ${weather.low}°F, rain chance ${weather.precipitationChance}%. ${weather.recommendation}`;
    } catch {
      weatherLine = null;
    }

    try {
      const discovery = await discoverPlaces(profile.location, ["parks", "libraries", "playgrounds"]);
      const topPlaces = discovery.places.slice(0, 2).map((place) => place.name);
      if (topPlaces.length) {
        outingLine =
          discovery.source === "google"
            ? `If you need to leave the house, start with ${topPlaces.join(" or ")}.`
            : `If you need to leave the house, open Discover and sanity-check ${topPlaces.join(" or ")} before you head out.`;
      }
    } catch {
      outingLine = null;
    }
  }

  if (weatherLine) {
    lines.push(weatherLine);
  }

  const steps: string[] = [];

  if (loweredPrompt.includes("nap")) {
    steps.push("Protect the nap first. Pick one quiet, one-handed option that keeps the awake kid busy beside you.");
  } else if (
    loweredPrompt.includes("inside") ||
    loweredPrompt.includes("rain") ||
    loweredPrompt.includes("storm")
  ) {
    steps.push("Start with an indoor reset that works in under ten minutes so the day gets easier before you add ambition.");
  } else if (loweredPrompt.includes("meltdown") || loweredPrompt.includes("cranky")) {
    steps.push("Lower the bar immediately: snack, water, floor-level connection, then one simple activity with an easy exit.");
  } else {
    steps.push("Pick one anchor activity only. A good-enough next move is better than a full perfect-day plan.");
  }

  if (loweredPrompt.includes("dinosaur")) {
    steps.push("Lean into the obsession. Three dino moves beat one complicated craft: stomp hunt, toy rescue bin, then a dino story reset.");
  } else if (loweredPrompt.includes("weekend") || loweredPrompt.includes("near us")) {
    steps.push("Use the outing as the anchor and keep the at-home follow-up tiny so the day still feels manageable when you get back.");
  } else {
    steps.push("Pair the anchor with a backup: one at-home option and one leave-the-house option so you can pivot fast.");
  }

  steps.push("End with the easiest calm close you can manage: snack, books, water play, or a short together-time ritual.");

  lines.push("Try this next:");
  lines.push(...steps.map((step, index) => `${index + 1}. ${step}`));

  if (outingLine) {
    lines.push(outingLine);
  }

  const historyLine = summarizeHistory(history);
  if (historyLine) {
    lines.push(historyLine);
  }

  return lines.join("\n\n");
}

function createFallbackResponse(messages: UIMessage[], text: string) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      execute: ({ writer }) => {
        const id = `fallback-${crypto.randomUUID()}`;
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end", id });
      },
      onError: () => "Unable to stream fallback response.",
    }),
  });
}

export async function POST(request: Request) {
  let body: ChatBody;

  try {
    body = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "Expected a messages array." }, { status: 400 });
  }

  const parsedProfile = body.profile ? familyProfileSchema.safeParse(body.profile) : null;
  const parsedHistory = body.history ? historyEntrySchema.array().safeParse(body.history) : null;
  const profile = parsedProfile?.success ? parsedProfile.data : null;
  const history = parsedHistory?.success ? parsedHistory.data : [];
  const lastUserText = readLastUserText(body.messages);

  if (!hasOpenAIKey()) {
    const fallback = await buildFallbackReply(lastUserText, profile, history);
    return createFallbackResponse(body.messages, fallback);
  }

  try {
    const system = profile ? await buildChatSystemPrompt(profile, history) : buildGenericChatSystemPrompt();

    const result = streamText({
      model: getOpenAIModel(),
      system,
      messages: await convertToModelMessages(body.messages),
    });

    return result.toUIMessageStreamResponse({
      originalMessages: body.messages,
    });
  } catch {
    const fallback = await buildFallbackReply(lastUserText, profile, history);
    return createFallbackResponse(body.messages, fallback);
  }
}
