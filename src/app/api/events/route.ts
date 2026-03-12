import { NextResponse } from "next/server";
import { z } from "zod";
import { eventListNameSchema, eventSchema } from "@/lib/schemas";
import { getPublicEventById, getRelatedEvents, listPublicEvents } from "@/lib/server/events";

export const runtime = "nodejs";
export const maxDuration = 60;

const querySchema = z.object({
  id: z.string().optional(),
  city: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  tags: z.string().optional(),
  age: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const saveBodySchema = z.object({
  action: z.enum(["save", "unsave"]),
  eventId: z.string().optional(),
  event: eventSchema.optional(),
  listName: eventListNameSchema.default("saved"),
  notes: z.string().default(""),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = querySchema.parse({
    id: url.searchParams.get("id") ?? undefined,
    city: url.searchParams.get("city") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    tags: url.searchParams.get("tags") ?? undefined,
    age: url.searchParams.get("age") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (params.id) {
    const event = await getPublicEventById(params.id);
    if (!event) {
      return NextResponse.json(
        {
          event: null,
          related: [],
          availability: "unavailable",
          message: "That event is not available in the shared feed right now.",
        },
        { status: 404 },
      );
    }

    const related = await getRelatedEvents(event);
    return NextResponse.json({ event, related, availability: "connected" });
  }

  const result = await listPublicEvents({
    city: params.city,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    tags: params.tags ? params.tags.split(",").map((item) => item.trim()).filter(Boolean) : [],
    age: params.age,
    limit: params.limit,
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = saveBodySchema.parse(await request.json());

  return NextResponse.json({
    ok: true,
    mode: "local-cache",
    message: "Saved events still live on this device until auth-backed persistence ships.",
    action: body.action,
    listName: body.listName,
    eventId: body.eventId ?? body.event?.id ?? null,
  });
}
