import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverAreaEvents } from "@/lib/server/agents/event-discovery";
import { getLastDiscoveryRun, hasEventServiceEnv, logDiscoveryRun, upsertDiscoveredEvents } from "@/lib/server/events";
import { activityPrefsSchema, schedulePrefsSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  city: z.string().min(1),
  state: z.string().optional(),
  kidAges: z.array(z.number().min(0).max(18)).default([]),
  activityPrefs: activityPrefsSchema.nullable().optional(),
  schedulePrefs: schedulePrefsSchema.nullable().optional(),
});

function isAllowed(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("x-cron-secret") === cronSecret;
}

export async function POST(request: Request) {
  if (!isAllowed(request)) {
    return NextResponse.json({ error: "Event discovery is not authorized for this request." }, { status: 401 });
  }

  if (!hasEventServiceEnv()) {
    return NextResponse.json(
      { error: "Shared event discovery is not wired in this environment yet." },
      { status: 503 },
    );
  }

  const body = bodySchema.parse(await request.json());
  const area = [body.city, body.state].filter(Boolean).join(", ");
  const lastRun = await getLastDiscoveryRun(area);

  if (lastRun?.ran_at) {
    const elapsedMs = Date.now() - new Date(lastRun.ran_at).getTime();
    if (elapsedMs < 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "That area was refreshed less than an hour ago. Try again later." },
        { status: 429 },
      );
    }
  }

  try {
    const events = await discoverAreaEvents({
      city: body.city,
      state: body.state,
      kidAges: body.kidAges,
      activityPrefs: body.activityPrefs ?? null,
      schedulePrefs: body.schedulePrefs ?? null,
    });

    const inserted = await upsertDiscoveredEvents(events);
    await logDiscoveryRun({
      area,
      eventsFound: events.length,
      eventsNew: inserted,
      status: "ok",
    });

    return NextResponse.json({
      ok: true,
      area,
      eventsFound: events.length,
      eventsNew: inserted,
      message: events.length
        ? "Shared events refreshed. Low-confidence items should still be verified before going."
        : "No events were discovered for that area in this pass.",
    });
  } catch (error) {
    await logDiscoveryRun({
      area,
      eventsFound: 0,
      eventsNew: 0,
      status: "error",
      errorMessage: error instanceof Error ? error.message : "Unknown discovery error",
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to refresh events right now." },
      { status: 500 },
    );
  }
}
