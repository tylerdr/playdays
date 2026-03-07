import type { ActivitySlot } from "@/lib/schemas";

export const siteConfig = {
  name: "PlayDays",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  description:
    "Daily family activity planning with weather-aware ideas, local discovery, and a calm AI helper built for real parent life.",
};

export const marketingNav = [
  { href: "/onboard", label: "Start setup" },
  { href: "/today", label: "Today" },
  { href: "/discover", label: "Discover" },
  { href: "/chat", label: "Chat" },
];

export const appNav = [
  { href: "/today", label: "Today" },
  { href: "/discover", label: "Discover" },
  { href: "/chat", label: "Chat" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

export const slotMeta: Record<
  ActivitySlot,
  { label: string; emoji: string; accentClass: string; pillClass: string }
> = {
  outdoor: {
    label: "Outdoor Activity",
    emoji: "⛅",
    accentClass: "from-emerald-200 via-emerald-100 to-white",
    pillClass: "bg-emerald-100 text-emerald-900",
  },
  indoor: {
    label: "Indoor Activity",
    emoji: "🏡",
    accentClass: "from-amber-100 via-orange-50 to-white",
    pillClass: "bg-amber-100 text-amber-900",
  },
  adventure: {
    label: "Go-Do / Adventure",
    emoji: "🚗",
    accentClass: "from-sky-100 via-cyan-50 to-white",
    pillClass: "bg-sky-100 text-sky-900",
  },
  calm: {
    label: "Calm / Wind-Down",
    emoji: "🧘",
    accentClass: "from-stone-100 via-rose-50 to-white",
    pillClass: "bg-stone-200 text-stone-900",
  },
  together: {
    label: "Together Time",
    emoji: "👨‍👩‍👧‍👦",
    accentClass: "from-rose-100 via-orange-50 to-white",
    pillClass: "bg-rose-100 text-rose-900",
  },
};

export const quickQuestions = [
  "I am stuck inside with a cranky 2-year-old. What can we do?",
  "My kid is obsessed with dinosaurs. Give me five dino activities.",
  "We are nap trapped. What can I do with one hand?",
  "What is happening near us this weekend?",
];
