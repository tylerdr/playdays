import { NextResponse } from "next/server";
import { z } from "zod";
import { DISCOVERY_CATEGORIES, familyLocationSchema } from "@/lib/schemas";
import { discoverPlaces } from "@/lib/server/discovery";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  location: familyLocationSchema,
  categories: z.array(z.string()).default([...DISCOVERY_CATEGORIES]),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const result = await discoverPlaces(body.location, body.categories);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load discovery results.",
      },
      { status: 400 },
    );
  }
}
