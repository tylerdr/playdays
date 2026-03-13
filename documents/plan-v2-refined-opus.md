# PlayDays V2 — Refined Implementation Plan

**Date:** 2026-03-12
**Refined by:** Opus review of original v2 plan
**Purpose:** Production-ready plan for Codex subagents. Every section is actionable.

---

## Review Summary: What Changed from the Original Plan

1. **Phase 1 split into 1A (auth) and 1B (persistence migration)** — shipping auth without migrating every localStorage call at once reduces blast radius
2. **Schedule Insert Agent (Agent 3) cut** — premature complexity; defer to post-launch
3. **Profile routes consolidated** — 4 separate pages → 1 tabbed profile page
4. **Sprinter Kit reuse scoped down** — its auth isn't implemented; only reuse Supabase client patterns (already copied) and Providers wrapper concept
5. **Event discovery agent marked as high-risk** — OpenAI web search is unreliable for real local events; plan includes fallback strategy
6. **Database schema corrected** — unique constraint on user_id, proper handling of existing `profile` JSONB column, timezone column added
7. **Cron timezone issue flagged** — Vercel cron is UTC-only; plan accounts for this
8. **localStorage kept as client cache during transition** — not ripped out, just demoted to cache with Supabase as source of truth

---

## Architecture Decisions (for subagents to follow)

### Auth Strategy: Supabase Magic Link (PKCE flow)
- Use `@supabase/ssr` (already installed) for cookie-based session management
- Middleware refreshes session on every request using `supabase.auth.getUser()`
- **No NextAuth** — Supabase auth is sufficient and simpler
- Magic link only (no passwords, no OAuth providers for now)

### Data Strategy: Supabase is source of truth, localStorage is cache
- Server components read from Supabase directly
- Client components can read localStorage for instant render, then hydrate from Supabase
- All writes go to Supabase first, then update localStorage cache
- The existing `profile` JSONB column in `family_profiles` stores the full `FamilyProfile` object — keep using it, don't split into separate columns

### Agent Strategy: Simple function calls, not a registry
- PlayDays agents are just async functions with typed inputs/outputs
- No agent registry table, no multi-tenant scoping, no DB-backed config
- Each agent is a single file in `src/lib/server/agents/` that exports one function
- Use `ai-sdk` `generateText()` or `streamText()` directly

---

## Database Schema (Corrected Migration)

File: `supabase/migrations/20260312_v2_auth_events.sql`

