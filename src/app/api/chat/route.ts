import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { NextResponse } from "next/server";
import { createDemoProfile, familyProfileSchema, historyEntrySchema } from "@/lib/schemas";
import { getOpenAIModel, hasOpenAIKey } from "@/lib/server/ai";
import { buildChatSystemPrompt } from "@/lib/server/plan";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatBody {
  messages?: UIMessage[];
  profile?: unknown;
  history?: unknown;
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

  if (!hasOpenAIKey()) {
    return NextResponse.json({ error: "OPENAI_API_KEY is required for chat." }, { status: 500 });
  }

  try {
    const profile = body.profile ? familyProfileSchema.parse(body.profile) : createDemoProfile();
    const history = body.history ? historyEntrySchema.array().parse(body.history) : [];
    const system = await buildChatSystemPrompt(profile, history);

    const result = streamText({
      model: getOpenAIModel(),
      system,
      messages: await convertToModelMessages(body.messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate chat response." },
      { status: 500 },
    );
  }
}
