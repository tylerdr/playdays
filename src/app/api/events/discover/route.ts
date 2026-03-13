import { subHours } from "date-fns";
import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverEvents } from "@/lib/server/agents/event-discovery";
import { getAuthenticatedFamilyContext } from "@/lib/server/family-context";
import { isAuthorizedCronRequest } from "@/lib/server/request-auth";
import { createServiceRoleSupabaseClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  area: z.string().min(2).optional(),
  city: z.string().min(2).optional(),
  force: z.boolean().optional().default(false),
});

function missingTable(error: { code?: string; message?: string } | null | undefined) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.message?.includes("does not exist") ||
    error.message?.includes("Could not find")
  );
}

async function wasRecentlyRun(
  adminClient: ReturnType<typeof createServiceRoleSupabaseClient>,
  area: string,
) {
  if (!adminClient) {
    return false;
  }

  const result = await adminClient
    .from("event_discovery_runs")
    .select("id,ran_at")
    .eq("area", area)
    .gte("ran_at", subHours(new Date(), 6).toISOString())
    .order("ran_at", { ascending: false })
    .limit(1);

  if (result.error) {
    if (!missingTable(result.error)) {
      throw result.error;
    }
    return false;
  }

  return Boolean(result.data?.length);
}

function cronArea() {
  return process.env.PLAYDAYS_EVENT_DISCOVERY_AREA?.trim() || "";
}

async function resolveRequestContext(request: Request, body: z.infer<typeof bodySchema>) {
  const cronAuthorized = isAuthorizedCronRequest(request);
  const authContext = await getAuthenticatedFamilyContext();

  if (!cronAuthorized && authContext.authMode !== "authenticated") {
    return {
      ok: false as const,
      status: 401,
      error: "Authenticate or provide the cron secret to trigger event discovery.",
    };
  }

  const profile = authContext.profile;
  const area =
    body.area?.trim() ||
    (cronAuthorized ? cronArea() : "") ||
    profile?.location.label?.trim() ||
    [profile?.location.city, profile?.location.zip].filter(Boolean).join(", ").trim();
  const city = body.city?.trim() || profile?.location.city?.trim() || area.split(",")[0]?.trim() || area;
  const kidAges = profile?.kids.map((kid) => kid.age) ?? [];
  const preferencesSummary = profile
    ? `${profile.preferences.indoorOutdoorPreference}, energy ${profile.preferences.energyLevelToday}/5, mess tolerance ${profile.preferences.messTolerance}/5`
    : "general family outings";

  return {
    ok: true as const,
    cronAuthorized,
    area,
    city,
    kidAges,
    preferencesSummary,
  };
}

async function handleDiscovery(request: Request, body: z.infer<typeof bodySchema>) {
  const resolved = await resolveRequestContext(request, body);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }

  if (!resolved.area) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: resolved.cronAuthorized
        ? "PLAYDAYS_EVENT_DISCOVERY_AREA is not configured for cron discovery."
        : "No area was provided and no authenticated family location is available.",
    });
  }

  const adminClient = createServiceRoleSupabaseClient();
  if (!body.force && (await wasRecentlyRun(adminClient, resolved.area))) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: `Event discovery already ran for ${resolved.area} within the last 6 hours.`,
    });
  }

  const result = await discoverEvents({
    area: resolved.area,
    city: resolved.city,
    kidAges: resolved.kidAges,
    preferencesSummary: resolved.preferencesSummary,
    adminClient,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET must be configured before cron event discovery can run." },
      { status: 503 },
    );
  }

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  return handleDiscovery(request, {
    area: cronArea() || undefined,
    city: undefined,
    force: false,
  });
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const body = bodySchema.parse(raw ? JSON.parse(raw) : {});
    return handleDiscovery(request, body);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 },
    );
  }
}