```sql
-- ============================================================
-- Phase 1A: Auth — wire family_profiles to auth.users
-- ============================================================

-- Add unique constraint so one user = one profile
ALTER TABLE public.family_profiles
  ADD CONSTRAINT family_profiles_user_id_key UNIQUE (user_id);

-- FK to auth.users (user_id column already exists but has no FK)
-- Must handle existing rows with NULL user_id
UPDATE public.family_profiles SET user_id = gen_random_uuid() WHERE user_id IS NULL;
ALTER TABLE public.family_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.family_profiles
  ADD CONSTRAINT family_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add timezone for cron email scheduling
ALTER TABLE public.family_profiles
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Los_Angeles';

-- Add new preference columns (keep existing `profile` JSONB as-is)
ALTER TABLE public.family_profiles
  ADD COLUMN IF NOT EXISTS schedule_prefs jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activity_prefs jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS email_prefs jsonb NOT NULL DEFAULT '{"daily_digest": true, "event_reminders": true}';

-- Enable RLS
ALTER TABLE public.family_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own profile" ON public.family_profiles
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS on existing child tables (use subquery through family_profiles)
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own history" ON public.activity_history
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  );

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved items" ON public.saved_items
  FOR ALL USING (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  );

ALTER TABLE public.daily_digest_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own digest logs" ON public.daily_digest_logs
  FOR SELECT USING (
    profile_id IN (SELECT id FROM public.family_profiles WHERE user_id = auth.uid())
  );

-- ============================================================
-- Phase 2: Events system
-- ============================================================

-- Shared events table (no RLS — all users can read discovered events)
CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  url text,
  image_url text,
  location_name text,
  location_address text,
  city text NOT NULL,
  lat numeric,
  lng numeric,
  start_date date,
  end_date date,
  start_time time,           -- use proper time type, not text
  end_time time,             -- added: original plan missed this
  recurring text,            -- 'weekly', 'monthly', 'one-time'
  age_min int DEFAULT 0,
  age_max int DEFAULT 18,    -- raised from 12 to cover tweens
  cost_type text DEFAULT 'unknown' CHECK (cost_type IN ('free', 'paid', 'unknown')),
  cost_amount numeric,
  tags text[] DEFAULT '{}',
  source text DEFAULT 'ai' CHECK (source IN ('ai', 'manual', 'user')),
  confidence text DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
  is_verified boolean DEFAULT false,
  discovery_area text NOT NULL, -- city or zip used for the search
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz       -- stale after this
);

CREATE INDEX IF NOT EXISTS idx_events_city ON public.events(city);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON public.events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_discovery_area ON public.events(discovery_area);
CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN(tags);

-- Dedupe: prevent same event from being inserted twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_dedup
  ON public.events(title, start_date, city)
  WHERE start_date IS NOT NULL;

-- Enable RLS on events — everyone can SELECT, only service role inserts
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read events" ON public.events
  FOR SELECT USING (true);
-- Insert/update/delete restricted to service_role (no policy = denied for anon/authenticated)

-- User's saved events (bookmarks)
CREATE TABLE IF NOT EXISTS public.saved_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  custom_event jsonb,        -- for manually-entered one-off events
  list_name text DEFAULT 'saved' CHECK (list_name IN ('saved', 'want_to_try', 'done')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_events_has_ref CHECK (event_id IS NOT NULL OR custom_event IS NOT NULL)
);

ALTER TABLE public.saved_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved events" ON public.saved_events
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Custom recurring programs (Lifetime KidsClub, swim lessons, etc.)
CREATE TABLE IF NOT EXISTS public.custom_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  location_name text,
  location_address text,
  day_of_week text,           -- 'monday', 'saturday', etc.
  start_time time,
  end_time time,
  recurrence_text text,       -- free-text: "Every Saturday 10am-12pm"
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own sources" ON public.custom_sources
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Discovery run log (rate limiting + observability)
CREATE TABLE IF NOT EXISTS public.event_discovery_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  ran_at timestamptz NOT NULL DEFAULT now(),
  events_found int DEFAULT 0,
  events_new int DEFAULT 0,
  status text DEFAULT 'ok',
  error_message text
);
```

### Key Schema Corrections from Original Plan
1. **`start_time` is `time` not `text`** — enables proper querying
2. **Added `end_time`** — events have durations
3. **Dedupe unique index** on `(title, start_date, city)` — prevents duplicate discovery
4. **Events table has RLS with SELECT-only for users** — inserts restricted to service_role key
5. **`custom_event_sources` → `custom_sources`** — shorter name, same purpose
6. **Dropped `recurrence_rrule`** — RRULE parsing is overengineered; free-text + structured day/time is enough
7. **Added `CHECK` constraint** on saved_events — must have either event_id or custom_event
8. **`user_id` made NOT NULL** with unique constraint on family_profiles
9. **Added `timezone` column** to family_profiles for email scheduling

---

## Implementation Phases

### Phase 1A — Auth (2-3 files, can ship alone)

**Goal:** Users can sign in with magic link. Protected routes redirect to login. Session persists across refreshes.

**Files to create:**

