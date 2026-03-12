import { NextResponse } from "next/server";
import { z } from "zod";
import { createDemoProfile, familyProfileSchema } from "@/lib/schemas";
import {
  getAuthenticatedFamilyContext,
  hydrateFamilyContext,
  listDigestEnabledProfiles,
} from "@/lib/server/family-context";
import { composeDailyDigest } from "@/lib/server/agents/daily-digest";
import { sendDailyDigest } from "@/lib/server/email";
import { isAuthorizedCronRequest } from "@/lib/server/request-auth";
import { createServiceRoleSupabaseClient } from "@/lib/server/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  email: z.string().email().optional(),
  profile: familyProfileSchema.optional(),
});

function cronProfile() {
  const raw = process.env.PLAYDAYS_DIGEST_PROFILE_JSON;
  if (!raw) {
    throw new Error("PLAYDAYS_DIGEST_PROFILE_JSON is required for legacy cron delivery.");
  }

  return familyProfileSchema.parse(JSON.parse(raw));
}

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

async function logDigest(
  adminClient: ReturnType<typeof createServiceRoleSupabaseClient>,
  payload: {
    profileId?: string | null;
    recipientEmail: string;
    status: string;
    body: Record<string, unknown>;
  },
) {
  if (!adminClient || !payload.profileId) {
    return;
  }

  const result = await (adminClient as never as {
    from: (table: string) => {
      insert: (value: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
    };
  }).from("daily_digest_logs").insert({
    profile_id: payload.profileId,
    recipient_email: payload.recipientEmail,
    status: payload.status,
    payload: payload.body,
  });

  if (result.error && !missingTable(result.error)) {
    throw result.error;
  }
}

async function deliverWithContext(input: {
  profileId?: string | null;
  profile: z.infer<typeof familyProfileSchema>;
  recipientEmail: string;
  history?: Awaited<ReturnType<typeof getAuthenticatedFamilyContext>>["history"];
  savedEvents?: Awaited<ReturnType<typeof getAuthenticatedFamilyContext>>["savedEvents"];
  upcomingEvents?: Awaited<ReturnType<typeof getAuthenticatedFamilyContext>>["upcomingEvents"];
  customSources?: Awaited<ReturnType<typeof getAuthenticatedFamilyContext>>["customSources"];
  adminClient?: ReturnType<typeof createServiceRoleSupabaseClient>;
}) {
  const composition = await composeDailyDigest({
    profile: input.profile,
    history: input.history ?? [],
    savedEvents: input.savedEvents ?? [],
    upcomingEvents: input.upcomingEvents ?? [],
    customSources: input.customSources ?? [],
  });
  const result = await sendDailyDigest({
    profile: input.profile,
    recipientEmail: input.recipientEmail,
    composition,
  });

  try {
    await logDigest(input.adminClient ?? null, {
      profileId: input.profileId,
      recipientEmail: input.recipientEmail,
      status: result.mode,
      body: {
        subject: result.subject,
        previewText: result.previewText,
        upcomingCount: composition.upcomingItems.length,
        warnings: composition.warnings,
      },
    });
  } catch {
    // Swallow digest logging errors so delivery can still succeed.
  }

  return {
    mode: result.mode,
    subject: result.subject,
    previewText: result.previewText,
    upcomingCount: composition.upcomingItems.length,
    warningCount: composition.warnings.length,
  };
}

async function deliverLegacyDigest(email?: string) {
  const profile = cronProfile() ?? createDemoProfile();
  const recipient = email || process.env.PLAYDAYS_DIGEST_EMAIL || profile.email;

  if (!recipient) {
    throw new Error("A recipient email is required for legacy digest delivery.");
  }

  return deliverWithContext({
    profile,
    recipientEmail: recipient,
  });
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET must be configured before the cron digest route can run." },
      { status: 503 },
    );
  }

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const adminClient = createServiceRoleSupabaseClient();
  if (!adminClient) {
    try {
      const legacy = await deliverLegacyDigest();
      return NextResponse.json({
        ok: true,
        mode: "legacy",
        processed: 1,
        sent: legacy.mode === "sent" ? 1 : 0,
        previewed: legacy.mode === "preview" ? 1 : 0,
        results: [legacy],
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to send legacy digest." },
        { status: 400 },
      );
    }
  }

  const profilesResult = await listDigestEnabledProfiles(adminClient);
  if (profilesResult.error) {
    if (!missingTable(profilesResult.error)) {
      return NextResponse.json(
        { error: profilesResult.error.message },
        { status: 400 },
      );
    }

    try {
      const legacy = await deliverLegacyDigest();
      return NextResponse.json({
        ok: true,
        mode: "legacy",
        processed: 1,
        sent: legacy.mode === "sent" ? 1 : 0,
        previewed: legacy.mode === "preview" ? 1 : 0,
        results: [legacy],
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to send legacy digest." },
        { status: 400 },
      );
    }
  }

  const rows = profilesResult.data ?? [];
  const results: Array<Record<string, unknown>> = [];
  let sent = 0;
  let previewed = 0;

  for (const row of rows) {
    const user = row.user_id ? { id: row.user_id, email: row.email ?? null } : null;
    const context = await hydrateFamilyContext(adminClient, row, user);
    const profile = context.profile;
    const recipient = profile?.email || row.email;

    if (!profile || !recipient || !context.digestEnabled) {
      results.push({
        profileId: row.id,
        status: "skipped",
        reason: !profile
          ? "Profile JSON could not be parsed."
          : !recipient
            ? "No recipient email configured."
            : "Digest disabled.",
      });
      continue;
    }

    try {
      const delivered = await deliverWithContext({
        profileId: row.id,
        profile,
        recipientEmail: recipient,
        history: context.history,
        savedEvents: context.savedEvents,
        upcomingEvents: context.upcomingEvents,
        customSources: context.customSources,
        adminClient,
      });

      if (delivered.mode === "sent") {
        sent += 1;
      } else {
        previewed += 1;
      }

      results.push({
        profileId: row.id,
        recipient,
        status: delivered.mode,
        subject: delivered.subject,
        warnings: context.warnings,
      });
    } catch (error) {
      try {
        await logDigest(adminClient, {
          profileId: row.id,
          recipientEmail: recipient,
          status: "failed",
          body: {
            error: error instanceof Error ? error.message : "Unknown digest failure",
          },
        });
      } catch {
        // Ignore log failures here too.
      }

      results.push({
        profileId: row.id,
        recipient,
        status: "failed",
        error: error instanceof Error ? error.message : "Unable to send digest.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    mode: "supabase",
    processed: rows.length,
    sent,
    previewed,
    results,
  });
}

export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;

  try {
    const raw = await request.text();
    body = bodySchema.parse(raw ? JSON.parse(raw) : {});
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request body." },
      { status: 400 },
    );
  }

  const authContext = await getAuthenticatedFamilyContext();
  if (authContext.profile) {
    const recipient = body.email || authContext.profile.email;
    if (!recipient) {
      return NextResponse.json({ error: "No recipient email is configured for this family." }, { status: 400 });
    }

    const adminClient = createServiceRoleSupabaseClient();
    const result = await deliverWithContext({
      profileId: authContext.profileRecordId,
      profile: authContext.profile,
      recipientEmail: recipient,
      history: authContext.history,
      savedEvents: authContext.savedEvents,
      upcomingEvents: authContext.upcomingEvents,
      customSources: authContext.customSources,
      adminClient,
    });

    return NextResponse.json({
      ok: true,
      trigger: "authenticated",
      deliveryMode: result.mode,
      ...result,
      warnings: authContext.warnings,
    });
  }

  if (isAuthorizedCronRequest(request)) {
    try {
      if (body.profile) {
        const recipient = body.email || body.profile.email || process.env.PLAYDAYS_DIGEST_EMAIL;
        if (!recipient) {
          return NextResponse.json(
            { error: "A recipient email is required when triggering a secret-backed digest preview." },
            { status: 400 },
          );
        }

        const result = await deliverWithContext({
          profile: body.profile,
          recipientEmail: recipient,
        });

        return NextResponse.json({
          ok: true,
          trigger: "secret",
          deliveryMode: result.mode,
          ...result,
        });
      }

      const result = await deliverLegacyDigest(body.email);

      return NextResponse.json({
        ok: true,
        trigger: "secret",
        deliveryMode: result.mode,
        ...result,
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unable to send digest." },
        { status: 400 },
      );
    }
  }

  return NextResponse.json(
    { error: "Authenticate or provide the cron secret to trigger a digest." },
    { status: 401 },
  );
}
