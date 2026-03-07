import { NextResponse } from "next/server";
import { z } from "zod";
import { activitySlotSchema, familyProfileSchema, historyEntrySchema } from "@/lib/schemas";
import { buildDailyPlan } from "@/lib/server/plan";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  profile: familyProfileSchema.optional(),
  history: z.array(historyEntrySchema).optional(),
  replaceSlot: activitySlotSchema.optional(),
  excludedTitles: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await buildDailyPlan(body);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate daily plan.",
      },
      { status: 400 },
    );
  }
}