1. **`src/middleware.ts`** — Route protection + session refresh
   ```
   - Import createServerClient from @supabase/ssr
   - Create supabase client using request cookies
   - Call supabase.auth.getUser() to refresh the session
   - Write updated cookies to the response
   - Protected paths: /today, /events, /chat, /history, /profile, /settings
   - Public paths: /, /auth/*, /start-setup, /api/email/daily-digest
   - If no session on protected path → redirect to /auth/login?next={pathname}
   - If session exists and path is /auth/login → redirect to /today
   ```
   **CRITICAL:** The middleware must use `createServerClient` with `request.cookies` and `NextResponse`, NOT the `cookies()` function from `next/headers` (that's for Server Components/Route Handlers only). Follow the Supabase SSR docs pattern exactly.

2. **`src/app/auth/login/page.tsx`** — Magic link entry
   ```
   - Email input + "Send magic link" button
   - Calls supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '/auth/callback' }})
   - On success → redirect to /auth/verify
   - Client component using createClientSupabaseClient()
   ```

3. **`src/app/auth/callback/route.ts`** — OAuth/magic link callback
   ```
   - GET handler
   - Extract `code` from searchParams
   - Exchange code for session: supabase.auth.exchangeCodeForSession(code)
   - Check if user has a family_profiles row
   - If yes → redirect to /today (or `next` param)
   - If no → redirect to /start-setup
   ```

4. **`src/app/auth/verify/page.tsx`** — "Check your email" screen
   ```
   - Simple static page: "We sent you a magic link. Check your email."
   - Link back to /auth/login to resend
   ```

5. **`src/lib/supabase/middleware.ts`** — Shared `updateSession` helper
   ```
   - Extracted helper used by middleware.ts
   - Creates supabase client from request
   - Calls getUser() to trigger token refresh
   - Returns { supabase, user, response }
   ```

**Files to modify:**

6. **`src/components/site-shell.tsx`** — Add Sign In / Sign Out to nav
   - If no session: show "Sign In" button linking to /auth/login
   - If session: show user email + "Sign Out" button
   - Sign out calls `supabase.auth.signOut()` then redirects to /

7. **`src/app/page.tsx`** — "Get Started" → /auth/login if not signed in, /today if signed in

8. **`src/app/start-setup/page.tsx`** — After profile form submit:
   - If user is authenticated → write profile to Supabase (upsert family_profiles)
   - If not authenticated → keep localStorage behavior (graceful degradation)

**Migration:** Apply Phase 1A portion of `20260312_v2_auth_events.sql` (just the ALTER TABLE and RLS parts)

**Testing checklist:**
- [ ] Sign up with new email → magic link received → callback creates session
- [ ] Protected route redirects to /auth/login when not signed in
- [ ] Session persists across page refreshes (middleware refreshes token)
- [ ] Sign out clears session and redirects to /
- [ ] /start-setup writes to Supabase when authenticated

---

### Phase 1B — Persistence Migration (localStorage → Supabase)

**Goal:** All reads/writes go through Supabase for authenticated users. localStorage becomes a client-side cache only.

**Files to create:**

1. **`src/lib/supabase/storage.ts`** — Supabase-backed storage layer
   ```typescript
   // Mirror the storage.ts API but backed by Supabase
   // Each function takes a supabase client as first arg

   export async function getProfileFromSupabase(supabase: SupabaseClient): Promise<FamilyProfile | null>
   export async function saveProfileToSupabase(supabase: SupabaseClient, profile: FamilyProfile): Promise<void>
   export async function getHistoryFromSupabase(supabase: SupabaseClient, profileId: string): Promise<HistoryEntry[]>
   export async function recordActivityToSupabase(supabase: SupabaseClient, profileId: string, entry: ...): Promise<void>
   export async function getSavedItemsFromSupabase(supabase: SupabaseClient, profileId: string): Promise<SavedItem[]>
   export async function saveSavedItemToSupabase(supabase: SupabaseClient, profileId: string, item: ...): Promise<void>
   ```

**Files to modify:**

2. **`src/app/today/page.tsx`** — Server component that reads profile from Supabase, passes to TodayBoard
3. **`src/app/history/page.tsx`** — Read from Supabase activity_history
4. **`src/app/settings/page.tsx`** → Redirect to /profile (or just update to read/write Supabase)
5. **`src/components/today-board.tsx`** — Accept profile as prop instead of calling localStorage
6. **`src/app/api/chat/route.ts`** — Read profile from Supabase using session, not from request body
7. **`src/app/api/generate-daily/route.ts`** — Read profile from Supabase
8. **`src/app/api/email/daily-digest/route.ts`** — Read from Supabase instead of env var

**DO NOT delete `src/lib/storage.ts`** — keep it as the fallback for unauthenticated users viewing the demo.

---

### Phase 2 — Events System

**Goal:** Users can browse AI-discovered local events, save them, and see them in their feed.

**Files to create:**

1. **`src/app/events/page.tsx`** — Events feed page
   ```
   - Server component: fetch events from Supabase where city matches user's city
   - Filter by: date range, age overlap with user's kids, tags
   - Client-side filter chips for categories
   - Each event renders as EventCard
   - "Your Programs" section at top showing custom_sources
   ```

2. **`src/app/events/[id]/page.tsx`** — Event detail
   ```
   - Server component: fetch single event by ID
   - Show full details + map link + save/unsave button
   - Related events sidebar (same tags or nearby dates)
   ```

3. **`src/components/event-card.tsx`** — Reusable card component
   ```
   - Image (with fallback gradient), title, location, date, age range, cost, tags
   - Save/unsave button (heart icon)
   - Links to /events/[id]
   ```

4. **`src/app/api/events/route.ts`** — REST endpoints
   ```
   - GET: list events with filters (city, date range, tags, age)
   - POST with action=save: save/unsave event for user
   ```

5. **`src/app/api/events/discover/route.ts`** — Trigger discovery
   ```
   - POST: trigger event discovery for a given area
   - Protected by CRON_SECRET header for cron calls
   - Also callable by authenticated users (rate-limited to 1/hour per user)
   - Uses service_role key to insert into events table
   ```

6. **`src/lib/server/agents/event-discovery.ts`** — Discovery agent
   ```
   - Input: { city, state, kidAges, preferences }
   - Uses ai-sdk generateText() with OpenAI
   - System prompt instructs model to find real local events
   - CRITICAL: Include today's date in the prompt
   - Output: array of event objects matching the events table schema
   - Insert with ON CONFLICT DO NOTHING (dedupe index handles it)
   - Log run to event_discovery_runs
   ```

   **RISK FLAG:** OpenAI's responses about local events will often be hallucinated or outdated. Mitigations:
   - Mark all AI-discovered events as `confidence: 'low'`, `is_verified: false`
   - Show a subtle badge: "AI-found — verify before going"
   - Include the event URL so users can check the source
   - Consider adding Eventbrite/Google Events API integration later for higher-confidence events

7. **`src/components/custom-source-form.tsx`** — Add/edit custom programs
   ```
   - Name, location, day of week dropdown, start/end time pickers, free-text recurrence, notes
   - Save to custom_sources table
   ```

**Files to modify:**

8. **`src/lib/site.ts`** — Add "Events" to `appNav`
9. **`src/components/site-shell.tsx`** — Events link in nav + mobile bottom bar (now 6 items → consider grouping)

**Migration:** Apply Phase 2 portion of the SQL migration

---

### Phase 3 — Profile & Preferences

**Goal:** Users configure their schedule, activity preferences, and manage saved events lists from a single profile page.

**Files to create:**

1. **`src/app/profile/page.tsx`** — Unified profile hub with tabs
   ```
   Tabs: Overview | Schedule | Preferences | Saved | Programs
   - Overview: parent name, email, location, kids, email digest toggle
   - Schedule: free days, time windows, drive distance, nap schedule, budget
   - Preferences: activity types, settings, energy level
   - Saved: saved_events grouped by list_name (saved, want_to_try, done)
   - Programs: custom_sources list + add form
   ```
   **Why one page instead of four:** Fewer routes = simpler nav, faster to build, easier to maintain. Tabs can lazy-load.

2. **`src/components/schedule-prefs-form.tsx`** — Schedule preferences form
3. **`src/components/activity-prefs-form.tsx`** — Activity preferences form

**Files to modify:**

4. **`src/app/settings/page.tsx`** — Redirect to `/profile`

### `schedule_prefs` JSON shape (stored in family_profiles.schedule_prefs)
```json
{
  "free_days": ["saturday", "sunday"],
  "morning_free": true,
  "afternoon_free": true,
  "evening_free": false,
  "max_drive_minutes": 30,
  "nap_start": "12:30",
  "nap_end": "14:30",
  "budget": "moderate"
}
```

### `activity_prefs` JSON shape (stored in family_profiles.activity_prefs)
```json
{
  "types": ["outdoor", "art", "sensory", "educational"],
  "settings": ["parks", "museums", "classes"],
  "indoor_outdoor": "both",
  "energy_level": "medium"
}
```

---

### Phase 4 — AI Chat Upgrade

**Goal:** Chat responses are context-aware — they know the family, saved events, custom programs, and upcoming discovered events.

**Files to modify:**

1. **`src/app/api/chat/route.ts`** — Full context injection
   ```
   - Read from Supabase: family_profiles, saved_events, custom_sources, events (for user's area)
   - Build system prompt with structured context:
     Family: {parentName}, kids: [{name, age}]
     Location: {city}
     Schedule: {free_days, windows, nap times}
     Activity preferences: {types}
     Saved events: [{title, date, list}]  (limit 10)
     Custom programs: [{name, recurrence}]  (limit 10)
     Recent history: [{title, action, date}]  (limit 10)
     Upcoming events nearby: [{title, date}]  (limit 10)
     Weather: {from existing weather fetch}
   - Remove the demo-family fallback for authenticated users
   - Keep fallback mode for unauthenticated users (current behavior)
   ```

**DO NOT build:**
- Chat tool calls (search events, check schedule) — defer to post-launch
- Context pills UI ("Using your 3 saved events") — nice but low priority

---

### Phase 5 — Daily Email Upgrade

**Goal:** Morning email includes events + is sent from Supabase data instead of env var.

**Files to modify:**

1. **`src/app/api/email/daily-digest/route.ts`**
   ```
   - GET handler (cron trigger):
     - Verify CRON_SECRET header
     - Query all family_profiles where digest_enabled = true
     - For each: compose and send email via Resend
   - POST handler (manual trigger for testing):
     - Read user from session
     - Send digest for that user only
   ```

2. **`src/lib/server/agents/daily-digest.ts`** — Compose personalized email content
   ```
   - Input: family profile, saved events, upcoming area events, weather
   - Uses ai-sdk generateText() to compose the AI note
   - Returns structured email data (not HTML)
   ```

3. **`src/lib/server/email.ts`** — Upgraded email template
   ```
   - Include: today's plan summary, 2-3 upcoming events, AI note
   - Use React Email or inline HTML (Resend supports both)
   ```

4. **`vercel.json`** — Update cron
   ```json
   {
     "crons": [
       {
         "path": "/api/email/daily-digest",
         "schedule": "0 14 * * *"
       }
     ]
   }
   ```
   **Note:** Vercel cron is UTC-only. 14:00 UTC = 7am PDT / 6am PST. For multi-timezone support, run the cron hourly and filter users by timezone in the handler. **For MVP, keep the single 14:00 UTC cron** — Tyler's family is in California.

---

### Phase 6 — Polish & Production

**Goal:** Ship-quality UX for daily use.

**Checklist:**
- [ ] Mobile-first review of all new routes (test on iPhone Safari)
- [ ] Loading skeletons for events feed, profile page
- [ ] Empty states: no events yet → "We're discovering events in your area..."
- [ ] Error states: API failures show friendly messages, never raw errors
- [ ] Event discovery rate limiting: max 1 discovery run per area per 6 hours
- [ ] `npm run build` succeeds with no type errors
- [ ] All env vars set in Vercel (see list below)
- [ ] Supabase Auth email templates customized (magic link email should say "PlayDays" not "Supabase")
- [ ] Test magic link flow end-to-end on production domain
- [ ] RLS policies tested with Supabase SQL editor

---

## What NOT to Build (Scope Control)

| Feature | Why not |
|---------|---------|
| Schedule Insert Agent (Agent 3) | Premature — need real usage data before automating schedule insertion |
| Chat tool calls | Structured context injection is sufficient for v2; tool calls add complexity |
| Event image scraping | Just use a placeholder gradient or emoji; image reliability is low |
| Google Calendar sync | Way out of scope; would need OAuth consent screen |
| Multi-family / sharing | Single-family app for now |
| Push notifications | Web push is complex; daily email covers the notification use case |
| Event comments/reviews | Social features are out of scope |
| RRULE parsing for custom sources | Free-text + structured day/time is enough |
| Password auth | Magic link only — simpler, more secure |
| OAuth providers (Google, Apple) | Can add later; magic link works fine for a family audience |

---

## Risk Flags

### HIGH RISK: Event Discovery Hallucinations
OpenAI will fabricate events. Mitigations:
- All AI events marked `confidence: 'low'` with visible badge
- Always include source URL for verification
- Dedupe index prevents repeated hallucinations
- Consider adding real API sources (Eventbrite, Google Events) in a fast-follow

### MEDIUM RISK: Supabase Auth Email Deliverability
Supabase's default magic link emails may land in spam. Mitigations:
- Configure custom SMTP in Supabase dashboard (use Resend as SMTP provider)
- Customize email template to say "PlayDays" with proper branding
- Test with Gmail, iCloud, and Outlook before launch

### MEDIUM RISK: Middleware Cookie Handling in Next.js 16
Next.js 16 changed cookie handling. The middleware must:
- Use `request.cookies` (not `cookies()` from next/headers)
- Return a `NextResponse` with updated cookies
- NOT try to set cookies in a Server Component (read-only context)
- Follow the Supabase SSR + Next.js guide exactly

### LOW RISK: localStorage → Supabase Migration for Existing Users
Tyler and testers may have data in localStorage. Plan:
- On first authenticated load, check if localStorage has data
- If yes, offer to import it into Supabase profile
- One-time migration, then localStorage becomes cache-only

---

## ENV Variables Required

```bash
# Existing (already set)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# New (must add to Vercel)
SUPABASE_SERVICE_ROLE_KEY=     # for event discovery inserts + cron digest
CRON_SECRET=                    # protects /api/email/daily-digest and /api/events/discover
# GOOGLE_PLACES_API_KEY=       # optional, not needed for MVP
```

---

## Sprinter Kit Reuse (Specific)

| What | Where in sprinter-kit | How to use in PlayDays |
|------|----------------------|----------------------|
| Supabase server client pattern | `apps/sprinter-starter/lib/supabase/server.ts` | Already copied to PlayDays — identical pattern |
| Supabase browser client pattern | `apps/sprinter-starter/lib/supabase/client.ts` | Already copied |
| Providers wrapper | `apps/sprinter-starter/app/providers.tsx` | Adapt: wrap with a simple AuthProvider that exposes `{ user, profile, signOut }` |
| Layout structure | `apps/sprinter-starter/app/layout.tsx` | Same pattern: `<Providers>{children}</Providers>` |

**Do NOT reuse:**
- Agent registry (`lib/ai/agents.ts`) — it's multi-tenant DB-backed, overkill for PlayDays
- Context assembly (`packages/context`) — too abstract; PlayDays just needs a system prompt builder
- View registry, entity types, workflow engine — enterprise patterns, wrong fit

---

## File Manifest (Complete)

### New Files (in implementation order)

**Phase 1A — Auth:**
```
src/middleware.ts
src/lib/supabase/middleware.ts
src/app/auth/login/page.tsx
src/app/auth/callback/route.ts
src/app/auth/verify/page.tsx
supabase/migrations/20260312_v2_auth_events.sql
```

**Phase 1B — Persistence:**
```
src/lib/supabase/storage.ts
```

**Phase 2 — Events:**
```
src/app/events/page.tsx
src/app/events/[id]/page.tsx
src/components/event-card.tsx
src/app/api/events/route.ts
src/app/api/events/discover/route.ts
src/lib/server/agents/event-discovery.ts
src/components/custom-source-form.tsx
```

**Phase 3 — Profile:**
```
src/app/profile/page.tsx
src/components/schedule-prefs-form.tsx
src/components/activity-prefs-form.tsx
```

**Phase 5 — Email:**
```
src/lib/server/agents/daily-digest.ts
```

### Modified Files

```
src/app/page.tsx                          — auth-aware CTA buttons
src/app/layout.tsx                        — wrap with AuthProvider (if using React context)
src/app/start-setup/page.tsx              — write to Supabase when authenticated
src/app/today/page.tsx                    — read from Supabase
src/app/history/page.tsx                  — read from Supabase
src/app/settings/page.tsx                 — redirect to /profile
src/app/api/chat/route.ts                — full context from Supabase
src/app/api/email/daily-digest/route.ts  — Supabase data + cron secret
src/app/api/generate-daily/route.ts      — read profile from Supabase
src/components/site-shell.tsx             — auth nav + events link
src/components/today-board.tsx            — accept profile as prop
src/lib/site.ts                          — add Events to appNav
src/lib/server/email.ts                  — richer template with events
vercel.json                              — keep existing cron, optionally add events discovery cron
```

---

## Success Criteria (Unchanged)

A parent should be able to:
1. Sign up with email → magic link → profile setup → see today's plan
2. Browse local events and save ones they like
3. Add custom recurring programs
4. Ask chat "What should we do this Saturday?" and get a real answer
5. Receive a morning email with today's plan + upcoming events
6. Manage saved events across lists (saved, want to try, done)

---

## Implementation Notes for Subagents

### Middleware (trickiest part)
The middleware pattern for Supabase + Next.js App Router:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Route protection logic here...

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

**Key gotcha:** You MUST return `supabaseResponse`, not a new `NextResponse.redirect()`. If redirecting, create the redirect response and copy all cookies from `supabaseResponse` to it.

### Event Discovery Agent
```typescript
// src/lib/server/agents/event-discovery.ts
import { generateText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createClient } from '@supabase/supabase-js'

export async function discoverEvents(area: { city: string; state?: string; kidAges: number[] }) {
  const today = new Date().toISOString().split('T')[0]

  const { text } = await generateText({
    model: openai('gpt-4o'),
    system: `You are a local events researcher. Find real, upcoming family-friendly events.
Today is ${today}. Return ONLY events you are confident actually exist.
Return JSON array of objects with: title, description, url, location_name, location_address, city, start_date (YYYY-MM-DD), start_time (HH:MM), end_time (HH:MM), age_min, age_max, cost_type (free/paid/unknown), tags (array of strings).
If you are not sure about an event, do not include it.`,
    prompt: `Find 5-10 upcoming family-friendly events in ${area.city} for kids ages ${area.kidAges.join(', ')}. Focus on this week and next week.`,
  })

  // Parse, validate with zod, insert with service_role client
  // ON CONFLICT DO NOTHING handles deduplication
}
```

### Auth Callback Route
```typescript
// src/app/auth/callback/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/today'

  if (code) {
    const supabase = await createServerSupabaseClient()
    if (!supabase) {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if user has a profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('family_profiles')
          .select('id')
          .eq('user_id', user.id)
          .single()

        if (!profile) {
          return NextResponse.redirect(new URL('/start-setup', request.url))
        }
      }
      return NextResponse.redirect(new URL(next, request.url))
    }
  }

  return NextResponse.redirect(new URL('/auth/login?error=callback', request.url))
}
```
