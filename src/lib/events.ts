import { addDays, format, isSameDay, parseISO, startOfDay } from "date-fns";
import type { ChildProfile, Event } from "@/lib/schemas";

export type EventDateWindow = "all" | "today" | "week" | "weekend";

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  try {
    return parseISO(value);
  } catch {
    return null;
  }
}

export function formatEventDateRange(event: Event) {
  const start = parseDate(event.startDate);
  const end = parseDate(event.endDate);

  if (!start) {
    return "Date still being confirmed";
  }

  if (!end || isSameDay(start, end)) {
    return format(start, "EEE, MMM d");
  }

  return `${format(start, "EEE, MMM d")} - ${format(end, "EEE, MMM d")}`;
}

export function formatEventTimeRange(event: Event) {
  if (event.startTime && event.endTime) {
    return `${event.startTime} - ${event.endTime}`;
  }

  if (event.startTime) {
    return `Starts at ${event.startTime}`;
  }

  return "Time still being confirmed";
}

export function buildEventMapUrl(event: Pick<Event, "locationName" | "locationAddress" | "city">) {
  const query = [event.locationName, event.locationAddress, event.city].filter(Boolean).join(", ");
  if (!query) {
    return "";
  }

  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", query);
  return url.toString();
}

export function eventMatchesKids(event: Event, kids: ChildProfile[]) {
  if (!kids.length) {
    return true;
  }

  return kids.some((kid) => kid.age >= event.ageMin && kid.age <= event.ageMax);
}

export function eventMatchesWindow(event: Event, window: EventDateWindow) {
  if (window === "all") {
    return true;
  }

  const start = parseDate(event.startDate);
  if (!start) {
    return false;
  }

  const today = startOfDay(new Date());
  const oneWeekOut = addDays(today, 7);

  if (window === "today") {
    return isSameDay(start, today);
  }

  if (window === "week") {
    return start >= today && start <= oneWeekOut;
  }

  return start.getDay() === 0 || start.getDay() === 6;
}

export function sortEventsChronologically(events: Event[]) {
  return [...events].sort((left, right) => {
    if (!left.startDate && !right.startDate) {
      return left.title.localeCompare(right.title);
    }

    if (!left.startDate) {
      return 1;
    }

    if (!right.startDate) {
      return -1;
    }

    const leftDate = parseDate(left.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const rightDate = parseDate(right.startDate)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) {
      return leftDate - rightDate;
    }

    return left.title.localeCompare(right.title);
  });
}

export function getEventConfidenceLabel(event: Event) {
  if (event.isVerified || event.confidence === "high") {
    return "Verified";
  }

  if (event.source === "ai") {
    return "AI-found — verify";
  }

  return "Check details";
}

export function getEventCostLabel(event: Event) {
  if (event.costType === "free") {
    return "Free";
  }

  if (event.costType === "paid" && typeof event.costAmount === "number") {
    return `$${event.costAmount}`;
  }

  if (event.costType === "paid") {
    return "Paid";
  }

  return "Cost not listed";
}
