import { NextResponse } from "next/server";
import { z } from "zod";
import { createDemoProfile, familyProfileSchema } from "@/lib/schemas";
import { sendDailyDigest } from "@/lib/server/email";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  email: z.string().email().optional(),
  profile: familyProfileSchema.optional(),
});

function cronProfile() {
  const raw = process.env.PLAYDAYS_DIGEST_PROFILE_JSON;
  if (!raw) {
    throw new Error("PLAYDAYS_DIGEST_PROFILE_JSON is required for cron delivery.");
  }

  return familyProfileSchema.parse(JSON.parse(raw));
}

async function deliver(email?: string, profile = createDemoProfile()) {
  const recipient = email || profile.email;
  if (!recipient) {
    throw new Error("A recipient email is required.");
  }

  return sendDailyDigest(profile, recipient);
}

export async function GET() {
  try {
    const profile = cronProfile();
    const result = await deliver(process.env.PLAYDAYS_DIGEST_EMAIL, profile);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send digest." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await deliver(body.email, body.profile ?? createDemoProfile());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send digest." },
      { status: 400 },
    );
  }
}
