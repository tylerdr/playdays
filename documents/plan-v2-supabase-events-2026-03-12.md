# PlayDays V2 — Supabase + Events + Email + AI Agents Plan

**Date:** 2026-03-12  
**Author:** v-playdays agent  
**Goal:** Make PlayDays production-ready and genuinely valuable for real families — specifically good enough that a busy parent (like Tyler's wife) would sign up and actually use it daily.

---

## Executive Summary

PlayDays currently has a solid visual foundation and core "today plan" loop, but runs entirely off localStorage with no real auth. This plan transforms it into a fully persistent, personalized platform backed by Supabase — with a curated events feed, schedule-aware recommendations, AI chat that knows the family, and a daily personalized email.

**The test:** Would Tyler's wife (target ICP: parent of young kids, wants structure, values discovery of things to do) sign up and open the app every morning?

After this build: **yes**.

---

## What We're Building (Feature Scope)

### 1. Supabase Auth + Persistent User Profiles
Replace localStorage with real Supabase-backed accounts. Magic link auth (email only, no password friction). On first login → guided onboarding. Returning users → instantly in the app.

### 2. Events Feed (AI Research Agent)
A curated, personalized feed of upcoming local events — classes, activities, seasonal experiences, community events — surfaced by an AI research agent that knows the family's location, kid ages, and preferences. Users can browse, save, and share events.

### 3. Custom Event Sources ("Lifetime KidsClub")
Users can add recurring programs or venues they're already enrolled in (e.g., "Lifetime KidsClub - Saturdays 10am", "Swim lessons - Tuesdays 3pm"). The AI knows about these and can schedule around them or suggest complementary activities.

### 4. Save Events to Lists
Simple lists: "Saved", "Want to try", "Did this". Events can be saved from the feed and referenced in scheduling + chat.

### 5. Schedule Preferences
Users define their typical weekly rhythm: which days are free, preferred outing windows (morning vs afternoon), how far they'll drive, nap schedules, budget comfort. This feeds into recommendations and schedule insertion.

### 6. Activity Preferences
Checklist + sliders: types of activities they enjoy (art, outdoor, sports, educational, sensory, social) and logistics they care about (free vs paid, indoor vs outdoor, age-appropriate). Informs everything.

### 7. Schedule Insertion + Smart Reminders
When a saved event is approaching (within 2 weeks → 2 days), the AI checks if it fits the family's schedule and sends a timely recommendation or inserts it into the day plan when relevant.

### 8. Personalized Daily Email
Morning digest sent via Resend. Contains:
- Today's suggested plan (tailored to weather + family)
- 2-3 upcoming events from their saved list + newly discovered events
- A brief AI note ("Good time to visit the farmers market — both kids are 2+ now and you haven't been lately")

### 9. AI Chat with Full Context
Upgrade the chat route to be fully context-aware: pulls from the user's Supabase profile, their saved events, custom sources, upcoming schedule windows, and discovered events. Can answer "what should we do this weekend?" with actually personalized, actionable answers.

---

## Architecture Plan

### Tech Stack (reusing existing)
- **Framework:** Next.js 16 (App Router)
- **Database/Auth:** Supabase (existing setup, extend schema)
- **AI:** ai-sdk + OpenAI (existing)
- **Email:** Resend (existing)
- **Deployment:** Vercel (existing)
- **Styling:** Tailwind v4 + shadcn (existing)

### Reuse from Sprinter Kit
- Auth patterns: middleware, callback route, `createServerSupabaseClient` pattern
- Agent registry pattern from `lib/ai/agents.ts`
- Chat UI patterns from `components/chat/`
- Provider pattern from `app/providers.tsx`

---

## Database Schema

### Migration: Extend existing schema with auth + events

```sql
-- Enable RLS on existing tables and add auth FK
ALTER TABLE public.family_profiles 
  ADD CONSTRAINT family_profiles_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile" ON public.family_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Add schedule + preference fields to family_profiles
ALTER TABLE public.family_profiles
  ADD COLUMN IF NOT EXISTS schedule_prefs jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activity_prefs jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_preferences jsonb NOT NULL DEFAULT '{"daily_digest": true, "event_reminders": true}';

-- Enable RLS on activity_history and saved_items
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their activity history" ON public.activity_history
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage their saved items" ON public.saved_items
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  );

-- Events: AI-discovered or user-submitted upcoming events
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text,
  image_url text,
  location_name text,
  location_address text,
  city text,
  lat numeric,
  lng numeric,
  start_date date,
  end_date date,
  start_time text,
  recurring text, -- 'weekly', 'monthly', 'one-time', etc.
  age_min int DEFAULT 0,
  age_max int DEFAULT 12,
  cost_type text DEFAULT 'unknown' CHECK (cost_type IN ('free', 'paid', 'unknown')),
  cost_amount numeric,
  tags text[] DEFAULT '{}',
  source text DEFAULT 'ai', -- 'ai', 'google', 'user', 'web'
  confidence text DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
  is_verified boolean DEFAULT false,
  discovery_area text, -- city/zip the event was found for
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz -- after this date, event is stale
);

CREATE INDEX IF NOT EXISTS events_city_idx ON public.events(city);
CREATE INDEX IF NOT EXISTS events_start_date_idx ON public.events(start_date);
CREATE INDEX IF NOT EXISTS events_tags_idx ON public.events USING GIN(tags);

-- Saved Events: user bookmarks events from the feed
CREATE TABLE IF NOT EXISTS public.saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  -- for custom/one-off events that aren't in the events table
  custom_event jsonb,
  list_name text DEFAULT 'saved' CHECK (list_name IN ('saved', 'want_to_try', 'done')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their saved events" ON public.saved_events
  FOR ALL USING (auth.uid() = user_id);

-- Custom Event Sources: recurring programs/venues the family attends
CREATE TABLE IF NOT EXISTS public.custom_event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL, -- "Lifetime KidsClub"
  location_name text,
  location_address text,
  recurrence_description text, -- "Saturdays 10am-12pm"
  recurrence_rrule text, -- iCal RRULE if known
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_event_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their custom sources" ON public.custom_event_sources
  FOR ALL USING (auth.uid() = user_id);

-- Event discovery log (for agent rate control)
CREATE TABLE IF NOT EXISTS public.event_discovery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  agent_run_at timestamptz NOT NULL DEFAULT now(),
  events_found int DEFAULT 0,
  status text DEFAULT 'ok'
);

-- Daily digest logs (update existing to track better)
-- Already exists: public.daily_digest_logs
```

### schedule_prefs JSON shape
```json
{
  "free_days": ["saturday", "sunday"],
  "free_windows": {
    "morning": true,
    "afternoon": true,
    "evening": false
  },
  "max_drive_minutes": 30,
  "nap_schedule": {
    "has_napper": true,
    "nap_start": "12:30",
    "nap_end": "14:30"
  },
  "budget": "moderate"
}
```

### activity_prefs JSON shape
```json
{
  "types": ["outdoor", "art", "sensory", "educational"],
  "settings": ["parks", "museums", "classes", "playgrounds"],
  "indoor_outdoor": "both",
  "energy_level": "medium",
  "social": "small-group"
}
```

---

## Routes / Pages

### New Routes

| Route | Description |
|-------|-------------|
| `/auth/login` | Magic link auth (email entry, no password) |
| `/auth/callback` | Supabase OAuth callback handler |
| `/auth/verify` | "Check your email" holding page |
| `/events` | Main events feed — personalized, browseable |
| `/events/[id]` | Event detail page |
| `/profile` | Unified profile/settings (replaces `/settings`) |
| `/profile/schedule` | Schedule preferences |
| `/profile/preferences` | Activity preference checklist |
| `/profile/lists` | Saved events lists |

### Modified Routes
- `/` — Add auth-aware nav (Sign In / Dashboard)
- `/today` — Pull from Supabase instead of localStorage; show relevant upcoming saved events in sidebar
- `/chat` — Full Supabase context: profile + saved events + custom sources + discovered events
- `/settings` → redirect to `/profile`
- `/history` — Pull from Supabase `activity_history`
- `/start-setup` — After setup, create Supabase profile record + redirect to `/today`

---

## Auth Flow

### New User
1. `/` → click "Sign In" or "Get Started"
2. `/auth/login` → enter email → magic link sent
3. `/auth/verify` → "Check your email"
4. Email link → `/auth/callback` → Supabase session created
5. Middleware detects new user (no profile) → redirect to `/start-setup`
6. Complete onboarding → profile created in Supabase → `/today`

### Returning User
1. Click any link → middleware checks session
2. If valid session → pass through
3. If no session → redirect to `/auth/login?next=<intended-route>`

### Middleware (`middleware.ts`)
- Protect: `/today`, `/events`, `/chat`, `/history`, `/profile`
- Public: `/`, `/auth/*`, `/start-setup` (if unauthenticated but they want to try)
- Handle session refresh via `updateSession`

---

## Events Feed Design

### UI (`/events`)
- Top: location pill + date range filter ("This week / This month / All upcoming")
- Category filter chips (same as discover: outdoors, arts, sports, learning, sensory...)
- Card grid: event cards with image, title, dates, age range, cost, save button
- "Save" → saves to `saved_events.list_name = 'saved'`
- Distinction: AI-curated events vs user-added custom sources

### Event Card
```
[Image]
Title                           [Save ♡]
📍 Location name
📅 Sat Mar 15 · 10am–12pm
🎂 Ages 2–8  |  💰 Free
[Tag chips: outdoor, art]
```

### Discovery Agent (`/api/agents/discover-events`)
- Called by Vercel cron (daily or on-demand)
- Searches for events in user's city using:
  1. OpenAI web search / browse tool
  2. Known event sources (Eventbrite API if key present, Google Events fallback)
  3. AI generation as last resort (labeled clearly)
- Stores in `events` table with `discovery_area` = user's city
- Deduplicates by title + date + location
- Sets `expires_at` = event end date + 1 week

### Feed Personalization
- Filter events where age range overlaps user's kids' ages
- Boost events matching `activity_prefs.types`
- Boost events on `schedule_prefs.free_days`
- Surface saved events from custom_event_sources when they're coming up

---

## AI Chat Upgrade

### Context injected into system prompt
```
Family: {parent_name}, kids: {kids with ages}
Location: {city}, Schedule: {free_days + windows}
Activity preferences: {types}
Upcoming saved events: [{title, date, location}]
Custom recurring programs: [{name, recurrence}]
Recent activity history: [{title, action, date}]
Upcoming events in your area: [{title, date}]
Today's weather: {weather}
```

### Sample interactions it should handle
- "What should we do this Saturday?" → pulls Saturday schedule + upcoming events
- "Find something for both kids" → uses age filter across kids
- "We haven't done anything outdoors in a while" → checks history + surfaces outdoor saved events
- "Is there anything happening near us this week?" → pulls events for their city

---

## Daily Email

### Template structure
```
Subject: PlayDays for [Parent Name] — [Day], [Date]

👋 Good morning, [Name]!

☀️ Today in [City]: [weather + high temp]

## Your plan for today
[3 activity cards from today's plan]

## Coming up this week
[2-3 events from saved list or curated feed sorted by date]

## We found something new
[1-2 newly discovered events that match their preferences]

## [AI note]
"[Nora turns 4 next month — the museum's birthday workshop on March 20 could be a great fit!]"

[Open PlayDays] [Manage Preferences]
```

### Email trigger (Vercel cron or on-demand)
- Route: `POST /api/email/daily-digest`
- Existing but upgrade to: pull from Supabase, use real profile, include events
- Cron: 7am local time (use timezone from profile)
- Auth: internal cron secret header

---

## Agents Architecture

### Agent 1: Event Discovery Agent
- **Trigger:** Vercel cron daily + on-demand when user visits `/events` without fresh data
- **Input:** city, kid ages, activity preferences
- **Output:** rows in `events` table
- **Tools:** web search, Eventbrite API (if key), Google Places
- **File:** `src/lib/server/agents/event-discovery.ts`

### Agent 2: Daily Digest Email Agent  
- **Trigger:** Vercel cron 7am daily
- **Input:** all users with `digest_enabled = true`
- **Output:** personalized email per user via Resend
- **File:** `src/lib/server/agents/daily-digest.ts`

### Agent 3: Schedule Insert Agent (smart reminder)
- **Trigger:** When saved event is within 7 days
- **Logic:** checks if event fits free windows, composes a reminder
- **Delivery:** can add to today's plan if date matches today
- **File:** `src/lib/server/agents/schedule-advisor.ts`

---

## Schedule Preferences UI

### `/profile/schedule`
- "My typical free time" — checkboxes for each day of week
- "Morning / Afternoon / Evening" toggles per available day
- "How far will you drive?" — slider (5–60 min)
- "Nap schedule" — toggle + time pickers if applicable
- "Budget comfort" — Free / Low cost / Open to spending
- Save → updates `schedule_prefs` in Supabase

### `/profile/preferences`
- "We love to..." — tag-style checklist (outdoor, art, learning, music, sports, sensory, play dates, water play, animals, building...)
- "We usually go..." — parks, museums, classes, events, libraries, playgrounds, splash pads...
- "Energy level" — Chill / Moderate / Let's run around
- Save → updates `activity_prefs` in Supabase

---

## Custom Event Sources UI

### Add form (accessible from `/profile` and `/events`)
- Name: "Lifetime KidsClub"
- Location: optional address
- Recurrence: "Every Saturday 10am-12pm" (free text + structured day+time pickers)
- Notes: "Kids need to bring shoes"
- Save → `custom_event_sources` table

### Display
- Shows in `/events` feed as "Your Programs" section at top
- Chat agent knows about them
- Schedule advisor can recommend complementary events around them

---

## Implementation Phases

### Phase 1 — Auth + Supabase Persistence (Foundation)
Must be done first. Everything else depends on real user IDs.

**Files:**
- `src/middleware.ts` — route protection + session refresh
- `src/app/auth/login/page.tsx` — magic link entry
- `src/app/auth/callback/route.ts` — OAuth callback
- `src/app/auth/verify/page.tsx` — "check your email" screen
- `src/lib/supabase/middleware.ts` — `updateSession` helper
- `src/lib/supabase/auth.ts` — `getUser()`, `signInWithMagicLink()`, `signOut()`
- `src/components/auth-provider.tsx` — React context for auth state
- `src/app/layout.tsx` — wrap with AuthProvider
- Migrate `start-setup` → write to Supabase on submit
- Migrate `today` → read/write Supabase instead of localStorage
- Migrate `history` → read from Supabase `activity_history`
- New Supabase migration: auth RLS + schedule_prefs + activity_prefs columns

### Phase 2 — Events System (Core New Feature)
- New migration: `events`, `saved_events`, `custom_event_sources`, `event_discovery_log`
- `src/app/events/page.tsx` — events feed
- `src/app/events/[id]/page.tsx` — event detail
- `src/components/event-card.tsx` — reusable event card
- `src/components/events-feed.tsx` — feed with filters
- `src/app/api/events/discover/route.ts` — trigger discovery agent
- `src/app/api/events/save/route.ts` — save/unsave events
- `src/lib/server/agents/event-discovery.ts` — AI discovery agent
- Nav update: add "Events" to app shell

### Phase 3 — Profile + Schedule + Preferences
- `src/app/profile/page.tsx` — profile hub (replaces settings)
- `src/app/profile/schedule/page.tsx` — schedule prefs
- `src/app/profile/preferences/page.tsx` — activity prefs
- `src/app/profile/lists/page.tsx` — saved events lists
- `src/components/schedule-form.tsx`
- `src/components/preferences-form.tsx`
- `src/components/custom-source-form.tsx`
- Supabase: update family_profiles with schedule_prefs + activity_prefs
- Wire into event feed personalization

### Phase 4 — AI Chat Upgrade
- `src/app/api/chat/route.ts` — full context injection (events + profile + history)
- `src/components/chat-assistant.tsx` — show context pills ("Using your saved 3 events + profile")
- Chat tool calls: "search events", "check schedule", "find saved events"
- Remove demo-family fallback when user is authenticated

### Phase 5 — Daily Email
- New migration: update `daily_digest_logs` 
- `src/lib/server/agents/daily-digest.ts` — agent that composes the email
- `src/lib/server/email.ts` — upgrade template to include events
- `src/app/api/email/daily-digest/route.ts` — protect with cron secret, iterate all users
- `vercel.json` — add daily cron at 7am UTC (users can set timezone offset in profile)
- `src/app/profile/page.tsx` — email preferences toggle

### Phase 6 — Polish & Production Readiness
- Mobile-first review of all new routes
- Event discovery rate limiting and caching
- Error states for every new API route
- Loading skeletons for events feed
- Empty states that suggest actions
- `npm run build` + deploy check
- Set all required env vars in Vercel

---

## ENV Variables Required

```bash
# Existing
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # needed for server-side RLS bypass in cron jobs
OPENAI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# New
CRON_SECRET=  # protects /api/email/daily-digest and event discovery from external calls
GOOGLE_PLACES_API_KEY=  # optional, improves discovery
```

---

## Key Design Principles

1. **Always degrade gracefully.** If events discovery fails, show cached events. If no events in DB, show onboarding CTA. Never show raw errors to parents.
2. **Auth state is explicit.** Every page knows if the user is logged in. No silent demo fallbacks once auth exists.
3. **Events feel local and real.** Never show "Newport Beach, CA Parks" as an event. Either it's a real named place/event or it's clearly labeled "searches near you" with an external link.
4. **Email earns its place.** The daily email should be good enough to open every morning — personalized, actionable, short. Not a newsletter.
5. **Custom sources are first-class.** "Lifetime KidsClub" feels like part of the app, not a note someone pasted in.
6. **Supabase replaces localStorage everywhere.** No hybrid — either it's in Supabase or it's transient UI state. Don't mix the two sources of truth.

---

## Files To Touch (Comprehensive List)

### New Files
- `src/middleware.ts`
- `src/lib/supabase/middleware.ts`
- `src/lib/supabase/auth.ts`
- `src/components/auth-provider.tsx`
- `src/app/auth/login/page.tsx`
- `src/app/auth/callback/route.ts`
- `src/app/auth/verify/page.tsx`
- `src/app/events/page.tsx`
- `src/app/events/[id]/page.tsx`
- `src/components/event-card.tsx`
- `src/components/events-feed.tsx`
- `src/app/profile/page.tsx`
- `src/app/profile/schedule/page.tsx`
- `src/app/profile/preferences/page.tsx`
- `src/app/profile/lists/page.tsx`
- `src/components/schedule-form.tsx`
- `src/components/preferences-form.tsx`
- `src/components/custom-source-form.tsx`
- `src/app/api/events/discover/route.ts`
- `src/app/api/events/save/route.ts`
- `src/lib/server/agents/event-discovery.ts`
- `src/lib/server/agents/daily-digest.ts`
- `src/lib/server/agents/schedule-advisor.ts`
- `supabase/migrations/20260312_v2_auth_events.sql`

### Modified Files
- `src/app/layout.tsx` — AuthProvider
- `src/app/page.tsx` — auth-aware nav
- `src/app/today/page.tsx` — Supabase data
- `src/app/history/page.tsx` — Supabase data
- `src/app/chat/page.tsx` — auth guard
- `src/app/start-setup/page.tsx` — write to Supabase
- `src/app/settings/page.tsx` → redirect to /profile
- `src/app/api/chat/route.ts` — full context
- `src/app/api/email/daily-digest/route.ts` — events + cron secret
- `src/components/chat-assistant.tsx` — context-aware
- `src/components/site-shell.tsx` — auth nav + events link
- `src/components/today-board.tsx` — Supabase data + upcoming events sidebar
- `src/lib/storage.ts` — deprecate/replace with Supabase reads
- `src/lib/server/email.ts` — richer template
- `vercel.json` — add cron jobs

---

## Success Criteria

When done, a parent should be able to:
1. Sign up with email → get a magic link → fill in 2-minute profile → see today's plan
2. Browse "Events near me this week" and save ones they like
3. Add "Lifetime KidsClub - Saturdays 10am" as a custom program
4. Open chat and ask "What should we do this Saturday?" and get a real answer
5. Receive a morning email with today's plan + 2 upcoming events
6. See a "Saved Events" list and get reminded as events approach

That's the bar. Everything in this plan serves those 6 user stories.
